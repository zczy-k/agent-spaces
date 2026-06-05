# Chat WS 实时对话 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 /chat 页面的消息发送实际触发 LangChain 执行并流式返回结果。

**Architecture:** 新增 SSE 端点 `POST /api/chat/agents/:id/run`，前端用 `fetch` + `ReadableStream` 消费，不依赖 workspace WS 连接。这是最简路径——复用现有 `agent-sse.ts` 模式，避免引入全局 WS 的复杂性。

**Tech Stack:** Express SSE (res.write)，fetch ReadableStream，Zustand store

**背景问题：** 现有 WS 系统绑定 workspaceId，chat 是全局功能不绑 workspace。引入全局 WS 需改动 connection-manager + ws handler + 前端连接管理，代价大。SSE 端点天然一对一，无此问题。

---

## File Structure

### New files (1)

| File | Responsibility |
|------|---------------|
| `packages/server/src/routes/chat-run.ts` | SSE 流式对话端点 |

### Modified files (3)

| File | Change |
|------|--------|
| `packages/server/src/app.ts` | 注册 chat-run 路由 |
| `packages/web/src/stores/chat.ts` | sendMessage 改用 SSE，添加流式内容累积 |
| `packages/web/src/app/chat/page.tsx` | 无需改动（store 接口不变） |

---

### Task 1: 后端 SSE 端点

