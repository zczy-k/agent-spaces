# 模块职责

## packages/shared

前后端共享的 TypeScript 类型定义包。定义了所有核心数据模型（Workspace/Issue/Task/Agent/Channel/Message/Workflow/Kanban/DocNode 等）、WebSocket 事件契约、Agent 运行时类型等。无运行时依赖。

## packages/sdk

前端 API 统一调用包（@agent-spaces/sdk）。HttpClient 封装 + Bearer Token 自动注入 + 39 个 API 模块适配器。web 包通过 `lib/sdk.ts` 单例消费。

## packages/server

Express 5 后端服务。REST API + WebSocket + 认证中间件 + 六运行时 Agent 编排引擎 + Workflow DAG 执行引擎 + Plugin 插件系统 + Hook 系统 + 通知中心 + PTY 终端 + Git 操作 + SQLite Usage 统计。作为整个平台的核心运行时。

## packages/web

Next.js 16 前端 SPA。包含登录页、工作空间管理、Monaco 代码编辑器（TypeScript LSP）、xterm.js 终端、TipTap 富文本聊天、@xyflow/react Workflow DAG 编辑器、Git 面板、Kanban 看板、文档数据库、Worktree 面板、Command Palette、i18n 中英文切换等。Zustand 管理全局状态（34 个 Store）。

## packages/flutter

Flutter 多平台原生壳应用。内嵌 InAppWebView 加载 Web 前端，提供原生通知、设备模拟、书签管理、内网服务器自动发现、JS Bridge 双向通信。不包含业务逻辑。

## packages/templates

Agent 预设模板库（@agent-spaces/agents）。184 个 Agent 预设 + 6 个 Chat Agent + 9 个 MCP + 15 个 Skill + 107 个 Plugin + Workflow/Prompt/OutputStyle 模板。通过 generate-index 自动索引 + http-server 静态托管。

## packages/dom-inspector-hook

DOM Inspector 的浏览器端 Hook 库。捕获元素源码信息并通过 POST 发送到 Agent Spaces Server。基于 code-inspector-plugin。
