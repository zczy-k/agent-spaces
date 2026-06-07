# Chat Multi-Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Chat 独立页面从扁平 agent 列表改造为多 workspace + 多 session 架构，每个 workspace 引用全局 agents，内部以 flat session 列表展示。

**Architecture:** 后端新增 ChatWorkspace 和 ChatSession 存储层，agent 保持全局。Workspace 通过 agentIds 引用 agent，session 通过 agentId 关联 agent。API 按资源层级组织：workspace -> session -> message/run。前端 store 新增 workspace/session 状态，左侧面板改为 session 列表 + workspace switcher。

**Tech Stack:** Express 5 (backend), Zustand (frontend state), next-intl (i18n), workspaces.tsx (UI switcher)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/server/src/storage/chat-store.ts` | 新增 ChatWorkspace/ChatSession 类型和存储函数 |
| Modify | `packages/server/src/services/chat.ts` | 新增 workspace/session 服务方法 |
| Modify | `packages/server/src/routes/chat.ts` | 新增 workspace/session REST 端点 |
| Modify | `packages/server/src/routes/chat-run.ts` | 改为按 session 执行 |
| Modify | `packages/sdk/src/modules/chat.ts` | 新增 workspace/session API 方法和类型 |
| Modify | `packages/sdk/src/index.ts` | 导出新类型 |
| Modify | `packages/web/src/stores/chat.ts` | 新增 workspace/session 状态和方法 |
| Modify | `packages/web/src/components/chat/chat-agent-list.tsx` | 改为 session 列表 + workspace switcher |
| Modify | `packages/web/src/app/chat/page.tsx` | 适配 workspace/session 驱动 |

---

### Task 1: Backend Data Layer — Workspace & Session Storage

**Files:**
- Modify: `packages/server/src/storage/chat-store.ts`

- [ ] **Step 1: Add ChatWorkspace and ChatSession types and storage functions**

在 `chat-store.ts` 的 `ChatMessage` 接口之后，添加新类型和存储函数：

```typescript
export interface ChatWorkspace {
  id: string;
  name: string;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  agentId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
```

在文件底部（`readSkillContent` 之后），添加存储函数：

```typescript
// --- Workspace functions ---

function workspacesFile(): string {
  return path.join(chatDir(), 'workspaces.json');
}

function workspaceDir(wsId: string): string {
  return path.join(chatDir(), 'workspaces', wsId);
}

function sessionsFile(wsId: string): string {
  return path.join(workspaceDir(wsId), 'sessions.json');
}

function sessionDir(wsId: string, sessionId: string): string {
  return path.join(workspaceDir(wsId), 'sessions', sessionId);
}

function sessionMessagesFile(wsId: string, sessionId: string): string {
  return path.join(sessionDir(wsId, sessionId), 'messages.json');
}

export function listWorkspaces(): ChatWorkspace[] {
  ensureDir(chatDir());
  return readJsonFile<ChatWorkspace[]>(workspacesFile()) ?? [];
}

function saveWorkspaces(workspaces: ChatWorkspace[]): void {
  writeJsonFile(workspacesFile(), workspaces);
}

export function findWorkspace(id: string): ChatWorkspace | undefined {
  return listWorkspaces().find(ws => ws.id === id);
}

export function createWorkspace(data: { name: string; agentIds?: string[] }): ChatWorkspace {
  const workspaces = listWorkspaces();
  const ws: ChatWorkspace = {
    id: randomUUID(),
    name: data.name,
    agentIds: data.agentIds ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  workspaces.push(ws);
  saveWorkspaces(workspaces);
  ensureDir(workspaceDir(ws.id));
  return ws;
}

export function updateWorkspace(id: string, data: { name?: string; agentIds?: string[] }): ChatWorkspace | null {
  const workspaces = listWorkspaces();
  const idx = workspaces.findIndex(ws => ws.id === id);
  if (idx === -1) return null;
  workspaces[idx] = {
    ...workspaces[idx],
    ...(data.name !== undefined && { name: data.name }),
    ...(data.agentIds !== undefined && { agentIds: data.agentIds }),
    updatedAt: new Date().toISOString(),
  };
  saveWorkspaces(workspaces);
  return workspaces[idx];
}

export function deleteWorkspace(id: string): boolean {
  const workspaces = listWorkspaces();
  const idx = workspaces.findIndex(ws => ws.id === id);
  if (idx === -1) return false;
  workspaces.splice(idx, 1);
  saveWorkspaces(workspaces);
  rmSync(workspaceDir(id), { recursive: true, force: true });
  return true;
}

// --- Session functions ---

export function listSessions(workspaceId: string): ChatSession[] {
  const sessions = readJsonFile<ChatSession[]>(sessionsFile(workspaceId)) ?? [];
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findSession(workspaceId: string, sessionId: string): ChatSession | undefined {
  return listSessions(workspaceId).find(s => s.id === sessionId);
}

export function createSession(workspaceId: string, agentId: string): ChatSession | null {
  if (!findWorkspace(workspaceId)) return null;
  if (!findAgent(agentId)) return null;
  const sessions = readJsonFile<ChatSession[]>(sessionsFile(workspaceId)) ?? [];
  const session: ChatSession = {
    id: randomUUID(),
    workspaceId,
    agentId,
    title: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.push(session);
  writeJsonFile(sessionsFile(workspaceId), sessions);
  ensureDir(sessionDir(workspaceId, session.id));
  return session;
}

export function updateSession(workspaceId: string, sessionId: string, data: { title?: string }): ChatSession | null {
  const sessions = readJsonFile<ChatSession[]>(sessionsFile(workspaceId)) ?? [];
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return null;
  sessions[idx] = {
    ...sessions[idx],
    ...(data.title !== undefined && { title: data.title }),
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(sessionsFile(workspaceId), sessions);
  return sessions[idx];
}

export function deleteSession(workspaceId: string, sessionId: string): boolean {
  const sessions = readJsonFile<ChatSession[]>(sessionsFile(workspaceId)) ?? [];
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return false;
  sessions.splice(idx, 1);
  writeJsonFile(sessionsFile(workspaceId), sessions);
  rmSync(sessionDir(workspaceId, sessionId), { recursive: true, force: true });
  return true;
}

// --- Session Message functions ---

export function listSessionMessages(workspaceId: string, sessionId: string): ChatMessage[] {
  const messages = readJsonFile<ChatMessage[]>(sessionMessagesFile(workspaceId, sessionId)) ?? [];
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return messages;
}

export function saveSessionMessage(workspaceId: string, sessionId: string, msg: ChatMessage): void {
  const messages = readJsonFile<ChatMessage[]>(sessionMessagesFile(workspaceId, sessionId)) ?? [];
  messages.push(msg);
  writeJsonFile(sessionMessagesFile(workspaceId, sessionId), messages);
}

export function clearSessionMessages(workspaceId: string, sessionId: string): void {
  deleteFile(sessionMessagesFile(workspaceId, sessionId));
}

export function getRecentSessionMessages(workspaceId: string, sessionId: string, limit: number = 50): ChatMessage[] {
  const messages = listSessionMessages(workspaceId, sessionId);
  return messages.slice(-limit);
}

// --- Migration ---

export function migrateToWorkspaces(): void {
  ensureDir(chatDir());
  const existing = readJsonFile<ChatWorkspace[]>(workspacesFile());
  if (existing && existing.length > 0) return; // already migrated

  const agents = listAgents();
  const ws: ChatWorkspace = {
    id: randomUUID(),
    name: 'Default',
    agentIds: agents.map(a => a.id),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveWorkspaces([ws]);
  ensureDir(workspaceDir(ws.id));

  // Migrate existing messages to a default session per agent
  for (const agent of agents) {
    const oldMessages = readJsonFile<ChatMessage[]>(messagesFile(agent.id)) ?? [];
    if (oldMessages.length === 0) continue;

    const session: ChatSession = {
      id: randomUUID(),
      workspaceId: ws.id,
      agentId: agent.id,
      title: undefined,
      createdAt: oldMessages[0].timestamp,
      updatedAt: oldMessages[oldMessages.length - 1].timestamp,
    };

    const sessions = readJsonFile<ChatSession[]>(sessionsFile(ws.id)) ?? [];
    sessions.push(session);
    writeJsonFile(sessionsFile(ws.id), sessions);
    ensureDir(sessionDir(ws.id, session.id));
    writeJsonFile(sessionMessagesFile(ws.id, session.id), oldMessages);
  }
}
```

在文件顶部 import 中添加 `randomUUID`：

```typescript
import { randomUUID } from 'node:crypto';
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/storage/chat-store.ts
git commit -m "feat(server): add ChatWorkspace/ChatSession types and storage functions"
```

---

### Task 2: Backend Service Layer — Workspace & Session Methods

**Files:**
- Modify: `packages/server/src/services/chat.ts`

- [ ] **Step 1: Add workspace and session service functions**

在 `services/chat.ts` 中，在 `normalizeAgentData` 函数之前添加 workspace/session 方法，并在文件底部导出 `migrateToWorkspaces`：

```typescript
import type { ChatWorkspace, ChatSession } from '../storage/chat-store.js';

// --- Workspace CRUD ---

export function listWorkspaces(): ChatWorkspace[] {
  return store.listWorkspaces();
}

export function createWorkspace(data: { name: string; agentIds?: string[] }): ChatWorkspace {
  return store.createWorkspace(data);
}

export function updateWorkspace(id: string, data: { name?: string; agentIds?: string[] }): ChatWorkspace | null {
  return store.updateWorkspace(id, data);
}

export function deleteWorkspace(id: string): boolean {
  return store.deleteWorkspace(id);
}

// --- Session CRUD ---

export function listSessions(workspaceId: string): ChatSession[] {
  return store.listSessions(workspaceId);
}

export function createSession(workspaceId: string, agentId: string): ChatSession | null {
  return store.createSession(workspaceId, agentId);
}

export function updateSession(workspaceId: string, sessionId: string, data: { title?: string }): ChatSession | null {
  return store.updateSession(workspaceId, sessionId, data);
}

export function deleteSession(workspaceId: string, sessionId: string): boolean {
  return store.deleteSession(workspaceId, sessionId);
}

// --- Session Messages ---

export function listSessionMessages(workspaceId: string, sessionId: string): ChatMessage[] {
  return store.listSessionMessages(workspaceId, sessionId);
}

export function saveSessionMessage(workspaceId: string, sessionId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const message: ChatMessage = {
    ...msg,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  store.saveSessionMessage(workspaceId, sessionId, message);
  return message;
}

export function clearSessionMessages(workspaceId: string, sessionId: string): void {
  store.clearSessionMessages(workspaceId, sessionId);
}

export function getRecentSessionMessages(workspaceId: string, sessionId: string, limit?: number): ChatMessage[] {
  return store.getRecentSessionMessages(workspaceId, sessionId, limit);
}

// --- Migration ---

export { migrateToWorkspaces } from '../storage/chat-store.js';
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/chat.ts
git commit -m "feat(server): add workspace/session service layer methods"
```

---

### Task 3: Backend Routes — Workspace & Session Endpoints

**Files:**
- Modify: `packages/server/src/routes/chat.ts`

- [ ] **Step 1: Add workspace and session REST endpoints**

在 `routes/chat.ts` 的 `stringValue` 函数之前，添加 workspace 和 session 路由：

```typescript
// --- Workspace CRUD ---

router.get('/workspaces', (_req, res) => {
  try {
    res.json(svc.listWorkspaces());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspaces', (req, res) => {
  const { name, agentIds } = req.body as { name?: string; agentIds?: string[] };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const ws = svc.createWorkspace({ name: name.trim(), agentIds });
    res.status(201).json(ws);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/workspaces/:wsId', (req, res) => {
  const { wsId } = req.params;
  const { name, agentIds } = req.body as { name?: string; agentIds?: string[] };
  try {
    const ws = svc.updateWorkspace(wsId, { name: name?.trim(), agentIds });
    if (!ws) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.json(ws);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/workspaces/:wsId', (req, res) => {
  const { wsId } = req.params;
  try {
    const deleted = svc.deleteWorkspace(wsId);
    if (!deleted) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Session CRUD ---

router.get('/workspaces/:wsId/sessions', (req, res) => {
  const { wsId } = req.params;
  try {
    res.json(svc.listSessions(wsId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspaces/:wsId/sessions', (req, res) => {
  const { wsId } = req.params;
  const { agentId } = req.body as { agentId?: string };
  if (!agentId) {
    res.status(400).json({ error: 'agentId is required' });
    return;
  }
  try {
    const session = svc.createSession(wsId, agentId);
    if (!session) {
      res.status(404).json({ error: 'Workspace or agent not found' });
      return;
    }
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/workspaces/:wsId/sessions/:sessionId', (req, res) => {
  const { wsId, sessionId } = req.params;
  const { title } = req.body as { title?: string };
  try {
    const session = svc.updateSession(wsId, sessionId, { title });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/workspaces/:wsId/sessions/:sessionId', (req, res) => {
  const { wsId, sessionId } = req.params;
  try {
    const deleted = svc.deleteSession(wsId, sessionId);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Session Messages ---

router.get('/sessions/:sessionId/messages', (req, res) => {
  const { sessionId } = req.params;
  const wsId = req.query.workspaceId as string;
  if (!wsId) {
    res.status(400).json({ error: 'workspaceId query param is required' });
    return;
  }
  try {
    res.json(svc.listSessionMessages(wsId, sessionId));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:sessionId/messages', (req, res) => {
  const { sessionId } = req.params;
  const wsId = req.query.workspaceId as string;
  if (!wsId) {
    res.status(400).json({ error: 'workspaceId query param is required' });
    return;
  }
  try {
    svc.clearSessionMessages(wsId, sessionId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/routes/chat.ts
git commit -m "feat(server): add workspace/session REST API endpoints"
```

---

### Task 4: Backend Run Endpoint — Session-Based Execution

**Files:**
- Modify: `packages/server/src/routes/chat-run.ts`

- [ ] **Step 1: Add session-based run route**

在 `chat-run.ts` 中，在现有 `router.post('/agents/:id/run', ...)` 之前添加新的 session run 端点：

```typescript
router.post('/sessions/:sessionId/run', async (req, res) => {
  const { sessionId } = req.params;
  const { content, regenerateFromMessageId, workspaceId } = req.body as {
    content?: string;
    regenerateFromMessageId?: string;
    workspaceId?: string;
  };

  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }

  const session = chatService.findSession(workspaceId, sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const agentId = session.agentId;
  const regenerateContext = regenerateFromMessageId
    ? resolveSessionRegenerateContext(workspaceId, sessionId, regenerateFromMessageId)
    : null;
  const trimmedContent = (regenerateContext?.content ?? content)?.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const baseURL = resolveChatAgentBaseURL(agent);

  prepareSse(res);

  if (!baseURL && requiresBaseURL(agent.provider)) {
    writeSse(res, 'error', {
      error: `${agent.provider} requires an API Base URL. Edit this chat agent and save the provider API address again.`,
    });
    res.end();
    return;
  }

  if (!regenerateContext) {
    const userMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
      role: 'user',
      content: trimmedContent,
    });
    writeSse(res, 'message_saved', userMsg);
  }

  const config: AgentRuntimeConfig = {
    kind: 'langchain',
    provider: agent.provider,
    model: agent.model,
    apiKey: agent.apiKey,
    baseURL,
  };

  const runtime = new LangChainRuntime(config);
  let completed = false;

  res.on('close', () => {
    if (!completed && !res.writableEnded) runtime.stop();
  });

  try {
    const historyMessages = regenerateContext?.historyMessages
      ?? chatService.getRecentSessionMessages(workspaceId, sessionId, 20).slice(0, -1);
    const historyPrompt = historyMessages
      .filter(shouldIncludeHistoryMessage)
      .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
      .join('\n\n');
    const prompt = historyPrompt
      ? `${historyPrompt}\n\nUser: ${trimmedContent}\nAssistant:`
      : trimmedContent;

    const workingDir = chatService.getAgentWorkingDir(agentId) || process.cwd();
    const configDir = chatService.getAgentConfigDir(agentId) || undefined;
    const tools = normalizeToolNames(agent.tools);
    const functionTools = [
      ...createCommandFunctionTools(agentId, tools),
      ...createDatabaseFunctionTools(agentId, tools),
      ...createKanbanFunctionTools(agentId, tools),
      ...createWorkflowExecutionFunctionTools(tools),
    ];
    const result = await runtime.execute(prompt, workingDir, {
      maxTurns: 100,
      functionTools,
      mcpServers: agentService.getMcpServers(agent.mcps as Parameters<typeof agentService.getMcpServers>[0]),
      skills: normalizeSkillNames(agent.skills),
      configDir,
      systemPrompt: agent.systemPrompt,
      outputStyle: agent.outputStyle,
      onEvent: (event: AgentRuntimeEvent) => {
        writeRuntimeEvent(res, event);
      },
    });

    if (!result.success) {
      completed = true;
      writeSse(res, 'error', { error: result.error ?? result.summary });
      return;
    }

    const agentContent = result.output
      .filter((line) => !line.startsWith('Tool:') && !line.startsWith('[Usage]'))
      .join('\n')
      || result.summary;
    const agentMsg = chatService.saveSessionMessage(workspaceId, sessionId, {
      agentId,
      role: 'agent',
      content: agentContent,
      usage: result.usage,
    });

    completed = true;
    writeSse(res, 'completed', { message: agentMsg, success: result.success, error: result.error });
  } catch (err) {
    completed = true;
    writeSse(res, 'error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});
```

同时在文件底部（`normalizeToolNames` 之后）添加 session 版本的 regenerate 上下文解析：

```typescript
function resolveSessionRegenerateContext(
  workspaceId: string,
  sessionId: string,
  messageId: string,
): { content: string; historyMessages: Array<{ role: 'user' | 'agent'; content: string }> } | null {
  const messages = chatService.listSessionMessages(workspaceId, sessionId);
  const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'agent');
  if (targetIndex === -1) return null;

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      return {
        content: message.content,
        historyMessages: messages.slice(0, index),
      };
    }
  }

  return null;
}
```

需要在顶部 import 中添加 `findSession` 相关导入。在现有 `import * as chatService` 之后确认已包含所有新方法（`findSession`, `saveSessionMessage`, `listSessionMessages`, `getRecentSessionMessages`）。

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/routes/chat-run.ts
git commit -m "feat(server): add session-based chat run endpoint"
```

---

### Task 5: Backend Migration — Auto-Create Default Workspace

**Files:**
- Modify: `packages/server/src/routes/chat.ts`

- [ ] **Step 1: Add migration middleware**

在 `routes/chat.ts` 顶部路由定义之前，添加自动迁移逻辑：

```typescript
let migrated = false;

function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  try {
    svc.migrateToWorkspaces();
  } catch { /* ignore migration errors */ }
}

// 在 router.get('/agents', ...) 的 handler 开头添加 ensureMigrated() 调用
// 在 router.get('/workspaces', ...) 的 handler 开头添加 ensureMigrated() 调用
```

具体：在 `router.get('/agents', ...)` 和 `router.get('/workspaces', ...)` 的 handler 函数体第一行加 `ensureMigrated();`。

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/routes/chat.ts
git commit -m "feat(server): auto-migrate to workspace model on first request"
```

---

### Task 6: SDK — Workspace & Session API Methods

**Files:**
- Modify: `packages/sdk/src/modules/chat.ts`
- Modify: `packages/sdk/src/index.ts`

- [ ] **Step 1: Add types and API methods**

在 `packages/sdk/src/modules/chat.ts` 中，在 `ChatMessage` 接口之后添加：

```typescript
export interface ChatWorkspace {
  id: string;
  name: string;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  workspaceId: string;
  agentId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
```

在 `createChatApi` return 对象中，在 `workspaceTree` 之后添加：

```typescript
// Workspace CRUD
listWorkspaces: (): Promise<ChatWorkspace[]> =>
  http.get('/api/chat/workspaces'),

createWorkspace: (data: { name: string; agentIds?: string[] }): Promise<ChatWorkspace> =>
  http.post('/api/chat/workspaces', data),

updateWorkspace: (id: string, data: { name?: string; agentIds?: string[] }): Promise<ChatWorkspace> =>
  http.put(`/api/chat/workspaces/${id}`, data),

deleteWorkspace: (id: string): Promise<void> =>
  http.delete(`/api/chat/workspaces/${id}`),

// Session CRUD
listSessions: (workspaceId: string): Promise<ChatSession[]> =>
  http.get(`/api/chat/workspaces/${workspaceId}/sessions`),

createSession: (workspaceId: string, agentId: string): Promise<ChatSession> =>
  http.post(`/api/chat/workspaces/${workspaceId}/sessions`, { agentId }),

renameSession: (workspaceId: string, sessionId: string, title: string): Promise<ChatSession> =>
  http.put(`/api/chat/workspaces/${workspaceId}/sessions/${sessionId}`, { title }),

deleteSession: (workspaceId: string, sessionId: string): Promise<void> =>
  http.delete(`/api/chat/workspaces/${workspaceId}/sessions/${sessionId}`),

// Session Messages
listSessionMessages: (workspaceId: string, sessionId: string): Promise<ChatMessage[]> =>
  http.get(`/api/chat/sessions/${sessionId}/messages?workspaceId=${workspaceId}`),

clearSessionMessages: (workspaceId: string, sessionId: string): Promise<void> =>
  http.delete(`/api/chat/sessions/${sessionId}/messages?workspaceId=${workspaceId}`),

// Session Run (note: SSE runs use sdk.http.raw() directly from the store)
// No SDK method needed for run — the store calls sdk.http.raw() directly with AbortController
```

注意：`runSession` 返回 `Promise<Response>`，与 `http.raw()` 行为一致。

- [ ] **Step 2: Update SDK index.ts exports**

在 `packages/sdk/src/index.ts` 中：

找到 `export type { ChatAgent, ChatMessage } from './modules/chat';`，改为：
```typescript
export type { ChatAgent, ChatMessage, ChatWorkspace, ChatSession } from './modules/chat';
```

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/modules/chat.ts packages/sdk/src/index.ts
git commit -m "feat(sdk): add ChatWorkspace/ChatSession types and API methods"
```

---

### Task 7: Frontend Store — Workspace & Session State

**Files:**
- Modify: `packages/web/src/stores/chat.ts`

- [ ] **Step 1: Extend store with workspace and session state**

在 `stores/chat.ts` 中：

1. 在 import 中添加新类型：
```typescript
import type { ChatAgent, ChatMessage, ChatWorkspace, ChatSession } from '@agent-spaces/sdk';
```

2. 扩展 `ChatStore` interface，在 `streamingThinking` 之后添加：
```typescript
workspaces: ChatWorkspace[];
activeWorkspaceId: string | null;
sessions: ChatSession[];
activeSessionId: string | null;

loadWorkspaces: () => Promise<void>;
createWorkspace: (name: string, agentIds?: string[]) => Promise<void>;
updateWorkspace: (id: string, data: { name?: string; agentIds?: string[] }) => Promise<void>;
deleteWorkspace: (id: string) => Promise<void>;
selectWorkspace: (id: string) => void;

loadSessions: (workspaceId: string) => Promise<void>;
createSession: (agentId: string) => Promise<string | null>;
deleteSession: (sessionId: string) => Promise<void>;
selectSession: (id: string) => void;

loadSessionMessages: (workspaceId: string, sessionId: string) => Promise<void>;
sendSessionMessage: (content: string) => void;
regenerateSessionMessage: (messageId: string) => void;
stopSession: () => void;
clearSessionMessages: () => void;
```

3. 在 `create<ChatStore>((set, get) => ({` 的初始状态中添加：
```typescript
workspaces: [],
activeWorkspaceId: null,
sessions: [],
activeSessionId: null,
```

4. 在 `clearMessages` 方法之后添加 workspace/session 实现：

```typescript
loadWorkspaces: async () => {
  try {
    const workspaces = await sdk.chat.listWorkspaces();
    set({ workspaces });
    // Auto-select first if none selected
    if (workspaces.length > 0 && !get().activeWorkspaceId) {
      get().selectWorkspace(workspaces[0].id);
    }
  } catch { /* ignore */ }
},

createWorkspace: async (name, agentIds) => {
  const ws = await sdk.chat.createWorkspace({ name, agentIds });
  set((s) => ({ workspaces: [...s.workspaces, ws] }));
},

updateWorkspace: async (id, data) => {
  const updated = await sdk.chat.updateWorkspace(id, data);
  set((s) => ({
    workspaces: s.workspaces.map(ws => ws.id === id ? updated : ws),
  }));
},

deleteWorkspace: async (id) => {
  await sdk.chat.deleteWorkspace(id);
  set((s) => {
    const workspaces = s.workspaces.filter(ws => ws.id !== id);
    const activeWorkspaceId = s.activeWorkspaceId === id
      ? (workspaces[0]?.id ?? null)
      : s.activeWorkspaceId;
    return { workspaces, activeWorkspaceId, sessions: [], activeSessionId: null };
  });
},

selectWorkspace: (id) => {
  set({ activeWorkspaceId: id, sessions: [], activeSessionId: null });
  get().loadSessions(id);
},

loadSessions: async (workspaceId) => {
  try {
    const sessions = await sdk.chat.listSessions(workspaceId);
    set({ sessions });
  } catch { /* ignore */ }
},

createSession: async (agentId) => {
  const wsId = get().activeWorkspaceId;
  if (!wsId) return null;
  const session = await sdk.chat.createSession(wsId, agentId);
  if (!session) return null;
  set((s) => ({
    sessions: [session, ...s.sessions],
    activeSessionId: session.id,
  }));
  return session.id;
},

deleteSession: async (sessionId) => {
  const wsId = get().activeWorkspaceId;
  if (!wsId) return;
  await sdk.chat.deleteSession(wsId, sessionId);
  set((s) => {
    const sessions = s.sessions.filter(ses => ses.id !== sessionId);
    const activeSessionId = s.activeSessionId === sessionId
      ? (sessions[0]?.id ?? null)
      : s.activeSessionId;
    return { sessions, activeSessionId };
  });
},

selectSession: (id) => {
  set({ activeSessionId: id });
  const wsId = get().activeWorkspaceId;
  if (wsId) get().loadSessionMessages(wsId, id);
},

loadSessionMessages: async (workspaceId, sessionId) => {
  try {
    const msgs = await sdk.chat.listSessionMessages(workspaceId, sessionId);
    set((s) => ({ messages: { ...s.messages, [sessionId]: msgs } }));
  } catch { /* ignore */ }
},

sendSessionMessage: async (content) => {
  const { activeWorkspaceId: wsId, activeSessionId: sessionId, sessions } = get();
  if (!wsId || !sessionId) return;

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  if (get().sending[sessionId]) return;

  await runSessionChat(wsId, sessionId, session.agentId, { content }, get, set);
},

regenerateSessionMessage: async (messageId) => {
  const { activeWorkspaceId: wsId, activeSessionId: sessionId, sessions } = get();
  if (!wsId || !sessionId) return;

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  if (get().sending[sessionId]) return;

  await runSessionChat(wsId, sessionId, session.agentId, { regenerateFromMessageId: messageId }, get, set);
},

stopSession: () => {
  const { activeSessionId: sessionId } = get();
  if (!sessionId) return;
  activeChatRequests.get(sessionId)?.abort();
  activeChatRequests.delete(sessionId);
  set((s) => ({
    sending: { ...s.sending, [sessionId]: false },
    streamingContent: { ...s.streamingContent, [sessionId]: '' },
    streamingThinking: { ...s.streamingThinking, [sessionId]: '' },
  }));
},

clearSessionMessages: async () => {
  const { activeWorkspaceId: wsId, activeSessionId: sessionId } = get();
  if (!wsId || !sessionId) return;
  await sdk.chat.clearSessionMessages(wsId, sessionId);
  set((s) => ({
    messages: { ...s.messages, [sessionId]: [] },
  }));
},
```

5. 在文件底部（`appendStreamingText` 之后）添加新的 session 版 run 函数：

```typescript
async function runSessionChat(
  workspaceId: string,
  sessionId: string,
  agentId: string,
  body: { content?: string; regenerateFromMessageId?: string },
  get: () => ChatStore,
  set: ChatSet,
): Promise<void> {
  const controller = new AbortController();
  activeChatRequests.set(sessionId, controller);
  set((s) => ({
    sending: { ...s.sending, [sessionId]: true },
    errors: { ...s.errors, [sessionId]: '' },
    streamingContent: { ...s.streamingContent, [sessionId]: '' },
    streamingThinking: { ...s.streamingThinking, [sessionId]: '' },
  }));

  try {
    const rawResponse = await sdk.http.raw(`/api/chat/sessions/${sessionId}/run`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, workspaceId }),
    });

    if (!rawResponse.ok || !rawResponse.body) {
      get().onAgentError(sessionId, await rawResponse.text().catch(() => rawResponse.statusText));
      return;
      return;
    }

    await readChatRunStream(sessionId, rawResponse.body, get, set);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      get().onAgentError(sessionId, err instanceof Error ? err.message : String(err));
    }
  } finally {
    if (activeChatRequests.get(sessionId) === controller) {
      activeChatRequests.delete(sessionId);
    }
    set((s) => ({
      sending: { ...s.sending, [sessionId]: false },
    }));
  }
}
```

注意：`runSessionChat` 的 SSE 事件中 `agentId` 会被 `sessionId` 替代（因为 `onMessageSaved` / `onAgentCompleted` / `onAgentError` 都是按第一个参数作为 key）。`handleChatRunEvent` 中已有 `agentId` 参数，现在传入 `sessionId`，所有按 key 查找的逻辑自动适配。

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/stores/chat.ts
git commit -m "feat(web): extend chat store with workspace/session state and methods"
```

---

### Task 8: Frontend UI — Session List Panel

**Files:**
- Modify: `packages/web/src/components/chat/chat-agent-list.tsx`

- [ ] **Step 1: Rewrite chat-agent-list.tsx as session list with workspace switcher**

完全重写 `chat-agent-list.tsx`：

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import {
  Workspaces, WorkspaceTrigger, WorkspaceContent,
} from "@/components/ui/workspaces";
import { cn } from "@/lib/utils";
import { AgentIcon } from "@/components/common/agent-icon";
import {
  MessageSquarePlus, Settings2, Search, Trash2, Pencil,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import type { ChatAgent, ChatWorkspace, ChatSession } from "@agent-spaces/sdk";
import { formatDistanceToNow } from "date-fns";

interface ChatSessionListProps {
  workspaces: ChatWorkspace[];
  activeWorkspaceId: string | null;
  agents: ChatAgent[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  sending: Record<string, boolean>;
  onWorkspaceChange: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onManageAgents: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  className?: string;
}

export function ChatAgentList({
  workspaces,
  activeWorkspaceId,
  agents,
  sessions,
  activeSessionId,
  sending,
  onWorkspaceChange,
  onCreateWorkspace,
  onManageAgents,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  className,
}: ChatSessionListProps) {
  const [search, setSearch] = useState("");
  const t = useTranslations("chat.agentList");

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0];

  // Enrich sessions with agent info for display
  const enrichedSessions = useMemo(() => {
    return sessions.map((session) => {
      const agent = agents.find((a) => a.id === session.agentId);
      return { ...session, agent };
    });
  }, [sessions, agents]);

  const filtered = enrichedSessions.filter((s) => {
    if (!search) return true;
    const title = s.title || "New Chat";
    return (
      title.toLowerCase().includes(search.toLowerCase()) ||
      (s.agent?.name ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <aside
      aria-label="Chat Session List"
      className={cn(
        "flex h-full max-w-sm w-full flex-col gap-2 overflow-hidden rounded-xl border bg-background",
        className
      )}
      role="complementary"
    >
      {/* Workspace Switcher Header */}
      <div className="border-b px-3 py-2">
        <Workspaces
          workspaces={workspaces}
          selectedWorkspaceId={activeWorkspaceId ?? undefined}
          onWorkspaceChange={(ws) => onWorkspaceChange(ws.id)}
          getWorkspaceId={(ws) => ws.id}
          getWorkspaceName={(ws) => ws.name}
        >
          <WorkspaceTrigger className="h-9 text-sm" />
          <WorkspaceContent title={t("workspaces")} searchable>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onClick={onCreateWorkspace}
            >
              <MessageSquarePlus className="size-4" />
              {t("newWorkspace")}
            </button>
          </WorkspaceContent>
        </Workspaces>
      </div>

      {/* New Session + Search */}
      <div className="flex flex-col gap-2 px-3">
        <Button
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewSession}
        >
          <MessageSquarePlus className="size-4" />
          {t("newChat")}
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            aria-label="Search sessions"
            autoComplete="off"
            className="h-8 w-full pl-8 text-xs"
            inputMode="search"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            spellCheck={false}
            type="search"
            value={search}
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6">
            <Empty className="border-0 p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquarePlus />
                </EmptyMedia>
                <EmptyTitle>
                  {sessions.length === 0 ? t("noSessions") : t("noMatches")}
                </EmptyTitle>
                <EmptyDescription>
                  {sessions.length === 0 ? t("noSessionsDesc") : t("noMatchesDesc")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          filtered.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              aria-label={`Chat: ${session.title || "New Chat"}`}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                activeSessionId === session.id && "bg-accent"
              )}
              onClick={() => onSelectSession(session.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSession(session.id);
                }
              }}
            >
              <div className="relative flex flex-shrink-0">
                {session.agent && (
                  <AgentIcon
                    agentId={session.agent.id}
                    name={session.agent.name}
                    avatarUrl={session.agent.avatar}
                    icon={session.agent.icon}
                    className="size-8"
                  />
                )}
                {sending[session.id] && (
                  <span className="-bottom-0 absolute right-0 flex items-center">
                    <span
                      aria-label="running"
                      className="inline-block size-2.5 rounded-full border-2 border-background bg-blue-500 animate-pulse"
                    />
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {session.title || "New Chat"}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {session.agent?.name ?? "Unknown"}
                  {" · "}
                  {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                </span>
              </div>
              <Button
                aria-label={`Delete session`}
                className="ml-auto size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                size="icon"
                variant="ghost"
                type="button"
              >
                <Trash2 aria-hidden="true" className="size-3.5 text-muted-foreground" focusable="false" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Bottom: Manage Agents */}
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onManageAgents}
        >
          <Settings2 className="size-4" />
          {t("manageAgents")}
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/chat/chat-agent-list.tsx
git commit -m "feat(web): rewrite chat-agent-list as session list with workspace switcher"
```

---

### Task 9: Frontend Page — Wire Workspace/Session State

**Files:**
- Modify: `packages/web/src/app/chat/page.tsx`

- [ ] **Step 1: Rewrite page.tsx to use workspace/session state**

完全重写 `page.tsx`：

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat";
import { ChatAgentList } from "@/components/chat/chat-agent-list";
import { InlineChatPanel } from "@/components/chat/inline-chat-panel";
import { ChatRightPanel } from "@/components/chat/chat-right-panel";
import { AddChatAgentDialog } from "@/components/chat/add-chat-agent-dialog";
import { ChatAgentPickerDialog } from "@/components/chat/chat-agent-picker-dialog";
import { AddMemberDialog } from "@/components/chat/add-member-dialog";
import { MessageSquare } from "lucide-react";
import type { ChatAgent } from "@agent-spaces/sdk";
import type { AgentPreset } from "@/components/sidebar/agent-shared";

export default function ChatPage() {
  const {
    agents,
    workspaces,
    activeWorkspaceId,
    sessions,
    activeSessionId,
    messages,
    sending,
    errors,
    streamingContent,
    streamingThinking,
    loadAgents,
    loadWorkspaces,
    createAgent,
    deleteAgent,
    updateAgent,
    createWorkspace,
    updateWorkspace,
    selectWorkspace,
    loadSessions,
    createSession,
    deleteSession,
    selectSession,
    sendSessionMessage,
    regenerateSessionMessage,
    stopSession,
    clearSessionMessages,
  } = useChatStore();

  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<ChatAgent | undefined>(undefined);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeAgent = activeSession
    ? agents.find((a) => a.id === activeSession.agentId)
    : undefined;
  const activeMessages = activeSessionId ? (messages[activeSessionId] ?? []) : [];
  const isSending = activeSessionId ? (sending[activeSessionId] ?? false) : false;
  const activeError = activeSessionId ? (errors[activeSessionId] ?? "") : "";
  const activeStreamingContent = activeSessionId ? (streamingContent[activeSessionId] ?? "") : "";
  const activeStreamingThinking = activeSessionId ? (streamingThinking[activeSessionId] ?? "") : "";

  // Load on mount
  useEffect(() => {
    loadAgents();
    loadWorkspaces();
  }, [loadAgents, loadWorkspaces]);

  const handleSend = useCallback(
    (content: string) => {
      if (!activeSessionId || isSending) return;
      sendSessionMessage(content.trim());
    },
    [activeSessionId, isSending, sendSessionMessage]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      if (!activeSessionId || isSending) return;
      regenerateSessionMessage(messageId);
    },
    [activeSessionId, isSending, regenerateSessionMessage]
  );

  const handleNewSession = useCallback(() => {
    setAgentPickerOpen(true);
  }, []);

  const handlePickAgentForSession = useCallback(
    async (agentIds: string[]) => {
      if (!activeWorkspaceId || agentIds.length === 0) return;
      // Create session with the first selected agent
      const sessionId = await createSession(agentIds[0]);
      setAgentPickerOpen(false);
    },
    [activeWorkspaceId, createSession]
  );

  const handleManageAgents = useCallback(() => {
    setMemberDialogOpen(true);
  }, []);

  const handleMemberAdd = useCallback(
    async (agentIds: string[]) => {
      if (!activeWorkspaceId) return;
      await updateWorkspace(activeWorkspaceId, {
        agentIds: [...(activeWorkspace?.agentIds ?? []), ...agentIds],
      });
      setMemberDialogOpen(false);
    },
    [activeWorkspaceId, activeWorkspace, updateWorkspace]
  );

  const handleCreateWorkspace = useCallback(async () => {
    if (!newWorkspaceName.trim()) return;
    await createWorkspace(newWorkspaceName.trim());
    setNewWorkspaceOpen(false);
    setNewWorkspaceName("");
  }, [newWorkspaceName, createWorkspace]);

  const handleAddAgent = useCallback(
    async (preset: AgentPreset) => {
      await createAgent({
        name: preset.name,
        role: "agent",
        runtimeKind: "langchain",
        description: preset.description || undefined,
        systemPrompt: preset.systemPrompt || undefined,
        modelProvider: preset.modelProvider || "openai-chat-completions",
        modelId: preset.modelId || "gpt-4o-mini",
        provider: preset.modelProvider || "openai-chat-completions",
        model: preset.modelId || "gpt-4o-mini",
        apiKey: preset.apiKey || "",
        apiBase: preset.apiBase || undefined,
        baseURL: preset.apiBase || undefined,
        avatarUrl: preset.avatarUrl || undefined,
        avatar: preset.avatarUrl || undefined,
        icon: preset.icon || undefined,
        workingDir: preset.workingDir,
        mcps: preset.mcps,
        skills: preset.skills,
        tools: preset.tools,
        outputStyle: preset.outputStyle || undefined,
        temperature: preset.temperature,
        maxTokens: preset.maxTokens,
        enabled: preset.enabled,
      });
    },
    [createAgent]
  );

  // Workspace's visible agents
  const workspaceAgentIds = new Set(activeWorkspace?.agentIds ?? []);
  const workspaceAgents = agents.filter((a) => workspaceAgentIds.has(a.id));

  // Agents available for new sessions (from current workspace)
  const agentCandidates = workspaceAgents.map((a) => ({
    id: a.id,
    name: a.name,
    avatar: a.avatar || a.avatarUrl,
    role: "agent" as const,
  }));

  return (
    <div className="flex h-full gap-4 bg-muted/30 p-2">
      <ChatAgentList
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        agents={agents}
        sessions={sessions}
        activeSessionId={activeSessionId}
        sending={sending}
        onWorkspaceChange={selectWorkspace}
        onCreateWorkspace={() => setNewWorkspaceOpen(true)}
        onManageAgents={handleManageAgents}
        onNewSession={handleNewSession}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        className="w-[280px] shrink-0 rounded-xl border border-border/40 bg-background shadow-sm"
      />

      <div className="flex-1 rounded-xl border border-border/40 bg-background shadow-sm">
        {activeAgent && activeSession ? (
          <InlineChatPanel
            agentId={activeAgent.id}
            agentName={activeAgent.name}
            agentAvatar={activeAgent.avatar}
            agentIcon={activeAgent.icon}
            agentDescription={activeAgent.description}
            messages={activeMessages}
            sending={isSending}
            error={activeError}
            streamingContent={activeStreamingContent}
            streamingThinking={activeStreamingThinking}
            onSend={handleSend}
            onStop={stopSession}
            onClearMessages={clearSessionMessages}
            onRegenerate={handleRegenerate}
            onEditAgent={(id) => {
              const agent = agents.find((a) => a.id === id);
              if (agent) setEditAgent(agent);
            }}
            onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="size-12" />
            <p className="text-sm">Select a session or start a new chat</p>
          </div>
        )}
      </div>

      {rightPanelOpen && activeAgent && (
        <ChatRightPanel agentId={activeAgent.id} />
      )}

      {/* Agent picker for new session */}
      <AddMemberDialog
        open={agentPickerOpen}
        onOpenChange={setAgentPickerOpen}
        candidates={agentCandidates}
        onAdd={handlePickAgentForSession}
      />

      {/* Manage workspace agents */}
      <AddMemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        candidates={agents.map((a) => ({
          id: a.id,
          name: a.name,
          avatar: a.avatar || a.avatarUrl,
          role: "agent" as const,
        }))}
        defaultSelected={activeWorkspace?.agentIds}
        onAdd={handleMemberAdd}
      />

      {/* Edit Agent Dialog */}
      <AddChatAgentDialog
        open={!!editAgent}
        onOpenChange={(open) => {
          if (!open) setEditAgent(undefined);
        }}
        onSubmit={async (data) => {
          if (editAgent) await updateAgent(editAgent.id, data);
          setEditAgent(undefined);
        }}
        initialData={editAgent}
      />

      {/* Create Agent Dialog */}
      <AddChatAgentDialog
        open={createAgentOpen}
        onOpenChange={setCreateAgentOpen}
        onSubmit={async (data) => {
          await createAgent(data);
          setCreateAgentOpen(false);
        }}
      />

      {/* Create Workspace Dialog (inline) */}
      {newWorkspaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg border bg-background p-4 shadow-lg">
            <h3 className="mb-3 font-semibold text-lg">New Workspace</h3>
            <input
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateWorkspace();
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => setNewWorkspaceOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                onClick={handleCreateWorkspace}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/app/chat/page.tsx
git commit -m "feat(web): wire workspace/session state to chat page"
```

---

### Task 10: i18n — Add New Translation Keys

**Files:**
- Modify: `packages/web/src/locales/zh/chat.json`
- Modify: `packages/web/src/locales/en/chat.json`

- [ ] **Step 1: Add agentList new keys to both locale files**

在 `chat.json` 的 `agentList` 命名空间中添加缺失的 key：

**zh/chat.json** — 在 `agentList` 下添加：
```json
{
  "workspaces": "Chat 工作区",
  "newWorkspace": "新建工作区",
  "newChat": "新对话",
  "noSessions": "暂无对话",
  "noSessionsDesc": "点击上方按钮开始新对话",
  "manageAgents": "管理 Agents"
}
```

**en/chat.json** — 在 `agentList` 下添加：
```json
{
  "workspaces": "Chat Workspaces",
  "newWorkspace": "New Workspace",
  "newChat": "New Chat",
  "noSessions": "No sessions yet",
  "noSessionsDesc": "Click the button above to start a new chat",
  "manageAgents": "Manage Agents"
}
```

需要先读取现有 JSON 文件，找到 `agentList` 对象并添加这些 key。不要覆盖现有 key。

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/locales/zh/chat.json packages/web/src/locales/en/chat.json
git commit -m "feat(web): add i18n keys for chat workspace/session UI"
```

---

### Task 11: Verification

- [ ] **Step 1: Build and verify**

```bash
cd packages/sdk && pnpm build
cd ../server && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run dev server and test manually**

```bash
pnpm dev
```

Test:
1. 打开 `/chat` 页面
2. 验证自动创建 "Default" workspace
3. 验证 workspace switcher 切换
4. 验证新建 session（选 agent -> 创建 session -> 进入对话）
5. 验证发送消息、流式输出、停止
6. 验证 workspace agent 管理对话框
7. 验证底部 "管理 Agents" 按钮

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete chat multi-workspace implementation"
```
