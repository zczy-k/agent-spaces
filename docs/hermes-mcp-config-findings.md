# Hermes MCP 配置问题排查记录

日期：2026-05-30

## 背景

用户日志中出现：

```text
MCP servers configured for this agent: fetch
```

但 Hermes 模型侧工具列表没有 `mcp_` 前缀工具，模型因此回答“没有找到 MCP 工具”。

这个现象说明 Agent Spaces 的 Agent 配置里有 MCP 名称 `fetch`，但不代表 Hermes CLI 已经成功加载并注册 MCP 工具。

## Hermes 官方配置要求

参考 Hermes 官方 MCP 配置文档：

```text
https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md
```

Hermes 原生配置根键是 `mcp_servers`：

```yaml
mcp_servers:
  fetch:
    command: "uvx"
    args:
      - "mcp-server-fetch"
    env:
      PYTHONIOENCODING: "utf-8"
    enabled: true
```

每个 `mcp_servers.<server_name>` 至少需要：

- stdio server: `command`
- HTTP/SSE server: `url`

Hermes 成功发现 MCP 工具后，工具名格式通常是：

```text
mcp_<server>_<tool>
```

例如：

```text
mcp_fetch_fetch
mcp_fetch_list_prompts
mcp_fetch_get_prompt
```

## 关键发现

1. `MCP servers configured for this agent: fetch` 只是 Agent Spaces prompt 里的运行配置摘要，不等同于 Hermes 已注册工具。
2. 旧实现遇到已有 `{agentDir}/.hermes/config.yaml` 且不是 Agent Spaces 托管文件时，会直接跳过写入，因此 Agent Spaces 的 MCP 配置没有进入 Hermes profile。
3. 前端选择 MCP 时可能只保存了 `{ "fetch": {} }`。这种空配置会让 prompt 显示 `fetch`，但 runtime 规范化时因缺少 `command/url` 被丢弃，Hermes 最终拿不到 `mcp_servers.fetch`。
4. Hermes 源码中的平台工具集逻辑默认会把 enabled 的 `mcp_servers` 加入 CLI 工具集；只有当 `platform_toolsets.cli` 显式列出 MCP server 名时，才会形成 MCP allowlist。因此不应为了修复该问题主动注入或改写 `platform_toolsets.cli`。
5. 本地最小验证显示，只要 Hermes profile 中存在正确的 `mcp_servers.fetch`，`hermes mcp test fetch` 可以连接成功，并能发现 `fetch` 工具。

## 已实施修复

### Hermes runtime 配置合并

文件：

```text
packages/server/src/adapters/hermes-runtime.ts
```

行为：

- Agent Spaces 托管的 Hermes config 仍整体刷新。
- 用户或 Hermes setup 生成的原生 `config.yaml` 不再直接跳过。
- runtime 只合并 Agent Spaces 管理的 `mcp_servers` 区块，并保留原有配置。
- 不改写 `platform_toolsets`，避免把 Hermes 默认 MCP 加载行为变成 allowlist。

托管区块示例：

```yaml
mcp_servers:
  # Agent Spaces managed MCP servers start
  fetch:
    command: "uvx"
    args:
      - "mcp-server-fetch"
    env:
      PYTHONIOENCODING: "utf-8"
    enabled: true
  # Agent Spaces managed MCP servers end
```

### Agent MCP 配置解析

文件：

```text
packages/server/src/services/agent.ts
```

行为：

- `getMcpServers()` 现在只返回可运行 MCP 配置。
- 如果 Agent 里保存的是旧格式空选择 `{ "fetch": {} }`，服务端会从全局 MCP 库读取：

```text
{dataDir}/mcps/fetch.json
```

并回填其中的 `config`。

- 如果无法回填出带 `command` 或 `url` 的配置，该 MCP 名称不会进入 prompt 或 runtime。

### 前端选择保存

文件：

```text
packages/web/src/components/sidebar/mcps-dialog.tsx
packages/web/src/components/sidebar/agent-detail.tsx
```

行为：

- MCP 选择弹窗现在会把所选 MCP 的完整 config 回传给 Agent 编辑器。
- Agent 编辑器保存时优先保留用户已有的可运行配置；旧的空配置会用 MCP 库配置替换。
- 新保存的 Agent 不再产生 `{ "fetch": {} }` 这种空 MCP 配置。

## 验证点

1. Agent 配置中选择 `fetch` 后，确认 Agent 的 `mcps.mcpServers.fetch` 包含 `command` 或 `url`。
2. 运行 Hermes Agent 后，确认：

```text
{agentDir}/.hermes/config.yaml
```

包含 `mcp_servers.fetch` 托管区块。

3. 如果仍没有 `mcp_fetch_*` 工具，检查 Hermes MCP 连接：

```powershell
$env:HERMES_HOME = "<agentDir>/.hermes"
hermes mcp test fetch
```

4. 检查 Hermes stderr 是否包含 MCP 连接或 discovery 失败日志。

## 建议测试命令

按项目当前测试方式，可运行：

```powershell
pnpm --filter @agent-spaces/server exec node --import tsx --test test/hermes-runtime.test.ts
pnpm --filter @agent-spaces/server exec node --import tsx --test test/agent-skill-template.test.ts
pnpm --filter @agent-spaces/server build
pnpm --filter @agent-spaces/web build
```
