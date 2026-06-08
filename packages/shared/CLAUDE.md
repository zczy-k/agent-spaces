[根目录](../../CLAUDE.md) > [packages](../) > **shared**

# @agent-spaces/shared

## 模块职责

前后端共享的 TypeScript 类型定义包。定义了所有核心数据模型、WebSocket 事件契约、结构化消息 Parts、内置工具声明、通知设置、Agent 用量统计、Workflow 模板、快捷命令、订阅管理、代码搜索、语音识别、应用内通知、代码收藏、Hook 配置、DocNode 文档数据库（含 DatabaseMeta/DatabaseVectorStats/DatabaseVectorIndexResult/DatabaseVectorSearchResult/DatabaseNodeVersion）、Kanban 看板、Worktree 并行开发等接口类型，供 server 和 web 包共同引用。

## 入口与启动

- **入口文件**：`src/index.ts` -- 汇总导出所有类型
- **构建命令**：`pnpm build`（编译到 `dist/`）
- **消费方式**：server 和 web 通过 `import type { ... } from '@agent-spaces/shared'` 引用

## 对外接口

### 数据模型类型

| 类型文件 | 导出类型 | 说明 |
|----------|----------|------|
| `types/workspace.ts` | `Workspace`, `AgentConfig`, `CreateWorkspaceInput`, `WorkspaceNotificationSettings`, `NotificationProvider`, `NotificationEventKey`, `BuiltInAgentRole`, `AgentRole` | 工作空间模型、Agent 配置（新 role 体系）、通知设置（飞书/企微/Native） |
| `types/issue.ts` | `Issue`, `IssueStatus`, `IssueComment`, `CreateIssueInput` | 议题模型（9 种状态，含 workflowId 字段）+ 评论模型 |
| `types/task.ts` | `Task`, `TaskStatus`, `TaskResult` | 任务模型（7 种状态） |
| `types/agent.ts` | `AgentSession`, `AgentSessionStatus`, `AgentUsageRecord`, `AgentUsageDashboard` | Agent 会话模型（5 种状态）+ 用量记录 + Dashboard 统计 |
| `types/channel.ts` | `Channel`, `TodoItem`, `Message`, `Attachment`, `MessagePart`, `MessageChain`, `MessageApproval`, `MessageTokenUsage`, `MessageTool`, `MessageMetadata` | 频道、消息、结构化消息 Parts |
| `types/file.ts` | `FileNode` | 文件树节点（递归结构） |
| `types/git.ts` | `GitFileStatus`, `GitStatusResult`, `GitLogEntry`, `GitDiffResult` | Git 操作结果类型 |
| `types/llm.ts` | `LLMModel`, `LLMProvider`, `LLMModelCost`, `LLMThinkingEffort` | LLM 模型（含成本配置、思考模式）与供应商 |
| `types/tool.ts` | `BUILT_IN_AGENT_TOOLS`, `BuiltInAgentToolName` | 内置 Agent 工具声明 |
| `types/workflow.ts` | `WorkflowTemplate`, `WorkflowNode`, `WorkflowEdge`, `WorkflowGroup`, `WorkflowFolder`, `ExecutionLog`, `ExecutionStep`, `EngineStatus` | Workflow DAG 模板（Unified Workflow Types from WorkFox，含分组/文件夹/执行日志/引擎状态） |
| `types/workflow-execution.ts` | `ExecutionEventChannel`, `WorkflowExecuteRequest`, `InteractionRequest` | Workflow 执行事件类型（执行请求 + 交互请求 + SSE 通道） |
| `types/workflow-errors.ts` | `BackendErrorCode`, `BackendErrorShape`, `ErrorEnvelope` | Workflow 错误码体系（结构化错误码 + 错误信封） |
| `types/workflow-plugin.ts` | `PluginInfo`, `PluginRuntimeType`, `PluginConfigField` | Workflow 插件类型（插件元信息 + 运行时类型 + 配置字段） |
| `types/workflow-composite.ts` | `LOOP`, `findWorkflowNode`, `getCompositeRootId` | Workflow 复合节点工具函数（循环节点常量 + 查找/根ID解析） |
| `types/workflow-shortcut.ts` | `ShortcutAction`, `ShortcutBinding`, `SHORTCUT_ACTIONS` | Workflow 快捷键类型（动作定义 + 绑定映射） |
| `types/workflow-ws.ts` | channel contracts, message types | Workflow WebSocket 协议类型（通道契约 + 消息类型） |
| `types/command.ts` | `QuickCommand`, `CommandProcess`, `CommandProcessEvent` | 快捷命令定义、运行进程状态、进程生命周期事件 |
| `types/subscription.ts` | `SubscriptionProvider`, `SubscriptionConfig`, `SubscriptionQuota`, `SubscriptionLimit` | 订阅管理（智谱/MiniMax/AICode 供应商 + 配额查询） |
| `types/search.ts` | `CodeSearchResult`, `FileSearchResult`, `SearchCodeOptions` | 代码搜索结果和查询选项 |
| `types/notification.ts` | `NotificationType`, `AppNotification` | 应用内通知类型和模型（issue_completed/issue_failed/task_completed/task_failed） |
| `types/speech.ts` | `SpeechRecognitionProvider`, `SpeechRecognitionConfig`, `SpeechRecognitionResult`, `TencentSpeechCredentials` | 语音识别配置和结果（腾讯语音） |
| `types/code-favorites.ts` | `CodeFavorite` | 代码收藏（id/path/line/column/endLine/endColumn/label/snippet/workspaceId） |
| `types/hooks.ts` | `HookConfig`, `HookRule` | Hook 配置（PreToolUse/PostToolUse 钩子，shell/webhook/script 动作） |
| `types/database.ts` | `DatabaseMeta`, `DatabaseVectorStats`, `DatabaseVectorIndexResult`, `DatabaseVectorSearchResult`, `DocNode`, `DatabaseNodeVersion`, `PRESET_COVERS` | 文档数据库元信息 + 向量搜索统计/索引/查询结果 + Notion 风格文档节点 + 节点版本历史（patch 级增量） + 预设封面 |
| `types/kanban.ts` | `KanbanBoard`, `KanbanColumn`, `KanbanTask`, `KanbanPriority`, `KanbanLayoutMode` | Kanban 看板系统（Board + Column + Task + 优先级 + 布局模式） |
| `types/worktree.ts` | `WorktreeInfo`, `WorktreeStatus`, `CreateWorktreeInput` | Git Worktree 并行开发（关联分支/Agent/Issue/Task/PR） |
| `types/events.ts` | `WSEvent<T>`, `ClientEventMap`, `ServerEventMap` | WebSocket 事件契约（含 workflow + command + notification + inspector + worktree 事件） |

