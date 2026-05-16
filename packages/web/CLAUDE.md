[根目录](../../CLAUDE.md) > [packages](../) > **web**

# @agent-spaces/web

## 模块职责

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。包含登录认证、工作空间管理、用量统计仪表盘、订阅余额面板、项目设置面板（通知配置+Prompt配置）、服务器切换器、文件夹浏览器、FlexLayout IDE 布局、Monaco 代码编辑器（Model 缓存预加载+搜索面板）、xterm.js 终端（快捷命令+虚拟键盘）、TipTap 富文本聊天（含 @mention Agent + 语音识别输入）、结构化 AI 消息渲染（chain/tool-detail/diff/token-usage/confirmation/subagent/ask-user_question）、Workflow 可视化编辑器（@xyflow/react DAG + @dagrejs/dagre 自动布局）、议题管理（含 Workflow 选择）、Git 操作面板（含设置表单）、Agent 配置管理、LLM 模型管理、头像上传、移动端适配、i18n 中英文切换（next-intl，52 个组件已改造）、Native 通知（Tauri/Browser）、Command Palette（Ctrl+K 快捷面板，cmdk）、Iframe Tab 管理器、浮动控制台面板、Viewport 适配、Tauri Zoom 缩放、独立设置页（Agents/Skills/MCPs/Models/Providers）、通知中心对话框等核心功能。通过 Zustand 管理全局状态（14 个 Store），WebSocket 实现实时数据同步，支持多后端服务器切换。

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
| `/settings` | `src/app/settings/page.tsx` | 设置首页（**新**） |
| `/settings/agents` | `src/app/settings/agents/page.tsx` | Agent 预设设置页（**新**） |
| `/settings/skills` | `src/app/settings/skills/page.tsx` | 技能管理设置页（**新**） |
| `/settings/mcps` | `src/app/settings/mcps/page.tsx` | MCP 配置设置页（**新**） |
| `/settings/models` | `src/app/settings/models/page.tsx` | LLM 模型设置页（**新**） |
| `/settings/providers` | `src/app/settings/providers/page.tsx` | LLM 供应商设置页（**新**） |

### FlexLayout 面板映射

| 组件名 | 面板 | 位置 | 说明 |
|--------|------|------|------|
| `channel-list` | 频道列表 | 左侧 (25%) | 频道列表 + 创建频道 |
| `issue-list` | 议题列表 | 左侧 (25%) | 议题列表 + 创建议题 |
| `editor` | 代码编辑器 | 右侧 (75%) | FileTree + EditorTabs + Monaco Editor + SearchPanel |
| `chat` | 聊天面板 | 右侧 (75%) | 消息列表 + TipTap 富文本输入 + @mention Agent + 语音识别 |
| `issue-detail` | 议题详情 | 右侧 (75%) | 议题详细视图 |
| `terminal` | 终端 | 底部 dock | xterm.js 多 tab 终端 + 快捷命令 |
| `git` | Git 面板 | 底部 dock | Git 状态 + Diff 查看 + 设置 |

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

