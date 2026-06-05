# Chat Page Design

> 独立的聊天页面，使用 LangChain runtime 的聊天智能体系统。

## 概述

新增 `/chat` 路由，提供独立的聊天智能体管理界面。左侧为智能体列表（含添加按钮），右侧为内嵌全高聊天面板。聊天智能体固定使用 LangChain runtime（tool call），数据独立存储，不与现有 Agent Preset 体系耦合。

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 聊天布局 | 内嵌全高面板 | 全页面体验，去掉 FloatingChatPanel 的 fixed 定位 |
| 智能体数据源 | 独立创建 | 完全解耦 Agent Preset，简化配置 |
| 模型配置 | 每个智能体独立配置 | 灵活支持多模型/多供应商 |
| 消息传输 | WebSocket | 复用现有 WS 通道，实时流式推送 |
| 认证 | 需要登录 | 与其他页面一致，Bearer Token |

## 1. 数据模型 & 存储

### ChatAgent

```typescript
interface ChatAgent {
  id: string;           // uuid
  name: string;
  avatar?: string;      // URL 或 base64
  description?: string;
  systemPrompt?: string;
  provider: string;     // 'openai-chat-completions' | 'anthropic-messages' | 'gemini-generate-content'
  model: string;        // e.g. 'gpt-4o-mini', 'claude-sonnet-4-6'
  apiKey: string;
  baseURL?: string;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

固定 `runtimeKind = 'langchain'`，不允许修改。tool call 由 LangChain `createAgent` 内置支持。

### ChatMessage

```typescript
interface ChatMessage {
  id: string;           // uuid
  agentId: string;      // 关联的 ChatAgent
  role: 'user' | 'agent';
  content: string;
  timestamp: string;    // ISO 8601
  thinking?: string;    // <think/> 块内容
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}
```

### 文件存储

```
~/.agent-spaces-data/chat/
  agents.json              // ChatAgent[]
  message_history/
    {messageId}.json       // 单条 ChatMessage
```

每条消息一个文件，方便流式追加和按会话清理。前端按 `agentId` 过滤显示。

## 2. 后端 API & WebSocket

### REST API

新增 `routes/chat.ts`，挂载 `/api/chat/`。所有路由需 Bearer Token 认证。

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/chat/agents` | GET | 列出所有聊天智能体 |
| `/api/chat/agents` | POST | 创建聊天智能体 |
| `/api/chat/agents/:id` | PUT | 更新智能体配置 |
| `/api/chat/agents/:id` | DELETE | 删除智能体（及其消息历史） |
| `/api/chat/agents/:id/messages` | GET | 获取消息历史（`?limit=50&before=<msgId>` 游标分页） |
| `/api/chat/agents/:id/messages` | DELETE | 清空消息历史 |

### WebSocket 事件

新增 `ws/chat-handler.ts`，注册到现有 WS handler。

**客户端 -> 服务端**：

| 事件 | Payload | 说明 |
|------|---------|------|
| `chat.message` | `{ agentId, content }` | 发送消息，触发 LangChain 执行 |
| `chat.stop` | `{ agentId }` | 停止当前执行 |

**服务端 -> 客户端**：

| 事件 | Payload | 说明 |
|------|---------|------|
| `chat.message.saved` | `ChatMessage` | 用户消息已保存 |
| `chat.agent.output` | `{ agentId, chunk }` | 流式文本块 |
| `chat.agent.thinking` | `{ agentId, chunk }` | 思考过程块 |
| `chat.agent.tool_use` | `{ agentId, name, input }` | 工具调用 |
| `chat.agent.tool_result` | `{ agentId, name, result }` | 工具结果 |
| `chat.agent.completed` | `{ agentId, message: ChatMessage }` | 执行完成，返回完整消息 |
| `chat.agent.error` | `{ agentId, error }` | 执行失败 |

### LangChain 执行流程

`chat-handler.ts` 收到 `chat.message` 后：

1. 从 `chat-store` 加载 ChatAgent 配置
2. 加载该 agent 的最近 N 条消息作为对话历史
3. 构造 `AgentRuntimeConfig`（固定 `kind='langchain'`），注入 agent 的 provider/model/apiKey/baseURL
4. 调用 `LangChainRuntime.execute()`，`onEvent` 回调映射为 WS 事件推送
5. 完成后将完整消息保存到 `message_history/`

## 3. 前端页面 & 组件

### 页面布局

`app/chat/page.tsx`，使用 `AppShell` 包裹（顶部栏 + 侧边栏复用）：

