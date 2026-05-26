# Agent Spaces

## 项目愿景

Agent Spaces 是一个**本地多 Agent 协同编程平台**。用户在本地创建工作空间（Workspace），绑定代码目录，通过可视化 Workflow 编辑器（DAG 拓扑）编排 Agent 执行流程，或直接通过频道聊天 @mention Agent 触发执行。支持多种 Agent 角色（agent / scheduler / task_creator / bot / 以及自定义 role），五种 Agent 运行时（OpenAgentSdk / ClaudeCode / Codex / LangChain / Hermes），前端提供 IDE 级别的集成开发环境体验，包含代码编辑器（Monaco + TypeScript LSP 实时类型检查/定义跳转/引用查找）、终端、频道聊天、Git 操作、议题管理、工作流可视化编排（支持 Agent 节点和 Command 节点）、用量统计仪表盘、订阅余额管理、语音识别、快捷命令、命令面板、代码收藏、Prompt 模板管理、Hook 系统（Agent 工具调用前后自定义钩子）、输出风格管理、DOM Inspector 源码定位、i18n 中英文切换、Kanban 看板管理、Notion 风格文档数据库（含向量搜索）、Worktree 并行开发、Robot Account 通知凭证管理、字体管理等核心功能。支持通过飞书/企业微信 Bot 接收 Issue 状态通知并远程操控 Agent。

## 架构总览