### AgentConfig 与 Role 体系

`AgentConfig` 是 Agent 预设的核心类型，包含：
- `role`: `AgentRole`（`BuiltInAgentRole | (string & {})`）
  - 内置 role：`agent`（默认通用）、`scheduler`（后台调度）、`task_creator`（任务创建）、`bot`（通知 Bot）
  - 支持任意自定义字符串（兼容旧 role 如 planner/executor/reviewer/commit/custom）
- `runtimeKind`: 'open-agent-sdk' | 'claude-code' | 'codex' | 'langchain' | 'hermes' | 'oh-my-pi'（六运行时选择）
- `modelProvider`: 'anthropic-messages' | 'openai-chat-completions' | 'openai-responses' | 'openai-responses-to-anthropic-messages' | 'openai-chat-completions-to-anthropic-messages' | 'gemini-generate-content'
- `modelId`: 模型 ID（如 `claude-sonnet-4-6`）
- `apiBase` / `apiKey`: API 端点与密钥
- `workingDir`: Agent 工作目录
- `description`: Agent 描述
- `mcps`: MCP 服务器配置（JSON 对象）
- `skills`: 技能 markdown 文件名列表
- `tools`: 启用的内置工具名列表（`BuiltInAgentToolName[]`）
- `systemPrompt`: 系统提示词
- `outputStyle`: 输出风格模板名称
- `temperature` / `maxTokens`: 生成参数
- `avatarUrl` / `icon`: 头像 URL 或 emoji 图标
- `sandboxDirs`: 沙箱目录列表
- `maxRetries`: 最大重试次数
- `templateId`: 标识由哪个模板创建（用于导入去重）
- `enabled`: 是否启用

