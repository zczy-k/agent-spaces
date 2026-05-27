# Codex Runtime 限制与解决方法

本文档记录 Agent Spaces 当前 Codex runtime 的已知限制、现有解决方法，以及后续改进方向。

相关实现：

- `packages/server/src/adapters/codex-runtime.ts`
- `packages/server/src/adapters/agent-runtime.ts`
- `packages/server/src/ws/handler.ts`

## 运行方式限制

Codex SDK 不是纯内存 agent loop。`@openai/codex-sdk` 会包装并启动 `@openai/codex` CLI，通过 stdin/stdout JSONL 事件通信。

影响：

- 运行环境必须能找到 Codex CLI 的平台二进制依赖。
- CLI 进程启动失败会直接导致 runtime 失败。
- 部署环境需要保留 `@openai/codex` 的 optional platform package。

当前解决方法：

- server 包显式依赖 `@openai/codex-sdk`，由该 SDK 解析并启动 bundled Codex CLI。
- `pnpm-lock.yaml` 锁定对应版本和平台 optional dependency。

建议：

- 部署前运行 `pnpm --filter @agent-spaces/server build` 和一次最小 Codex 调用。
- 如果部署镜像做了 dependency pruning，确认没有移除 `@openai/codex-*` optional package。

## 鉴权与配置目录

Codex CLI 默认会读取用户级配置和登录状态。服务端多 agent 场景不能直接共享默认 `~/.codex`，否则不同 agent 的会话、技能、MCP 配置可能互相污染。

当前解决方法：

- 每个 agent 使用独立 `CODEX_HOME`：

```text
{agentDir}/.codex
```

- 独立 `CODEX_HOME` 不会继承 `~/.codex/config.toml` 里的 `model_provider`、`model_providers`、`wire_api` 等 provider 配置。对自定义 Codex endpoint，runtime 会把 agent 的 `apiBase` 转成 Codex config override：

```ts
{
  model_provider: 'openai-responses',
  model_providers: {
    'openai-responses': {
      name: 'openai-responses',
      base_url: apiBase,
      wire_api: 'responses'
    }
  }
}
```

- runtime 会把 `apiKey` 写入环境变量：

```text
CODEX_API_KEY
OPENAI_API_KEY
```

- 对默认 OpenAI-compatible provider，`baseURL` 仍可通过 SDK 的 `baseUrl` 参数传入。对 agent 配置里的 `openai-responses` provider，优先使用上面的 Codex provider config，避免私有 `CODEX_HOME` 缺少全局 provider 配置时走错请求形状。

注意：

- 如果没有配置 `apiKey`，Codex 可能依赖本机 ChatGPT 登录态；这不适合稳定的 server 部署。
- 多用户部署时应优先使用 agent/provider 配置中的 API key，而不是共享机器登录态。
- 如果 `~/.codex` 可以正常运行，但 agent 私有 `.codex` 报 `SETTLEMENT_UNKNOWN_MODEL`，优先检查 agent 的 `modelId` 是否在当前 endpoint 计费侧支持，以及 runtime 是否传入了和全局配置等价的 `model_provider/model_providers.*.wire_api`。

## maxTurns 不对等

Claude Code runtime 支持 `maxTurns`。当前 Codex SDK 的 `ThreadOptions`/`TurnOptions` 没有暴露等价的 `maxTurns` 参数。

影响：

- `AgentRunOptions.maxTurns` 当前只能用于日志展示，不能真正限制 Codex 的内部回合数。
- 长任务可能比预期运行更久。

当前解决方法：

- 使用 `AbortController` 实现 `stop()`，用户停止运行时会中断 Codex 子进程。
- 通过 prompt 和系统提示约束 agent 尽快完成。

建议：

- 后续增加服务端运行超时，例如 channel run 级别的 wall-clock timeout。
- 跟进 Codex SDK 是否新增 max turns 或相关 config override，再接入 `AgentRunOptions.maxTurns`。

## Skills 格式不一致

Agent Spaces 当前保存 uploaded skills 为：

```text
{agentDir}/skills/*.md
```

Codex 可发现 skill 的布局是：

```text
{CODEX_HOME}/skills/{skillName}/SKILL.md
```

并且通常需要 frontmatter 描述。

