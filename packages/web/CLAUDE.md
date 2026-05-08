[根目录](../../CLAUDE.md) > [packages](../) > **web**

# @agent-spaces/web

## 模块职责

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。包含登录认证、工作空间管理、用量统计仪表盘、项目设置面板（通知配置+Prompt配置）、服务器切换器、文件夹浏览器、FlexLayout IDE 布局、Monaco 代码编辑器、xterm.js 终端、TipTap 富文本聊天（含 @mention Agent）、结构化 AI 消息渲染（chain/tool-detail/diff/token-usage/confirmation/subagent/ask-user_question）、Workflow 可视化编辑器（@xyflow/react DAG + @dagrejs/dagre 自动布局）、议题管理（含 Workflow 选择）、Git 操作面板、Agent 配置管理、LLM 模型管理、头像上传、移动端适配、i18n 中英文切换（next-intl，52 个组件已改造）、Native 通知（Tauri/Browser）等核心功能。通过 Zustand 管理全局状态（11 个 Store），WebSocket 实现实时数据同步，支持多后端服务器切换。

**重要提示**：本项目使用的 Next.js 版本存在 Breaking Changes，详见 `AGENTS.md`。UI 设计规范参考 `DESIGN.md`（MiniMax 风格）。

## 入口与启动

- **入口文件**：`src/app/layout.tsx`（根布局 + ThemeProvider + LocaleProvider + AuthGuard + AppShell）+ `src/app/page.tsx`（首页 -> HomePage）
- **启动命令**：`pnpm dev`（自定义 server.mjs，默认 3000 端口）
- **构建命令**：`pnpm build` + `pnpm start`
- **API 代理**：通过 `next.config.ts` rewrites 将 `/api/*` 和 `/ws` 代理到后端 `localhost:3100`（或 `SERVER_URL`）

## 对外接口

### 页面路由

| 路由 | 文件 | 说明 |
|------|------|------|
| `/login` | `src/app/login/page.tsx` | 登录页：Secret Key 认证 |
| `/` | `src/app/page.tsx` | 首页：工作空间列表 + 用量统计 Dashboard |
| `/workspaces` | `src/app/workspaces/page.tsx` | 工作空间管理页（SSR） |
| `/workflows` | `src/app/workflows/page.tsx` | Workflow 模板管理页（新增） |
| `/workspace/[id]` | `src/app/workspace/[id]/page.tsx` | 工作空间页：FlexLayout IDE 布局 |

### FlexLayout 面板映射

| 组件名 | 面板 | 位置 | 说明 |
|--------|------|------|------|
| `channel-list` | 频道列表 | 左侧 (25%) | 频道列表 + 创建频道 |
| `issue-list` | 议题列表 | 左侧 (25%) | 议题列表 + 创建议题 |
| `editor` | 代码编辑器 | 右侧 (75%) | FileTree + EditorTabs + Monaco Editor |
| `chat` | 聊天面板 | 右侧 (75%) | 消息列表 + TipTap 富文本输入 + @mention Agent |
| `issue-detail` | 议题详情 | 右侧 (75%) | 议题详细视图 |
| `terminal` | 终端 | 底部 dock | xterm.js 多 tab 终端 |
| `git` | Git 面板 | 底部 dock | Git 状态 + Diff 查看 |

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
| `useWorkflowStore` | `stores/workflow.ts` | workflows, currentWorkflow, isLoading | Workflow 模板列表与当前编辑（新增） |
| `useMobilePanelStore` | `stores/mobile-panel.ts` | activePanel | 移动端面板切换 |

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

## 代码结构

