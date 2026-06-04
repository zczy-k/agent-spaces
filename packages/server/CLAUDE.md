[根目录](../../CLAUDE.md) > [packages](../) > **server**

# @agent-spaces/server

## 模块职责

Express 5 后端服务，提供 REST API、WebSocket 实时通信、认证中间件、六运行时 Agent 编排引擎（OpenAgentSdk / ClaudeCode / Codex / LangChain / Hermes / OhMyPi）、通用 AI 文本请求层（支持 Anthropic/OpenAI/Gemini 三种供应商）、AI 标题生成（频道/Issue 自动标题）、Workflow 系统（WorkFox DAG 执行引擎 + 校验/CRUD/Task 映射/Command 节点执行/运行时校验/触发器/交互管理/执行通道/Webhook Hook）、Plugin 插件系统（自定义 Workflow 节点类型 + CJS 沙箱加载 + Store 安装 + 配置管理 + 执行引擎集成）、Hook 系统（Agent 工具调用前后自定义钩子，shell/webhook/script 三种动作）、输出风格管理（OutputStyle 模板 CRUD + 运行时注入）、Anthropic Bridge 协议中转（7 文件子模块）、持久上下文加载（CLAUDE.md/AGENTS.md 自动注入）、通知中心（飞书 Lark + 企微 WeChat + Native 双适配器 + Bot Agent + 16 个内置斜杠命令）、应用内通知（NotificationCenter）、PTY 终端管理、文件系统操作、Git 操作（含 Clone SSE）、SQLite Agent Usage 统计与费用估算、LLM 模型/供应商管理、Agent Preset 管理、内置 Function Call 工具、Commit Agent（自动生成 conventional commit message）、Issue 评论与重试恢复、工具详情持久化、Agent SSE API（HTTP 流式调用）、代码搜索（ripgrep + Node.js 回退）、订阅管理（智谱/MiniMax/AICode 配额查询）、语音识别（腾讯语音 WebSocket 流式）、快捷命令（CRUD + 运行/停止/自动重启）、Agent Designer（AI 自动生成预设）、Skill/MCP 全局管理、Prompt 模板管理（CRUD + 批量应用）、代码收藏（CRUD + 按工作空间持久化）、TypeScript LSP 服务（typescript-language-server + vscode-ws-jsonrpc）、DOM Inspector 源码定位（免认证端点 + WS 广播）、数据导入导出（ZIP 归档 + cc-switch 迁移）、用户设置管理能力。作为整个平台的核心运行时，管理 Workspace 生命周期、Issue/Task 状态机（含 Workflow DAG 依赖调度）、Agent 会话调度和数据持久化。

## 入口与启动

- **入口文件**：`src/app.ts`
- **启动命令**：`pnpm dev`（tsx watch 热重载）或 `pnpm start`（编译后运行）
- **默认端口**：`3100`（可通过 `PORT` 环境变量修改）
- **数据目录**：`~/.agent-spaces-data`（可通过 `AGENT_SPACES_DATA_DIR` 修改）
- **启动流程**：Express 初始化 -> auth 中间件注册 -> 路由注册（含 workflow/command/search/subscription/speech-recognition/skill/mcp/notification/code-favorites/prompt-template/hooks/output-style/version/database/kanban/worktree/robot-account/agent-commands/plugin） -> Inspector track 端点（免认证） -> HTTP Server 创建 -> WebSocket Server 创建（含 /ws + /ws/speech + /ws/lsp/typescript） -> 启动 Issue 重试恢复 -> 启动持久化通知服务

## 对外接口

### REST API 路由表

