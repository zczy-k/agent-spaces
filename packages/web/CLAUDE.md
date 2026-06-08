[根目录](../../CLAUDE.md) > [packages](../) > **web**

# @agent-spaces/web

## 模块职责

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。包含登录认证、工作空间管理、用量统计仪表盘（Commit Graph + Activity Graph）、订阅余额面板、项目设置面板（通知配置 + Prompt 配置 + Git 配置 + Speech 配置 + Robot Accounts Tab）、服务器切换器、文件夹浏览器、FlexLayout IDE 布局（可保存/加载自定义模板）、Monaco 代码编辑器（TypeScript LSP 定义跳转/引用/诊断 + Model 缓存预加载 + 搜索面板 + 代码收藏 + Monaco Action Registry + 菜单栏 + 移动端适配 + Send to Issue/Channel + Inspector Action）、xterm.js 终端（快捷命令 + 虚拟键盘 + 命令侧边栏 + 终端实例注册表）、TipTap 富文本聊天（含 @mention Agent + 语音识别输入 + 回复 AI 消息工作流 + slash 命令 + agent resource 扩展 + suggestion renderer + composer dialog/editor 双组件）、结构化 AI 消息渲染（chain/tool-step/context-panel/context-usage/tool-detail/diff/token-usage/confirmation/subagent/ask_user_question）、Workflow 可视化编辑器（@xyflow/react DAG + Agent/Command/Plugin/Group/Loop 节点 + @dagrejs/dagre 自动布局 + 插件管理对话框 + 插件选择器 + 插件配置 + 交互对话框 + 缩略图预览 + 便签节点 + 3 个状态管理 Hooks）、议题管理（含 Workflow 选择 + 拖拽排序任务面板 + info panel + issue message）、Git 操作面板（含设置表单 + commit diff viewer + context menu + discard 对话框 + 远程同步 + commits panel + commit log list + 高级操作 + git-not-initialized + git-remote-dialog + git-op-log-dialog）、频道管理（频道对话框 + 频道信息面板 + 成员管理 + 成员信息对话框 + member-picker）、Agent 配置管理、LLM 模型管理（模型 + 供应商对话框 + Model Picker）、头像上传、移动端适配、i18n 中英文切换（next-intl，31 个命名空间按功能拆分）、Native 通知（Tauri/Browser）、Command Palette（Ctrl+K 快捷面板，cmdk）、Iframe Tab 管理器、浮动面板/浮球、DOM Inspector 源码定位、Inspector 历史记录、独立设置页（Agents/Skills/MCPs/Models/Providers/Prompts/OutputStyles/Hooks/Tools）、通知中心对话框、Hook 管理对话框、输出风格管理对话框、Providers 管理对话框、Prompt 模板管理、Agent Store 在线模板导入、Kanban 看板（@dnd-kit 拖拽 + 水平/垂直布局 + 列管理）、Notion 风格文档数据库（树形导航 + Notion/Markdown 双编辑器 + 快速搜索 + 回收站 + 向量搜索 + 版本历史 + AI 对话 + 目录树节点 + 侧边栏双面板）、Worktree 面板（创建/删除/PR 创建/Diff 查看）、Diff Viewer（unified/split）、JSON Viewer、Log Viewer、Activity Log Panel、Content Usage Report、Theme Style System（自定义主题预设 + 自定义 CSS）、Layout Templates（保存/加载/管理 FlexLayout 布局模板）、Agent Picker 对话框、Editor 增强（file-tree/file-icon/file-context-menu/editor-tabs/editor-panel）、版本发布时间线（Timeline）、Settings 对话框拆分（Appearance/Language/Account/Security/Git/Speech/RobotAccounts + Shortcuts + About + Custom Font）、Animated Theme Toggler、Text Shimmer、Wandering Eyes、Ring Loading、Theme Style Init、Auth Guard、App Shell、Workspace Shell + Tab Config、Keyboard Shortcuts Store、GitHub Contributions、ForgeUI Animated Tabs 等核心功能。通过 Zustand 管理全局状态（25 个 Store），WebSocket 实现实时数据同步，支持多后端服务器切换。

**重要提示**：本项目使用的 Next.js 版本存在 Breaking Changes，详见 `AGENTS.md`。UI 设计规范参考 `DESIGN.md`（MiniMax 风格）。

## 入口与启动

- **入口文件**：`src/app/layout.tsx`（根布局 + ThemeProvider + LocaleProvider + AuthGuard + AppShell + CommandPalette + ConsolePanel + IframeManager + ViewportInsets + ZoomWrapper）+ `src/app/page.tsx`（首页 -> HomePage）
- **启动命令**：`pnpm dev`（自定义 server.mjs，默认 3000 端口）
- **构建命令**：`pnpm build` + `pnpm start`
- **API 代理**：通过 `next.config.ts` rewrites 将 `/api/*` 和 `/ws` 代理到后端 `localhost:3100`（或 `SERVER_URL`）
- **静态导出**：支持 Tauri 静态导出（`NEXT_STATIC_EXPORT=1`），通过 `lib/navigate.ts` 适配静态路由

## 对外接口

### 页面路由

| 路由 | 文件 | 说明 |
|------|------|------|
| `/login` | `src/app/login/page.tsx` | 登录页：Secret Key 认证 |
| `/` | `src/app/page.tsx` | 首页：工作空间列表 + 用量统计 Dashboard + 订阅面板 |
| `/workspaces` | `src/app/workspaces/page.tsx` | 工作空间管理页（SSR） |
| `/workflows` | `src/app/workflows/page.tsx` | Workflow 模板管理页 |
| `/workspace/[id]` | `src/app/workspace/[id]/page.tsx` | 工作空间页：FlexLayout IDE 布局 |
| `/settings` | `src/app/settings/page.tsx` | 设置首页 |
| `/settings/agents` | `src/app/settings/agents/page.tsx` | Agent 预设设置页 |
| `/settings/skills` | `src/app/settings/skills/page.tsx` | 技能管理设置页 |
| `/settings/mcps` | `src/app/settings/mcps/page.tsx` | MCP 配置设置页 |
| `/settings/models` | `src/app/settings/models/page.tsx` | LLM 模型设置页 |
| `/settings/providers` | `src/app/settings/providers/page.tsx` | LLM 供应商设置页 |
| `/settings/prompts` | `src/app/settings/prompts/page.tsx` | Prompt 模板管理设置页 |
| `/settings/output-styles` | `src/app/settings/output-styles/page.tsx` | 输出风格管理设置页 |
| `/settings/tools` | `src/app/settings/tools/page.tsx` | 内置工具管理设置页（**新**） |
| `/chat` | `src/app/chat/page.tsx` | Chat 独立对话页：多 Agent 管理 + SSE 流式执行 + 技能配置 |
| `/workflows/[id]` | `src/app/workflows/[id]/page.tsx` | Workflow 编辑器独立页 |

### FlexLayout 面板映射