- **项目类型**：pnpm monorepo（3 个包）+ Flutter 客户端（独立 pubspec）
- **前端**：Next.js 16 (App Router) + TailwindCSS 4 + shadcn/ui + FlexLayout + Zustand + Monaco Editor（含 TypeScript LSP 语言客户端）+ xterm.js + TipTap 富文本编辑器 + @xyflow/react (DAG 可视化) + next-intl (i18n) + cmdk (Command Palette)
- **移动端/桌面端**：Flutter 3.10 + Riverpod + InAppWebView + GoRouter + awesome_notifications + docking，内嵌 Web 前端的多平台原生壳应用，支持远程终端（SSH/SFTP/FTP/WebDAV）
- **后端**：Express 5 + WebSocket (ws) + node-pty + simple-git + node:sqlite (SQLite) + zod
- **共享层**：TypeScript 类型定义包，前后端共用
- **数据存储**：JSON 文件持久化（`~/.agent-spaces-data/`）+ SQLite（Agent Session/Usage 统计 + Kanban Board + DocNode 文档数据库），无外部数据库
- **认证系统**：基于 Secret Key 的 Bearer Token 认证，全局中间件保护 API + WebSocket 连接
- **Agent 运行时**：支持五种运行时 -- `OpenAgentSdkRuntime`（基于 @codeany/open-agent-sdk）、`ClaudeCodeRuntime`（基于 @anthropic-ai/claude-agent-sdk，已拆分为 7 文件子模块）、`CodexRuntime`（基于 @openai/codex-sdk）、`LangChainRuntime`（基于 langchain）、`HermesRuntime`（外部 Hermes CLI 进程适配），通过工厂函数 `createAgentRuntime()` 按配置切换
- **Anthropic Bridge**：ClaudeCodeRuntime 内置 Anthropic Messages 到 OpenAI Chat Completions/Responses 的协议中转，支持通过 Claude Code SDK 调用非 Anthropic 模型
- **持久上下文**：`persistent-agent-context.ts` 自动加载工作空间中的 CLAUDE.md/AGENTS.md 指令文件和 Workspace Prompt，注入所有 Agent 运行时（聊天/Issue/SSE/Bot）
- **Hook 系统**：Agent 工具调用前后的自定义钩子系统，支持 shell command/webhook/script 三种动作类型，per-tool-call 粒度，工作空间级别 `.hook.json` 文件存储，通过 `wrapOnEventWithHooks()` 拦截 `AgentRuntimeEvent`
- **输出风格管理**：自定义 Agent 输出格式模板（Markdown），按工作空间持久化，Agent 运行时通过 `resolveOutputStyleContent()` 注入 systemPrompt
- **通知中心 (Notification Hub)**：支持飞书（Lark）和企业微信（WeChat）和 Native（Tauri/Browser）三种外部通知渠道，Issue/Task 状态变更自动推送，支持 Bot Agent 远程对话和内置斜杠命令；另有应用内通知系统（NotificationCenter + NotificationType）
- **Robot Account 系统**：集中管理飞书/企微通知凭证（RobotAccount），工作空间通过 `robotAccountId` 引用，支持全局企微 QR Code 登录自动创建凭证
- **工作流系统 (Workflow)**：DAG 可视化模板编辑器（@xyflow/react），支持 Agent 节点和 Command 节点两种类型，Issue 选择 Workflow 后自动映射为 Task 执行，替代旧硬编码 pipeline
- **Worktree 系统**：Git Worktree 并行开发支持，每个 Worktree 关联独立分支，支持创建/删除/Diff 查看/PR 创建（含 AI 生成 PR 描述）/PR 合并
- **Kanban 看板**：工作空间级看板管理（SQLite 存储），支持多列拖拽排序（@dnd-kit）、任务 CRUD、水平/垂直布局切换、优先级筛选、搜索过滤
- **文档数据库 (Database)**：Notion 风格的树形文档系统（SQLite 存储），支持创建/移动/软删除/恢复、Notion 编辑器 + Markdown 编辑器双模式、封面/图标、快速搜索、回收站、多标签页、向量搜索（Embedding 索引）、版本历史、AI 对话
- **文档向量搜索**：基于 LLM Embedding 的文档语义搜索（database-vector.ts），支持批量索引、相似度查询、调试信息
- **用量统计与计费**：SQLite 存储 Agent 每次执行的 Token 用量和费用估算，首页 Dashboard 展示趋势图和按模型统计
- **订阅管理 (Subscription)**：支持智谱 (ZhiPu)、MiniMax、AI Code 三种供应商的余额/配额查询，首页展示订阅面板
- **语音识别 (Speech Recognition)**：腾讯语音实时识别（WebSocket 流式），前端 useSpeechRecognition Hook 集成到聊天输入
- **快捷命令 (Quick Commands)**：自定义命令 CRUD + 运行/停止/自动重启，前端终端集成
- **代码搜索 (Code Search)**：ripgrep 优先 + Node.js 回退，支持正则/文件模式/大小写选项
- **代码收藏 (Code Favorites)**：Monaco 编辑器右键收藏代码位置/片段，侧面板查看/跳转/删除，按工作空间持久化
- **Prompt 模板管理**：CRUD + 应用到多个 Agent 预设，独立设置页 /settings/prompts
- **Agent SSE API**：HTTP Server-Sent Events 流式 Agent 调用，无需 WebSocket，支持外部集成
- **Agent Commands**：Agent 命令管理（CRUD + 批量应用到多个 Agent），独立 REST API
- **TypeScript LSP**：后端启动 typescript-language-server 子进程，前端 monaco-languageclient 通过 WebSocket 连接，提供定义跳转/引用/诊断等 TypeScript 语义能力
- **DOM Inspector**：基于 dom-inspector-hook 的元素源码定位，被调试项目 Alt+Shift 点击自动在编辑器中打开源文件
- **Command Palette**：Ctrl+K 快捷命令面板（cmdk），全局搜索（工作空间/频道/Issue/文件/服务器）
- **Git 操作日志**：内存 Git 操作审计日志（git-operation-log.ts），记录每次 Git 操作的输入/输出/耗时
- **多服务器支持**：前端支持配置和切换多个后端服务器实例
- **i18n 国际化**：next-intl + LocaleProvider，中英文切换，52 个组件已完成改造
- **Tauri 集成**：Zoom Wrapper + Native Notification + 静态路由适配
- **Timeline**：版本发布时间线展示（v1.1.0 / v1.2.0 / v1.3.0）
- **字体管理**：自定义字体上传/删除/列表 API（支持 ttf/otf/woff/woff2）

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | >= 20 |
| 包管理 | pnpm | >= 9 |
| 语言 | TypeScript | 5.8+ |
| 前端框架 | Next.js | 16.2 |
| UI 库 | shadcn/ui (base-nova) + TailwindCSS 4 | - |
| 布局引擎 | FlexLayout React | 0.9 |
| DAG 编辑器 | @xyflow/react | 12.10 |
| DAG 布局 | @dagrejs/dagre | 3.0 |
| 状态管理 | Zustand | 5 |
| 代码编辑 | Monaco Editor | 4.7 |
| Monaco LSP 客户端 | monaco-languageclient | 10.7 |
| TypeScript LSP 服务端 | typescript-language-server | 5.2 |
| LSP 通信 | vscode-ws-jsonrpc | 3.5 |
| 终端 | xterm.js (@xterm/xterm) | 6 |
| 富文本编辑 | TipTap (含 mention、placeholder 扩展) | 3.22 |
| i18n | next-intl | 4.11 |
| Command Palette | cmdk | 1.1 |
| 后端框架 | Express | 5 |
| WebSocket | ws | 8 |
| PTY | node-pty | 1.1 |
| Git 操作 | simple-git | 3.36 |
| 数据库 | node:sqlite (SQLite) | 内置 |
| Schema 校验 | zod | 4 |
| Agent SDK 1 | @codeany/open-agent-sdk | ^0.2.1 |
| Agent SDK 2 | @anthropic-ai/claude-agent-sdk | ^0.2.126 |
| Agent SDK 3 | @openai/codex-sdk | ^0.128.0 |
| Agent SDK 4 | langchain + @langchain/openai + @langchain/anthropic + @langchain/google-genai | ^1.4.0 |
| Agent SDK 5 | Hermes CLI（外部进程） | - |
| 飞书 SDK | @larksuiteoapi/node-sdk | ^1.62.1 |
| 图表 | Recharts | 3.8 |
| 表格 | @tanstack/react-table | ^8.21.3 |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable | ^6.3.1 |
| 拖放面板 | react-resizable-panels | - |
| 移动端框架 | Flutter | ^3.10.1 |
| 移动端状态管理 | flutter_riverpod | ^2.6.1 |
| 移动端 WebView | flutter_inappwebview | ^6.1.5 |
| 移动端路由 | go_router | ^14.8.1 |
| 移动端通知 | awesome_notifications | ^0.11.0 |
| 移动端 Docking | docking | - |

## 模块结构图

