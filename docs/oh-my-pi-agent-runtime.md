# Oh My Pi Agent Runtime

本文档记录 Agent Spaces 当前 `oh-my-pi` runtime 的实现程度、CLI 映射、已验证行为、已知限制和后续需要处理的问题。

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

当前 runtime 通过 `omp` CLI 运行，不再进程内嵌 `@oh-my-pi/pi-coding-agent` SDK：

```bash
omp --mode json -p "<prompt>"
```

选择 CLI process boundary 的原因是当前发布的 `@oh-my-pi/pi-coding-agent@15.5.12` 是 Bun-native 包：

- `package.json` 中 `exports.import` 指向 `./src/index.ts`。
- 源码直接使用 `Bun.*`。
- 多处源码直接 `import { YAML } from "bun"` 或 `import { $ } from "bun"`。
- `engines` 声明为 `bun >= 1.3.14`。

Agent Spaces server 默认运行在 Node 下，不能安全 import 该 SDK。现在 adapter 只启动 `omp` 子进程，把 OMP newline-delimited JSON events 映射回 Agent Spaces runtime event，并通过 `child.kill()` 实现 stop。

## CLI 调用形态

基础调用：

```bash
omp --mode json -p "<final prompt>"
```

其中 `<final prompt>` 是 Agent Spaces 组装后的完整 prompt，并已通过 `appendOutputStyleToPrompt()` 追加 output style。

如果配置了 runtime session resume：

```bash
omp --mode json --resume <runtimeSessionId> -p "<final prompt>"
```

如果 Agent Spaces preset 提供模型、provider、thinking、tools、system prompt、skills 等配置，会追加对应 CLI flags。

## 配置映射

### CLI 可执行查找

默认命令为 `omp`。Windows 下为避免 server 进程没有继承最新 PATH 导致 `spawn('omp')` ENOENT，adapter 会按以下顺序解析可执行文件：

1. `OMP_CLI_PATH`
2. 当前进程 PATH 中的 `omp.exe`
3. `%LOCALAPPDATA%/omp/omp.exe`
4. `%USERPROFILE%/AppData/Local/omp/omp.exe`
5. 回退到 `omp`

如果手动 shell 中 `where omp` 能找到，但 Agent Spaces server 仍报找不到，可以显式设置：

```powershell
$env:OMP_CLI_PATH="C:/Users/Administrator/AppData/Local/omp/omp.exe"
```

再启动 server。

### 工作目录

Agent Spaces 传入的 `workingDir` 会作为 `spawn('omp', args, { cwd })` 的工作目录。

如果上游没有传入 `workingDir`，fallback 为当前 server 进程的 `process.cwd()`。

### OMP 配置目录

Agent Spaces 的 `options.configDir` 当前会生成一个隔离的 OMP home：

```text
<configDir>/omp-home/.omp/agent/config.yml
<configDir>/omp-home/.omp/agent/models.yml
<configDir>/omp-home/.omp/agent/sessions/
```

spawn `omp` 时会设置：

```text
HOME=<configDir>/omp-home
USERPROFILE=<configDir>/omp-home
PI_AGENT_DIR=<configDir>/omp-home/.omp/agent
OMP_AGENT_DIR=<configDir>/omp-home/.omp/agent
PI_CODING_AGENT_DIR=<configDir>/omp-home/.omp/agent
OMP_LOG_DIR=<configDir>/omp-home/.omp/agent/logs
```

Windows 下还会在隔离运行时清空 `HOMEDRIVE` / `HOMEPATH`，避免 OMP 或依赖库把 `~/.omp/agent` 解析回真实用户目录。实际验证中，`omp config path` 会优先使用 `PI_CODING_AGENT_DIR` 指向的 agent 目录。

同时 session lookup/storage 会传入：

```bash
--session-dir <configDir>/omp-home/.omp/agent/sessions
```

