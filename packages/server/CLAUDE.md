[根目录](../../CLAUDE.md) > [packages](../) > **server**

# @agent-spaces/server

## 模块职责

Express 5 后端服务，提供 REST API、WebSocket 实时通信、三运行时 Agent 编排引擎（OpenAgentSdk / ClaudeCode / Codex）、Anthropic Bridge 协议中转、PTY 终端管理、文件系统操作、Git 操作、LLM 模型/供应商管理、Agent Preset 管理、内置 Function Call 工具、Issue 评论、工具详情持久化能力。作为整个平台的核心运行时，管理 Workspace 生命周期、Issue/Task 状态机（含依赖调度）、Agent 会话调度和数据持久化。

## 入口与启动

- **入口文件**：`src/app.ts`
- **启动命令**：`pnpm dev`（tsx watch 热重载）或 `pnpm start`（编译后运行）
- **默认端口**：`3100`（可通过 `PORT` 环境变量修改）
- **数据目录**：`~/.agent-spaces-data`（可通过 `AGENT_SPACES_DATA_DIR` 修改）

## 对外接口

### REST API 路由表

所有路由挂载在 `/api/` 下：

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/upload/avatar` | POST | 上传 Agent 头像（base64 dataUrl） |
| `/api/workspaces` | GET/POST | 列出/创建工作空间 |
| `/api/workspaces/:id` | GET/PUT/DELETE | 获取/更新/删除工作空间 |
| `/api/workspaces/:id/files/tree` | GET | 获取文件树（支持 `?path=` 参数） |
| `/api/workspaces/:id/files/content` | GET/PUT | 读取/写入文件内容 |
| `/api/workspaces/:id/channels` | GET/POST | 列出/创建频道 |
| `/api/workspaces/:id/channels/:channelId/messages` | GET/POST | 获取/发送消息 |
| `/api/workspaces/:id/channels/:channelId/messages/:messageId/tool-details/:detailId` | GET | 获取工具调用详情（懒加载） |
| `/api/workspaces/:id/issues` | GET/POST | 列出/创建议题 |
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
| `/api/workspaces/:id/git/status` | GET | Git 状态 |
| `/api/workspaces/:id/git/diff` | GET | Git diff（支持 `?path=` 参数） |
| `/api/workspaces/:id/git/log` | GET | Git 日志 |
| `/api/models` | GET/POST | 列出/创建 LLM 模型 |
| `/api/models/:id` | PUT/DELETE | 更新/删除 LLM 模型 |
| `/api/providers` | GET/POST | 列出/创建 LLM 供应商 |
| `/api/providers/:id` | PUT/DELETE | 更新/删除 LLM 供应商 |

### WebSocket 事件

连接地址：`ws://localhost:3100/ws?workspaceId=<id>`

**客户端 -> 服务端事件**（7 个）：
- `terminal.create` / `terminal.input` / `terminal.resize` / `terminal.close`
- `channel.message`（支持 mentions 字段触发 @agent）
- `agent.start` / `agent.stop`

**服务端 -> 客户端事件**（20 个）：
- `connected` -- 连接确认
- `terminal.created` / `terminal.output` / `terminal.closed`
- `channel.message` / `channel.message.updated` / `channel.message.deleted` / `channel.messages.cleared` / `channel.updated`
- `agent.started` / `agent.status_changed` / `agent.output` / `agent.completed` / `agent.error`
- `issue.created` / `issue.updated` / `issue.status_changed`
- `task.created` / `task.updated` / `task.status_changed` / `task.output`

### Agent 运行时架构

支持三种运行时，通过 `createAgentRuntime(config)` 工厂函数按 `config.kind` 切换：

| 运行时 | kind 值 | SDK | 说明 |
|--------|---------|-----|------|
| `OpenAgentSdkRuntime` | `open-agent-sdk`（默认） | `@codeany/open-agent-sdk` | 进程内 Agent 循环，支持多 API 类型 |
| `ClaudeCodeRuntime` | `claude-code` | `@anthropic-ai/claude-agent-sdk` | 使用 Claude Code 运行时，支持文件创建/编辑，内置 Anthropic Bridge |
| `CodexRuntime` | `codex` | `@openai/codex-sdk` | 使用 OpenAI Codex CLI，支持沙箱/技能/MCP，详见 `docs/codex-runtime-limitations.md` |

三种运行时共享 `AgentRuntime` 接口（`execute` + `stop`），统一返回 `AgentRunResult`。

**运行时事件**：`AgentRuntimeEvent` 支持 `output`（普通输出行）、`tool_use`（工具调用详情）、`tool_result`（工具执行结果）三类事件，供结构化消息渲染使用。

### Anthropic Bridge

