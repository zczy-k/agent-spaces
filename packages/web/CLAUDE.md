[根目录](../../CLAUDE.md) > [packages](../) > **web**

# @agent-spaces/web

## 模块职责

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。包含登录认证、工作空间管理、用量统计仪表盘、订阅余额面板、项目设置面板（通知配置+Prompt配置）、服务器切换器、文件夹浏览器、FlexLayout IDE 布局、Monaco 代码编辑器（TypeScript LSP 定义跳转/引用/诊断 + Model 缓存预加载 + 搜索面板 + 代码收藏 + Monaco Action Registry + 菜单栏 + 移动端适配）、xterm.js 终端（快捷命令+虚拟键盘）、TipTap 富文本聊天（含 @mention Agent + 语音识别输入 + 回复 AI 消息工作流）、结构化 AI 消息渲染（chain/tool-step/context-panel/context-usage/tool-detail/diff/token-usage/confirmation/subagent/ask_user_question）、Workflow 可视化编辑器（@xyflow/react DAG + @dagrejs/dagre 自动布局）、议题管理（含 Workflow 选择 + 拖拽排序任务面板）、Git 操作面板（含设置表单 + commit diff viewer + context menu + discard 对话框 + 远程同步）、频道管理（频道对话框 + 频道信息面板 + 成员管理 + 成员信息对话框）、Agent 配置管理、LLM 模型管理（模型 + 供应商对话框）、头像上传、移动端适配、i18n 中英文切换（next-intl，52 个组件已改造）、Native 通知（Tauri/Browser）、Command Palette（Ctrl+K 快捷面板，cmdk）、Iframe Tab 管理器、浮动面板/浮球、DOM Inspector 源码定位、Inspector 历史记录、独立设置页（Agents/Skills/MCPs/Models/Providers/Prompts/OutputStyles/Hooks）、通知中心对话框、Hook 管理对话框、输出风格管理对话框、Providers 管理对话框、Prompt 模板管理等核心功能。通过 Zustand 管理全局状态（18 个 Store），WebSocket 实现实时数据同步，支持多后端服务器切换。

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
| `/settings/output-styles` | `src/app/settings/output-styles/page.tsx` | 输出风格管理设置页（**新**） |

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
| `WorkflowEditor` | `workflow/workflow-editor.tsx` | 编辑器主容器（ReactFlowProvider + 工具栏 + 画布 + 调色板） |
| `WorkflowCanvas` | `workflow/workflow-canvas.tsx` | DAG 画布（ReactFlow + Dagre 自动布局 + 连线交互） |
| `WorkflowAgentNode` | `workflow/workflow-agent-node.tsx` | Agent 节点组件（显示 avatar + label + role） |
| `WorkflowAgentPalette` | `workflow/workflow-agent-palette.tsx` | Agent 调色板（拖拽添加节点，按 role 分组） |
| `WorkflowToolbar` | `workflow/workflow-toolbar.tsx` | 工具栏（保存/返回/名称/描述） |
| `WorkflowMiniPreview` | `workflow/workflow-mini-preview.tsx` | 缩略图预览 |
| `WorkflowList` | `workflow/workflow-list.tsx` | Workflow 列表项 |
| `WorkflowsPage` | `workflows/workflows-page.tsx` | Workflow 管理页（列表 + 创建 + 编辑入口） |
| `WorkflowTemplates` | `workflows/workflow-templates.ts` | 模板管理组件 |
| `WorkflowTemplatesDialog` | `workflows/workflow-templates-dialog.tsx` | 模板选择对话框（Issue 创建时使用） |

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
| `components/chat/message-item.tsx` | 消息项组件（含回复/复制/删除/成员信息）（**新**） |
| `components/chat/message-navigator.tsx` | 消息导航器（上下翻页 + 预览）（**新**） |
| `components/chat/context.tsx` | 通用 context 组件（Progress Circle）（**新**） |
| `components/chat/channel-dialog.tsx` | 频道创建/编辑对话框（**新**） |
| `components/chat/channel-list.tsx` | 频道列表（含排序/筛选/归档）（**新**） |
| `components/chat/channel-info-panel.tsx` | 频道详情面板（成员/设置/编辑）（**新**） |
| `components/chat/member-info-dialog.tsx` | 成员信息对话框（**新**） |
| `components/chat/add-member-dialog.tsx` | 添加成员对话框（**新**） |
| `components/chat/chat-input-utils.ts` | 聊天输入工具函数（从 chat-input 拆分） |
| `components/chat/chat-input-attachments.ts` | 聊天输入附件处理（从 chat-input 拆分） |
| `components/chat/chat-input-agent-bar.tsx` | 聊天输入 Agent 选择栏（从 chat-input 拆分） |
| `components/chat/chat-input-info-bar.tsx` | 聊天输入信息栏（从 chat-input 拆分） |
| `components/composer/create-file-search-extension.ts` | 文件搜索 TipTap 扩展 |
| `components/composer/suggestion-list.tsx` | TipTap mention 建议列表（**新**） |
| `components/composer/composer-shell.tsx` | Composer 外壳组件（发送/停止/Inspector 按钮）（**新**） |

