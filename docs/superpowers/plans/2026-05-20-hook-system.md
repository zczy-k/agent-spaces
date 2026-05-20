# Hook System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-tool-call hook system that fires custom actions (shell command, webhook, script) before and after each tool invocation during agent execution.

**Architecture:** Plan A — intercept `AgentRuntimeEvent` at the `onEvent` callback layer via a `wrapOnEventWithHooks()` utility. No changes to `AgentRuntime` interface. Hooks stored as individual `.hook.json` files per workspace. Frontend provides CRUD dialog + workspace toggle.

**Tech Stack:** TypeScript, Express 5, Node.js `child_process.exec`, `fetch`, Zustand, Monaco Editor, shadcn/ui Dialog

**Spec:** `docs/superpowers/specs/2026-05-20-hook-system-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/types/hooks.ts` | HookConfig, HookRule types |
| Modify | `packages/shared/src/types/index.ts` | Add `export * from './hooks.js'` |
| Modify | `packages/shared/src/types/workspace.ts` | Add `hooksEnabled?: boolean` to Workspace |
| Create | `packages/server/src/storage/hook-store.ts` | Hook file CRUD (list/get/save/delete/upload/apply) |
| Create | `packages/server/src/services/hook-engine.ts` | HookEngine class + wrapOnEventWithHooks |
| Create | `packages/server/src/routes/hooks.ts` | 7 REST endpoints |
| Modify | `packages/server/src/app.ts` | Register hooks router |
| Modify | `packages/server/src/ws/agent-runner.ts` | Wrap onEvent with hooks |
| Modify | `packages/server/src/routes/agent-sse.ts` | Wrap onEvent with hooks |
| Modify | `packages/server/src/agents/issue-task-controller.ts` | Wrap onEvent with hooks |
| Create | `packages/web/src/stores/hooks.ts` | Zustand store for hook CRUD |
| Create | `packages/web/src/components/sidebar/hooks-dialog.tsx` | Hook management dialog |
| Modify | `packages/web/src/components/sidebar/app-sidebar.tsx` | Add Hooks nav entry + dialog |
| Modify | `packages/web/src/components/settings/workspace-info-section.tsx` | Add hooksEnabled toggle |

---

### Task 1: Shared types

**Files:**
- Create: `packages/shared/src/types/hooks.ts`
- Modify: `packages/shared/src/types/index.ts:18` (after code-favorites export)
- Modify: `packages/shared/src/types/workspace.ts:16` (after notificationSettings)

- [ ] **Step 1: Create `packages/shared/src/types/hooks.ts`**

```typescript
export interface HookConfig {
  name: string;
  description?: string;
  enabled: boolean;
  hooks: {
    PreToolUse?: HookRule[];
    PostToolUse?: HookRule[];
  };
}

export interface HookRule {
  matcher: string;
  type: 'command' | 'webhook' | 'script';
  command?: string;
  url?: string;
  function?: string;
  timeout?: number;
}
```

- [ ] **Step 2: Add export to `packages/shared/src/types/index.ts`**

Append after line 17 (`export * from './code-favorites.js';`):

```typescript
export * from './hooks.js';
```

- [ ] **Step 3: Add `hooksEnabled` to Workspace in `packages/shared/src/types/workspace.ts`**

After line 16 (`notificationSettings?: WorkspaceNotificationSettings;`), add:

```typescript
  hooksEnabled?: boolean;
```

- [ ] **Step 4: Build shared package**

Run: `cd packages/shared && pnpm build`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/hooks.ts packages/shared/src/types/index.ts packages/shared/src/types/workspace.ts
git commit -m "feat(shared): add HookConfig/HookRule types and hooksEnabled on Workspace"
```

---

### Task 2: HookStore — file persistence

**Files:**
- Create: `packages/server/src/storage/hook-store.ts`

- [ ] **Step 1: Create `packages/server/src/storage/hook-store.ts`**

```typescript
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import type { HookConfig } from '@agent-spaces/shared';
import { getDataDir, ensureDir, readJsonFile, writeJsonFile, deleteFile } from './json-store.js';

function workspaceDir(id: string) {
  return join(getDataDir(), 'workspaces', id);
}