所有路由挂载在 `/api/` 下，除 `/api/health`、`/api/auth/login`、`/api/auth/check`、`/api/inspector/track`、`/api/version`、`/api/version/check` 外均需 Bearer Token 认证。Agent SSE API 支持 Bearer Token / x-agent-spaces-key Header / key Body 三种认证方式。

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 认证登录（Secret Key -> Token） |
| `/api/auth/check` | GET | 检查认证状态 |
| `/api/auth/change-secret` | POST | 修改 Secret Key |
| `/api/upload/avatar` | POST | 上传 Agent 头像（base64 dataUrl） |
| `/api/user/settings` | GET/PUT | 用户设置（avatarUrl） |
| `/api/inspector/track` | POST | DOM Inspector 源码定位（免认证，被调试项目调用） |
| `/api/version` | GET | 当前版本信息（免认证） |
| `/api/version/check` | GET | 检查最新版本（免认证） |
| `/api/version/update` | POST | 触发自更新 |
| `/api/workspaces` | GET/POST | 列出/创建工作空间 |
| `/api/workspaces/:id` | GET/PUT/DELETE | 获取/更新/删除工作空间 |
| `/api/workspaces/:id/prompt` | GET/PUT | 读取/写入工作空间 Prompt（Markdown） |
| `/api/workspaces/:id/clone` | POST | Git Clone（SSE 流式进度） |
| `/api/workspaces/:id/reveal` | POST | 在文件管理器中打开目录 |
| `/api/workspaces/:id/files/tree` | GET | 获取文件树（支持 `?path=` 参数） |
| `/api/workspaces/:id/files/content` | GET/PUT | 读取/写入文件内容 |
| `/api/workspaces/:id/channels` | GET/POST | 列出/创建频道 |
| `/api/workspaces/:id/channels/:channelId/messages` | GET/POST | 获取/发送消息 |
| `/api/workspaces/:id/channels/:channelId/messages/:messageId/tool-details/:detailId` | GET | 获取工具调用详情（懒加载） |
| `/api/workspaces/:id/issues` | GET/POST | 列出/创建议题（含 workflowId） |
| `/api/workspaces/:id/issues/:issueId` | GET/PUT | 获取/更新议题 |
| `/api/workspaces/:id/issues/:issueId/start` | POST | 启动议题（draft -> planned） |
| `/api/workspaces/:id/agents` | GET | 列出 Agent 会话 |
| `/api/workspaces/:id/agents/start` | POST | 启动 Agent 会话 |
| `/api/workspaces/:id/agents/:agentId/stop` | POST | 停止 Agent 会话 |
| `/api/workspaces/:id/agents/presets` | GET/POST | 列出/创建 Agent 预设 |
| `/api/workspaces/:id/agents/presets/test-connection` | POST | 测试 Agent 连接 |
| `/api/workspaces/:id/agents/presets/:presetId` | PUT/DELETE | 更新/删除 Agent 预设 |
| `/api/workspaces/:id/agent-templates` | GET | 列出全局 Agent 模板 |
| `/api/workspaces/:id/agents/from-templates` | POST | 从模板导入 Agent 到工作空间 |
| `/api/workspaces/:id/tasks` | GET | 列出任务（支持 `?issueId=` 过滤） |
| `/api/workspaces/:id/tasks/:taskId` | GET | 获取任务 |
| `/api/workspaces/:id/tasks/:taskId/retry` | POST | 重试任务 |
| `/api/workspaces/:id/tasks/:taskId/cancel` | POST | 取消任务 |
| `/api/workspaces/:id/git/*` | 多种 | Git 操作路由（status/diff/log/commit/push/pull/init/branch/checkout/tag/cherry-pick/stage/unstage/remote/config/generate-commit-msg/discard/commit-diff） |
| `/api/workspaces/:id/notifications/start` | POST | 启动通知服务（飞书/企微） |
| `/api/workspaces/:id/notifications/stop` | POST | 停止通知服务 |
| `/api/workspaces/:id/notifications/test` | POST | 发送测试通知 |
| `/api/workspaces/:id/notifications/wechat/qr` | POST | 获取/轮询企微登录二维码 |
| `/api/workspaces/:id/notifications` | GET/DELETE | 列出/清空应用内通知 |
| `/api/workspaces/:id/notifications/:notificationId/read` | PUT | 标记通知已读 |
| `/api/workspaces/:id/notifications/read-all` | PUT | 全部标记已读 |
| `/api/workspaces/:id/commands` | GET/POST | 列出/创建快捷命令 |
| `/api/workspaces/:id/commands/processes` | GET | 列出运行中命令进程 |
| `/api/workspaces/:id/commands/:commandId` | PUT/DELETE | 更新/删除快捷命令 |
| `/api/workspaces/:id/commands/:commandId/run` | POST | 运行快捷命令 |
| `/api/workspaces/:id/commands/:commandId/stop` | POST | 停止快捷命令 |
| `/api/workspaces/:id/code-favorites` | GET/POST/DELETE | 列出/添加/清空代码收藏 |
| `/api/workspaces/:id/code-favorites/:favId` | DELETE | 删除单个代码收藏 |
| `/api/workspaces/:id/search/code` | GET | 代码搜索（ripgrep/Node.js） |
| `/api/workspaces/:id/search/files` | GET | 文件名搜索 |
| `/api/workspaces/:id/hooks` | GET/POST | 列出/创建 Hook 配置 |
| `/api/workspaces/:id/hooks/:name` | GET/PUT/DELETE | 获取/更新/删除 Hook 配置 |
| `/api/workspaces/:id/hooks/upload` | POST | 上传 Hook JSON |
| `/api/workspaces/:id/hooks/:name/apply` | POST | 应用 Hook 到另一个工作空间 |
| `/api/workspaces/:id/databases` | GET/POST | 列出/创建文档数据库 |
| `/api/workspaces/:id/databases/:dbId` | GET/PUT/DELETE | 获取/更新/删除文档数据库 |
| `/api/workspaces/:id/databases/:dbId/nodes` | GET/POST | 列出/创建文档节点 |
| `/api/workspaces/:id/databases/:dbId/nodes/:nodeId` | GET/PUT/DELETE | 获取/更新/删除文档节点 |
| `/api/workspaces/:id/databases/:dbId/search` | GET | 文档搜索 |
| `/api/workspaces/:id/databases/:dbId/vector/*` | 多种 | 向量搜索（索引/查询/统计） |
| `/api/workspaces/:id/kanban` | GET | 获取看板 |
| `/api/workspaces/:id/kanban/columns` | POST | 创建看板列 |
| `/api/workspaces/:id/kanban/columns/:columnId` | PUT/DELETE | 更新/删除看板列 |
| `/api/workspaces/:id/kanban/tasks` | POST | 创建看板任务 |
| `/api/workspaces/:id/kanban/tasks/:taskId` | PUT/DELETE | 更新/删除看板任务 |
| `/api/workspaces/:id/kanban/reorder` | POST | 重新排序看板 |
| `/api/workspaces/:id/worktrees` | GET/POST | 列出/创建 Worktree |
| `/api/workspaces/:id/worktrees/:worktreeId` | DELETE | 删除 Worktree |
| `/api/workspaces/:id/worktrees/:worktreeId/diff` | GET | Worktree Diff |
| `/api/workspaces/:id/worktrees/:worktreeId/create-pr` | POST | 创建 PR |
| `/api/workspaces/:id/worktrees/:worktreeId/merge-pr` | POST | 合并 PR |
| `/api/workspaces/:id/robot-accounts` | GET | 列出 Robot Account |
| `/api/workspaces/:id/agent-commands` | GET/POST | 列出/创建 Agent Commands |
| `/api/workspaces/:id/agent-commands/:commandId` | PUT/DELETE | 更新/删除 Agent Commands |
| `/api/workspaces/:id/agent-commands/:commandId/apply` | POST | 应用 Command 到 Agent |
| `/api/workflows` | GET/POST | 列出/创建 Workflow 模板（全局） |
| `/api/workflows/:workflowId` | GET/PUT/DELETE | 获取/更新/删除 Workflow 模板 |
| `/api/workflows/:workflowId/duplicate` | POST | 复制 Workflow 模板 |
| `/api/workflows/:workflowId/trigger` | POST | 触发 Workflow 执行 |
| `/api/workflow-hook/:triggerId` | GET/SSE | Workflow Webhook Hook（SSE 流式执行结果） |
| `/api/data/export` | GET | 导出 ZIP 归档（15+ 数据类别） |
| `/api/data/import` | POST | 导入 ZIP 归档 |
| `/api/import/cc-switch` | POST | cc-switch 数据迁移 |
| `/api/agent-sse/run` | POST | Agent SSE 流式调用 |
| `/api/agents/usage/dashboard` | GET | Agent 用量 Dashboard（`?days=30`） |
| `/api/models` | GET/POST | 列出/创建 LLM 模型 |
| `/api/models/:id` | PUT/DELETE | 更新/删除 LLM 模型 |
| `/api/providers` | GET/POST | 列出/创建 LLM 供应商 |
| `/api/providers/:id` | PUT/DELETE | 更新/删除 LLM 供应商 |
| `/api/output-styles` | GET/POST | 列出/创建输出风格模板 |
| `/api/output-styles/:id` | PUT/DELETE | 更新/删除输出风格模板 |
| `/api/folder/browse` | GET | 文件夹浏览器（目录列表 + 父目录） |
| `/api/folder/create` | POST | 创建目录 |
| `/api/skills` | GET | 列出全局技能 |
| `/api/skills/sync-check` | GET | 检查技能同步状态 |
| `/api/skills/sync` | POST | 同步技能 |
| `/api/skills/import` | POST | 导入技能文件 |
| `/api/skills/:name` | PUT/DELETE | 更新/删除技能 |
| `/api/prompt-templates` | GET/POST | 列出/创建 Prompt 模板 |
| `/api/prompt-templates/:id` | PUT/DELETE | 更新/删除 Prompt 模板 |
| `/api/prompt-templates/:id/apply` | POST | 应用 Prompt 模板到指定 Agent |
| `/api/prompt-templates/agents` | GET | 列出可应用 Prompt 的 Agent 候选 |
| `/api/mcps` | GET | 列出全局 MCP 配置 |
| `/api/mcps/import` | POST | 导入 MCP 配置 |
| `/api/mcps/:name` | PUT/DELETE | 更新/删除 MCP 配置 |
| `/api/subscriptions` | GET/POST | 列出/创建订阅配置 |
| `/api/subscriptions/:id` | PUT/DELETE | 更新/删除订阅配置 |
| `/api/subscriptions/:id/quota` | GET | 查询订阅配额 |
| `/api/speech-recognition` | GET/POST | 列出/创建语音识别配置 |
| `/api/speech-recognition/:id` | PUT/DELETE | 更新/删除语音识别配置 |
| `/api/git-config` | GET/POST | 全局 Git 配置 |
| `/api/fonts` | GET | 列出字体 |
| `/api/fonts/upload` | POST | 上传字体 |
| `/api/fonts/:name` | DELETE | 删除字体 |
| `/api/plugins` | GET | 列出所有插件 |
| `/api/plugins/workflow` | GET | 列出 Workflow 插件 |
| `/api/plugins/store/:pluginId/install` | POST | 从商店安装插件 |
| `/api/plugins/:pluginId/enable` | POST | 启用插件 |
| `/api/plugins/:pluginId/disable` | POST | 禁用插件 |
| `/api/plugins/:pluginId/config` | GET | 获取插件配置 |
| `/api/plugins/:pluginId/config` | PUT | 保存插件配置 |
| `/api/plugins/:pluginId/workflow-nodes` | GET | 获取插件 Workflow 节点定义 |

### WebSocket 端点

| 端点 | 认证 | 说明 |
|------|------|------|
| `ws://localhost:3100/ws?workspaceId=<id>&token=<token>` | token 查询参数 | 主 WebSocket 连接 |
| `ws://localhost:3100/ws/speech?token=<token>&configId=<id>` | token 查询参数 | 语音识别流式 WebSocket |
| `ws://localhost:3100/ws/lsp/typescript?workspaceId=<id>&token=<token>` | token 查询参数 | TypeScript LSP 语言服务 WebSocket |

### WebSocket 事件

连接地址：`ws://localhost:3100/ws?workspaceId=<id>&token=<token>`