```mermaid
graph TD
    A["agent-spaces (根)"] --> B["packages/shared"]
    A --> C["packages/server"]
    A --> D["packages/web"]
    A --> E["packages/flutter"]

    C -->|"依赖"| B
    D -->|"依赖"| B
    D -->|"API 代理"| C
    E -->|"InAppWebView 加载"| D
    E -->|"HTTP/WS 连接"| C

    click B "./packages/shared/CLAUDE.md" "查看 shared 模块文档"
    click C "./packages/server/CLAUDE.md" "查看 server 模块文档"
    click D "./packages/web/CLAUDE.md" "查看 web 模块文档"
    click E "./packages/flutter/CLAUDE.md" "查看 flutter 模块文档"
```

## 模块索引

| 模块 | 路径 | 语言 | 文件数 | 职责 |
|------|------|------|--------|------|
| shared | `packages/shared` | TypeScript | 23 | 前后端共享类型定义（Workspace, Issue, IssueComment, Task, Agent, AgentUsageRecord, AgentUsageDashboard, Channel, Message, MessagePart, Event, File, Git, LLM, Tool, Workflow, Command, Subscription, Search, Notification, Speech, CodeFavorite, Hook, DocNode, KanbanBoard, WorktreeInfo, RobotAccount, GitOperationEntry, WorkflowCommandNode） |
| server | `packages/server` | TypeScript | 138 | Express REST API + WebSocket 服务 + 认证中间件 + 五运行时 Agent 编排（OpenAgentSdk/ClaudeCode/Codex/LangChain/Hermes） + Workflow 系统（DAG 校验/CRUD/Task 映射/Command 节点执行/运行时校验） + Hook 系统（Agent 工具调用前后钩子 + shell/webhook/script 动作） + 输出风格管理（OutputStyle 模板 CRUD + 运行时注入） + 通知中心（飞书/企微/Native Bot + Robot Account 凭证管理） + 应用内通知 + PTY 终端 + Git 操作（含 Git Operation Log） + SQLite Agent Usage + Kanban Board（SQLite 看板管理） + DocNode 文档数据库（SQLite 树形文档系统 + 向量搜索） + Worktree 并行开发（创建/删除/Diff/PR 创建/AI PR 描述/合并） + JSON 持久化 + LLM 管理 + Agent Preset + Function Call Tools（Issue/Command/Database/Kanban 四类内置工具） + Agent Commands 管理 + Anthropic Bridge + Issue 评论与服务层 + 工具详情持久化 + Commit Agent + Pull Request Agent + 用量 Dashboard API + 文件夹浏览 + Git Clone SSE + Agent SSE API + 代码搜索 + 订阅管理（智谱/MiniMax/AICode） + 语音识别（腾讯） + 快捷命令 + Agent Designer + Skill/MCP 管理 + Prompt 模板管理 + 代码收藏 + 持久上下文加载 + TypeScript LSP 服务 + DOM Inspector 端点 + 字体管理 API + zod 校验 |
| web | `packages/web` | TypeScript/TSX | 327 | Next.js 前端 SPA，包含登录页、工作空间管理、代码编辑器（Monaco + TypeScript LSP 定义跳转/引用/诊断 + Model 缓存 + 搜索面板 + 导入文件对话框 + 代码收藏面板 + Monaco Action Registry + 菜单栏 + 移动端适配 + Send to Issue/Channel + Inspector Action）、终端（快捷命令 + 虚拟键盘 + 命令侧边栏 + 终端实例）、结构化 AI 消息渲染（含 tool-step/context-panel/context-usage/chain-of-thought/commit 组件）、TipTap 富文本聊天 + @mention + 回复 AI 消息工作流 + slash 命令 + agent resource 扩展 + suggestion renderer、语音识别输入、议题管理（含 Workflow 选择 + 拖拽排序任务面板 + info panel + issue message）、Workflow 可视化编辑器（@xyflow/react DAG + Command 节点 + @dagrejs/dagre 自动布局）、Git 面板（含设置表单 + commit diff viewer + context menu + discard 对话框 + 远程同步 Hook + commits panel + commit log list）、频道管理（频道对话框 + 频道信息面板 + 成员管理 + 成员卡片）、Agent 配置 + 命令管理对话框、LLM 管理（模型 + 供应商对话框 + Model Picker）、头像上传、用量统计仪表盘、订阅余额面板、项目设置面板（通知配置+Prompt配置+Git 配置+Speech 配置+Robot Accounts Tab）、服务器切换器/管理器、文件夹选择器、移动端适配、i18n 中英文切换（52 组件已改造）、Native 通知（Tauri/Browser）、Command Palette（Ctrl+K）、Iframe Tab 管理器、浮动面板/浮球、Inspector 历史记录、独立设置页（Agents/Skills/MCPs/Models/Providers/Prompts/OutputStyles/Hooks/Tools）、通知中心对话框、Hook 管理对话框、输出风格管理对话框、DOM Inspector 集成、Providers 管理对话框、Kanban 看板（@dnd-kit 拖拽 + 水平/垂直布局 + 列管理对话框）、Notion 风格文档数据库（树形导航 + Notion/Markdown 双编辑器 + 快速搜索 + 回收站 + 向量搜索 + 版本历史 + AI 对话 + 目录树节点 + 侧边栏双面板）、Worktree 面板（创建/删除/PR 创建/Diff 查看）、版本发布时间线（Timeline）、Settings 对话框拆分（Appearance/Language/Account/Security/Git/Speech/RobotAccounts Tab）、Agent Picker 对话框、Editor 增强（file-tree/file-icon/file-context-menu/editor-tabs/editor-panel）、Agent Store 独立管理 |
| flutter | `packages/flutter` | Dart | 47 | Flutter 多平台原生壳应用（Android/iOS/macOS/Windows/Web），内嵌 InAppWebView 加载 Web 前端，提供原生通知、设备模拟（Phone/Tablet/Desktop）、书签管理、内网服务器自动发现（/api/health 探测）、JS Bridge 双向通信（Flutter <-> WebView 事件+RPC）、控制台日志捕获、Tab 管理（docking 多窗口布局）、Split Layout、右键菜单、Tab 对话框、调试工具、终端实例（内嵌终端 + 工具栏 + 虚拟键盘 + SSH/SFTP 登录表单）、远程文件浏览（SFTP/FTP/WebDAV/本地存储 四种文件源 + FileSourceTree 组件）、终端凭证管理（SSH 凭证 CRUD）、文件源凭证管理（远程连接配置 CRUD） |