function hooksDir(wsId: string) {
  return join(workspaceDir(wsId), 'hooks');
}

function hookPath(wsId: string, name: string) {
  return join(hooksDir(wsId), `${name}.hook.json`);
}

export function listHooks(wsId: string): HookConfig[] {
  const dir = hooksDir(wsId);
  try {
    const files = readdirSync(dir);
    return files
      .filter(f => f.endsWith('.hook.json'))
      .map(f => readJsonFile<HookConfig>(join(dir, f)))
      .filter((h): h is HookConfig => h !== null);
  } catch {
    return [];
  }
}

export function getHook(wsId: string, name: string): HookConfig | null {
  return readJsonFile<HookConfig>(hookPath(wsId, name));
}

export function saveHook(wsId: string, config: HookConfig): void {
  ensureDir(hooksDir(wsId));
  writeJsonFile(hookPath(wsId, config.name), config);
}

export function deleteHook(wsId: string, name: string): void {
  deleteFile(hookPath(wsId, name));
}

export function uploadHook(wsId: string, jsonString: string): HookConfig {
  const parsed = JSON.parse(jsonString);
  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Hook must have a "name" string field');
  }
  if (!parsed.hooks || typeof parsed.hooks !== 'object') {
    parsed.hooks = { PreToolUse: [], PostToolUse: [] };
  }
  if (parsed.enabled === undefined) parsed.enabled = true;
  saveHook(wsId, parsed as HookConfig);
  return parsed as HookConfig;
}

export function applyToWorkspace(sourceWsId: string, name: string, targetWsId: string): void {
  const config = getHook(sourceWsId, name);
  if (!config) throw new Error(`Hook "${name}" not found in workspace ${sourceWsId}`);
  saveHook(targetWsId, config);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/storage/hook-store.ts
git commit -m "feat(server): add HookStore for per-workspace hook file CRUD"
```

---

### Task 3: HookEngine — matching and execution

**Files:**
- Create: `packages/server/src/services/hook-engine.ts`

- [ ] **Step 1: Create `packages/server/src/services/hook-engine.ts`**

```typescript
import { exec } from 'node:child_process';
import type { HookConfig, HookRule } from '@agent-spaces/shared';
import type { AgentRuntimeEvent } from '../adapters/agent-runtime-types.js';
import { listHooks } from '../storage/hook-store.js';

function matchToolName(matcher: string, toolName: string): boolean {
  if (matcher === '*') return true;
  if (matcher.startsWith('/') && matcher.endsWith('/')) {
    try {
      const regex = new RegExp(matcher.slice(1, -1));
      return regex.test(toolName);
    } catch {
      return matcher === toolName;
    }
  }
  return matcher === toolName;
}

function executeCommand(
  command: string,
  env: Record<string, string>,
  timeout: number,
): Promise<void> {
  return new Promise((resolve) => {
    exec(command, { env: { ...process.env, ...env }, timeout: Math.min(timeout, 30000) }, (error) => {
      if (error) console.warn(`[HookEngine] command error: ${error.message}`);
      resolve();
    });
  });
}

async function executeWebhook(
  url: string,
  body: Record<string, unknown>,
  timeout: number,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, 30000));
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (error: any) {
    console.warn(`[HookEngine] webhook error: ${error.message}`);
  }
}

async function executeRule(
  rule: HookRule,
  phase: 'PreToolUse' | 'PostToolUse',
  toolName: string,
  workspaceId: string,
  context: { toolInput?: unknown; toolResult?: unknown },
): Promise<void> {
  const timeout = rule.timeout ?? 10000;

  if (rule.type === 'command' && rule.command) {
    await executeCommand(rule.command, {
      HOOK_TOOL_NAME: toolName,
      HOOK_TOOL_INPUT: JSON.stringify(context.toolInput ?? {}),
      HOOK_TOOL_RESULT: JSON.stringify(context.toolResult ?? ''),
      HOOK_WORKSPACE_ID: workspaceId,
      HOOK_PHASE: phase,
    }, timeout);
  } else if (rule.type === 'webhook' && rule.url) {
    await executeWebhook(rule.url, {
      event: phase,
      toolName,
      toolInput: context.toolInput,
      toolResult: context.toolResult ?? undefined,
      timestamp: new Date().toISOString(),
      workspaceId,
    }, timeout);
  } else if (rule.type === 'script') {
    console.warn(`[HookEngine] script type not implemented, skipping rule in ${phase}`);
  }
}

