# Workflow-UI SQLite 能力实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 workflow-ui 预览代码的宿主 API 增加 SQLite 读写能力（`AgentSpaces.db(name)`），db 文件持久化到项目 `data/db/` 目录。

**Architecture:** 前端 host API `db(name)` 返回句柄（all/get/run/exec/transaction）→ REST `POST /api/workflows-ui/:id/db/:dbName[...]` → service 转发 → 新建 `workflow-ui-db.ts` 用 better-sqlite3 执行（连接池复用 + 越界保护）。纯函数安全校验走 TDD，DB 实际执行/路由/前端走手动验证。

**Tech Stack:** Express 5（后端路由）、better-sqlite3（同步 SQLite）、node:test（纯函数单测）、React host API（前端 `fetchWithAuth`）。

**Git 说明（遵循用户全局规则）：** 本计划的 commit 步骤均为**建议**，由用户手动执行；Claude 不自动运行任何 git 命令。每个 Task 末尾的 commit checkbox 可选。

**对应 Spec：** [docs/superpowers/specs/2026-06-12-workflow-ui-sqlite-db-design.md](../specs/2026-06-12-workflow-ui-sqlite-db-design.md)

---

## File Structure

| 文件 | 职责 | 动作 |
|------|------|------|
| `packages/server/package.json` | 声明 better-sqlite3 依赖 | Modify |
| `packages/server/test/workflow-ui-db.test.ts` | 纯函数安全校验单测（validateDbName/checkSql/bindArgs） | Create |
| `packages/server/src/storage/workflow-ui-db.ts` | SQLite 连接池 + 执行 + 越界保护 + 纯函数校验 | Create |
| `packages/server/src/storage/workflow-ui-store.ts` | export `touchProject`（供 service 调用） | Modify |
| `packages/server/src/services/workflow-ui.ts` | `executeDb`/`executeDbTransaction` 转发 + `deleteProject` 清连接 | Modify |
| `packages/server/src/routes/workflow-ui.ts` | 2 个 db REST 端点 | Modify |
| `packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts` | `db` 工厂 + 挂载到 AgentSpaces/AgentSpacesAPI | Modify |

**依赖方向（无环）：** `route → service → { workflow-ui-db.ts, store }`；`workflow-ui-db.ts → json-store + better-sqlite3`（不依赖 store，自行拼路径）；store 不依赖 db。

---

## Task 1: 添加 better-sqlite3 依赖

**Files:**
- Modify: `packages/server/package.json`

- [ ] **Step 1: 安装运行时依赖**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/server add better-sqlite3
```
Expected: `packages/server/package.json` 的 `dependencies` 出现 `"better-sqlite3": "^x.x.x"`，pnpm 下载并触发 native prebuild 安装（Windows 下走 prebuilt 二进制，无需编译）。

- [ ] **Step 2: 安装类型依赖**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/server add -D @types/better-sqlite3
```
Expected: `packages/server/package.json` 的 `devDependencies` 出现 `"@types/better-sqlite3"`。

- [ ] **Step 3: 验证 better-sqlite3 可加载并执行内存库 SQL**

Run（仓库根目录）:
```bash
node --input-type=module -e "import Database from 'better-sqlite3'; const db=new Database(':memory:'); db.exec('CREATE TABLE t(x)'); console.log(db.prepare('SELECT 42 AS r').get());"
```
Expected: 打印 `{ r: 42 }`。若报 native 模块加载错误，确认 Node 版本 ≥ 20 且 prebuild 已就位。

- [ ] **Step 4（可选 commit）**

```bash
git add packages/server/package.json pnpm-lock.yaml
git commit -m "chore(server): add better-sqlite3 dependency for workflow-ui db"
```

---

## Task 2: workflow-ui-db.ts 纯函数安全校验（TDD）

**Files:**
- Create: `packages/server/test/workflow-ui-db.test.ts`
- Create: `packages/server/src/storage/workflow-ui-db.ts`（本任务只写纯函数部分，不 import better-sqlite3）

- [ ] **Step 1: 写失败测试**