**客户端 -> 服务端事件**（9 个）：
- `terminal.create` / `terminal.input` / `terminal.resize` / `terminal.close`
- `channel.message`（支持 mentions 字段触发 @agent）
- `channel.stop`（停止频道所有活跃 Agent 运行）
- `channel.answer_question`（回答 Agent 提问，触发断点续跑）
- `agent.start` / `agent.stop`

**服务端 -> 客户端事件**（含 inspector）：
- `connected` -- 连接确认
- `terminal.created` / `terminal.output` / `terminal.closed`
- `channel.message` / `channel.message.updated` / `channel.message.deleted` / `channel.messages.cleared` / `channel.updated`
- `agent.started` / `agent.status_changed` / `agent.output` / `agent.completed` / `agent.error`
- `issue.created` / `issue.updated` / `issue.status_changed`
- `task.created` / `task.updated` / `task.status_changed` / `task.output`
- `workflow.created` / `workflow.updated` / `workflow.deleted`
- `command.started` / `command.stopped` / `command.restarted`
- `notification.created` / `notification.cleared`
- `inspector.jump` -- DOM Inspector 源码定位广播

### 通用 AI 文本请求层

`services/ai-text.ts` 提供统一的 AI 文本生成接口，自动路由到不同供应商：

- **接口**：`requestAiText(config, { systemPrompt, userPrompt })` -- 返回文本字符串
- **支持供应商**：Anthropic Messages、OpenAI Chat Completions/Responses、Gemini Generate Content
- **自动推断**：`inferProvider(apiBase)` 根据 API URL 自动推断供应商类型
- **辅助函数**：`maskAiTextUrl(url)` -- 脱敏 API URL 用于日志

### AI 标题生成

频道和 Issue 创建时自动异步生成标题。

| 文件 | 职责 |
|------|------|
| `services/generated-title.ts` | 调度标题生成（`scheduleChannelTitleGeneration` / `scheduleIssueTitleGeneration`），异步执行不阻塞主流程 |
| `agents/title-generator-agent.ts` | Title Generator Agent，使用 `requestAiText()` 生成客观场景标题 |

### Hook 系统

Agent 工具调用前后的自定义钩子系统，per-tool-call 粒度。

| 文件 | 职责 |
|------|------|
| `routes/hooks.ts` | Hook CRUD REST API（GET/POST/PUT/DELETE + upload + apply） |
| `services/hook-engine.ts` | Hook 引擎（规则匹配、命令执行、wrapOnEventWithHooks 拦截 AgentRuntimeEvent） |
| `storage/hook-store.ts` | Hook JSON 持久化（`workspaces/{id}/hooks/{name}.hook.json`） |

- **动作类型**：shell command（已实现）、webhook（stub）、script（stub）
- **阶段**：PreToolUse / PostToolUse
- **匹配器**：`*` 通配、`/regex/` 正则、精确字符串
- **拦截方式**：`wrapOnEventWithHooks(originalOnEvent, workspaceId)` 包装 Agent 的 onEvent 回调
- **存储格式**：Claude Code `hooks.json` 兼容的 `HookConfig` 类型

详见 `docs/superpowers/specs/2026-05-20-hook-system-design.md`。

### 输出风格管理

自定义 Agent 输出格式模板系统。

| 文件 | 职责 |
|------|------|
| `routes/output-style.ts` | OutputStyle CRUD REST API（GET/POST/PUT/DELETE） |
| `services/output-style.ts` | OutputStyle 模板管理 + `resolveOutputStyleContent()` 运行时注入 |

- **OutputStyleTemplate 类型**：id, name, content, createdAt, updatedAt
- **持久化**：`~/.agent-spaces-data/output-styles/meta.json`
- **注入方式**：Agent 运行时通过 `resolveOutputStyleContent()` 将 content 拼接到 systemPrompt

### Workflow 系统

Workflow 是 Issue 自动化的可视化 DAG 模板系统，替代旧硬编码 pipeline。

**关键文件**：
- `routes/workflow.ts` -- REST API 路由（CRUD + duplicate）
- `services/workflow.ts` -- 业务逻辑（DAG 校验/role 解析/Task 映射/运行时校验/CRUD）
- `services/workflow-command-runner.ts` -- Command 节点 shell 命令执行器
- `storage/workflow-store.ts` -- JSON 持久化

详见 `docs/workflow-system.md`。

### Plugin 插件系统

Workflow 自定义节点类型插件系统，支持 Store 安装、CJS 沙箱加载和执行引擎集成。

| 文件 | 职责 |
|------|------|
| `services/plugin.ts` | 插件全生命周期管理（299 行）：安装/启用/禁用/配置/Store 导入/CJS 沙箱加载（vm.Script）/自定义 Workflow 节点注册与执行 |
| `routes/plugin.ts` | REST API：list/workflow/store-install/enable/disable/config/workflow-nodes |

**插件存储结构**：
- 插件目录：`~/.agent-spaces-data/plugins/{pluginId}/`
- 状态文件：`~/.agent-spaces-data/plugins/state.json`
- 支持 manifest 格式：`plugin.json` / `manifest.json` / `info.json` / `web-plugin.json` / `package.json`

**Workflow 节点注册**：
- `getWorkflowNodes(pluginId)` — 从 manifest.workflowNodes 或 entries.workflow 加载节点定义
- `canExecuteWorkflowNode(nodeType)` — 检查节点是否可执行
- `executeWorkflowNode(nodeType, data, config)` — 通过 vm.Script 沙箱执行插件节点

**execution-manager 集成**（execution-manager.ts 第 611 行）：
```typescript
if (pluginService.canExecuteWorkflowNode(node.type)) {
  return pluginService.executeWorkflowNode(node.type, resolvedData, config);
}
```

**配置加载**：
- `loadPluginConfigs()` — 为执行会话加载插件配置
- `getReferencedPluginIds()` — 从 Workflow 中提取引用的插件 ID
- 支持全局配置 + Workflow 级别的配置方案（workflowStore.readPluginScheme）
- 配置通过 `session.context.__config__` 注入执行环境

### Agent 运行时架构

支持六种运行时，通过 `createAgentRuntime(config)` 工厂函数按 `config.kind` 切换：

| 运行时 | kind 值 | SDK | 说明 |
|--------|---------|-----|------|
| `OpenAgentSdkRuntime` | `open-agent-sdk`（默认） | `@codeany/open-agent-sdk` | 进程内 Agent 循环，支持多 API 类型 |
| `ClaudeCodeRuntime` | `claude-code` | `@anthropic-ai/claude-agent-sdk` | 使用 Claude Code 运行时，支持文件创建/编辑，内置 Anthropic Bridge（7 文件子模块） |
| `CodexRuntime` | `codex` | `@openai/codex-sdk` | 使用 OpenAI Codex CLI，支持沙箱/技能/MCP |
| `LangChainRuntime` | `langchain` | `langchain` + `@langchain/openai` + `@langchain/anthropic` + `@langchain/google-genai` | 基于 LangChain.js createAgent API，provider-neutral |
| `HermesRuntime` | `hermes` | Hermes CLI（外部进程） | 外部 Hermes CLI 进程适配，支持工具调用事件解析 |
| `OhMyPiRuntime` | `oh-my-pi` | omp CLI / `@oh-my-pi/pi-coding-agent`（外部进程） | 外部 omp CLI 进程适配，Bun-native SDK 通过进程边界通信，支持 CodexFunctionToolBridge MCP 桥接 |

**接口定义**（`adapters/agent-runtime-types.ts`）：
- `AgentRuntime` -- execute/stop 接口
- `AgentRunOptions` -- 运行选项（outputStyle 等）
- `AgentRunResult` -- 执行结果（success/summary/artifacts/output/usage/costUsd）
- `AgentRuntimeEvent` -- 事件类型（tool_use_start/tool_use_end/text/thinking/done/error）
- `AgentFunctionTool` -- Function Call 工具定义（name/description/parameters）
- `appendOutputStyleToPrompt(prompt, outputStyle?)` -- 输出风格注入辅助
- `summarizeResult(output)` -- 结果摘要提取

**ClaudeCodeRuntime 子模块结构**（`adapters/claude-code-runtime/`）：

