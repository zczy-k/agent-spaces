# Worktree 系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Workspace 下实现 Git Worktree 功能，支持为 AI Agent 创建隔离环境，提供 Diff 审查、PR 创建、合并的完整工作流。

**Architecture:** Worktree 切换时复用 Workspace 基础设施——构造隐藏 Workspace 实体插入 store，sidebar/tabs 通过 `isWorktree` 字段过滤。后端 JSON 文件持久化 worktree 元数据，simple-git 执行 worktree 操作，`gh` CLI 处理 PR。

**Tech Stack:** TypeScript, Express 5, simple-git, Zustand, Next.js, FlexLayout, shadcn/ui, next-intl

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/shared/src/types/worktree.ts` | WorktreeInfo + WorktreeStatus + CreateWorktreeInput 类型 |
| `packages/server/src/storage/worktree-store.ts` | JSON 文件 CRUD（list/get/create/update/delete） |
| `packages/server/src/services/worktree.ts` | 业务逻辑（git worktree + gh pr + diff） |
| `packages/server/src/routes/worktree.ts` | Express 路由（7 个端点） |
| `packages/web/src/stores/worktree.ts` | Zustand Store（load/create/remove/createPR/merge） |
| `packages/web/src/components/worktree/worktree-panel.tsx` | 底部 Tab 面板（卡片列表 + 空态） |
| `packages/web/src/components/worktree/worktree-card.tsx` | Worktree 卡片（状态 + 操作按钮） |
| `packages/web/src/components/worktree/create-worktree-dialog.tsx` | 创建 worktree 对话框 |
| `packages/web/src/locales/zh/worktree.json` | 中文翻译 |
| `packages/web/src/locales/en/worktree.json` | 英文翻译 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/shared/src/types/workspace.ts` | Workspace 新增 isWorktree / parentWorkspaceId |
| `packages/shared/src/types/events.ts` | ServerEventMap 新增 4 个 worktree 事件 |
| `packages/shared/src/types/index.ts` | 新增 `export * from './worktree.js'` |
| `packages/server/src/app.ts` | 挂载 worktree 路由 |
| `packages/web/src/components/layout/workspace-shell.tsx` | defaultJson 新增 Worktrees tab + factory 注册 |
| `packages/web/src/components/sidebar/app-sidebar.tsx` | 过滤 isWorktree workspace |
| `packages/web/src/components/layout/workspace-tabs.tsx` | 过滤 isWorktree workspace |
| `packages/web/src/locales/zh/index.ts` | 新增 worktree import |
| `packages/web/src/locales/en/index.ts` | 新增 worktree import |

---

## Task 1: shared 类型定义

**Files:**
- Create: `packages/shared/src/types/worktree.ts`
- Modify: `packages/shared/src/types/workspace.ts:6-18`
- Modify: `packages/shared/src/types/events.ts:111-142`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: 创建 worktree 类型文件**

```typescript
// packages/shared/src/types/worktree.ts
export interface WorktreeInfo {
  id: string;
  workspaceId: string;
  name: string;
  branch: string;
  path: string;
  agentId?: string;
  issueId?: string;
  taskId?: string;
  prUrl?: string;
  status: WorktreeStatus;
  createdAt: string;
  updatedAt: string;
}

export type WorktreeStatus = 'active' | 'merged' | 'deleted';

export interface CreateWorktreeInput {
  name: string;
  branch?: string;
  agentId?: string;
  issueId?: string;
  taskId?: string;
}
```

- [ ] **Step 2: 扩展 Workspace 类型**

在 `packages/shared/src/types/workspace.ts` 的 `Workspace` 接口末尾（`hooksEnabled?: boolean;` 后面）添加：

```typescript
  isWorktree?: boolean;
  parentWorkspaceId?: string;
```

- [ ] **Step 3: 扩展 ServerEventMap**

在 `packages/shared/src/types/events.ts` 的 `ServerEventMap`（第 141 行 `'notification.cleared': null;` 之后）添加：

```typescript
  'worktree.created': import('./worktree.js').WorktreeInfo;
  'worktree.deleted': { id: string; workspaceId: string };
  'worktree.pr_created': import('./worktree.js').WorktreeInfo;
  'worktree.merged': import('./worktree.js').WorktreeInfo;
```

