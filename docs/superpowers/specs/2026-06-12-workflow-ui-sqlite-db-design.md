# Workflow-UI 插件 API 增加 SQLite 读写能力

- **日期**：2026-06-12
- **状态**：已确认（待实现）
- **涉及模块**：`packages/server`、`packages/web`
- **入口文件**：`packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts`

## 1. 背景与目标

Workflow-UI 项目在预览 iframe 中运行用户代码（React/HTML），通过 `window.AgentSpacesUI` / `window.AgentSpaces` / `window.AgentSpacesAPI` 三个宿主全局对象调用平台能力。现有数据相关能力：

- `readConfigJson` / `writeConfigJson`：读写 `configs/` 目录（JSON 配置）。
- `saveDataFile` / `downloadFile`：写入 `data/` 目录（**仅写**，无读取）。

随着插件复杂度提升，预览代码需要**结构化、可查询**的本地存储——典型的 JSON 文件在数据量增大、需要条件查询/聚合/事务时力不从心。本设计为宿主 API 增加 **SQLite 读写能力**，让预览代码能创建具名数据库文件、执行 SQL、跑事务，db 文件持久化到项目数据目录。

### 目标

- 预览代码可通过 `AgentSpaces.db(name)` 获得一个数据库句柄，执行 `exec/run/get/all` 与批量事务。
- 每个具名库对应一个 `.sqlite` 文件，存放在 `<projectId>/data/db/` 下。
- 复用现有 `data/` 子目录的越界保护与项目删除清理逻辑。

### 非目标（YAGNI）

- **不**提供高层 ORM/表操作封装（find/insert/update/delete）。
- **不**提供会话式事务（BEGIN 跨多次请求、事务内查询驱动后续语句）。
- **不**支持跨项目共享数据库。
- **不**做 SQL 语法白名单（仅拦截逃逸性语句 ATTACH/DETACH）。
- **不**纳入插件 tool 后端执行时的 db 访问（本设计仅服务前端预览代码）。

## 2. 现状分析

### 数据目录结构（`~/.agent-spaces-data/workflows-ui/<projectId>/`）

```
manifest.json
src/          # 源代码（safeSrcPath 保护，完整 CRUD）
configs/      # 配置（readConfig/writeConfig，GET+PUT 齐全）
data/         # 数据（writeDataFile，仅 PUT，无 GET）
avatar.xxx
```

### 能力缺口

| 位置 | 现状 | 缺口 |
|------|------|------|
| 前端 host API | `saveDataFile`（写 data/） | 无 `data/` 读取；无结构化存储 |
| 后端路由 | `PUT /:id/data/content` | 无 `GET /:id/data/content`；无 db 能力 |
| 依赖 | workflow-ui 子系统零 SQLite 依赖 | 需引入 better-sqlite3 |

### 关键既有实现（复用点）