ClaudeCodeRuntime 内置协议中转能力，支持通过 Claude Code SDK 调用非 Anthropic 模型：
- `openai-chat-completions-to-anthropic-messages`：Anthropic Messages <-> OpenAI Chat Completions
- `openai-responses-to-anthropic-messages`：Anthropic Messages <-> OpenAI Responses

详见 `docs/anthropic-bridge.md`。

### Agent 编排流程

```
Scheduler (定时 tick)
  -> 发现 draft/changes_requested Issue -> 唤醒 Planner
    -> Planner: ViewCurrentChannelIssue + 分析 -> Task Creator
      -> Task Creator: ViewCurrentChannelIssue + ReplaceIssueTasks -> 依赖调度
        -> Executor(s): ViewCurrentChannelIssue + 执行 -> Hook 触发 Reviewer
          -> Reviewer: ViewCurrentChannelIssue + 审核 -> 依赖调度
            -> 所有 Task done -> Issue completed

频道 @mention 触发:
  channel.message (含 mentions)
    -> runMentionedAgent() -> AgentRuntime.execute() -> 结构化消息实时推送
```

**编排关键变更**：
- Task Creator 阶段独立于 Planner，使用 `custom` agent 或复用 planner
- `ReplaceIssueTasks` 工具支持稳定 key 和 `dependsOnKeys`，自动映射为真实 task id
- 依赖调度器按 DAG 顺序串行执行 runnable tasks
- 每个 agent 阶段都通过 `issue-agent-progress.ts` 创建进度消息和评论

### Function Call 工具层

服务器端 function-call 工具抽象，定义在 `AgentFunctionTool` 接口：
- `CreateCurrentChannelIssue`：为当前频道创建并绑定 Issue
- `ViewCurrentChannelIssue`：查看当前 Issue + 评论 + 任务 + 成员 + 可分配 Agent
- `AddCurrentChannelComment`：为当前 Issue 添加评论
- `ReplaceIssueTasks`：替换当前 Issue 的任务列表（仅 Task Creator）

详见 `docs/function-call-tools.md`。

### Agent Preset 系统

- **全局模板**：存储在 `~/.agent-spaces-data/agent-templates/{agentId}/`
- **工作空间预设**：存储在 `workspace.agents` 数组 + `{agentspaceDir}/agents/{agentId}/`
- **连接测试**：支持 anthropic-messages / openai-chat-completions / openai-responses / openai-responses-to-anthropic-messages / openai-chat-completions-to-anthropic-messages / gemini-generate-content
- **技能系统**：Markdown 文件存储在 `skills/` 目录，运行时可通过 `allowedTools` 映射 MCP 工具
- **头像**：通过 `POST /api/upload/avatar` 上传 base64 图片

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
| `@codeany/open-agent-sdk` | Agent 运行时 SDK（进程内执行） |
| `@anthropic-ai/claude-agent-sdk` | Claude Code Agent 运行时 SDK |
| `@openai/codex-sdk` | Codex Agent 运行时 SDK |
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

数据存储在 `AGENT_SPACES_DATA_DIR` 目录下，全部使用 JSON 文件：