- [ ] **Step 4: 导出新类型**

在 `packages/shared/src/types/index.ts` 末尾添加：

```typescript
export * from './worktree.js';
```

- [ ] **Step 5: 构建 shared 包并验证**

Run: `cd /Users/Zhuanz/Documents/agent_spaces && pnpm --filter @agent-spaces/shared build`
Expected: 编译成功，无类型错误

- [ ] **Step 6: 提交**

```bash
git add packages/shared/
git commit -m "feat(shared): add WorktreeInfo type and Workspace isWorktree field"
```

---

## Task 2: 后端 worktree-store

**Files:**
- Create: `packages/server/src/storage/worktree-store.ts`

参考 `packages/server/src/storage/workspace-store.ts` 的 JSON 持久化模式。

- [ ] **Step 1: 创建 worktree-store.ts**

```typescript
// packages/server/src/storage/worktree-store.ts
import { join } from 'node:path';
import type { WorktreeInfo } from '@agent-spaces/shared';
import { getDataDir, ensureDir, readJsonFile, writeJsonFile } from './json-store.js';

function worktreesDir(workspaceId: string) {
  return join(getDataDir(), 'workspaces', workspaceId, 'worktrees');
}

function worktreesIndex(workspaceId: string) {
  return join(worktreesDir(workspaceId), 'index.json');
}

export function listWorktrees(workspaceId: string): WorktreeInfo[] {
  return readJsonFile<WorktreeInfo[]>(worktreesIndex(workspaceId)) || [];
}

export function getWorktree(workspaceId: string, worktreeId: string): WorktreeInfo | null {
  const list = listWorktrees(workspaceId);
  return list.find(wt => wt.id === worktreeId) ?? null;
}

export function createWorktree(workspaceId: string, info: WorktreeInfo): void {
  ensureDir(worktreesDir(workspaceId));
  const list = listWorktrees(workspaceId);
  list.push(info);
  writeJsonFile(worktreesIndex(workspaceId), list);
}

export function updateWorktree(workspaceId: string, info: WorktreeInfo): void {
  const list = listWorktrees(workspaceId);
  const idx = list.findIndex(wt => wt.id === info.id);
  if (idx >= 0) list[idx] = info;
  writeJsonFile(worktreesIndex(workspaceId), list);
}

export function deleteWorktreeFromIndex(workspaceId: string, worktreeId: string): void {
  const list = listWorktrees(workspaceId).filter(wt => wt.id !== worktreeId);
  writeJsonFile(worktreesIndex(workspaceId), list);
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/storage/worktree-store.ts
git commit -m "feat(server): add worktree JSON store"
```

---

## Task 3: 后端 worktree service

**Files:**
- Create: `packages/server/src/services/worktree.ts`

- [ ] **Step 1: 创建 worktree service**