### DatabaseMeta 与 DocNode 体系

文档数据库类型层次：
- `DatabaseMeta`: 数据库元信息（id, workspaceId, name, description, embeddingModelId?, timestamps）
- `DocNode`: 文档节点（id, databaseId, title, icon, cover, content, parentId, timestamps, isTrash）
- `DatabaseNodeVersion`: 节点版本历史（id, nodeId, databaseId, title, patch: {start, deleteText, insertText}, oldContent, newContent, createdAt）
- `DatabaseVectorStats`: 向量索引统计（databaseId, embeddingModelId, indexedCount, nodeCount, lastIndexedAt）
- `DatabaseVectorIndexResult`: 索引构建结果（extends VectorStats + skippedCount）
- `DatabaseVectorSearchResult`: 向量搜索结果（nodeId, title, path, score, content, updatedAt）
- `PRESET_COVERS`: 7 种预设封面渐变色数组（linear-gradient）

### WorktreeInfo 详情

Git Worktree 并行开发类型：
- `WorktreeStatus`: 'active' | 'merged' | 'deleted'
- `CreateWorktreeInput`: 创建输入（name, branch?, agentId?, issueId?, taskId?）
- `WorktreeInfo`: 完整信息（id, workspaceId, name, branch, path, agentId?, issueId?, taskId?, prUrl?, status, timestamps）

### HookConfig 与 HookRule

Hook 配置系统：
- `HookConfig`: Hook 配置（name, description?, enabled, hooks: { PreToolUse?, PostToolUse? }）
- `HookRule`: 钩子规则（matcher: string, type: 'command' | 'webhook' | 'script', command?, url?, function?, timeout?）
- matcher 支持三种模式：`*` 通配、`/regex/` 正则、精确字符串匹配
- 遵循 Claude Code `hooks.json` 格式约定

### KanbanBoard 详情

Kanban 看板系统类型：
- `KanbanPriority`: 'low' | 'medium' | 'high'
- `KanbanLayoutMode`: 'horizontal' | 'vertical'
- `KanbanColumn`: 列（id, title, color, order）
- `KanbanTask`: 任务（id, title, description, priority, columnId, order, createdAt, dueDate?）
- `KanbanBoard`: 看板（id, workspaceId, title, layoutMode, columns[], tasks[], createdAt, updatedAt）

### CodeFavorite 详情

代码收藏系统：
- `CodeFavorite`: 收藏项（id, path, line, column, endLine, endColumn, label?, snippet?, createdAt, workspaceId）

### WorkflowTemplate 详情

Workflow 是 Issue 自动化的可视化 DAG 模板：
- `WorkflowTemplate`: 完整模板（id, name, description, nodes[], edges[], viewport, timestamps）
- `WorkflowNode`: 节点（type: 'agent' | 'command', position, data: { label, agentConfigId?, role?, avatarUrl?, modelId?, taskTitleTemplate?, taskDescriptionTemplate?, command?, cwd?, shell? }）
- `WorkflowEdge`: 边（source -> target，表示 target 依赖 source 完成）

### QuickCommand 与 CommandProcess

快捷命令系统：
- `QuickCommand`: 自定义命令定义（id, name, command, folder?, cwd?, shell?, env?, autoRestart?, timestamps）
- `CommandProcess`: 运行中进程状态（commandId, workspaceId, sessionId, status: 'running'|'stopping', startedAt, restartCount）
- `CommandProcessEvent`: 进程生命周期事件（commandId, sessionId?, workspaceId, exitCode?, restartCount?）

### SubscriptionProvider 与 SubscriptionQuota

