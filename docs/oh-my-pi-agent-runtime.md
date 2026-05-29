# Oh My Pi Agent Runtime

本文档记录 Agent Spaces 当前 `oh-my-pi` runtime 的实现程度、已验证行为、已知限制和后续需要处理的问题。

相关实现：

- `packages/server/src/adapters/oh-my-pi-runtime.ts`
- `packages/server/src/adapters/agent-runtime.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/services/agent.ts`
- `packages/shared/src/types/workspace.ts`
- `packages/web/src/components/sidebar/agent-shared.tsx`
- `packages/server/src/ws/agent-prompt.ts`

## 当前实现程度

`oh-my-pi` 已作为 Agent Spaces 的 runtime kind 接入：

```ts
runtimeKind?: 'open-agent-sdk' | 'claude-code' | 'codex' | 'langchain' | 'hermes' | 'oh-my-pi'
```

服务端 `createAgentRuntime({ kind: 'oh-my-pi' })` 会创建 `OhMyPiRuntime`。Web 端 Agent Preset runtime 下拉框也已加入 `Oh My Pi`。

当前实现目标是使用 `@oh-my-pi/pi-coding-agent` SDK 进程内嵌入 agent：

- 不启动 `omp` CLI 子进程。
- 不使用 JSONL/RPC pipe。
- 通过 `createAgentSession()` 创建 `AgentSession`。
- 通过 `session.subscribe()` 消费 session events。
- 通过 `session.prompt()` 执行单轮请求。
- 通过 `session.abort()` 实现 stop。
- 执行结束或失败后调用 `session.dispose()` 释放资源。

但当前发布的 `@oh-my-pi/pi-coding-agent@15.5.12` 是 Bun-native 包：

- `package.json` 中 `exports.import` 指向 `./src/index.ts`。
- 源码直接使用 `Bun.*`。
- 多处源码直接 `import { YAML } from "bun"` 或 `import { $ } from "bun"`。
- `engines` 声明为 `bun >= 1.3.14`。

因此 Agent Spaces 当前默认的 Node server 进程不能直接内嵌该 SDK。adapter 已改成懒加载 OMP SDK，避免 server 启动时因 OMP 的 Bun-only 源码崩溃；只有实际选择 `oh-my-pi` runtime 执行时才检查运行环境。如果当前进程不是 Bun，会返回明确错误，提示改用 Bun 运行 server 或改走 CLI/RPC process boundary。

## 配置映射

### 工作目录

Agent Spaces 传入的 `workingDir` 会映射为：

```ts
createAgentSession({ cwd })
```

如果上游没有传入 `workingDir`，fallback 为当前 server 进程的 `process.cwd()`。

### OMP 配置目录

Agent Spaces 的 `options.configDir` 会传入：

```ts
discoverAuthStorage(options.configDir)
createAgentSession({ agentDir: options.configDir })
```

这意味着 runtime 会优先使用该 Agent 对应目录下的 OMP agent 配置和 auth storage，而不是固定共享默认目录。

如果 `configDir` 未传入，OMP SDK 会按自身默认规则发现 `~/.omp/agent`。

### 模型选择

当前选择顺序：

1. 调用 `discoverAuthStorage()` 和 `new ModelRegistry(authStorage)`。
2. `await modelRegistry.refresh()`。
3. 如果 Agent Spaces 配置了 `provider + modelId`，先尝试 `modelRegistry.find(provider, modelId)`。
4. 如果未命中，再在 `modelRegistry.getAvailable()` 里按 `modelId` 或 `provider/modelId` 查找。
5. 如果仍未命中，使用 `modelRegistry.getAvailable()[0]`。
6. 如果没有可用模型，则让 OMP SDK 的 `createAgentSession()` 按自身规则报错或 fallback。

### Agent Spaces provider 注册

当 Agent Spaces 同时提供：

- `apiKey`
- `modelId`
- `apiBase`

runtime 会调用 `modelRegistry.registerProvider()` 动态注册一个 provider，使 Agent Spaces 的 preset 字段可以直接驱动 OMP SDK 模型。

