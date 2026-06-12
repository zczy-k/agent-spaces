# Store 索引

34 个 Zustand Store，管理前端全部状态。

| Store | 文件 | 说明 |
|-------|------|------|
| useAgentStore | `stores/agent.ts` | Agent Preset 列表 |
| useEditorStore | `stores/editor.ts` | 文件树、打开文件、代码编辑 |
| useTerminalStore | `stores/terminal.ts` | 多终端会话管理 |
| useChannelStore | `stores/channel.ts` | 频道与消息 |
| useIssueStore | `stores/issue.ts` | 议题列表与选中 |
| useTaskStore | `stores/task.ts` | 任务列表 |
| useGitStore | `stores/git.ts` | Git 状态与 Diff |
| useWorkspaceStore | `stores/workspace.ts` | 工作空间列表 |
| useLLMStore | `stores/llm.ts` | LLM 模型与供应商 |
| useWorkflowStore | `stores/workflow.ts` | Workflow 模板列表 |
| useWorkflowEditorStore | `stores/workflow-editor/` | Workflow DAG 编辑器（12 文件 slice 组合，详见下文） |
| useCommandStore | `stores/command.ts` | 快捷命令 CRUD + 运行/停止 |
| useCommandPalette | `stores/command-palette.ts` | Command Palette 注册/触发 |
| useNotificationStore | `stores/notification.ts` | 应用内通知 |
| useMobilePanelStore | `stores/mobile-panel.ts` | 移动端面板切换 |
| useCodeFavoritesStore | `stores/code-favorites.ts` | 代码收藏 |
| useInspectorHistoryStore | `stores/inspector-history.ts` | Inspector 历史记录 |
| useIframeTabs | `stores/iframe-tabs.ts` | Iframe Tab 管理 |
| useHookStore | `stores/hooks.ts` | Hook 配置管理 |
| useDatabaseStore | `stores/database.ts` | 文档数据库管理 |
| useKanbanStore | `stores/kanban.ts` | Kanban 看板管理 |
| useWorktreeStore | `stores/worktree.ts` | Worktree 管理 |
| useEditorSendStore | `stores/editor-send.ts` | Send to Issue/Channel |
| useActivityLogStore | `stores/activity-log.ts` | Agent 活动日志 |
| useContentUsageReport | `stores/content-usage-report.ts` | 内容用量报告 |
| useChatStore | `stores/chat.ts` | Chat 独立页面状态（787 行） |
| useKeyboardShortcuts | `stores/keyboard-shortcuts.ts` | 快捷键管理 |

## useWorkflowEditorStore 详解

`stores/workflow-editor/` 是 web 端最复杂的状态机，12 文件、9 个 slice 组合，按 workspace 缓存（`storeRegistry`）。

### 入口（`index.ts`）

- `getWorkflowEditorStore(workspaceId)` —— per-workspace 单例注册表
- `disposeWorkflowEditorStore(workspaceId)` —— 卸载
- 创建时合并 9 个 slice，并挂载 WS 事件监听：`workflow:execute:result/error`、`pause/resume/stop:result/error`、`debug-node:result/error` → 更新 `executionStatus` / `debugNodeStatus` / `debugNodeResult`

### 类型（`types.ts`）

- `WorkflowEditorState`（25 字段）+ `WorkflowEditorActions`（57 个 action）
- 关键状态：`currentWorkflow`、`executionStatus`、`pendingInteraction`、`isDirty`、`isPreview`、`undoStack/redoStack`、`debugNodeId`
- `prePreviewRef`（闭包共享）—— 预览执行日志前快照原 workflow，退出时还原

### 9 个 slice

| Slice 文件 | 职责 |
|-----------|------|
| `crud.ts` | workflow / folder 列表加载与增删改 |
| `edit.ts` | 节点/边增删改、选中、右面板 tab、`markDirty`/`markClean` |
| `execution.ts` | WS 派发 `execute/pause/resume/stop/debug-node`，维护 `executionStatus`、debug 节点状态 |
| `execution-logs.ts` | 历史日志列表、`enterPreview`/`exitPreview`（配合 prePreviewRef） |
| `versions.ts` | 版本 save / restore / delete |
| `staging.ts` | 节点暂存（copy/move/paste，跨 workflow 复用） |
| `undo-redo.ts` | 操作历史栈 + `restoreToStep(index)` 跳转 |
| `groups.ts` | 节点分组（lock / disabled） |
| `interaction.ts` | 监听 `workflow:interaction` → `pendingInteraction`，`resolveInteraction` 回传响应 |

### 交互闭环

alert/prompt/form/table 等 UI 节点经 server `InteractionManager` 阻塞 → WS 推 `workflow:interaction` → `interaction.ts` 置 `pendingInteraction` → 组件渲染弹窗 → 用户操作 → `resolveInteraction(data)` → WS 回 `workflow:interaction`（type=`interaction_response`）→ server 恢复执行。

### 与后端的契约

所有执行操作走 WS（`@/lib/ws` 的 `getWS`），不走 REST。事件 ↔ action 对应见 [server architecture.md](../../server/claude/architecture.md) 的 Workflow 引擎章节。