Create `packages/server/test/workflow-ui-db.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDbName, checkSql, bindArgs } from '../src/storage/workflow-ui-db.js';

test('validateDbName accepts legal names', () => {
  assert.doesNotThrow(() => validateDbName('logs'));
  assert.doesNotThrow(() => validateDbName('main_db-1'));
  assert.doesNotThrow(() => validateDbName('A'));
});

test('validateDbName rejects illegal names', () => {
  assert.throws(() => validateDbName(''), /Invalid db name/);
  assert.throws(() => validateDbName('a/b'), /Invalid db name/);
  assert.throws(() => validateDbName('..'), /Invalid db name/);
  assert.throws(() => validateDbName('a b'), /Invalid db name/);
  assert.throws(() => validateDbName('a.b'), /Invalid db name/);
  assert.throws(() => validateDbName('a'.repeat(65)), /Invalid db name/);
});

test('checkSql blocks ATTACH/DETACH (case-insensitive) but allows normal SQL', () => {
  assert.throws(() => checkSql('ATTACH DATABASE "x" AS x'), /not allowed/i);
  assert.throws(() => checkSql('attach database x as x'), /not allowed/i);
  assert.throws(() => checkSql('DETACH x'), /not allowed/i);
  assert.doesNotThrow(() => checkSql('SELECT * FROM t WHERE x = 1'));
  assert.doesNotThrow(() => checkSql('INSERT INTO logs(msg) VALUES(?)'));
});

test('bindArgs normalizes params (array positional / object named / undefined empty)', () => {
  assert.deepEqual(bindArgs(undefined), []);
  assert.deepEqual(bindArgs([1, 2]), [1, 2]);
  const obj = { a: 1 };
  assert.deepEqual(bindArgs(obj), [obj]);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run（仓库根目录）:
```bash
node --import tsx --test packages/server/test/workflow-ui-db.test.ts
```
Expected: FAIL，错误为无法解析 `../src/storage/workflow-ui-db.js`（模块不存在）。
> 备选命令（若上面不工作）：`npx tsx --test packages/server/test/workflow-ui-db.test.ts`

- [ ] **Step 3: 写最小实现（纯函数部分）**

Create `packages/server/src/storage/workflow-ui-db.ts`:
```ts
// SQLite 连接与执行层（better-sqlite3）。
// 本文件分两阶段落地：Task 2 只含纯函数校验；Task 3 追加连接管理与执行。

export const DB_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
export const MAX_ROWS = 10000;
const BLOCKED_RE = /\b(ATTACH|DETACH)\b/i;

export type SqlParams = unknown[] | Record<string, unknown>;

export function validateDbName(dbName: string): void {
  if (typeof dbName !== 'string' || !DB_NAME_RE.test(dbName)) {
    throw new Error(`Invalid db name: ${dbName}`);
  }
}

export function checkSql(sql: string): void {
  if (typeof sql !== 'string' || BLOCKED_RE.test(sql)) {
    throw new Error('ATTACH/DETACH are not allowed');
  }
}

