# Worktree 系统 — 为每个 AI 提供独立 Git 隔离环境

## 概述

在 Workspace 下实现 Git Worktree 功能，支持一键为 AI Agent 创建独立 Git worktree + 分支，提供完全隔离的编码环境。提供审查 Diff、创建 PR、合并变更的完整工作流。支持手动创建和 Issue 自动化创建两种方式。

## 核心设计决策

- **Worktree 切换复用 Workspace 基础设施**：切换 worktree 时构造一个隐藏 Workspace 实体插入 workspace store，路由跳转到该 workspace。sidebar 和 workspace-tabs 通过 `isWorktree` 字段过滤掉这些隐藏 workspace。
- **数据存储**：JSON 文件持久化（`~/.agent-spaces-data/workspaces/{ws_id}/worktrees/index.json`），与现有 workspace 存储方式一致。
- **Git 操作**：通过 simple-git 执行 `git worktree add/remove`，通过 `gh` CLI 创建和合并 PR。

## 数据模型

### shared: `types/worktree.ts`

```typescript
export interface WorktreeInfo {
  id: string;
  workspaceId: string;        // 父 workspace ID
  name: string;               // worktree 名称（如 agent 名或自定义名）
  branch: string;             // git 分支名
  path: string;               // 物理路径（.agent-spaces-data/workspaces/{ws_id}/worktrees/{wt_id}/）
  agentId?: string;           // 关联的 Agent preset ID
  issueId?: string;           // 关联的 Issue ID
  taskId?: string;            // 关联的 Task ID
  prUrl?: string;             // 创建的 PR URL（有值时显示合并按钮）
  status: WorktreeStatus;
  createdAt: string;
  updatedAt: string;
}

export type WorktreeStatus = 'active' | 'merged' | 'deleted';

export interface CreateWorktreeInput {
  name: string;
  branch?: string;            // 可选，不传则自动生成
  agentId?: string;
  issueId?: string;
  taskId?: string;
}
```

### Workspace 类型扩展

在 `Workspace` 接口增加两个可选字段：

```typescript
isWorktree?: boolean;         // 标识这是 worktree 创建的隐藏 workspace
parentWorkspaceId?: string;   // 指向父 workspace
```

## 后端 API

### 路由前缀

`/api/workspaces/:id/worktrees`

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/` | 列出所有 worktree |
| POST | `/` | 创建 worktree |
| GET | `/:wtId` | 获取 worktree 详情 |
| DELETE | `/:wtId` | 删除 worktree |
| GET | `/:wtId/diff` | 审查 Diff（与主分支对比） |
| POST | `/:wtId/pr` | 创建 PR（gh pr create） |
| POST | `/:wtId/merge` | 合并 PR（merge commit）+ 删除 worktree |

### 创建 Worktree 流程

`POST /api/workspaces/:id/worktrees`

1. 获取父 workspace，确定 git 仓库根目录
2. 生成 worktree ID 和分支名（如未指定则用 `{name}-{timestamp}`）
3. 物理路径：`~/.agent-spaces-data/workspaces/{ws_id}/worktrees/{wt_id}/`
4. 执行 `git worktree add <path> -b <branch>`
5. 保存 `WorktreeInfo` 到 `worktrees/index.json`
6. WebSocket 广播 `worktree.created`
7. 返回 `WorktreeInfo`

### 审查 Diff

`GET /api/workspaces/:id/worktrees/:wtId/diff`

执行 `git diff main...<branch>` 返回与主分支的差异。

### 创建 PR

`POST /api/workspaces/:id/worktrees/:wtId/pr`

Body: `{ title?: string, body?: string }`

1. 执行 `gh pr create --head <branch> --title <title> --body <body>`
2. 解析返回的 PR URL
3. 更新 `WorktreeInfo.prUrl`
4. WebSocket 广播 `worktree.pr_created`
5. 返回 PR URL

### 合并 + 清理

`POST /api/workspaces/:id/worktrees/:wtId/merge`

1. 在主仓库目录下执行 `gh pr merge <prUrl> --merge`（merge commit 方式）
2. 在主仓库目录下执行 `git worktree remove <path>`
3. 可选：删除已合并的分支 `git branch -d <branch>`
4. 更新 `WorktreeInfo.status = 'merged'`
5. WebSocket 广播 `worktree.merged`

### 删除 Worktree

`DELETE /api/workspaces/:id/worktrees/:wtId`

1. 执行 `git worktree remove <path> --force`（如有未提交变更会 force）
2. 删除物理目录
3. 更新 `WorktreeInfo.status = 'deleted'`
4. WebSocket 广播 `worktree.deleted`

## 后端存储

### 文件结构

```
~/.agent-spaces-data/
  workspaces/
    {ws_id}/
      workspace.json
      worktrees/
        index.json              # WorktreeInfo[]
        {wt_id}/                # git worktree 物理目录
