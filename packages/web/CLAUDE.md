[根目录](../../CLAUDE.md) > [packages](../) > **web**

# @agent-spaces/web

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。250+ 源文件，34 个 Zustand Store，34 个 i18n 命名空间。包含登录认证、工作空间管理、Monaco 代码编辑器（TypeScript LSP）、xterm.js 终端、TipTap 富文本聊天、@xyflow/react Workflow DAG 编辑器、Git 面板、Issue 管理、Kanban 看板、文档数据库、Command Palette 等核心功能。通过 Zustand 管理全局状态，WebSocket 实现实时数据同步。

**重要提示**：本项目使用的 Next.js 版本存在 Breaking Changes，详见 `AGENTS.md`。UI 设计规范参考 `DESIGN.md`。

## 约定的规则

- Next.js App Router，`"use client"` 指令
- Zustand `create` 函数式写法管理状态
- CSS 使用 TailwindCSS，UI 组件基于 shadcn/ui（base-nova 风格）
- API 调用统一通过 @agent-spaces/sdk（`src/lib/sdk.ts` 单例）
- i18n 使用 next-intl，翻译文件按命名空间拆分（`src/locales/{en,zh}/*.json`）
- 组件按功能域分组（`components/chat/`、`components/git/` 等）
- 路径别名：`@/*` -> `./src/*`
- 字体：DM Sans（UI）、Outfit（标题）、Poppins（中间层标题）

## 文件索引

| 文件 | 说明 |
|------|------|
| [claude/overview.md](claude/overview.md) | 总览、核心功能、布局架构、技术栈 |
| [claude/conventions.md](claude/conventions.md) | 编码约定、组件组织、API 调用规范 |
| [claude/stores.md](claude/stores.md) | 34 个 Zustand Store 索引 |
| [claude/component-groups.md](claude/component-groups.md) | 组件目录索引（按功能域分组） |
| [claude/lib-index.md](claude/lib-index.md) | 工具库索引（src/lib/ 下 30+ 文件） |
| [claude/changelog.md](claude/changelog.md) | 变更记录 |

## 入口与启动

- **入口文件**：`src/app/layout.tsx`（根布局） + `src/app/page.tsx`（首页）
- **启动命令**：`pnpm dev`（自定义 server.mjs，3000 端口）
- **构建命令**：`pnpm build`
- **API 代理**：`next.config.ts` rewrites -> localhost:3100
- **布局链**：ThemeProvider -> LocaleProvider -> AuthGuard -> AppShell -> CommandPalette

## 关键目录

| 目录 | 说明 |
|------|------|
| `src/app/` | Next.js 页面（login/settings/workflows/chat/workspace） |
| `src/components/` | React 组件（按功能域分组，20+ 子目录） |
| `src/stores/` | Zustand Store（34 个） |
| `src/lib/` | 工具库（30+ 文件） |
| `src/locales/` | i18n 翻译（34 命名空间 x 2 语言） |
| `src/hooks/` | React Hooks |

## 扫描状态

- **更新时间**：2026-06-09 11:04:09
- **已扫描范围**：全部 Store、主要组件目录、工具库、页面路由、i18n 命名空间
- **覆盖率**：约 90%
