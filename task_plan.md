# Task Plan: 移植知识库编辑器到 Agent Spaces 作为 Database Tab

## Goal
将 `/Users/Zhuanz/Downloads/database` 的多层级知识库编辑器移植到 Agent Spaces 项目中，作为 FlexLayout 的一个 tab（Database），组件放在 `packages/web/src/components/database/`，数据从 localStorage 改为后端 SQLite 数据库。

## Current Phase
Phase 1

## Phases

### Phase 1: 共享类型 + 后端 API + 存储
- [ ] 在 `packages/shared` 新增 `database.ts` 类型定义（DocNode）
- [ ] 在 `packages/server` 新增 `storage/database-store.ts`（SQLite CRUD）
- [ ] 在 `packages/server` 新增 `routes/database.ts`（REST API）
- [ ] 在 `packages/server` 注册路由到 `app.ts`
- [ ] **Status:** pending

### Phase 2: 前端组件移植
- [ ] 创建 `packages/web/src/components/database/` 目录
- [ ] 移植 `TreeItem.tsx`（树形文档列表）
- [ ] 移植 `NotionEditor.tsx`（Tiptap 富文本编辑器）
- [ ] 移植 `MarkdownEditor.tsx`（Markdown 编辑器）
- [ ] 移植 `QuickSearchModal.tsx`（快捷搜索）
- [ ] 移植 `TrashBinModal.tsx`（回收站）
- [ ] 移植 `lib/converter.ts`（HTML/Markdown 转换）
- [ ] 创建 `DatabasePanel.tsx` 主组件（替代 page.tsx，状态管理 + API 调用）
- [ ] **Status:** pending

### Phase 3: 集成到 FlexLayout
- [ ] 在 `workspace-shell.tsx` 的 `defaultJson` 中添加 Database tab
- [ ] 在 `factory` 中注册 `database` 组件
- [ ] 在 `MobilePanelRenderer` 中添加 database case
- [ ] 在 `tab-config.tsx` 中添加 Database 图标
- [ ] **Status:** pending

### Phase 4: 测试验证
- [ ] 启动开发服务器验证功能
- [ ] 验证 CRUD 操作（创建/编辑/删除/恢复）
- [ ] 验证富文本和 Markdown 双模式编辑
- [ ] 验证拖拽排序
- [ ] **Status:** pending

## Key Questions
1. DocNode 需要关联 workspaceId 吗？→ 是的，数据按工作空间隔离
2. SQLite 表结构如何设计？→ 单表 doc_nodes，字段对应 DocNode 类型
3. 前端数据流：Zustand store 还是组件内 state？→ 新建 Zustand store，与项目其他模块一致

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 数据按 workspaceId 隔离 | 与项目其他数据模型一致（Issue、Task 等） |
| 新建 Zustand store | 项目统一使用 Zustand 管理状态 |
| SQLite 单表存储 | DocNode 结构扁平，不需要复杂关联 |
| 移植而非重写 | 保持原始功能和 UI 不变，仅替换数据层 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- 源项目使用 Next.js 15 + Tiptap 3 + lucide-react + motion + tailwindcss
- 目标项目使用 Next.js 16 + Tiptap 3（已安装）+ lucide-react（已安装）+ tailwindcss 4
- `lib/utils.ts` 的 `cn()` 已存在，不需要重复移植
- `hooks/use-mobile.ts` 已存在于项目中
- 源项目 page.tsx 1347 行需拆分为独立组件
- Tiptap 相关依赖已在项目中安装（@tiptap/core + extensions）
- motion 库需要确认是否已安装