```typescript
// packages/server/src/services/worktree.ts
import { v4 as uuid } from 'uuid';
import simpleGit from 'simple-git';
import { join } from 'node:path';
import type { WorktreeInfo, CreateWorktreeInput, WorktreeStatus } from '@agent-spaces/shared';
import { getDataDir, ensureDir } from '../storage/json-store.js';
import {
  listWorktrees, getWorktree, createWorktree as storeCreate,
  updateWorktree, deleteWorktreeFromIndex,
} from '../storage/worktree-store.js';
import { getWorkspace } from '../storage/workspace-store.js';
import { broadcastToWorkspace } from '../ws/connection-manager.js';

function worktreesBaseDir(workspaceId: string) {
  return join(getDataDir(), 'workspaces', workspaceId, 'worktrees');
}

export function listWorkspaceWorktrees(workspaceId: string): WorktreeInfo[] {
  return listWorktrees(workspaceId).filter(wt => wt.status !== 'deleted');
}

export function getWorkspaceWorktree(workspaceId: string, worktreeId: string): WorktreeInfo | null {
  return getWorktree(workspaceId, worktreeId);
}

export async function createWorkspaceWorktree(
  workspaceId: string, input: CreateWorktreeInput
): Promise<WorktreeInfo> {
  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const id = uuid();
  const branch = input.branch || `${input.name}-${Date.now()}`;
  const wtPath = join(worktreesBaseDir(workspaceId), id);

  ensureDir(join(worktreesBaseDir(workspaceId), id));

  const git = simpleGit(ws.boundDirs[0]);
  await git.raw(['worktree', 'add', wtPath, '-b', branch]);

  const now = new Date().toISOString();
  const info: WorktreeInfo = {
    id, workspaceId, name: input.name, branch, path: wtPath,
    agentId: input.agentId, issueId: input.issueId, taskId: input.taskId,
    status: 'active', createdAt: now, updatedAt: now,
  };

  storeCreate(workspaceId, info);
  broadcastToWorkspace(workspaceId, 'worktree.created', info);
  return info;
}

export async function deleteWorkspaceWorktree(
  workspaceId: string, worktreeId: string
): Promise<void> {
  const info = getWorktree(workspaceId, worktreeId);
  if (!info) throw new Error('Worktree not found');

  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const git = simpleGit(ws.boundDirs[0]);
  await git.raw(['worktree', 'remove', info.path, '--force']).catch(() => {});

  info.status = 'deleted';
  info.updatedAt = new Date().toISOString();
  updateWorktree(workspaceId, info);

  broadcastToWorkspace(workspaceId, 'worktree.deleted', { id: worktreeId, workspaceId });
}

export async function getWorktreeDiff(
  workspaceId: string, worktreeId: string
): Promise<string> {
  const info = getWorktree(workspaceId, worktreeId);
  if (!info) throw new Error('Worktree not found');

  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const git = simpleGit(ws.boundDirs[0]);
  const diff = await git.diff([`main...${info.branch}`]);
  return diff;
}

export async function createWorktreePR(
  workspaceId: string, worktreeId: string, title?: string, body?: string
): Promise<string> {
  const info = getWorktree(workspaceId, worktreeId);
  if (!info) throw new Error('Worktree not found');

  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const git = simpleGit(ws.boundDirs[0]);
  const prTitle = title || `[${info.name}] ${info.branch}`;
  const args = ['pr', 'create', '--head', info.branch, '--title', prTitle];
  if (body) args.push('--body', body);

  const result = await git.raw(args);
  const urlMatch = result.match(/https:\/\/[^\s]+/);
  if (!urlMatch) throw new Error('Failed to parse PR URL from gh output');

  info.prUrl = urlMatch[0];
  info.updatedAt = new Date().toISOString();
  updateWorktree(workspaceId, info);

  broadcastToWorkspace(workspaceId, 'worktree.pr_created', info);
  return info.prUrl;
}

export async function mergeWorktreePR(
  workspaceId: string, worktreeId: string
): Promise<void> {
  const info = getWorktree(workspaceId, worktreeId);
  if (!info) throw new Error('Worktree not found');
  if (!info.prUrl) throw new Error('No PR associated with this worktree');

  const ws = getWorkspace(workspaceId);
  if (!ws) throw new Error('Workspace not found');

  const git = simpleGit(ws.boundDirs[0]);

  await git.raw(['pr', 'merge', info.prUrl, '--merge']);
  await git.raw(['worktree', 'remove', info.path]).catch(() => {});
  await git.raw(['branch', '-d', info.branch]).catch(() => {});

  info.status = 'merged';
  info.updatedAt = new Date().toISOString();
  updateWorktree(workspaceId, info);

  broadcastToWorkspace(workspaceId, 'worktree.merged', info);
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/server/src/services/worktree.ts
git commit -m "feat(server): add worktree service (create/delete/diff/PR/merge)"
```

---

## Task 4: 后端 worktree 路由

**Files:**
- Create: `packages/server/src/routes/worktree.ts`
- Modify: `packages/server/src/app.ts:194`（在 kanban 路由后挂载）

- [ ] **Step 1: 创建 worktree 路由**