这使每个 Agent 可以使用独立 OMP config、model registry 和 session 目录，不污染用户真实 `~/.omp/agent`。

如果 `configDir` 未传入，OMP CLI 会按自身默认规则使用 `~/.omp/agent` 等默认位置。

### 模型和 provider

当前直接映射到 CLI：

| Agent Spaces config | OMP CLI |
| --- | --- |
| `model` | `--model <id>` |
| `provider` | `--provider <name>` |
| `apiKey` | `--api-key <key>` |

`--api-key` 按 OMP CLI 语义只对本次运行生效，不持久化。

与旧 SDK embed 方案不同，当前不再调用 `ModelRegistry`，也不再动态 `registerProvider()`。模型发现、provider registry、provider auth resolution 都交给 OMP CLI 处理。

当 `model + baseURL` 存在时，adapter 会写入 `<configDir>/omp-home/.omp/agent/models.yml`：

```yaml
providers:
  <provider-id>:
    baseUrl: "<api base>"
    api: "<omp api>"
    apiKey: "AGENT_SPACES_OMP_API_KEY"
    models:
      - id: "<model id>"
        name: "<model id>"
        api: "<omp api>"
        reasoning: true
        input: [text]
        cost:
          input: 0
          output: 0
          cacheRead: 0
          cacheWrite: 0
        contextWindow: 128000
        maxTokens: 16384
```

`AGENT_SPACES_OMP_API_KEY` 只存在于本次子进程环境中，真实 key 不写入 yaml。

### API base 和环境变量

OMP CLI reference 没有提供通用 `--api-base` flag，因此 `baseURL` 当前通过常见 provider 环境变量传入：

```text
OPENAI_BASE_URL=<baseURL>
ANTHROPIC_BASE_URL=<baseURL>
```

`apiKey` 也会作为以下环境变量传入，供 OMP/provider fallback 使用：

```text
AGENT_SPACES_OMP_API_KEY=<apiKey>
PI_API_KEY=<apiKey>
OMP_API_KEY=<apiKey>
OPENAI_API_KEY=<apiKey>       # 非 anthropic-messages provider 时
ANTHROPIC_API_KEY=<apiKey>    # anthropic-messages provider 时
```

最终优先级仍以 OMP CLI 为准：CLI flag > env var > `~/.omp/agent/config.yml` > built-in default。

### Thinking level

当前映射：

| Agent Spaces config | OMP CLI |
| --- | --- |
| `thinkingEnabled === false` | `--thinking off` |
| `thinkingEffort: low` | `--thinking low` |
| `thinkingEffort: medium` 或未设置 | `--thinking medium` |
| `thinkingEffort: high` | `--thinking high` |

Agent Spaces 当前没有 `minimal` / `xhigh` 字段，因此未暴露这两个 OMP selector。

### System prompt 和 output style

`options.systemPrompt` 会映射为：

```bash
--system-prompt "<system prompt>"
```

`outputStyle` 沿用现有 Agent Spaces helper，通过 `appendOutputStyleToPrompt()` 追加到用户 prompt。

### Built-in tools allowlist

Agent Spaces 的 `options.tools` 会映射为：

```bash
--tools "<tool-a>,<tool-b>"
```

如果没有传入 `options.tools`，不传 `--tools`，由 OMP CLI 使用默认工具策略。

### Skills

Agent Spaces 的 `options.skills` 当前直接映射为：

```bash
--skills "<pattern-a>,<pattern-b>"
```

这符合 OMP CLI 的 run-scoped skill filtering 语义。实际 skill discovery 仍由 OMP CLI 决定。

当使用 Agent Spaces 隔离配置目录时，adapter 会同步：

```text
<configDir>/skills/
  -> <configDir>/omp-home/.omp/agent/skills/
```