Ctrl+K 快捷命令面板，全局搜索和导航（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/command-palette.tsx` | Command Palette 主组件（cmdk） |
| `stores/command-palette.ts` | 命令注册/注销/触发 store |
| `stores/search-commands/` | 搜索提供者目录（6 文件） |
| `stores/search-commands/index.ts` | 搜索引擎统一入口 |
| `stores/search-commands/types.ts` | 搜索结果类型定义 |
| `stores/search-commands/workspace-search.ts` | 工作空间搜索 |
| `stores/search-commands/channel-search.ts` | 频道搜索 |
| `stores/search-commands/file-search.ts` | 文件搜索 |
| `stores/search-commands/issue-search.ts` | 议题搜索 |
| `stores/search-commands/server-search.ts` | 服务器搜索 |
| `components/ui/command.tsx` | cmdk UI 组件 |

### Iframe Tab 管理器

嵌入式网页 Tab 管理系统（**新**）。

| 组件/文件 | 说明 |
|-----------|------|
| `components/common/iframe-manager.tsx` | IframeLinkInterceptor + IframeFloatingBall + IframeOverlay |
| `stores/iframe-tabs.ts` | Iframe Tab 状态管理（add/remove/setActive） |

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
| `cmdk` (1.1) | Command Palette 组件（**新**） |
| `@monaco-editor/react` | 代码编辑器 |
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
| `@dnd-kit/react` | 拖放功能（**新**） |
| `@base-ui/react` | 基础 UI 组件（**新**） |
| `@emotion/is-prop-valid` | Emotion prop 过滤（**新**） |
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
- **API Polyfill**：`lib/api-polyfill.ts` 自动为 /api/ 请求添加活跃服务器前缀（**新**）
- **静态路由**：`lib/navigate.ts` Tauri 静态导出路由适配（**新**）
- **路由工具**：`lib/routes.ts` 路径解析辅助（**新**）

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
| `useCommandStore` | `stores/command.ts` | commands, runningMap | 快捷命令管理（CRUD + 运行/停止）（**新**） |
| `useCommandPalette` | `stores/command-palette.ts` | open, commands | Command Palette 注册/触发（**新**） |
| `useNotificationStore` | `stores/notification.ts` | notifications, loaded | 应用内通知（加载/标记已读/清空）（**新**） |
| `useIframeTabs` | `stores/iframe-tabs.ts` | tabs, activeId | Iframe Tab 管理（**新**） |

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

`src/lib/monaco-models.ts` 提供 Monaco Editor Model 缓存和预加载（**新**）：
- `getOrCreateModel(workspaceId, filePath, content)` -- 获取或创建 Monaco TextModel
- `preloadDirectoryModels(workspaceId, dirPath)` -- 预加载目录下 TS/JS 文件
- 自动检测语言类型（TS/JS/JSON/CSS/HTML/YAML/Python/Rust/Go/SQL/Shell）

### 语音识别

`src/hooks/use-speech-recognition.ts` 提供语音识别 Hook（**新**）：
- `useSpeechRecognition()` -- 自动加载配置，WebSocket 流式发送音频，实时返回识别结果
- 集成到 ChatInput 语音按钮

### 用户头像

`src/hooks/use-user-avatar.ts` 提供用户头像 Hook（**新**）：
- `useUserAvatar()` -- 从 API 加载头像 URL，localStorage 缓存

## 代码结构

```
packages/web/src/
  app/
    layout.tsx                    # 根布局（字体 + ThemeProvider + LocaleProvider + AuthGuard + AppShell + CommandPalette + ConsolePanel + IframeManager + ViewportInsets + ZoomWrapper）
    page.tsx                      # 首页（SSR: fetch workspaces -> HomePage）
    login/page.tsx                # 登录页（Secret Key 认证）
    workflows/page.tsx            # Workflow 管理页
    workspaces/page.tsx           # 工作空间管理页（SSR）
    settings/                     # 设置页面（新增目录）
      layout.tsx                  # 设置页布局
      page.tsx                    # 设置首页
      agents/page.tsx             # Agent 预设设置页
      skills/page.tsx             # 技能管理设置页
      mcps/page.tsx               # MCP 配置设置页
      models/page.tsx             # LLM 模型设置页
      providers/page.tsx          # LLM 供应商设置页
    workspace/[id]/
      page.tsx                    # Workspace 页（加载 workspace -> WorkspaceClient）
      workspace-client.tsx        # Workspace 客户端组件
    globals.css                   # 全局样式
    api/
      upload/route.ts             # 文件上传 API Route
      [...path]/route.ts          # API 代理（proxy.ts）
  i18n/
    request.ts                    # next-intl SSR 配置
  locales/
    zh.json                       # 中文翻译
    en.json                       # 英文翻译
  components/
    auth-guard.tsx                # 认证守卫（未登录跳转 /login）
    app-shell.tsx                 # 应用外壳（SidebarProvider + SidebarInset）
    locale-provider.tsx           # LocaleProvider + useLocale
    command-palette.tsx           # Command Palette 主组件（cmdk）（新增）
    zoom-wrapper.tsx              # Tauri Zoom 缩放适配（新增）
    viewport-insets.tsx           # 虚拟键盘/viewport 适配（新增）
    dev-inspector.tsx             # 开发辅助 Inspector
    theme-provider.tsx            # 主题切换 Provider
    layout/
      workspace-shell.tsx         # FlexLayout IDE 布局（核心容器）
      workspace-tabs.tsx          # 工作空间标签栏
      mobile-tab-bar.tsx          # 移动端标签栏
    sidebar/
      app-sidebar.tsx             # 主侧边栏（DashboardSidebar）
      index.tsx                   # 侧边栏导航
      logo.tsx                    # Logo 组件
      nav-main.tsx                # 主导航
      nav-notifications.tsx       # 通知导航（新增）
      server-switcher.tsx         # 服务器切换器（多后端实例管理）
      server-manager-dialog.tsx   # 服务器管理对话框
      server-form-dialog.tsx      # 服务器表单对话框
      models-dialog.tsx           # LLM 模型管理对话框（含成本配置）
      providers-dialog.tsx        # LLM 供应商管理对话框
      settings-dialog.tsx         # 设置对话框（含 Language 选择器）
      agent-dialog.tsx            # Agent 预设配置对话框（创建/编辑）
      agent-detail.tsx            # Agent 详情展示
      agent-list.tsx              # Agent 列表展示
      agent-shared.tsx            # Agent 共享组件
      skills-dialog.tsx           # 技能管理对话框（新增）
      mcps-dialog.tsx             # MCP 配置管理对话框（新增）
      notification-center-dialog.tsx # 通知中心对话框（新增）
    workflow/                     # Workflow 可视化编辑器
      workflow-editor.tsx         # 编辑器主容器
      workflow-canvas.tsx         # DAG 画布
      workflow-agent-node.tsx     # Agent 节点组件
      workflow-agent-palette.tsx  # Agent 调色板
      workflow-toolbar.tsx        # 工具栏
      workflow-mini-preview.tsx   # 缩略图预览
      workflow-list.tsx           # Workflow 列表项
    workflows/                    # Workflow 管理页
      workflows-page.tsx          # Workflow 管理页组件
      workflow-templates.ts       # 模板管理组件
      workflow-templates-dialog.tsx # 模板选择对话框
    editor/
      editor-panel.tsx            # 编辑器面板（FileTree + CodeEditor + SearchPanel）
      file-tree.tsx               # 文件树（递归渲染）
      file-icon.tsx               # 文件图标组件
      editor-tabs.tsx             # 编辑器 tab 栏
      code-editor.tsx             # Monaco Editor 集成
      search-panel.tsx            # 代码搜索面板（新增）
      import-file-dialog.tsx      # 导入文件对话框（新增）
    chat/
      chat-panel.tsx              # 聊天面板
      chat-input.tsx              # 聊天输入（TipTap 集成 + 工具选择 + 语音识别）
      channel-list.tsx            # 频道列表
      channel-dialog.tsx          # 频道对话框
      channel-info-panel.tsx      # 频道信息面板
      message-item.tsx            # 消息条目
      message-parts.tsx           # 结构化消息 Parts 渲染主入口（636 行），8 种 Part 类型分发
      message-navigator.tsx       # 消息快速导航器
      add-member-dialog.tsx       # 添加成员对话框
      member-card.tsx             # 成员卡片
      member-info-dialog.tsx      # 成员信息对话框
      context.tsx                 # 聊天上下文
      confirmation.tsx            # 确认消息组件
      commit.tsx                  # 提交消息组件
      chain-of-thought.tsx        # 思维链展示组件
      queue.tsx                   # 队列组件
      readonly-code-block.tsx     # 只读代码块
      task.tsx                    # 任务消息组件
      terminal.tsx                # 终端消息组件
      subagent.tsx                # 子 Agent 展示组件
      ask-user-question.tsx       # Agent 向用户提问组件
      attachments.tsx             # 附件展示组件
    composer/
      composer-shell.tsx          # Composer 外壳
      composer-editor.tsx         # Composer 编辑器（TipTap）
      composer-dialog.tsx         # Composer 对话框
      suggestion-list.tsx         # 建议（mention）列表
      create-slash-extension.ts   # 斜杠命令扩展
      create-suggestion-renderer.ts # Suggestion 渲染器
    issue/
      issue-list.tsx              # 议题列表
      issue-detail.tsx            # 议题详情
      issue-detail-header.tsx     # 议题详情头部
      issue-detail-info-panel.tsx # 议题详情信息面板
      issue-detail-tasks-panel.tsx # 议题详情任务面板
      issue-detail-comments.tsx   # 议题详情评论
      issue-message.tsx           # 议题消息
      edit-issue-dialog.tsx       # 议题编辑对话框（含 Workflow 选择）
      create-issue-dialog.tsx     # 议题创建对话框（含 Workflow 选择）
      comment-navigator.tsx       # 评论导航器
      task-row.tsx                # 任务行组件
      collect-mention-ids.ts      # mention ID 收集工具
      issue-status-colors.ts      # 议题状态颜色常量
    terminal/
      terminal-panel.tsx          # 终端面板（多 tab）
      terminal-instance.tsx       # xterm.js 终端实例
      terminal-toolbar.tsx        # 终端工具栏（新增）
      terminal-utils.ts           # 终端工具函数（新增）
      virtual-keyboard.tsx        # 虚拟键盘（新增）
      command-dialog.tsx          # 快捷命令对话框（新增）
      command-sidebar.tsx         # 快捷命令侧边栏（新增）
      import-commands-dialog.tsx  # 导入命令对话框（新增）
    git/
      git-panel.tsx               # Git 操作面板
      git-changes-panel.tsx       # Git Changes 面板
      git-commits-panel.tsx       # Git Commits 面板
      git-remote-dialog.tsx       # Git Remote 对话框
      git-settings-form.tsx       # Git 设置表单（新增，替代 git-graph-panel）
      git-not-initialized.tsx     # Git 未初始化提示
      diff-viewer.tsx             # Monaco DiffEditor 差异查看
    home/
      home-page.tsx               # 首页组件（工作空间列表 + Usage Dashboard）
      usage-dashboard.tsx         # 用量统计仪表盘（图表+表格+日期选择+模型图标）
      subscription-panel.tsx      # 订阅余额面板（新增）
      subscription-dialog.tsx     # 订阅配置对话框（新增）
    workspace/
      workspace-dialog.tsx        # 工作空间创建/管理对话框（含文件夹浏览器 + Git Clone）
    workspaces/
      workspaces-page.tsx         # 工作空间管理页组件
    settings/
      settings-page-layout.tsx    # 设置页面布局组件（新增）
      project-settings-panel.tsx  # 项目设置面板（通知配置 + Prompt 配置 + WeChat QR）
    common/
      agent-icon.tsx              # Agent 图标组件
      user-icon.tsx               # 用户图标组件
      member-picker.tsx           # 成员选择器（新增）
      console-panel.tsx           # 浮动控制台面板（新增）
      iframe-manager.tsx          # Iframe Tab 管理器（新增）
    ui/                           # shadcn/ui 组件（42 个）
      accordion, alert, avatar, badge, breadcrumb, button, card, chart,
      collapsible, command, context-menu, copy-code, dialog, drawer,
      dropdown-menu, file-upload, folder-picker, hover-card, input,
      input-group, label, loader, markdown, navigation-menu, pagination,
      popover, progress, scroll-area, search-select, separator, sheet,
      shimmer, sidebar, skeleton, slider, status-badge, switch, table,
      tabs, textarea, tooltip
    shadcn-studio/blocks/         # 参考组件块
    timeline/                     # 版本时间线组件
      timeline-component.tsx
      content/v1-1-0.tsx, v1-2-0.tsx, v1-3-0.tsx
  stores/
    agent.ts                      # Agent Preset 状态
    editor.ts                     # 编辑器状态
    terminal.ts                   # 终端状态
    channel.ts                    # 频道/消息状态
    issue.ts                      # 议题状态
    task.ts                       # 任务状态
    git.ts                        # Git 状态
    workspace.ts                  # 工作空间列表状态
    llm.ts                        # LLM 模型/供应商状态
    workflow.ts                   # Workflow 模板状态
    mobile-panel.ts               # 移动端面板状态
    command.ts                    # 快捷命令状态（新增）
    command-palette.ts            # Command Palette 状态（新增）
    notification.ts               # 应用内通知状态（新增）
    iframe-tabs.ts                # Iframe Tab 状态（新增）
    search-commands/              # 搜索提供者（新增目录）
      index.ts                    # 搜索引擎统一入口
      types.ts                    # 搜索结果类型
      workspace-search.ts         # 工作空间搜索
      channel-search.ts           # 频道搜索
      file-search.ts              # 文件搜索
      issue-search.ts             # 议题搜索
      server-search.ts            # 服务器搜索
  hooks/
    use-mobile.ts                 # 移动端检测 Hook
    use-pagination.ts             # 分页 Hook
    use-user-avatar.ts            # 用户头像 Hook（新增）
    use-speech-recognition.ts     # 语音识别 Hook（新增）
  lib/
    ws.ts                         # WebSocket 客户端
    utils.ts                      # cn() 工具函数
    users.ts                      # 用户数据
    commands.ts                   # 命令定义
    agent-members.ts              # Agent 成员工具函数
    auth.ts                       # 认证工具（Token 管理 + fetchWithAuth）
    server.ts                     # 多服务器配置管理
    monaco-loader.ts              # Monaco Editor 加载器
    monaco-models.ts              # Monaco Model 缓存和预加载（新增）
    native-notification.ts        # Native 通知抽象层（Tauri/Browser）
    api-polyfill.ts               # API 请求 Polyfill（新增）
    navigate.ts                   # Tauri 静态路由适配（新增）
    routes.ts                     # 路径解析工具（新增）
  proxy.ts                        # API 代理工具
  types/
    react-virtualized.d.ts        # react-virtualized 类型声明
