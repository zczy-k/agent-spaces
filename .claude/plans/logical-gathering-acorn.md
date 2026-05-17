# 为多个视图添加 Skeleton 骨架图占位

## Context

当前项目大部分视图在加载时只显示纯文本 "Loading..." 或小 spinner，用户体验差。需要用已有的 `Skeleton` 组件（`components/ui/skeleton.tsx`）为高频视图添加内容形状匹配的骨架占位。

## 范围：6 个高优先级视图

| # | 组件 | 文件 | 当前加载 UI |
|---|------|------|-------------|
| 1 | Issue 列表 | `components/issue/issue-list.tsx` | 纯文本 `{tc('loading')}` |
| 2 | Git Commits 面板 | `components/git/git-commits-panel.tsx` | 纯文本 `{tc('loading')}` |
| 3 | Usage Dashboard | `components/home/usage-dashboard.tsx` | 无加载态，直接用空数据 fallback |
| 4 | Subscription 面板 | `components/home/subscription-panel.tsx` | RefreshCw 旋转图标 |
| 5 | Channel 列表 | `components/chat/channel-list.tsx` | 无骨架 |
| 6 | Agent 列表（设置页）| `components/sidebar/agent-list.tsx` | 无加载态 |

## 实现方案

### 公共：提取可复用的 Skeleton 组件

在 `components/ui/skeleton.tsx` 中新增几个常用骨架组件：

```
SkeletonLine    - 通用单行文字骨架 (h-4 w-full)
SkeletonCircle  - 头像/图标骨架 (rounded-full)
SkeletonCard    - 卡片容器骨架
```

不用过度抽象，只加这 3 个基础组合。

### 1. Issue 列表 (`issue-list.tsx:80-82`)

**替换前**：`<div className="p-4 text-sm text-muted-foreground">{tc('loading')}</div>`

**替换后**：3 行 issue 骨架条目，每条模拟 `[圆形图标 + 标题行 + 状态badge]`

### 2. Git Commits 面板 (`git-commits-panel.tsx:529`)

**替换前**：`<div className="p-2 text-xs text-muted-foreground">{tc('loading')}</div>`

**替换后**：5 条 commit 骨架，每条模拟 `[hash + message + author/date]`

### 3. Usage Dashboard (`usage-dashboard.tsx:207-219`)

**替换前**：data 为 null 时用空数据 fallback (0 值)

**替换后**：data === null 时显示完整仪表盘骨架（4 个指标卡片 + 2 个图表区域）

### 4. Subscription 面板 (`subscription-panel.tsx`)

**替换前**：loading 时 RefreshCw 旋转

**替换后**：loading 且无 quota 数据时显示卡片骨架（3 个配额卡片），加载完后显示实际数据

### 5. Channel 列表 (`channel-list.tsx`)

**查找 loading 状态**，添加频道条目骨架

### 6. Agent 列表 (`agent-list.tsx`)

添加初始加载时 5 条 agent 骨架条目

## 关键文件

- `packages/web/src/components/ui/skeleton.tsx` - 扩展基础骨架组件
- `packages/web/src/components/issue/issue-list.tsx`
- `packages/web/src/components/git/git-commits-panel.tsx`
- `packages/web/src/components/home/usage-dashboard.tsx`
- `packages/web/src/components/home/subscription-panel.tsx`
- `packages/web/src/components/chat/channel-list.tsx`
- `packages/web/src/components/sidebar/agent-list.tsx`

## 实施顺序

1. 先扩展 `skeleton.tsx` 基础组件
2. 按视图逐个添加骨架（Issue → Git → Dashboard → Subscription → Channel → Agent）
3. 最后 `pnpm build` 验证

## 验证

1. `pnpm build` 通过
2. 各视图在数据加载期间显示骨架占位而非文本/spinner
3. 数据到达后骨架正确切换为实际内容