```
┌──────────────────────────────────────────────────┐
│  AppShell (顶部栏 + 侧边栏复用)                    │
├──────────────┬───────────────────────────────────┤
│              │                                   │
│  ChatAgent   │     InlineChatPanel               │
│  List        │     (内嵌全高聊天面板)               │
│  (280px)     │     (flex-1)                       │
│              │                                   │
│  ─────────── │  ┌─────────────────────────────┐  │
│  [+ 添加智能体]│  │ Agent Avatar + Name + Status│  │
│              │  ├─────────────────────────────┤  │
│  Agent 1     │  │                             │  │
│  Agent 2     │  │  Messages (scroll)          │  │
│  Agent 3     │  │                             │  │
│  ...         │  │                             │  │
│              │  ├─────────────────────────────┤  │
│              │  │ Input + Send Button         │  │
│              │  └─────────────────────────────┘  │
└──────────────┴───────────────────────────────────┘
```

### 组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| **ChatPage** | `app/chat/page.tsx` | 页面入口，Auth 检查 + 数据加载 |
| **ChatAgentList** | `components/chat/chat-agent-list.tsx` | 左侧智能体列表，从 `messaging-people-list.tsx` 重构为通用组件 |
| **AddChatAgentDialog** | `components/chat/add-chat-agent-dialog.tsx` | 创建/编辑聊天智能体对话框（name/avatar/description/systemPrompt/provider/model/apiKey/baseURL） |
| **InlineChatPanel** | `components/chat/inline-chat-panel.tsx` | 右侧内嵌聊天面板，复用 `FloatingChatPanel` 的消息渲染 UI，去掉 fixed 定位和浮动球逻辑 |
| **ChatMessageBubble** | `components/chat/chat-message-bubble.tsx` | 从 FloatingChatPanel 提取的消息气泡组件，供 InlineChatPanel 复用 |

### messaging-people-list.tsx 重构

改为通用 `ChatAgentList` 组件：
- 去掉 hardcoded `DEMO_GROUPS` / `DEMO_PEOPLE`
- Props：`agents: ChatAgent[]`、`activeId: string`、`onSelect: (id: string) => void`、`onAdd: () => void`
- 保留搜索过滤和列表 UI 样式
- "+" 按钮触发 `onAdd` 回调

### 前端 Store

`stores/chat.ts`（独立于 `stores/agent.ts`）：

```typescript
interface ChatStore {
  agents: ChatAgent[];
  activeAgentId: string | null;
  messages: Record<string, ChatMessage[]>;  // agentId -> messages
  sending: Record<string, boolean>;          // agentId -> isSending

  // Actions
  loadAgents: () => Promise<void>;
  createAgent: (data: Omit<ChatAgent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAgent: (id: string, data: Partial<ChatAgent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => void;
  loadMessages: (agentId: string) => Promise<void>;
  sendMessage: (agentId: string, content: string) => void;  // 通过 WS 发送
  stopAgent: (agentId: string) => void;
}
```

### SDK 模块

`packages/sdk/chat.ts`：6 个 API 方法对应 REST 端点（list/create/update/delete agents、list/delete messages）。

## 4. 新增文件清单

| 层 | 文件 | 职责 |
|---|---|---|
| server/storage | `chat-store.ts` | agents.json + message_history/ 读写 |
| server/services | `chat.ts` | ChatAgent/ChatMessage CRUD 业务逻辑 |
| server/routes | `chat.ts` | REST API（6 个端点） |
| server/ws | `chat-handler.ts` | WS 事件处理 + LangChain 执行调度 |
| web/app/chat | `page.tsx` | 聊天页面入口 |
| web/components/chat | `chat-agent-list.tsx` | 智能体列表（重构自 messaging-people-list） |
| web/components/chat | `add-chat-agent-dialog.tsx` | 创建/编辑智能体对话框 |
| web/components/chat | `inline-chat-panel.tsx` | 内嵌全高聊天面板 |
| web/components/chat | `chat-message-bubble.tsx` | 消息气泡组件（提取自 floating-chat-widget） |
| web/stores | `chat.ts` | 聊天状态管理 |
| sdk | `chat.ts` | API 调用模块 |

## 5. 改动文件清单

| 文件 | 改动 |
|------|------|
| `packages/server/src/app.ts` | 注册 `/api/chat/` 路由 |
| `packages/server/src/ws/handler.ts` | 注册 chat-handler 事件 |
| `packages/web/src/lib/sdk.ts` | 添加 chat SDK 模块引用 |
| `packages/web/src/app/layout.tsx` | 侧边栏导航添加 Chat 入口（可选） |
| `packages/web/src/locales/{en,zh}/chat.json` | 添加聊天页面 i18n key（可选） |
