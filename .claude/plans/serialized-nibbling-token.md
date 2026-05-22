# Tools 管理页面 & 对话框

## Context

当前 agent-detail.tsx 中工具选择是平铺的 checkbox 列表（26 个工具），没有分类、没有详情查看能力。需要创建一个独立的 Tools 管理页面（参考 mcps-dialog.tsx 的布局），支持分类浏览 + 详情查看 + 可选的 checkbox 选择模式。同时替换 agent-detail.tsx 中的内联工具列表为"点击弹出对话框选择"。

## 修改文件

### 1. 新建 `packages/web/src/components/sidebar/tools-dialog.tsx`

参考 mcps-dialog.tsx 的模式，创建 ToolsDialog 组件：

**Props:**
```typescript
interface ToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
  selectable?: boolean;          // 开启后显示 checkbox
  selectedTools?: BuiltInAgentToolName[];
  onSelectedToolsChange?: (tools: BuiltInAgentToolName[]) => void;
}
```

**布局（参考 mcps-dialog）:**
- 左侧固定宽度 `w-44`，展示分类按钮：
  - 全部（All）
  - 频道管理（Channel）
  - 终端/命令（Terminal）
  - 知识库（Database）
  - 看板（Kanban）
- 右侧 flex-1，展示筛选后的工具卡片列表
  - 搜索框
  - 每个工具卡片：图标 + 名称 + 描述
  - `selectable` 模式下，卡片左侧有 checkbox
  - 点击卡片弹出详情对话框

**工具分类映射（在前端硬编码）：**
```typescript
const TOOL_CATEGORIES: Record<string, string[]> = {
  channel: ['CreateCurrentChannelIssue', 'ViewCurrentChannelIssue', 'AddCurrentChannelComment'],
  terminal: ['ReadTerminalOutput', 'ListQuickCommands', 'RunQuickCommand', 'StopQuickCommand'],
  database: ['ListDatabases', 'ListDatabaseNodes', 'SearchDatabaseNodes', 'QueryDatabaseVectors', 'ReadDatabaseNode', 'ListDatabaseNodeVersions', 'CreateDatabaseNode', 'WriteDatabaseNode', 'DeleteDatabaseNode', 'MoveDatabaseNode', 'UpdateDatabaseNodeMeta'],
  kanban: ['ListKanbanBoards', 'ViewKanbanBoard', 'CreateKanbanBoard', 'UpdateKanbanBoard', 'DeleteKanbanBoard'],
};
```

**详情对话框：** 点击工具卡片弹出 Dialog，显示工具名称、描述（暂不支持编辑）。

### 2. 新建 `packages/web/src/app/settings/tools/page.tsx`

参考 mcps/page.tsx 模式：
```tsx
export default function ToolsPage() {
  const t = useTranslations("tools");
  return (
    <SettingsPageLayout title={t("title")}>
      <ToolsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
```

### 3. 修改 `packages/web/src/components/sidebar/app-sidebar.tsx`

- 添加 `toolsDialogOpen` state
- 在 settings subs 中（mobile 和 desktop 两处）在 mcps 前面添加 tools 入口，图标用 `Wrench`（或 `Terminal`）
- 添加 `setterMap` 映射
- 渲染 `<ToolsDialog />` 组件
- 导入 ToolsDialog 组件

### 4. 修改 `packages/web/src/components/sidebar/agent-detail.tsx`

将 313-330 行的 `<Section>` 替换为：
- 一个按钮，显示已选工具数量（如"已启用 3/26 个工具"）
- 点击按钮弹出 `<ToolsDialog selectable selectedTools={agent.tools} onSelectedToolsChange={...} />`
- 删除 `toggleTool` 函数（逻辑移到 tools-dialog 内部）

### 5. 修改 `packages/web/src/locales/zh.json` + `en.json`

添加 i18n keys:
```json
// tools 命名空间
"tools": {
  "title": "工具管理",
  "search": "搜索工具...",
  "empty": "没有找到工具",
  "filterAll": "全部",
  "detailTitle": "工具详情",
  "enabledCount": "已启用 {count}/{total} 个工具",
  "selectTools": "选择工具",
  "categories": {
    "channel": "频道管理",
    "terminal": "终端/命令",
    "database": "知识库",
    "kanban": "看板"
  }
}
```

英文对应翻译。

### 6. sidebar nav i18n

在 `sidebar.nav` 下添加 `"tools": "工具管理"` / `"tools": "Tools"`。

## 验证

1. `pnpm dev` 启动，侧边栏 Settings 下出现"工具管理"入口
2. 桌面端点击弹出 ToolsDialog，左侧分类、右侧工具列表
3. 搜索过滤正常
4. 点击工具卡片弹出详情对话框
5. `/settings/tools` 页面独立渲染（standalone 模式）
6. Agent 详情页中 tools Section 变为按钮，点击弹出 selectable 模式的 ToolsDialog
7. 勾选/取消勾选工具后，agent.tools 正确更新
