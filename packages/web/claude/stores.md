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
| useWorkflowEditorStore | `stores/workflow-editor.ts` | Workflow 编辑器状态（878 行） |
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