```

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
| 2026-05-16T17:36:40+08:00 | 增量更新 | **Command Palette**（新增 stores/command-palette.ts + components/command-palette.tsx + components/ui/command.tsx + stores/search-commands/ 6 文件，Ctrl+K 快捷面板）；**订阅面板**（新增 home/subscription-panel.tsx + home/subscription-dialog.tsx）；**语音识别**（新增 hooks/use-speech-recognition.ts，WebSocket 流式识别）；**快捷命令**（新增 stores/command.ts + components/terminal/command-dialog.tsx + command-sidebar.tsx + import-commands-dialog.tsx + terminal-toolbar.tsx + terminal-utils.ts + virtual-keyboard.tsx）；**搜索面板**（新增 components/editor/search-panel.tsx + import-file-dialog.tsx）；**Iframe 管理**（新增 stores/iframe-tabs.ts + components/common/iframe-manager.tsx）；**应用内通知**（新增 stores/notification.ts + components/sidebar/notification-center-dialog.tsx + nav-notifications.tsx）；**Skill/MCP 管理**（新增 components/sidebar/skills-dialog.tsx + mcps-dialog.tsx）；**独立设置页**（新增 app/settings/ 目录 7 文件 + components/settings/settings-page-layout.tsx）；**UI 增强**（新增 components/common/console-panel.tsx + member-picker.tsx + components/ui/file-upload.tsx + input-group.tsx + navigation-menu.tsx + components/viewport-insets.tsx + zoom-wrapper.tsx）；**导航增强**（新增 lib/routes.ts + lib/navigate.ts + lib/api-polyfill.ts）；**Monaco 增强**（新增 lib/monaco-models.ts Model 缓存预加载）；**用户头像**（新增 hooks/use-user-avatar.ts）；**Git 设置**（新增 components/git/git-settings-form.tsx）；**终端增强**（terminal 组件 4->8）；**sidebar 组件** 15->18；**UI 组件** 38->42；**新增依赖** cmdk + @dnd-kit/react + @base-ui/react + @emotion/is-prop-valid；**文件数 168->215** |
| 2026-05-08T17:18:31+08:00 | 增量更新 | **Workflow 可视化编辑器** + **i18n 中英文切换** + **Native 通知** + **Sidebar 重构** + **Issue 详情重构** + **Workspace 页面重构** + **新增依赖**（@xyflow/react + @dagrejs/dagre + next-intl + react-virtualized + vaul）；**文件数 141->168** |
| 2026-05-05T23:52:43+08:00 | 增量更新 | 登录页、认证模块、服务器切换器、工作空间管理页、项目设置面板、用量仪表盘、文件夹选择器、Git 增强、移动端适配、40+ UI 组件 |
| 2026-05-04T21:04:42+08:00 | 增量更新+补扫 | 新增 agent store、message-parts 结构化渲染、三运行时配置、Anthropic Bridge、头像上传 |
| 2026-05-02T23:43:41 | 增量更新 | 补充 TipTap 富文本编辑器、Agent 对话框、LLM 管理对话框、composer 组件、workspace 对话框、DESIGN.md 设计规范 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
