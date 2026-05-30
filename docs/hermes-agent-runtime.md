# Hermes Agent Runtime

本文档说明 Agent Spaces 当前的 Hermes runtime 接入方式、配置映射、运行限制和排障步骤。

相关实现：

- `packages/server/src/adapters/hermes-runtime.ts`
- `packages/server/src/adapters/agent-runtime.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/services/agent.ts`
- `packages/shared/src/types/workspace.ts`
- `packages/web/src/components/sidebar/agent-shared.tsx`

## 当前状态

Hermes runtime 是一个 CLI 子进程适配器。Agent Spaces 不在进程内实现 Hermes agent loop，而是在运行 Agent 时启动外部 `hermes` 命令：

```bash
hermes chat -q "<prompt>" --verbose
```

如果 Agent 配置了模型、provider 或 skills，runtime 会追加对应参数：

```bash
hermes chat -q "<prompt>" --verbose --model "<modelId>" --provider "<provider>" -s "<skill>"
```

Hermes 必须由部署环境单独安装。runtime 默认通过 `hermes` 启动 CLI；也可以用 `HERMES_CLI_PATH` 指定可执行文件绝对路径。当前仓库不打包 Hermes CLI。

## Runtime 选择

`hermes` 已加入 runtime kind：

```ts
runtimeKind?: 'open-agent-sdk' | 'claude-code' | 'codex' | 'langchain' | 'hermes'
```

在 Agent Preset 中选择 Hermes 后，服务端会通过 `createAgentRuntime({ kind: 'hermes', ... })` 创建 `HermesRuntime`。

## Profile 和配置目录

Agent Spaces 为每个 Agent 使用独立运行时目录：

```text
{agentDir}/.hermes
```

启动 Hermes 时会注入：

```text
HERMES_HOME={agentDir}/.hermes
```

这样每个 Agent 可以拥有独立的 Hermes 配置、状态、skills 和会话数据库，避免共享默认 `~/.hermes` 造成串扰。

当前 runtime 会在启动前确保目录存在：

```text
{agentDir}/.hermes/
  skills/
```

## Skills 映射

Agent Spaces 的 Agent skills 位于：

```text
{agentDir}/skills/*.md
```

Hermes runtime 启动前会复制这些 Markdown 文件到：

```text
{agentDir}/.hermes/skills/*.md
```

同时会把 Agent 配置里的 skill 名称转换为 Hermes CLI 的 `-s` 参数。示例：

```text
github-pr-workflow.md -> -s github-pr-workflow
```

注意：当前只复制 Markdown skill 文件，不支持完整 skill 目录里的额外 assets/scripts。

## 模型和凭据

当前映射：