| 文件 | 职责 |
|------|------|
| `index.ts` | ClaudeCodeRuntime 主类，execute/stop 实现，SDK query() 事件循环 |
| `sdk-config.ts` | SDK 配置构建（env/权限模式/MCP/技能/configDir/可执行文件路径） |
| `adapter-pool.ts` | Bridge 引用计数式复用池，相同配置共享服务器实例 |
| `anthropic-bridge.ts` | HTTP Bridge 服务器，请求/响应管道 |
| `protocol-converter.ts` | Anthropic <-> OpenAI 协议转换（请求+响应双向） |
| `message-format.ts` | SDK 消息格式化与事件提取（thinking/tool_use/tool_result/usage） |
| `types.ts` | 类型定义（AnthropicRequest/OpenAIChatBody/ResponsesBody/BridgeConfig） |

### 持久上下文加载

`services/persistent-agent-context.ts` 自动加载项目级指令文件，注入所有 Agent 运行时。

- **加载文件**：CLAUDE.md、claude.md、AGENTS.md、agents.md
- **扫描策略**：全局 dataDir -> workspace boundDirs 祖先目录 -> 当前工作目录（从低到高优先级）
- **字符预算**：单文件 48K 字符上限，总计 120K 字符上限，超限截断
- **注入点**：ws/agent-prompt.ts（聊天 @mention）、routes/agent-sse.ts（SSE API）、agents/issue-task-controller.ts（Issue Task）、agents/commit-agent.ts（Commit Agent）、services/notification-hub/bot-agent.ts（Bot Agent）
- **接口**：`prependPersistentAgentContext(prompt, options)` -- 在 prompt 前拼接上下文

详见 `docs/persistent-agent-context.md`。

### Issue Task Controller

`agents/issue-task-controller.ts` 是从 issue-agent-runner 独立拆分出的任务控制器（769 行）。

- **职责**：Task Creator + Workflow Task 创建 + 依赖调度 + Executor 启动
- **关键函数**：`scheduleRunnableIssueTasks()`、`runIssueTask()`、`createTasksFromWorkflow()`
- **集成点**：被 `issue-agent-runner.ts` 的 `runIssueAutomation()` 调用
- **Hook 支持**：通过 `wrapOnEventWithHooks()` 包装 Agent onEvent 回调

### TypeScript LSP 服务

`ws/typescript-lsp.ts` 为 Monaco 编辑器提供 TypeScript 语言服务。

- **后端**：为每个 WebSocket 连接启动 `typescript-language-server --stdio` 子进程
- **工作目录**：优先使用能找到 `tsconfig.json`/`jsconfig.json` 的项目根
- **通信**：`vscode-ws-jsonrpc` 转发 WebSocket <-> stdio
- **端点**：`/ws/lsp/typescript?workspaceId=<id>&token=<token>`
- **前端对应**：`packages/web/src/lib/monaco-language-client.ts`（monaco-languageclient）

详见 `docs/monaco-typescript-lsp.md`。

### DOM Inspector 端点

`app.ts` 中的 `/api/inspector/track` 免认证端点。

- **请求**：POST `{ path, name?, line, column?, timestamp? }`
- **响应**：`{ ok: true }`
- **行为**：通过 `broadcastToAll('inspector.jump', ...)` 向所有 WebSocket 连接广播
- **用途**：被调试项目中的 dom-inspector-hook 调用，前端接收到 `inspector.jump` 事件后在 Monaco 编辑器中打开对应源文件

详见 `docs/dom-inspector-integration.md`。

### Agent SSE API

HTTP Server-Sent Events 流式 Agent 调用端点。

- **端点**：`POST /api/agent-sse/run`
- **认证**：Bearer Token / `x-agent-spaces-key` Header / `key` Body 参数
- **请求体**：`{ agentId, workspaceId?, message/prompt/messages, systemPrompt?, maxTurns?, skills?, mcps? }`
- **响应**：SSE 流（event: session/status/output/tool_use/tool_result/done/error）
- **用途**：外部集成、CI/CD、API 测试
- **文件**：`routes/agent-sse.ts`

### 代码收藏系统

按工作空间持久化的代码位置/片段收藏。

| 文件 | 职责 |
|------|------|
| `services/code-favorites.ts` | 收藏 CRUD 服务（list/add/remove/clear） |
| `storage/code-favorites-store.ts` | JSON 持久化（`workspaces/{id}/code-favorites.json`） |
| `routes/code-favorites.ts` | REST API 路由（GET/POST/DELETE） |

### Prompt 模板管理

Prompt 模板 CRUD + 批量应用到 Agent。

| 文件 | 职责 |
|------|------|
| `services/prompt-template.ts` | Prompt 模板 CRUD + applyPromptToAgents + listAgentCandidates |
| `routes/prompt-template.ts` | REST API 路由（GET/POST/PUT/DELETE + /:id/apply + /agents） |

持久化位置：`~/.agent-spaces-data/prompt-templates/meta.json`

### 订阅管理系统

支持智谱/MiniMax/AICode 三种供应商的余额和配额查询。

| 文件 | 职责 |
|------|------|
| `services/subscription/base.ts` | `SubscriptionProviderBase` 抽象类 |
| `services/subscription/zhipu.ts` | 智谱配额查询 |
| `services/subscription/minimax.ts` | MiniMax Coding Plan 配额查询 |
| `services/subscription/aicode.ts` | AI Code 余额查询 |
| `services/subscription/index.ts` | 供应商注册 + fetchQuota 统一入口 |
| `storage/subscription-store.ts` | 订阅配置 JSON 持久化 |
| `routes/subscription.ts` | REST API 路由（CRUD + quota 查询） |

### 语音识别系统

基于 WebSocket 的实时语音识别。

| 文件 | 职责 |
|------|------|
| `services/speech-recognition/base.ts` | `SpeechRecognitionProviderBase` 抽象类 + `SpeechRecognitionSession` 接口 |
| `services/speech-recognition/tencent.ts` | 腾讯语音实时识别实现 |
| `services/speech-recognition/index.ts` | 供应商注册 + createSession 统一入口 |
| `storage/speech-recognition-store.ts` | 语音识别配置 JSON 持久化 |
| `routes/speech-recognition.ts` | REST API 路由（CRUD）+ WebSocket handler |

### 快捷命令系统

自定义命令的 CRUD、运行、停止和自动重启。

| 文件 | 职责 |
|------|------|
| `services/command.ts` | 快捷命令 CRUD 服务 |
| `services/command-process-manager.ts` | 进程生命周期管理（创建/停止/自动重启） |
| `storage/command-store.ts` | 快捷命令 JSON 持久化 |
| `routes/command.ts` | REST API 路由（CRUD + run/stop/processes） |

### 代码搜索系统

基于 ripgrep（优先）+ Node.js（回退）的代码搜索。

| 文件 | 职责 |
|------|------|
| `services/search.ts` | 搜索服务（ripgrep + Node.js 实现 + 文件名搜索） |
| `services/gitignore.ts` | .gitignore 解析过滤器 |
| `routes/search.ts` | REST API 路由（code/files） |

### Skill/MCP 全局管理

技能和 MCP 配置的全局 CRUD 管理。

| 文件 | 职责 |
|------|------|
| `services/skill.ts` | 技能管理（列出/导入/同步/更新/删除/收藏） |
| `services/mcp.ts` | MCP 配置管理（列出/导入/更新/删除/收藏） |
| `routes/skill.ts` | 技能 REST API |
| `routes/mcp.ts` | MCP REST API |

### Agent Designer

AI 自动生成 Agent 预设配置。

| 文件 | 职责 |
|------|------|
| `agents/agent-designer.ts` | 根据用户描述自动生成 Agent name/description/systemPrompt 的 JSON 配置 |

### Anthropic Bridge

ClaudeCodeRuntime 内置本地 HTTP 反向代理，解决 Claude Agent SDK 只发送 Anthropic Messages 格式的问题。

详见 `docs/anthropic-bridge.md`。

### CodexFunctionToolBridge

将 `AgentFunctionTool` 桥接为 MCP Server，供 CodexRuntime 使用。