| 组件名 | 面板 | 位置 | 说明 |
|--------|------|------|------|
| `channel-list` | 频道列表 | 左侧 (25%) | 频道列表 + 创建频道 + 频道对话框 |
| `issue-list` | 议题列表 | 左侧 (25%) | 议题列表 + 创建/编辑议题 |
| `editor` | 代码编辑器 | 右侧 (75%) | FileTree + EditorTabs + Monaco Editor + SearchPanel + CodeFavoritesPanel |
| `chat` | 聊天面板 | 右侧 (75%) | 消息列表 + 消息导航 + TipTap 富文本输入 + @mention Agent + 语音识别 |
| `issue-detail` | 议题详情 | 右侧 (75%) | 议题详细视图（Header + Comments + 拖拽排序任务面板） |
| `terminal` | 终端 | 底部 dock | xterm.js 多 tab 终端 + 快捷命令 |
| `git` | Git 面板 | 底部 dock | Git 状态 + Diff 查看 + Context Menu + 远程同步 |

### Workflow 可视化编辑器

基于 @xyflow/react（React Flow）的 DAG 编辑器，用于创建和管理 Workflow 模板。

| 组件 | 文件 | 说明 |
|------|------|------|
| `WorkflowEditor` | `workflow/workflow-editor.tsx` | 编辑器主容器（ReactFlowProvider + 工具栏 + 画布 + 节点侧边栏 + 属性面板） |
| `WorkflowCanvas` | `workflow/workflow-canvas.tsx` | DAG 画布（ReactFlow + Dagre 自动布局 + 连线交互 + 右键菜单） |
| `WorkflowNode` | `workflow/workflow-node.tsx` | 通用节点组件（avatar + label + role + 状态指示器） |
| `WorkflowAgentNode` | `workflow/workflow-agent-node.tsx` | Agent 节点组件（显示 avatar + label + role） |
| `WorkflowCommandNode` | `workflow/workflow-command-node.tsx` | Command 节点组件（显示命令名 + shell 类型） |
| `WorkflowGroupNode` | `workflow/workflow-group-node.tsx` | 分组节点组件（折叠/展开子节点容器） |
| `WorkflowLoopBodyContainer` | `workflow/workflow-loop-body-container.tsx` | 循环节点容器 |
| `WorkflowEdge` | `workflow/workflow-edge.tsx` | 自定义边组件（条件分支 + 动画连线） |
| `WorkflowAgentPalette` | `workflow/workflow-agent-palette.tsx` | Agent 调色板（拖拽添加节点，按 role 分组） |
| `WorkflowNodeSidebar` | `workflow/workflow-node-sidebar.tsx` | 节点侧边栏（拖拽添加各类节点） |
| `WorkflowToolbar` | `workflow/workflow-toolbar.tsx` | 主工具栏（保存/返回/名称/描述） |
| `WorkflowEditorToolbar` | `workflow/workflow-editor-toolbar.tsx` | 编辑器工具栏（撤销/重做/缩放/自动布局/版本/执行） |
| `WorkflowMiniPreview` | `workflow/workflow-mini-preview.tsx` | 缩略图预览 |
| `WorkflowCanvasContextMenu` | `workflow/workflow-canvas-context-menu.tsx` | 画布右键菜单（添加节点/删除/复制） |
| `WorkflowCommandEditDialog` | `workflow/workflow-command-edit-dialog.tsx` | Command 节点编辑对话框 |
| `WorkflowPropertiesPanel` | `workflow/workflow-properties-panel.tsx` | 属性面板（选中节点的详细配置） |
| `WorkflowStagingPanel` | `workflow/workflow-staging-panel.tsx` | 暂存面板（节点变更暂存） |
| `WorkflowExecutionBar` | `workflow/workflow-execution-bar.tsx` | 执行状态栏（运行中/暂停/错误状态展示） |
| `WorkflowVersionPanel` | `workflow/workflow-version-panel.tsx` | 版本历史面板 |
| `WorkflowOperationHistory` | `workflow/workflow-operation-history.tsx` | 操作历史面板（撤销/重做栈可视化） |
| `WorkflowHelperLines` | `workflow/workflow-helper-lines.tsx` | 辅助对齐线（拖拽节点时显示） |
| `WorkflowTriggerDialog` | `workflow/workflow-trigger-dialog.tsx` | 触发器配置对话框（cron/webhook） |
| `WorkflowVariablePicker` | `workflow/workflow-variable-picker.tsx` | 变量选择器（插入工作流变量） |
| `WorkflowEmbeddedEditor` | `workflow/workflow-embedded-editor.tsx` | 嵌入式编辑器（轻量画布，Issue 面板预览用） |
| `WorkflowPluginsDialog` | `workflow/workflow-plugins-dialog.tsx` | 插件管理对话框（本地插件/商店 Tab + 安装/启用/配置） |
| `WorkflowPluginPickerDialog` | `workflow/workflow-plugin-picker-dialog.tsx` | 插件选择器对话框（快速启用/禁用工作流插件） |
| `WorkflowPluginConfigDialog` | `workflow/workflow-plugin-config-dialog.tsx` | 插件配置对话框（多字段类型 + Workflow 级方案） |
| `WorkflowInteractionDialog` | `workflow/workflow-interaction-dialog.tsx` | 工作流执行交互对话框（alert/prompt/form/table_confirm） |
| `StickyNoteView` | `workflow/sticky-note-view.tsx` | 便签节点视图（实时编辑内容） |
| `useWorkflowEditorState` | `workflow/use-workflow-editor-state.ts` | 编辑器核心状态（自动保存/撤销重做/面板布局/导入导出） |
| `useWorkflowEditorExecution` | `workflow/use-workflow-editor-execution.ts` | 执行状态（控制/日志/调试/交互请求/WebSocket 推送） |
| `useWorkflowEditorCanvas` | `workflow/use-workflow-editor-canvas.ts` | 画布交互（节点/边操作/节点选择对话框/自动布局） |
| `WorkflowEditorTypes` | `workflow/workflow-editor-types.ts` | 编辑器类型定义（布局/调试/节点选择上下文） |
| `WorkflowList` | `workflow/workflow-list.tsx` | Workflow 列表项 |
| `WorkflowsPage` | `workflows/workflows-page.tsx` | Workflow 管理页（列表 + 创建 + 编辑入口） |
| `WorkflowTemplates` | `workflows/workflow-templates.ts` | 模板管理组件 |
| `WorkflowTemplatesDialog` | `workflows/workflow-templates-dialog.tsx` | 模板选择对话框（Issue 创建时使用） |

### Chat 独立页面组件

独立的 AI 对话页面（/chat），支持多 Agent 管理、SSE 流式执行、技能配置、结构化消息渲染。