当前 provider/API 映射：

| Agent Spaces `modelProvider` | OMP API |
| --- | --- |
| `anthropic-messages` | `anthropic-messages` |
| `openai-responses` | `openai-responses` |
| `gemini-generate-content` | `google-generative-ai` |
| `openai-chat-completions` | `openai-completions` |
| 其他或空值 | `openai-completions` |

动态注册模型当前使用保守默认元数据：

```ts
contextWindow: 128000
maxTokens: 16384
input: ['text']
cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
```

这些值只保证 SDK 类型和基础运行，不代表真实模型能力或计费。

### Thinking level

当前映射：

| Agent Spaces config | OMP thinkingLevel |
| --- | --- |
| `thinkingEnabled === false` | `off` |
| `thinkingEffort: low` | `low` |
| `thinkingEffort: medium` 或未设置 | `medium` |
| `thinkingEffort: high` | `high` |

Agent Spaces 当前没有 `minimal` / `xhigh` 字段，因此未暴露这两个 OMP selector。

### System prompt 和 output style

`options.systemPrompt` 会作为数组替换 OMP 默认 system prompt：

```ts
systemPrompt: [options.systemPrompt]
```

`outputStyle` 沿用现有 Agent Spaces helper，通过 `appendOutputStyleToPrompt()` 追加到用户 prompt。

## 事件映射

当前把 OMP `AgentSessionEvent` 映射为 Agent Spaces 的 `AgentRuntimeEvent`。

### Assistant text

OMP:

```text
message_update + assistantMessageEvent.type === 'text_delta'
```

映射为：

```ts
{ type: 'output', line: delta }
```

同时累加为最终 `summary` 的来源。

注意：当前按 delta 推送到 `output`，不是按完整 assistant message 推送。UI 是否按预期合并，取决于上游 message parts 处理逻辑。

### Thinking

OMP:

```text
message_update + assistantMessageEvent.type === 'thinking_delta'
```

映射为：

```ts
{ type: 'reasoning', text: delta, status: 'streaming' }
```

当前没有显式发送 reasoning completed 事件。

### Tool lifecycle

OMP:

- `tool_execution_start`
- `tool_execution_update`
- `tool_execution_end`

映射为：

- `tool_use`
- `tool_result`

`tool_execution_start` 同时会向 output 写入：

```text
Tool: <toolName> input=<json>
```

### Session id

当前 session id 优先使用：

```ts
created.session.sessionManager.getSessionFile()
```

如果没有 session file，再使用：

```ts
created.session.sessionManager.getSessionId()
```

这样返回给 Agent Spaces 的 `runtimeSessionId` 更适合后续 `SessionManager.open()` 恢复。需要注意，这和其他 runtime 只返回短 id 的语义不完全一致。

## Agent Spaces function tools

当前实现已把 `AgentRunOptions.functionTools` 映射为 OMP `CustomTool[]`。

每个 `AgentFunctionTool` 被转换为：

```ts
{
  name,
  label,
  description,
  parameters: z.object({}).passthrough(),
  execute(...)
}
```

模型调用工具时：

1. OMP 调用 custom tool。
2. adapter 发送 `tool_use` event。
3. adapter 执行 Agent Spaces 的 `runtimeTool.execute(params)`。
4. adapter 发送 `tool_result` event。
5. custom tool 返回文本化 JSON 结果给 OMP agent。

当前为了兼容不同内置工具 schema，参数 schema 使用宽松的 passthrough Zod object，没有把 `AgentFunctionTool.inputSchema` 精确转换为 Zod/TypeBox schema。

## MCP、extensions、skills

当前创建 session 时设置：

```ts
enableMCP: true
enableLsp: true
toolNames: options.tools
customTools: buildCustomTools(options.functionTools)
```

这意味着：

- OMP 会按自身 discovery 规则加载配置中的 MCP servers、extensions、skills、rules、prompt templates 等。
- Agent Spaces 传入的 `options.tools` 会作为 OMP built-in tool allowlist。
- Agent Spaces 内置 function tools 通过 `customTools` 暴露。