## 运行与开发

```bash
# 安装依赖
pnpm install

# 并行启动 server + web（开发模式）
pnpm dev
# server: http://localhost:3100
# web:    http://localhost:3000（自动代理 /api/* 和 /ws 到 server）

# 构建
pnpm build

# Docker 构建
pnpm build:docker

# 清理
pnpm clean
```

### Flutter 客户端

```bash
cd packages/flutter

# 获取依赖
flutter pub get

# 运行（开发模式，需连接设备或模拟器）
flutter run

# 构建 APK
flutter build apk

# 构建 iOS
flutter build ios

# 构建 macOS
flutter build macos

# 运行测试
flutter test
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3100` | 后端服务端口 |
| `HOST` | `0.0.0.0` | 后端服务监听地址 |
| `AGENT_SPACES_DATA_DIR` | `~/.agent-spaces-data` | 数据存储目录 |
| `ANTHROPIC_API_KEY` | - | ClaudeCodeRuntime 使用的 API Key |
| `ANTHROPIC_BASE_URL` | - | ClaudeCodeRuntime 使用的 API Base URL |
| `CLAUDE_CODE_MODEL` | - | Claude Code SDK 覆盖模型名（仅 Anthropic Bridge 模式） |
| `NEXT_PUBLIC_WS_PORT` | `3100` | 前端 WebSocket 连接端口 |
| `CODEX_API_KEY` / `OPENAI_API_KEY` | - | CodexRuntime 使用的 API Key |
| `CODEX_HOME` | - | Codex 配置目录（默认每个 agent 独立） |
| `SERVER_URL` | `http://localhost:3100` | 前端 SSR 时连接后端的 URL |
| `CORS_ORIGIN` | `*` | CORS 允许的来源 |

### 核心开发流程

1. 配置 Secret Key（`~/.agent-spaces-data/auth.json`）-> 登录页认证
2. 创建工作空间 -> 绑定本地目录（支持文件夹浏览器 + Git Clone SSE）-> 自动初始化 `.agentspace` 元数据目录
3. 配置 Agent Preset（角色、运行时类型、模型、API Key、MCP、技能、权限模式等）
4. 创建 Workflow 模板（可视化 DAG 编辑器，拖拽 Agent 节点或 Command 节点，连线定义依赖）或使用已有模板
5. 创建议题（Issue）-> 可选择 Workflow 模板 -> 启动 Issue 自动化
6. Issue 自动化入口：若有 workflowId，加载 Workflow -> 映射为 Task -> 依赖调度执行 -> 全部 Task 完成后 Issue completed；若无 workflow，Issue 进入 error
7. 也可在频道聊天中 @mention Agent 直接触发执行，或使用 Agent SSE API（HTTP POST）外部调用
8. Agent 执行时实时展示 chain（工具调用/中间输出/最终结论）、工具详情（input/output/diff）、token 使用统计
9. 所有状态变更通过 WebSocket 实时推送到前端，同时触发通知中心事件
10. 首页 Dashboard 展示 Agent 用量趋势、Token 消耗、费用估算、按模型统计
11. 首页订阅面板展示智谱/MiniMax/AICode 余额和配额
12. 项目设置面板配置工作空间 Prompt、通知服务（飞书/企微）、Bot Agent、Robot Account
13. 设置面板中可切换中英文语言
14. 快捷命令面板（Ctrl+K）快速搜索和导航
15. Flutter 客户端：启动后自动扫描内网发现服务器 -> InAppWebView 加载 Web 前端 -> JS Bridge 提供原生通知/设备模拟等增强能力
16. 代码收藏：Monaco 编辑器右键"添加到代码收藏"，收藏面板查看/跳转/删除
17. Prompt 模板：在 /settings/prompts 页面管理 Prompt 模板，可批量应用到多个 Agent 预设
18. TypeScript LSP：工作空间打开时自动启动 TypeScript Language Server，Monaco 编辑器提供定义跳转/引用/诊断
19. DOM Inspector：被调试项目中 Alt+Shift 点击元素，自动在 Agent Spaces 编辑器中打开对应源文件
20. Hook 系统：在 /settings/hooks 或侧边栏 Hooks 对话框管理 Hook（CRUD + 上传 JSON + Monaco 编辑器），Agent 工具调用前后自动触发
21. 输出风格：在 /settings/output-styles 或侧边栏 Output Styles 对话框管理输出格式模板，应用到 Agent systemPrompt
22. Kanban 看板：工作空间内拖拽式看板管理，支持多列、优先级、搜索过滤、水平/垂直布局切换
23. 文档数据库：Notion 风格的树形文档系统，支持 Notion/Markdown 双编辑器、封面、图标、回收站、向量搜索、版本历史
24. Worktree 并行开发：创建独立 Worktree 分支，支持 Diff 查看、AI 生成 PR 描述、PR 合并
25. Robot Account：集中管理飞书/企微通知凭证，工作空间通过 ID 引用，支持 QR Code 自动创建

