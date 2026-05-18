# Agent 持久上下文加载方案

本文档记录 Agent Spaces 当前的持久上下文加载方案，目标是让所有 Agent 在启动和续聊时自动获得项目级指令文件，而不依赖用户在全局 prompt 中手动提醒。

相关实现：

- `packages/server/src/services/persistent-agent-context.ts`
- `packages/server/src/ws/agent-prompt.ts`
- `packages/server/src/ws/agent-runner.ts`
- `packages/server/src/adapters/claude-code-runtime/index.ts`
- `packages/server/src/routes/agent-sse.ts`
- `packages/server/src/agents/issue-task-controller.ts`
- `packages/server/src/agents/commit-agent.ts`
- `packages/server/src/services/notification-hub/bot-agent.ts`

## 背景问题

原先只有 `workspace prompt` 会被拼进聊天 Agent 的 prompt。项目中的 `CLAUDE.md`、`claude.md`、`AGENTS.md`、`agents.md` 不会由 Agent Spaces 统一加载。

影响：

- 如果用户没有显式提示“读取 CLAUDE.md”，非 Claude Code runtime 不会自动得到项目规范。
- Claude Code runtime 因为 SDK 配置禁用了 filesystem settings，也不会按 Claude Code 原生规则读取 `CLAUDE.md`。
- 用户回复某个 Agent 消息后，后端会再次启动该 Agent 续写原消息；如果历史里包含旧 prompt、工具输出或大段 runtime 日志，容易导致上下文膨胀。

## 设计目标

- 所有 runtime 都能自动获得项目持久指令。
- 优先兼容 Claude Code 原生 `CLAUDE.md` 行为。
- 同时支持 `AGENTS.md` 和小写文件名。
- 回复 Agent 时不把旧的工具输出、持久 prompt 和超长历史反复塞回新 prompt。
- 不改变前端回复交互；问题在服务端 prompt 构建层解决。

## 指令文件加载规则

统一加载器位于 `persistent-agent-context.ts`。

默认识别文件名：

```text
CLAUDE.md
claude.md
AGENTS.md
agents.md
```

加载来源：

1. 用户全局目录：

```text
~/.agent-spaces-data/{filename}
```

2. 当前 `workingDir` 向上递归到工作空间根目录或最近项目根目录。

根目录解析规则：

- 如果 `workspace.boundDirs` 中存在包含当前 `workingDir` 的目录，使用最外层匹配目录作为根。
- 否则向上查找最近包含 `.git` 或 `package.json` 的目录。
- 如果都找不到，使用当前 `workingDir`。

合并顺序：

- 全局文件先加载。
- 项目路径按从根目录到当前工作目录的顺序加载。
- 后加载的文件更靠近当前目录，优先级更高。
- 同一路径通过 realpath 去重。

预算：

- 单个指令文件最多 48,000 字符。
- 总持久指令上下文最多 120,000 字符。
- 超出预算时截断并在 prompt 中标记。

## Runtime 差异

Claude Code runtime：

- 恢复 SDK 的 filesystem settings：

```ts
settingSources: ['user', 'project', 'local']
```

- 这样 Claude Code SDK 会按原生规则读取大写 `CLAUDE.md`。
- Agent Spaces 统一加载层对 Claude Code 跳过 `CLAUDE.md`，只补充：

```text
claude.md
AGENTS.md
agents.md
```

这样可以避免大写 `CLAUDE.md` 被 SDK 和统一 prompt 注入重复加载。

其它 runtime：

- Codex runtime、LangChain runtime、OpenAgent SDK runtime 没有 Claude Code 原生项目记忆机制。
- Agent Spaces 统一加载层会为它们注入全部四类文件。

## Prompt 注入位置

聊天 Agent 和 SSE Agent 使用 `buildAgentPrompt()`。该函数现在先构建业务 prompt，再调用：