| Agent Spaces 字段 | Hermes runtime 行为 |
| --- | --- |
| `modelId` | 传给 `hermes chat --model` |
| `modelProvider` | 传给 `hermes chat --provider` |
| `apiKey` | 注入 `HERMES_API_KEY`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY` |
| `apiBase` | 注入 `HERMES_BASE_URL`、`OPENAI_BASE_URL` |

没有把 `apiBase` 作为 CLI 参数传入，因为当前 Hermes CLI 示例没有稳定记录 `chat --base-url` 参数。自定义 endpoint 是否生效取决于 Hermes 当前版本对环境变量和 provider 配置的支持。

对于复杂 provider 配置，优先在该 Agent 的 Hermes home 中维护原生配置：

```text
{agentDir}/.hermes/config.yaml
{agentDir}/.hermes/.env
```

## 输出和事件

Hermes runtime 当前以文本流方式消费 stdout/stderr，并在服务端做轻量分类：

- 默认使用 `hermes chat --verbose`，从全量文本输出中匹配提取工具调用、usage 和 reasoning，同时过滤 Hermes 初始化、profile、API key、prompt echo 等噪声，避免它们进入最终 AI message。
- stdout 中的普通回复文本会作为 `output` runtime event 推送到 UI。
- stdout/stderr 中匹配 `Tool call: <name> with args: <json>` 的日志会映射为结构化 `tool_use` event，用于前端 chain 和工具调用数量展示。
- stderr 中匹配 `API call ... in=<n> out=<n> total=<n> cache=<n>/<n>` 或 `Token usage: prompt=<n>, completion=<n>, total=<n>` 的日志会映射为 `[Usage] ...` 输出，用于 token context 展示；同一轮只保留第一条完整 usage。
- 其它 stderr 诊断日志默认不推送到 UI，避免被提取为 assistant 文本。
- 输出中的 ANSI 颜色码会被移除。
- 如果输出行中出现 `Session: <id>` 或 `session id: <id>` 形式，会尝试提取 `sessionId`。

当前还不会生成结构化的 `tool_result` 事件，因为 Hermes 文本日志没有稳定的工具结果边界。后续如果 Hermes 提供稳定 JSONL 或事件流，可以再映射到完整的 `AgentRuntimeEvent`。

## Stop 行为

`HermesRuntime.stop()` 会调用 `child.kill()` 终止当前 Hermes 子进程。

这只负责终止 Agent Spaces 启动的 Hermes CLI 进程。Hermes 内部如果启动了额外后台任务，其清理由 Hermes 自身负责。

## 当前不支持或未完全支持

### MCP 自动注入

Agent Spaces 的 `mcpServers` 当前没有自动写入 Hermes `config.yaml`。

原因是 Hermes 的 MCP/provider/tool 配置形状应优先保持原生格式，避免用不完整转换写坏 profile。当前建议在 `{agentDir}/.hermes/config.yaml` 中维护 Hermes 原生 MCP 配置。

### Agent Spaces 内置 function tools

Agent Spaces 的内置 function tools 不能直接传给 Hermes CLI。

后续推荐方向是把这些工具暴露为 MCP server，再由 Hermes profile 配置 MCP server 使用。

### 精确 chain trace

当前依赖 Hermes CLI 文本日志的模式匹配，只能提取已知格式的 tool call 和 usage。UI 不能像 Codex runtime 那样拿到结构化 command、file change、MCP call 等完整事件。

### Session resume

Agent Spaces 当前只对 `claude-code` 和 `codex` 使用 runtime session resume 特殊逻辑。Hermes runtime 尚未接入 `--resume` / `--continue`，避免在 session id 解析未稳定前误恢复错误会话。

## 排障

### `Hermes CLI was not found`

确认 server 运行环境能找到 Hermes：

```bash
hermes --help
hermes chat --help
```

如果 shell 中可用但服务端不可用，检查启动服务端的用户、PATH 和虚拟环境。

Windows 上如果 `where hermes` 返回：

```text
C:\Users\Administrator\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe
```

但服务端仍报找不到 CLI，通常是服务进程没有继承交互 shell 的 PATH。当前 runtime 会额外尝试以下解析顺序：

1. `HERMES_CLI_PATH` 环境变量。
2. server 进程 PATH 中的 `hermes.exe`。
3. `%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe`。
4. `%USERPROFILE%\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe`。

如果安装位置不在上述路径，给服务端进程设置：

```powershell
$env:HERMES_CLI_PATH = "C:\Users\Administrator\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe"
```

### 模型或 provider 不生效

检查运行日志中的 Hermes 启动行：

```text
[hermes] starting | cwd=... model=... provider=... hermesHome=...
```

然后检查：

1. Agent Preset 的 `modelId` 和 `modelProvider` 是否保存正确。
2. `{agentDir}/.hermes/config.yaml` 是否覆盖了 CLI 参数。
3. `{agentDir}/.hermes/.env` 或服务端环境变量中是否有正确 API key。
4. 当前 Hermes 版本是否支持所选 provider。

### Skills 未加载

检查：

```text
{agentDir}/skills/
{agentDir}/.hermes/skills/
```

runtime 每次启动会重建 `.hermes/skills`，因此不要把手工维护的唯一副本只放在 `.hermes/skills` 中。需要长期保存的 skill 应放在 Agent Spaces 的 Agent skill 配置中。

### 自定义 API Base 不生效

当前 runtime 只注入：

```text
HERMES_BASE_URL
OPENAI_BASE_URL
```

如果 Hermes 当前版本不读取这些变量，应改为在 `{agentDir}/.hermes/config.yaml` 中配置原生 provider，或在后续实现中补充明确的 Hermes provider config 写入逻辑。

## 最小验证

构建验证：

```bash
pnpm --filter @agent-spaces/shared build
pnpm --filter @agent-spaces/server build
pnpm --filter @agent-spaces/web build
```

运行验证：

1. 安装 Hermes，并确认 `hermes --help` 可用。
2. 创建或更新一个 Agent Preset，选择 `Hermes` runtime。
3. 配置可用的 `modelId`、`modelProvider` 和 API key。
4. 运行一次普通聊天任务。
5. 检查服务端日志是否出现 `[hermes] starting` 和 `[hermes] done`。
6. 检查 UI 最终 AI message 不包含 Hermes 初始化、API key、prompt echo、runtime configuration、stderr debug 日志。
7. 如果触发 Hermes 工具调用，检查 UI chain 中是否出现工具项，并且工具调用数量随 `Tool call: ...` 日志增加。

## 后续改进方向

1. 增加 Hermes 原生 `config.yaml` 生成或合并逻辑，覆盖 provider、MCP、tools、approvals 等配置。
2. 接入 Hermes session resume，明确 `runtimeSessionId` 的来源和恢复语义。
3. 如果 Hermes 提供结构化输出，替换当前文本模式匹配，映射为 `tool_use`、`tool_result`、`reasoning`、`usage` 等事件。
4. 通过 MCP 桥接 Agent Spaces 内置 function tools。
5. 增加 Hermes runtime 的集成测试，至少覆盖 CLI 缺失、参数构造、skills 同步和 stop 行为。