## 测试策略

当前为 MVP 阶段，暂无自动化测试。规划中的测试策略：

- **后端单元测试**：services/storage 层的 CRUD 与状态转换
- **后端集成测试**：REST API + WebSocket 事件端到端
- **Workflow 系统测试**：DAG 校验（环检测/重复边/自环）、Task 映射、运行时校验、Command 节点执行
- **Agent 编排测试**：Workflow -> Task 映射 -> Agent 执行 -> Issue 状态流转
- **Agent 运行时测试**：OpenAgentSdkRuntime / ClaudeCodeRuntime / CodexRuntime / LangChainRuntime / HermesRuntime 的 execute/stop 行为
- **Hermes 运行时测试**：CLI 进程管理、输出流解析、错误处理
- **Anthropic Bridge 测试**：Anthropic Messages <-> OpenAI Chat/Responses 协议转换
- **Agent SSE API 测试**：HTTP SSE 流式调用、Key 认证、多消息格式
- **Hook 系统测试**：hook-engine 规则匹配、命令执行、wrapOnEventWithHooks 拦截
- **输出风格测试**：CRUD + resolveOutputStyleContent 注入
- **Kanban 测试**：SQLite 存储 CRUD + 拖拽排序 + 布局切换
- **文档数据库测试**：DocNode 树形结构 CRUD + 移动 + 软删除/恢复 + 搜索
- **文档向量搜索测试**：Embedding 索引构建 + 相似度查询 + 错误处理
- **Worktree 系统测试**：创建/删除/Diff/PR 创建/合并/状态更新
- **Pull Request Agent 测试**：AI 生成 PR 描述 + 上下文构建
- **Robot Account 测试**：凭证 CRUD + resolveCredentials + QR Code 自动创建
- **通知中心测试**：Lark/WeChat/Native Adapter 消息收发与命令处理
- **应用内通知测试**：NotificationCenter CRUD + WebSocket 推送
- **订阅管理测试**：ZhiPu/MiniMax/AICode 配额查询和错误处理
- **语音识别测试**：腾讯语音 WebSocket 流式会话
- **快捷命令测试**：CRUD + 运行/停止/自动重启
- **代码搜索测试**：ripgrep + Node.js 回退、正则/文件模式选项
- **代码收藏测试**：CRUD + 按工作空间持久化
- **Prompt 模板测试**：CRUD + 批量应用到 Agent
- **Agent Commands 测试**：CRUD + applyCommandToAgents
- **持久上下文测试**：CLAUDE.md/AGENTS.md 自动加载 + 截断预算
- **TypeScript LSP 测试**：WebSocket 连接/断开、typescript-language-server 子进程管理
- **Git 操作日志测试**：操作审计记录 + 内存管理
- **字体管理测试**：上传/删除/列表 + 格式校验
- **认证中间件测试**：Token 验证与路由保护
- **前端组件测试**：关键 UI 组件的渲染与交互
- **Store 测试**：Zustand store 的状态变更逻辑
- **i18n 测试**：翻译 key 完整性、语言切换
- **Flutter Provider 测试**：BrowserNotifier/BookmarkNotifier/SettingsNotifier/TerminalCredentialsNotifier 状态变更
- **Flutter JsBridge 测试**：事件收发、RPC 调用、Promise 回调
- **Flutter Widget 测试**：TabBar 交互、BookmarksScreen CRUD 对话框、FileSourceTree 浏览
- **Flutter FileSource 测试**：SFTP/FTP/WebDAV/Storage 连接、列表、文件操作

## 编码规范