### Issue 管理增强

Issue 详情页拆分为多个子组件（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/issue/edit-issue-dialog.tsx` | 编辑议题对话框（含 Workflow 选择 + 成员分配） |
| `components/issue/issue-detail-header.tsx` | 议题详情头部（状态/优先级/负责人/操作按钮） |
| `components/issue/issue-detail-comments.tsx` | 议题评论区域 |
| `components/issue/issue-detail-tasks-panel.tsx` | 任务面板（支持 @dnd-kit 拖拽排序） |
| `components/issue/task-row.tsx` | 任务行组件（可拖拽 + 状态/重试/编辑） |

### Git 增强组件

Git 面板拆分为多个子组件（**新**）。

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

### Hook 管理对话框

Hook 配置管理对话框（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/hooks-dialog.tsx` | Hook CRUD + 上传 JSON + Monaco 编辑器 + 应用到工作空间 |
| `stores/hooks.ts` | Hook Store（fetch/create/update/delete/upload/apply） |

### 输出风格管理对话框

输出风格模板管理对话框（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/output-styles-dialog.tsx` | OutputStyle CRUD + 上传 JSON + Monaco 编辑器 |

### Skills Dialog 子目录

Skills 管理对话框拆分为 7 文件子目录（**新**）。

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

LLM 供应商管理对话框（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/sidebar/providers-dialog.tsx` | LLM 供应商 CRUD 对话框（含 API Base/Key 配置） |

### UI 基础组件重写

多个 UI 组件迁移到 @base-ui/react 基础（**新**）。

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

基于 next-intl 的中英文多语言切换系统，52 个组件已完成改造。

| 文件 | 说明 |
|------|------|
| `src/locales/zh.json` | 中文翻译（默认语言） |
| `src/locales/en.json` | 英文翻译 |
| `src/i18n/request.ts` | next-intl SSR 配置 |
| `src/components/locale-provider.tsx` | LocaleProvider + useLocale（localStorage 持久化 + useSyncExternalStore） |

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
- **主题**：`next-themes` 支持 light/dark/system 切换
- **i18n**：`next-intl` + LocaleProvider，默认中文，localStorage 持久化
- **自定义 server**：`server.mjs` 提供开发服务器
- **Inspector**：`react-dev-inspector` 开发辅助
- **API Polyfill**：`lib/api-polyfill.ts` 自动为 /api/ 请求添加活跃服务器前缀
- **静态路由**：`lib/navigate.ts` Tauri 静态导出路由适配
- **路由工具**：`lib/routes.ts` 路径解析辅助

## 数据模型

前端不直接管理数据模型，所有数据通过 REST API 获取、WebSocket 实时更新。

### Zustand Stores

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
| `useMobilePanelStore` | `stores/mobile-panel.ts` | activePanel | 移动端面板切换 |
| `useCommandStore` | `stores/command.ts` | commands, runningMap | 快捷命令管理（CRUD + 运行/停止） |
| `useCommandPalette` | `stores/command-palette.ts` | open, commands | Command Palette 注册/触发 |
| `useNotificationStore` | `stores/notification.ts` | notifications, loaded | 应用内通知（加载/标记已读/清空） |
| `useIframeTabs` | `stores/iframe-tabs.ts` | tabs, activeId | Iframe Tab 管理 |
| `useCodeFavoritesStore` | `stores/code-favorites.ts` | favorites, pendingFavorite | 代码收藏（CRUD + 待添加） |
| `useInspectorHistoryStore` | `stores/inspector-history.ts` | histories | Inspector 历史记录（localStorage） |
| `useHookStore` | `stores/hooks.ts` | hooks, selectedName, loading | Hook 配置管理（CRUD + upload + apply）（**新**） |

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

### 语音识别

`src/hooks/use-speech-recognition.ts` 提供语音识别 Hook：
- `useSpeechRecognition()` -- 自动加载配置，WebSocket 流式发送音频，实时返回识别结果
- 集成到 ChatInput 语音按钮

### 用户头像