目录型技能会保留为 `skills/<name>/SKILL.md`，旧的 flat `<name>.md` 技能会转换为 `skills/<name>/SKILL.md`，并保留一份 flat `.md` 兼容副本。每次运行都会重建 OMP home 内的 `skills/`，避免已解绑技能继续被 OMP discovery 扫到。

## 事件映射

当前使用 `--mode json`，从 OMP newline-delimited JSON events 中恢复结构化事件。stdout 中不能解析为 JSON 的普通文本行仍按 text fallback 处理。

### 基础输出和生命周期

- OMP JSON event 会写调试摘要日志：`[oh-my-pi] json event | type=<type> keys=<keys> contentBlocks=<block-types>`。
- stderr 按行加 `[stderr] ` 前缀后推送为 `{ type: 'output', line }`。
- 退出码 `0` 视为成功。
- 非 `0` 退出码或进程 signal 视为失败。
- JSON 中的 `sessionId` / `session_id` / `conversation_id` / `thread_id` 会推送 `{ type: 'session', sessionId }`。
- JSON 中的 `usage` / `costUsd` / `total_cost_usd` 会写入 `AgentRunResult.usage` / `AgentRunResult.costUsd`。

### 用户可见输出

为避免 OMP 增量事件污染用户消息，adapter 只从最终 `turn_end` 的可见文本生成 `{ type: 'output', line }` 和 `AgentRunResult.output`。

以下内容不会进入最终用户展示：

- `message_start`
- `message_update`
- `message_end`
- 工具结果回显消息
- `<think>...</think>` 推理片段
- 带 `toolCall` block 的中间 `turn_end`

这可以避免类似工具失败文本、prompt echo、thinking 流式片段反复出现在最终消息里。

### Reasoning

以下 content block 会映射为 `{ type: 'reasoning', text, status: 'completed' }`：

- `type: "reasoning"`
- `type: "thinking"`

### 工具调用

OMP 真实工具生命周期事件主要是：

```text
tool_execution_start
tool_execution_end
```

adapter 映射为：

| OMP JSON event | Agent Spaces runtime event |
| --- | --- |
| `tool_execution_start` | `{ type: 'tool_use', id, name, input, line }` |
| `tool_execution_end` | `{ type: 'tool_result', toolUseId, result }` |

字段映射：

| OMP field | Agent Spaces field |
| --- | --- |
| `toolCallId` | `id` / `toolUseId` |
| `toolName` | `name` |
| `args` | `input` |
| `result` | `result` |

`message_start` / `message_update` / `message_end` 中的 `toolCall` block 只用于结构观察，不会触发正式 `tool_use`。原因是这些增量事件中的工具参数可能还是 `{}` 或半成品；完整参数以 `tool_execution_start.args` 为准。

为了兼容 Agent Spaces 现有工具链 UI，`tool_use.line` 使用：

```text
Tool: <tool-name> <json-input>
```

该格式会被 `message-parts.ts` 识别为工具 chain，从而在前端展示工具步骤和工具计数。

adapter 会按 `toolCallId + toolName` 去重 `tool_use`，按 `toolUseId + result summary` 去重 `tool_result`，避免 OMP 增量 message update 重复触发工具步骤。

## Agent Spaces function tools

当前 CLI mode 没有直接把 `AgentRunOptions.functionTools` 转换成 OMP `CustomTool[]`，因为 `CustomTool[]` 是 SDK embed API，不是 CLI API。

adapter 会复用 Agent Spaces 的本地 Streamable HTTP MCP bridge：

1. 当 `options.functionTools` 非空时，启动短生命周期本地 MCP server。
2. server 名称固定为 `agent-spaces`。
3. 写入 `<configDir>/omp-home/.omp/agent/mcp.json`。
4. OMP CLI 通过原生 MCP discovery 调用这些工具。

写入形态：

```json
{
  "mcpServers": {
    "agent-spaces": {
      "url": "http://127.0.0.1:<port>/mcp",
      "type": "http"
    }
  }
}
```