| 组件/文件 | 说明 |
|-----------|------|
| `app/chat/page.tsx` | Chat 页面主组件（三栏布局：Agent 列表 + 对话面板 + 右侧面板，URL 状态同步） |
| `stores/chat.ts` | Chat Zustand Store（Agent CRUD + 消息管理 + SSE 流式解析 + AbortController，307 行） |
| `components/chat/inline-chat-panel.tsx` | 对话面板（消息列表 + 流式输出 + 思考过程 + 发送/停止/清除） |
| `components/chat/chat-panel.tsx` | Chat 面板容器 |
| `components/chat/chat-message-bubble.tsx` | 消息气泡组件（用户/Agent 消息渲染） |
| `components/chat/chat-agent-list.tsx` | Agent 列表（选中/编辑/删除/添加） |
| `components/chat/chat-agent-picker-dialog.tsx` | Agent 选择器对话框（从 Agent Preset 导入到 Chat） |
| `components/chat/chat-right-panel.tsx` | 右侧面板（Agent 配置/技能/MCP） |
| `components/chat/add-chat-agent-dialog.tsx` | Agent 创建/编辑对话框（名称/模型/供应商/API Key/技能/MCP/工具） |
| `components/chat/chat-composer-input.tsx` | 对话输入组件 |
| `components/chat/readonly-code-block.tsx` | 只读代码块渲染 |
| `components/chat/member-hover-card.tsx` | 成员悬浮卡片 |
| `components/chat/message-parts.tsx` | 消息部分渲染 |
| `components/chat/ask-user-question.tsx` | 用户提问组件 |
| `components/chat/chain-of-thought.tsx` | 思维链展示 |
| `components/chat/chat-input.tsx` | 聊天输入组件 |
| `components/chat/chat-input-agent-bar.tsx` | 输入栏 Agent 选择器 |
| `components/chat/chat-input-info-bar.tsx` | 输入栏信息展示 |

### Command Palette

Ctrl+K 快捷命令面板，全局搜索和导航。

| 组件/文件 | 说明 |
|-----------|------|
| `components/command-palette.tsx` | Command Palette 主组件（cmdk） |
| `stores/command-palette.ts` | 命令注册/注销/触发 store |
| `stores/search-commands/` | 搜索提供者目录（6 文件） |
| `components/ui/command.tsx` | cmdk UI 组件 |

### Monaco 编辑器增强

Monaco 编辑器集成 TypeScript LSP，提供定义跳转、引用、诊断等语义能力。

| 组件/文件 | 说明 |
|-----------|------|
| `lib/monaco-language-client.ts` | Monaco Language Client（monaco-languageclient），WebSocket 连接后端 TypeScript LSP |
| `lib/monaco-action-registry.ts` | Monaco Action 注册表（registerMonacoAction/applyRegisteredActions） |
| `lib/monaco-builtin-actions.ts` | 内置右键菜单 Action（复制代码位置 + 添加到代码收藏） |
| `lib/monaco-models.ts` | Monaco Model 缓存和预加载 |
| `lib/monaco-loader.ts` | Monaco Editor 加载器配置（CDN 路径映射） |
| `components/editor/code-favorites-panel.tsx` | 代码收藏面板（列表/跳转/删除） |
| `components/editor/add-favorite-dialog.tsx` | 添加代码收藏对话框 |
| `components/editor/code-editor.tsx` | Monaco Editor 集成 |
| `components/editor/code-editor-menu-bar.tsx` | 编辑器菜单栏 |
| `components/editor/code-editor-navigation.ts` | 编辑器导航（定义跳转/引用） |
| `components/editor/code-editor-utils.ts` | 编辑器工具函数 |
| `components/editor/code-editor-clipboard.ts` | 编辑器剪贴板操作 |
| `components/editor/code-editor-mobile.ts` | 移动端编辑器适配 |
| `components/editor/code-editor-mobile-overlay.tsx` | 移动端只读覆盖层 |

### DOM Inspector 集成

基于 dom-inspector-hook 的元素源码定位功能。

| 组件/文件 | 说明 |
|-----------|------|
| `components/dev-inspector.tsx` | Inspector 集成（接收 inspector.jump 事件，打开文件定位行） |
| `stores/inspector-history.ts` | Inspector 历史记录（localStorage 持久化，最多 50 条） |

### Iframe Tab 管理器

嵌入式网页 Tab 管理系统。

| 组件/文件 | 说明 |
|-----------|------|
| `components/common/iframe-manager.tsx` | IframeLinkInterceptor + IframeFloatingBall + IframeOverlay |
| `stores/iframe-tabs.ts` | Iframe Tab 状态管理（add/remove/setActive） |

### 浮动组件

通用浮动面板和浮球组件。

| 组件/文件 | 说明 |
|-----------|------|
| `components/common/floating-panel.tsx` | 可拖拽/最小化浮动面板 |
| `components/common/floating-ball.tsx` | 可拖拽浮球（吸附边缘 + 最小化） |

### 聊天增强

消息渲染拆分为多个子组件。

| 组件/文件 | 说明 |
|-----------|------|
| `components/chat/message-tool-step.tsx` | 工具调用步骤渲染（16 种工具类型） |
| `components/chat/message-context-panel.tsx` | 消息上下文面板（模型/token 用量/缓存命中） |
| `components/chat/message-context-usage.tsx` | 上下文 token 用量展示 |
| `components/chat/message-item.tsx` | 消息项组件（含回复/复制/删除/成员信息） |
| `components/chat/message-navigator.tsx` | 消息导航器（上下翻页 + 预览） |
| `components/chat/context.tsx` | 通用 context 组件（Progress Circle） |
| `components/chat/channel-dialog.tsx` | 频道创建/编辑对话框 |
| `components/chat/channel-list.tsx` | 频道列表（含排序/筛选/归档） |
| `components/chat/channel-info-panel.tsx` | 频道详情面板（成员/设置/编辑） |
| `components/chat/member-info-dialog.tsx` | 成员信息对话框 |
| `components/chat/add-member-dialog.tsx` | 添加成员对话框 |
| `components/chat/chat-input-utils.ts` | 聊天输入工具函数 |
| `components/chat/chat-input-attachments.ts` | 聊天输入附件处理 |
| `components/chat/chat-input-agent-bar.tsx` | 聊天输入 Agent 选择栏 |
| `components/chat/chat-input-info-bar.tsx` | 聊天输入信息栏 |
| `components/composer/create-file-search-extension.ts` | 文件搜索 TipTap 扩展 |
| `components/composer/suggestion-list.tsx` | TipTap mention 建议列表 |
| `components/composer/composer-shell.tsx` | Composer 外壳组件（发送/停止/Inspector 按钮） |

### Issue 管理增强

Issue 详情页拆分为多个子组件。

| 组件/文件 | 说明 |
|-----------|------|
| `components/issue/edit-issue-dialog.tsx` | 编辑议题对话框（含 Workflow 选择 + 成员分配） |
| `components/issue/issue-detail-header.tsx` | 议题详情头部（状态/优先级/负责人/操作按钮） |
| `components/issue/issue-detail-comments.tsx` | 议题评论区域 |
| `components/issue/issue-detail-tasks-panel.tsx` | 任务面板（支持 @dnd-kit 拖拽排序） |
| `components/issue/task-row.tsx` | 任务行组件（可拖拽 + 状态/重试/编辑） |

### Git 增强组件

Git 面板包含 20 个文件，完整覆盖 Git 工作流。