订阅管理系统：
- `SubscriptionProvider`: 'zhipu' | 'minimax' | 'aicode'
- `SubscriptionConfig`: 供应商配置（id, provider, label, headers?, cookie?, timestamps）
- `SubscriptionQuota`: 配额查询结果（provider, label, limits[], fetchedAt）
- `SubscriptionLimit`: 单项配额（type, usage?, currentValue?, remaining?, percentage?, nextResetTime?, usageDetails?）

### CodeSearchResult 与 SearchCodeOptions

代码搜索系统：
- `CodeSearchResult`: 搜索结果（file, line, column, text, matchStart, matchLength）
- `FileSearchResult`: 文件搜索结果（path, name, type: 'file'|'directory'）
- `SearchCodeOptions`: 搜索选项（query, regex?, caseSensitive?, filePattern?, maxResults?）

### AppNotification 与 NotificationType

应用内通知系统：
- `NotificationType`: 'issue_completed' | 'issue_failed' | 'task_completed' | 'task_failed'
- `AppNotification`: 通知对象（id, workspaceId, type, title, description?, data, read, createdAt）

### SpeechRecognitionConfig 与 SpeechRecognitionResult

语音识别系统：
- `SpeechRecognitionProvider`: 'tencent'
- `SpeechRecognitionConfig`: 配置（id, provider, label, credentials, timestamps）
- `SpeechRecognitionResult`: 识别结果（text, isFinal, sliceType）
- `TencentSpeechCredentials`: 腾讯语音凭证（appId, secretId, secretKey）

### WorkspaceNotificationSettings 详情

工作空间通知配置类型：
- `enabled`: 是否启用通知
- `provider`: 'lark' | 'wechat' | 'native'（通知平台）
- `events`: 通知事件列表（issue_started / issue_completed / issue_task_completed / channel_agent_completed）
- `serviceRunning`: 后端重启后是否自动恢复服务
- `botAgentId`: 普通用户消息交给哪个 bot agent 处理
- `botMarkdown`: Bot 是否使用 Markdown 格式输出
- `robotAccountId`: 引用 Robot Account 凭证
- `lark`: 飞书配置（appId / appSecret / chatIds）
- `wechat`: 企微配置（token / baseUrl / accountId / userId / userIds / getUpdatesBuf）
- `native`: Native 通知配置（permissionGranted / androidOngoingTaskNotification）

### Issue.workflowId

Issue 类型新增 `workflowId?: string` 字段，用于绑定 Workflow 模板。创建/编辑 Issue 时可指定 Workflow，Issue 自动化入口会根据该字段选择执行路径。

### AgentUsageRecord 与 AgentUsageDashboard

Agent 用量统计类型：
- `AgentUsageRecord`: 单次 Agent 执行的完整用量记录（tokens + 费用 + 耗时）
- `AgentUsageDashboard`: Dashboard 聚合数据（totals / daily / byModel / recent）

### LLMModelCost

模型成本配置：
- `inputPerMillion`: 每 100 万 input tokens 的美元成本
- `outputPerMillion`: 每 100 万 output tokens 的美元成本

### MessagePart 结构化消息类型

AI 消息通过 `parts` 字段实现结构化展示：

| MessagePart type | 用途 | 关键字段 |
|------------------|------|----------|
| `text` | 最终结论文本 | `text` |
| `reasoning` | 思考过程 | `text`, `duration`, `status` |
| `chain` | 统一 chain 容器（AI 中间消息 + 工具步骤） | `chains: MessageChain[]` |
| `terminal` | 命令/终端输出 | `command`, `output`, `status` |
| `confirmation` | 工具权限确认 | `title`, `description`, `approval` |
| `context` | 上下文窗口/token 使用 | `usedTokens`, `maxTokens`, `modelId`, `usage` |
| `subagent` | Agent 自主调用的子 agent | `name`, `model`, `instructions`, `tools` |
| `ask_user_question` | Agent 向用户提问 | `question`, `choices`, `status`, `answer` |

### 内置工具

`BUILT_IN_AGENT_TOOLS` 声明了三个服务器端 function-call 工具：