```typescript
// packages/server/src/routes/worktree.ts
import { Router } from 'express';
import { z } from 'zod';
import {
  listWorkspaceWorktrees, getWorkspaceWorktree,
  createWorkspaceWorktree, deleteWorkspaceWorktree,
  getWorktreeDiff, createWorktreePR, mergeWorktreePR,
} from '../services/worktree.js';

export const worktreeRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  branch: z.string().optional(),
  agentId: z.string().optional(),
  issueId: z.string().optional(),
  taskId: z.string().optional(),
});

const prSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
});

worktreeRouter.get('/', (req, res) => {
  const { id } = req.params;
  res.json(listWorkspaceWorktrees(id));
});

worktreeRouter.post('/', async (req, res) => {
  try {
    const { id } = req.params;
    const input = createSchema.parse(req.body);
    const info = await createWorkspaceWorktree(id, input);
    res.status(201).json(info);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.get('/:wtId', (req, res) => {
  const { id, wtId } = req.params;
  const info = getWorkspaceWorktree(id, wtId);
  if (!info) return res.status(404).json({ error: 'Worktree not found' });
  res.json(info);
});

worktreeRouter.delete('/:wtId', async (req, res) => {
  try {
    const { id, wtId } = req.params;
    await deleteWorkspaceWorktree(id, wtId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.get('/:wtId/diff', async (req, res) => {
  try {
    const { id, wtId } = req.params;
    const diff = await getWorktreeDiff(id, wtId);
    res.type('text/plain').send(diff);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.post('/:wtId/pr', async (req, res) => {
  try {
    const { id, wtId } = req.params;
    const { title, body } = prSchema.parse(req.body);
    const prUrl = await createWorktreePR(id, wtId, title, body);
    res.json({ prUrl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

worktreeRouter.post('/:wtId/merge', async (req, res) => {
  try {
    const { id, wtId } = req.params;
    await mergeWorktreePR(id, wtId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
```

- [ ] **Step 2: 在 app.ts 中挂载路由**

在 `packages/server/src/app.ts` 中，找到第 193 行（kanban 路由）后，添加 import 和路由挂载：

在文件顶部的 import 区域添加：
```typescript
import { worktreeRouter } from './routes/worktree.js';
```

在第 193 行 `app.use('/api/workspaces/:id/kanban', kanbanRouter);` 之后添加：
```typescript
app.use('/api/workspaces/:id/worktrees', worktreeRouter);
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/Zhuanz/Documents/agent_spaces/packages/server && npx tsc --noEmit 2>&1 | head -20`
Expected: 无类型错误

- [ ] **Step 4: 提交**

```bash
git add packages/server/src/routes/worktree.ts packages/server/src/app.ts
git commit -m "feat(server): add worktree REST API routes (7 endpoints)"
```

---

## Task 5: 前端 i18n 翻译

**Files:**
- Create: `packages/web/src/locales/zh/worktree.json`
- Create: `packages/web/src/locales/en/worktree.json`
- Modify: `packages/web/src/locales/zh/index.ts`
- Modify: `packages/web/src/locales/en/index.ts`

- [ ] **Step 1: 创建中文翻译**

```json
{
  "panel": {
    "title": "Worktrees",
    "empty": "暂无 Worktree",
    "emptyHint": "创建独立分支环境，为 AI 提供隔离的编码空间",
    "create": "创建 Worktree"
  },
  "card": {
    "active": "活跃",
    "merged": "已合并",
    "switch": "切换",
    "diff": "审查 Diff",
    "createPR": "创建 PR",
    "viewPR": "查看 PR",
    "merge": "合并",
    "delete": "删除",
    "branch": "分支",
    "agent": "Agent",
    "issue": "Issue",
    "createdAt": "创建于",
    "confirmDelete": "确认删除该 Worktree？未提交的变更将丢失。"
  },
  "dialog": {
    "createTitle": "创建 Worktree",
    "name": "名称",
    "namePlaceholder": "例如：feature-auth",
    "branch": "分支名（可选）",
    "branchPlaceholder": "留空自动生成",
    "agent": "关联 Agent（可选）",
    "issue": "关联 Issue（可选）",
    "creating": "创建中..."
  }
}
```

- [ ] **Step 2: 创建英文翻译**