// 数组 → 按位置展开；对象 → 包成单参（better-sqlite3 命名占位符 :name/@name/$name）；undefined → 空参数
export function bindArgs(params: SqlParams | undefined): unknown[] {
  if (params == null) return [];
  return Array.isArray(params) ? params : [params];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run（仓库根目录）:
```bash
node --import tsx --test packages/server/test/workflow-ui-db.test.ts
```
Expected: PASS（4 个 test 全过）。

- [ ] **Step 5（可选 commit）**

```bash
git add packages/server/src/storage/workflow-ui-db.ts packages/server/test/workflow-ui-db.test.ts
git commit -m "feat(server): add workflow-ui-db pure validators with tests"
```

---

## Task 3: workflow-ui-db.ts 连接管理与执行

**Files:**
- Modify: `packages/server/src/storage/workflow-ui-db.ts`（在 Task 2 内容基础上追加）

- [ ] **Step 1: 追加连接管理与执行实现**

在 `packages/server/src/storage/workflow-ui-db.ts` 顶部 import 区追加，并在文件末尾追加函数：

顶部追加 import:
```ts
import Database from 'better-sqlite3';
import { join, resolve, sep, dirname } from 'node:path';
import { ensureDir, getDataDir } from './json-store.js';
```

文件末尾追加:
```ts
type DbConnection = InstanceType<typeof Database>;
type ExecMode = 'all' | 'get' | 'run' | 'exec';

// 连接池：按 `projectId/dbName` 复用，避免每次请求重开文件。
const POOL = new Map<string, DbConnection>();

// 解析 db 文件绝对路径，越界保护（不依赖 store，避免循环依赖；与 store.baseDir 同源）。
function dbFilePath(projectId: string, dbName: string): string {
  const root = resolve(join(getDataDir(), 'workflows-ui', projectId, 'data', 'db'));
  const target = resolve(root, `${dbName}.sqlite`);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`Path escapes project db directory: ${dbName}`);
  }
  return target;
}

export function openDb(projectId: string, dbName: string): DbConnection {
  validateDbName(dbName);
  const key = `${projectId}/${dbName}`;
  const cached = POOL.get(key);
  if (cached) return cached;
  const fullPath = dbFilePath(projectId, dbName);
  ensureDir(dirname(fullPath));
  const db = new Database(fullPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  POOL.set(key, db);
  return db;
}

export function executeDb(
  projectId: string,
  dbName: string,
  mode: ExecMode,
  sql: string,
  params?: SqlParams,
): unknown {
  checkSql(sql);
  const db = openDb(projectId, dbName);
  if (mode === 'exec') {
    db.exec(sql);
    return undefined;
  }
  const stmt = db.prepare(sql);
  const args = bindArgs(params);
  if (mode === 'all') {
    const rows = stmt.all(...args);
    if (rows.length > MAX_ROWS) throw new Error(`Result exceeds ${MAX_ROWS} rows`);
    return rows;
  }
  if (mode === 'get') {
    return stmt.get(...args) ?? null;
  }
  const r = stmt.run(...args);
  return { changes: r.changes, lastInsertRowid: r.lastInsertRowid as number | bigint };
}

export function executeDbTransaction(
  projectId: string,
  dbName: string,
  statements: { sql: string; params?: SqlParams }[],
): void {
  for (const s of statements) checkSql(s.sql);
  const db = openDb(projectId, dbName);
  const runTx = db.transaction(() => {
    for (const { sql, params } of statements) {
      db.prepare(sql).run(...bindArgs(params));
    }
  });
  runTx(); // 抛错则 better-sqlite3 自动回滚整个事务
}

export function closeProjectDbs(projectId: string): void {
  const prefix = `${projectId}/`;
  for (const [key, db] of POOL) {
    if (key.startsWith(prefix)) {
      try { db.close(); } catch { /* noop */ }
      POOL.delete(key);
    }
  }
}
```

- [ ] **Step 2: 类型检查通过**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/server exec tsc --noEmit
```
Expected: 无错误退出（exit 0）。better-sqlite3 类型由 `@types/better-sqlite3` 提供，`InstanceType<typeof Database>` 为连接实例类型。

- [ ] **Step 3: 回归测试仍通过**

Run（仓库根目录）:
```bash
node --import tsx --test packages/server/test/workflow-ui-db.test.ts
```
Expected: PASS（纯函数测试不受 better-sqlite3 import 影响）。

> 实际执行 SQL 的验证在 Task 5（路由接通后用 curl）与 Task 7（端到端）完成。

- [ ] **Step 4（可选 commit）**

```bash
git add packages/server/src/storage/workflow-ui-db.ts
git commit -m "feat(server): add better-sqlite3 connection pool and exec/transaction for workflow-ui db"
```

---

## Task 4: service 层转发 + deleteProject 清连接 + store export touchProject

**Files:**
- Modify: `packages/server/src/storage/workflow-ui-store.ts`（第 74 行）
- Modify: `packages/server/src/services/workflow-ui.ts`（import 区、deleteProject、新增 db 转发函数）

- [ ] **Step 1: store 导出 touchProject**

Modify `packages/server/src/storage/workflow-ui-store.ts` 第 74 行，把:
```ts
function touchProject(projectId: string): void {
```
改为:
```ts
export function touchProject(projectId: string): void {
```

- [ ] **Step 2: service 增加 db 模块 import**

Modify `packages/server/src/services/workflow-ui.ts`，在第 8 行 `import { unloadServices } from './workflow-ui-services.js';` 之后追加:
```ts
import { executeDb as dbExecuteDb, executeDbTransaction as dbExecuteDbTransaction, closeProjectDbs } from '../storage/workflow-ui-db.js';
```

- [ ] **Step 3: service 增加 db 转发函数**

在 `packages/server/src/services/workflow-ui.ts` 的 `writeDataFile` 函数（约第 161 行）之后追加:
```ts
// ---- DB (SQLite via better-sqlite3) ----
export function executeDb(
  projectId: string,
  dbName: string,
  mode: 'all' | 'get' | 'run' | 'exec',
  sql: string,
  params?: unknown[] | Record<string, unknown>,
): unknown {
  const result = dbExecuteDb(projectId, dbName, mode, sql, params);
  store.touchProject(projectId);
  return result;
}

export function executeDbTransaction(
  projectId: string,
  dbName: string,
  statements: { sql: string; params?: unknown[] | Record<string, unknown> }[],
): void {
  dbExecuteDbTransaction(projectId, dbName, statements);
  store.touchProject(projectId);
}
```

- [ ] **Step 4: service.deleteProject 清理 db 连接**

Modify `packages/server/src/services/workflow-ui.ts` 第 108-111 行，把:
```ts
export function deleteProject(projectId: string): void {
  store.deleteProject(projectId);
  unloadServices(projectId);
}
```
改为（先关连接，再删目录，最后卸载 services）:
```ts
export function deleteProject(projectId: string): void {
  closeProjectDbs(projectId);
  store.deleteProject(projectId);
  unloadServices(projectId);
}
```

- [ ] **Step 5: 类型检查通过**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/server exec tsc --noEmit
```
Expected: 无错误退出。

- [ ] **Step 6（可选 commit）**

```bash
git add packages/server/src/storage/workflow-ui-store.ts packages/server/src/services/workflow-ui.ts
git commit -m "feat(server): wire workflow-ui db through service and clean connections on delete"
```

---

## Task 5: 路由层 2 个 db REST 端点

**Files:**
- Modify: `packages/server/src/routes/workflow-ui.ts`（在 `PUT /:id/data/content` 路由之后、`POST /:id/avatar` 之前插入）

- [ ] **Step 1: 增加单语句执行端点**

在 `packages/server/src/routes/workflow-ui.ts` 第 168 行（`PUT /:id/data/content` 路由结束的 `});`）之后、第 170 行 `// Avatar upload` 注释之前插入:
```ts
// DB (SQLite): execute a single statement. Body: { sql, params?, mode: 'all'|'get'|'run'|'exec' }
router.post('/:id/db/:dbName', (req: Request<{ id: string; dbName: string }>, res: Response) => {
  try {
    const { dbName } = req.params;
    const { sql, params, mode } = req.body ?? {};
    if (!sql || typeof sql !== 'string') { res.status(400).json({ error: 'sql is required' }); return; }
    if (!mode || !['all', 'get', 'run', 'exec'].includes(mode)) { res.status(400).json({ error: "mode must be one of all|get|run|exec" }); return; }
    const result = svc.executeDb(req.params.id, dbName, mode, sql, params);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: { code: error?.code ?? 'SQLITE_ERROR', message: error?.message ?? String(error) } });
  }
});

// DB transaction: batch statements atomically. Body: { statements: [{ sql, params? }] }
router.post('/:id/db/:dbName/transaction', (req: Request<{ id: string; dbName: string }>, res: Response) => {
  try {
    const { dbName } = req.params;
    const { statements } = req.body ?? {};
    if (!Array.isArray(statements) || statements.length === 0) { res.status(400).json({ error: 'statements must be a non-empty array' }); return; }
    svc.executeDbTransaction(req.params.id, dbName, statements);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: { code: error?.code ?? 'SQLITE_ERROR', message: error?.message ?? String(error) } });
  }
});
```

- [ ] **Step 2: 类型检查通过**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/server exec tsc --noEmit
```
Expected: 无错误退出。

- [ ] **Step 3: 启动 server 并用 curl 验证端到端 SQL**

启动 server（终端 A）:
```bash
pnpm --filter @agent-spaces/server dev
```
Expected: 监听 3100 端口。

> 以下 curl 需带鉴权。若已有访问 token，替换 `<TOKEN>`；若本地开发已放开某测试项目，用实际 workflow-ui 项目 id 替换 `<PID>`。无现成 token 时，可跳过 curl，直接由 Task 7 前端预览验证。

建表（终端 B）:
```bash
curl -s -X POST "http://localhost:3100/api/workflows-ui/<PID>/db/demo" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"sql":"CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT)","mode":"exec"}'
```
Expected: `{"ok":true,"result":null}`（result 为 undefined 经 JSON 序列化为 null）。

插入 + 查询:
```bash
curl -s -X POST "http://localhost:3100/api/workflows-ui/<PID>/db/demo" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"sql":"INSERT INTO users(name) VALUES(?)","params":["Tom"],"mode":"run"}'
curl -s -X POST "http://localhost:3100/api/workflows-ui/<PID>/db/demo" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM users","mode":"all"}'
```
Expected: run 返回 `{"ok":true,"result":{"changes":1,"lastInsertRowid":1}}`；all 返回 `{"ok":true,"result":[{"id":1,"name":"Tom"}]}`。

- [ ] **Step 4（可选 commit）**

```bash
git add packages/server/src/routes/workflow-ui.ts
git commit -m "feat(server): add workflow-ui db REST endpoints (exec + transaction)"
```

---

## Task 6: 前端 host API 增加 db 工厂

**Files:**
- Modify: `packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts`（在 `downloadFile` 后新增 db 工厂；在挂载块为 `AgentSpaces` 与 `AgentSpacesAPI` 增加 `db`）

- [ ] **Step 1: 新增 db 工厂函数**

在 `packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts` 第 322 行（`downloadFile` 函数结束的 `};`）之后、第 324 行 `const uploadFile` 之前插入:
```ts
    // ---- SQLite db (per-project named databases under data/db/) ----
    const DB_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
    const createDbHandle = (dbName: string) => {
      if (!DB_NAME_RE.test(dbName)) {
        throw new Error(`Invalid db name: ${dbName}`);
      }
      const base = `/api/workflows-ui/${projectId}/db/${encodeURIComponent(dbName)}`;
      const post = async <T,>(url: string, body: unknown): Promise<T> => {
        const resp = await fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await resp.json();
        if (!resp.ok || payload?.ok === false) {
          throw new Error(payload?.error?.message || `db request failed: ${resp.status} ${resp.statusText}`);
        }
        return payload as T;
      };
      return {
        all: (sql: string, params?: unknown[] | Record<string, unknown>) =>
          post<{ result: unknown[] }>(base, { sql, params, mode: 'all' }).then((p) => p.result),
        get: (sql: string, params?: unknown[] | Record<string, unknown>) =>
          post<{ result: unknown }>(base, { sql, params, mode: 'get' }).then((p) => p.result),
        run: (sql: string, params?: unknown[] | Record<string, unknown>) =>
          post<{ result: { changes: number; lastInsertRowid: number | bigint } }>(base, { sql, params, mode: 'run' }).then((p) => p.result),
        exec: (sql: string) =>
          post<{ result: unknown }>(base, { sql, mode: 'exec' }).then(() => undefined),
        transaction: (statements: { sql: string; params?: unknown[] | Record<string, unknown> }[]) =>
          post(`${base}/transaction`, { statements }).then(() => undefined),
      };
    };
    const dbApi = (name: string) => createDbHandle(name);