| 工具名 | 用途 |
|--------|------|
| `CreateCurrentChannelIssue` | 为当前频道创建并绑定 Issue |
| `ViewCurrentChannelIssue` | 查看当前频道绑定的 Issue + 评论 + 任务 + 成员 + 可分配 Agent |
| `AddCurrentChannelComment` | 为当前频道绑定的 Issue 添加评论 |

### WebSocket 事件类型

| 类型文件 | 导出类型 | 说明 |
|----------|----------|------|
| `types/events.ts` | `WSEvent<T>` | WebSocket 事件基础结构 |
| `types/events.ts` | `ClientEventMap` | 客户端->服务端事件映射（9 个事件） |
| `types/events.ts` | `ServerEventMap` | 服务端->客户端事件映射（含 workflow + command + notification + inspector + worktree 事件） |

### 状态枚举

```
IssueStatus:  draft | planned | in_progress | review_pending | changes_requested | approved | completed | archived | error
TaskStatus:   pending | running | waiting_review | retrying | done | failed | cancelled
AgentStatus:  idle | active | blocked | completed | crashed
MessageStatus: pending | streaming | waiting_for_user | completed | error
TodoItemStatus: pending | in_progress | completed
WorktreeStatus: active | merged | deleted
```

## 关键依赖与配置

- **依赖**：无运行时依赖，仅 `typescript` 作为开发依赖
- **构建**：ESNext 模块 + ES2022 target + bundler 模块解析
- **产物**：`dist/index.js` + `dist/index.d.ts`（类型声明）

## 数据模型

本包不包含数据模型实现，仅定义类型接口。实际数据操作在 server 包的 `storage/` 和 `services/` 层。

## 测试与质量

当前无独立测试。类型正确性通过 server 和 web 的 TypeScript 编译间接验证。

## 常见问题 (FAQ)

- **Q: 为什么用 `workspace:*` 引用？** A: pnpm monorepo 内部包引用方式，指向本地 workspace 中的同名包。
- **Q: 修改类型后需要做什么？** A: 运行 `pnpm --filter @agent-spaces/shared build` 重新编译，server/web 会自动获得新类型。
- **Q: runtimeKind 有哪些选项？** A: `open-agent-sdk`（默认）、`claude-code`、`codex`、`langchain`、`hermes`、`oh-my-pi` 六种运行时。
- **Q: modelProvider 带 `to-anthropic-messages` 是什么？** A: 表示通过 Anthropic Bridge 中转，将 OpenAI Chat/Responses 请求转为 Anthropic Messages 协议，供 ClaudeCodeRuntime 使用。
- **Q: AgentConfig role 有哪些选项？** A: 内置 `agent`、`scheduler`、`task_creator`、`bot`，以及任意自定义字符串（兼容旧 role）。
- **Q: WorkspaceNotificationSettings 支持哪些平台？** A: 当前支持 `lark`（飞书）、`wechat`（企业微信）和 `native`（Tauri/Browser Notification）。
- **Q: WorkflowTemplate 和 Issue 的关系？** A: Issue 通过 `workflowId` 字段绑定 Workflow 模板，Issue 自动化入口会根据该字段选择执行路径。
- **Q: SubscriptionProvider 支持哪些供应商？** A: `zhipu`（智谱）、`minimax`（MiniMax）、`aicode`（AI Code）。
- **Q: SpeechRecognitionProvider 支持哪些供应商？** A: 当前仅 `tencent`（腾讯语音），通过 `SpeechRecognitionProviderBase` 抽象可扩展。
- **Q: QuickCommand 的 autoRestart 是什么？** A: 命令进程意外退出时自动重启。
- **Q: CodeFavorite 的 endLine/endColumn 有什么用？** A: 标记收藏的代码范围（可以是多行选中区域），前端显示时使用 label 和 snippet 预览。
- **Q: HookConfig 的 matcher 支持哪些格式？** A: `*` 匹配所有工具、`/regex/` 正则表达式匹配、精确字符串匹配工具名。
- **Q: DocNode 的 parentId 有什么用？** A: 实现树形文档结构，null 表示根节点，非 null 表示子文档。
- **Q: KanbanLayoutMode 有哪些选项？** A: `horizontal`（水平排列列）和 `vertical`（垂直排列列）。
- **Q: DatabaseMeta 和 DocNode 的关系？** A: DatabaseMeta 是数据库的元信息（名称、描述、Embedding 模型），DocNode 是数据库内的文档节点，通过 databaseId 关联。
- **Q: DatabaseNodeVersion 的 patch 字段含义？** A: 增量补丁（start 位置、删除文本、插入文本），用于版本差异对比和回滚。
- **Q: WorktreeInfo 的 prUrl 有什么用？** A: 记录 Worktree 创建的 Pull Request URL，用于追踪 PR 状态。