```

### 后端模块

| 文件 | 说明 |
|------|------|
| `storage/worktree-store.ts` | JSON 文件 CRUD |
| `services/worktree.ts` | 业务逻辑（git worktree 操作 + gh pr 操作） |
| `routes/worktree.ts` | Express 路由（7 个端点） |

## 前端组件

### WorktreePanel 组件

`components/worktree/worktree-panel.tsx`

底部 Tab 面板，在 `workspace-shell.tsx` 的 `defaultJson` borders.bottom.children 新增：

```typescript
{ type: "tab", name: "Worktrees", component: "worktree-panel", id: "worktree-panel" }
```

**布局**：参考 `code-favorites-panel.tsx`，卡片布局 + 响应式 grid。

**空态**：图标 + "暂无 Worktree" + 创建按钮。

**卡片内容**：
- 分支名 + 状态 badge（active 绿色 / merged 灰色）
- 关联 Agent 名（如有）
- 关联 Issue 标题（如有）
- 创建时间
- 操作按钮行：
  - 切换 → 路由跳转
  - 审查 Diff → Diff 对话框（复用 `diff-viewer.tsx`）
  - 创建 PR → `POST /api/workspaces/:id/worktrees/:wtId/pr`
  - PR 链接（PR 创建成功后显示）
  - 合并 → `POST /api/workspaces/:id/worktrees/:wtId/merge`
  - 删除（无 PR 时显示）

### Worktree 卡片交互状态机

```
[创建] → active（无 PR）
  ├── 审查 Diff → 打开 Diff 对话框
  ├── 创建 PR → active（有 PR）
  │     ├── PR 链接（外部打开）
  │     └── 合并 → merged → 删除 worktree，回到主 workspace
  └── 删除 → deleted
```

### 创建 Worktree 对话框

`components/worktree/create-worktree-dialog.tsx`

表单字段：
- 名称（必填）
- 分支名（可选，默认自动生成）
- 关联 Agent（可选，下拉选择）
- 关联 Issue（可选，下拉选择）

### 路由切换逻辑

1. 用户点击「切换」→ `GET /api/workspaces/:wsId/worktrees/:wtId` 获取 worktree info
2. 构造隐藏 Workspace 实体：

```typescript
{
  id: `${wsId}__${wtId}`,     // 双下划线分隔，避免冲突
  name: `${wtName} (Worktree)`,
  boundDirs: [wtPath],
  agentspaceDir: wtPath + '/.agentspace',
  isWorktree: true,
  parentWorkspaceId: wsId,
  createdAt: wtInfo.createdAt,
  updatedAt: wtInfo.updatedAt,
  activeChannels: [],
  activeIssues: [],
}
```

3. `useWorkspaceStore.upsertWorkspace()` 加入列表
4. 路由跳转到 `/workspace/${wsId}__${wtId}`

### Sidebar / Workspace Tabs 过滤

`app-sidebar.tsx` (line 365) 和 `workspace-tabs.tsx` 中：

```typescript
workspaces.filter(ws => !ws.isWorktree)
```

### Worktree Store

`stores/worktree.ts`

```typescript
interface WorktreeStore {
  worktrees: WorktreeInfo[];
  loading: boolean;
  load: (workspaceId: string) => Promise<void>;
  create: (workspaceId: string, data: CreateWorktreeInput) => Promise<WorktreeInfo>;
  remove: (workspaceId: string, worktreeId: string) => Promise<void>;
  createPR: (workspaceId: string, worktreeId: string, opts?: { title?: string; body?: string }) => Promise<string>;
  merge: (workspaceId: string, worktreeId: string) => Promise<void>;
}
```

## Issue 自动化集成

### Issue 创建对话框改造

在 Issue 创建对话框中新增开关：「在独立 Worktree 中运行」，默认开启。

### 自动化流程

当 Issue 选择 Workflow 并启动自动化时（`issue-task-controller.ts`），如果开关开启：

1. 每个 Task 分配给 Executor Agent 时，自动创建 worktree
2. 分支名格式：`{issue_id}-{task_id}`
3. Worktree 的 `path` 设置为 Agent 的 `workingDir`
4. Task 完成后自动触发 PR 创建
5. 所有 Task PR 创建后，Issue 进入 `review_pending` 状态

## WebSocket 事件

在 `shared/types/events.ts` 的 `ServerEventMap` 中新增：

```typescript
worktree_created: WSEvent<WorktreeInfo>;
worktree_deleted: WSEvent<{ id: string; workspaceId: string }>;
worktree_pr_created: WSEvent<WorktreeInfo>;
worktree_merged: WSEvent<WorktreeInfo>;
```

## 文件清单

### shared（+1 文件）

| 文件 | 说明 |
|------|------|
| `types/worktree.ts` | WorktreeInfo + WorktreeStatus + CreateWorktreeInput 类型 |
| `types/workspace.ts` | Workspace 新增 isWorktree / parentWorkspaceId 字段 |
| `types/events.ts` | ServerEventMap 新增 4 个 worktree 事件 |

### server（+3 文件）

| 文件 | 说明 |
|------|------|
| `storage/worktree-store.ts` | JSON 文件 CRUD（listWorktrees / getWorktree / createWorktree / updateWorktree / deleteWorktree） |
| `services/worktree.ts` | 业务逻辑（git worktree add/remove + gh pr create/merge + diff） |
| `routes/worktree.ts` | Express 路由（7 个端点） |
| `agents/issue-task-controller.ts` | Task 执行前自动创建 worktree，完成后自动创建 PR |

### web（+4 文件）

| 文件 | 说明 |
|------|------|
| `stores/worktree.ts` | Worktree Store（load/create/remove/createPR/merge） |
| `components/worktree/worktree-panel.tsx` | 底部 Tab 面板（卡片列表 + 操作按钮） |
| `components/worktree/worktree-card.tsx` | Worktree 卡片组件（状态 + 操作按钮状态机） |
| `components/worktree/create-worktree-dialog.tsx` | 创建 worktree 对话框 |
| `components/layout/workspace-shell.tsx` | defaultJson 新增 Worktrees tab |
| `components/sidebar/app-sidebar.tsx` | 过滤 isWorktree |
| `components/layout/workspace-tabs.tsx` | 过滤 isWorktree |
| `components/issue/edit-issue-dialog.tsx` | 新增「在独立 Worktree 中运行」开关 |

## i18n

在 `locales/zh.json` 和 `locales/en.json` 中新增 `worktree` 命名空间的翻译 key。