```json
{
  "panel": {
    "title": "Worktrees",
    "empty": "No Worktrees",
    "emptyHint": "Create isolated branch environments for AI agents",
    "create": "Create Worktree"
  },
  "card": {
    "active": "Active",
    "merged": "Merged",
    "switch": "Switch",
    "diff": "Review Diff",
    "createPR": "Create PR",
    "viewPR": "View PR",
    "merge": "Merge",
    "delete": "Delete",
    "branch": "Branch",
    "agent": "Agent",
    "issue": "Issue",
    "createdAt": "Created",
    "confirmDelete": "Delete this Worktree? Uncommitted changes will be lost."
  },
  "dialog": {
    "createTitle": "Create Worktree",
    "name": "Name",
    "namePlaceholder": "e.g. feature-auth",
    "branch": "Branch (optional)",
    "branchPlaceholder": "Auto-generated if empty",
    "agent": "Agent (optional)",
    "issue": "Issue (optional)",
    "creating": "Creating..."
  }
}
```

- [ ] **Step 3: 注册到 zh/index.ts**

在 `packages/web/src/locales/zh/index.ts` 中：
- 添加 import：`import worktree from './worktree.json';`（在 workspaces import 之后）
- 在 export default 对象中添加 `worktree,`

- [ ] **Step 4: 注册到 en/index.ts**

同样在 `packages/web/src/locales/en/index.ts` 中添加 worktree import 和 export。

- [ ] **Step 5: 提交**

```bash
git add packages/web/src/locales/
git commit -m "feat(web): add worktree i18n translations"
```

---

## Task 6: 前端 Worktree Store

**Files:**
- Create: `packages/web/src/stores/worktree.ts`

- [ ] **Step 1: 创建 worktree store**

```typescript
// packages/web/src/stores/worktree.ts
import { create } from 'zustand';
import type { WorktreeInfo, CreateWorktreeInput } from '@agent-spaces/shared';
import { authHeaders } from '@/lib/auth';

interface WorktreeStore {
  worktrees: WorktreeInfo[];
  loading: boolean;
  load: (workspaceId: string) => Promise<void>;
  create: (workspaceId: string, data: CreateWorktreeInput) => Promise<WorktreeInfo>;
  remove: (workspaceId: string, worktreeId: string) => Promise<void>;
  createPR: (workspaceId: string, worktreeId: string, opts?: { title?: string; body?: string }) => Promise<string>;
  merge: (workspaceId: string, worktreeId: string) => Promise<void>;
}

export const useWorktreeStore = create<WorktreeStore>((set, get) => ({
  worktrees: [],
  loading: false,

  load: async (workspaceId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/worktrees`, { headers: authHeaders() });
      const worktrees: WorktreeInfo[] = await res.json();
      set({ worktrees });
    } finally {
      set({ loading: false });
    }
  },

  create: async (workspaceId, data) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/worktrees`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const info: WorktreeInfo = await res.json();
    set((s) => ({ worktrees: [...s.worktrees, info] }));
    return info;
  },

  remove: async (workspaceId, worktreeId) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    set((s) => ({ worktrees: s.worktrees.filter(wt => wt.id !== worktreeId) }));
  },

  createPR: async (workspaceId, worktreeId, opts) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}/pr`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(opts || {}),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const { prUrl } = await res.json();
    set((s) => ({
      worktrees: s.worktrees.map(wt =>
        wt.id === worktreeId ? { ...wt, prUrl } : wt
      ),
    }));
    return prUrl;
  },

  merge: async (workspaceId, worktreeId) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${worktreeId}/merge`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    set((s) => ({
      worktrees: s.worktrees.filter(wt => wt.id !== worktreeId),
    }));
  },
}));
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/stores/worktree.ts
git commit -m "feat(web): add worktree Zustand store"
```

---

## Task 7: 前端 Worktree 组件

**Files:**
- Create: `packages/web/src/components/worktree/worktree-panel.tsx`
- Create: `packages/web/src/components/worktree/worktree-card.tsx`
- Create: `packages/web/src/components/worktree/create-worktree-dialog.tsx`

- [ ] **Step 1: 创建 worktree-panel.tsx**

