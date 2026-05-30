# OpenAgent SDK Runtime

本文档记录 Agent Spaces 当前 `open-agent-sdk` runtime 的实现边界、配置映射、MCP 接入、内置函数工具桥、Skills 注册方式、事件输出和排障步骤。

相关实现：

- `packages/server/src/adapters/open-agent-sdk-runtime.ts`
- `packages/server/src/adapters/agent-runtime.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/adapters/codex-function-tool-bridge.ts`
- `packages/server/src/ws/agent-runner.ts`
- `packages/server/src/routes/agent-sse.ts`
- `packages/server/src/services/agent.ts`

## 当前定位

`open-agent-sdk` 是 Agent Spaces 的默认 runtime kind：

```ts
runtimeKind?: 'open-agent-sdk' | 'claude-code' | 'codex' | 'langchain' | 'hermes' | 'oh-my-pi'
```

当 Agent Preset 没有显式指定 `runtimeKind` 时，`createAgentRuntime()` 会创建 `OpenAgentSdkRuntime`。

该 runtime 直接在 server 进程内调用 `@codeany/open-agent-sdk`：

```ts
createAgent({
  apiType,
  model,
  apiKey,
  baseURL,
  cwd,
  systemPrompt,
  maxTurns,
  allowedTools,
  mcpServers,
  additionalDirectories,
  permissionMode,
  abortController,
})
```

因此它不是 CLI 子进程适配器。模型调用、MCP 连接、工具调度和 agent loop 由 OpenAgent SDK 管理，Agent Spaces 负责把工作区上下文、Agent Preset 配置和运行时事件接入到统一的 `AgentRuntime` 接口。

## 运行入口

WebSocket 聊天入口在 `packages/server/src/ws/agent-runner.ts` 中创建 runtime，并调用：

```ts
runtime.execute(agentPrompt, workingDir, {
  maxTurns: 100,
  functionTools,
  mcpServers,
  skills,
  configDir,
  sandboxDirs,
  outputStyle,
  userPrompt,
  onEvent,
})
```

SSE 入口在 `packages/server/src/routes/agent-sse.ts` 中使用同一个 runtime 接口，但不会注入内置函数工具，仅传入 prompt、MCP、skills、sandboxDirs、outputStyle 和事件回调。

## 配置映射

### 模型和 provider

Agent Preset 字段会映射到 `AgentRuntimeConfig`：

| Agent Preset 字段 | Runtime config 字段 | OpenAgent SDK 字段 |
| --- | --- | --- |
| `runtimeKind` | `kind` | 不直接传入 SDK |
| `modelProvider` | `provider` | `apiType` |
| `modelId` | `model` | `model` |
| `apiKey` | `apiKey` | `apiKey` |
| `apiBase` | `baseURL` | `baseURL` |
| thinking 配置 | `thinkingEnabled` / `thinkingEffort` | 当前 runtime 未显式映射 |

当前 `normalizeApiType()` 只把以下 provider 传给 OpenAgent SDK：

```ts
'anthropic-messages'
'openai-completions'
```

其它 provider 会传 `undefined`，交给 OpenAgent SDK 使用默认 api type。若新增 provider，优先在 `normalizeApiType()` 中做显式映射，避免行为依赖 SDK 默认值。

这些 provider 名称是 Agent Spaces 的跨 runtime 抽象，不等同于所有 runtime 的原生 provider。`open-agent-sdk` 会把 `anthropic-messages` 当作 SDK 的 `apiType` 传入；`hermes` runtime 则不会把它传给 `hermes chat --provider`，因为 Hermes 主模型的 `provider` 需要使用 Hermes 自己的 provider 名称或 `custom` 配置。

当同一个 Agent Preset 切到 `hermes` runtime 时，server 会在该 Agent 的独立 `HERMES_HOME/config.yaml` 中生成 Hermes 原生 custom endpoint 配置，并通过环境变量注入 API key，避免把密钥写入磁盘：

```yaml
model:
  default: "GLM-4.7"
  provider: custom
  base_url: "https://open.bigmodel.cn/api/paas/v4"
  api_key: ${AGENT_SPACES_HERMES_API_KEY}
  api_mode: chat_completions
```

