# Chat Multi-Workspace Design

## Overview

将 Chat 独立页面（/chat）从扁平的 agent 列表改造为多 workspace + 多 session 架构。每个 workspace 通过引用选择展示哪些全局 agents，workspace 内以 flat session 列表展示所有对话（类似 ChatGPT），每个 session 关联一个 agent。

## Data Model

### ChatWorkspace（新增）

```typescript
interface ChatWorkspace {
  id: string;
  name: string;
  agentIds: string[];  // 引用全局 agents
  createdAt: string;
  updatedAt: string;
}
```

### ChatSession（新增）

```typescript
interface ChatSession {
  id: string;
  workspaceId: string;
  agentId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
```

### ChatAgent（不变）

全局 agent，不属于特定 workspace。workspace 通过 `agentIds` 引用。

### ChatMessage（改）

新增 `sessionId` 字段，message 按 session 隔离。

```typescript
interface ChatMessage {
  // ...existing fields
  sessionId: string;  // 新增
}
```

## Backend Storage

```
~/.agent-spaces-data/chat/
  workspaces.json                        // ChatWorkspace[]
  agents/{agentId}/agent.json            // 全局 agent 配置（不变）
  workspaces/{workspaceId}/
    sessions.json                        // ChatSession[]
    sessions/{sessionId}/messages.json   // ChatMessage[]
```

## API Endpoints

### Workspace CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/workspaces` | 列出所有 workspace |
| POST | `/api/chat/workspaces` | 创建 workspace `{ name, agentIds }` |
| PUT | `/api/chat/workspaces/:id` | 更新 workspace `{ name?, agentIds? }` |
| DELETE | `/api/chat/workspaces/:id` | 删除 workspace 及其所有 sessions |

### Session

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/workspaces/:wsId/sessions` | 列出 workspace 下的 sessions |
| POST | `/api/chat/workspaces/:wsId/sessions` | 创建 session `{ agentId }` |
| DELETE | `/api/chat/workspaces/:wsId/sessions/:id` | 删除 session 及其 messages |
| PATCH | `/api/chat/workspaces/:wsId/sessions/:id` | 更新 session `{ title? }` |

### Messages（改为按 session）

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/sessions/:sessionId/messages` | 列出 session 的 messages |
| DELETE | `/api/chat/sessions/:sessionId/messages` | 清除 session 的 messages |

### Run（改为按 session）

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/sessions/:sessionId/run` | SSE 流式执行 `{ content, regenerateFromMessageId? }` |

## SDK Changes

`packages/sdk/modules/chat.ts` 新增方法：

- `listWorkspaces()`, `createWorkspace(data)`, `updateWorkspace(id, data)`, `deleteWorkspace(id)`
- `listSessions(workspaceId)`, `createSession(workspaceId, agentId)`, `deleteSession(workspaceId, sessionId)`, `renameSession(workspaceId, sessionId, title)`
- `runSession(sessionId, body)`, `listSessionMessages(sessionId)`, `clearSessionMessages(sessionId)`

## Frontend Changes

### chat-agent-list.tsx → Session 列表面板

- **Header**: 使用 `Workspaces` 组件（from `workspaces.tsx`）作为 workspace switcher
- **+ 按钮**: 打开 `add-member-dialog.tsx`，传入当前 workspace 的 agents 作为候选，选 agent 后创建新 session
- **列表区域**: Flat session 列表，每项显示 agent avatar + session title + 时间戳，按 updatedAt 倒序
- **底部**: "管理 Agents" 入口按钮，打开 agent 管理对话框（创建/编辑/删除 agent）

### stores/chat.ts 扩展

新增状态：
- `workspaces: ChatWorkspace[]`, `activeWorkspaceId: string | null`
- `sessions: ChatSession[]`, `activeSessionId: string | null`

新增方法：
- `loadWorkspaces()`, `createWorkspace()`, `selectWorkspace()`
- `loadSessions()`, `createSession()`, `selectSession()`

修改：
- `sendMessage` / `regenerateMessage` / `stopAgent` 改为按 sessionId 操作
- `loadMessages` 改为按 sessionId 加载

### page.tsx 适配

- workspace/session 状态驱动渲染
- `InlineChatPanel` 接收当前 session 对应的 agent 信息 + messages
- workspace 切换时重新加载 sessions
- session 切换时重新加载 messages

## Backward Compatibility

- 首次使用时自动创建 "Default" workspace，将现有所有 agents 加入
- 现有 `chat/agents/` 和 `chat/messages.json` 数据迁移到新结构
- 迁移在 chat-store 的 `init()` 中自动执行