当前解决方法：

- runtime 启动前会把 agent markdown skills 转换到 Codex 目录：

```text
{agentDir}/.codex/skills/{skillName}/SKILL.md
```

- 如果原 markdown 没有 frontmatter，会自动补齐：

```yaml
---
name: skill-name
description: skill-name
---
```

- 通过 Codex config override 传入：

```ts
skills: { enabled: skillNames }
```

注意：

- Codex 的 skill 触发机制和 Claude Code 不完全一致。即使 skill 出现在可用列表里，模型是否使用仍取决于 Codex 的 skill 注入和触发规则。
- 当前 UI 上传的是 markdown 文件，不支持 Codex 原生 skill 目录里的额外 assets/scripts。

建议：

- 如果需要复杂 Codex skill，后续扩展上传格式，支持完整 skill 目录。
- 对需要强制遵守的规则，仍应写入 agent `systemPrompt`，不要只依赖 skill 自动触发。

## MCP 配置形状不同

Claude Code runtime 可直接接收 SDK 的 `mcpServers`。Codex CLI 使用配置键：

```toml
[mcp_servers.<name>]
```

当前解决方法：

- runtime 将 Agent Spaces 的 `mcpServers` 转换为 Codex config override：

```ts
{
  mcp_servers: {
    name: {
      command,
      args,
      env
    }
  }
}
```

HTTP MCP 会映射：

```ts
{
  url,
  headers,
  bearer_token_env_var
}
```

注意：

- 非标准字段会尽量原样传给 Codex，但是否生效取决于 Codex CLI 当前版本。
- `bearerTokenEnvVar` 会转换为 Codex 使用的 `bearer_token_env_var`。

建议：

- 新增 MCP 类型时，先用 `codex mcp add` 或 `codex debug prompt-input --config ...` 验证 Codex CLI 是否接受该配置。
- 对重要 MCP server 保留一份 Codex 原生 TOML 示例，便于排查配置差异。

## 内置 function tools

Agent Spaces 的内置工具（例如 `ListDatabases`、`ListDatabaseNodes`、`ViewKanbanBoard`）不是 agent 配置里的外部 MCP server，而是服务端内存中的 `AgentFunctionTool`。Claude Code runtime 可以用进程内 SDK MCP server 直接暴露这些工具；Codex CLI 只能通过 MCP 配置连接真实 MCP server。

当前解决方法：

- 当 `AgentRunOptions.functionTools` 非空时，Codex runtime 会为本次运行启动一个短生命周期的本地 Streamable HTTP MCP server：

```text
http://127.0.0.1:{randomPort}/mcp
```

- 该 server 名为 `agent-spaces`，并注册到 Codex config override：

```ts
{
  mcp_servers: {
    'agent-spaces': {
      url: 'http://127.0.0.1:{randomPort}/mcp'
    }
  }
}
```

- `tools/list` 原样返回每个 `AgentFunctionTool.inputSchema`。
- `tools/call` 在当前 server 进程中执行对应的 `AgentFunctionTool.execute(input)`，并把 JSON 结果返回给 Codex。
- Codex run 结束、失败或被中断后，runtime 会关闭这个本地 MCP server。

注意：

- 这只桥接当前运行传入的 `functionTools`，不会把 Agent Spaces 内置工具写入 agent 的持久 MCP 配置。
- 如果同名外部 MCP server 已经使用 `agent-spaces`，当前内置工具 bridge 会覆盖该名称，行为与 Claude Code runtime 的内置 `agent-spaces` server 对齐。
- 本地 bridge 只监听 `127.0.0.1`，用于 Codex 子进程回连当前 server 进程。
- 如果日志里 `functionTools=-`，说明上游没有把内置工具传入 runtime，Codex 仍然无法调用 `ListDatabases`。

## 事件模型不同

Claude Code runtime 输出的是 Claude SDK message。Codex SDK 输出的是 `ThreadEvent`，主要 item 类型包括：

- `command_execution`
- `file_change`
- `mcp_tool_call`
- `agent_message`
- `reasoning`
- `web_search`
- `todo_list`
- `error`

Agent Spaces UI 当前消费的是通用 runtime 事件：

- `output`
- `tool_use`
- `tool_result`

当前解决方法：