MCP server 的 `tools/list` 返回裸工具名，例如 `ListDatabaseNodes`。OMP 作为 MCP client 会把 server 名和工具名合成为模型侧可调用名，例如：

```text
mcp__agent-spaces__ListDatabaseNodes
```

bridge 的 `tools/call` 兼容裸工具名和 `mcp__agent-spaces__<ToolName>` 两种入参，最终都会映射回同一个 `AgentFunctionTool` 执行。

run 结束、失败或 stop 后，adapter 会关闭该本地 MCP server。

## MCP、extensions、skills、rules

OMP CLI 会按自身 discovery 规则加载配置中的 MCP servers、extensions、skills、rules、prompt templates 等。

当前 adapter 的显式映射和生成配置包括：

```bash
--tools <a,b,...>
--skills <p1,p2,...>
--session-dir <configDir>/omp-home/.omp/agent/sessions
```

```text
HOME=<configDir>/omp-home
USERPROFILE=<configDir>/omp-home
PI_CODING_AGENT_DIR=<configDir>/omp-home/.omp/agent
OMP_LOG_DIR=<configDir>/omp-home/.omp/agent/logs
<configDir>/omp-home/.omp/agent/config.yml
<configDir>/omp-home/.omp/agent/models.yml
<configDir>/omp-home/.omp/agent/mcp.json
```

`options.mcpServers` 会和 Agent Spaces function tool bridge 合并写入 `mcp.json`。如果外部 MCP server 也命名为 `agent-spaces`，当前内置 bridge 会覆盖该名称，以保持与 Claude Code / Codex runtime 的内置工具命名一致。

## Resume 行为

adapter 支持把 `options.resumeSessionId` 映射为：

```bash
--resume <runtimeSessionId>
```

但上游 `agent-runner` 目前只对 `claude-code` 和 `codex` 启用 runtime session resume 特殊逻辑。因此 `oh-my-pi` 的 resume 能力还没有完整接入产品流程。

后续如果要启用，需要同步修改上游判断逻辑，并确认：

- `runtimeSessionId` 应保存 session file path 还是短 session id prefix。
- 多工作区/多 Agent 下 session file path 是否可安全持久化。
- `--fork <message-id>` 是否需要暴露到 Agent Spaces UI。
- `--session-dir <dir>` 与 OMP 默认 session lookup 的关系是否符合预期。

## Stop 和生命周期

`OhMyPiRuntime.stop()` 当前调用：

```ts
child.kill()
```

这会向 `omp` 子进程发送默认 signal。实际停止速度取决于 OMP CLI 和其下游工具是否及时响应进程终止。

## 已验证内容

已执行：

```bash
pnpm exec tsx --test "packages/server/test/oh-my-pi-runtime.test.ts"
pnpm --filter @agent-spaces/server build
```

这些命令通过。

当前 `oh-my-pi-runtime.test.ts` 覆盖：

- CLI args 映射，包括 `--mode json`、model、provider、apiKey、thinking、tools、system prompt、skills、session-dir、resume。
- 隔离 OMP home 下的 `config.yml` / `models.yml` / `mcp.json` 写入。
- 环境变量映射，包括 API key、baseURL、OMP agent dir、`USERPROFILE`、`OMP_LOG_DIR` 和 Windows home fallback 隔离。
- Windows `omp.exe` 查找 fallback。
- stdout/stderr fallback、session id 解析、失败退出码。
- OMP JSON mode 的 `session`、`reasoning`、`tool_execution_start`、`tool_execution_end`、`usage/cost` 映射。
- 只展示最终 `turn_end` 可见输出，忽略中间 message/tool echo。
- MCP bridge、stop、ENOENT。

另有 `codex-function-tool-bridge.test.ts` 覆盖本地 Streamable HTTP MCP bridge：

- `tools/list` 暴露标准 MCP 裸工具名。
- `tools/call` 能接受 `mcp__agent-spaces__<ToolName>` 前缀名并执行对应 `AgentFunctionTool`。

