# 研究发现

## 源项目依赖
- @dnd-kit/core ^6.3.1、@dnd-kit/sortable ^10.0.0、@dnd-kit/utilities ^3.2.2 — **项目已有**，无需安装
- lucide-react — **项目已有**
- 无其他外部依赖需要安装

## 目标项目架构模式
- **前端 FlexLayout**：dynamic import + factory switch + tab-config.tsx 注册
- **后端路由**：Express Router + mergeParams，`/api/workspaces/:id/kanban`
- **后端存储**：SQLite 懒加载单例（参考 database-store.ts 模式）
- **前端 Store**：Zustand create + fetchWithAuth + WebSocket 事件

## 关键适配点
1. App.tsx 的 header/footer/search/filter 是独立页面元素，迁移为面板时需移除
2. TaskModal 和 ColumnModal 使用原生 div 模态框，需改为 shadcn Dialog
3. localStorage 持久化需改为 API 调用
4. 工厂函数需要 workspaceId prop