```
~/.agent-spaces-data/
  workspaces/
    index.json                    # 所有 Workspace 列表
    {workspaceId}/
      workspace.json              # Workspace 详情
      channels/
        index.json                # 频道列表
        {channelId}/
          messages.json           # 频道消息
          tool-details.json       # 工具调用详情（懒加载）
      issues/
        index.json                # 议题列表
        {issueId}.json            # 议题详情
        {issueId}.comments.json   # 议题评论
      tasks/
        index.json                # 任务列表
        {taskId}.json             # 任务详情
      agents/
        index.json                # Agent 会话列表
        {sessionId}.json          # Agent 会话详情
  agent-templates/
    {agentId}/
      agent.json                  # Agent 预设模板
      mcp.json                    # MCP 配置
      skills/
        *.md                      # 技能文件
  llm/
    models.json                   # LLM 模型列表
    providers.json                # LLM 供应商列表
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
  app.ts                          # Express 入口，路由注册，WebSocket 服务，头像上传
  routes/
    workspace.ts                  # Workspace CRUD 路由
    file.ts                       # 文件系统路由
    channel.ts                    # 频道与消息路由
    issue.ts                      # 议题路由
    task.ts                       # 任务路由
    agent.ts                      # Agent 会话 + Preset CRUD + 连接测试 + 模板导入路由
    git.ts                        # Git 操作路由
    llm.ts                        # LLM 模型与供应商 CRUD 路由
  services/
    workspace.ts                  # Workspace 服务（含 .agentspace 初始化）
    file.ts                       # 文件读写服务
    channel.ts                    # 频道服务
    message.ts                    # 消息服务（游标分页）
    issue.ts                      # 议题服务
    issue-comment.ts              # 议题评论 CRUD 服务
    task.ts                       # 任务服务
    agent.ts                      # Agent 会话服务 + Preset 管理 + 连接测试 + 模板管理
    builtin-tools.ts              # 内置 Function Call 工具（CreateCurrentChannelIssue/ViewCurrentChannelIssue/AddCurrentChannelComment）
    tool-detail.ts                # 工具调用详情持久化（懒加载）
    pty.ts                        # PTY 终端会话管理
  storage/
    json-store.ts                 # JSON 文件读写通用工具
    workspace-store.ts            # Workspace 持久化
    issue-store.ts                # Issue 持久化
    task-store.ts                 # Task 持久化
    agent-store.ts                # AgentSession 持久化
    llm-store.ts                  # LLM 模型与供应商持久化
  adapters/
    git.ts                        # simple-git 封装（status, diff, log）
    agent-runtime.ts              # Agent 运行时工厂（按 kind 创建运行时，3 种）
    agent-runtime-types.ts        # Agent 运行时接口定义（AgentRuntime, AgentRunResult, AgentRuntimeEvent, AgentFunctionTool, AgentRuntimeKind）
    open-agent-sdk-runtime.ts     # @codeany/open-agent-sdk 运行时实现
    claude-code-runtime.ts        # @anthropic-ai/claude-agent-sdk 运行时实现 + Anthropic Bridge
    codex-runtime.ts              # @openai/codex-sdk 运行时实现（Codex CLI 包装）
  agents/
    agent-context.ts              # Agent 上下文接口（broadcast, getSession, updateSessionStatus）
    scheduler-agent.ts            # 调度者（定时 tick 发现 draft/changes_requested Issue）
    planner-agent.ts              # 策划者（分析 Issue + 调用 Task Creator）
    issue-task-controller.ts      # 任务控制器（Task Creator + 依赖调度 + Executor 启动）
    issue-agent-progress.ts       # Agent 进度管理（创建/更新 channel message + issue comment）
    agent-message-parts.ts        # 结构化消息 Parts 构建（chain/tool-detail/usage/text 解析）
    reviewer-agent.ts             # 审核者（审核执行结果）
  ws/
    handler.ts                    # WebSocket 事件路由 + @mention 触发 Agent + 实时消息 Parts 更新
    terminal-handler.ts           # 终端事件处理
    connection-manager.ts         # WebSocket 连接管理 + 广播
  hooks/
    agent-hooks.ts                # Agent Hook 链（executor 完成 -> reviewer）
```

## 测试与质量

当前无自动化测试。通过 TypeScript 编译和手动 API 测试验证。

## 常见问题 (FAQ)

- **Q: node-pty 编译失败？** A: 运行 `npx node-gyp rebuild --directory=node_modules/node-pty`，需要 Xcode Command Line Tools。
- **Q: 数据存在哪里？** A: 默认 `~/.agent-spaces-data/`，可通过环境变量修改。
- **Q: 如何选择 Agent 运行时？** A: 在 Agent Preset 中设置 `runtimeKind`：`open-agent-sdk`（默认）、`claude-code` 或 `codex`。
- **Q: Codex 运行时有什么限制？** A: 详见 `docs/codex-runtime-limitations.md`，主要涉及 maxTurns 不对等、Skills 格式转换、MCP 配置差异等。
- **Q: Anthropic Bridge 是什么？** A: ClaudeCodeRuntime 内置的协议中转层，让 Claude Code SDK 调用 OpenAI Chat/Responses API，详见 `docs/anthropic-bridge.md`。
- **Q: 工具详情如何持久化？** A: 保存到 `tool-details.json`，前端通过 `GET /api/workspaces/:id/channels/:channelId/messages/:messageId/tool-details/:detailId` 懒加载。
- **Q: Agent 连接测试支持哪些供应商？** A: anthropic-messages、openai-chat-completions、openai-responses、openai-responses-to-anthropic-messages、openai-chat-completions-to-anthropic-messages、gemini-generate-content。
- **Q: 如何添加新的 Agent Preset？** A: 通过 API `POST /api/workspaces/:id/agents/presets` 或从全局模板导入 `POST /agents/from-templates`。
- **Q: Issue 自动化编排的完整链路是什么？** A: 详见 `docs/issue-agent-automation.md`。

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-04T21:04:42+08:00 | 增量更新 | 三运行时（新增 CodexRuntime + @openai/codex-sdk）、Anthropic Bridge 协议中转、Issue 自动化编排链路重构（TaskCreator + 依赖调度 + IssueComment + AgentProgress + AgentMessageParts）、Function Call Tools 内置工具层、工具详情持久化、头像上传 API、代码结构大幅更新（新增 7 个文件） |
| 2026-05-02T23:43:41 | 增量更新 | 补充双运行时架构、Agent Preset 系统、LLM 管理、@mention 触发、连接测试、API 路由全量更新、代码结构更新 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