当前没有把 `options.mcpServers` 显式转换为 OMP MCP manager 或配置覆盖。是否加载 MCP 主要取决于 OMP 对 `cwd` / `agentDir` 的 discovery。

当前也没有把 `options.skills` 显式转换为 OMP `Skill[]` 覆盖。是否加载 skills 主要取决于 OMP 自身 discovery。

## Resume 行为

当前 adapter 支持：

```ts
options.resumeSessionId ? SessionManager.open(options.resumeSessionId) : SessionManager.create(cwd)
```

但上游 `agent-runner` 目前只对 `claude-code` 和 `codex` 启用 runtime session resume 特殊逻辑。因此 `oh-my-pi` 的 resume 能力还没有完整接入产品流程。

后续如果要启用，需要同步修改上游判断逻辑，并确认：

- `runtimeSessionId` 应保存 session file path 还是短 session id。
- 多工作区/多 Agent 下 session file path 是否可安全持久化。
- fork、branch、compact 语义是否需要暴露到 Agent Spaces UI。

## Stop 和生命周期

`OhMyPiRuntime.stop()` 当前调用：

```ts
session.abort()
```

执行结束后在 `finally` 中：

```ts
unsubscribe()
session.dispose()
```

这会释放模型、MCP servers、LSP processes 等由 OMP session 打开的资源。

## 已验证内容

已执行：

```bash
pnpm --filter @agent-spaces/shared build
pnpm --filter @agent-spaces/server build
```

两者通过。

也执行过：

```bash
NEXT_STATIC_EXPORT=1 pnpm --filter @agent-spaces/web build
```

该命令进入 TypeScript 阶段后失败，失败点是既有无关文件：

```text
packages/web/src/app/login/rotating-text.tsx:78
Type '{ delay: number; }' is not assignable to type 'string | number'.
```

因此当前无法用完整 web build 证明前端整体无类型错误，但 runtime picker 相关改动本身未暴露新的编译错误。

## 当前限制和问题

### 1. 当前 OMP SDK 不能在 Node server 内嵌

这是当前最关键限制。

用户曾用：

```bash
bun install -g @oh-my-pi/pi-coding-agent
```

