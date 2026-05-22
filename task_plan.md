# Kanban Board 迁移计划

## 目标
将 `C:\Users\Administrator\Downloads\customizable-kanban-board` 的 Kanban 功能完整迁移到 Agent Spaces 项目，作为 FlexLayout 面板集成，后端数据保存到 SQLite。

## 阶段规划

### 阶段 1：shared 类型定义 `complete`
- `packages/shared/src/types/kanban.ts` — KanbanPriority, KanbanLayoutMode, KanbanColumn, KanbanTask, KanbanBoard

### 阶段 2：后端 SQLite 存储 `complete`
- `packages/server/src/storage/kanban-store.ts` — SQLite 三表（kanban_boards/kanban_columns/kanban_tasks）
- `packages/server/src/services/kanban.ts` — ensureBoard + saveBoard CRUD
- `packages/server/src/routes/kanban.ts` — GET/PUT `/api/workspaces/:id/kanban`
- `packages/server/src/app.ts` — 路由注册

### 阶段 3：前端组件迁移 `complete`
- `packages/web/src/components/kanban/kanban-board.tsx` — 主面板（从 App.tsx 精简）
- `packages/web/src/components/kanban/kanban-column.tsx`
- `packages/web/src/components/kanban/kanban-card.tsx`
- `packages/web/src/components/kanban/task-modal.tsx`
- `packages/web/src/components/kanban/column-modal.tsx`
- `packages/web/src/stores/kanban.ts` — Zustand store

### 阶段 4：集成到 FlexLayout `complete`
- `workspace-shell.tsx` — dynamic import + factory + defaultJson + mobile
- `tab-config.tsx` — builtinTabs + TAB_ICONS 注册

### 阶段 5：验证 `complete`
- server + web typecheck 全部通过，零错误

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| TS2322: string 不兼容 KanbanPriority/KanbanLayoutMode | 1 | SQLite 行读取时使用 `as KanbanPriority` / `as KanbanLayoutMode` 类型断言 |