| 组件/文件 | 说明 |
|-----------|------|
| `components/git/use-git-sync.ts` | Git 远程同步 Hook（push/pull/remote 管理） |
| `components/git/git-prompt-dialog.tsx` | 通用输入对话框（commit/stash message） |
| `components/git/git-gitignore-dialog.tsx` | .gitignore 编辑对话框（Monaco） |
| `components/git/git-file-context-menu.tsx` | 文件右键菜单（添加到 .gitignore/打开/丢弃） |
| `components/git/git-commit-context-menu.tsx` | 提交右键菜单（查看 diff/推送） |
| `components/git/git-commit-utils.ts` | Git 状态颜色/标签工具函数 |
| `components/git/git-commit-detail-dialog.tsx` | 提交详情对话框（DiffViewer） |
| `components/git/git-discard-dialog.tsx` | 丢弃确认对话框（单个/全部） |
| `components/git/diff-viewer.tsx` | 通用 Diff 查看器（Monaco DiffEditor） |
| `components/git/git-settings-form.tsx` | Git 设置表单（用户名/邮箱/远程） |
| `components/git/git-commit-dialog.tsx` | 提交对话框 |
| `components/git/git-panel-layout.ts` | Git 面板布局工具 |
| `components/git/git-commits-panel.tsx` | 完整 Git 提交面板 |
| `components/git/git-commits-section.tsx` | 提交区域组件 |
| `components/git/git-commit-log-list.tsx` | 提交日志列表（Commit Graph 风格） |
| `components/git/git-changes-panel.tsx` | 变更面板 |
| `components/git/commit-diff-viewer.tsx` | 提交 Diff 查看器 |
| `components/git/git-op-log-dialog.tsx` | Git 操作日志对话框 |
| `components/git/git-not-initialized.tsx` | Git 未初始化提示 |
| `components/git/git-remote-dialog.tsx` | 远程仓库管理对话框 |

### Database 组件目录

Notion 风格文档数据库（15 个文件）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/database/database-panel.tsx` | 文档数据库主面板 |
| `components/database/database-sidebar.tsx` | 文档侧边栏（树形导航 + 双面板布局） |
| `components/database/database-sidebar-panel.tsx` | 侧边栏面板 |
| `components/database/database-main-panel.tsx` | 主内容面板 |
| `components/database/database-dialog.tsx` | 数据库创建/编辑对话框 |
| `components/database/database-tree-node.tsx` | 树形节点组件 |
| `components/database/database-constants.ts` | 常量定义 |
| `components/database/database-vector-dialog.tsx` | 向量搜索对话框 |
| `components/database/notion-editor.tsx` | Notion 风格编辑器（TipTap） |
| `components/database/markdown-editor.tsx` | Markdown 编辑器（Monaco） |
| `components/database/table-of-contents.tsx` | 目录树组件 |
| `components/database/quick-search-modal.tsx` | 快速搜索模态框 |
| `components/database/trash-bin-modal.tsx` | 回收站模态框 |
| `components/database/version-history-dialog.tsx` | 版本历史对话框 |
| `components/database/database-ai-chat.tsx` | 文档 AI 对话 |

### Kanban 看板组件

Kanban 拖拽看板（6 个文件）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/kanban/kanban-board.tsx` | 看板主组件 |
| `components/kanban/kanban-column.tsx` | 看板列组件 |
| `components/kanban/kanban-card.tsx` | 看板卡片组件 |
| `components/kanban/column-modal.tsx` | 列编辑模态框 |
| `components/kanban/column-manage-dialog.tsx` | 列管理对话框（增删改排序） |
| `components/kanban/task-modal.tsx` | 任务编辑模态框 |

### Worktree 面板组件

Git Worktree 并行开发（3 个文件）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/worktree/worktree-panel.tsx` | Worktree 主面板 |
| `components/worktree/worktree-card.tsx` | Worktree 卡片（状态/分支/操作） |
| `components/worktree/create-worktree-dialog.tsx` | 创建 Worktree 对话框 |

### ForgeUI 组件

基于 ForgeUI 风格的自定义组件。

| 组件/文件 | 说明 |
|-----------|------|
| `components/forgeui/animated-tabs.tsx` | 动画标签页组件 |

### Sidebar 组件（45 个文件）

侧边栏是前端最复杂的组件目录，包含 45 个文件。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/app-sidebar.tsx` | 侧边栏主组件 |
| `components/sidebar/index.tsx` | 导出入口 |
| `components/sidebar/logo.tsx` | Logo 组件 |
| `components/sidebar/nav-main.tsx` | 主导航菜单 |
| `components/sidebar/nav-notifications.tsx` | 通知导航项 |
| `components/sidebar/sidebar-dashboard-routes.tsx` | Dashboard 路由入口 |
| `components/sidebar/sidebar-dialog-group.tsx` | 对话框分组管理 |
| `components/sidebar/server-switcher.tsx` | 服务器切换器 |
| `components/sidebar/server-form-dialog.tsx` | 服务器配置表单对话框 |
| `components/sidebar/server-manager-dialog.tsx` | 服务器管理对话框 |
| `components/sidebar/agent-dialog.tsx` | Agent 配置对话框（主入口） |
| `components/sidebar/agent-dialog-header.tsx` | Agent 对话框头部 |
| `components/sidebar/agent-dialog-data.ts` | Agent 对话框数据管理 |
| `components/sidebar/agent-list.tsx` | Agent 列表 |
| `components/sidebar/agent-detail.tsx` | Agent 详情面板 |
| `components/sidebar/agent-editor.tsx` | Agent 编辑器 |
| `components/sidebar/agent-shared.tsx` | Agent 共享组件 |
| `components/sidebar/agent-commands-dialog.tsx` | Agent 命令管理对话框 |
| `components/sidebar/models-dialog.tsx` | LLM 模型管理对话框 |
| `components/sidebar/mcps-dialog.tsx` | MCP 配置对话框 |
| `components/sidebar/skills-dialog.tsx` | 技能管理对话框（入口，子目录 7 文件） |
| `components/sidebar/prompts-dialog.tsx` | Prompt 模板管理对话框 |
| `components/sidebar/output-styles-dialog.tsx` | 输出风格管理对话框 |
| `components/sidebar/hooks-dialog.tsx` | Hook 管理对话框 |
| `components/sidebar/providers-dialog.tsx` | LLM 供应商管理对话框 |
| `components/sidebar/tools-dialog.tsx` | 内置工具管理对话框（**新**） |
| `components/sidebar/notification-center-dialog.tsx` | 通知中心对话框 |
| `components/sidebar/layout-manager-dialog.tsx` | 布局模板管理对话框（**新**） |
| `components/sidebar/settings-dialog.tsx` | Settings 对话框 |
| `components/sidebar/settings/appearance-tab.tsx` | Settings Appearance Tab（主题/字体/布局） |
| `components/sidebar/settings/language-tab.tsx` | Settings Language Tab（中英文切换） |
| `components/sidebar/settings/account-tab.tsx` | Settings Account Tab（头像/用户名） |
| `components/sidebar/settings/security-tab.tsx` | Settings Security Tab（修改密码） |
| `components/sidebar/settings/speech-settings-tab.tsx` | Settings Speech Tab（语音识别配置） |
| `components/sidebar/settings/robot-accounts-tab.tsx` | Settings Robot Accounts Tab（通知凭证管理） |
| `components/sidebar/settings/startup-tab.tsx` | Settings Startup Tab（启动项配置） |
| `components/sidebar/settings/shortcuts-tab.tsx` | Settings Shortcuts Tab（快捷键管理） |
| `components/sidebar/settings/about-tab.tsx` | Settings About Tab（版本信息） |
| `components/sidebar/settings/custom-font-dialog.tsx` | 自定义字体对话框 |
| `components/sidebar/settings/avatar-picker.tsx` | 头像选择器 |
| `components/sidebar/settings/agent-store-tab.tsx` | Agent Store Tab（在线模板导入） |
| `components/sidebar/settings/data-tab.tsx` | Data Tab（数据导入/导出） |
| `components/sidebar/use-sidebar-dialogs.ts` | 对话框状态 Hook |
| `components/sidebar/use-sidebar-events.ts` | 事件处理 Hook |
| `components/sidebar/use-sidebar-commands.ts` | 命令处理 Hook |