- TypeScript strict 模式，ESNext 模块
- 后端使用 ESM（`"type": "module"`）
- 前端使用 Next.js App Router + `"use client"` 指令
- 状态管理统一使用 Zustand（`create` 函数式写法）
- 组件使用函数式组件 + hooks
- CSS 使用 TailwindCSS utility classes
- UI 组件基于 shadcn/ui（base-nova 风格），参考 `packages/web/DESIGN.md` 设计规范
- API 路由按资源分组，遵循 RESTful 规则
- 认证使用 Bearer Token，除 `/api/health`、`/api/auth/login`、`/api/auth/check`、`/api/agent-sse/*`、`/api/inspector/track` 外所有路由需认证
- Agent SSE API 支持三种认证方式：Bearer Token、`x-agent-spaces-key` Header、`key` Body 参数
- DOM Inspector `/api/inspector/track` 免认证（被调试项目调用）
- WebSocket 连接需 `token` 查询参数认证
- WebSocket 事件命名：`domain.action`（如 `terminal.create`, `agent.status_changed`, `workflow.created`, `command.started`, `inspector.jump`, `worktree.created`）
- 数据持久化使用 JSON 文件（Workspace/Issue/Task/Channel/Message/LLM/Workflow/Command/Subscription/SpeechConfig/Notification/CodeFavorites/PromptTemplates/Hooks/OutputStyles/RobotAccounts/Worktrees）+ SQLite（Agent Session/Usage + Kanban Board + DocNode Database）
- Agent 编排使用 function-call tools（非 prompt-only），通过 `AgentFunctionTool` 抽象层统一管理，分为 Issue/Command/Database/Kanban 四类内置工具
- 工具详情持久化到 `tool-details.json`，前端通过 API 懒加载
- ClaudeCodeRuntime 已从单文件拆分为子目录（7 文件），Bridge 使用引用计数式复用
- 持久上下文通过 `persistent-agent-context.ts` 自动加载，支持 CLAUDE.md/AGENTS.md 层级优先级和字符预算截断
- Hook 系统通过 `wrapOnEventWithHooks()` 拦截 AgentRuntimeEvent，支持 PreToolUse/PostToolUse 阶段，shell command/webhook/script 三种动作，`.hook.json` 文件存储在工作空间 hooks 目录
- 输出风格通过 `resolveOutputStyleContent()` 注入 Agent systemPrompt，OutputStyleTemplate 类型，meta.json 持久化
- 通知中心使用 `BotAdapter` 接口抽象，新平台只需实现 start/stop/send/hasRecipients
- Robot Account 集中管理通知凭证，通过 `resolveCredentials()` 按 robotAccountId 解析实际凭证
- Workflow 使用 DAG 拓扑（@xyflow/react 前端 + 拓扑排序校验后端），支持 Agent 节点和 Command 节点，替代旧硬编码 pipeline
- Worktree 使用 Git worktree 实现并行开发，每个 Worktree 关联独立分支，支持 AI 生成 PR 描述（Pull Request Agent）
- Agent Role 简化为 `agent | scheduler | task_creator | bot` + 自定义字符串，旧 role（planner/executor/reviewer/commit/custom）为兼容保留
- Agent 运行时 kind 新增 `hermes`，通过 CLI 进程适配器执行
- AgentConfig 新增 `outputStyle` 字段，运行时自动注入输出风格模板
- Workspace 新增 `isWorktree` 和 `parentWorkspaceId` 字段，支持 Worktree 子工作空间
- WorkspaceNotificationSettings 新增 `robotAccountId` 字段，引用 Robot Account 凭证
- i18n 使用 next-intl，翻译文件 `src/locales/{en,zh}.json`，组件通过 `useTranslations()` 获取
- zod 用于后端请求校验
- 订阅管理使用 `SubscriptionProviderBase` 抽象，新供应商只需实现 fetchQuota
- 语音识别使用 `SpeechRecognitionProviderBase` 抽象，新供应商只需实现 createSession
- 快捷命令支持 autoRestart，通过 command-process-manager 管理生命周期
- 代码搜索优先使用系统 ripgrep，不可用时回退 Node.js 实现
- 代码收藏使用 CodeFavorite 类型（path/line/column/endLine/endColumn/label/snippet），按工作空间 JSON 持久化
- Prompt 模板使用 PromptTemplate 类型（name/content），meta.json 持久化，支持批量 apply 到 Agent
- Monaco Action Registry 模式：`registerMonacoAction()` 注册自定义右键菜单/快捷键，`applyRegisteredActions()` 批量应用到编辑器实例
- TypeScript LSP：后端 typescript-language-server --stdio + vscode-ws-jsonrpc 转发，前端 monaco-languageclient 消费
- Kanban 使用 SQLite 存储（kanban_boards/kanban_columns/kanban_tasks 三表），前端 @dnd-kit 拖拽排序
- 文档数据库使用 SQLite 存储（doc_nodes 单表 + parent_id 树形），前端 Notion/Markdown 双编辑器 + ResizablePanel 布局
- 文档向量搜索使用 LLM Embedding API 索引，database-vector.ts 批量索引 + 相似度查询
- Git 操作日志使用内存 Map 存储（git-operation-log.ts），按工作空间隔离，最大 1000 条
- 内置工具使用 input-helpers.ts 统一输入校验（assertRecord/readRequiredString 等）
- Flutter 客户端使用 Riverpod StateNotifier 模式，Widget 用 ConsumerWidget/ConsumerStatefulWidget
- Flutter 数据模型使用 copyWith 不可变模式，持久化通过 StorageService 静态方法
- Flutter Web 前端通过 `window.isFlutterEnvironment()` 检测运行环境
- Flutter Docking 库用于多 WebView Tab 的可拖拽布局
- Flutter FileSource 抽象类统一远程文件访问接口（SFTP/FTP/WebDAV/Storage）

## AI 使用指引