- runtime 将 Codex item 映射为现有事件：
  - `command_execution` -> `Tool: Bash`
  - `mcp_tool_call` -> `Tool: server.tool`
  - `web_search` -> `Tool: WebSearch`
  - `file_change` -> `Tool: ApplyPatch`
- reasoning 和 usage 行加上 bracket 前缀：

```text
[Reasoning] ...
[Usage] ...
```

- `ws/handler.ts` 将 `Codex initialized` 识别为 tool-like line，避免被当成最终回答。

注意：

- Codex 的文件变更事件只给变更摘要，不等同于完整 diff。
- command 输出通过 `tool_result` 保存到工具详情，不一定作为普通 output 行逐字流式展示。

建议：

- 后续扩展 `AgentRuntimeEvent`，增加原生 `file_change`、`usage`、`reasoning` 类型，减少字符串解析。
- UI 侧可以针对 Codex item 类型做专门渲染，而不是全部压成 `Tool:` 行。

## 沙箱与权限不完全等价

Claude/OpenAgent 的 `permissionMode` 和 Codex 的 `sandboxMode`/`approvalPolicy` 不是一一对应。

当前映射：

| Agent permissionMode | Codex sandboxMode | Codex approvalPolicy |
| --- | --- | --- |
| `plan` | `read-only` | `untrusted` |
| `default` / `acceptEdits` / `auto` | `workspace-write` | `on-request` |
| 其他或未设置 | `danger-full-access` | `never` |

注意：

- 当前默认偏向对齐既有 `bypassPermissions` 的自动执行体验。
- `danger-full-access` 适合外部已经做隔离的环境；不适合无隔离的多租户部署。

建议：

- 多用户或生产环境应显式配置更保守的权限模式。
- 后续在 UI 中暴露 Codex 专用 sandbox/approval 配置，而不是只复用 `permissionMode`。

## Git 仓库检查

Codex 默认要求工作目录是 Git 仓库。Agent Spaces 的 agent 工作目录可能是 `.agentspace/agents/{agentId}`，不一定是 Git repo。

当前解决方法：

- runtime 调用 `startThread()` 时设置：

```ts
skipGitRepoCheck: true
```

注意：

- 跳过 Git 检查后，Codex 仍可以工作，但某些依赖 Git 状态的行为可能不完整。

建议：

- 对代码执行类 agent，优先把 `workingDir` 指向真实项目仓库或 `/workspace` 映射目录。

## Web Search 与网络访问

当前 runtime 默认打开：

```ts
networkAccessEnabled: true
webSearchMode: 'live'
```

影响：

- Codex 可以使用实时 web search。
- 在无网络或受限部署环境中，相关调用可能失败。

建议：

- 后续把 web search/network access 变成 agent 配置项。
- 离线部署时应关闭 live web search，并在 system prompt 中说明不可联网。

## 输出去重与最终答案提取

Codex 的同一个 item 可能经历 started/updated/completed 多个阶段。直接把每个阶段都当 output 会导致 UI 重复。

当前解决方法：

- runtime 用 `emittedItemLines` 对相同行去重。
- 工具调用通过 `tool_use` 推给 UI，不再重复作为普通 `output` 推送。
- 最终 summary 优先使用 `agent_message` 的文本。

注意：

- 如果同一文本在不同阶段确实需要重复展示，当前去重会合并它们。
- 这是为了适配现有 UI 的折中方案。

建议：

- 后续基于 item id 更新同一个 UI 节点，而不是按行追加。

## 排障清单

Codex agent 运行失败时，优先检查：

1. `@openai/codex-sdk` 和 `@openai/codex` 是否已安装。
2. 平台 optional binary 是否存在。
3. agent 是否配置了可用 API key。
4. `CODEX_HOME` 下是否生成了期望的 `skills/`。
5. MCP 配置是否符合 Codex `mcp_servers` 结构。
6. 需要调用 Agent Spaces 内置工具时，日志中是否出现 `functionTools=...` 和 `function tool bridge started`。
7. 工作目录是否存在，是否需要指向真实 Git repo。
8. 日志中 `[codex] failed ...` 的 stderr/错误内容。

最小验证命令：

```bash
pnpm --filter @agent-spaces/server build
node_modules/.bin/codex exec --help
```