```ts
prependPersistentAgentContext(prompt, {
  workspaceId,
  workingDir,
  boundDirs,
  excludeNativeClaudeMd,
})
```

注入后的结构大致为：

```text
Persistent agent instructions:
...

Workspace prompt:
...

{agent system prompt}

Agent runtime configuration:
...

Conversation history:
...

User message:
...
```

说明：

- 聊天和 SSE Agent 保留原有 `workspace prompt` 行为。
- issue automation、commit agent、notification bot 只注入指令文件，不额外注入 `workspace prompt`，避免改变这些专用流程的输出约束。

## 覆盖入口

当前接入持久上下文的入口：

- 频道中 `@agent` 触发的聊天运行：`ws/agent-runner.ts`
- API/SSE 运行：`routes/agent-sse.ts`
- issue 任务同步 Agent：`agents/issue-task-controller.ts`
- issue 任务执行 Agent：`agents/issue-task-controller.ts`
- 通知平台 bot Agent：`services/notification-hub/bot-agent.ts`
- commit message Agent：`agents/commit-agent.ts`

## 回复 Agent 的上下文压缩

用户点击消息回复按钮时，前端仍然只是发送 `replyToMessageId`。后端逻辑在 `ws/handler.ts` 中把用户回复追加到原消息的 `replies`，然后调用 `runMentionedAgent()` 继续执行该 Agent。

压缩发生在 `ws/agent-prompt.ts` 的 conversation history 格式化阶段。

当前策略：

- Agent 历史优先读取 `parts` 中的最终 `text` part。
- 如果有结构化 parts，不再把完整 `message.content` 当作历史输入。
- 过滤工具和 runtime 噪声，例如：

```text
Tool: ...
Read ...
Write ...
Edit ...
Bash ...
Claude Code initialized ...
Input: {...}
Output: {...}
```

- 过滤历史中可能泄漏的持久上下文块：

```text
Persistent agent instructions:
Workspace prompt:
```

- 历史总预算为 24,000 字符。
- 单条历史最多 4,000 字符。
- 超出后标记 `[history truncated]`。

这不是模型级摘要压缩，而是服务端 prompt 构建前的确定性裁剪。它的目标是阻止旧工具日志和旧系统上下文在每次回复时重复膨胀。

## 行为示例

假设工作目录为：

```text
/repo/packages/web
```

且存在：

```text
~/.agent-spaces-data/CLAUDE.md
/repo/CLAUDE.md
/repo/AGENTS.md
/repo/packages/web/CLAUDE.md
/repo/packages/web/agents.md
```

对 Codex runtime，统一 prompt 会加载全部文件，顺序为：

```text
~/.agent-spaces-data/CLAUDE.md
/repo/CLAUDE.md
/repo/AGENTS.md
/repo/packages/web/CLAUDE.md
/repo/packages/web/agents.md
```

对 Claude Code runtime：

- Claude Code SDK 原生加载大写 `CLAUDE.md`。
- Agent Spaces 统一 prompt 补充 `AGENTS.md`、`agents.md` 和小写 `claude.md`。

## 验证

改动后至少运行：

```bash
pnpm --filter @agent-spaces/server build
```

建议手动验证：

1. 在项目根目录创建或修改 `AGENTS.md`。
2. 使用 Codex runtime 的 Agent 提问项目规范，确认它能回答。
3. 使用 Claude Code runtime 的 Agent 提问 `CLAUDE.md` 和 `AGENTS.md` 中的规范，确认两类文件都生效。
4. 对 Agent 消息连续回复多轮，确认不会把上一轮完整工具日志继续带入新 prompt。

## 后续改进

- 增加实际 token 估算，而不是字符预算。
- 为超长历史增加模型摘要压缩，并把摘要作为 channel 级状态缓存。
- 在消息 metadata 中记录本轮加载的指令文件列表，方便 UI 或调试日志展示。
- 为持久上下文加载器增加单元测试，覆盖根目录解析、去重、预算截断和 Claude Code 去重策略。