`src/hooks/use-user-avatar.ts` 提供用户头像 Hook：
- `useUserAvatar()` -- 从 API 加载头像 URL，localStorage 缓存

## 测试与质量

- **Lint**：`pnpm lint`（eslint + eslint-config-next）
- 当前无单元测试或 E2E 测试

## 常见问题 (FAQ)

- **Q: Next.js 16 有什么不同？** A: 参考 `AGENTS.md` 和 `node_modules/next/dist/docs/`，API 和文件结构可能有 Breaking Changes。
- **Q: 为什么 API 请求不需要完整 URL？** A: `next.config.ts` 中配置了 rewrites，将 `/api/*` 代理到后端 `localhost:3100`。
- **Q: FlexLayout 布局如何自定义？** A: 修改 `workspace-shell.tsx` 中的 `defaultJson` 配置对象。
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
    (如上代码结构所示)
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-20T14:08:52+08:00 | 增量更新 | **Hook 管理**（新增 stores/hooks.ts + components/sidebar/hooks-dialog.tsx，CRUD + upload JSON + Monaco 编辑器 + apply to workspace）；**输出风格管理**（新增 components/sidebar/output-styles-dialog.tsx + app/settings/output-styles/page.tsx，CRUD + Monaco 编辑器）；**聊天组件大规模拆分**（message-item/message-navigator/context/channel-dialog/channel-list/channel-info-panel/member-info-dialog/add-member-dialog 8 个新组件，频道管理完整功能）；**Issue 组件拆分**（edit-issue-dialog/issue-detail-header/issue-detail-comments/issue-detail-tasks-panel/task-row 5 个新组件，支持 @dnd-kit 拖拽排序）；**Git 组件拆分**（use-git-sync/git-prompt-dialog/git-gitignore-dialog/git-file-context-menu/git-commit-context-menu/git-commit-utils/git-commit-detail-dialog/git-discard-dialog/diff-viewer 9 个新组件）；**Composer 拆分**（suggestion-list/composer-shell 2 个新组件）；**Skills Dialog 子目录**（skills-dialog.tsx 拆分为 skills-dialog/ 目录 7 文件：skill-list/skill-edit/skill-import/skill-sync/skill-bind/types/use-skills-data）；**新增 UI 基础组件**（search-select/markdown/skeleton/drawer/dialog/sheet/alert-dialog/input 迁移到 @base-ui/react + theme-provider + providers-dialog）；**Zustand Store 16->18**（新增 useHookStore）；**文件数 245->265** |
| 2026-05-19T09:45:03+08:00 | 增量更新 | **TypeScript LSP**（新增 lib/monaco-language-client.ts + lib/monaco-action-registry.ts + lib/monaco-builtin-actions.ts）；**代码收藏**（新增 stores/code-favorites.ts + components/editor/code-favorites-panel.tsx + add-favorite-dialog.tsx）；**Prompt 模板**（新增 app/settings/prompts/page.tsx + components/sidebar/prompts-dialog.tsx）；**DOM Inspector**（新增 components/dev-inspector.tsx + stores/inspector-history.ts）；**编辑器增强**（code-editor-clipboard/navigation/utils/menu-bar/mobile/mobile-overlay）；**聊天拆分**（chat-input 拆分 4 文件 + message-tool-step/context-panel/context-usage + create-file-search-extension）；**浮动组件**（floating-panel + floating-ball）；**设置增强**（notification-settings-tab/workspace-prompt-section/workspace-info-section）；**文件数 215->245** |
| 2026-05-16T17:36:40+08:00 | 增量更新 | **Command Palette** + **订阅面板** + **语音识别** + **快捷命令** + **搜索面板** + **Iframe 管理** + **应用内通知** + **Skill/MCP 管理** + **独立设置页** + **UI/导航增强**；**文件数 168->215** |
| 2026-05-08T17:18:31+08:00 | 增量更新 | **Workflow 可视化编辑器** + **i18n 中英文切换** + **Native 通知**；**文件数 141->168** |
| 2026-05-05T23:52:43+08:00 | 增量更新 | 登录页、认证模块、服务器切换器、工作空间管理页、项目设置面板、用量仪表盘、文件夹选择器、Git 增强、移动端适配、40+ UI 组件 |
| 2026-05-04T21:04:42+08:00 | 增量更新+补扫 | 新增 agent store、message-parts 结构化渲染、三运行时配置、Anthropic Bridge、头像上传 |
| 2026-05-02T23:43:41 | 增量更新 | 补充 TipTap 富文本编辑器、Agent 对话框、LLM 管理对话框、composer 组件、workspace 对话框、DESIGN.md 设计规范 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
