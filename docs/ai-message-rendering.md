# AI Message Rendering

本文档说明当前 AI 消息回复机制、实时更新链路，以及聊天 UI 如何根据结构化消息块展示思考、工具调用、子 agent、权限确认、上下文统计和附件。

## 目标

AI 消息不再只在完成后展示最终文本。运行中应该逐步展示：

- agent 正在处理
- reasoning / 思考过程
- Read / Write / Edit / Bash 等工具调用记录
- Bash 输出
- agent 自主调用的 subagent
- 权限确认请求
- 上下文和 token 使用统计
- 最终回答

普通用户 `@agent` 触发的主 agent 不使用 subagent 卡片展示。`subagent.tsx` 只用于 agent 运行中主动调用 Task/subagent 时的展示。

## Message 数据结构

共享类型定义在：

- `packages/shared/src/types/channel.ts`

`Message` 保持兼容原有 `content` 文本字段，同时新增：

- `attachments?: Attachment[]`
- `parts?: MessagePart[]`
- `metadata?: MessageMetadata`

`parts` 是 UI 展示的主要数据来源。当前支持：

- `text`：最终文本或中间文本
- `reasoning`：思考过程，可带 `streaming/completed` 状态
- `todo`：步骤列表或工具调用列表
- `terminal`：命令和终端输出
- `confirmation`：工具权限确认请求
- `context`：上下文窗口和 token 使用
- `subagent`：agent 主动调用的子 agent
- `ask_user_question`：agent 向用户提问

## 后端回复链路

入口：

- `runMentionedAgent()` in `packages/server/src/ws/handler.ts`

流程：

1. 用户在聊天输入框中发送消息，`ChatInput` 通过 websocket 发出 `channel.message`。
2. 服务端创建用户消息并广播 `channel.message`。
3. 服务端从消息 HTML 和 mentions 中提取 agent id。
4. 对每个被提及的 agent 创建一个 streaming 状态的 pending 消息。
5. runtime 开始执行 agent。
6. runtime 每收到一条可展示事件，就通过 `AgentRunOptions.onEvent` 回调给 `runMentionedAgent()`。
7. `runMentionedAgent()` 把实时输出累计到 `liveOutput`，调用 `buildAgentMessageParts()` 生成结构化 `parts`。
8. 服务端更新 pending message，并广播 `channel.message.updated`。
9. agent 完成后，服务端写入最终 `content/status/metadata/parts`，再次广播 `channel.message.updated`。

实时更新做了约 120ms 的节流，避免工具事件过密时频繁写消息文件和广播。

## Runtime 事件

runtime 接口定义在：

- `packages/server/src/adapters/agent-runtime-types.ts`

`AgentRunOptions` 支持：

```ts
onEvent?: (event: AgentRuntimeEvent) => void
```

当前事件形态：

```ts
{
  type: 'output',
  line: string
}
```

`ClaudeCodeRuntime` 在 SDK message loop 中把 assistant text、tool_use、tool_progress、tool_use_summary、local command output 等格式化为可展示行，并触发 `onEvent`。

示例：

```text
Tool: Read file_path="/path/to/file.ts"
Tool: Write file_path="/path/to/README.md"
Tool: Edit file_path="/path/to/app.tsx"
Tool: Bash command="pnpm build"
Write running (2s)
```

这些行同时会进入 server log，格式类似：

```text
[claude-code] tool use | id=... name=Write input=file_path="..."
[claude-code] tool result | parent=... result=...
```

`OpenAgentSdkRuntime` 当前 `prompt()` 接口只暴露最终 text/usage，不暴露逐工具事件。因此它只能在完成后通过 `onEvent` 推送最终文本。

## 工具调用解析

工具调用解析集中在：

- `buildAgentMessageParts()` in `packages/server/src/ws/handler.ts`

规则：

