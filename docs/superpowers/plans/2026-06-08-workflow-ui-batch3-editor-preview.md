# Workflow UI 自定义页面 — 批次 3：编辑器 + 预览 + 组件导出

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现编辑页 `/workflows-ui/[id]`，左侧 Monaco 代码编辑器 + 右侧实时预览（React Babel 编译 + HTML 直接渲染）+ 通用 UI 组件导出文件。

**Architecture:** 三区布局（编辑器 | 预览+工具栏 | 状态栏）。`ui-exports.ts` 暴露宿主组件到 `window.AgentSpacesUI`。React 模式用 `@babel/standalone` 编译 JSX → `new Function()` 渲染。HTML 模式用 `dangerouslySetInnerHTML` + eval script。

**Tech Stack:** textarea MVP, @babel/standalone, React. Monaco/resizable-panels are deferred to a later batch.

**Scope Note:** This batch intentionally does not implement Monaco. Do not claim Monaco support in acceptance criteria until a separate Monaco integration task replaces the textarea.

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `packages/web/src/lib/ui-exports.ts` | 通用 UI 组件统一导出 |
| Create | `packages/web/src/app/workflows-ui/[id]/page.tsx` | 编辑页路由壳（server component） |
| Create | `packages/web/src/app/workflows-ui/[id]/workflow-ui-editor-page-client.tsx` | 编辑页 client component |
| Create | `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx` | 主编辑器组件 |
| Create | `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx` | 预览区（React 编译 + HTML 渲染） |
| Create | `packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx` | 预览工具栏 |

---

### Task 1: 通用 UI 组件导出文件

**Files:**
- Create: `packages/web/src/lib/ui-exports.ts`

- [ ] **Step 1: 创建组件导出文件**

```typescript
// packages/web/src/lib/ui-exports.ts
// 将 components/ui 下的通用组件统一导出
// 运行时挂载到 window.AgentSpacesUI 供导入的 UI 文件使用

export { Button, buttonVariants } from '@/components/ui/button';
export { Input } from '@/components/ui/input';
export { Badge, badgeVariants } from '@/components/ui/badge';
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
export { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
export { Separator } from '@/components/ui/separator';
export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
export { Switch } from '@/components/ui/switch';
export { Slider } from '@/components/ui/slider';
export { Progress } from '@/components/ui/progress';
export { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export { Checkbox } from '@/components/ui/checkbox';
export { Textarea } from '@/components/ui/textarea';
export { Label } from '@/components/ui/label';
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
export { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
export { Skeleton } from '@/components/ui/skeleton';
export { Toggle, toggleVariants } from '@/components/ui/toggle';
export { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/web; npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "ui-exports" -CaseSensitive:$false; if (-not $?) { "OK" }`

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/lib/ui-exports.ts`

---

### Task 2: 编辑页路由

**Files:**
- Create: `packages/web/src/app/workflows-ui/[id]/page.tsx`
- Create: `packages/web/src/app/workflows-ui/[id]/workflow-ui-editor-page-client.tsx`

- [ ] **Step 1: 创建 server component 路由壳**

```typescript
// packages/web/src/app/workflows-ui/[id]/page.tsx
import WorkflowUiEditorPageClient from './workflow-ui-editor-page-client';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function WorkflowUiEditorPage() {
  return <WorkflowUiEditorPageClient />;
}
```

- [ ] **Step 2: 创建 client component 壳**

```tsx
// packages/web/src/app/workflows-ui/[id]/workflow-ui-editor-page-client.tsx
"use client";

import { useParams } from 'next/navigation';
import { WorkflowUiEditor } from '@/components/workflows-ui/workflow-ui-editor';

export default function WorkflowUiEditorPageClient() {
  const params = useParams<{ id: string }>();
  return <WorkflowUiEditor projectId={params.id} />;
}
```

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/app/workflows-ui/[id]/page.tsx "packages/web/src/app/workflows-ui/[id]/workflow-ui-editor-page-client.tsx"`

---

### Task 3: 预览区组件

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx`

- [ ] **Step 1: 安装 @babel/standalone 依赖**

Run: `cd packages/web && pnpm add @babel/standalone`

- [ ] **Step 2: 创建预览组件**

```tsx
// packages/web/src/components/workflows-ui/workflow-ui-preview.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import React from 'react';
import ReactDOM from 'react-dom/client';