### Hook 管理对话框

Hook 配置管理对话框。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/hooks-dialog.tsx` | Hook CRUD + 上传 JSON + Monaco 编辑器 + 应用到工作空间 |
| `stores/hooks.ts` | Hook Store（fetch/create/update/delete/upload/apply） |

### 输出风格管理对话框

输出风格模板管理对话框。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/output-styles-dialog.tsx` | OutputStyle CRUD + 上传 JSON + Monaco 编辑器 |

### Skills Dialog 子目录

Skills 管理对话框拆分为 7 文件子目录。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/skills-dialog/skill-list.tsx` | 技能列表（634 行，主组件） |
| `components/sidebar/skills-dialog/skill-edit-dialog.tsx` | 技能编辑对话框 |
| `components/sidebar/skills-dialog/skill-import-dialog.tsx` | 技能导入对话框 |
| `components/sidebar/skills-dialog/skill-sync-dialog.tsx` | 技能同步对话框 |
| `components/sidebar/skills-dialog/skill-bind-dialog.tsx` | 技能绑定对话框 |
| `components/sidebar/skills-dialog/types.ts` | 类型定义 |
| `components/sidebar/skills-dialog/use-skills-data.ts` | 技能数据 Hook |

### Providers 管理对话框

LLM 供应商管理对话框。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/providers-dialog.tsx` | LLM 供应商 CRUD 对话框（含 API Base/Key 配置） |

### UI 基础组件重写

多个 UI 组件迁移到 @base-ui/react 基础。

| 组件/文件 | 说明 |
|-----------|------|
| `components/ui/search-select.tsx` | 搜索选择器（支持自定义值） |
| `components/ui/markdown.tsx` | Markdown 渲染（react-markdown + remark-gfm） |
| `components/ui/skeleton.tsx` | 骨架屏（含 SkeletonGroup） |
| `components/ui/drawer.tsx` | 抽屉组件（vaul） |
| `components/ui/dialog.tsx` | 对话框（@base-ui/react/dialog + 返回键处理） |
| `components/ui/sheet.tsx` | 侧边面板（@base-ui/react/dialog + 返回键处理） |
| `components/ui/alert-dialog.tsx` | 确认对话框（@base-ui/react/alert-dialog） |
| `components/ui/input.tsx` | 输入框（@base-ui/react/input + IME 兼容） |
| `components/theme-provider.tsx` | 主题提供者（light/dark/system + useSyncExternalStore） |

### i18n 国际化

基于 next-intl 的中英文多语言切换系统，翻译文件按 31 个命名空间拆分。

| 命名空间 | 文件 | 说明 |
|----------|------|------|
| `agent` | `locales/{en,zh}/agent.json` | Agent 配置与管理 |
| `agentCommands` | `locales/{en,zh}/agentCommands.json` | Agent 命令管理 |
| `chat` | `locales/{en,zh}/chat.json` | 聊天与频道 |
| `commandPalette` | `locales/{en,zh}/commandPalette.json` | Command Palette（**新**） |
| `commands` | `locales/{en,zh}/commands.json` | 快捷命令 |
| `common` | `locales/{en,zh}/common.json` | 通用文本 |
| `composer` | `locales/{en,zh}/composer.json` | Composer 编辑器（**新**） |
| `database` | `locales/{en,zh}/database.json` | 文档数据库 |
| `editor` | `locales/{en,zh}/editor.json` | 编辑器 |
| `folderPicker` | `locales/{en,zh}/folderPicker.json` | 文件夹选择器（**新**） |
| `git` | `locales/{en,zh}/git.json` | Git 操作 |
| `home` | `locales/{en,zh}/home.json` | 首页（**新**） |
| `issue` | `locales/{en,zh}/issue.json` | 议题管理 |
| `kanban` | `locales/{en,zh}/kanban.json` | Kanban 看板 |
| `login` | `locales/{en,zh}/login.json` | 登录页 |
| `mcps` | `locales/{en,zh}/mcps.json` | MCP 配置 |
| `models` | `locales/{en,zh}/models.json` | LLM 模型（**新**） |
| `outputStyles` | `locales/{en,zh}/outputStyles.json` | 输出风格 |
| `projectSettings` | `locales/{en,zh}/projectSettings.json` | 项目设置 |
| `prompts` | `locales/{en,zh}/prompts.json` | Prompt 模板 |
| `providers` | `locales/{en,zh}/providers.json` | LLM 供应商（**新**） |
| `robotAccounts` | `locales/{en,zh}/robotAccounts.json` | Robot Account |
| `settings` | `locales/{en,zh}/settings.json` | 设置 |
| `sidebar` | `locales/{en,zh}/sidebar.json` | 侧边栏 |
| `skills` | `locales/{en,zh}/skills.json` | 技能管理 |
| `task` | `locales/{en,zh}/task.json` | 任务管理（**新**） |
| `terminal` | `locales/{en,zh}/terminal.json` | 终端（**新**） |
| `tools` | `locales/{en,zh}/tools.json` | 内置工具（**新**） |
| `workspace` | `locales/{en,zh}/workspace.json` | 工作空间（**新**） |
| `workspaces` | `locales/{en,zh}/workspaces.json` | 工作空间列表（**新**） |
| `worktree` | `locales/{en,zh}/worktree.json` | Worktree |

**集成方式**：`layout.tsx` 中 ThemeProvider -> LocaleProvider -> AuthGuard -> AppShell

**设置入口**：settings-dialog.tsx 中 Language 选择器（中文/English）

## 关键依赖与配置

### 运行时依赖

