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
omp --mode text -p "<prompt>"
```

选择 CLI process boundary 的原因是当前发布的 `@oh-my-pi/pi-coding-agent@15.5.12` 是 Bun-native 包：

- `package.json` 中 `exports.import` 指向 `./src/index.ts`。
- 源码直接使用 `Bun.*`。
- 多处源码直接 `import { YAML } from "bun"` 或 `import { $ } from "bun"`。
- `engines` 声明为 `bun >= 1.3.14`。

Agent Spaces server 默认运行在 Node 下，不能安全 import 该 SDK。现在 adapter 只启动 `omp` 子进程，把 stdout/stderr 映射回 Agent Spaces runtime event，并通过 `child.kill()` 实现 stop。

## CLI 调用形态

基础调用：

```bash
omp --mode text -p "<final prompt>"
```

其中 `<final prompt>` 是 Agent Spaces 组装后的完整 prompt，并已通过 `appendOutputStyleToPrompt()` 追加 output style。

如果配置了 runtime session resume：

```bash
omp --mode text --resume <runtimeSessionId> -p "<final prompt>"
```

如果 Agent Spaces preset 提供模型、provider、thinking、tools、system prompt、skills 等配置，会追加对应 CLI flags。

## 配置映射

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
PI_AGENT_DIR=<configDir>/omp-home/.omp/agent
OMP_AGENT_DIR=<configDir>/omp-home/.omp/agent
```

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

## 事件映射

当前使用 `--mode text`，所以没有 SDK event 或 JSON event stream。映射规则是：

- stdout 按行推送为 `{ type: 'output', line }`。
- stderr 按行加 `[stderr] ` 前缀后推送为 `{ type: 'output', line }`。
- stdout/stderr 行都会进入 `AgentRunResult.output`。
- 退出码 `0` 视为成功。
- 非 `0` 退出码或进程 signal 视为失败。
- 如果输出行中匹配 `session id: ...` / `session: ...`，会推送 `{ type: 'session', sessionId }`。

当前不会从 text mode 产生结构化 `reasoning`、`tool_use`、`tool_result`、`usage`、`costUsd`。

如果后续切到 `--mode json`，可以从 OMP newline-delimited JSON events 中恢复更细粒度事件映射。

## Agent Spaces function tools

当前 CLI mode 没有直接把 `AgentRunOptions.functionTools` 转换成 OMP `CustomTool[]`。

原因：

- `CustomTool[]` 是 SDK embed API，不是 CLI text mode API。
- OMP CLI 可以通过自身 MCP discovery 加载工具，但当前 adapter 没有生成 OMP 原生 MCP config。

因此 Agent Spaces 内置 function tools 当前只会出现在日志中，不会自动注入到 OMP CLI。需要内置工具时，应优先把它们暴露为 OMP 可 discovery 的 MCP server，或后续改用 OMP RPC/ACP 协议接入。

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
<configDir>/omp-home/.omp/agent/config.yml
<configDir>/omp-home/.omp/agent/models.yml
```

当前没有把 `options.mcpServers` 转换为 OMP 原生 MCP 配置，也没有把 Agent Spaces function tools 合并进 MCP 配置。

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
pnpm --filter @agent-spaces/server build
```

该命令通过。

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

当前实现要求 server 运行环境的 `PATH` 中存在 `omp`。

如果不存在，会返回：

```text
Oh My Pi CLI was not found. Install OMP and ensure the `omp` command is available on PATH.
```

### 2. Text mode 事件粒度有限

`--mode text` 只能可靠得到 stdout/stderr 文本和退出码。

当前缺失：

- reasoning streaming event
- tool lifecycle event
- structured usage/cost
- structured session id
- structured error payload

后续可切到 `--mode json`，消费 OMP newline-delimited JSON events。

### 3. Agent Spaces function tools 未注入

当前 `options.functionTools` 只写日志，不会自动变成 OMP CLI 可用工具。

后续方向：

- 复用 Codex function tool bridge，把 Agent Spaces function tools 暴露为 MCP HTTP server。
- 在 Agent 专属配置目录中生成或合并 OMP MCP 配置。
- 或使用 OMP `--mode rpc` / `--mode acp` 接入更结构化的工具协议。

### 4. `options.mcpServers` 未显式覆盖

Agent Spaces 运行时传入的 `mcpServers` 当前只出现在日志中，没有被写入 OMP 原生配置。

风险：

- Agent Preset UI 中配置的 MCP servers 如果没有被写入 OMP 可 discovery 的位置，OMP runtime 不会加载。
- 用户可能看到 Agent Spaces 配置中有 MCP，但 OMP 实际工具列表没有。

### 5. `baseURL` 通过 models.yml 写入

OMP CLI reference 没有通用 `--api-base` flag。当前 adapter 会在 `models.yml` 写入 provider `baseUrl`，同时继续传 `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` 作为兼容 fallback。

### 6. 上游 resume 未完整启用

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

如果 OMP CLI 能看到，但 Agent Spaces Oh My Pi runtime 看不到，重点检查 runtime 传入的 `cwd`、`PI_AGENT_DIR` / `OMP_AGENT_DIR` 和 `--session-dir` 是否符合 OMP discovery 预期。

如果 Agent Spaces UI 配置了 MCP 但 OMP 看不到，这是当前已知限制：`options.mcpServers` 尚未显式转换给 OMP。

### Agent Spaces 内置工具不可用

这是当前 CLI mode 已知限制。检查服务端日志：

```text
[oh-my-pi] starting | ... functionTools=...
[oh-my-pi] function tools are not injected directly in OMP CLI mode...
```

如果必须使用 Agent Spaces 内置工具，需要先把这些工具通过 OMP 可 discovery 的 MCP 配置暴露给 `omp`。

### Stop 不生效

当前 stop 调用 `child.kill()`。如果某些长任务没有停止，需要确认 OMP CLI 和其下游 tool process 是否响应进程 signal。

## 后续改进清单

1. 增加真实端到端运行验证，覆盖普通 prompt、stop、失败路径。
2. 切到 `--mode json`，恢复 structured output、reasoning、tool lifecycle、usage/cost。
3. 复用 Agent Spaces function tool bridge，并生成 OMP 可 discovery 的 MCP 配置。
4. 把 Agent Spaces `mcpServers` 显式转换到 OMP 原生配置。
5. 明确 OMP session id 持久化策略，并在上游启用 `oh-my-pi` resume。
6. 验证 `--session-dir <configDir>/omp-home/.omp/agent/sessions` 与 OMP session lookup 的兼容性。
7. 确认 `baseURL` 对不同 provider 的正确 env var 映射。
8. 为 `maxTurns` 增加等价 OMP 配置或 Agent Spaces wall-clock timeout。
9. 增加 adapter 单元测试或集成测试，至少覆盖 CLI args、env、stdout/stderr mapping、stop、ENOENT。