```

- [ ] **Step 2: 挂载 db 到 AgentSpaces（不挂 AgentSpacesUI）**

Modify `packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts` 第 497-509 行的 `(window as any).AgentSpaces = { ... }` 对象，在 `...pluginApi,` 行之后、`...fileApi,` 之前增加一行:
```ts
      db: dbApi,
```
（即让 `AgentSpaces` 展开项包含 `db`。）

- [ ] **Step 3: 挂载 db 到 AgentSpacesAPI**

同样地，修改第 510-522 行的 `(window as any).AgentSpacesAPI = { ... }` 对象，在 `...pluginApi,` 之后、`...fileApi,` 之前增加一行:
```ts
      db: dbApi,
```

> `hostUi`（`window.AgentSpacesUI`，第 454-464 行）**不**加 `db`——UI 对象只承载组件与既有文件助手，db 属数据能力。

- [ ] **Step 4: 类型检查 / lint 通过**

Run（仓库根目录）:
```bash
pnpm --filter @agent-spaces/web exec tsc --noEmit
```
Expected: 无错误退出。

- [ ] **Step 5（可选 commit）**

```bash
git add packages/web/src/components/workflows-ui/use-workflow-ui-host-api.ts
git commit -m "feat(web): expose AgentSpaces.db(name) SQLite handle in workflow-ui host api"
```

---

## Task 7: 端到端手动验证

**Files:** 无代码改动，仅运行验证（遵循用户全局规则：完成后返回测试步骤，由用户执行）。

- [ ] **Step 1: 安装依赖并启动**

Run（仓库根目录）:
```bash
pnpm install
pnpm dev
```
Expected: server(3100) + web(3000) 并行启动，无报错。

- [ ] **Step 2: 打开一个 workflow-ui 项目预览**

在 web 端打开任意 workflow-ui 项目，进入预览。在预览代码（React/HTML）中粘贴并运行:
```js
const demo = window.AgentSpaces.db('demo');
await demo.exec(`CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts INTEGER, msg TEXT)`);
await demo.run(`INSERT INTO events(ts, msg) VALUES(?, ?)`, [Date.now(), 'hello']);
console.log(await demo.get(`SELECT COUNT(*) AS n FROM events`));
console.log(await demo.all(`SELECT * FROM events ORDER BY ts DESC LIMIT 10`));
await demo.transaction([
  { sql: `INSERT INTO events(ts, msg) VALUES(?, ?)`, params: [Date.now(), 'a'] },
  { sql: `UPDATE events SET msg = ? WHERE msg = ?`, params: ['renamed', 'hello'] },
]);
console.log(await demo.all(`SELECT * FROM events`));
```
Expected: 控制台依次打印计数、列表；事务后 `msg='hello'` 的行被改为 `'renamed'`，无错误抛出。

- [ ] **Step 3: 验证事务回滚**

预览代码运行:
```js
const t = window.AgentSpaces.db('txtest');
await t.exec(`CREATE TABLE IF NOT EXISTS k(v INTEGER)`);
await t.run(`INSERT INTO k(v) VALUES(?)`, [1]);
try {
  await t.transaction([
    { sql: `INSERT INTO k(v) VALUES(?)`, params: [2] },
    { sql: `THIS IS BROKEN SQL ON PURPOSE`, params: [] },
  ]);
} catch (e) { console.log('rolled back:', e.message); }
console.log('rows after failed tx:', await t.all(`SELECT * FROM k`));
```
Expected: 打印 `rolled back: ...`；`rows after failed tx` 仅含 `[{v:1}]`——第二条失败语句导致整体回滚，`v:2` 未落库。

- [ ] **Step 4: 验证非法库名被拒**

预览代码运行:
```js
try { window.AgentSpaces.db('..'); } catch (e) { console.log('rejected:', e.message); }
try { window.AgentSpaces.db('a/b'); } catch (e) { console.log('rejected:', e.message); }
```
Expected: 两次均打印 `rejected: Invalid db name: ...`（前端直接拦截，未发请求）。

- [ ] **Step 5: 验证 db 文件落盘**

查看文件系统:
```
~/.agent-spaces-data/workflows-ui/<PID>/data/db/demo.sqlite
~/.agent-spaces-data/workflows-ui/<PID>/data/db/txtest.sqlite
```
Expected: 两个 `.sqlite` 文件存在；用任意 SQLite 客户端打开 `demo.sqlite` 能看到 `events` 表与数据。

- [ ] **Step 6: 验证项目删除清理**

在 web 端删除该 workflow-ui 项目。
Expected: `data/db/` 目录随项目目录被递归删除；无 better-sqlite3 文件句柄泄漏（Windows 下无“文件被占用”报错）。

---

## Self-Review（计划对照 spec 的检查）

**1. Spec 覆盖：**
- §3 决策表（SQLite / SQL 直接执行 / 多具名库 / 语句数组事务）→ Task 3 + Task 6 全覆盖 ✓
- §5 数据目录 `data/db/<name>.sqlite` → Task 3 `dbFilePath` ✓
- §6 前端 API（db 挂 AgentSpaces/AgentSpacesAPI，不挂 UI）→ Task 6 ✓
- §7.1 路由 2 端点 → Task 5 ✓
- §7.2 连接管理 + bindArgs + ATTACH 拦截 + MAX_ROWS + WAL/busy_timeout → Task 3 ✓
- §7.3 service 转发 + touchProject → Task 4 ✓
- §7.4 删除清理 → Task 4 `deleteProject` 调 `closeProjectDbs`（细化：放 service 层避免循环依赖，已在 File Structure 注明）✓
- §8 安全约束表 → Task 2（校验/拦截）+ Task 3（行数/WAL/越界）+ Task 6（前端校验）✓
- §9 错误处理 `{ok:false,error:{code,message}}` → Task 5 catch 块 ✓
- §11 影响范围 → 全部任务覆盖；SDK 暴露为可选，spec 已标非必须，本计划不纳入（YAGNI）✓

**2. 占位符扫描：** 无 TBD/TODO；curl 步骤的 `<PID>`/`<TOKEN>` 为运行时占位（已在步骤中说明替换方式），非计划占位符 ✓

**3. 类型一致性：** `executeDb(projectId, dbName, mode, sql, params?)` 签名在 Task 3（定义）、Task 4（service 转发）、Task 5（route 调用）、Task 6（前端 mode 字段）一致；`SqlParams = unknown[] | Record<string, unknown>` 前后端一致；mode 联合 `'all'|'get'|'run'|'exec'` 一致 ✓