| 文件 | 职责 |
|------|------|
| `adapters/codex-function-tool-bridge.ts` | MCP Server 桥接，使用 @modelcontextprotocol/sdk StreamableHTTPServerTransport |

### 版本自更新系统

内置版本检查和自更新脚本生成。

| 文件 | 职责 |
|------|------|
| `services/version.ts` | npm registry 查询（1h 缓存）+ 自更新脚本生成（Windows/macOS 双平台） |
| `routes/version.ts` | GET /api/version + GET /api/version/check + POST /api/version/update |

### 认证系统

- **Secret Key 存储**：`~/.agent-spaces-data/auth.json`
- **中间件**：`middleware/auth.ts`，保护除 `/api/health`、`/api/auth/login`、`/api/auth/check`、`/api/inspector/track`、`/api/version`、`/api/version/check` 外的所有路由
- **WebSocket 认证**：连接时通过 `token` 查询参数验证
- **Token 管理**：支持修改 Secret Key（需当前 Token 验证）

### 通知中心 (Notification Hub)

`services/notification-hub/` 子目录（14 个文件）实现完整的外部通知系统：

详见 `docs/bot-notification-workflow.md`。

### 应用内通知 (Notification Center)

`services/notification-center.ts` 实现应用内通知 CRUD 和 WebSocket 推送：

- **类型**：`NotificationType` = 'issue_completed' | 'issue_failed' | 'task_completed' | 'task_failed'
- **存储**：`workspaces/{workspaceId}/notifications.json`
- **API**：GET/PUT/DELETE `/api/workspaces/:id/notifications`
- **WebSocket**：`notification.created` / `notification.cleared` 事件

### Agent 编排流程

```
Issue 自动化入口（runIssueAutomation）:
  +-- issue.workflowId exists?
      +-- yes: load workflow template
      |        createTasksFromWorkflow()
      |        -> mapWorkflowToTaskDrafts()
      |        -> validateWorkflowForRun()
      |        -> create Tasks with dependsOn
      |        -> scheduleRunnableIssueTasks()（依赖调度）
      |        -> runIssueTask() per runnable task
      |        -> 所有 Task done -> Issue completed
      |
      +-- no/fail: Issue -> error（不再回退旧 hardcoded pipeline）

Issue Task Controller（issue-task-controller.ts，769 行）:
  -> Task Creator + Workflow Task 创建 + 依赖调度 + Executor 启动
  -> 支持 Hook 系统包装（wrapOnEventWithHooks）
  -> 支持 Command 节点执行（workflow-command-runner.ts）

频道 @mention 触发（runMentionedAgent，ws/agent-runner.ts）:
  -> 6 阶段执行 + 消息 Parts 构建管线
  -> 持久上下文自动注入（persistent-agent-context.ts）
  -> 支持 AskUserQuestion 阻塞等待用户回答
  -> 支持 TodoWrite 同步到 Channel
  -> 支持回复 AI 消息续跑

Issue 自动化入口重构:
  issue-agent-runner.ts: runIssueAutomation() -- Workflow 优先，无 workflow 则 error
  issue-task-controller.ts: 独立任务控制器（从 issue-agent-runner 拆分）
  issue-retry.ts: recoverRunningWorkOnStartup()（启动时恢复未完成的 Issue）
```

### Function Call 工具层

服务器端 function-call 工具抽象，定义在 `AgentFunctionTool` 接口，分为四类内置工具：

- **Issue 工具**：`CreateCurrentChannelIssue` / `ViewCurrentChannelIssue` / `AddCurrentChannelComment`
- **Command 工具**：Agent 命令执行工具
- **Database 工具**：文档数据库 CRUD 工具
- **Kanban 工具**：看板任务管理工具

详见 `docs/function-call-tools.md`。

### Agent Preset 系统

- **全局模板**：存储在 `~/.agent-spaces-data/agent-templates/{agentId}/`
- **工作空间预设**：存储在 `workspace.agents` 数组 + `{agentspaceDir}/agents/{agentId}/`
- **连接测试**：支持 anthropic-messages / openai-chat-completions / openai-responses / openai-responses-to-anthropic-messages / openai-chat-completions-to-anthropic-messages / gemini-generate-content
- **技能系统**：Markdown 文件存储在 `skills/` 目录，运行时可通过 `allowedTools` 映射 MCP 工具
- **头像**：通过 `POST /api/upload/avatar` 上传 base64 图片
- **角色类型**：`agent`（默认）、`scheduler`、`task_creator`、`bot`、自定义字符串

### 用量统计与计费

- **存储**：SQLite（`~/.agent-spaces-data/agents/agents.sqlite`），两张表：`agent_sessions` + `agent_usage`
- **记录时机**：所有 Agent 完成路径（聊天 @agent / issue workflow / bot agent / SSE API）
- **费用来源优先级**：1) runtime 提供的原始 costUsd；2) LLMModel.cost 配置；3) 内置模型族估算表；4) 默认估算值
- **API**：`GET /api/agents/usage/dashboard?days=30` 返回 Dashboard 聚合数据

详见 `docs/model-usage-accounting.md`。

## 关键依赖与配置

### 运行时依赖

| 依赖 | 用途 |
|------|------|
| `express` (v5) | HTTP 服务与路由 |
| `ws` | WebSocket 服务 |
| `node-pty` | PTY 终端管理 |
| `simple-git` | Git 操作封装 |
| `uuid` | ID 生成 |
| `cors` | 跨域支持 |
| `dotenv` | 环境变量加载 |
| `zod` (v4) | Schema 校验 |
| `node:sqlite` (DatabaseSync) | Agent Usage SQLite 存储（Node.js 内置） |
| `@codeany/open-agent-sdk` | Agent 运行时 SDK（进程内执行） |
| `@anthropic-ai/claude-agent-sdk` | Claude Code Agent 运行时 SDK |
| `@openai/codex-sdk` | Codex Agent 运行时 SDK |
| `langchain` + `@langchain/openai` + `@langchain/anthropic` + `@langchain/google-genai` | LangChain Agent 运行时 |
| `@larksuiteoapi/node-sdk` | 飞书 Bot SDK（长连接 + 消息收发） |
| `typescript-language-server` | TypeScript LSP 服务端 |
| `vscode-ws-jsonrpc` | LSP WebSocket <-> stdio 桥接 |
| `minimatch` | 文件模式匹配（.gitignore 解析增强） |
| `@modelcontextprotocol/sdk` | MCP SDK（CodexFunctionToolBridge） |
| `@agent-spaces/shared` | 共享类型（workspace:* 引用） |

### 开发依赖

| 依赖 | 用途 |
|------|------|
| `tsx` | TypeScript 直接运行 + watch |
| `typescript` | 编译 |

### 重要配置

- `"type": "module"` -- 使用 ESM 模块系统
- `postinstall` 脚本自动编译 node-pty native 模块
- JSON body 限制 50MB（支持大文件写入）
- 静态文件服务：`/public` 目录（含头像 `/public/avatars/` 和 provider 图标 `/public/provider-icons/`）

## 数据模型

### 持久化结构

数据存储在 `AGENT_SPACES_DATA_DIR` 目录下，使用 JSON 文件 + SQLite：

