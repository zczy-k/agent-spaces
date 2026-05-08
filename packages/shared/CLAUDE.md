[根目录](../../CLAUDE.md) > [packages](../) > **shared**

# @agent-spaces/shared

## 模块职责

前后端共享的 TypeScript 类型定义包。定义了所有核心数据模型、WebSocket 事件契约、结构化消息 Parts、内置工具声明、通知设置、Agent 用量统计、Workflow 模板和接口类型，供 server 和 web 包共同引用。

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
| `types/workflow.ts` | `WorkflowTemplate`, `WorkflowNode`, `WorkflowEdge` | Workflow DAG 模板（节点绑定 Agent Preset，边定义执行依赖） |
| `types/events.ts` | `WSEvent<T>`, `ClientEventMap`, `ServerEventMap` | WebSocket 事件契约（含 workflow 事件） |

### AgentConfig 与 Role 体系

`AgentConfig` 是 Agent 预设的核心类型，包含：
- `role`: `AgentRole`（`BuiltInAgentRole | (string & {})`）
  - 内置 role：`agent`（默认通用）、`scheduler`（后台调度）、`task_creator`（任务创建）、`bot`（通知 Bot）
  - 支持任意自定义字符串（兼容旧 role 如 planner/executor/reviewer/commit/custom）
- `runtimeKind`: 'open-agent-sdk' | 'claude-code' | 'codex'（三运行时选择）
- `modelProvider`: 'anthropic-messages' | 'openai-chat-completions' | 'openai-responses' | 'openai-responses-to-anthropic-messages' | 'openai-chat-completions-to-anthropic-messages' | 'gemini-generate-content'
- `modelId`: 模型 ID（如 `claude-sonnet-4-6`）
- `apiBase` / `apiKey`: API 端点与密钥
- `workingDir`: Agent 工作目录
- `description`: Agent 描述
- `mcps`: MCP 服务器配置（JSON 对象）
- `skills`: 技能 markdown 文件名列表
- `tools`: 启用的内置工具名列表（`BuiltInAgentToolName[]`）
- `systemPrompt`: 系统提示词
- `temperature` / `maxTokens`: 生成参数
- `avatarUrl`: 头像 URL
- `sandboxDirs`: 沙箱目录列表
- `maxRetries`: 最大重试次数
- `templateId`: 标识由哪个模板创建（用于导入去重）
- `enabled`: 是否启用

### WorkflowTemplate 详情

Workflow 是 Issue 自动化的可视化 DAG 模板：
- `WorkflowTemplate`: 完整模板（id, name, description, nodes[], edges[], viewport, timestamps）
- `WorkflowNode`: 节点（type: 'agent', position, data: { label, agentConfigId, role, avatarUrl?, modelId?, taskTitleTemplate?, taskDescriptionTemplate? }）
- `WorkflowEdge`: 边（source -> target，表示 target 依赖 source 完成）

### WorkspaceNotificationSettings 详情

工作空间通知配置类型：
- `enabled`: 是否启用通知
- `provider`: 'lark' | 'wechat' | 'native'（通知平台，新增 native）
- `events`: 通知事件列表（issue_started / issue_completed / issue_task_completed）
- `serviceRunning`: 后端重启后是否自动恢复服务
- `botAgentId`: 普通用户消息交给哪个 bot agent 处理
- `lark`: 飞书配置（appId / appSecret / chatIds）
- `wechat`: 企微配置（token / baseUrl / accountId / userId / userIds / getUpdatesBuf）
- `native`: Native 通知配置（permissionGranted）

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
| `types/events.ts` | `ServerEventMap` | 服务端->客户端事件映射（23 个事件，含 workflow.created/updated/deleted） |

### 状态枚举

```
IssueStatus:  draft | planned | in_progress | review_pending | changes_requested | approved | completed | archived | error
TaskStatus:   pending | running | waiting_review | retrying | done | failed | cancelled
AgentStatus:  idle | active | blocked | completed | crashed
MessageStatus: pending | streaming | waiting_for_user | completed | error
TodoItemStatus: pending | in_progress | completed
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
- **Q: runtimeKind 有哪些选项？** A: `open-agent-sdk`（默认）、`claude-code`、`codex` 三种运行时。
- **Q: modelProvider 带 `to-anthropic-messages` 是什么？** A: 表示通过 Anthropic Bridge 中转，将 OpenAI Chat/Responses 请求转为 Anthropic Messages 协议，供 ClaudeCodeRuntime 使用。
- **Q: AgentConfig role 有哪些选项？** A: 内置 `agent`、`scheduler`、`task_creator`、`bot`，以及任意自定义字符串（兼容旧 role）。
- **Q: WorkspaceNotificationSettings 支持哪些平台？** A: 当前支持 `lark`（飞书）、`wechat`（企业微信）和 `native`（Tauri/Browser Notification）。
- **Q: WorkflowTemplate 和 Issue 的关系？** A: Issue 通过 `workflowId` 字段绑定 Workflow 模板，Issue 自动化入口会根据该字段选择执行路径。

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
      events.ts                 # WebSocket 事件契约（9个客户端事件 + 23个服务端事件，含 workflow 事件）
      llm.ts                    # LLMModel + LLMProvider + LLMModelCost + LLMThinkingEffort
      tool.ts                   # BUILT_IN_AGENT_TOOLS + BuiltInAgentToolName
      workflow.ts               # WorkflowTemplate + WorkflowNode + WorkflowEdge（DAG 模板定义）
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-08T17:18:31+08:00 | 增量更新 | 新增 workflow.ts（WorkflowTemplate/WorkflowNode/WorkflowEdge）、workspace.ts 新增 BuiltInAgentRole/AgentRole 类型（简化为 agent/scheduler/task_creator/bot + 自定义）、NotificationProvider 新增 'native'、WorkspaceNotificationSettings 新增 native 字段、Issue/CreateIssueInput 新增 workflowId 字段、events.ts ServerEventMap 新增 workflow.created/updated/deleted 事件（20->23 个） |
| 2026-05-05T23:52:43+08:00 | 增量更新 | workspace.ts 新增 WorkspaceNotificationSettings/NotificationProvider/NotificationEventKey（飞书/企微通知配置）、AgentConfig role 新增 commit/bot；agent.ts 新增 AgentUsageRecord/AgentUsageDashboard（SQLite 用量统计 + Dashboard 聚合）；llm.ts 新增 LLMModelCost/LLMThinkingEffort（模型成本配置 + 思考模式） |
| 2026-05-04T21:04:42+08:00 | 增量更新 | runtimeKind 新增 codex、modelProvider 新增两个 bridge 类型、AgentConfig 大幅扩展、新增 tool.ts、channel.ts 大幅扩展、issue.ts 新增 IssueComment 类型 |
| 2026-05-02T23:43:41 | 增量更新 | 补充 llm.ts 类型、AgentConfig 详细字段、WebSocket 事件数量更新 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
