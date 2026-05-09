# Plan: 移动端设置页面路由化

## Context

当前 sidebar 设置下的 6 个子项（通用/Agent/技能/MCP/模型/供应商）全部使用 Dialog 打开。在手机小屏幕下 Dialog 体验差（遮挡内容、滚动受限、难以导航），需要改为路由跳转到独立页面。

## 方案

每个 Dialog 组件增加 `standalone` 模式，跳过 Dialog 外壳直接渲染内容。移动端 sidebar 点击时 `router.push()` 到路由页面，页面使用 standalone 模式渲染。

## 文件变更

### 1. 新建 `SettingsPageLayout` 组件
**文件**: `src/components/settings/settings-page-layout.tsx`

通用移动端设置页布局：顶部返回按钮 + 标题 + 可滚动内容区。

### 2. 6 个 Dialog 增加 standalone 支持

修改以下文件，加 `standalone?: boolean` prop。当 `standalone=true` 时，跳过 `<Dialog>` 包裹，直接渲染 `DialogContent` 的子元素：

| 文件 | 行数 | 改动 |
|------|------|------|
| `src/components/sidebar/settings-dialog.tsx` | 192 | 加 standalone，条件渲染 |
| `src/components/sidebar/agent-dialog.tsx` | 387 | 加 standalone，条件渲染 |
| `src/components/sidebar/skills-dialog.tsx` | 656 | 加 standalone（仅主 dialog，子 dialog 保持不变）|
| `src/components/sidebar/mcps-dialog.tsx` | 576 | 同上 |
| `src/components/sidebar/models-dialog.tsx` | 507 | 加 standalone，条件渲染 |
| `src/components/sidebar/providers-dialog.tsx` | 283 | 加 standalone，条件渲染 |

### 3. 新建路由页面

```
src/app/settings/
  layout.tsx              # 设置页布局（含 SettingsPageLayout）
  page.tsx                # 通用设置 -> SettingsDialog standalone
  agents/page.tsx         # Agent 配置 -> AgentDialog standalone
  skills/page.tsx         # 技能管理 -> SkillsDialog standalone
  mcps/page.tsx           # MCP 管理 -> McpsDialog standalone
  models/page.tsx         # 模型管理 -> ModelsDialog standalone
  providers/page.tsx      # 供应商管理 -> ProvidersDialog standalone
```

### 4. 修改 Sidebar 路由逻辑

**文件**: `src/components/sidebar/app-sidebar.tsx`

- 引入 `useIsMobile`
- 移动端 settings subs 的 `onClick` 改为 `router.push('/settings/xxx')`
- 桌面端保持不变（打开 Dialog）

## 实现细节

### SettingsPageLayout

```tsx
// 简单的移动端全屏布局
<div className="h-full flex flex-col">
  <header className="flex items-center gap-2 px-4 py-3 border-b">
    <Button variant="ghost" size="icon" onClick={() => router.back()}>
      <ArrowLeft />
    </Button>
    <h1 className="text-base font-medium">{title}</h1>
  </header>
  <div className="flex-1 overflow-y-auto">
    {children}
  </div>
</div>
```

### Dialog standalone 模式示例

```tsx
// Before:
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>...content...</DialogContent>
</Dialog>

// After:
if (standalone) {
  return <div className="h-full flex flex-col">...content...</div>;
}
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>...content...</DialogContent>
  </Dialog>
);
```

### Sidebar 改动

```tsx
const isMobile = useIsMobile();

// settings subs 根据环境切换行为
const settingsSubs = isMobile
  ? [
      { title: ts('nav.general'), link: "/settings" },
      { title: ts('nav.agents'), link: "/settings/agents", icon: <Bot /> },
      { title: ts('nav.skills'), link: "/settings/skills", icon: <Sparkles /> },
      { title: ts('nav.mcps'), link: "/settings/mcps", icon: <Plug /> },
      { title: ts('nav.models'), link: "/settings/models", icon: <Brain /> },
      { title: ts('nav.providers'), link: "/settings/providers", icon: <Server /> },
    ]
  : [
      // 现有 onClick 逻辑不变
    ];
```

### Skills/MCPs Dialog 特殊处理

这两个 Dialog 内含多个子 Dialog（编辑/绑定/同步）。standalone 只影响主 Dialog，子 Dialog 保持原样。在路由页面中渲染主 Dialog standalone + 子 Dialog 正常弹出。

### ProvidersDialog 的 onAddModel 回调

桌面端 ProvidersDialog 有 `onAddModel` 回调打开 ModelsDialog。路由页面中这个回调改为 `router.push('/settings/models?provider=xxx')`。路由页面需要处理 URL 参数。

## 验证

1. 桌面端：sidebar 设置项点击仍打开 Dialog（无变化）
2. 移动端（<768px）：sidebar 设置项点击跳转到 `/settings/xxx` 路由
3. 设置页面：全屏布局，返回按钮可回退
4. Skills/MCPs：主页面全屏，编辑/绑定子功能仍用 Dialog 弹出
5. Providers -> Models 联动：在移动端路由页面中仍能正常跳转