全局安装 OMP 后，Node server 报错：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'bun' imported from .../node_modules/@oh-my-pi/pi-coding-agent/src/config/settings.ts
```

根因不是全局包安装失败，而是 Node ESM 解析到 OMP 源码后，把 `import { YAML } from "bun"` 当成普通 npm package 导入。`bun` 是 Bun runtime 的内置模块，不是 Node 可解析的 npm 依赖。

当前 adapter 采取的策略：

- 不在模块顶层 import `@oh-my-pi/pi-coding-agent`。
- 执行 `oh-my-pi` runtime 时才动态 import。
- 动态 import 前检查 `globalThis.Bun`。
- 如果 server 正在 Node 下运行，返回清晰错误，而不是让整个 server 启动失败。

可行方向：

- 用 Bun 运行 Agent Spaces server，让 OMP SDK 与宿主运行时一致。
- 保持 Agent Spaces server 运行在 Node，但不要内嵌 OMP SDK，改用 OMP CLI/RPC 作为进程边界。
- 等 OMP 发布真正 Node-compatible 的 SDK 构建产物，例如 `dist` JS 不依赖 Bun runtime，或提供 Node fallback。

### 2. 没有真实 OMP 集成运行验证

当前只完成 TypeScript build 验证。尚未在真实 OMP auth、真实模型和真实工作区下跑一次端到端 agent turn。

需要补充的最小运行验证：

1. 准备可用 `~/.omp/agent/config.yml` 或 Agent Spaces preset 的 `apiKey/apiBase/modelId`。
2. 创建 Agent Preset，选择 `Oh My Pi` runtime。
3. 运行简单 prompt。
4. 检查服务端日志出现 `[oh-my-pi] starting` 和 `[oh-my-pi] done`。
5. 检查 UI 是否展示 assistant text、thinking、tool call。
6. 调用一个 Agent Spaces 内置 function tool，例如 database 或 kanban tool。

### 3. 动态 provider 元数据是占位值

当前动态注册 provider 时的 `contextWindow`、`maxTokens`、`cost`、`input`、`reasoning` 是保守默认值。

风险：

- context window 过大或过小会影响 compaction 和模型选择。
- cost 为 0 会导致 OMP 内部费用统计不准确。
- `input: ['text']` 不支持 vision 模型。
- reasoning 能力只按 `thinkingEnabled` 粗略设置，不一定匹配真实模型。

后续应从 Agent Spaces model 配置或 provider catalog 中补充真实元数据。

### 4. `inputSchema` 没有精确映射

Agent Spaces `AgentFunctionTool.inputSchema` 当前没有转换给 OMP custom tool。

当前使用：

```ts
z.object({}).passthrough()
```

风险：

- 模型看到的工具参数约束过弱。
- OMP 无法用 schema 辅助模型生成正确参数。
- 工具参数错误会推迟到 Agent Spaces 工具自身执行阶段才失败。

后续应实现 JSON Schema 到 Zod/TypeBox 的转换，或调整 `AgentFunctionTool` 抽象以提供 OMP 可直接消费的 schema。

### 5. `options.mcpServers` 未显式覆盖

Agent Spaces 运行时传入的 `mcpServers` 当前只出现在日志中，没有被手动传入 OMP session。

风险：

- Agent Preset UI 中配置的 MCP servers 如果没有被写入 OMP 可 discovery 的位置，OMP runtime 不会加载。
- 用户可能看到 Agent Spaces 配置中有 MCP，但 OMP 实际工具列表没有。

后续方向：

- 调研 OMP SDK 中 `mcpManager` 或 MCP config 构造 API。
- 把 Agent Spaces `mcpServers` 转换为 OMP 可用 MCP manager。
- 或在 Agent 专属 `agentDir` 中生成/合并 OMP 原生 MCP 配置。

### 5. `options.skills` 未显式覆盖

当前没有把 Agent Spaces 的 uploaded skills 映射为 OMP `Skill[]`。

风险：

- 如果 Agent Spaces skills 只存在于 `{agentDir}/skills/*.md`，但 OMP discovery 不识别该布局，则不会生效。
- UI 中启用的 skills 和 OMP 实际加载的 skills 可能不一致。

后续应确认 OMP skill discovery 支持的目录布局，并决定是转换为 OMP `Skill[]` 覆盖，还是写入 OMP 原生 skills 目录。

### 6. 上游 resume 未完整启用

adapter 本身可以 `SessionManager.open(options.resumeSessionId)`，但上游只对 `claude-code` / `codex` 判断 runtime session resume。

风险：

- 多轮聊天可能每轮创建新 OMP session。
- `runtimeSessionId` 已保存但不被下一轮使用。
- OMP 的 compaction、branch、session tree 价值无法体现。

后续需要修改上游 resume runtime kind 判断，并验证 session file path 的持久化和安全边界。

### 7. 输出 delta 粒度可能影响 UI

当前每个 `text_delta` 都作为 `output` line 推送。

风险：

- 如果 UI 假设 `output` 是按行或完整片段追加，可能出现碎片化展示。
- 最终 `output` 中会同时包含 delta 和最终文本，可能重复。

后续应确认 Agent Spaces message part 聚合逻辑，必要时改为：

- streaming 时只发 `onEvent({ type: 'output', line: delta })`
- `AgentRunResult.output` 中只保留最终文本
- 或新增更明确的 streaming text event

### 8. Usage/cost 未接入

当前 `AgentRunResult` 没有填充：

- `usage`
- `costUsd`

风险：

- Agent usage dashboard 无法统计 Oh My Pi runtime 的 token 和费用。
- 和 Claude Code / Codex 的 usage 行为不一致。

后续应从 OMP `agent_end`、message metadata 或 session usage stats 中提取 token usage。

### 9. Tool result 文本化较粗糙

当前 custom tool 返回：

```ts
{ content: [{ type: 'text', text: JSON.stringify(result) }] }
```

风险：

- 复杂结果缺少结构化 details。
- 大结果没有截断策略。
- Error result 和 normal result 没有清晰区分。

后续应按 OMP `AgentToolResult` 推荐形状返回更完整的 content/details/isError 信息。

### 10. `maxTurns` 未映射

`AgentRunOptions.maxTurns` 当前只写日志，没有传入 OMP session。

风险：

- 用户配置的 max turns 对 Oh My Pi runtime 不生效。

后续需要确认 OMP SDK 是否支持 turn limit、recursion depth 或运行超时设置；如果没有，至少在 Agent Spaces 层加 wall-clock timeout。

## 排障

### Node server 报 `Cannot find package 'bun'`

典型错误：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'bun' imported from .../src/config/settings.ts
```

这是 OMP SDK 的 Bun-native 源码在 Node 进程中被加载导致的。全局 `bun install -g @oh-my-pi/pi-coding-agent` 不能解决这个问题，因为 Node 不会把 Bun runtime 的内置模块当成 npm 包解析。

处理方式：

1. 如果要进程内嵌 SDK，使用 Bun 运行 Agent Spaces server。
2. 如果 Agent Spaces server 必须继续使用 Node，当前应改走 OMP CLI/RPC 模式，而不是 SDK embed。
3. 不建议在 Node 项目里手写 `bun` shim；OMP 使用的 `Bun.file`、`Bun.write`、`Bun.Glob`、`Bun.spawn`、`Bun.sleep`、`Bun.hash`、`Bun.YAML` 等能力较多，shim 成本和行为风险都高。

### 没有可用模型

检查：

```bash
omp
```

或检查：

```text
~/.omp/agent/config.yml
~/.omp/agent/agent.db
```

如果希望完全由 Agent Spaces preset 驱动，确认 preset 中同时配置了：

- model provider
- model id
- API base
- API key

### MCP 工具没有出现

先检查 OMP 原生环境是否能 discovery 到 MCP：

```bash
omp
```

如果 OMP CLI 能看到，但 Agent Spaces Oh My Pi runtime 看不到，重点检查 runtime 传入的 `cwd` 和 `agentDir` 是否和 CLI 运行时一致。

如果 Agent Spaces UI 配置了 MCP 但 OMP 看不到，这是当前已知限制：`options.mcpServers` 尚未显式转换给 OMP。

### Agent Spaces 内置工具不可用

检查服务端日志：

```text
[oh-my-pi] starting | ... functionTools=...
```

如果 `functionTools=-`，说明上游没有把内置工具传给 runtime。需要检查 Agent preset 的 tools 是否启用，以及当前 channel/workspace 是否满足工具创建条件。

### Stop 不生效

当前 stop 调用 `session.abort()`。如果某些长任务没有停止，需要确认对应 OMP tool 是否正确消费 `AbortSignal`。

Agent Spaces custom tool wrapper 已接收 signal，但当前 `AgentFunctionTool.execute(input)` 抽象本身没有 signal 参数，因此内置工具无法响应取消。后续可扩展 `AgentFunctionTool.execute(input, { signal })`。

## 后续改进清单

1. 增加真实端到端运行验证，覆盖普通 prompt、built-in custom tool、stop、失败路径。
2. 明确 OMP session id 持久化策略，并在上游启用 `oh-my-pi` resume。
3. 把 Agent Spaces `mcpServers` 显式转换到 OMP SDK，而不是依赖 discovery。
4. 把 Agent Spaces uploaded skills 显式转换为 OMP skills。
5. 实现 `AgentFunctionTool.inputSchema` 到 OMP custom tool schema 的精确映射。
6. 从 OMP events/session stats 提取 token usage 和 cost。
7. 调整 streaming output 聚合，避免 `AgentRunResult.output` 中出现 delta 重复。
8. 给 function tool 执行链路传递 abort signal。
9. 为动态 provider 补充真实 model metadata。
10. 增加 adapter 单元测试或集成测试，至少覆盖 provider 注册、tool wrapper、event mapping、session dispose。
