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

Hermes 必须由部署环境单独安装，并且 `hermes` 命令必须在 server 进程的 `PATH` 中可用。当前仓库不打包 Hermes CLI。

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

Hermes runtime 当前以文本流方式消费 stdout/stderr：

- stdout 行会作为普通 `output` runtime event 推送到 UI。
- stderr 行会加上 `[stderr] ` 前缀后推送。
- 输出中的 ANSI 颜色码会被移除。
- 如果输出行中出现 `Session: <id>` 或 `session id: <id>` 形式，会尝试提取 `sessionId`。

当前不会生成结构化的 `tool_use` / `tool_result` 事件。Hermes 的 `--verbose` 输出会展示工具过程，但 Agent Spaces 只把它作为文本显示。后续如果 Hermes 提供稳定 JSONL 或事件流，可以再映射到通用 `AgentRuntimeEvent`。

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

当前依赖 `--verbose` 文本输出，只能展示 Hermes CLI 打印出的过程。UI 不能像 Codex runtime 那样拿到结构化 command、file change、MCP call、usage 等事件。

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
6. 检查 UI 是否能看到 Hermes 的 verbose 文本输出。

## 后续改进方向

1. 增加 Hermes 原生 `config.yaml` 生成或合并逻辑，覆盖 provider、MCP、tools、approvals 等配置。
2. 接入 Hermes session resume，明确 `runtimeSessionId` 的来源和恢复语义。
3. 如果 Hermes 提供结构化输出，映射为 `tool_use`、`tool_result`、`reasoning`、`usage` 等事件。
4. 通过 MCP 桥接 Agent Spaces 内置 function tools。
5. 增加 Hermes runtime 的集成测试，至少覆盖 CLI 缺失、参数构造、skills 同步和 stop 行为。
