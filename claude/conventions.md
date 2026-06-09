# 编码约定

## 通用约定

- TypeScript strict 模式，ESNext 模块
- 后端使用 ESM（`"type": "module"`）
- 前端使用 Next.js App Router + `"use client"` 指令
- 状态管理统一使用 Zustand（`create` 函数式写法）
- 组件使用函数式组件 + hooks
- CSS 使用 TailwindCSS utility classes
- UI 组件基于 shadcn/ui（base-nova 风格）
- API 路由按资源分组，遵循 RESTful 规则
- 前端 API 调用统一通过 @agent-spaces/sdk
- 认证使用 Bearer Token

## 后端约定

- JSON body 限制 50MB
- 路由文件放在 `src/routes/`
- 服务层文件放在 `src/services/`
- 存储层文件放在 `src/storage/`
- 适配器文件放在 `src/adapters/`
- WebSocket 事件命名：`domain.action`（如 `terminal.create`, `agent.status_changed`）
- JSON 持久化使用 `json-store.ts` 通用工具
- SQLite 使用 `node:sqlite`（DatabaseSync）
- zod 用于后端请求校验

## 前端约定

- 页面放在 `src/app/` 下（Next.js App Router）
- 组件放在 `src/components/` 下按功能域分组
- Store 放在 `src/stores/`
- 工具库放在 `src/lib/`
- i18n 使用 next-intl，翻译文件按命名空间拆分
- WebSocket 客户端使用 `lib/ws.ts` 中的 `WorkspaceWS` 类

## 命名规范

- 文件名：kebab-case（`agent-runtime.ts`、`use-workflow-editor.ts`）
- 组件文件名：kebab-case（`code-editor.tsx`、`git-panel.tsx`）
- Store 文件名：kebab-case（`workflow-editor.ts`、`content-usage-report.ts`）
- 目录名：kebab-case（`notification-hub/`、`code-favorites/`）
- 路由目录名：kebab-case 或 `[dynamic]`

## 数据持久化

- JSON 文件：Workspace/Issue/Task/Channel/Message/Workflow/Command/Subscription 等
- SQLite：Agent Session/Usage + Kanban Board + DocNode Database
- 存储根目录：`~/.agent-spaces-data/`
- 工作空间元数据：项目目录下 `.agentspace/`