此前也执行过：

```bash
pnpm --filter @agent-spaces/shared build
NEXT_STATIC_EXPORT=1 pnpm --filter @agent-spaces/web build
```

shared build 通过。web build 进入 TypeScript 阶段后失败，失败点是既有无关文件：

```text
packages/web/src/app/login/rotating-text.tsx:78
Type '{ delay: number; }' is not assignable to type 'string | number'.
```

因此当前无法用完整 web build 证明前端整体无类型错误，但 `oh-my-pi` adapter 的 server TypeScript build 已通过。

## 当前限制和问题

### 1. 依赖本机可执行 `omp`

当前实现要求 server 运行环境中能找到 `omp`。Windows 下会额外尝试常见 `%LOCALAPPDATA%/omp/omp.exe` 安装路径。

如果不存在，会返回：

```text
Oh My Pi CLI was not found. Install OMP and ensure the `omp` command is available on PATH.
```

### 2. JSON event schema 需要继续按真实 OMP 输出校准

当前已经消费 `--mode json` 的常见事件，并覆盖真实观察到的：

- `session`
- `agent_start`
- `turn_start`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_end`
- `turn_end`
- `agent_end`

但 OMP 后续版本可能调整 JSON event 字段名。排障时重点看 server 日志：

```text
[oh-my-pi] json event | type=<type> keys=<keys> contentBlocks=<block-types>
[oh-my-pi] tool use | id=<id> name=<name> input=<summary>
[oh-my-pi] tool result | id=<id> result=<summary>
```

如果工具步骤没有进入前端，优先确认是否出现 `tool use` 日志，以及传给 UI 的工具行是否为 `Tool: <name> ...`。

### 3. MCP discovery 仍依赖 OMP 原生加载

adapter 已把 `options.mcpServers` 和 Agent Spaces function tool bridge 写入 `mcp.json`，但最终是否加载仍取决于 OMP CLI 的原生 discovery。

排障重点：

- `<configDir>/omp-home/.omp/agent/mcp.json` 是否存在。
- server 日志是否出现 `wrote MCP config | path=... servers=...`，确认写入的是隔离 agent 目录。
- server 日志是否出现 `function tool bridge started`。
- server 日志是否出现 `function tool bridge request | method=POST path=/mcp`。如果没有，说明 OMP 没有连接到本地 bridge，问题在 MCP discovery/config path，而不是工具执行。
- OMP CLI 是否读取 `PI_CODING_AGENT_DIR=<configDir>/omp-home/.omp/agent` 下的 user-level config。
- `<configDir>/omp-home/.omp/agent/logs/` 下的 OMP 日志是否有 `agent-spaces` MCP 加载错误。

### 4. `baseURL` 通过 models.yml 写入

OMP CLI reference 没有通用 `--api-base` flag。当前 adapter 会在 `models.yml` 写入 provider `baseUrl`，同时继续传 `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` 作为兼容 fallback。

### 5. 上游 resume 未完整启用

adapter 本身可以传 `--resume`，但上游只对 `claude-code` / `codex` 判断 runtime session resume。

风险：

- 多轮聊天可能每轮创建新 OMP session。
- `runtimeSessionId` 即使被解析保存，也可能不被下一轮使用。

### 7. `maxTurns` 未映射

OMP CLI reference 中没有 `max turns` flag。`AgentRunOptions.maxTurns` 当前只写日志。

后续需要确认 OMP 是否有等价配置；如果没有，至少在 Agent Spaces 层加 wall-clock timeout。

## 排障

### `omp` command not found

检查：

```bash
which omp
omp --version
```

确保启动 Agent Spaces server 的 shell 环境和你手动测试 `omp` 的环境一致。

### Node server 报 `Cannot find package 'bun'`

新的 CLI adapter 不会 import `@oh-my-pi/pi-coding-agent`，正常不应再出现该错误。

如果仍出现，说明还有其他路径在 Node server 中直接 import 了 OMP SDK。应删除该 import，或改成 CLI/RPC process boundary。

### 没有可用模型

检查：

```bash
omp --list-models
```

或检查：

```text
~/.omp/agent/config.yml
~/.omp/agent/agent.db
```

如果希望完全由 Agent Spaces preset 驱动，确认 preset 中至少配置了：

- model provider
- model id
- API key

如果使用自定义 API base，还需要确认 OMP provider 支持对应 env fallback。

### MCP 工具没有出现

先检查 OMP 原生环境是否能 discovery 到 MCP：

```bash
omp
```

如果 OMP CLI 能看到，但 Agent Spaces Oh My Pi runtime 看不到，重点检查 runtime 生成的：

```text
<configDir>/omp-home/.omp/agent/mcp.json
```

以及服务端日志：

```text
[oh-my-pi] wrote MCP config | path=<configDir>/omp-home/.omp/agent/mcp.json servers=...
[oh-my-pi] function tool bridge started | url=http://127.0.0.1:<port>/mcp ...
[oh-my-pi] resolved tools | mcpServers=...,agent-spaces functionToolBridge=http://127.0.0.1:<port>/mcp
[oh-my-pi] function tool bridge request | method=POST path=/mcp
```

如果 `mcp.json` 存在且 `function tool bridge started` 正常，但没有 `function tool bridge request`，说明 OMP 没有发现或连接这个 MCP server。优先检查 `PI_CODING_AGENT_DIR`、`USERPROFILE`、`HOME` 是否都指向隔离目录，以及 OMP 日志目录下是否记录了 MCP load failed。

如果出现 `function tool bridge request`，但后续 `tool_execution_start.toolName` 仍是 `bash` / `eval`，说明模型没有把 Agent Spaces MCP 工具作为可调用工具使用，需要继续检查 OMP 传给模型的 tool schema 或 provider 对 tool calling 的支持。

### 工具调用没有显示或计数为 0

先看 server 日志是否出现：

```text
[oh-my-pi] tool use | id=... name=... input=...
[oh-my-pi] tool result | id=... result=...
```

如果没有，说明 OMP JSON event 没有被 adapter 识别，需要根据 `json event | type=... keys=... contentBlocks=...` 补事件映射。

如果有，但前端工具计数仍为 0，重点检查 `tool_use.line` 是否是现有 UI 可识别的工具行格式：

```text
Tool: <tool-name> <json-input>
```

Agent Spaces 的工具 chain 构建依赖该格式被 `message-parts.ts` 的 `isToolLikeLine()` 识别。

### 工具 input 为空

不要从 `message_update` / `message_end` 的 `toolCall` block 读取最终参数；这些增量事件里的 args 可能是 `{}` 或半成品。

adapter 当前以 `tool_execution_start.args` 作为正式 `tool_use.input`。

### Stop 不生效

当前 stop 调用 `child.kill()`。如果某些长任务没有停止，需要确认 OMP CLI 和其下游 tool process 是否响应进程 signal。

## 后续改进清单

1. 增加真实端到端运行验证，覆盖普通 prompt、stop、失败路径。
2. 持续校准 `--mode json` 的真实 OMP event schema，特别是新版本工具事件、usage/cost 和 error payload。
3. 明确 OMP session id 持久化策略，并在上游启用 `oh-my-pi` resume。
4. 验证 `--session-dir <configDir>/omp-home/.omp/agent/sessions` 与 OMP session lookup 的兼容性。
5. 确认 `baseURL` 对不同 provider 的正确 env var 映射。
6. 为 `maxTurns` 增加等价 OMP 配置或 Agent Spaces wall-clock timeout。
7. 增加真实 E2E UI 验证，确认工具 chain、工具详情弹窗、失败工具结果、最终回答展示都符合预期。