Hermes 的 `api_mode` 由 `modelProvider` 和 `apiBase` 共同决定：

| Agent Preset `modelProvider` | `apiBase` | Hermes `api_mode` |
| --- | --- | --- |
| `anthropic-messages` | `*.anthropic.com` | `anthropic_messages` |
| `anthropic-messages` | 非 Anthropic 域名，例如 BigModel/Zhipu | `chat_completions` |
| `openai-chat-completions` / `openai-chat-completions-to-anthropic-messages` | 任意自定义 endpoint | `chat_completions` |
| `openai-responses` / `openai-responses-to-anthropic-messages` | 任意自定义 endpoint | `codex_responses` |

这个分支是为了避免 OpenAI-compatible endpoint 被误按 Anthropic Messages 协议调用。例如 BigModel 的 `apiBase=https://open.bigmodel.cn/api/paas/v4` 如果使用 `anthropic_messages`，Hermes 会追加 `/v1/messages` 并请求到 `/v4/v1/messages`，导致 404。

### 权限和目录

| Agent Spaces 选项 | OpenAgent SDK 字段 |
| --- | --- |
| `workingDir` | `cwd` |
| `options.sandboxDirs` | `additionalDirectories` |
| `config.permissionMode` | `permissionMode` |
| `options.tools` | `allowedTools` |
| `options.maxTurns` | `maxTurns` |
| `options.systemPrompt` | `systemPrompt` |

默认 `permissionMode` 是 `bypassPermissions`。

`workingDir` 为空时会回退到 server 进程的 `process.cwd()`。

## Prompt 处理

`OpenAgentSdkRuntime.execute()` 收到的 `prompt` 通常已经由上游 `buildAgentPrompt()` 组装完成，包含：

- Workspace prompt
- Agent runtime configuration
- Persistent workspace context
- 会话历史
- 用户请求

runtime 内部只额外调用 `appendOutputStyleToPrompt()`。如果 Agent Preset 配置了 output style，会在最终 prompt 末尾追加：

```text
Output style instructions:
<resolved output style content>
```

## MCP 接入

OpenAgent SDK 支持直接传入 `mcpServers`：

```ts
const agent = createAgent({
  mcpServers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
  },
})
```

Agent Spaces 的 MCP 配置来源是 Agent Preset 的 `mcps.mcpServers`。服务端通过 `agentService.getMcpServers()` 提取后传给 runtime。

### 配置形状

