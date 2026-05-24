# Worktree 系统架构

## 概述

Worktree 系统为每个 AI Agent 提供独立的 Git worktree + 分支隔离环境。基于 `git worktree` 实现物理目录隔离，前端通过虚拟 Workspace 复用现有 IDE 基础设施。

## 核心设计

### 虚拟 Workspace 模式

Worktree 不是独立的 workspace 实体，而是父 workspace 的子资源。切换 worktree 时，系统构造一个 `isWorktree: true` 的虚拟 Workspace 对象，通过标准 workspace 路由访问。

**关键点**：创建 worktree 时同步写入 `~/.agent-spaces-data/workspaces/{wtId}/workspace.json`，使得 `getWorkspace(wtId)` 和所有 `/api/workspaces/{wtId}/*` 子路由（files、git、channels、agents 等）零改动即可工作。

### 数据模型

```
WorktreeInfo {
  id            string        worktree 唯一 ID（同时也是虚拟 workspace ID）
  workspaceId   string        父 workspace ID
  name          string        用户可读名称
  branch        string        git 分支名
  path          string        物理路径
  agentId?      string        关联的 Agent preset
  issueId?      string        关联的 Issue
  taskId?       string        关联的 Task
  prUrl?        string        PR 链接（创建后填充）
  status        WorktreeStatus 'active' | 'merged' | 'deleted'
}
```

Workspace 类型扩展了两个可选字段：

```typescript
isWorktree?: boolean;         // 标识虚拟 workspace
parentWorkspaceId?: string;   // 指向父 workspace
```

### 文件存储

```
~/.agent-spaces-data/
  workspaces/
    {ws_id}/                          # 父 workspace
      workspace.json
      worktrees/
        index.json                    # WorktreeInfo[]
        {wt_id}/                      # git worktree 物理目录（代码检出）
    {wt_id}/                          # 虚拟 workspace（由系统自动创建）
      workspace.json                  # isWorktree: true 的虚拟 Workspace
```

## API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/workspaces/:id/worktrees` | 列出 worktree（过滤已删除） |
| POST | `/api/workspaces/:id/worktrees` | 创建 worktree + 虚拟 workspace |
| GET | `/api/workspaces/:id/worktrees/:wtId` | 获取 worktree 详情 |
| DELETE | `/api/workspaces/:id/worktrees/:wtId` | 删除 worktree + 清理虚拟 workspace |
| GET | `/api/workspaces/:id/worktrees/:wtId/diff` | 审查 Diff（与主分支对比） |
| POST | `/api/workspaces/:id/worktrees/:wtId/pr` | 创建 PR（`gh pr create`） |
| POST | `/api/workspaces/:id/worktrees/:wtId/merge` | 合并 PR + 清理 |

### 创建流程

```
POST /api/workspaces/:id/worktrees { name, branch?, agentId? }
  ↓
1. 生成分支名（自动解决冲突：test → test-2 → test-3）
2. git worktree add <path> -b <branch>
3. 写入 WorktreeInfo 到 worktrees/index.json
4. 写入虚拟 workspace.json 到 workspaces/{wtId}/
5. 广播 worktree.created WebSocket 事件
```

### 合并流程

```
POST /api/workspaces/:id/worktrees/:wtId/merge
  ↓
1. gh pr merge <url> --merge
2. git worktree remove <path>
3. git branch -d <branch>
4. 删除虚拟 workspace.json
5. 标记 WorktreeInfo.status = 'merged'
6. 广播 worktree.merged WebSocket 事件
```

### PR 创建流程

```
POST /api/workspaces/:id/worktrees/:wtId/pr
  ↓
1. 校验 worktree 分支相对默认分支有提交
2. git push -u origin <branch>
3. gh pr create --base <default-branch> --head <branch>
4. 写回 prUrl 到 WorktreeInfo
5. 广播 worktree.pr_created WebSocket 事件
```

## 前端集成

### 底部 Tab 面板

在 workspace-shell.tsx 的 FlexLayout 底部 border 注册 `worktree-panel` 组件，展示当前 workspace 的 worktree 卡片列表。

**面板共享**：在 worktree 内部查看面板时，自动解析到父 workspace 加载 worktree 列表，确保主 workspace 和 worktree 下看到相同的数据。

### 卡片状态机

```
[active, 无 PR]
  ├── 切换 → 路由跳转到 /workspace/{wtId}
  ├── 审查 Diff → 展开内联 diff
  ├── 创建 PR → 调用 API，成功后显示 PR 链接
  └── 删除 → 确认后删除 worktree

[active, 有 PR]
  ├── 查看 PR → 外部链接
  └── 合并 → 合并 PR + 删除 worktree + 跳回父 workspace
```

### Sidebar / Tabs 过滤

`app-sidebar.tsx` 和 `workspace-tabs.tsx` 通过 `workspaces.filter(ws => !ws.isWorktree)` 隐藏 worktree 虚拟 workspace，避免在导航中污染 workspace 列表。

### 路由

worktree 直接使用 worktree ID 作为路由：`/workspace/{wtId}`。后端通过虚拟 workspace.json 让所有子路由正常工作。

### WebSocket 事件

| 事件 | 数据 |
|------|------|
| `worktree.created` | WorktreeInfo |
| `worktree.deleted` | `{ id, workspaceId }` |
| `worktree.pr_created` | WorktreeInfo |
| `worktree.merged` | WorktreeInfo |

## 后端模块

| 文件 | 职责 |
|------|------|
| `shared/types/worktree.ts` | 类型定义 |
| `server/storage/worktree-store.ts` | JSON 持久化 CRUD |
| `server/services/worktree.ts` | 业务逻辑（git worktree + gh pr） |
| `server/routes/worktree.ts` | Express 路由（7 端点） |
| `server/services/workspace.ts` | getAll() 包含 worktree 虚拟 workspace |

## 前端模块

| 文件 | 职责 |
|------|------|
| `stores/worktree.ts` | Zustand store（load/create/remove/createPR/merge） |
| `components/worktree/worktree-panel.tsx` | 底部面板（卡片网格 + 空态） |
| `components/worktree/worktree-card.tsx` | 卡片（状态 badge + 操作按钮 + 内联 diff） |
| `components/worktree/create-worktree-dialog.tsx` | 创建对话框 |

## 边界情况

- **分支名冲突**：自动加后缀（`test` → `test-2`）
- **合并后清理**：虚拟 workspace.json + git worktree + 分支 一并删除
- **强制删除**：`git worktree remove --force` 处理未提交变更
- **暗色模式**：原生 `<select>` 使用 `bg-background` 确保可读性
