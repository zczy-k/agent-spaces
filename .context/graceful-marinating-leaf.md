# Agent 全局化改造计划

## Context

当前 agents 按 workspace 隔离：前端 `useAgentStore` 按 `workspaceId` 缓存，后端 API 都是 `/api/workspaces/:id/agents/presets`。实际上 `createPreset`/`updatePreset` 已经同时写全局模板 (`~/.agent-spaces-data/agent-templates/`) 和 workspace 副本。用户希望 agents 是全局共享的，workspace 里的只是全局 agent 的引用（复制来的），不需要编辑。

## 改动范围

### 1. 后端：新增全局 agents API

**文件**: `packages/server/src/services/agent.ts`

新增/修改函数（去除 workspaceId 依赖）：
- `listGlobalPresets()` → 直接用现有 `listTemplates()`
- `createGlobalPreset(data)` → 基于现有 `createPreset`，去掉 workspace 相关逻辑（不写 `ws.agents`，不调 `writeWorkspaceAgentCopy`）
- `updateGlobalPreset(presetId, data)` → 基于现有 `updatePreset`，直接从全局模板读取/更新
- `deleteGlobalPreset(presetId)` → 删除全局模板 + 从所有 workspace 的 `agents` 数组中移除引用
- `testGlobalConnection(data)` → 去掉 workspaceId 参数，直接测试连接

**文件**: `packages/server/src/routes/agent.ts`

在 `/api/agents` 路由下新增：
- `GET /api/agents/presets` → `listTemplates()`
- `POST /api/agents/presets` → `createGlobalPreset()`
- `PUT /api/agents/presets/:presetId` → `updateGlobalPreset()`
- `DELETE /api/agents/presets/:presetId` → `deleteGlobalPreset()`
- `POST /api/agents/presets/test-connection` → `testGlobalConnection()`

保留旧的 workspace 级路由不删除（向后兼容），但前端不再调用。

### 2. 前端：Agent Store 改为全局

**文件**: `packages/web/src/stores/agent.ts`

- 去掉 `loadedWorkspaceId`、`loadingWorkspaceId`
- `ensure()` 改为无参数，加载一次（加 `loaded` 标志防重复）
- API 改为 `/api/agents/presets`

### 3. 前端：Agent Dialog 去掉 workspaceId 依赖

**文件**: `packages/web/src/components/sidebar/agent-dialog.tsx`

- 去掉 `workspaceId` prop
- 所有 API 调用改为 `/api/agents/presets`、`/api/agents/presets/:id`、`/api/agents/presets/test-connection`

### 4. 前端：调用点清理

去掉 `ensureAgents(workspaceId)` 中的 `workspaceId` 参数：
- `packages/web/src/components/chat/chat-panel.tsx`
- `packages/web/src/components/chat/channel-list.tsx`
- `packages/web/src/components/issue/issue-list.tsx`
- `packages/web/src/components/issue/issue-detail.tsx`

去掉 AgentDialog 的 `workspaceId` prop：
- `packages/web/src/components/sidebar/app-sidebar.tsx`

### 5. 前端：其他 API 路径更新

| 文件 | 当前路径 | 改为 |
|------|---------|------|
| `workspace-dialog.tsx:77` | `/api/workspaces/${workspace.id}/agent-templates` | `/api/agents/presets`（列出全局 agents，排除已在 workspace 的） |
| `workspace-dialog.tsx:110` | `/api/workspaces/${workspace.id}/agents/from-templates` | 保留（仍是 workspace 操作：将全局 agent 引用添加到 workspace） |
| `workflow-editor.tsx:49` | `/api/workspaces/${ws.id}/agents/presets` | `/api/agents/presets` |
| `workflows-page.tsx:105,152` | `/api/workspaces/${targetWs.id}/agents/presets` | `/api/agents/presets` |

### 6. 后端：`/api/agents/presets` 路由在 agent.ts 中的冲突处理

`/api/agents` 和 `/api/workspaces/:id/agents` 都挂载了同一个 `agentRouter`。当请求 `/api/agents/presets` 时，`req.params.id` 是 undefined。需要在新路由中处理这种情况。

方案：在 `agent.ts` 路由文件中，对 `presets` 相关路由判断 `req.params.id`：
- 有 `id` → 走 workspace 逻辑（旧逻辑不变）
- 无 `id` → 走全局逻辑

或者更简单：直接在 `GET /presets` 开头判断，无 id 时返回全局列表。

## 验证

1. `pnpm dev` 启动，打开设置中的 Agent Dialog
2. 创建、编辑、删除 agent，验证全局生效
3. 切换 workspace，验证 agent 列表一致
4. 聊天面板 @mention 验证 agent 列表正确
5. Issue 详情验证 agent 显示正确
