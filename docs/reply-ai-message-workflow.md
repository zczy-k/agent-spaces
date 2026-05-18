# 回复 AI 消息工作流

本文档说明当前“回复 AI 消息”的端到端工作方式，包括前端交互、消息数据结构、WebSocket 发送、Agent 续跑、Claude Code / Codex runtime session 续接，以及不能续接时的降级行为。

相关实现：

- `packages/shared/src/types/channel.ts`
- `packages/web/src/components/chat/message-item.tsx`
- `packages/web/src/components/chat/chat-panel.tsx`
- `packages/web/src/components/chat/chat-input.tsx`
- `packages/web/src/components/composer/composer-shell.tsx`
- `packages/web/src/stores/channel.ts`
- `packages/server/src/ws/handler.ts`
- `packages/server/src/ws/agent-runner.ts`
- `packages/server/src/adapters/claude-code-runtime/index.ts`
- `packages/server/src/adapters/codex-runtime.ts`
- `packages/server/src/services/message.ts`

## 目标

回复 AI 消息不是在主聊天流里追加一条新的用户消息，而是继续扩展被回复的 AI 消息。

预期效果：

- 用户点击某条 AI 消息的回复按钮。
- composer 顶部显示“回复给 xx”。
- 用户发送回复后，该用户回复写入父消息的 `replies`。
- 主聊天列表不出现这条用户回复。
- 父消息右下角显示“有 xx 条回复消息”，点击 popover 可以查看嵌套回复。
- 父消息内容继续追加一段新的对话：
  - 用户：用户消息
  - 思考输出
  - 工具调用
  - markdown 结果
- 对 Claude Code 和 Codex runtime，优先恢复原 runtime session，避免重新读取已经读取过的文件和工具上下文。

## 数据结构

`Message` 支持两个与回复相关的字段：

```ts
interface Message {
  replies?: MessageReply[];
  metadata?: MessageMetadata;
}

interface MessageReply {
  id: string;
  senderId: string;
  content: string;
  status?: Message['status'];
  attachments?: Attachment[];
  parts?: MessagePart[];
  metadata?: MessageMetadata;
  createdAt: string;
}

interface MessageMetadata {
  agentSessionId?: string;
  runtimeSessionId?: string;
}
```

字段含义：

- `replies`：只保存嵌套回复消息，不参与主聊天列表渲染。
- `metadata.agentSessionId`：Agent Spaces 自己创建的 agent session id，用于 UI 状态和执行记录。
- `metadata.runtimeSessionId`：底层 runtime 的可续接 session/thread id。
  - Claude Code runtime 中是 Claude Agent SDK 的 `session_id`。
  - Codex runtime 中是 Codex SDK 的 `thread_id`。

消息内容中新增 `user_message` part，用于在同一条 AI 消息里显示续聊用户输入：

```ts
type MessagePart =
  | { id: string; type: 'user_message'; text: string; senderName?: string }
  | ...
```

## 前端流程

### 回复入口

`MessageItem` 渲染每条消息。消息 hover 时会显示回复按钮。

点击回复按钮后：

1. `MessageItem` 调用 `onReply(message)`。
2. `ChatPanel` 保存当前回复目标：

```ts
replyTo = { id: message.id, label: senderName }
```

3. `ChatInput` 将 `replyTo` 传给 `ComposerShell`。
4. `ComposerShell` 在输入框顶部显示：

```text
回复给 {label}
```

用户可以点击 `X` 取消回复状态。

### 发送回复

`ChatInput` 提交时会把 `replyTo.id` 作为第四个参数传给 `onSend`：

```ts
onSend(content, mentions, attachments, replyTo?.id)
```

`useChannelStore.sendMessage()` 通过 WebSocket 发送：

```ts
ws.send('channel.message', {
  channelId,
  content,
  mentions,
  attachments,
  replyToMessageId,
});
```

如果 `replyToMessageId` 存在，服务端会把它识别为嵌套回复，而不是普通主消息。

### 回复数量与 popover

`MessageItem` 从 `message.replies` 读取回复数量。

如果存在回复：

```text
有 {message.replies.length} 条回复消息
```

点击后打开 popover，展示 `replies` 中的用户回复内容和时间。

## 服务端 WebSocket 流程

入口在 `packages/server/src/ws/handler.ts` 的 `channel.message` handler。

普通消息：

1. 调用 `createMessage()` 创建主消息。
2. 广播 `channel.message`。
3. 从 mentions 和 HTML 内容中提取 agent id。
4. 对每个 agent 调用 `runMentionedAgent()`。

回复消息：

1. 如果 payload 中存在 `replyToMessageId`，调用 `appendMessageReply()`。
2. `appendMessageReply()` 将用户回复追加到父消息 `replies` 数组。
3. 广播 `channel.message.updated`，前端更新父消息。
4. 如果父消息本身是 AI 消息，取父消息的 `senderId` 作为要继续运行的 agent id。
5. 调用 `runMentionedAgent()`，并传入：

```ts
{
  messageId: parentMessage.id,
  appendUserMessage: stripHtml(content),
  resumeSessionId: parentMessage.metadata?.runtimeSessionId,
  excludeHistoryReplyIds: [newReply.id],
}
```