export class HookEngine {
  private hooks: HookConfig[] = [];
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  load(): void {
    this.hooks = listHooks(this.workspaceId);
  }

  reload(): void {
    this.load();
  }

  getHooks(): HookConfig[] {
    return this.hooks;
  }

  async executeHooks(
    phase: 'PreToolUse' | 'PostToolUse',
    toolName: string,
    context: { toolInput?: unknown; toolResult?: unknown },
  ): Promise<void> {
    const enabledHooks = this.hooks.filter(h => h.enabled);
    const promises: Promise<void>[] = [];

    for (const hook of enabledHooks) {
      const rules = hook.hooks[phase];
      if (!rules) continue;
      for (const rule of rules) {
        if (matchToolName(rule.matcher, toolName)) {
          promises.push(executeRule(rule, phase, toolName, this.workspaceId, context));
        }
      }
    }

    await Promise.allSettled(promises);
  }
}

export function wrapOnEventWithHooks(
  onEvent: (event: AgentRuntimeEvent) => void,
  workspaceId: string,
  hooksEnabled: boolean | undefined,
): (event: AgentRuntimeEvent) => void {
  if (!hooksEnabled) return onEvent;

  const engine = new HookEngine(workspaceId);
  engine.load();

  return (event: AgentRuntimeEvent) => {
    onEvent(event);
    if (event.type === 'tool_use') {
      engine.executeHooks('PreToolUse', event.name, { toolInput: event.input });
    }
    if (event.type === 'tool_result') {
      engine.executeHooks('PostToolUse', event.name, { toolResult: event.result });
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/hook-engine.ts
git commit -m "feat(server): add HookEngine with matcher, command/webhook execution, wrapOnEventWithHooks"
```

---

### Task 4: REST API routes

**Files:**
- Create: `packages/server/src/routes/hooks.ts`
- Modify: `packages/server/src/app.ts` (add import + router registration)

- [ ] **Step 1: Create `packages/server/src/routes/hooks.ts`**

Follow the same pattern as `routes/code-favorites.ts` — `Router({ mergeParams: true })`, service imports, minimal validation.

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import * as store from '../storage/hook-store.js';

const router = Router({ mergeParams: true });

router.get('/', (req: Request<{ id: string }>, res: Response) => {
  try {
    res.json(store.listHooks(req.params.id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:name', (req: Request<{ id: string; name: string }>, res: Response) => {
  try {
    const hook = store.getHook(req.params.id, req.params.name);
    if (!hook) { res.status(404).json({ error: 'Hook not found' }); return; }
    res.json(hook);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req: Request<{ id: string }>, res: Response) => {
  try {
    const config = req.body;
    if (!config.name) { res.status(400).json({ error: 'name required' }); return; }
    store.saveHook(req.params.id, config);
    res.status(201).json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:name', (req: Request<{ id: string; name: string }>, res: Response) => {
  try {
    const config = req.body;
    config.name = req.params.name;
    store.saveHook(req.params.id, config);
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:name', (req: Request<{ id: string; name: string }>, res: Response) => {
  try {
    store.deleteHook(req.params.id, req.params.name);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/upload', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content (string) required' });
      return;
    }
    const config = store.uploadHook(req.params.id, content);
    res.status(201).json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:name/apply', (req: Request<{ id: string; name: string }>, res: Response) => {
  try {
    const { targetWorkspaceId } = req.body;
    if (!targetWorkspaceId) {
      res.status(400).json({ error: 'targetWorkspaceId required' });
      return;
    }
    store.applyToWorkspace(req.params.id, req.params.name, targetWorkspaceId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

- [ ] **Step 2: Register in `packages/server/src/app.ts`**

Add import near line 34 (after the last router import):

```typescript
import hooksRouter from './routes/hooks.js';
```

Add router registration near line 132 (after codeFavoritesRouter, before agents):

```typescript
app.use('/api/workspaces/:id/hooks', hooksRouter);
```

- [ ] **Step 3: Verify server compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/routes/hooks.ts packages/server/src/app.ts
git commit -m "feat(server): add hooks REST API (7 endpoints) and register in app.ts"
```

---

### Task 5: Integrate wrapOnEventWithHooks at 3 entry points

**Files:**
- Modify: `packages/server/src/ws/agent-runner.ts`
- Modify: `packages/server/src/routes/agent-sse.ts`
- Modify: `packages/server/src/agents/issue-task-controller.ts`

- [ ] **Step 1: Modify `packages/server/src/ws/agent-runner.ts`**

Add import at top (near line 10, with other service imports):

```typescript
import { wrapOnEventWithHooks } from '../services/hook-engine.js';
```

Find the `onEvent` callback in `runtime.execute()` (around line 375). The `onEvent` is defined inline. Wrap it:

Before the `runtime.execute()` call (around line 367), get the workspace config:

```typescript
const workspace = wsService.getById(workspaceId);
```

(This may already exist at line 219 — reuse it if so. The variable `workspace` is already available in scope.)

Then wrap the `onEvent` option. Change:

```typescript
onEvent: (event) => {
```

To:

```typescript
onEvent: wrapOnEventWithHooks((event) => {
```

And at the end of the onEvent callback (around line 489), change the closing `},` to:

```typescript
}, workspaceId, workspace?.hooksEnabled),
```

- [ ] **Step 2: Modify `packages/server/src/routes/agent-sse.ts`**

Add import:

```typescript
import { wrapOnEventWithHooks } from '../services/hook-engine.js';
```

The workspace is already fetched at line 44: `const workspace = workspaceService.getById(workspaceId);`

The `onEvent` is at lines 122-126. Change:

```typescript
onEvent: (event) => {
  if (event.type === 'output') output.push(event.line);
  writeSse(res, event.type, serializeRuntimeEvent(event));
},
```

To:

```typescript
onEvent: wrapOnEventWithHooks((event) => {
  if (event.type === 'output') output.push(event.line);
  writeSse(res, event.type, serializeRuntimeEvent(event));
}, workspaceId, workspace?.hooksEnabled),
```

- [ ] **Step 3: Modify `packages/server/src/agents/issue-task-controller.ts`**

Add import:

```typescript
import { wrapOnEventWithHooks } from '../services/hook-engine.js';
```

There are two `runtime.execute()` calls that use tracker-based `onEvent`:

**syncIssueTasksAfterPlanning** (line 89): `onEvent: taskSyncTracker.handleEvent,`
Change to:
```typescript
onEvent: wrapOnEventWithHooks(taskSyncTracker.handleEvent.bind(taskSyncTracker), workspaceId, workspace?.hooksEnabled),
```

Add workspace fetch near line 69 (before tracker creation):
```typescript
const workspace = workspaceService.getById(workspaceId);
```

**runIssueTask** (line 257): `onEvent: agentTracker.handleEvent,`
Change to:
```typescript
onEvent: wrapOnEventWithHooks(agentTracker.handleEvent.bind(agentTracker), workspaceId, workspace?.hooksEnabled),
```

Add workspace fetch near line 230 (before tracker creation):
```typescript
const workspace = workspaceService.getById(workspaceId);
```

- [ ] **Step 4: Verify server compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/ws/agent-runner.ts packages/server/src/routes/agent-sse.ts packages/server/src/agents/issue-task-controller.ts
git commit -m "feat(server): integrate wrapOnEventWithHooks at 3 agent execution entry points"
```

---

### Task 6: Frontend — Zustand hooks store

**Files:**
- Create: `packages/web/src/stores/hooks.ts`

- [ ] **Step 1: Create `packages/web/src/stores/hooks.ts`**

Follow the pattern from `stores/notification.ts` — `create` from zustand, `fetchWithAuth` from `@/lib/auth`.

```typescript
import { create } from 'zustand';
import type { HookConfig } from '@agent-spaces/shared';
import { fetchWithAuth } from '@/lib/auth';

interface HookStore {
  hooks: HookConfig[];
  selectedName: string | null;
  loading: boolean;

  fetchHooks: (workspaceId: string) => Promise<void>;
  createHook: (workspaceId: string, name: string) => Promise<void>;
  updateHook: (workspaceId: string, name: string, config: HookConfig) => Promise<void>;
  deleteHook: (workspaceId: string, name: string) => Promise<void>;
  uploadHook: (workspaceId: string, content: string) => Promise<void>;
  applyToWorkspace: (workspaceId: string, name: string, targetWorkspaceId: string) => Promise<void>;
  setSelectedName: (name: string | null) => void;
  reset: () => void;
}

export const useHookStore = create<HookStore>((set) => ({
  hooks: [],
  selectedName: null,
  loading: false,

  fetchHooks: async (workspaceId) => {
    set({ loading: true });
    try {
      const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks`);
      const hooks: HookConfig[] = await res.json();
      set({ hooks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createHook: async (workspaceId, name) => {
    const config: HookConfig = {
      name,
      enabled: true,
      hooks: { PreToolUse: [], PostToolUse: [] },
    };
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    set((s) => ({ hooks: [...s.hooks, config], selectedName: name }));
  },

  updateHook: async (workspaceId, name, config) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    set((s) => ({
      hooks: s.hooks.map((h) => (h.name === name ? config : h)),
    }));
  },

  deleteHook: async (workspaceId, name) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}`, {
      method: 'DELETE',
    });
    set((s) => ({
      hooks: s.hooks.filter((h) => h.name !== name),
      selectedName: s.selectedName === name ? null : s.selectedName,
    }));
  },

  uploadHook: async (workspaceId, content) => {
    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const config: HookConfig = await res.json();
    set((s) => ({ hooks: [...s.hooks, config], selectedName: config.name }));
  },

  applyToWorkspace: async (workspaceId, name, targetWorkspaceId) => {
    await fetchWithAuth(`/api/workspaces/${workspaceId}/hooks/${name}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetWorkspaceId }),
    });
  },

  setSelectedName: (name) => set({ selectedName: name }),

  reset: () => set({ hooks: [], selectedName: null, loading: false }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/stores/hooks.ts
git commit -m "feat(web): add useHookStore Zustand store for hook CRUD"
```

---

### Task 7: Frontend — HooksDialog component

**Files:**
- Create: `packages/web/src/components/sidebar/hooks-dialog.tsx`

- [ ] **Step 1: Create `packages/web/src/components/sidebar/hooks-dialog.tsx`**

Follow the pattern from `mcps-dialog.tsx` — Dialog with left list + right Monaco editor, using `useHookStore` and `useWorkspaceStore`.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Upload,
  Plus,
  Trash2,
  Save,
  MoreVertical,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHookStore } from '@/stores/hooks';
import { useWorkspaceStore } from '@/stores/workspace';
import '@/lib/monaco-loader';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading editor...</div> },
);

interface HooksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
}

export function HooksDialog({ open, onOpenChange, standalone }: HooksDialogProps) {
  const t = useTranslations();
  const { hooks, selectedName, loading, fetchHooks, createHook, updateHook, deleteHook, uploadHook, applyToWorkspace, setSelectedName } = useHookStore();
  const { workspaces } = useWorkspaceStore();
  const activeWorkspaceId = workspaces[0]?.id;

  const [editorContent, setEditorContent] = useState('');
  const [newName, setNewName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open && activeWorkspaceId) fetchHooks(activeWorkspaceId);
  }, [open, activeWorkspaceId, fetchHooks]);

  const selectedHook = hooks.find((h) => h.name === selectedName);

  useEffect(() => {
    if (selectedHook) {
      setEditorContent(JSON.stringify(selectedHook, null, 2));
      setDirty(false);
    } else {
      setEditorContent('');
    }
  }, [selectedHook]);

  const handleSave = useCallback(async () => {
    if (!activeWorkspaceId || !selectedName) return;
    try {
      const parsed = JSON.parse(editorContent);
      await updateHook(activeWorkspaceId, selectedName, parsed);
      setDirty(false);
    } catch (e: any) {
      console.error('Invalid JSON:', e.message);
    }
  }, [activeWorkspaceId, selectedName, editorContent, updateHook]);

  const handleCreate = useCallback(async () => {
    if (!activeWorkspaceId || !newName.trim()) return;
    await createHook(activeWorkspaceId, newName.trim());
    setNewName('');
    setShowNewInput(false);
  }, [activeWorkspaceId, newName, createHook]);

  const handleDelete = useCallback(async () => {
    if (!activeWorkspaceId || !selectedName) return;
    await deleteHook(activeWorkspaceId, selectedName);
  }, [activeWorkspaceId, selectedName, deleteHook]);

  const handleUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !activeWorkspaceId) return;
      const content = await file.text();
      await uploadHook(activeWorkspaceId, content);
    };
    input.click();
  }, [activeWorkspaceId, uploadHook]);

  const handleApply = useCallback(async (targetId: string) => {
    if (!activeWorkspaceId || !selectedName) return;
    await applyToWorkspace(activeWorkspaceId, selectedName, targetId);
    setShowApplyPicker(false);
  }, [activeWorkspaceId, selectedName, applyToWorkspace]);

  const handleToggleEnabled = useCallback(async (name: string, enabled: boolean) => {
    if (!activeWorkspaceId) return;
    const hook = hooks.find((h) => h.name === name);
    if (!hook) return;
    await updateHook(activeWorkspaceId, name, { ...hook, enabled });
  }, [activeWorkspaceId, hooks, updateHook]);

  const content = (
    <div className="flex h-[500px]">
      {/* Left: hook list */}
      <div className="w-52 border-r flex flex-col">
        <div className="p-2 border-b flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowNewInput(true)}>
            <Plus className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleUpload}>
            <Upload className="size-3.5" />
          </Button>
        </div>
        {showNewInput && (
          <div className="p-2 border-b flex gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="hook name"
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>OK</Button>
          </div>
        )}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 text-xs text-muted-foreground">Loading...</div>
          ) : hooks.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No hooks</div>
          ) : (
            hooks.map((h) => (
              <div
                key={h.name}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs hover:bg-accent',
                  selectedName === h.name && 'bg-accent',
                )}
                onClick={() => setSelectedName(h.name)}
              >
                <Switch
                  checked={h.enabled}
                  onCheckedChange={(v) => handleToggleEnabled(h.name, v)}
                  className="scale-75"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="truncate flex-1">{h.name}</span>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col">
        {selectedHook ? (
          <>
            <div className="flex items-center justify-between px-3 py-1.5 border-b">
              <span className="text-xs font-medium">{selectedHook.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowApplyPicker(true)}>
                  <ArrowRightLeft className="size-3" />
                  Apply
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleSave} disabled={!dirty}>
                  <Save className="size-3" />
                  Save
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <MoreVertical className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive text-xs" onClick={handleDelete}>
                      <Trash2 className="size-3 mr-1" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {showApplyPicker && (
              <div className="px-3 py-2 border-b bg-muted/50">
                <div className="text-xs mb-1">Apply to workspace:</div>
                <SearchSelect
                  options={workspaces
                    .filter((w) => w.id !== activeWorkspaceId)
                    .map((w) => ({ value: w.id, label: w.name }))}
                  value=""
                  onChange={handleApply}
                  placeholder="Select workspace..."
                />
              </div>
            )}
            <div className="flex-1">
              <MonacoEditor
                height="100%"
                language="json"
                theme="vs-dark"
                value={editorContent}
                onChange={(v) => {
                  setEditorContent(v || '');
                  setDirty(true);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a hook to edit
          </div>
        )}
      </div>
    </div>
  );

  if (standalone) return content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Hooks</DialogTitle>
          <DialogDescription>Manage per-tool-call hooks for this workspace</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/sidebar/hooks-dialog.tsx
git commit -m "feat(web): add HooksDialog with CRUD, upload, apply-to-workspace"
```

---

### Task 8: Frontend — Sidebar entry + workspace toggle

**Files:**
- Modify: `packages/web/src/components/sidebar/app-sidebar.tsx`
- Modify: `packages/web/src/components/settings/workspace-info-section.tsx`

- [ ] **Step 1: Add HooksDialog import to `app-sidebar.tsx`**

After the McpsDialog import (around line 44), add:

```typescript
import { HooksDialog } from "@/components/sidebar/hooks-dialog";
```

- [ ] **Step 2: Add dialog state**

After line 85 (`const [mcpsDialogOpen, setMcpsDialogOpen] = useState(false);`), add:

```typescript
const [hooksDialogOpen, setHooksDialogOpen] = useState(false);
```

- [ ] **Step 3: Add nav item in Settings section**

After the Providers entry in the settings subs array (around line 282), add:

```typescript
{ title: ts('nav.hooks'), link: "#", icon: <Zap className="size-3.5" />, onClick: () => setHooksDialogOpen(true) },
```

Also add the `Zap` icon import from `lucide-react`.

- [ ] **Step 4: Add dialog rendering**

After the McpsDialog render (around line 348), add:

```tsx
<HooksDialog open={hooksDialogOpen} onOpenChange={setHooksDialogOpen} />
```

- [ ] **Step 5: Add hooksEnabled toggle to `workspace-info-section.tsx`**

After the Automation section (around line 77, before the closing `</>`), add:

```tsx
{/* Hooks */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-medium">Hooks</div>
      <div className="text-xs text-muted-foreground">Enable per-tool-call hooks for this workspace</div>
    </div>
    <Switch
      checked={hooksEnabled}
      onCheckedChange={handleToggleHooks}
      disabled={saving}
    />
  </div>
</div>
```

Add the state and handler inside the component function, after the existing `handleToggleAutoProcess`:

```typescript
const [hooksEnabled, setHooksEnabled] = useState(workspace.hooksEnabled !== false);

const handleToggleHooks = async (checked: boolean) => {
  if (saving) return;
  setSaving(true);
  try {
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hooksEnabled: checked }),
    });
    const updated: Workspace = await res.json();
    setHooksEnabled(updated.hooksEnabled !== false);
  } finally {
    setSaving(false);
  }
};
```

Also add the `Switch` import from `@/components/ui/switch` if not already imported.

- [ ] **Step 6: Verify frontend compiles**

Run: `cd packages/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/components/sidebar/app-sidebar.tsx packages/web/src/components/settings/workspace-info-section.tsx
git commit -m "feat(web): add Hooks sidebar entry and workspace hooksEnabled toggle"
```

---

### Task 9: Smoke test

- [ ] **Step 1: Build shared**

Run: `cd packages/shared && pnpm build`

- [ ] **Step 2: Start dev server**

Run: `cd / && pnpm dev`

Verify:
1. Server starts without errors on port 3100
2. Open browser, navigate to workspace
3. In sidebar Settings, click "Hooks" — dialog opens
4. Click "+" — enter name "test-hook" — hook appears in list
5. Editor shows JSON template, edit and save
6. Upload a `.json` file — hook created
7. In workspace settings, toggle "Hooks" switch — persists

- [ ] **Step 3: Test hook execution**

Create a test hook file via the dialog:

```json
{
  "name": "log-bash",
  "enabled": true,
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "type": "command",
        "command": "echo \"[Hook] Bash called in $HOOK_WORKSPACE_ID\" >> /tmp/agent-hooks.log"
      }
    ]
  }
}
```

1. Enable hooks for the workspace (toggle in workspace settings)
2. In a channel, @mention an agent that uses ClaudeCodeRuntime
3. Ask the agent to do something that triggers a Bash tool call
4. Check `/tmp/agent-hooks.log` for the hook output line

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix: smoke test fixes for hook system"
```

---

## Self-Review Checklist

- **Spec coverage**: All 7 REST endpoints ✓ | HookEngine load/match/execute ✓ | wrapOnEventWithHooks at 3 entry points ✓ | HooksDialog CRUD+upload+apply ✓ | Workspace toggle ✓ | Shared types ✓
- **Placeholders**: None found — all steps contain actual code
- **Type consistency**: HookConfig/HookRule defined in Task 1, used consistently in Tasks 2-8; workspace.hooksEnabled added in Task 1, read in Tasks 3/5/8
- **Scope match**: MVP scope only — no script implementation, no pre-hook blocking, no audit log