## 相关文件清单

```
packages/shared/
  package.json
  tsconfig.json
  src/
    index.ts                    # 汇总导出
    types/
      index.ts                  # 类型汇总导出
      workspace.ts              # Workspace + AgentConfig + BuiltInAgentRole + AgentRole + CreateWorkspaceInput + WorkspaceNotificationSettings + NotificationProvider + NotificationEventKey
      issue.ts                  # Issue（含 workflowId） + IssueStatus + IssueComment + CreateIssueInput（含 workflowId）
      task.ts                   # Task + TaskStatus + TaskResult
      agent.ts                  # AgentSession + AgentSessionStatus + AgentUsageRecord + AgentUsageDashboard
      channel.ts                # Channel + TodoItem + Message + Attachment + MessagePart + MessageChain + MessageMetadata
      file.ts                   # FileNode
      git.ts                    # Git 操作结果类型
      events.ts                 # WebSocket 事件契约
      llm.ts                    # LLMModel + LLMProvider + LLMModelCost + LLMThinkingEffort
      tool.ts                   # BUILT_IN_AGENT_TOOLS + BuiltInAgentToolName
      workflow.ts               # WorkflowTemplate + WorkflowNode + WorkflowEdge + WorkflowGroup + WorkflowFolder + ExecutionLog + ExecutionStep + EngineStatus（Unified Workflow Types from WorkFox）
      workflow-execution.ts     # ExecutionEventChannel + WorkflowExecuteRequest + InteractionRequest（执行事件类型）
      workflow-errors.ts        # BackendErrorCode + BackendErrorShape + ErrorEnvelope（错误码体系）
      workflow-plugin.ts        # PluginInfo + PluginRuntimeType + PluginConfigField（插件类型）
      workflow-composite.ts     # LOOP + findWorkflowNode + getCompositeRootId（复合节点工具函数）
      workflow-shortcut.ts      # ShortcutAction + ShortcutBinding + SHORTCUT_ACTIONS（快捷键类型）
      workflow-ws.ts            # WebSocket 协议类型（channel contracts + message types）
      command.ts                # QuickCommand + CommandProcess + CommandProcessEvent（快捷命令）
      subscription.ts           # SubscriptionProvider + SubscriptionConfig + SubscriptionQuota + SubscriptionLimit（订阅管理）
      search.ts                 # CodeSearchResult + FileSearchResult + SearchCodeOptions（代码搜索）
      notification.ts           # NotificationType + AppNotification（应用内通知）
      speech.ts                 # SpeechRecognitionProvider + SpeechRecognitionConfig + SpeechRecognitionResult + TencentSpeechCredentials（语音识别）
      code-favorites.ts         # CodeFavorite（代码收藏）
      hooks.ts                  # HookConfig + HookRule（Hook 系统）
      database.ts               # DatabaseMeta + DatabaseVectorStats + DatabaseVectorIndexResult + DatabaseVectorSearchResult + DocNode + DatabaseNodeVersion + PRESET_COVERS（文档数据库）
      kanban.ts                 # KanbanBoard + KanbanColumn + KanbanTask + KanbanPriority + KanbanLayoutMode（Kanban 看板）
      worktree.ts               # WorktreeInfo + WorktreeStatus + CreateWorktreeInput（Worktree 并行开发）
```

## 变更记录 (Changelog)