interface WorkflowUiPreviewProps {
  type: 'react' | 'html';
  sourceCode: string;
  error: string | null;
  onError: (error: string | null) => void;
}

export function WorkflowUiPreview({ type, sourceCode, error, onError }: WorkflowUiPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

  // React 模式：Babel 编译 + 渲染
  const renderReact = useCallback((code: string) => {
    if (!containerRef.current) return;

    // 清理之前的渲染
    if (rootRef.current) {
      try { rootRef.current.unmount(); } catch { /* ignore */ }
      rootRef.current = null;
    }
    containerRef.current.innerHTML = '';

    try {
      // @ts-ignore — @babel/standalone 运行时
      const Babel = window.Babel ?? require('@babel/standalone');
      const compiled = Babel.transform(code, {
        presets: ['react'],
        filename: 'preview.jsx',
      }).code;

      // 用 new Function 执行，注入 React 和 UI 组件
      const moduleExports: Record<string, any> = {};
      const fn = new Function(
        'React', 'ReactDOM', 'exports', 'require',
        compiled!
      );
      fn(React, ReactDOM, moduleExports, (id: string) => {
        if (id === 'react') return React;
        if (id === 'react-dom') return ReactDOM;
        return null;
      });

      const Component = moduleExports.default;
      if (!Component) {
        onError('入口文件必须 export default 一个 React 组件');
        return;
      }

      rootRef.current = ReactDOM.createRoot(containerRef.current);
      rootRef.current.render(React.createElement(Component));
      onError(null);
    } catch (err: any) {
      onError(err.message || String(err));
    }
  }, [onError]);

  // HTML 模式：直接渲染 + eval script
  const renderHtml = useCallback((html: string) => {
    if (!containerRef.current) return;

    // 提取 script 标签
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts: string[] = [];
    const cleanHtml = html.replace(scriptRegex, (_match, content) => {
      scripts.push(content);
      return '';
    });

    containerRef.current.innerHTML = cleanHtml;

    // 执行 script
    for (const script of scripts) {
      try {
        // eslint-disable-next-line no-eval
        eval(script);
      } catch (err: any) {
        onError(`Script error: ${err.message}`);
        return;
      }
    }
    onError(null);
  }, [onError]);

  // 源码变化时重新渲染
  useEffect(() => {
    if (!sourceCode) return;
    if (type === 'react') {
      renderReact(sourceCode);
    } else {
      renderHtml(sourceCode);
    }
  }, [sourceCode, type, renderReact, renderHtml]);

  // 清理
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        try { rootRef.current.unmount(); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <div className="relative h-full">
      {error && (
        <div className="absolute inset-x-0 top-0 z-10 bg-destructive/10 border-b border-destructive/30 p-2 text-xs text-destructive font-mono whitespace-pre-wrap max-h-32 overflow-auto">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full overflow-auto p-4"
      />
    </div>
  );
}
```

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflow-ui-preview.tsx package.json pnpm-lock.yaml`

---

### Task 4: 预览工具栏

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx`

- [ ] **Step 1: 创建工具栏**

```tsx
// packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx
"use client";

import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface WorkflowUiPreviewToolbarProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (auto: boolean) => void;
  onRefresh: () => void;
}

export function WorkflowUiPreviewToolbar({
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
}: WorkflowUiPreviewToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <Switch
          id="auto-refresh"
          checked={autoRefresh}
          onCheckedChange={onAutoRefreshChange}
          className="scale-75"
        />
        <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
          <Zap className="h-3 w-3 inline mr-1" />
          自动预览
        </Label>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs"
        onClick={onRefresh}
      >
        <RefreshCw className="h-3 w-3 mr-1" /> 刷新
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflow-ui-preview-toolbar.tsx`

---

### Task 5: 主编辑器组件

**Files:**
- Create: `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

- [ ] **Step 1: 创建主编辑器**

```tsx
// packages/web/src/components/workflows-ui/workflow-ui-editor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import * as AgentSpacesUI from '@/lib/ui-exports';
import { WorkflowUiPreview } from './workflow-ui-preview';
import { WorkflowUiPreviewToolbar } from './workflow-ui-preview-toolbar';

interface WorkflowUiEditorProps {
  projectId: string;
}

export function WorkflowUiEditor({ projectId }: WorkflowUiEditorProps) {
  const [project, setProject] = useState<WorkflowUiProject | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [sourceCode, setSourceCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 挂载 window.AgentSpacesUI
  useEffect(() => {
    (window as any).AgentSpacesUI = AgentSpacesUI;
    (window as any).AgentSpacesAPI = {};
    return () => {
      delete (window as any).AgentSpacesUI;
      delete (window as any).AgentSpacesAPI;
    };
  }, []);

  // 加载项目
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await sdk.workflowUi.get(projectId);
        const tree = await sdk.workflowUi.getFileTree(projectId);
        if (cancelled) return;
        setProject(p);
        setFiles(tree);
        if (tree.length > 0) {
          const mainFile = tree.includes(p.mainFile) ? p.mainFile : tree[0];
          setActiveFile(mainFile);
          const { content } = await sdk.workflowUi.readFile(projectId, mainFile);
          if (!cancelled) {
            setSourceCode(content);
            setPreviewCode(content);
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  // 自动预览 debounce
  useEffect(() => {
    if (!autoRefresh) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewCode(sourceCode);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceCode, autoRefresh]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [projectId, activeFile, sourceCode]);

  const handleManualRefresh = useCallback(() => {
    setPreviewCode(sourceCode);
  }, [sourceCode]);

  const handleFileSelect = useCallback(async (file: string) => {
    // 保存当前文件
    if (activeFile && sourceCode) {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode).catch(() => {});
    }
    try {
      const { content } = await sdk.workflowUi.readFile(projectId, file);
      setActiveFile(file);
      setSourceCode(content);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }, [projectId, activeFile, sourceCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-4 text-muted-foreground">项目不存在</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 主内容区 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧：文件树 + 编辑器 */}
        <div className="w-80 border-r border-border flex flex-col shrink-0">
          {/* 文件树 */}
          <div className="border-b border-border p-2 max-h-48 overflow-auto">
            <div className="text-xs font-medium text-muted-foreground mb-1">文件</div>
            {files.map((file) => (
              <button
                key={file}
                className={`w-full text-left px-2 py-1 text-xs rounded cursor-pointer ${
                  file === activeFile ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => handleFileSelect(file)}
              >
                {file}
              </button>
            ))}
          </div>
          {/* 代码编辑器（简化版 textarea，后续可替换为 Monaco） */}
          <div className="flex-1 min-h-0">
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl+S 保存
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className="w-full h-full resize-none border-none outline-none p-3 font-mono text-xs bg-background"
              spellCheck={false}
            />
          </div>
        </div>

        {/* 右侧：预览 */}
        <div className="flex-1 flex flex-col min-h-0">
          <WorkflowUiPreview
            type={project.type}
            sourceCode={previewCode}
            error={previewError}
            onError={setPreviewError}
          />
          <WorkflowUiPreviewToolbar
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            onRefresh={handleManualRefresh}
          />
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center gap-4 px-3 py-1 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span>{project.name}</span>
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          {project.type === 'react' ? 'React' : 'HTML'}
        </span>
        <span>{files.length} 文件</span>
        <span className="ml-auto">{activeFile}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `cd packages/web; npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "workflow-ui-editor\|ui-exports" -CaseSensitive:$false; if (-not $?) { "OK" }`

- [ ] **Step 3: Report changed files**

Record changed files and verification result in the final response. Do not run `git commit`.
Changed files: `packages/web/src/components/workflows-ui/workflow-ui-editor.tsx`

---

## Self-Review Checklist

- [x] **Spec coverage**: 覆盖 §2 编辑页 + §3 通用组件导出 + 动态编译
- [x] **Placeholder scan**: 无 TBD/TODO
- [x] **Type consistency**: `WorkflowUiProject` 从 SDK 导入；`AgentSpacesUI` 注入模式与设计一致
- [x] **Note**: 编辑器当前用 textarea，后续可替换为 Monaco。这是有意简化，避免在 MVP 阶段引入 Monaco 集成的复杂度
