# Findings & Decisions

## Requirements
- 移植知识库编辑器到 Agent Spaces 作为 Database tab
- 组件放在 `packages/web/src/components/database/`
- 数据从 localStorage 改为后端 SQLite
- 集成到 FlexLayout 作为 tab（line 118-122 区域）
- 保留原始功能：层级文档树、拖拽、Tiptap 富文本、Markdown 编辑、搜索、回收站

## Research Findings

### 源项目结构
- **app/page.tsx** (1347 行) - 主组件，包含所有状态管理和 UI
- **components/TreeItem.tsx** (283 行) - 递归文档树
- **components/NotionEditor.tsx** (545 行) - Tiptap 富文本编辑器 + slash 命令
- **components/MarkdownEditor.tsx** (296 行) - Markdown 编辑器（split/edit/preview 三模式）
- **components/QuickSearchModal.tsx** (251 行) - ⌘K 快捷搜索
- **components/TrashBinModal.tsx** (150 行) - 回收站
- **lib/converter.ts** - HTML ↔ Markdown 双向转换
- **hooks/use-mobile.ts** - 移动端检测（项目已有）
- **lib/utils.ts** - cn() 工具（项目已有）

### 数据模型
```typescript
interface DocNode {
  id: string;
  title: string;
  icon: string;           // emoji
  cover: string;          // CSS gradient
  content: string;        // HTML or Markdown
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  isTrash: boolean;
}
```

### localStorage 键
- `kb_editor_nodes` - 文档树数据
- `kb_editor_open_tabs` - 打开的 tab
- `kb_editor_recent` - 最近访问

### 目标集成点
- workspace-shell.tsx line 118-122: 右侧 tabset 的 children 数组
- factory 函数 (line 388-417): 添加 case "database"
- MobilePanelRenderer (line 478-503): 添加 case "database"
- tab-config.tsx: 添加图标映射

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| SQLite 单表 doc_nodes | DocNode 结构扁平，单表足够，加 workspaceId 隔离 |
| REST API 路由 /api/database/* | 与项目其他路由风格一致 |
| 新建 Zustand store useDatabaseStore | 项目统一模式 |
| 保留 Tiptap 编辑器 | 项目已安装 Tiptap，直接复用 |
| 移植 converter.ts | 不依赖外部 Markdown 库，轻量自定义实现 |

## Resources
- 源项目路径：/Users/Zhuanz/Downloads/database/
- 目标组件目录：packages/web/src/components/database/
- workspace-shell.tsx: packages/web/src/components/layout/workspace-shell.tsx
- tab-config.tsx: packages/web/src/components/layout/tab-config.tsx
- server 路由注册: packages/server/src/app.ts