```
~/.agent-spaces-data/
  auth.json                         # Secret Key 认证信息
  agents/
    agents.sqlite                   # Agent Session + Usage（SQLite）
  workspaces/
    index.json                      # 所有 Workspace 列表
    {workspaceId}/
      workspace.json                # Workspace 详情（含 notificationSettings）
      prompt.md                     # 工作空间 Prompt（Markdown）
      notifications.json            # 应用内通知
      code-favorites.json           # 代码收藏
      hooks/                        # Hook 配置
        {name}.hook.json            # 单个 Hook 配置
      workflows/                    # Workflow 模板存储
        index.json                  # Workflow 列表
        {workflowId}.json           # Workflow 详情
      channels/
        index.json                  # 频道列表
        {channelId}/
          messages.json             # 频道消息
          tool-details.json         # 工具调用详情（懒加载）
      issues/
        index.json                  # 议题列表（含 workflowId）
        {issueId}.json              # 议题详情
        {issueId}.comments.json     # 议题评论
      tasks/
        index.json                  # 任务列表
        {taskId}.json               # 任务详情
      commands/
        commands.json               # 快捷命令列表
  agent-templates/
    {agentId}/
      agent.json                    # Agent 预设模板
      mcp.json                      # MCP 配置
      skills/
        *.md                        # 技能文件
  llm/
    models.json                     # LLM 模型列表（含 cost 配置）
    providers.json                  # LLM 供应商列表
  output-styles/                    # 输出风格模板
    meta.json                       # OutputStyle 模板元数据
  prompt-templates/                 # Prompt 模板
    meta.json                       # 模板元数据
  subscriptions.json                # 订阅配置列表
  speech-recognition.json           # 语音识别配置列表
  user-settings.json                # 用户设置（avatarUrl）
```

### .agentspace 目录（项目目录内）

创建 Workspace 时自动在 `boundDirs[0]` 下生成：

```
.agentspace/
  claude.md                       # 知识库
  skills/                         # 技能库（全局 + Agent 专属）
  agents/                         # Agent 配置与工作目录
    {agentId}/
      agent.json                  # 工作空间级 Agent 配置
      mcp.json                    # MCP 配置
      skills/
        *.md                      # Agent 专属技能
      .codex/                     # Codex 运行时临时配置目录（自动生成）
        skills/{name}/SKILL.md    # 转换后的 Codex 技能
  tasks/                          # 任务管理
  cache/                          # 缓存
  cache/locks/                    # 锁文件
  logs/                           # 执行记录
```

## 代码结构

```
packages/server/src/
  app.ts                          # Express 入口，路由注册，WebSocket 服务，头像上传，认证中间件，用户设置，全局 Git 配置，启动恢复
  middleware/
    auth.ts                       # Bearer Token 认证中间件
  routes/
    auth.ts                       # 认证路由（login/check/change-secret）
    workspace.ts                  # Workspace CRUD + Prompt + Clone + Reveal + 通知管理 + 企微二维码
    file.ts                       # 文件系统路由
    folder.ts                     # 文件夹浏览器路由（browse + create）
    channel.ts                    # 频道与消息路由
    issue.ts                      # 议题路由（含 workflowId）
    task.ts                       # 任务路由
    agent.ts                      # Agent 会话 + Preset CRUD + 连接测试 + Usage Dashboard
    agent-sse.ts                  # Agent SSE 流式调用
    workflow.ts                   # Workflow CRUD + duplicate 路由
    command.ts                    # 快捷命令 CRUD + run/stop/processes
    code-favorites.ts             # 代码收藏 CRUD
    prompt-template.ts            # Prompt 模板 CRUD + apply + agent candidates
    hooks.ts                      # Hook 配置 CRUD + upload + apply
    output-style.ts               # 输出风格模板 CRUD
    search.ts                     # 代码搜索 + 文件名搜索
    subscription.ts               # 订阅配置 CRUD + quota 查询
    speech-recognition.ts         # 语音识别配置 CRUD + WebSocket handler
    skill.ts                      # 全局技能管理
    mcp.ts                        # 全局 MCP 配置管理
    notification.ts               # 应用内通知 CRUD
    git.ts                        # Git 操作路由（含高级操作 + withLog 包装器）
    llm.ts                        # LLM 模型与供应商 CRUD 路由
    version.ts                    # 版本检查与自更新路由
    database.ts                   # 文档数据库 CRUD + 向量搜索路由
    kanban.ts                     # Kanban 看板路由
    worktree.ts                   # Worktree CRUD + Diff + PR 路由
    robot-account.ts              # Robot Account 凭证管理路由
    agent-commands.ts             # Agent Commands CRUD + apply 路由
    plugin.ts                     # Plugin 插件管理路由（list/workflow/store/enable/disable/config/workflow-nodes）
  services/
    workspace.ts                  # Workspace 服务（含 .agentspace 初始化）
    workspace-prompt.ts           # 工作空间 Prompt 读写服务（Markdown）
    workflow.ts                   # Workflow 业务逻辑（DAG 校验/role 解析/Task 映射/运行时校验/CRUD）
    workflow-command-runner.ts    # Workflow Command 节点 shell 命令执行器
    file.ts                       # 文件读写服务
    channel.ts                    # 频道服务
    message.ts                    # 消息服务（游标分页）
    issue.ts                      # 议题服务
    issue-comment.ts              # 议题评论 CRUD 服务
    issue-retry.ts                # Issue 启动恢复（recoverRunningWorkOnStartup）
    task.ts                       # 任务服务
    agent.ts                      # Agent 会话服务 + Preset 管理 + 连接测试 + 模板管理 + Usage Dashboard
    auth-store.ts                 # Secret Key 认证存储（auth.json）
    builtin-tools/                # 内置 Function Call 工具子目录
      index.ts                    # 工具注册入口
      input-helpers.ts            # 统一输入校验（assertRecord/readRequiredString 等）
      issue-tools.ts              # Issue 工具实现
      command-tools.ts            # Command 工具实现
      database-tools.ts           # Database 工具实现
      kanban-tools.ts             # Kanban 工具实现
    tool-detail.ts                # 工具调用详情持久化（懒加载）
    llm-model-config.ts           # LLM 模型配置读取（思考模式）
    pty.ts                        # PTY 终端会话管理
    search.ts                     # 代码搜索服务（ripgrep + Node.js + 文件名搜索）
    gitignore.ts                  # .gitignore 解析过滤器
    command.ts                    # 快捷命令 CRUD 服务
    command-process-manager.ts    # 快捷命令进程生命周期管理
    skill.ts                      # 全局技能管理服务
    mcp.ts                        # 全局 MCP 配置管理服务
    notification-center.ts        # 应用内通知 CRUD + WebSocket 推送
    code-favorites.ts             # 代码收藏 CRUD 服务
    prompt-template.ts            # Prompt 模板 CRUD + 批量应用
    persistent-agent-context.ts   # 持久上下文自动加载（CLAUDE.md/AGENTS.md）
    hook-engine.ts                # Hook 引擎（规则匹配/命令执行/wrapOnEventWithHooks）
    output-style.ts               # 输出风格模板管理 + resolveOutputStyleContent
    ai-text.ts                    # 通用 AI 文本请求（Anthropic/OpenAI/Gemini 统一接口）
    generated-title.ts            # AI 标题生成调度（频道/Issue）
    version.ts                    # 版本检查 + 自更新脚本生成
    execution-manager.ts           # WorkFox DAG 执行引擎（1393行，循环/分支/变量/断点/恢复 + Plugin 节点集成）
    interaction-manager.ts         # 交互管理器（alert/prompt/form/table_confirm）
    workflow-trigger-service.ts    # Workflow 触发器（cron + webhook）
    worktree.ts                   # Worktree 服务（创建/删除/Diff/PR）
    robot-account.ts              # Robot Account 凭证服务
    agent-commands.ts             # Agent Commands 服务
    plugin.ts                     # Plugin 插件管理服务（安装/启用/禁用/配置/沙箱加载/节点注册）
    database-vector.ts            # 文档向量搜索（Embedding 索引 + 相似度查询）
    kanban.ts                     # Kanban 看板服务
    git-operation-log.ts          # Git 操作日志（内存 Map）
    global-wechat-qr.ts           # 全局企微 QR Code 登录
    subscription/                 # 订阅管理子目录
      base.ts                     # SubscriptionProviderBase 抽象类
      index.ts                    # 供应商注册 + fetchQuota 统一入口
      zhipu.ts                    # 智谱配额查询
      minimax.ts                  # MiniMax Coding Plan 配额查询
      aicode.ts                   # AI Code 余额查询
    speech-recognition/           # 语音识别子目录
      base.ts                     # SpeechRecognitionProviderBase + SpeechRecognitionSession 接口
      index.ts                    # 供应商注册 + createSession 统一入口
      tencent.ts                  # 腾讯语音实时识别实现
    notification-hub/             # 通知中心子目录（14 文件）
      index.ts                    # 公开 API 重导出
      types.ts                    # 类型定义、常量、共享状态
      service.ts                  # 服务生命周期管理
      events.ts                   # WS 事件 -> 通知信封映射
      format.ts                   # 消息格式化
      helpers.ts                  # 持久化辅助函数
      lark-api.ts                 # Lark 消息去重、解析
      lark-adapter.ts             # LarkNotificationAdapter
      wechat-api.ts               # WeChat HTTP API + QR Code 登录
      wechat-adapter.ts           # WeChatNotificationAdapter
      bot-agent.ts                # Bot Agent 执行与上下文构建
      bot-commands.ts             # 16 个内置斜杠命令
  storage/
    json-store.ts                 # JSON 文件读写通用工具
    workspace-store.ts            # Workspace 持久化
    workflow-store.ts             # Workflow 持久化（JSON 文件）
    issue-store.ts                # Issue 持久化
    task-store.ts                 # Task 持久化
    agent-store.ts                # Agent Session + Usage SQLite 持久化（含费用估算）
    llm-store.ts                  # LLM 模型与供应商持久化
    command-store.ts              # 快捷命令持久化
    code-favorites-store.ts       # 代码收藏持久化
    hook-store.ts                 # Hook 配置持久化
    subscription-store.ts         # 订阅配置持久化
    speech-recognition-store.ts   # 语音识别配置持久化
    user-settings-store.ts        # 用户设置持久化
    database-store.ts             # 文档数据库 SQLite 持久化
    kanban-store.ts               # Kanban 看板 SQLite 持久化
    worktree-store.ts             # Worktree 持久化
    robot-account-store.ts        # Robot Account 持久化
    usage.ts                      # Token usage 输出文本解析
  adapters/
    git.ts                        # simple-git 封装（status, diff, log, clone, commit, push, pull）
    agent-runtime.ts              # Agent 运行时工厂（按 kind 创建运行时，6 种）
    agent-runtime-types.ts        # Agent 运行时接口定义（AgentRuntime, AgentRunResult, AgentRuntimeEvent, AgentFunctionTool）
    open-agent-sdk-runtime.ts     # @codeany/open-agent-sdk 运行时实现
    langchain-runtime.ts          # LangChain.js 运行时实现
    codex-runtime.ts              # @openai/codex-sdk 运行时实现（Codex CLI 包装）
    codex-function-tool-bridge.ts # MCP Server 桥接 AgentFunctionTool -> MCP Tool
    hermes-runtime.ts             # Hermes CLI 外部进程运行时
    oh-my-pi-runtime.ts           # omp CLI 外部进程运行时
    claude-code-runtime/          # ClaudeCodeRuntime 子模块（7 文件）
      index.ts                    # ClaudeCodeRuntime 主类
      sdk-config.ts               # SDK 配置构建
      adapter-pool.ts             # Bridge 引用计数式复用池
      anthropic-bridge.ts         # HTTP Bridge 服务器
      protocol-converter.ts       # Anthropic <-> OpenAI 协议转换
      message-format.ts           # SDK 消息格式化与事件提取
      types.ts                    # Bridge 类型定义
  agents/
    agent-context.ts              # Agent 上下文接口（broadcast, getSession, updateSessionStatus）
    scheduler-agent.ts            # 调度者（定时 tick 发现 draft/changes_requested Issue）
    issue-task-controller.ts      # 任务控制器（Task Creator + Workflow Task 创建 + 依赖调度 + Executor 启动）
    issue-agent-runner.ts         # Issue 自动化入口（runIssueAutomation：Workflow 优先，无 workflow 则 error）
    issue-agent-progress.ts       # Agent 进度管理（创建/更新 channel message + issue comment）
    agent-message-parts.ts        # 结构化消息 Parts 构建（chain/tool-detail/usage/text 解析）
    commit-agent.ts               # 提交者（自动生成 conventional commit message）
    pull-request-agent.ts         # PR Agent（AI 生成 PR 描述）
    agent-designer.ts             # AI Agent 预设生成器
    title-generator-agent.ts      # AI 标题生成 Agent
  ws/
    handler.ts                    # WebSocket 事件路由中心（@mention + 实时消息）
    agent-runner.ts               # @mention Agent 运行器（从 handler 提取）
    message-parts.ts              # 消息 Parts 构建管线
    agent-prompt.ts               # Agent Prompt 构建（含持久上下文注入）
    terminal-handler.ts           # 终端事件处理
    connection-manager.ts         # WebSocket 连接管理 + 广播
    html-utils.ts                 # HTML 文本清理工具
    typescript-lsp.ts             # TypeScript LSP WebSocket handler
  hooks/
    agent-hooks.ts                # Agent Hook 链（executor 完成 -> reviewer）
  types/
    node-sqlite.d.ts              # node:sqlite 类型声明
```