常用 stdio MCP：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    }
  }
}
```

HTTP MCP：

```json
{
  "mcpServers": {
    "remote": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

runtime 对大部分 MCP 配置保持透传，避免把 OpenAgent SDK 的能力封装窄。

### Fetch MCP 兼容

历史内置配置曾使用：

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-fetch"]
}
```

该 npm 包不存在，会导致：

```text
npm error 404 '@modelcontextprotocol/server-fetch@*' is not in this registry.
[MCP] Failed to connect to "fetch": MCP error -32000: Connection closed
```

当前 runtime 在传给 OpenAgent SDK 前会调用 `normalizeOpenAgentMcpServers()`，仅对这个已知错误包名做兼容转换：

```json
{
  "command": "uvx",
  "args": ["mcp-server-fetch"],
  "env": { "PYTHONIOENCODING": "utf-8" }
}
```

如果原配置在 `@modelcontextprotocol/server-fetch` 后追加了参数，会保留追加参数。其它 MCP 不会被改写。

内置 `packages/agents/mcps/fetch.json` 也应保持为：

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": { "PYTHONIOENCODING": "utf-8" }
    }
  }
}
```

## 内置函数工具桥

WebSocket 聊天入口会根据 Agent Preset 的 `tools` 字段创建 Agent Spaces 内置函数工具，例如：

- Issue 工具
- 快捷命令工具
- 数据库知识库工具
- Kanban 工具

OpenAgent SDK 当前通过 MCP 接入这类工具。`startCodexFunctionToolBridge()` 会启动一个只监听 `127.0.0.1` 随机端口的 HTTP MCP server：

```text
http://127.0.0.1:<port>/mcp
```

runtime 会把它追加到 MCP 配置中：

```ts
{
  ...mcpServers,
  'agent-spaces': {
    type: 'http',
    url: bridge.url,
  },
}
```

工具调用流程：

1. OpenAgent SDK 发现 `agent-spaces` MCP server。
2. SDK 调用 `tools/list` 获取内置工具 schema。
3. SDK 调用 `tools/call`。
4. Bridge 根据工具名找到对应 `AgentFunctionTool.execute()`。
5. 返回 JSON 文本，同时当结果是对象时设置 `structuredContent`。

工具名兼容：

```text
mcp__agent-spaces__CreateCurrentChannelIssue
```

bridge 会剥离 `mcp__agent-spaces__` 前缀，再匹配 Agent Spaces 的原始工具名。

## Skills 注册

OpenAgent SDK runtime 不把 skills 写入外部 CLI 配置目录，而是在每次运行时调用 `registerConfiguredSkills()` 注册到 `@codeany/open-agent-sdk` 的全局 skill registry。

执行步骤：

1. 先注销上一轮由 Agent Spaces 注册的 skills。
2. 遍历本次 `options.skills`。
3. 在当前 Agent 配置目录查找 skill 文件。
4. 如果当前 Agent 目录只有空占位文件，则回退到全局 skill store。
5. 解析 Markdown frontmatter。
6. 调用 `registerSkill()` 注册给 OpenAgent SDK。

查找顺序：

```text
<agentDir>/skills/<skillName>/SKILL.md
<agentDir>/skills/<skillName>.md
<AGENT_SPACES_DATA_DIR>/skills/<skillName>/SKILL.md
<AGENT_SPACES_DATA_DIR>/skills/<skillName>.md
```

支持的 frontmatter 字段：

```yaml
---
name: brainstorming
description: Explore requirements before implementation.
aliases: [brainstorm, ideate]
when-to-use: Use before implementation when requirements are unclear.
---
```

如果没有 `description`，会使用正文第一条非空行生成简短描述。

## 输出和事件

runtime 消费 OpenAgent SDK 的 async event stream，并映射为 Agent Spaces 通用事件。

### system/init

当 SDK 发出 `system` + `init`：

- 写入日志：session、model、cwd、permissionMode、tools、mcp server 状态
- 向上游发送 `{ type: 'session', sessionId }`

上游会把 `runtimeSessionId` 写入 message metadata。

### assistant

当 SDK 发出 assistant message：

- 拼接所有 text block，作为当前最终文本候选
- 对 tool_use block 生成：

```text
Tool: <name> input=<json>
```

并发送：

```ts
{ type: 'tool_use', id, name, input, line }
```

### tool_result

当 SDK 发出 tool result：

```ts
{ type: 'tool_result', toolUseId, result }
```

其中 `result` 是 SDK 事件中的文本输出。

### result

当 SDK 发出 result：

- 记录 `num_turns`
- 读取 `usage.input_tokens`
- 读取 `usage.output_tokens`
- 读取 cache token 字段
- 如果 `is_error` 为 true，写入 debug 日志

`execute()` 成功返回时会在 `output` 末尾追加：

```text
[Usage] tokens=<total> input=<input> output=<output> cached=<cached>
```

## Stop 和清理

`OpenAgentSdkRuntime.stop()` 会执行：

```ts
this.abortController?.abort()
this.agent?.interrupt()
```

`execute()` 的 `finally` 会保证：

1. `this.agent?.close()`
2. `functionToolBridge?.close()`
3. 清空 `this.agent`
4. 清空 `this.abortController`

函数工具桥关闭时会关闭 MCP server 和本地 HTTP server。

## 当前限制

### resumeSessionId 未直接传给 SDK

`AgentRunOptions` 中存在 `resumeSessionId`，但当前 `OpenAgentSdkRuntime` 没有把它传给 OpenAgent SDK。上游 WebSocket 入口也只对 `claude-code` 和 `codex` 判断 runtime session resume。

如果 OpenAgent SDK 后续提供稳定的 resume API，需要在 runtime 中补齐映射。

### reasoning 事件未映射

当前只映射 `session`、`tool_use`、`tool_result` 和最终 `output`。如果 OpenAgent SDK 暴露稳定的 reasoning/thinking event，可以扩展 `collectQueryResult()`。

### provider 映射较窄

`normalizeApiType()` 只显式支持 `anthropic-messages` 和 `openai-completions`。其它 provider 当前依赖 SDK 默认行为。

注意：这个限制只描述 `open-agent-sdk` runtime。Hermes runtime 对同一份 Agent Preset 会做额外转换：协议型 provider 不会传给 `hermes chat --provider`，而是写入 Hermes profile 的 `model.provider: custom`、`base_url`、`api_key` 和 `api_mode`。

### Skills registry 是进程级状态

OpenAgent SDK 的 skill registry 是进程内全局状态。当前实现每次运行前注销上一轮由 Agent Spaces 注册的 skills，再注册本轮 skills。

这保持了简单实现，但意味着并发运行多个不同 skills 的 OpenAgent runtime 时，存在 registry 共享风险。若后续 OpenAgent SDK 支持 per-agent skill registry，应优先改为隔离注册。

## 排障

### MCP fetch 启动失败

症状：

```text
npm error 404 '@modelcontextprotocol/server-fetch@*' is not in this registry.
[MCP] Failed to connect to "fetch": MCP error -32000: Connection closed
```

处理：

1. 确认 `packages/agents/mcps/fetch.json` 使用 `uvx mcp-server-fetch`。
2. 如果用户数据目录中已导入旧 MCP 配置，runtime 会自动兼容旧包名。
3. 确认运行环境可执行 `uvx`。

手动检查：

```powershell
uvx --version
```

### MCP server 显示 connection closed

检查顺序：

1. 在普通 shell 中单独运行 MCP 命令，确认 stdio server 能启动。
2. 确认 `args` 中没有只能在 Claude Code 中识别的别名。
3. 确认 `env` 中包含 MCP server 需要的 token。
4. 查看 server 日志中的 `sdk init` 行，确认 MCP server 状态。

### 内置工具不可用

检查日志：

```text
function tool bridge started | url=http://127.0.0.1:<port>/mcp tools=<...>
resolved tools | ... mcpServers=...,agent-spaces ...
```

如果没有第一行，说明本次运行没有传入 `functionTools`，通常是 Agent Preset 的 `tools` 字段没有选择任何内置工具。

如果有第一行但 SDK 没有调用工具，检查：

1. `allowedTools` 是否限制了工具。
2. Prompt 中的 built-in tools 描述是否包含目标工具。
3. MCP 初始化状态是否包含 `agent-spaces`。

### Skills 没有生效

检查日志：

```text
skills registered | requested=<...> registered=<...>
```

如果 `requested` 有值但 `registered` 为空，按查找顺序检查文件是否存在且非空：

```text
<agentDir>/skills/<skillName>/SKILL.md
<agentDir>/skills/<skillName>.md
<AGENT_SPACES_DATA_DIR>/skills/<skillName>/SKILL.md
<AGENT_SPACES_DATA_DIR>/skills/<skillName>.md
```

## 修改建议

新增 OpenAgent SDK runtime 能力时优先遵循以下边界：

1. 能透传给 SDK 的配置尽量透传，不在 Agent Spaces 侧重复实现 SDK 行为。
2. 只对已知错误配置做窄兼容，例如 retired package name。
3. MCP 和 function tools 都走同一 `mcpServers` 合并路径，避免两套工具注册逻辑。
4. 事件映射保持在 `collectQueryResult()` 内，避免 WebSocket/SSE 入口感知 SDK 私有事件结构。
5. 新增行为需要补 `packages/server/test/open-agent-sdk-runtime.test.ts` 的最小回归测试。

## 验证步骤

文档变更本身不需要运行构建。涉及 runtime 行为修改时，至少执行：

```powershell
pnpm exec tsx --test "packages/server/test/open-agent-sdk-runtime.test.ts"
pnpm --filter "@agent-spaces/server" build
```

手动验证 MCP fetch：

1. 重启 Agent Spaces server。
2. 创建或选择 `runtimeKind=open-agent-sdk` 的 Agent。
3. 绑定 `fetch` MCP。
4. 发送一个需要抓取 URL 的 prompt。
5. 确认日志中不再出现 `@modelcontextprotocol/server-fetch` 的 npm 404。