```tsx
// packages/web/src/components/worktree/worktree-panel.tsx
"use client";

import { useEffect, useState } from "react";
import { useWorktreeStore } from "@/stores/worktree";
import { WorktreeCard } from "./worktree-card";
import { CreateWorktreeDialog } from "./create-worktree-dialog";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "next-intl";

interface WorktreePanelProps {
  workspaceId: string;
}

export function WorktreePanel({ workspaceId }: WorktreePanelProps) {
  const { worktrees, loading, load } = useWorktreeStore();
  const [createOpen, setCreateOpen] = useState(false);
  const t = useTranslations('worktree');

  useEffect(() => {
    load(workspaceId);
  }, [workspaceId, load]);

  if (worktrees.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <GitBranch size={32} className="opacity-30" />
        <span>{t('panel.empty')}</span>
        <span className="text-xs">{t('panel.emptyHint')}</span>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" />
          {t('panel.create')}
        </Button>
        <CreateWorktreeDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={workspaceId}
        />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex items-center justify-between p-2 pb-0">
        <span className="text-xs text-muted-foreground">{t('panel.title')} ({worktrees.length})</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus size={12} className="mr-1" />
          {t('panel.create')}
        </Button>
      </div>
      <div className="grid gap-2 p-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {worktrees.map((wt) => (
          <WorktreeCard key={wt.id} worktree={wt} workspaceId={workspaceId} />
        ))}
      </div>
      <CreateWorktreeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
      />
    </ScrollArea>
  );
}
```

- [ ] **Step 2: 创建 worktree-card.tsx**