## 测试与质量

当前无自动化测试。通过 TypeScript 编译和手动 API 测试验证。

## 常见问题 (FAQ)

- **Q: node-pty 编译失败？** A: 运行 `npx node-gyp rebuild --directory=node_modules/node-pty`，需要 Xcode Command Line Tools。
- **Q: 数据存在哪里？** A: 默认 `~/.agent-spaces-data/`，Agent Session/Usage 使用 SQLite（`agents/agents.sqlite`），Workflow 使用 JSON 文件（`workspaces/`），Hook 使用 `.hook.json` 文件（`workspaces/{id}/hooks/`），其余为 JSON 文件。
- **Q: 如何选择 Agent 运行时？** A: 在 Agent Preset 中设置 `runtimeKind`：`open-agent-sdk`（默认）、`claude-code`、`codex`、`langchain`、`hermes` 或 `oh-my-pi`。
- **Q: Codex 运行时有什么限制？** A: 详见 `docs/codex-runtime-limitations.md`，主要涉及 maxTurns 不对等、Skills 格式转换、MCP 配置差异等。
- **Q: Anthropic Bridge 是什么？** A: ClaudeCodeRuntime 内置的协议中转层，让 Claude Code SDK 调用 OpenAI Chat/Responses API，详见 `docs/anthropic-bridge.md`。
- **Q: LangChain 运行时和 OpenAgentSdk 有什么区别？** A: LangChain 使用 langchain.js 的 createAgent API，自动适配 OpenAI/Anthropic/Google 等供应商，通过环境变量注入凭证。
- **Q: OhMyPi 运行时是什么？** A: 基于 @oh-my-pi/pi-coding-agent SDK 的进程适配运行时。由于 SDK 是 Bun-native，server 通过 CLI 进程边界与其通信，支持 CodexFunctionToolBridge MCP 桥接。
- **Q: Agent SSE API 如何使用？** A: `POST /api/agent-sse/run`，body 传 `{ agentId, message, key? }`，响应为 SSE 流。支持 Bearer Token、x-agent-spaces-key Header 或 key Body 参数认证。
- **Q: 工具详情如何持久化？** A: 保存到 `tool-details.json`，前端通过 `GET /api/workspaces/:id/channels/:channelId/messages/:messageId/tool-details/:detailId` 懒加载。
- **Q: Agent 连接测试支持哪些供应商？** A: anthropic-messages、openai-chat-completions、openai-responses、openai-responses-to-anthropic-messages、openai-chat-completions-to-anthropic-messages、gemini-generate-content。
- **Q: 如何配置通知？** A: 在项目设置面板中启用通知，选择平台（飞书/企微），配置凭证，选择通知事件和 Bot Agent。
- **Q: 如何添加新的通知平台？** A: 实现 `BotAdapter` 接口，在 `service.ts` 中分发，详见 `docs/bot-notification-workflow.md`。
- **Q: 费用如何计算？** A: 优先使用 runtime 提供的原始 costUsd，否则按 LLMModel.cost 配置计算，详见 `docs/model-usage-accounting.md`。
- **Q: 认证 Secret Key 在哪设置？** A: 首次访问登录页时输入，存储在 `~/.agent-spaces-data/auth.json`。默认为空字符串（无需认证）。
- **Q: Workflow 如何与 Issue 关联？** A: Issue 的 `workflowId` 字段绑定 Workflow 模板，Issue 自动化入口读取该字段决定执行路径。
- **Q: 订阅管理支持哪些供应商？** A: 智谱（ZhiPu）、MiniMax、AI Code。通过 `SubscriptionProviderBase` 抽象可扩展。
- **Q: 语音识别如何配置？** A: 通过 API 或前端设置页配置腾讯语音凭证，前端通过 WebSocket `/ws/speech` 实时发送音频流。
- **Q: 快捷命令的 autoRestart 是什么？** A: 进程意外退出时自动重启，通过 `command-process-manager.ts` 管理。
- **Q: 持久上下文是如何工作的？** A: `persistent-agent-context.ts` 自动扫描工作空间中 CLAUDE.md/AGENTS.md 文件，按优先级从低到高拼接到 Agent prompt 前。详见 `docs/persistent-agent-context.md`。
- **Q: TypeScript LSP 如何工作？** A: 前端通过 `/ws/lsp/typescript` WebSocket 连接后端，后端为每个连接启动 `typescript-language-server --stdio` 子进程，提供定义跳转/引用/诊断。详见 `docs/monaco-typescript-lsp.md`。
- **Q: DOM Inspector 如何使用？** A: 被调试项目安装 dom-inspector-hook，Alt+Shift 点击元素发送 POST `/api/inspector/track`，后端通过 WebSocket 广播 `inspector.jump` 事件，前端 Monaco 打开对应源文件。详见 `docs/dom-inspector-integration.md`。
- **Q: 代码收藏如何使用？** A: 前端 Monaco 右键菜单"添加到代码收藏"，通过 `POST /api/workspaces/:id/code-favorites` 保存，收藏面板查看/跳转/删除。
- **Q: Prompt 模板如何使用？** A: `POST /api/prompt-templates` 创建模板，`POST /api/prompt-templates/:id/apply` 批量应用到指定 Agent 的 systemPrompt。
- **Q: Hook 系统如何工作？** A: 在工作空间设置中创建 Hook 配置（JSON），定义 PreToolUse/PostToolUse 规则。Agent 执行工具时通过 `wrapOnEventWithHooks()` 触发匹配的 Hook 动作（shell command）。详见 `docs/superpowers/specs/2026-05-20-hook-system-design.md`。
- **Q: 输出风格如何使用？** A: 通过 `POST /api/output-styles` 创建输出格式模板（Markdown），Agent 运行时通过 `resolveOutputStyleContent()` 将模板内容注入 systemPrompt。
- **Q: AI 标题生成如何工作？** A: 频道创建和 Issue 创建时，后端异步调用 Title Generator Agent（使用 `requestAiText()`）生成标题，完成后通过 WebSocket 推送更新。
- **Q: 通用 AI 文本请求层是什么？** A: `services/ai-text.ts` 提供统一的 `requestAiText()` 接口，自动路由 Anthropic/OpenAI/Gemini 三种供应商，供标题生成、Agent Designer 等功能使用。

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-06-04T23:38:49+08:00 | 增量更新 | **Plugin 插件系统**（新增 services/plugin.ts 299行，插件全生命周期管理 + CJS 沙箱加载 + 自定义 Workflow 节点注册与执行；新增 routes/plugin.ts，8 个 REST API 端点）；**execution-manager 扩展**（集成 Plugin 节点执行，canExecuteWorkflowNode/executeWorkflowNode，1393行）；**文件数 156->158** |
| 2026-06-03T23:00:29+08:00 | 增量更新 | **WorkFox DAG 执行引擎**（新增 services/execution-manager.ts 1321行，支持循环/分支/变量/断点/恢复）；**交互管理器**（新增 services/interaction-manager.ts，alert/prompt/form/table_confirm 交互）；**Workflow 触发器**（新增 services/workflow-trigger-service.ts，cron + webhook 触发）；**执行通道**（新增 ws/execution-channels.ts，WebSocket 执行通道注册）；**Workflow Webhook Hook**（新增 routes/workflow-hook.ts，SSE 流式结果）；**数据导入导出**（新增 routes/data.ts + routes/import.ts，ZIP 归档 15+ 数据类别 + cc-switch 数据迁移）；**notification-hub 扩展**（新增 bot-commands.ts/events.ts/format.ts/helpers.ts 4 文件）；**新增 services/global-wechat-qr.ts/issue-retry.ts/workspace-prompt.ts**；**新增 ws/agent-prompt.ts**；**新增 storage/user-settings-store.ts**；**文件数 149->156** |
| 2026-06-02T09:07:04+08:00 | 增量更新 | **第六运行时 OhMyPi**（新增 adapters/oh-my-pi-runtime.ts，基于 omp CLI 的进程适配运行时，支持 CodexFunctionToolBridge MCP 桥接）；**通用 AI 文本请求层**（新增 services/ai-text.ts，统一 Anthropic/OpenAI/Gemini 三种供应商的文本生成请求，含 URL 脱敏 maskAiTextUrl）；**AI 标题生成**（新增 services/generated-title.ts + agents/title-generator-agent.ts，频道/Issue 创建时自动异步生成标题，scheduleChannelTitleGeneration/scheduleIssueTitleGeneration）；**Workflow Command Runner**（新增 services/workflow-command-runner.ts，Command 节点的 shell 命令执行器 executeCommandNode）；**Agent 运行时接口增强**（agent-runtime-types.ts 新增 AgentRunOptions/appendOutputStyleToPrompt/summarizeResult）；**文件数 144->149** |
| 2026-05-28T14:35:28+08:00 | 增量更新 | **版本自更新系统**（新增 services/version.ts + routes/version.ts）；**CodexFunctionToolBridge**（新增 adapters/codex-function-tool-bridge.ts）；**PTY 服务提取**（新增 services/pty.ts）；**Workspace 服务**（新增 services/workspace.ts）；**Git 路由大幅扩展**（routes/git.ts 高级 Git 操作 + withLog 包装器）；**notification-hub 提取**（新增 service.ts + bot-agent.ts）；**文件数 138->144** |
| 2026-05-25T22:19:18+08:00 | 增量更新 | **第五运行时 Hermes**；**Worktree 系统**；**Robot Account**；**Agent Commands**；**Workflow Command 节点**；**内置工具拆分**；**文档数据库增强**；**Git 操作日志**；**字体管理 API**；**文件数 128->138** |
| 2026-05-22T12:52:36+08:00 | 增量更新 | **Kanban 看板系统** + **Notion 风格文档数据库** + **Issue 服务层独立**；**文件数 118->128** |
| 2026-05-20T14:08:52+08:00 | 增量更新 | **Hook 系统** + **输出风格管理** + **Issue Task Controller 拆分** + **Agent 运行时接口提取** + **Bot Agent 提取**；**文件数 113->118** |
| 2026-05-19T09:45:03+08:00 | 增量更新 | **代码收藏** + **Prompt 模板管理** + **TypeScript LSP** + **持久上下文加载** + **DOM Inspector**；**文件数 106->113** |
| 2026-05-16T17:36:40+08:00 | 增量更新 | **第四运行时 LangChain** + **订阅管理** + **语音识别** + **快捷命令** + **代码搜索** + **Agent SSE API** + **Agent Designer** + **应用内通知** + **Skill/MCP 管理**；**文件数 73->106** |
| 2026-05-08T17:18:31+08:00 | 增量更新 | **Workflow 系统**；**文件数 70->73** |
| 2026-05-05T23:52:43+08:00 | 增量更新 | 认证系统、通知中心 12 文件、Commit Agent、Issue Runner 重构、ClaudeCodeRuntime 拆分为 7 文件子模块、SQLite Agent Usage |
| 2026-05-04T21:04:42+08:00 | 增量更新+补扫 | 三运行时、Anthropic Bridge、runMentionedAgent 深度流程、Issue 自动化编排链路重构、Function Call Tools |
| 2026-05-02T23:43:41 | 增量更新 | 补充双运行时架构、Agent Preset 系统、LLM 管理、API 路由全量更新 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