- 以 `Tool:`、`Read`、`Write`、`Edit`、`MultiEdit`、`Bash`、`Grep`、`Glob` 等开头的行会被识别为工具相关行。
- 普通工具调用会进入 `todo` part，前端用 `chain-of-thought.tsx` 展示。
- `Tool: Bash ...` 会额外进入 `terminal` part，前端用 `terminal.tsx` 展示。
- `Tool: Task ...` 会进入 `subagent` part，前端用 `subagent.tsx` 展示。
- 非工具行会作为 reasoning 或最终文本处理。

重要约定：主 agent 被用户 `@` 唤起时，不生成 `subagent` part。只有 Task/subagent 工具调用会生成 `subagent` part。

## 前端展示链路

主要文件：

- `packages/web/src/components/chat/message-item.tsx`
- `packages/web/src/components/chat/message-parts.tsx`

`MessageItem` 负责头像、发送者、时间、复制/编辑/删除等外层消息 UI。

消息内容由 `MessageParts` 渲染：

1. 先渲染 `message.attachments`
2. 再按顺序渲染 `message.parts`
3. 如果没有 `text` part，则回退渲染 `message.content`
4. 如果消息仍在 pending/streaming 且没有 parts，则显示 loader

## UI 组件映射

| MessagePart type | UI component | 用途 |
| --- | --- | --- |
| `text` | `Markdown` | 最终回复文本 |
| `reasoning` | `chain-of-thought.tsx` | 思考过程、streaming 状态和非最终 AI 中间输出 |
| `todo` | `chain-of-thought.tsx` | TODO 或工具调用记录 |
| `terminal` | `terminal.tsx` | Bash/命令输出 |
| `confirmation` | `confirmation.tsx` | 工具权限确认 |
| `context` | `context.tsx` | 上下文窗口和 token 使用 |
| `subagent` | `subagent.tsx` | agent 自主调用的子 agent |
| `ask_user_question` | `ask-user-question.tsx` | agent 向用户提问 |
| attachments | `attachments.tsx` | 图片、PDF、文档等附件 |

## 附件上传

入口：

- `packages/web/src/components/chat/chat-input.tsx`
- `packages/web/src/app/api/upload/route.ts`

`ChatInput` 支持拖拽和文件选择。当前允许：

- 图片：`image/*`
- PDF
- Word：`.doc/.docx`
- 文本类：`.txt/.md/.csv/.json`

上传结果会作为 `attachments` 放进 websocket `channel.message` payload。服务端保存到 `Message.attachments`，前端使用 `attachments.tsx` 展示缩略图或文档 chip。

## WebSocket 事件

客户端发送：

- `channel.message`

服务端广播：

- `channel.message`：新消息
- `channel.message.updated`：实时更新 AI 消息，包括 parts 和 status
- `agent.output`：保留给 agent 输出监听面板或调试流
- `agent.completed`：agent 完成
- `agent.error`：agent 失败

聊天 UI 的实时展示依赖 `channel.message.updated`。

## 状态语义

`Message.status` 当前语义：

- `pending`：消息已创建但还没开始产生内容
- `streaming`：agent 正在运行并可能持续更新 parts
- `completed`：agent 成功完成
- `error`：agent 失败

主 agent pending 消息创建时现在使用 `streaming`，因为 runtime 会立刻进入可更新状态。

## 开发注意事项

- 新增展示类型时，先扩展 `MessagePart`，再更新 `MessageParts` 的 switch 渲染。
- runtime 如果能提供逐工具事件，应优先通过 `onEvent` 推送，避免等最终结果。
- 不要把普通 `@agent` 主 agent 渲染成 `subagent`。`subagent` 只表示 agent 内部的 Task/subagent 调用。
- 工具输入和结果需要截断或脱敏，避免大文件内容写入日志或消息 parts。
- `content` 仍需保留，作为旧消息兼容和复制文本来源。
- agent 完成时如果已有实时 `liveOutput`，最终 `parts/content` 应继续使用该实时输出作为展示来源，避免完成事件把 `result.output` 中重复的最终文本再次渲染出来。