```tsx
// packages/web/src/components/worktree/worktree-card.tsx
"use client";

import { useState, useCallback } from "react";
import type { WorktreeInfo } from "@agent-spaces/shared";
import { useWorktreeStore } from "@/stores/worktree";
import { useWorkspaceStore } from "@/stores/workspace";
import { useRouter } from "next/navigation";
import { tauriNavigate } from "@/lib/navigate";
import { GitBranch, ExternalLink, Trash2, GitPullRequest, ArrowRightLeft, FileDiff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Workspace } from "@agent-spaces/shared";

interface WorktreeCardProps {
  worktree: WorktreeInfo;
  workspaceId: string;
}

export function WorktreeCard({ worktree: wt, workspaceId }: WorktreeCardProps) {
  const { remove, createPR, merge } = useWorktreeStore();
  const [prLoading, setPrLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations('worktree');
  const upsertWorkspace = useWorkspaceStore((s) => s.upsertWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

  const handleSwitch = useCallback(() => {
    const virtualWs: Workspace = {
      id: `${workspaceId}__${wt.id}`,
      name: `${wt.name} (Worktree)`,
      boundDirs: [wt.path],
      agentspaceDir: wt.path + '/.agentspace',
      isWorktree: true,
      parentWorkspaceId: workspaceId,
      createdAt: wt.createdAt,
      updatedAt: wt.updatedAt,
      activeChannels: [],
      activeIssues: [],
    };
    upsertWorkspace(virtualWs);
    tauriNavigate(router, `/workspace/${virtualWs.id}`);
  }, [wt, workspaceId, upsertWorkspace, router]);

  const handleDiff = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/worktrees/${wt.id}/diff`);
      const text = await res.text();
      setDiffContent(text);
      setShowDiff(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [workspaceId, wt.id]);

  const handleCreatePR = useCallback(async () => {
    setPrLoading(true);
    try {
      await createPR(workspaceId, wt.id);
      toast.success('PR created');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPrLoading(false);
    }
  }, [workspaceId, wt.id, createPR]);

  const handleMerge = useCallback(async () => {
    setMergeLoading(true);
    try {
      await merge(workspaceId, wt.id);
      removeWorkspace(`${workspaceId}__${wt.id}`);
      tauriNavigate(router, `/workspace/${workspaceId}`);
      toast.success('Merged and cleaned up');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMergeLoading(false);
    }
  }, [workspaceId, wt.id, merge, removeWorkspace, router]);

  const handleDelete = useCallback(async () => {
    if (!confirm(t('card.confirmDelete'))) return;
    try {
      await remove(workspaceId, wt.id);
      removeWorkspace(`${workspaceId}__${wt.id}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [workspaceId, wt.id, remove, removeWorkspace, t]);

  return (
    <div className="group border rounded-lg p-3 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch size={14} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{wt.name}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
          wt.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          'bg-muted text-muted-foreground'
        }`}>
          {t(`card.${wt.status}`)}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        <span className="inline-flex items-center gap-0.5">
          <GitBranch size={10} />
          {wt.branch}
        </span>
      </div>
      {wt.agentId && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {t('card.agent')}: {wt.agentId}
        </div>
      )}
      {wt.issueId && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {t('card.issue')}: {wt.issueId}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleSwitch}>
          <ArrowRightLeft size={12} className="mr-1" />
          {t('card.switch')}
        </Button>
        {!wt.prUrl && (
          <>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleDiff}>
              <FileDiff size={12} className="mr-1" />
              {t('card.diff')}
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleCreatePR} disabled={prLoading}>
              <GitPullRequest size={12} className="mr-1" />
              {prLoading ? '...' : t('card.createPR')}
            </Button>
          </>
        )}
        {wt.prUrl && (
          <>
            <Button variant="outline" size="sm" className="h-6 text-xs" asChild>
              <a href={wt.prUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={12} className="mr-1" />
                {t('card.viewPR')}
              </a>
            </Button>
            <Button variant="default" size="sm" className="h-6 text-xs" onClick={handleMerge} disabled={mergeLoading}>
              {mergeLoading ? '...' : t('card.merge')}
            </Button>
          </>
        )}
        {!wt.prUrl && (
          <Button
            variant="ghost" size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
            onClick={handleDelete}
          >
            <Trash2 size={12} />
          </Button>
        )}
      </div>
      {showDiff && diffContent !== null && (
        <pre className="text-[11px] bg-muted/50 rounded px-2 py-1 mt-2 max-h-40 overflow-auto whitespace-pre font-mono">
          {diffContent || '(No changes)'}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 create-worktree-dialog.tsx**

```tsx
// packages/web/src/components/worktree/create-worktree-dialog.tsx
"use client";

import { useState } from "react";
import { useWorktreeStore } from "@/stores/worktree";
import { useAgentStore } from "@/stores/agent";
import { useIssueStore } from "@/stores/issue";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function CreateWorktreeDialog({ open, onOpenChange, workspaceId }: CreateWorktreeDialogProps) {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const create = useWorktreeStore((s) => s.create);
  const agents = useAgentStore((s) => s.agents);
  const issues = useIssueStore((s) => s.issues);
  const t = useTranslations('worktree');

  const handleSubmit = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await create(workspaceId, {
        name,
        branch: branch || undefined,
        agentId: agentId || undefined,
      });
      setName('');
      setBranch('');
      setAgentId('');
      onOpenChange(false);
    } catch {
      // store 不处理错误，这里也可以加 toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialog.createTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t('dialog.name')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dialog.namePlaceholder')}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('dialog.branch')}</label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={t('dialog.branchPlaceholder')}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('dialog.agent')}</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">-</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name || loading}>
            {loading ? t('dialog.creating') : t('panel.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add packages/web/src/components/worktree/ packages/web/src/stores/worktree.ts
git commit -m "feat(web): add worktree panel, card, dialog components and store"
```

---

## Task 8: 集成到 Workspace Shell + Sidebar 过滤

**Files:**
- Modify: `packages/web/src/components/layout/workspace-shell.tsx:112-119`（defaultJson borders）
- Modify: `packages/web/src/components/layout/workspace-shell.tsx:428-463`（factory switch）
- Modify: `packages/web/src/components/sidebar/app-sidebar.tsx:365`（workspaces.filter）
- Modify: `packages/web/src/components/layout/workspace-tabs.tsx:34`（workspaces.map）

- [ ] **Step 1: 在 defaultJson 中添加 Worktrees tab**

在 `packages/web/src/components/layout/workspace-shell.tsx` 第 119 行（Favorites tab 之后）添加：

```typescript
{ type: "tab", name: "Worktrees", component: "worktree-panel", id: "worktree-panel" },
```

- [ ] **Step 2: 在 factory 中注册 worktree-panel 组件**

在 `packages/web/src/components/layout/workspace-shell.tsx` 的 factory switch（约第 451 行 `case "code-favorites"` 之后）添加：

```typescript
case "worktree-panel":
  return <WorktreePanel workspaceId={workspaceId} />;
```

同时添加 import：

```typescript
import { WorktreePanel } from "@/components/worktree/worktree-panel";
```

- [ ] **Step 3: 在 layout 加载时确保 bottom border 有 worktree-panel tab**

在 `packages/web/src/components/layout/workspace-shell.tsx` 中，找到现有的 bottom border 检查逻辑（约第 183 行，检查 `code-favorites` tab），在其后面添加类似的 worktree-panel 检查：

在 `if (bottom && !bottom.children.some(...))` 的 code-favorites 检查之后添加：

```typescript
if (bottom && !bottom.children.some((c) => { const t = c as Record<string, unknown>; return t.id === 'worktree-panel' || t.component === 'worktree-panel'; })) {
  bottom.children.push({ type: 'tab', name: 'Worktrees', component: 'worktree-panel', id: 'worktree-panel' });
}
```

- [ ] **Step 4: Sidebar 过滤 isWorktree**

在 `packages/web/src/components/sidebar/app-sidebar.tsx` 中，找到第 365 行的 `...workspaces.map(...)` 调用，将 `workspaces` 替换为过滤后的版本：

将：
```typescript
...workspaces.map((ws) => ({
```
改为：
```typescript
...workspaces.filter(ws => !ws.isWorktree).map((ws) => ({
```

- [ ] **Step 5: Workspace Tabs 过滤 isWorktree**

在 `packages/web/src/components/layout/workspace-tabs.tsx` 中，找到第 34 行的 `{workspaces.map((ws) => (` 改为：

```typescript
{workspaces.filter(ws => !ws.isWorktree).map((ws) => (
```

- [ ] **Step 6: 验证编译**

Run: `cd /Users/Zhuanz/Documents/agent_spaces/packages/web && npx tsc --noEmit 2>&1 | head -20`
Expected: 无类型错误

- [ ] **Step 7: 提交**

```bash
git add packages/web/src/components/layout/workspace-shell.tsx packages/web/src/components/sidebar/app-sidebar.tsx packages/web/src/components/layout/workspace-tabs.tsx
git commit -m "feat(web): integrate worktree panel into workspace shell, filter from sidebar/tabs"
```

---

## Task 9: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/Zhuanz/Documents/agent_spaces && pnpm dev`

- [ ] **Step 2: 手动测试流程**

1. 打开 `http://localhost:3000`，进入一个已有 workspace
2. 在底部 Tab 栏应看到 "Worktrees" tab
3. 点击进入，看到空态 + 创建按钮
4. 点击创建，填写名称，提交
5. 验证卡片出现，显示分支名和操作按钮
6. 点击「切换」验证路由跳转到 worktree workspace
7. 验证 sidebar 和 workspace-tabs 中不显示 worktree workspace
8. 点击浏览器的 back 或在 worktree 中切回主 workspace
9. 点击「审查 Diff」验证 diff 展示
10. 点击「删除」验证 worktree 清理

- [ ] **Step 3: 提交最终修复**

如有编译或运行时问题，修复后提交。

```bash
git add -A
git commit -m "fix: worktree integration adjustments"
```

---

## 自检清单

**Spec 覆盖：**
- [x] WorktreeInfo 类型定义 → Task 1
- [x] Workspace isWorktree/parentWorkspaceId → Task 1
- [x] WebSocket 事件 → Task 1 (types) + Task 3 (service broadcasts)
- [x] 后端 JSON 存储 → Task 2
- [x] 后端 7 个 API 端点 → Task 3 + Task 4
- [x] 前端 Store → Task 6
- [x] WorktreePanel 卡片布局 → Task 7
- [x] WorktreeCard 操作状态机 → Task 7
- [x] CreateWorktreeDialog → Task 7
- [x] 底部 Tab 注册 → Task 8
- [x] Sidebar/Tabs 过滤 → Task 8
- [x] i18n → Task 5
- [ ] Issue 创建对话框开关 — 未在本次实施范围（独立迭代）
- [ ] Issue 自动化 worktree 集成 — 未在本次实施范围（独立迭代）

**Note:** Issue 自动化集成（edit-issue-dialog 开关 + issue-task-controller 自动创建 worktree）作为独立迭代，在核心 worktree 功能稳定后再添加。
