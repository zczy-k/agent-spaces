# @agent-spaces/web -- 总览

Next.js 16 前端应用，提供多 Agent 协同编程平台的用户界面。包含 250+ 源文件、34 个 Zustand Store、34 个 i18n 命名空间。

## 核心功能

- 登录认证（Secret Key -> Bearer Token）
- 工作空间管理（创建/绑定目录/Clone）
- Monaco 代码编辑器 + TypeScript LSP（定义跳转/引用/诊断）
- xterm.js 终端（多 tab + 快捷命令）
- TipTap 富文本聊天（@mention Agent + 语音识别 + 回复 AI 消息）
- Workflow DAG 编辑器（@xyflow/react + @dagrejs/dagre）
- Git 操作面板（status/diff/log/commit/push/pull/高级操作）
- Issue 管理（含 Workflow 选择 + 拖拽排序任务）
- Kanban 看板（@dnd-kit 拖拽）
- Notion 风格文档数据库
- Worktree 并行开发面板
- Command Palette（Ctrl+K）
- i18n 中英文切换
- 用量统计 Dashboard（Commit Graph + Activity Graph）
- 订阅余额面板
- Agent Store 在线模板导入
- Theme Style System + Layout Templates

## 布局架构

FlexLayout React 提供可拖拽面板布局：

- 左侧 25%：频道列表 / 议题列表
- 右侧 75%：代码编辑器 / 聊天面板 / 议题详情
- 底部 dock：终端 / Git 面板

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.2 | React 全栈框架 |
| React | 19.2 | UI 库 |
| Zustand | 5 | 状态管理 |
| Monaco Editor | 0.55 | 代码编辑 |
| @xyflow/react | 12.10 | DAG 可视化 |
| TipTap | 3.22 | 富文本编辑 |
| xterm.js | 6 | 终端 |
| next-intl | 4.11 | i18n |
| cmdk | 1.1 | Command Palette |
| shadcn/ui | base-nova | UI 组件 |