- 本项目使用了 `code-review-graph` MCP 工具，提供知识图谱能力
- `packages/web/AGENTS.md` 包含 Next.js 16 重要提示（Breaking Changes）
- `packages/web/DESIGN.md` 包含 UI 设计规范（MiniMax 风格参考）
- `packages/flutter/CLAUDE.md` 包含 Flutter 客户端架构详细文档
- `.agentspace/claude.md` 为工作空间级知识库
- `docs/agent-lifecycle.md` 详细描述 Agent Preset 的创建、更新、导入和运行时行为
- `docs/issue-agent-automation.md` 详细描述 Issue 自动化编排链路（Scheduler -> Planner -> TaskCreator -> Executor -> Reviewer）
- `docs/workflow-system.md` 详细描述 Workflow 系统架构、数据模型、执行语义、修改指南
- `docs/codex-runtime-limitations.md` 记录 Codex 运行时的已知限制与解决方法
- `docs/anthropic-bridge.md` 说明 Anthropic Messages 到 OpenAI 的协议中转机制
- `docs/function-call-tools.md` 描述 Agent Function Call 工具层
- `docs/ai-message-rendering.md` 描述 AI 消息的结构化渲染链路
- `docs/model-usage-accounting.md` 详细描述 Token 用量统计、费用计算和 Dashboard 展示流程
- `docs/bot-notification-workflow.md` 详细描述飞书/企微 Bot 通知系统架构、命令系统和扩展指南
- `docs/persistent-agent-context.md` 详细描述持久上下文加载方案（CLAUDE.md/AGENTS.md 自动注入）
- `docs/reply-ai-message-workflow.md` 详细描述回复 AI 消息的端到端工作流
- `docs/monaco-typescript-lsp.md` 详细描述 Monaco TypeScript LSP 实现架构
- `docs/dom-inspector-integration.md` 详细描述 DOM Inspector 源码定位集成方案
- `docs/flex-truncate-fix.md` 记录 Flex 布局中 truncate 不生效的解决方案
- `docs/database-knowledge-base-architecture.md` 文档数据库知识库架构
- `docs/hermes-agent-runtime.md` Hermes Agent 运行时架构说明
- `docs/worktree-system.md` Worktree 并行开发系统架构
- `docs/hook-engine.md` Hook 引擎详细设计
- `docs/agent-store.md` Agent Store 独立管理方案
- `docs/ui/react-resizable-panels-size-units.md` ResizablePanels 尺寸单位说明
- `docs/superpowers/specs/2026-05-24-robot-accounts-design.md` Robot Account 系统设计文档
- `docs/superpowers/specs/2026-05-24-worktree-system-design.md` Worktree 系统设计文档
- `docs/superpowers/plans/2026-05-24-worktree-system.md` Worktree 系统实现计划
- `docs/superpowers/specs/2026-05-25-workflow-command-node-design.md` Workflow Command Node 设计文档
- `docs/superpowers/plans/2026-05-25-workflow-command-node.md` Workflow Command Node 实现计划
- `docs/superpowers/specs/2026-05-06-i18n-design.md` i18n 中英文多语言切换设计文档
- `docs/superpowers/specs/2026-05-07-workflow-visual-editor-design.md` Workflow 可视化编辑器设计文档
- `docs/superpowers/specs/2026-05-08-quick-command-design.md` 快捷命令设计文档
- `docs/superpowers/specs/2026-05-14-editor-search-and-monaco-models-design.md` 编辑器搜索和 Monaco Models 设计文档
- `docs/superpowers/specs/2026-05-20-hook-system-design.md` Hook 系统设计文档（PreToolUse/PostToolUse 钩子）
- 项目规划文件：`PRD.md`（需求文档）

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore the
codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes -- gives risk-scored analysis |
| `get_review_context` | Need source snippets for review -- token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-05-25T22:19:18+08:00 | 增量更新 | **第五运行时 Hermes**（server 新增 adapters/hermes-runtime.ts，基于外部 Hermes CLI 进程的 Agent 运行时适配器，AgentConfig.runtimeKind 新增 hermes 选项）；**Worktree 并行开发系统**（shared 新增 types/worktree.ts WorktreeInfo/WorktreeStatus/CreateWorktreeInput 类型 + events.ts 新增 worktree.created/deleted/pr_created/merged 事件，server 新增 routes/worktree.ts + services/worktree.ts + storage/worktree-store.ts + agents/pull-request-agent.ts，Git Worktree 创建/删除/Diff 查看/PR 创建（AI 生成 PR 描述）/PR 合并，web 新增 components/worktree/ 3 文件 worktree-panel/worktree-card/create-worktree-dialog + stores/worktree.ts，Workspace 新增 isWorktree/parentWorkspaceId 字段）；**Robot Account 凭证管理**（shared workspace.ts 新增 RobotAccount 类型 + WorkspaceNotificationSettings 新增 robotAccountId 字段，server 新增 routes/robot-account.ts + services/robot-account.ts + services/global-wechat-qr.ts + storage/robot-account-store.ts，集中管理飞书/企微凭证 + 全局企微 QR Code 登录自动创建凭证，web 新增 sidebar/settings/robot-accounts-tab.tsx）；**Agent Commands 管理**（server 新增 routes/agent-commands.ts + services/agent-commands.ts，Agent 命令 CRUD + 批量 applyToAgents，web 新增 sidebar/agent-commands-dialog.tsx）；**Workflow Command 节点**（shared workflow.ts WorkflowNode 变为 union 类型 WorkflowAgentNode | WorkflowCommandNode，server 新增 services/workflow-command-runner.ts，web 新增 workflow/workflow-command-node.tsx + workflow-command-edit-dialog.tsx）；**内置工具拆分**（server services/builtin-tools/ 从单文件拆为 6 文件 index/issue-tools/command-tools/database-tools/kanban-tools/input-helpers，tool.ts 工具声明大幅扩展至 22 种含 Terminal/Command/Database/Kanban 工具）；**文档数据库增强**（server 新增 services/database-vector.ts 向量搜索（LLM Embedding 索引 + 相似度查询），web 新增 database/ 10 文件 database-vector-dialog/database-ai-chat/database-sidebar/database-sidebar-panel/database-main-panel/database-dialog/database-tree-node/database-constants/table-of-contents/version-history-dialog）；**Git 操作日志**（server 新增 services/git-operation-log.ts，内存审计日志 + shared git.ts 新增 GitOperationEntry 类型）；**字体管理 API**（server app.ts 新增 GET/POST/DELETE /api/fonts + /api/fonts/upload）；**Web 大规模扩展**（chat 新增 chat-panel/chat-composer-input/member-card/member-info-card/message-parts/commit，sidebar 新增 tools-dialog/agent-commands-dialog/agent-list/agent-detail/agent-editor/agent-shared/server-manager-dialog，editor 新增 send-to-issue-dialog/send-to-channel-dialog/inspector-action-dialog，git 新增 git-commit-log-list/commit-diff-viewer/terminal-panel/terminal-instance/terminal-toolbar，terminal 新增 terminal-panel/terminal-instance/terminal-toolbar，issue 新增 issue-list/issue-message/create-issue-dialog，workflow 新增 workflow-command-node/workflow-command-edit-dialog，kanban 新增 column-manage-dialog，layout 新增 workspace-tabs，stores 新增 editor-send/worktree，lib 新增 agent-store，settings 新增 tools/page.tsx，home/page.tsx 更新，common 新增 model-picker-dialog）；**Flutter 大规模扩展**（新增 terminal_instance/terminal_toolbar/terminal_virtual_keyboard/terminal_login_form 终端系列 4 文件、file_source_tree 远程文件浏览组件、file_sources/ 6 文件 file_source/storage_file_source/ftp_file_source/sftp_file_source/webdav_file_source/file_source_factory/path_utils/webdav_url、models 新增 terminal_credential/file_source_config/file_source_credential 3 文件、providers 新增 terminal_credentials_provider/file_source_credentials_provider 2 文件、screens 新增 terminal_credentials_screen/file_source_credentials_screen 2 文件）；**新增 API 路由** /api/workspaces/:id/worktrees（GET/POST + DELETE/GET/:id/diff/GET/:id/pr/POST/:id/merge/GET/:id/pr-draft）、/api/robot-accounts（GET/POST/PUT/:id/DELETE/:id + GET/wechat/qr）、/api/agent-commands（GET/agents/GET/all/GET/:agentId/POST/:agentId/PUT/:agentId/:name/DELETE/:agentId/:name/POST/apply）、/api/fonts（GET/POST/DELETE/:name）、/api/settings/tools（新增设置页）；**新增 WebSocket 事件** worktree.created/deleted/pr_created/merged；**新增文档** hermes-agent-runtime.md + worktree-system.md + database-knowledge-base-architecture.md + hook-engine.md + agent-store.md + react-resizable-panels-size-units.md + 5 篇 superpowers specs/plans；**server 版本 0.3.63->0.3.65**；**shared 22->23、server 128->138、web 296->327、flutter 26->47** |
| 2026-05-22T12:52:36+08:00 | 增量更新 | **Kanban 看板系统**（shared 新增 types/kanban.ts，server 新增 routes/kanban.ts + services/kanban.ts + storage/kanban-store.ts，web 新增 components/kanban/ 5 文件 + stores/kanban.ts）；**Notion 风格文档数据库**（shared 新增 types/database.ts，server 新增 routes/database.ts + storage/database-store.ts，web 新增 components/database/ 5 文件 + stores/database.ts）；**Issue 服务层独立**（server 新增 services/issue.ts）；**shared 20->22、server 118->128、web 265->296、flutter 21->26** |
| 2026-05-20T14:08:52+08:00 | 增量更新 | **Hook 系统** + **输出风格管理** + **Issue Task Controller 重构** + **Agent 运行时接口提取** + **Bot Agent 提取** + **Web 组件大规模拆分重构**；**shared 19->20、server 113->118、web 245->265、flutter 21 不变** |
| 2026-05-19T09:45:03+08:00 | 增量更新 | **代码收藏** + **Prompt 模板管理** + **TypeScript LSP** + **持久上下文加载** + **DOM Inspector** + **回复 AI 消息工作流** + **编辑器增强** + **聊天增强** + **浮动组件**；**shared 18->19、server 106->113、web 215->245、flutter 18->21** |
| 2026-05-17T15:04:39+08:00 | 增量更新 | **新增 Flutter 客户端模块**（18 个 Dart 源文件） |
| 2026-05-16T17:36:40+08:00 | 增量更新 | **第四运行时 LangChain** + **订阅管理** + **语音识别** + **快捷命令** + **代码搜索** + **Agent SSE API** + **Agent Designer** + **应用内通知** + **Skill/MCP 管理** + **Command Palette** + **Iframe 管理** + **独立设置页**；**shared 13->18、server 73->106、web 168->215** |
| 2026-05-08T17:18:31+08:00 | 增量更新 | **Workflow 系统** + **i18n 中英文切换** + **Native 通知**；**server 70->73、shared 12->13、web 141->168** |
| 2026-05-05T23:52:43+08:00 | 增量更新 | 认证系统 + 通知中心 + Commit Agent + Issue 自动化重构 + ClaudeCodeRuntime 拆分 + Agent Usage Dashboard |
| 2026-05-04T21:04:42+08:00 | 增量更新 | 三运行时架构 + Anthropic Bridge + Issue 自动化编排链路 + Function Call Tools |
| 2026-05-02T23:43:41 | 增量更新 | 补充双运行时架构、LLM 管理、Agent Preset 系统 |
| 2026-05-02T01:07:33 | 初始化 | init-architect 首次扫描生成根级与模块级 CLAUDE.md |