- `safeProjectSubdirPath(projectId, 'data' \| 'configs', filePath)`：越界保护，禁止绝对路径与 `..` 逃逸（[workflow-ui-store.ts:61](packages/server/src/storage/workflow-ui-store.ts#L61)）。
- `deleteProject`：递归 `rmSync` 整个项目目录（[workflow-ui-store.ts:156](packages/server/src/storage/workflow-ui-store.ts#L156)）。
- `normalizeRelativePath`：前端路径校验（[use-workflow-ui-host-api.ts:36](packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts#L36)）。
- `fetchWithAuth`：前端带鉴权的 fetch 封装。
- `touchProject`：写操作后更新 `updatedAt`。

## 3. 已确认的设计决策

| 维度 | 决策 | 理由 |
|------|------|------|
| 存储引擎 | **SQLite（better-sqlite3）** | 真正的 SQL 能力，单文件、无服务进程 |
| 接口风格 | **SQL 直接执行**（exec/run/get/all） | 贴近 better-sqlite3 原生，能力完整、参数化防注入、零额外抽象 |
| 文件组织 | **多个具名库**（`db('name')`） | 按模块/插件隔离，表结构互不干扰 |
| 事务 | **语句数组批量**（一次请求原子提交） | REST 无状态模型下最现实：原子、往返最少、无连接占用 |

## 4. 架构与数据流

```
预览代码 (iframe)
  └─ window.AgentSpaces.db('logs')              [新增 host API]
        │   每次 all/get/run/exec 各发一次 REST；transaction 发一次批量
        ▼
  POST /api/workflows-ui/:id/db/:dbName         [新增路由]
  POST /api/workflows-ui/:id/db/:dbName/transaction
        ▼
  service: executeDb / executeDbTransaction     [新增]
        │   复用缓存的 better-sqlite3 Database 实例
        ▼
  <projectId>/data/db/<dbName>.sqlite
```

后端是唯一的文件操作方（与现有 configs 写入权收敛到服务端的设计一致），前端只发 SQL 文本与参数。

## 5. 数据目录布局

在现有 `data/` 下新增 `db/` 层级：

```
~/.agent-spaces-data/workflows-ui/<projectId>/
├── src/
├── configs/
├── data/
│   ├── (saveDataFile 存的任意文件，保持不变)
│   └── db/                  # ← 新增
│       ├── logs.sqlite
│       ├── main.sqlite
│       └── ...
└── manifest.json
```

db 文件路径由 `safeProjectSubdirPath(projectId, 'data', 'db/<dbName>.sqlite')` 计算，天然继承越界保护。

## 6. 前端 API 设计

新增 `db` 工厂，挂到 `window.AgentSpaces` 与 `window.AgentSpacesAPI`（归"数据能力"，与 `saveDataFile` 同列）。**不**挂 `AgentSpacesUI`（UI 对象只承载组件与既有文件助手）。

### 类型定义

```ts
type SqlParams = unknown[] | Record<string, unknown>;

interface DbHandle {
  /** 返回所有匹配行；结果行数受上限约束（默认 10000） */
  all<T = any>(sql: string, params?: SqlParams): Promise<T[]>;
  /** 返回首行，无结果返回 null */
  get<T = any>(sql: string, params?: SqlParams): Promise<T | null>;
  /** 执行写操作，返回影响行数与 lastInsertRowid */
  run(sql: string, params?: SqlParams): Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  /** 执行多条无返回语句（建表、索引等），不传参 */
  exec(sql: string): Promise<void>;
  /** 语句数组在一个事务内原子执行，任一失败整体回滚 */
  transaction(statements: { sql: string; params?: SqlParams }[]): Promise<void>;
}
```

### 用法

```ts
const logs = window.AgentSpaces.db('logs');
await logs.exec(`CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts INTEGER, msg TEXT)`);
await logs.run(`INSERT INTO events(ts, msg) VALUES(?, ?)`, [Date.now(), 'hello']);
const row = await logs.get(`SELECT COUNT(*) AS n FROM events WHERE msg LIKE ?`, ['%ello%']);
const rows = await logs.all(`SELECT * FROM events ORDER BY ts DESC LIMIT 100`);

await logs.transaction([
  { sql: `INSERT INTO events(ts, msg) VALUES(?, ?)`, params: [Date.now(), 'a'] },
  { sql: `UPDATE counters SET n = n + 1 WHERE name = ?`, params: ['events'] },
]);
```

### 实现要点（[use-workflow-ui-host-api.ts](packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts)）

- 库名前端先校验 `/^[a-zA-Z0-9_-]{1,64}$/`，不合法直接 `throw new Error`（清晰报错，避免发到后端）。
- 每个 method 对应一次 `fetchWithAuth('POST', ...)`；错误响应转 `throw`，风格与 `saveDataFile` 一致。
- `db` 工厂闭包持有 `projectId`，返回的句柄为轻量对象，无需缓存（每次调用即一次 REST）。
- 与现有挂载块合并，`AgentSpaces` 与 `AgentSpacesAPI` 都展开 `db`。

## 7. 后端实现

### 7.1 路由（[workflow-ui.ts route](packages/server/src/routes/workflow-ui.ts)）

新增两个端点：

```
POST /api/workflows-ui/:id/db/:dbName
  body: { sql: string, params?: SqlParams, mode: 'all'|'get'|'run'|'exec' }
  res : { ok: true, result: <按 mode> }
       all → 行数组；get → 行|null；run → { changes, lastInsertRowid }；exec → undefined

POST /api/workflows-ui/:id/db/:dbName/transaction
  body: { statements: [{ sql: string, params?: SqlParams }, ...] }
  res : { ok: true }
```

错误统一返回 `{ ok: false, error: { code, message } }`，HTTP 400。

### 7.2 连接管理层（新建 [packages/server/src/storage/workflow-ui-db.ts](packages/server/src/storage/workflow-ui-db.ts)）

封装 better-sqlite3，职责：库名校验、路径解析、连接缓存复用、SQL 执行、事务、项目级清理。

```ts
import Database from 'better-sqlite3';

const POOL = new Map<string, Database>();           // key: `${projectId}/${dbName}`
const DB_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_ROWS = 10000;
const BLOCKED_RE = /\b(ATTACH|DETACH)\b/i;          // 防逃逸到任意文件

function validateDbName(dbName: string): void {
  if (!DB_NAME_RE.test(dbName)) throw new Error(`Invalid db name: ${dbName}`);
}

export function openDb(projectId: string, dbName: string): Database {
  validateDbName(dbName);
  const key = `${projectId}/${dbName}`;
  const cached = POOL.get(key);
  if (cached) return cached;
  const fullPath = safeProjectSubdirPath(projectId, 'data', `db/${dbName}.sqlite`);
  ensureDir(dirname(fullPath));
  const db = new Database(fullPath);                // 默认读写、不存在则创建
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  POOL.set(key, db);
  return db;
}

// params: 数组 → 按位置；对象 → 命名占位符；undefined → 空参数
function bindArgs(params: SqlParams | undefined): unknown[] {
  if (params == null) return [];
  return Array.isArray(params) ? params : [params];
}

function checkSql(sql: string): void {
  if (BLOCKED_RE.test(sql)) throw new Error('ATTACH/DETACH are not allowed');
}

export function executeDb(projectId, dbName, mode, sql, params) {
  checkSql(sql);
  const db = openDb(projectId, dbName);
  const stmt = db.prepare(sql);
  switch (mode) {
    case 'all': {
      const rows = stmt.all(...bindArgs(params));
      if (rows.length > MAX_ROWS) throw new Error(`Result exceeds ${MAX_ROWS} rows`);
      return rows;
    }
    case 'get': return stmt.get(...bindArgs(params)) ?? null;
    case 'run': {
      const r = stmt.run(...bindArgs(params));
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid as number | bigint };
    }
    case 'exec': db.exec(sql); return undefined;
  }
}

export function executeDbTransaction(projectId, dbName, statements) {
  for (const s of statements) checkSql(s.sql);
  const db = openDb(projectId, dbName);
  const runTx = db.transaction(() => {
    for (const { sql, params } of statements) {
      db.prepare(sql).run(...bindArgs(params));  // 事务内统一按 run 执行
    }
  });
  runTx();   // 抛错则自动回滚
}

export function closeProjectDbs(projectId: string): void {
  for (const [key, db] of POOL) {
    if (key.startsWith(`${projectId}/`)) { try { db.close(); } catch {} POOL.delete(key); }
  }
}
```

> `bindArgs`：数组按位置展开绑定；对象以单参传入（better-sqlite3 识别 `:name`/`@name`/`$name` 命名占位符）；`undefined` 为空参数。事务内仅支持 `run` 语义（批量原子，无返回需求）。

### 7.3 service 层（[workflow-ui.ts service](packages/server/src/services/workflow-ui.ts)）

新增薄封装，参数校验后透传到 `workflow-ui-db.ts`，并 `touchProject(projectId)` 更新时间戳：

```ts
export function executeDb(projectId, dbName, mode, sql, params) {
  const result = dbStore.executeDb(projectId, dbName, mode, sql, params);
  touchProject(projectId);
  return result;
}
export function executeDbTransaction(projectId, dbName, statements) {
  dbStore.executeDbTransaction(projectId, dbName, statements);
  touchProject(projectId);
}
```

### 7.4 项目删除清理（[workflow-ui-store.ts](packages/server/src/storage/workflow-ui-store.ts)）

`deleteProject` 在递归删除目录前，调用 `closeProjectDbs(projectId)` 关闭并清理缓存的连接，避免句柄泄漏与 Windows 下的文件占用问题。

## 8. 安全与资源约束

| 风险 | 处理 |
|------|------|
| 路径穿越 | 库名白名单 `/^[a-zA-Z0-9_-]{1,64}$/` + `safeProjectSubdirPath` 越界保护 |
| SQL 注入 | 强制参数化（`?` / 命名占位符），better-sqlite3 原生 prepared statement |
| 逃逸到任意文件 | 拦截 `ATTACH` / `DETACH`（正则 `/\b(ATTACH\|DETACH)\b/i` 预检，命中即拒）。**保守策略**：含这些词的字面量 SQL 也会被拒，安全优先于边角兼容 |
| 结果过大 | `all` 行数上限 10000，超出报错 |
| 锁等待 | `busy_timeout = 5000` |
| 同步阻塞 | better-sqlite3 同步执行；单项目量级可接受，后续如有重查询再评估 |
| 并发读 | WAL 模式 |

> 预览代码可执行任意 SQL（建表、删表、写数据）——这是设计内的能力，边界是"限于本项目自己的 db 文件"，由库名白名单与越界保护保证。SQL **不**做语法白名单（YAGNI）。

## 9. 错误处理

- better-sqlite3 抛 `SqliteError`（含 `code`，如 `SQLITE_CONSTRAINT_UNIQUE`）→ 路由层捕获，返回 `{ ok: false, error: { code, message } }`，HTTP 400。
- 库名非法、路径越界、ATTACH 拦截、行数超限 → 同样 400 + 结构化错误。
- 前端 host API 将非 `ok` 响应转 `throw new Error(message)`，与 `saveDataFile` 风格一致。

## 10. 生命周期

- 连接按 `(projectId, dbName)` 缓存复用（避免每次请求重开文件、重复建连接）。
- `deleteProject` → `closeProjectDbs(projectId)` 关闭并清缓存（目录已递归删）。
- ZIP 导出/导入：db 文件位于 `data/db/`，是否随 `exportZip` 导出取决于其当前是否包含 `data/`——实现时确认。即便不导出也不影响运行时功能，仅影响项目迁移完整性（可作为后续小项）。

## 11. 影响范围

| 类型 | 文件 / 包 |
|------|-----------|
| 新增依赖 | `packages/server` → `better-sqlite3`、`@types/better-sqlite3`（native 模块；Windows 有 prebuild；Docker 构建 `Dockerfile.server` 需确认编译工具链） |
| 新建 | [packages/server/src/storage/workflow-ui-db.ts](packages/server/src/storage/workflow-ui-db.ts) |
| 改 | [packages/server/src/routes/workflow-ui.ts](packages/server/src/routes/workflow-ui.ts)（+2 路由） |
| 改 | [packages/server/src/services/workflow-ui.ts](packages/server/src/services/workflow-ui.ts)（+`executeDb`/`executeDbTransaction`） |
| 改 | [packages/server/src/storage/workflow-ui-store.ts](packages/server/src/storage/workflow-ui-store.ts)（`deleteProject` 调 `closeProjectDbs`） |
| 改 | [use-workflow-ui-host-api.ts](packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts)（+`db` API 与挂载） |
| 可选 | [packages/sdk/src/modules/workflow-ui.ts](packages/sdk/src/modules/workflow-ui.ts)（若需 SDK 暴露 `db` 方法；当前 host API 走 `fetchWithAuth` 直连，非必须） |

## 12. 验证步骤（实现后由用户执行）

1. `pnpm install`（安装 better-sqlite3 native 模块）。
2. `pnpm dev`，打开一个 workflow-ui 项目预览。
3. 预览代码依次验证：
   - `db('demo').exec(建表)` → `run(插入)` → `get/all(查询)` 正常。
   - `transaction([...])` 批量成功；构造一条故意失败的语句，确认整体回滚（前序语句不落库）。
   - 故意写语法错误 SQL，确认抛出含 `code`/`message` 的错误。
   - 用 `db('..')` 等非法库名，确认前端直接报错。
4. 检查 `~/.agent-spaces-data/workflows-ui/<id>/data/db/demo.sqlite` 已生成、且用 SQLite 工具能打开看到表与数据。
5. 删除该项目，确认 `data/db/` 与文件被清除、缓存连接已关闭（无句柄泄漏 / Windows 文件占用）。