这里的 `messageId` 表示本次 Agent 输出继续写回父消息，而不是创建新消息。

## Agent 续跑流程

核心逻辑在 `packages/server/src/ws/agent-runner.ts`。

当 `options.messageId` 存在时：

1. 找到已有父消息 `existingMessage`。
2. 将该消息状态改为 `streaming`。
3. 新 Agent 运行过程中的 parts 不覆盖旧 parts，而是通过 `buildContinuationParts()` 追加：

```text
旧 parts
用户：本次回复内容
本轮 reasoning
本轮 chain / tool calls
本轮 final markdown
```

这样可以保留原消息中的：

- 原思考输出
- 原工具调用
- 原 markdown 结果

同时在后面继续插入新的一轮对话。

## Runtime Session 续接

回复 AI 消息时，runner 会检查：

```ts
options.resumeSessionId
```

如果存在，并且 runtime 支持 session resume，则不再重建完整 prompt。

当前支持：

- `claude-code`
- `codex`

续接时发送给 runtime 的 prompt 只有用户本次回复内容：

```ts
agentPrompt = prompt
```

普通启动或不能续接时才会调用：

```ts
buildAgentPrompt(...)
```

### Claude Code runtime

Claude Code runtime 使用 `@anthropic-ai/claude-agent-sdk`。

首次运行：

1. 调用 `query({ prompt, options })`。
2. SDK 产生 `session_id`。
3. runtime 从 SDK message 中读取 `session_id`。
4. 通过 runtime event 通知 runner：

```ts
{ type: 'session', sessionId }
```

5. runner 将该 id 保存到父消息：

```ts
metadata.runtimeSessionId = sessionId
```

回复续接：

1. handler 从父消息读取 `metadata.runtimeSessionId`。
2. runner 传给 runtime：

```ts
resumeSessionId: runtimeSessionId
```

3. Claude Code runtime 映射为 SDK 参数：

```ts
options.resume = resumeSessionId
```

这等价于 Claude Code CLI 的 resume / continue 行为。SDK 会加载原 session 中的消息、工具调用和结果，因此 Agent 不需要重新读取旧文件。

### Codex runtime

Codex runtime 使用 `@openai/codex-sdk`。

首次运行：

1. 调用 `codex.startThread(threadOptions)`。
2. Codex SDK 产生 `thread.started` 事件。
3. runtime 读取：

```ts
event.thread_id
```

4. 通过 runtime event 通知 runner：

```ts
{ type: 'session', sessionId: event.thread_id }
```

5. runner 将它保存到：

```ts
metadata.runtimeSessionId
```

回复续接：

1. handler 从父消息读取 `metadata.runtimeSessionId`。
2. runner 传给 Codex runtime：

```ts
resumeSessionId: runtimeSessionId
```

3. Codex runtime 调用：

```ts
codex.resumeThread(resumeSessionId, threadOptions)
```

这对应 Codex CLI 的：

```text
codex exec resume {SESSION_ID} {PROMPT}
```

但项目中使用 SDK，因此不需要启动交互式 picker，也不会依赖 `--last` 这种全局最近 session。

## 降级行为

如果父消息没有 `metadata.runtimeSessionId`，或 runtime 不是 `claude-code` / `codex`：

1. runner 仍会继续写回父消息。
2. 仍会追加 `user_message` part 和新的 Agent 输出。
3. 但 Agent prompt 会通过 `buildAgentPrompt()` 重建。
4. 历史消息会经过过滤，避免把本次新回复重复放进历史。

这意味着功能仍然可用，但 runtime 可能会重新读取文件或重新调用工具。

## 为什么不用 CLI 的 `--last`

`codex resume --last` 或 `codex continue` 适合单用户终端交互，但不适合服务端：

- `--last` 是全局最近 session，多个工作空间或多个 agent 并发时可能串线。
- 交互式 picker 不适合 WebSocket 后台任务。
- 服务端需要精确恢复某条 AI 消息对应的 session。

因此当前实现使用持久保存的 `runtimeSessionId`：

```text
父消息 -> metadata.runtimeSessionId -> runtime resume
```

这是可并发、可恢复、可追踪的方式。

## 当前限制

- 只有 AI 消息会触发 Agent 续跑；回复用户消息只会保存为嵌套回复。
- `runtimeSessionId` 依赖底层 runtime 成功产出 session/thread id。
- 如果底层 session 文件被删除，resume 会失败，当前会走 runtime 错误路径，不会自动重新跑完整上下文。
- 其他 runtime 如 `open-agent-sdk`、`langchain` 当前没有接入 session resume。
- 回复 popover 目前展示的是嵌套用户回复；Agent 的续写结果显示在父消息主体 parts 中。

## 调试建议

检查某条消息是否支持高质量续接：

1. 查看消息 JSON 中是否存在：

```json
{
  "metadata": {
    "runtimeSessionId": "..."
  }
}
```

2. 确认 runtime 是：

```json
{
  "metadata": {
    "runtime": "claude-code"
  }
}
```

或：

```json
{
  "metadata": {
    "runtime": "codex"
  }
}
```

3. 回复后观察服务端日志：

```text
[claude-code] ...
[codex] ...
```

如果底层 runtime 正常 resume，通常不会再重复读取上一轮已经读取过的大量文件。
