# 编码约定

## 前端规范

- Next.js App Router，页面放在 `src/app/` 下
- 组件使用函数式组件 + hooks，`"use client"` 指令
- 状态管理使用 Zustand（`create` 函数式写法）
- CSS 使用 TailwindCSS utility classes
- UI 组件基于 shadcn/ui（base-nova 风格）
- 路径别名：`@/*` -> `./src/*`

## 组件组织

- 按功能域分组：`components/chat/`、`components/git/`、`components/editor/` 等
- 对话框组件命名：`xxx-dialog.tsx`
- 面板组件命名：`xxx-panel.tsx`
- Hook 组件命名：`use-xxx.ts`

## 状态管理

- Store 放在 `src/stores/` 目录
- 每个 Store 一个文件
- 使用 `create` 函数式写法
- 搜索相关 Store 按子目录组织：`stores/search-commands/`

## API 调用

- 统一通过 @agent-spaces/sdk（`src/lib/sdk.ts` 单例）
- 不直接使用 fetch，除非 SDK 未覆盖

## i18n

- next-intl + LocaleProvider
- 翻译文件按命名空间拆分：`src/locales/{en,zh}/*.json`
- 组件通过 `useTranslations('namespace')` 获取翻译

## 重要文件

- `AGENTS.md` -- Next.js 16 Breaking Changes 提示
- `DESIGN.md` -- UI 设计规范（MiniMax 风格）