| 依赖 | 用途 |
|------|------|
| `next` (16.2) | React 全栈框架 |
| `react` / `react-dom` (19.2) | UI 库 |
| `flexlayout-react` (0.9) | 可拖拽面板布局 |
| `@xyflow/react` (12.10) | DAG 可视化编辑器（React Flow） |
| `@dagrejs/dagre` (3.0) | DAG 自动布局算法 |
| `zustand` (5) | 状态管理 |
| `next-intl` (4.11) | i18n 国际化 |
| `cmdk` (1.1) | Command Palette 组件 |
| `@monaco-editor/react` | 代码编辑器 |
| `monaco-languageclient` (10.7) | Monaco LSP 语言客户端 |
| `vscode-languageclient` (9.0.1) | VSCode Language Client 协议 |
| `vscode-ws-jsonrpc` (3.5.0) | LSP WebSocket 通信 |
| `@xterm/xterm` + addons | 终端模拟器（fit + web-links） |
| `@tiptap/core` + extensions | 富文本编辑器（mention、placeholder、suggestion） |
| `shadcn` + `class-variance-authority` | UI 组件系统 |
| `tailwind-merge` + `clsx` | CSS 工具 |
| `lucide-react` + `@tabler/icons-react` | 图标库 |
| `react-markdown` + `remark-gfm` | Markdown 渲染 |
| `recharts` | 图表组件（Usage Dashboard） |
| `@tanstack/react-table` | 数据表格（Usage Dashboard） |
| `date-fns` | 日期处理 |
| `sonner` | Toast 通知 |
| `react-day-picker` | 日期选择器 |
| `framer-motion` | 动画库 |
| `react-dropzone` | 文件拖拽上传 |
| `tippy.js` | Tooltip 浮层（mention 弹窗） |
| `vaul` | 抽屉组件 |
| `react-virtualized` | 虚拟滚动列表 |
| `@dnd-kit/core` + `@dnd-kit/react` + `@dnd-kit/sortable` | 拖放功能 |
| `@base-ui/react` | 基础 UI 组件 |
| `@emotion/is-prop-valid` | Emotion prop 过滤 |
| `copy-code` | 代码复制 |
| `tw-animate-css` | Tailwind 动画 CSS |
| `@tauri-apps/plugin-notification` | Tauri Native 通知 |
| `@agent-spaces/shared` | 共享类型 |

### 配置

- **TailwindCSS 4**：使用 `@tailwindcss/postcss` 插件
- **shadcn/ui**：`base-nova` 风格，路径别名 `@/components/ui`
- **路径别名**：`@/*` -> `./src/*`
- **字体**：DM Sans（UI）、Outfit（标题）、Poppins（中间层标题）
- **主题**：`next-themes` 支持 light/dark/system 切换 + Theme Style System（自定义预设如 Mira + 自定义 CSS，localStorage 持久化）
- **i18n**：`next-intl` + LocaleProvider，默认中文，localStorage 持久化，31 个命名空间按功能拆分
- **自定义 server**：`server.mjs` 提供开发服务器
- **Inspector**：`react-dev-inspector` 开发辅助
- **API Polyfill**：`lib/api-polyfill.ts` 自动为 /api/ 请求添加活跃服务器前缀
- **静态路由**：`lib/navigate.ts` Tauri 静态导出路由适配
- **路由工具**：`lib/routes.ts` 路径解析辅助

## 数据模型

前端不直接管理数据模型，所有数据通过 REST API 获取、WebSocket 实时更新。

### Zustand Stores（25 个）

| Store | 文件 | 状态 | 说明 |
|-------|------|------|------|
| `useAgentStore` | `stores/agent.ts` | agents, loadedWorkspaceId | Agent Preset 列表（含 `findAgentById` 工具函数） |
| `useEditorStore` | `stores/editor.ts` | tree, openFiles, activeFilePath | 文件树、打开文件、代码编辑 |
| `useTerminalStore` | `stores/terminal.ts` | sessions, activeId | 多终端会话管理 |
| `useChannelStore` | `stores/channel.ts` | channels, messages, activeChannelId | 频道与消息 |
| `useIssueStore` | `stores/issue.ts` | issues, activeIssueId | 议题列表与选中 |
| `useTaskStore` | `stores/task.ts` | tasks | 任务列表 |
| `useGitStore` | `stores/git.ts` | status, diffs, log, selectedFile | Git 状态与 Diff |
| `useWorkspaceStore` | `stores/workspace.ts` | workspaces | 工作空间列表（upsert/remove） |
| `useLLMStore` | `stores/llm.ts` | models, providers, loaded | LLM 模型与供应商管理 |
| `useWorkflowStore` | `stores/workflow.ts` | workflows, currentWorkflow, isLoading | Workflow 模板列表与当前编辑 |
| `useWorkflowEditorStore` | `stores/workflow-editor.ts` | nodes, edges, selectedNode, history, staging | Workflow 编辑器完整状态管理（768行，含撤销/重做/暂存/属性面板/版本/执行状态） |
| `useMobilePanelStore` | `stores/mobile-panel.ts` | activePanel | 移动端面板切换 |
| `useCommandStore` | `stores/command.ts` | commands, runningMap | 快捷命令管理（CRUD + 运行/停止） |
| `useCommandPalette` | `stores/command-palette.ts` | open, commands | Command Palette 注册/触发 |
| `useNotificationStore` | `stores/notification.ts` | notifications, loaded | 应用内通知（加载/标记已读/清空） |
| `useIframeTabs` | `stores/iframe-tabs.ts` | tabs, activeId | Iframe Tab 管理 |
| `useCodeFavoritesStore` | `stores/code-favorites.ts` | favorites, pendingFavorite | 代码收藏（CRUD + 待添加） |
| `useInspectorHistoryStore` | `stores/inspector-history.ts` | histories | Inspector 历史记录（localStorage） |
| `useHookStore` | `stores/hooks.ts` | hooks, selectedName, loading | Hook 配置管理（CRUD + upload + apply） |
| `useDatabaseStore` | `stores/database.ts` | databases, nodes, activeId, openTabs, editorMode, theme | 文档数据库管理（DatabaseMeta + DocNode + Notion/Markdown 编辑器模式）（**新**） |
| `useKanbanStore` | `stores/kanban.ts` | board, loading, wsAttached | Kanban 看板管理（Board + Column + Task CRUD + 布局切换 + WebSocket 同步）（**新**） |
| `useWorktreeStore` | `stores/worktree.ts` | worktrees, loading | Worktree 管理（创建/删除/PR 创建/合并）（**新**） |
| `useEditorSendStore` | `stores/editor-send.ts` | pendingSendToChannel, pendingSendToIssue | 编辑器 Send to Issue/Channel（Monaco 右键发送代码片段）（**新**） |
| `useActivityLogStore` | `stores/activity-log.ts` | entries, max 2000 | Agent 活动日志（实时 WebSocket 推送 + Agent/Issue/Task 状态变更）（**新**） |
| `useContentUsageReport` | `stores/content-usage-report.ts` | report data | 内容用量报告（跨 Store/工作空间/终端统计）（**新**） |
| `useChatStore` | `stores/chat.ts` | agents, activeAgentId, messages, sending, errors, streamingContent, streamingThinking | Chat 独立页面状态（Agent CRUD + SSE 流式消息 + AbortController）（**新**） |

### 认证模块

`src/lib/auth.ts` + `src/lib/server.ts`：

| 函数 | 说明 |
|------|------|
| `getToken()` | 获取 Bearer Token（localStorage 或活跃服务器 secret） |
| `setToken(token)` | 设置 Token 并标记已认证 |
| `removeToken()` | 清除 Token |
| `isAuthenticated()` | 检查是否已认证 |
| `authHeaders()` | 构建 Authorization headers |
| `fetchWithAuth(input, init)` | 带 Token 的 fetch，401/403 自动跳转登录 |
| `loadServers()` / `saveServers()` | 管理多服务器配置 |
| `getActiveServer()` / `setActiveServerCookie()` | 获取/设置活跃服务器 |

