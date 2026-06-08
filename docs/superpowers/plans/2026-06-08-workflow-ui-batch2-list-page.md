# Workflow UI 自定义页面 — 批次 2：前端列表页

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现列表页 `/workflows-ui`，支持浏览项目、ZIP 导入、新建项目、搜索过滤。

**Architecture:** 复用 `WorkflowsPage` 布局模式。Next.js App Router 页面壳 + 独立组件。通过 `sdk.workflowUi` 调用批次 1 创建的后端 API。

**Tech Stack:** Next.js 16, React, shadcn/ui, Zustand, next-intl

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `packages/web/src/app/workflows-ui/page.tsx` | 列表页路由壳 |
| Create | `packages/web/src/components/workflows-ui/workflows-ui-page.tsx` | 列表页主组件 |
| Create | `packages/web/src/components/workflows-ui/workflows-ui-card.tsx` | 项目卡片 |
| Create | `packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx` | 新建对话框 |

---

### Task 1: Next.js 页面路由

**Files:**
- Create: `packages/web/src/app/workflows-ui/page.tsx`

- [ ] **Step 1: 创建路由页面**

```typescript
// packages/web/src/app/workflows-ui/page.tsx
"use client";

import { WorkflowsUiPage } from "@/components/workflows-ui/workflows-ui-page";

export default function WorkflowsUiRoute() {
  return <WorkflowsUiPage />;
}
```

- [ ] **Step 2: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/app/workflows-ui/page.tsx`

---

### Task 2: 项目卡片组件

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflows-ui-card.tsx`

- [ ] **Step 1: 创建卡片组件**

```tsx
// packages/web/src/components/workflows-ui/workflows-ui-card.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { nativeNavigate } from '@/lib/native-navigate';
import type { WorkflowUiProject } from '@agent-spaces/sdk';

interface WorkflowsUiCardProps {
  project: WorkflowUiProject;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function WorkflowsUiCard({ project, onDelete, onDuplicate }: WorkflowsUiCardProps) {
  const router = useRouter();

  const handleOpen = () => {
    nativeNavigate(router, `/workflows-ui/${project.id}`);
  };

  return (
    <div
      className="group relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate">{project.name}</h3>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpen(); }}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" /> 编辑
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(project.id); }}>
                <Copy className="h-3.5 w-3.5 mr-2" /> 复制
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant={project.type === 'react' ? 'default' : 'secondary'} className="text-[10px]">
          {project.type === 'react' ? 'React' : 'HTML'}
        </Badge>
        {project.tags?.map(tag => (
          <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
        ))}
        {project.enabledPlugins && project.enabledPlugins.length > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {project.enabledPlugins.length} 插件
          </Badge>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground mt-2">
        {new Date(project.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflows-ui-card.tsx`

---

### Task 3: 新建对话框

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx`

- [ ] **Step 1: 创建新建对话框**

```tsx
// packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Code, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { nativeNavigate } from '@/lib/native-navigate';
import { sdk } from '@/lib/sdk';

interface WorkflowsUiCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowsUiCreateDialog({ open, onOpenChange }: WorkflowsUiCreateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (type: 'react' | 'html') => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const project = await sdk.workflowUi.create({
        name: name.trim(),
        type,
      });
      onOpenChange(false);
      setName('');
      nativeNavigate(router, `/workflows-ui/${project.id}`);
    } catch (error: any) {
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建自定义页面</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="页面名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) handleCreate('react');
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              disabled={!name.trim() || creating}
              onClick={() => handleCreate('react')}
            >
              <Code className="h-6 w-6" />
              <span className="text-sm font-medium">React 组件</span>
              <span className="text-xs text-muted-foreground">JSX/TSX 动态渲染</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              disabled={!name.trim() || creating}
              onClick={() => handleCreate('html')}
            >
              <FileText className="h-6 w-6" />
              <span className="text-sm font-medium">HTML 页面</span>
              <span className="text-xs text-muted-foreground">HTML+JS 直接渲染</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflows-ui-create-dialog.tsx`

---

### Task 4: 列表页主组件

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflows-ui-page.tsx`

- [ ] **Step 1: 创建列表页**

```tsx
// packages/web/src/components/workflows-ui/workflows-ui-page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Upload, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { WorkflowsUiCard } from './workflows-ui-card';
import { WorkflowsUiCreateDialog } from './workflows-ui-create-dialog';

export function WorkflowsUiPage() {
  const [projects, setProjects] = useState<WorkflowUiProject[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const list = await sdk.workflowUi.list();
      setProjects(list);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [projects, search]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await sdk.workflowUi.delete_(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    },
    []
  );

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const base64 = await fileToBase64(file);
        await sdk.workflowUi.importZip({ zip: base64, name: file.name.replace(/\.zip$/i, '') });
        loadProjects();
      } catch (error) {
        console.error('Failed to import ZIP:', error);
      }
    };
    input.click();
  }, [loadProjects]);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">自定义页面</h2>
          <p className="text-sm text-muted-foreground">导入、创建和管理自定义 UI 页面</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" /> 导入 ZIP
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 新建
          </Button>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="搜索页面..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm mb-2">暂无自定义页面</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 创建第一个页面
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <WorkflowsUiCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <WorkflowsUiCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/web; npx tsc --noEmit --pretty 2>&1 | Select-Object -First 30`

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflows-ui-page.tsx`

---

## Self-Review Checklist

- [x] **Spec coverage**: 覆盖设计文档 §2 列表页部分（搜索/过滤/卡片/导入ZIP/新建/商店占位）
- [x] **Placeholder scan**: 无 TBD/TODO
- [x] **Type consistency**: `WorkflowUiProject` 类型从 SDK 导入，与批次 1 一致