```
packages/web/src/
  app/
    layout.tsx                    # 根布局（字体 + ThemeProvider + LocaleProvider + AuthGuard + AppShell）
    page.tsx                      # 首页（SSR: fetch workspaces -> HomePage）
    login/page.tsx                # 登录页（Secret Key 认证）
    workflows/page.tsx            # Workflow 管理页（新增）
    workspaces/page.tsx           # 工作空间管理页（SSR）
    workspace/[id]/
      page.tsx                    # Workspace 页（加载 workspace -> WorkspaceClient）
      workspace-client.tsx        # Workspace 客户端组件（新增，替代原 page.tsx 内联逻辑）
    globals.css                   # 全局样式
    api/
      upload/route.ts             # 文件上传 API Route
      [...path]/route.ts          # API 代理（proxy.ts）
  i18n/
    request.ts                    # next-intl SSR 配置（新增）
  locales/
    zh.json                       # 中文翻译（新增）
    en.json                       # 英文翻译（新增）
  components/
    auth-guard.tsx                # 认证守卫（未登录跳转 /login）
    app-shell.tsx                 # 应用外壳（SidebarProvider + SidebarInset）
    locale-provider.tsx           # LocaleProvider + useLocale（新增）
    layout/
      workspace-shell.tsx         # FlexLayout IDE 布局（核心容器）
      workspace-tabs.tsx          # 工作空间标签栏
      mobile-tab-bar.tsx          # 移动端标签栏
    sidebar/
      app-sidebar.tsx             # 主侧边栏（DashboardSidebar）
      index.tsx                   # 侧边栏导航
      logo.tsx                    # Logo 组件
      nav-main.tsx                # 主导航
      nav-notifications.tsx       # 通知导航
      server-switcher.tsx         # 服务器切换器（多后端实例管理）
      server-manager-dialog.tsx   # 服务器管理对话框（新增）
      server-form-dialog.tsx      # 服务器表单对话框（新增）
      models-dialog.tsx           # LLM 模型管理对话框（含成本配置）
      providers-dialog.tsx        # LLM 供应商管理对话框
      settings-dialog.tsx         # 设置对话框（含 Language 选择器）
      agent-dialog.tsx            # Agent 预设配置对话框（创建/编辑，含运行时/权限/工具配置）
      agent-detail.tsx            # Agent 详情展示（新增）
      agent-list.tsx              # Agent 列表展示（新增）
      agent-shared.tsx            # Agent 共享组件（新增）
    workflow/                     # Workflow 可视化编辑器（新增目录）
      workflow-editor.tsx         # 编辑器主容器（ReactFlowProvider + 工具栏 + 画布 + 调色板）
      workflow-canvas.tsx         # DAG 画布（ReactFlow + Dagre 自动布局）
      workflow-agent-node.tsx     # Agent 节点组件
      workflow-agent-palette.tsx  # Agent 调色板（拖拽添加节点）
      workflow-toolbar.tsx        # 工具栏（保存/返回）
      workflow-mini-preview.tsx   # 缩略图预览
      workflow-list.tsx           # Workflow 列表项
    workflows/                    # Workflow 管理页（新增目录）
      workflows-page.tsx          # Workflow 管理页组件
      workflow-templates.ts       # 模板管理组件
      workflow-templates-dialog.tsx # 模板选择对话框
    editor/
      editor-panel.tsx            # 编辑器面板（FileTree + CodeEditor）
      file-tree.tsx               # 文件树（递归渲染）
      file-icon.tsx               # 文件图标组件
      editor-tabs.tsx             # 编辑器 tab 栏
      code-editor.tsx             # Monaco Editor 集成
    chat/
      chat-panel.tsx              # 聊天面板
      chat-input.tsx              # 聊天输入（TipTap 集成 + 工具选择）
      channel-list.tsx            # 频道列表
      channel-dialog.tsx          # 频道对话框
      channel-info-panel.tsx      # 频道信息面板
      message-item.tsx            # 消息条目
      message-parts.tsx           # 结构化消息 Parts 渲染主入口（620 行），8 种 Part 类型分发
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
      issue-detail-header.tsx     # 议题详情头部（新增）
      issue-detail-info-panel.tsx # 议题详情信息面板（新增）
      issue-detail-tasks-panel.tsx # 议题详情任务面板（新增）
      issue-detail-comments.tsx   # 议题详情评论（新增）
      issue-message.tsx           # 议题消息
      edit-issue-dialog.tsx       # 议题编辑对话框（含 Workflow 选择）
      create-issue-dialog.tsx     # 议题创建对话框（含 Workflow 选择）
      comment-navigator.tsx       # 评论导航器
      task-row.tsx                # 任务行组件（新增）
      collect-mention-ids.ts      # mention ID 收集工具（新增）
      issue-status-colors.ts      # 议题状态颜色常量（新增）
    terminal/
      terminal-panel.tsx          # 终端面板（多 tab）
      terminal-instance.tsx       # xterm.js 终端实例
    git/
      git-panel.tsx               # Git 操作面板
      git-changes-panel.tsx       # Git Changes 面板
      git-commits-panel.tsx       # Git Commits 面板
      git-graph-panel.tsx         # Git Graph 面板
      git-remote-dialog.tsx       # Git Remote 对话框
      git-not-initialized.tsx     # Git 未初始化提示
      diff-viewer.tsx             # Monaco DiffEditor 差异查看
    home/
      home-page.tsx               # 首页组件（工作空间列表 + Usage Dashboard）
      usage-dashboard.tsx         # 用量统计仪表盘（581 行，图表+表格+日期选择+模型图标）
    workspace/
      workspace-dialog.tsx        # 工作空间创建/管理对话框（含文件夹浏览器 + Git Clone）
    workspaces/
      workspaces-page.tsx         # 工作空间管理页组件
    settings/
      project-settings-panel.tsx  # 项目设置面板（通知配置 + Prompt 配置 + WeChat QR）
    common/
      agent-icon.tsx              # Agent 图标组件
      user-icon.tsx               # 用户图标组件
    ui/                           # shadcn/ui 组件（38 个）
      accordion, alert, avatar, badge, breadcrumb, button, card, chart,
      collapsible, context-menu, copy-code, dialog, drawer, dropdown-menu,
      folder-picker, hover-card, input, label, loader, markdown,
      pagination, popover, progress, scroll-area, search-select, separator,
      sheet, shimmer, sidebar, skeleton, slider, status-badge, switch, table,
      tabs, textarea, tooltip
    shadcn-studio/blocks/         # 参考组件块（图表、数据表等）
    timeline/                     # 版本时间线组件
      timeline-component.tsx
      content/v1-1-0.tsx, v1-2-0.tsx, v1-3-0.tsx
    theme-provider.tsx            # 主题切换 Provider
    dev-inspector.tsx             # 开发辅助 Inspector
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
    workflow.ts                   # Workflow 模板状态（新增）
    mobile-panel.ts               # 移动端面板状态
  hooks/
    use-mobile.ts                 # 移动端检测 Hook
    use-pagination.ts             # 分页 Hook
  lib/
    ws.ts                         # WebSocket 客户端
    utils.ts                      # cn() 工具函数
    users.ts                      # 用户数据
    commands.ts                   # 命令定义
    agent-members.ts              # Agent 成员工具函数
    auth.ts                       # 认证工具（Token 管理 + fetchWithAuth）
    server.ts                     # 多服务器配置管理
    monaco-loader.ts              # Monaco Editor 加载器
    native-notification.ts        # Native 通知抽象层（Tauri/Browser）（新增）
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
| 2026-05-08T17:18:31+08:00 | 增量更新 | **Workflow 可视化编辑器**（新增 workflow/ 目录 7 个组件：editor/canvas/agent-node/agent-palette/toolbar/mini-preview/list + workflows/ 目录 3 个组件：workflows-page/workflow-templates/workflow-templates-dialog + /workflows 页面路由 + workflow store）；**i18n 中英文切换**（新增 locale-provider.tsx + i18n/request.ts + locales/zh.json + locales/en.json，52 个组件已改造使用 useTranslations，settings-dialog 新增 Language 选择器，layout.tsx 集成 LocaleProvider）；**Native 通知**（新增 lib/native-notification.ts，Tauri + Browser 抽象层）；**Sidebar 重构**（新增 server-manager-dialog + server-form-dialog + agent-detail + agent-list + agent-shared 组件，sidebar 组件 9->15 个）；**Issue 详情重构**（新增 issue-detail-header + issue-detail-info-panel + issue-detail-tasks-panel + issue-detail-comments + task-row + collect-mention-ids + issue-status-colors，issue 组件 6->13 个）；**Workspace 页面重构**（新增 workspace-client.tsx）；**UI 组件**（新增 drawer.tsx，38 个）；**新增依赖**（@xyflow/react + @dagrejs/dagre + next-intl + react-virtualized + vaul）；**文件数 141->168** |
| 2026-05-05T23:52:43+08:00 | 增量更新 | 登录页（login/page.tsx）、认证模块（auth.ts + server.ts + auth-guard.tsx + app-shell.tsx）、服务器切换器（server-switcher.tsx）、工作空间管理页（workspaces/page.tsx + workspaces-page.tsx）、项目设置面板（project-settings-panel.tsx：通知配置+Prompt+WeChat QR）、用量仪表盘（usage-dashboard.tsx：图表+表格+日期选择+模型图标）、文件夹选择器（folder-picker.tsx）、Git 增强（changes-panel/commits-panel/remote-dialog）、移动端适配（mobile-tab-bar.tsx + mobile-panel store）、新增 Store（workspace + llm + mobile-panel）、新增 lib（auth + server + monaco-loader）、40+ UI 组件（新增 calendar/slider/context-menu/folder-picker 等）、新增依赖 @tanstack/react-table + date-fns + sonner + react-day-picker |
| 2026-05-04T21:04:42+08:00 | 增量更新+补扫 | 新增 agent store、message-parts 结构化渲染、三运行时配置、Anthropic Bridge、头像上传 |
| 2026-05-02T23:43:41 | 增量更新 | 补充 TipTap 富文本编辑器、Agent 对话框、LLM 管理对话框、composer 组件、workspace 对话框、DESIGN.md 设计规范 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成 |