### WebSocket 客户端

`src/lib/ws.ts` 中的 `WorkspaceWS` 类：
- 自动连接 + 断线重连（3s 间隔）
- 事件订阅/取消（`on`/`off` 方法）
- 单例模式（`getWS` / `disconnectWS`）

### Native 通知

`src/lib/native-notification.ts` 提供 Tauri/Browser 通知抽象层：
- `isTauriEnvironment()` -- 检测是否运行在 Tauri webview 中
- `getNotificationPermission()` / `requestNotificationPermission()` -- 权限管理
- `sendNativeNotification(title, body)` -- 发送通知（自动选择 Tauri 或 Browser API）

### Monaco Models

`src/lib/monaco-models.ts` 提供 Monaco Editor Model 缓存和预加载：
- `getOrCreateModel(workspaceId, filePath, content)` -- 获取或创建 Monaco TextModel
- `preloadDirectoryModels(workspaceId, dirPath)` -- 预加载目录下 TS/JS 文件
- 自动检测语言类型（TS/JS/JSON/CSS/HTML/YAML/Python/Rust/Go/SQL/Shell）

### Monaco Language Client

`src/lib/monaco-language-client.ts` 提供 TypeScript LSP 集成：
- `startTypeScriptLanguageClient(workspaceId, workspaceRoot?)` -- 连接后端 TypeScript LSP
- `stopTypeScriptLanguageClient(workspaceId)` -- 断开连接
- 自动管理客户端生命周期（Map 缓存，按 workspaceId 复用）

### Monaco Action Registry

`src/lib/monaco-action-registry.ts` 提供编辑器 Action 注册机制：
- `registerMonacoAction(action)` -- 注册自定义右键菜单/快捷键
- `applyRegisteredActions(editor, context)` -- 批量应用到编辑器实例
- `toRelativePath(modelPath, context)` -- 将 Model URI 转为相对路径

内置 Actions（`monaco-builtin-actions.ts`）：
- `copyPosition` -- 复制代码位置（file:line 格式）
- `addToFavorites` -- 添加到代码收藏（弹出对话框）

### Lib 工具库

| `lib/users.ts` | 模拟用户数据（User 类型 + USERS 列表） |
| `lib/monaco-loader.ts` | Monaco Editor 加载器配置（CDN 路径映射到 /monaco/vs） |
| `lib/github.ts` | GitHub Contributions API（Activity Graph 数据源） |
| `lib/sample-logs.ts` | 示例日志数据（Log Viewer 演示用） |
| `lib/workflow-api.ts` | Workflow API 请求层（模板 CRUD + 执行触发 + 版本管理） |
| `lib/workflow-nodes.ts` | Workflow 节点类型工具（节点注册表 + 默认数据 + 校验） |
| `lib/workflow-plugin-api.ts` | Workflow Plugin API 请求层（插件管理 + 配置 + 节点定义 + Workflow 级方案） |
| `lib/sdk.ts` | @agent-spaces/sdk 单例桥接层（自动同步 baseUrl + Bearer Token + onUnauthorized） |
| `lib/agent-members.ts` | Agent 成员工具（getAgentDisplayName, findAgentById, getMemberDisplayName） |
| `lib/theme-style.ts` | Theme Style System（自定义主题预设如 Mira，CSS 变量覆盖，localStorage 持久化） |
| `lib/themes.ts` | JSON 颜色主题定义（JsonColorTheme 接口，用于 JSON Viewer 语法着色） |
| `lib/layout-templates.ts` | FlexLayout 布局模板管理（LayoutTemplate 接口，localStorage CRUD + 导入/导出） |
| `lib/converter.ts` | HTML 转 Markdown 转换器（htmlToMarkdown） |
| `lib/terminal-registry.ts` | 终端实例注册表（TerminalRegistryEntry，xterm 实例管理 + buffer 统计） |
| `lib/commands.ts` | Slash 命令定义（SlashCommandItem 类型 + COMMANDS 列表） |
| `lib/users.ts` | 模拟用户数据（User 类型 + USERS 列表） |
| `lib/monaco-loader.ts` | Monaco Editor 加载器配置（CDN 路径映射到 /monaco/vs） |
| `lib/github.ts` | GitHub Contributions API（Activity Graph 数据源） |
| `lib/sample-logs.ts` | 示例日志数据（Log Viewer 演示用） |
| `lib/workflow-api.ts` | Workflow API 请求层（模板 CRUD + 执行触发 + 版本管理） |
| `lib/workflow-nodes.ts` | Workflow 节点类型工具（节点注册表 + 默认数据 + 校验） |

### 语音识别

`src/hooks/use-speech-recognition.ts` 提供语音识别 Hook：
- `useSpeechRecognition()` -- 自动加载配置，WebSocket 流式发送音频，实时返回识别结果
- 集成到 ChatInput 语音按钮

### Workflow 编辑器 Hooks

`src/hooks/use-workflow-editor.ts` 提供 Workflow 编辑器 Hook：
- `useWorkflowEditor()` -- 编辑器初始化 + 节点/边操作 + 撤销/重做 + 自动保存
- 桥接 workflow-editor store 和 ReactFlow 实例

### 用户头像

`src/hooks/use-user-avatar.ts` 提供用户头像 Hook：
- `useUserAvatar()` -- 从 API 加载头像 URL，localStorage 缓存

## 测试与质量

- **Lint**：`pnpm lint`（eslint + eslint-config-next）
- 当前无单元测试或 E2E 测试

## 常见问题 (FAQ)

