# Phase 4: 后端统一服务与数据迁移（修订版）

## Context

Phase 3 已完成 shared 层统一。现在迁移 workfox 后端到 agent-spaces server。

**用户决策**：直接引入 workfox 的 WS channel 系统，而不是转为纯 REST API。两套 WS 系统需要整合而非并行。

**核心策略**：
- workfox 的 WS channel 系统（WSRouter + request/response 模式）作为 workflow 专用通信协议
- 与 agent-spaces 现有的 WS 事件系统（registerHandler + broadcastToWorkspace）共存
- 存储层迁移为函数式风格，保持 agent-spaces 一致性
- execution-manager 的 agent_run 节点对接 agent-spaces 的 `createAgentRuntime()`

## 架构：双 WS 协议共存

```
agent-spaces WS 连接 (ws://host:3100/ws?workspaceId=X&token=Y)
├── 现有事件协议 (WSEvent: { event, workspaceId, timestamp, data })
│   ├── terminal.create / terminal.input / ...
│   ├── channel.message / channel.stop
│   ├── agent.start / agent.stop
│   └── workflow.created / workflow.updated / workflow.deleted
│
└── workfox channel 协议 (WSRequest: { id, channel, type:'request', data })
    ├── workflow:list / workflow:get / workflow:create / ...
    ├── workflowFolder:list / workflowFolder:create / ...
    ├── workflowVersion:list / workflowVersion:add / ...
    ├── executionLog:list / executionLog:save / ...
    ├── operationHistory:load / operationHistory:save / ...
    ├── workflow:execute / workflow:pause / workflow:resume / workflow:stop
    ├── workflow:debug-node / workflow:get-execution-recovery
    ├── trigger:validate-cron / trigger:check-hook-name
    ├── staging:load / staging:save / staging:clear
    ├── plugin:list / plugin:enable / ...
    ├── dashboard:stats / dashboard:executions / dashboard:workflow-detail
    └── executionPreset:list / executionPreset:save / ...
```

**消息分发**：WS handler 根据 `msg.type` 区分：
- `type === 'request'` → WSRouter dispatch
- 其他 → 现有事件 handler

## 实现计划

### Step 1: 安装新增依赖

```bash
cd packages/server && pnpm add node-cron cron-parser eventemitter2 && pnpm add -D @types/node-cron
```

### Step 2: 创建 workflow 存储路径工具

**新文件**：`storage/workflow-paths.ts`
- 提供 workflow 级目录路径（versions/execution_history/operation_history/staging/plugin_configs）
- 基于 agent-spaces 的 `getDataDir()` 模式

### Step 3: 迁移存储层（6 个新文件）

全部采用函数式风格（与现有 workflow-store.ts 一致），从 workfox class 风格转换：

| 新文件 | 来源 | 改动 |
|--------|------|------|
| `storage/workflow-version-store.ts` | workfox 同名 | class → 函数式，改路径 |
| `storage/execution-log-store.ts` | workfox 同名 | 同上 |
| `storage/operation-history-store.ts` | workfox 同名 | 同上 |
| `storage/staging-store.ts` | workfox 同名 | 同上 |
| `storage/workflow-folder-store.ts` | workfox workflow-store 的 folder 部分 | 提取为独立文件 |
| `storage/workflow-execution-preset-store.ts` | workfox 暂无，按 channel 契约新建 | 新建 |

**扩展现有**：`storage/workflow-store.ts`
- 增加 plugin config schemes（list/read/create/save/delete）
- 增加按 folderId 过滤 list
- 兼容旧 index.json + 新目录结构

### Step 4: 创建 WSRouter 和 WorkflowWSHandler

**新文件**：`ws/workflow-ws-router.ts`
- 从 workfox 的 `ws/router.ts` 迁移 WSRouter 类
- 改为使用 `@agent-spaces/shared` 中的 `WorkflowChannel` 类型

**新文件**：`ws/workflow-ws-handler.ts`
- 融入现有 WS handler 体系
- 在 `handleConnection` 中检测 request 类型消息，分发到 WSRouter
- 处理 response 回传和 interaction response
- 执行事件通过 `broadcastToWorkspace` 转发为现有 WSEvent 格式