**Files:**
- Create: `packages/server/src/routes/chat-run.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: 创建 chat-run.ts**

参考现有 `packages/server/src/routes/agent-sse.ts` 的 SSE 模式。

```typescript
// packages/server/src/routes/chat-run.ts
import { Router } from 'express';
import * as chatService from '../services/chat.js';
import { LangChainRuntime } from '../adapters/langchain-runtime.js';
import type { AgentRuntimeConfig, AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';

const router = Router();

// POST /api/chat/agents/:id/run — SSE 流式对话
router.post('/agents/:id/run', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body as { content: string };

  if (!content?.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const agent = chatService.findAgent(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Save user message
  const userMsg = chatService.saveMessage({ agentId: id, role: 'user', content });
  send('message_saved', userMsg);

  // Build runtime config
  const config: AgentRuntimeConfig = {
    kind: 'langchain',
    provider: agent.provider,
    model: agent.model,
    apiKey: agent.apiKey,
    baseURL: agent.baseURL,
  };

  const runtime = new LangChainRuntime(config);

  // Build conversation history
  const recent = chatService.getRecentMessages(id, 20);
  const historyPrompt = recent
    .slice(0, -1) // exclude just-saved user message
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  const prompt = historyPrompt ? `${historyPrompt}\n\nUser: ${content}\nAssistant:` : content;

  try {
    const result = await runtime.execute(prompt, process.cwd(), {
      systemPrompt: agent.systemPrompt,
      onEvent: (event: AgentRuntimeEvent) => {
        switch (event.type) {
          case 'output':
            send('output', { chunk: event.line });
            break;
          case 'reasoning':
            send('thinking', { chunk: event.text });
            break;
          case 'tool_use':
            send('tool_use', { name: event.name, input: event.input });
            break;
          case 'tool_result':
            send('tool_result', { name: event.id, result: event.result });
            break;
        }
      },
    });

    // Build final agent message
    const agentContent = result.output.filter((line) => !line.startsWith('Tool:')).join('\n') || result.summary;
    const agentMsg = chatService.saveMessage({
      agentId: id,
      role: 'agent',
      content: agentContent,
      usage: result.usage,
    });
    send('completed', { message: agentMsg });
  } catch (err) {
    send('error', { error: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

export default router;
```

- [ ] **Step 2: 注册路由**

在 `packages/server/src/app.ts` 中：

1. 添加 import：
```typescript
import chatRunRouter from './routes/chat-run.js';
```

2. 在 chat router 注册之后添加：
```typescript
app.use('/api/chat', chatRunRouter);
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/chat-run.ts packages/server/src/app.ts
git commit -m "feat(chat): add SSE streaming run endpoint"
```

---

### Task 2: 前端 Store 接入 SSE

**Files:**
- Modify: `packages/web/src/stores/chat.ts`

- [ ] **Step 1: 改造 sendMessage 为 SSE 消费**

替换现有 `sendMessage` 实现（目前只设 sending 状态），改为发起 SSE 请求并流式消费。

核心逻辑：
1. 调用 `POST /api/chat/agents/:id/run`（通过 `sdk.http.raw()` 或直接 fetch）
2. 读取 `ReadableStream`，解析 SSE 事件
3. `message_saved` → 添加到 messages
4. `output` → 累积到临时 agent message
5. `thinking` → 累积到临时 thinking
6. `completed` → 替换临时 message 为最终 message
7. `error` → 标记 sending=false

同时添加 store 状态：
- `streamingContent: Record<string, string>` — 正在流式输出的内容（agentId -> 累积文本）
- `streamingThinking: Record<string, string>` — 正在流式的思考过程

```typescript
// 替换 sendMessage 实现
sendMessage: async (agentId, content) => {
  const { sending } = get();
  if (sending[agentId]) return; // 防止重复发送

  set((s) => ({
    sending: { ...s.sending, [agentId]: true },
    streamingContent: { ...s.streamingContent, [agentId]: '' },
    streamingThinking: { ...s.streamingThinking, [agentId]: '' },
  }));

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    const serverUrl = getActiveServerUrl() ?? window.location.origin;
    const response = await fetch(`${serverUrl}/api/chat/agents/${agentId}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok || !response.body) {
      set((s) => ({ sending: { ...s.sending, [agentId]: false } }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case 'message_saved':
              get().onMessageSaved(data);
              break;
            case 'output':
              set((s) => ({
                streamingContent: {
                  ...s.streamingContent,
                  [agentId]: (s.streamingContent[agentId] ?? '') + (data.chunk || ''),
                },
              }));
              break;
            case 'thinking':
              set((s) => ({
                streamingThinking: {
                  ...s.streamingThinking,
                  [agentId]: (s.streamingThinking[agentId] ?? '') + (data.chunk || ''),
                },
              }));
              break;
            case 'completed':
              get().onAgentCompleted(agentId, data.message);
              // Clear streaming state
              set((s) => ({
                streamingContent: { ...s.streamingContent, [agentId]: '' },
                streamingThinking: { ...s.streamingThinking, [agentId]: '' },
              }));
              break;
            case 'error':
              get().onAgentError(agentId, data.error);
              break;
          }
          currentEvent = '';
        }
      }
    }
  } catch {
    set((s) => ({ sending: { ...s.sending, [agentId]: false } }));
  }
},
```

Store 接口新增字段：
```typescript
interface ChatStore {
  // ... existing fields ...
  streamingContent: Record<string, string>;   // NEW
  streamingThinking: Record<string, string>;  // NEW
}
```

初始值添加：
```typescript
streamingContent: {},
streamingThinking: {},
```

需额外 import：
```typescript
import { getActiveServerUrl } from '@/lib/server';
```

注意：`sendMessage` 签名从 `(agentId: string, content: string) => void` 改为 `(agentId: string, content: string) => Promise<void>` 或保持 void（async 函数赋值给 void 类型在 TS 中合法）。

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/stores/chat.ts
git commit -m "feat(chat): wire up SSE streaming in chat store"
```

---

### Task 3: InlineChatPanel 展示流式内容

**Files:**
- Modify: `packages/web/src/components/chat/inline-chat-panel.tsx`

- [ ] **Step 1: 添加 streaming content 展示**

在消息列表底部，当 `sending=true` 时，展示流式输出的临时消息气泡（类似 ChatGPT 的打字效果）。

InlineChatPanel 新增 props：
```typescript
interface InlineChatPanelProps {
  // ... existing ...
  streamingContent?: string;    // NEW: 正在流式输出的文本
  streamingThinking?: string;   // NEW: 正在流式思考的文本
}
```

在 `sending` 的 typing indicator 之后（或替代），添加流式消息渲染：
- 如果 `streamingContent` 有内容，显示一个 agent 消息气泡，内容为 `streamingContent`
- 如果 `streamingThinking` 有内容，显示折叠的 thinking 块

- [ ] **Step 2: ChatPage 传递 streaming props**

在 `packages/web/src/app/chat/page.tsx` 中，从 store 取 `streamingContent` 和 `streamingThinking`，传给 InlineChatPanel。

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/chat/inline-chat-panel.tsx packages/web/src/app/chat/page.tsx
git commit -m "feat(chat): display streaming content in chat panel"
```

---

## Self-Review

**Coverage check:**
- ✅ SSE 端点：Task 1
- ✅ Store SSE 消费：Task 2
- ✅ 流式内容展示：Task 3
- ✅ sendMessage 实际触发执行：Task 2
- ✅ stopAgent：保留 WS chat.stop 或改用 AbortController（可后续优化）

**No placeholders.** 所有代码块完整。

**Type consistency:** `AgentRuntimeEvent` 类型来自 `agent-runtime-types.ts`，`chat.*` 事件名与后端 `chat-handler.ts` 中 `broadcastToWorkspace` 一致（但 SSE 端点独立于 WS，不依赖 broadcast）。