- **Q: Next.js 16 有什么不同？** A: 参考 `AGENTS.md` 和 `node_modules/next/dist/docs/`，API 和文件结构可能有 Breaking Changes。
- **Q: 为什么 API 请求不需要完整 URL？** A: `next.config.ts` 中配置了 rewrites，将 `/api/*` 代理到后端 `localhost:3100`。
- **Q: FlexLayout 布局如何自定义？** A: 修改 `workspace-shell.tsx` 中的 `defaultJson` 配置对象，或使用 Layout Manager Dialog 保存/加载自定义布局模板。
- **Q: 如何设计 UI？** A: 遵循 `DESIGN.md` 中的设计规范（MiniMax 风格：白色主导、pill 按钮、品牌蓝色系）。
- **Q: @mention 如何触发 Agent？** A: 在聊天输入中使用 @ 符号，TipTap 的 mention 扩展会展示 Agent 列表，发送消息时自动解析 mentions 字段并触发后端 `runMentionedAgent()`。
- **Q: 如何配置通知？** A: 在项目设置面板（ProjectSettingsPanel）中配置通知平台、事件和 Bot Agent。
- **Q: 如何切换后端服务器？** A: 使用 ServerSwitcher 组件添加和切换服务器实例，配置存储在 localStorage。
- **Q: 首页 Dashboard 数据从哪来？** A: 调用 `GET /api/agents/usage/dashboard?days=30` 获取 SQLite 聚合数据。
- **Q: 认证如何工作？** A: 登录页输入 Secret Key -> 后端返回 Token -> localStorage 存储 -> 后续请求带 Bearer Token。401 自动跳转登录。
- **Q: 文件夹浏览器如何工作？** A: `FolderPicker` 组件调用 `GET /api/folder/browse?path=` 获取目录列表，支持导航和创建新目录。
- **Q: Workflow 编辑器使用什么库？** A: @xyflow/react（React Flow）+ @dagrejs/dagre 自动布局，在 `components/workflow/` 目录下。
- **Q: 如何切换中英文？** A: 在 Settings 对话框中选择 Language（中文/English），存储在 localStorage，即时生效。
- **Q: Native 通知支持哪些平台？** A: 自动检测运行环境：Tauri webview 使用 @tauri-apps/plugin-notification，浏览器使用 Notification API。
- **Q: Command Palette 如何使用？** A: 按 Ctrl+K 打开，输入关键词搜索工作空间/频道/Issue/文件/服务器，支持自定义命令注册。
- **Q: 订阅余额面板如何工作？** A: `subscription-panel.tsx` 调用 `GET /api/subscriptions/:id/quota` 获取配额数据，支持智谱/MiniMax/AICode 三供应商。
- **Q: 语音识别如何工作？** A: `useSpeechRecognition` Hook 连接 `/ws/speech` WebSocket，采集麦克风音频流发送到后端，实时返回识别文本。
- **Q: Iframe Tab 管理器如何工作？** A: `IframeLinkInterceptor` 拦截 `target="_blank"` 的跨域链接，在 Iframe Tab 中打开。浮动球显示已打开的 Tab 列表。
- **Q: Monaco Models 预加载如何工作？** A: `monaco-models.ts` 在打开工作空间时预加载 TS/JS 文件到 Monaco TextModel，避免编辑器切换时重新加载。
- **Q: TypeScript LSP 如何工作？** A: `monaco-language-client.ts` 通过 WebSocket `/ws/lsp/typescript` 连接后端 `typescript-language-server`，提供定义跳转/引用/诊断。详见 `docs/monaco-typescript-lsp.md`。
- **Q: 代码收藏如何使用？** A: Monaco 编辑器右键菜单"添加到代码收藏"，弹出对话框填写 label，保存后可在 CodeFavoritesPanel 中查看/跳转/删除。
- **Q: DOM Inspector 如何工作？** A: 被调试项目安装 dom-inspector-hook 后，Alt+Shift 点击元素触发 POST `/api/inspector/track`，前端通过 WebSocket 接收 `inspector.jump` 事件自动打开文件。详见 `docs/dom-inspector-integration.md`。
- **Q: Inspector 历史记录存在哪？** A: `stores/inspector-history.ts` 使用 localStorage 持久化，key 为 `agent-spaces:inspector-history:{workspaceId}`，最多保留 50 条。
- **Q: Prompt 模板管理在哪？** A: `/settings/prompts` 页面，或侧边栏 PromptsDialog。支持创建/编辑/删除/批量应用到 Agent。
- **Q: Hook 管理在哪？** A: `/settings/hooks` 或侧边栏 HooksDialog。支持 CRUD、上传 JSON、Monaco 编辑器、应用到其他工作空间。
- **Q: 输出风格管理在哪？** A: `/settings/output-styles` 或侧边栏 OutputStylesDialog。支持 CRUD、上传 JSON、Monaco 编辑器。
- **Q: 回复 AI 消息如何工作？** A: 点击 AI 消息的回复按钮，composer 切换到回复模式。发送后用户回复写入父消息的 replies 数组，后端自动续跑 Agent。详见 `docs/reply-ai-message-workflow.md`。
- **Q: 频道管理如何工作？** A: 频道列表支持创建/编辑/归档，频道信息面板显示成员和设置，成员管理支持添加/移除/查看详情。
- **Q: Kanban 看板如何使用？** A: 工作空间内 Kanban 面板，支持 @dnd-kit 拖拽排序、水平/垂直布局切换、列管理、优先级筛选、搜索过滤。
- **Q: 文档数据库如何使用？** A: Notion 风格树形文档系统，支持 Notion（TipTap）/Markdown（Monaco）双编辑器、快速搜索、回收站、向量搜索、版本历史、AI 对话。
- **Q: Worktree 面板如何使用？** A: 创建独立 Worktree 分支，支持查看 Diff、AI 生成 PR 描述、PR 创建和合并。
- **Q: Theme Style System 如何使用？** A: 侧边栏 Layout Manager 或设置页切换主题预设（如 Mira），支持自定义 CSS 注入。存储在 localStorage。
- **Q: Layout Templates 如何使用？** A: 侧边栏 Layout Manager Dialog 保存当前 FlexLayout 布局为模板，支持导入/导出/删除。
- **Q: Agent Store 如何使用？** A: 在线导入 Agent 模板，从 GitHub 仓库获取索引，支持自定义 API Base URL。
- **Q: Send to Issue/Channel 如何使用？** A: Monaco 编辑器右键选择"Send to Issue"或"Send to Channel"，代码片段发送到目标 Issue 评论或频道聊天。
- **Q: Content Usage Report 是什么？** A: 跨 Store/工作空间/终端的综合用量统计报告。
- **Q: Tools 设置页在哪？** A: `/settings/tools`，管理内置 Agent 工具（如 CreateCurrentChannelIssue/ViewCurrentChannelIssue/AddCurrentChannelComment）。

## 相关文件清单

```
packages/web/
  package.json
  tsconfig.json
  next.config.ts                  # Next.js 配置（API 代理）
  server.mjs                      # 自定义开发服务器
  components.json                 # shadcn/ui 配置
  DESIGN.md                       # UI 设计规范（MiniMax 风格）
  AGENTS.md                       # Next.js 16 Breaking Changes 提示
  pnpm-workspace.yaml             # web 子工作空间配置
  CLAUDE.md                       # 本文件
  src/
    app/                          # Next.js App Router 页面
      login/                      # 登录页
      settings/                   # 设置页（agents/skills/mcps/models/providers/prompts/output-styles/tools）
      workflows/                  # Workflow 管理页
      chat/                        # Chat 独立对话页
      workflows/[id]/             # Workflow 编辑器独立页
      workspace/[id]/             # 工作空间 IDE 页
      workspaces/                 # 工作空间列表页
    components/                   # React 组件
      chat/                       # 聊天组件（消息/频道/成员）
      command-palette.tsx         # Command Palette
      composer/                   # Composer 编辑器
      database/                   # 文档数据库（15 文件）
      dev-inspector.tsx           # DOM Inspector
      editor/                     # Monaco 编辑器组件
      forgeui/                    # ForgeUI 风格组件
      git/                        # Git 面板（20 文件）
      issue/                      # 议题管理
      kanban/                     # Kanban 看板（6 文件）
      layout/                     # 布局组件
      sidebar/                    # 侧边栏（45 文件）
      workflow/                   # Workflow DAG 编辑器
      worktree/                   # Worktree 面板（3 文件）
      common/                     # 通用组件
      ui/                         # shadcn/ui 基础组件
    hooks/                        # React Hooks
    lib/                          # 工具库（24 文件）
    locales/                      # i18n 翻译文件（31 命名空间 x 2 语言）
    stores/                       # Zustand Store（25 个）
```

## 变更记录 (Changelog)