### Step 5: 迁移 execution-manager

**新文件**：`services/workflow/execution-manager.ts`

从 workfox 1968 行迁移，关键改动：
1. **import 路径** → `@agent-spaces/shared`
2. **去掉 Electron 依赖**：
   - `executeAgentRun` → 调用 agent-spaces 的 `createAgentRuntime()` + execute
   - `executeMainProcessNode` → 暂时 throw "不支持的节点类型"
   - `plugin-registry` → stub（返回空列表）
   - `client-node-cache` → stub（返回 false）
3. **emit 事件** → 改为 `broadcastToWorkspace()` + WSEvent 格式
4. **interaction-manager** → 创建简化版
5. **存储** → 改用新的函数式存储 API

**新文件**：`services/workflow/interaction-manager.ts`
- 简化版，基于 WS broadcast
- 不依赖 workfox ConnectionManager

### Step 6: 迁移 trigger-service

**新文件**：`services/workflow/trigger-service.ts`
- 去掉 workfox BackendConfig，改用 agent-spaces PORT/HOST
- 去掉 class，改为函数式 + 状态闭包
- 依赖新的 execution-manager 和 workflow-store

### Step 7: 迁移 hook-handler

**新文件**：`services/workflow/hook-handler.ts`
- 改为 Express 路由处理器
- 认证改用 agent-spaces Bearer Token

### Step 8: 注册 WS channel handlers

**新文件**：`ws/workflow-channels.ts`（对标 workfox 的 storage-channels.ts）
- 注册所有 workflow CRUD + folder + version + log + history + staging + plugin channels

**新文件**：`ws/execution-channels.ts`（对标 workfox 同名）
- 注册 execute/pause/resume/stop/debug/recovery channels

**新文件**：`ws/trigger-channels.ts`（对标 workfox 同名）
- 注册 validate-cron / check-hook-name channels

**新文件**：`ws/dashboard-channels.ts`（对标 workfox 同名）
- 注册 stats / executions / workflow-detail channels

### Step 9: 注册 HTTP 路由

**新文件**：`routes/workflow-execution.ts`
- REST API 端点用于不需要 WS 的操作（hook SSE、执行恢复等）

**修改**：`routes/workflow.ts`
- 增加 folderId 查询参数支持
- 增加 plugin scheme 端点

**修改**：`app.ts`
- 初始化 trigger-service
- 注册 WSRouter 到 WS handler
- 注册新 HTTP 路由

### Step 10: 更新 shared events.ts

**修改**：`types/events.ts`
- ServerEventMap 新增 workflow 执行事件

## 文件清单

### 新建文件（~15 个）
```
server/src/storage/workflow-paths.ts
server/src/storage/workflow-version-store.ts
server/src/storage/execution-log-store.ts
server/src/storage/operation-history-store.ts
server/src/storage/staging-store.ts
server/src/storage/workflow-folder-store.ts
server/src/services/workflow/execution-manager.ts
server/src/services/workflow/interaction-manager.ts
server/src/services/workflow/trigger-service.ts
server/src/services/workflow/hook-handler.ts
server/src/ws/workflow-ws-router.ts
server/src/ws/workflow-ws-handler.ts
server/src/ws/workflow-channels.ts
server/src/ws/execution-channels.ts
server/src/ws/trigger-channels.ts
```

### 修改文件（~5 个）
```
server/src/storage/workflow-store.ts（扩展 plugin schemes + folderId）
server/src/ws/handler.ts（集成 workflow WS handler）
server/src/routes/workflow.ts（扩展路由）
server/src/app.ts（初始化 + 注册）
shared/src/types/events.ts（新增执行事件）
```

## 验证计划

1. `pnpm --filter @agent-spaces/shared build` 通过
2. `pnpm --filter @agent-spaces/server build` 通过
3. 启动 dev server
4. 现有 WS 事件（terminal/channel/agent）不受影响
5. WS request 消息可分发到 WSRouter
6. `GET /api/workflows` 旧 API 仍可读取
7. Workflow 执行引擎可通过 WS channel 触发
8. 执行事件通过 WS 广播
9. Trigger service 注册 cron jobs
10. Hook SSE 端点可用
