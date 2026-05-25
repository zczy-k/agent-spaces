# Workflow Command Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "command" node type to the Workflow DAG editor so users can insert shell script steps between Agent nodes, plus collapsible palette sections.

**Architecture:** Extend `WorkflowNode` to a union type (`WorkflowAgentNode | WorkflowCommandNode`). Backend branches on `node.type` in issue-task-controller — command nodes execute via `child_process.exec`, agent nodes use existing Agent runtime. Frontend adds a new `command` nodeType to React Flow, a command card in the palette, and an edit dialog with Monaco editor.

**Tech Stack:** TypeScript, React Flow (@xyflow/react), Monaco Editor, child_process.exec, Collapsible (@base-ui/react)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/types/workflow.ts` | Modify | Split WorkflowNode into union type |
| `packages/shared/src/types/index.ts` | No change | Already re-exports workflow.ts |
| `packages/server/src/services/workflow.ts` | Modify | Handle command nodes in mapWorkflowToTaskDrafts + validateWorkflowForRun |
| `packages/server/src/services/workflow-command-runner.ts` | Create | executeCommandNode via child_process.exec |
| `packages/server/src/agents/issue-task-controller.ts` | Modify | Branch on node.type in runIssueTask |
| `packages/web/src/components/workflow/workflow-agent-palette.tsx` | Modify | Collapsible groups + Tools section |
| `packages/web/src/components/workflow/workflow-command-node.tsx` | Create | Command node renderer for canvas |
| `packages/web/src/components/workflow/workflow-command-edit-dialog.tsx` | Create | Edit dialog with Monaco |
| `packages/web/src/components/workflow/workflow-canvas.tsx` | Modify | Register command nodeType, handle command drop |
| `packages/web/src/components/workflow/workflow-editor.tsx` | Modify | Union node types, command serialization |

---

### Task 1: Shared type — WorkflowNode union type

**Files:**
- Modify: `packages/shared/src/types/workflow.ts`

- [ ] **Step 1: Rewrite workflow.ts with union type**

Replace entire file content:

```typescript
import type { AgentConfig } from './workspace.js';

export interface WorkflowAgentNode {
  id: string;
  type: 'agent';
  position: { x: number; y: number };
  data: {
    label: string;
    agentConfigId: string;
    role: AgentConfig['role'];
    avatarUrl?: string;
    modelId?: string;
    taskTitleTemplate?: string;
    taskDescriptionTemplate?: string;
  };
}

export interface WorkflowCommandNode {
  id: string;
  type: 'command';
  position: { x: number; y: number };
  data: {
    label: string;
    script: string;
    cwd?: string;
    env?: Record<string, string>;
    shell?: string;
    failStrategy?: 'stop';
  };
}

export type WorkflowNode = WorkflowAgentNode | WorkflowCommandNode;

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}
```

- [ ] **Step 2: Build shared package**

Run: `pnpm --filter @agent-spaces/shared build`
Expected: Successful build, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/workflow.ts
git commit -m "feat(shared): extend WorkflowNode to union type with command node"
```

---

### Task 2: Backend — Update workflow service for command nodes

**Files:**
- Modify: `packages/server/src/services/workflow.ts`

- [ ] **Step 1: Update imports and mapWorkflowToTaskDrafts**

In `services/workflow.ts`, the `resolveStaleRoles` function iterates `node.data.agentConfigId` which only exists on agent nodes. Update it to skip command nodes:

Find `resolveStaleRoles` function and replace it:

```typescript
function resolveStaleRoles(nodes: WorkflowNode[]): { nodes: WorkflowNode[]; invalidIds: string[] } {
  const agentMap = new Map(listTemplates().map(a => [a.id, a]));
  const invalidIds: string[] = [];

  const resolved = nodes.map(node => {
    if (node.type === 'command') return node;
    const agent = agentMap.get(node.data.agentConfigId);
    if (!agent) {
      invalidIds.push(node.id);
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        role: agent.role,
        avatarUrl: agent.avatarUrl,
        modelId: agent.modelId,
      },
    };
  });

  return { nodes: resolved, invalidIds };
}
```

- [ ] **Step 2: Update validateWorkflowForRun to skip command nodes**

Find the `validateWorkflowForRun` function and replace it:

```typescript
export function validateWorkflowForRun(_workspaceId: string, template: WorkflowTemplate, memberAgentIds: Set<string>): string | null {
  const agentMap = new Map(listTemplates().map((a) => [a.id, a]));

  for (const node of template.nodes) {
    if (node.type === 'command') continue;
    const agent = agentMap.get(node.data.agentConfigId);
    if (!agent) return `Agent "${node.data.label}" (${node.data.agentConfigId}) no longer exists`;
    if (!agent.enabled) return `Agent "${agent.name}" is disabled`;
    if (!memberAgentIds.has(node.data.agentConfigId)) return `Agent "${agent.name}" is not in the issue channel members`;
  }

  return null;
}
```

- [ ] **Step 3: Update mapWorkflowToTaskDrafts for command nodes**

Find the `mapWorkflowToTaskDrafts` function and replace it:

```typescript
export function mapWorkflowToTaskDrafts(template: WorkflowTemplate): TaskDraftForWorkflow[] {
  const dependsOn = new Map<string, string[]>();
  for (const node of template.nodes) {
    dependsOn.set(node.id, []);
  }
  for (const edge of template.edges) {
    dependsOn.get(edge.target)?.push(edge.source);
  }

  return template.nodes.map(node => {
    if (node.type === 'command') {
      return {
        key: node.id,
        title: node.data.label,
        description: `Command: ${node.data.script.slice(0, 200)}`,
        agentConfigId: undefined,
        dependsOnKeys: dependsOn.get(node.id)?.length ? dependsOn.get(node.id) : undefined,
        sandboxDirs: undefined,
        commandNode: node,
      };
    }
    return {
      key: node.id,
      title: node.data.taskTitleTemplate || node.data.label,
      description: node.data.taskDescriptionTemplate || `Task assigned to ${node.data.label} (${node.data.role})`,
      agentConfigId: node.data.agentConfigId,
      dependsOnKeys: dependsOn.get(node.id)?.length ? dependsOn.get(node.id) : undefined,
      sandboxDirs: undefined,
    };
  });
}
```

- [ ] **Step 4: Update TaskDraftForWorkflow interface**

Find the `TaskDraftForWorkflow` interface and add `commandNode` field:

```typescript
export interface TaskDraftForWorkflow {
  key: string;
  title: string;
  description: string;
  agentConfigId?: string;
  dependsOnKeys?: string[];
  sandboxDirs?: string[];
  commandNode?: import('@agent-spaces/shared').WorkflowCommandNode;
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @agent-spaces/server build 2>&1 | head -30`
Expected: No type errors related to workflow.ts.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/workflow.ts
git commit -m "feat(server): handle command nodes in workflow service"
```

---

### Task 3: Backend — Create workflow-command-runner

**Files:**
- Create: `packages/server/src/services/workflow-command-runner.ts`

- [ ] **Step 1: Create the command runner module**

```typescript
import { exec } from 'child_process';
import type { WorkflowCommandNode } from '@agent-spaces/shared';
import { getById as getWorkspaceById } from '../storage/workspace-store.js';

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function executeCommandNode(
  workspaceId: string,
  node: WorkflowCommandNode,
): Promise<CommandResult> {
  const workspace = getWorkspaceById(workspaceId);
  const cwd = node.data.cwd || workspace?.boundDirs?.[0] || process.cwd();

  return new Promise<CommandResult>((resolve) => {
    exec(node.data.script, {
      cwd,
      env: { ...process.env, ...node.data.env },
      shell: node.data.shell || true,
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        exitCode: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || '',
      });
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/workflow-command-runner.ts
git commit -m "feat(server): add workflow command runner via child_process.exec"
```

---

### Task 4: Backend — Branch on node type in issue-task-controller

**Files:**
- Modify: `packages/server/src/agents/issue-task-controller.ts`

- [ ] **Step 1: Add import for workflow-command-runner**

After the existing imports (line 16), add:

```typescript
import { executeCommandNode } from '../services/workflow-command-runner.js';
```

- [ ] **Step 2: Add import for WorkflowCommandNode**

Update line 2 to:

```typescript
import type { WorkflowTemplate, WorkflowCommandNode } from '@agent-spaces/shared';
```

- [ ] **Step 3: Add command execution function after runIssueTask**

After the `runIssueTask` function (ends around line 343), add a new function:

```typescript
async function runCommandTask(
  workspaceId: string,
  issueId: string,
  taskId: string,
  commandNode: WorkflowCommandNode,
  ctx: AgentContext,
): Promise<void> {
  const task = taskService.getById(workspaceId, taskId);
  if (!task || task.status !== 'pending') return;

  const runningTask = taskService.updateStatus(workspaceId, taskId, 'running');
  if (!runningTask) return;
  broadcastTaskUpdate(ctx, runningTask, 'pending');

  ctx.broadcast('task.output', { taskId, data: `$ ${commandNode.data.script.split('\n')[0]}${commandNode.data.script.includes('\n') ? ' ...' : ''}` });

  const result = await executeCommandNode(workspaceId, commandNode);

  ctx.broadcast('task.output', { taskId, data: result.stdout });
  if (result.stderr) {
    ctx.broadcast('task.output', { taskId, data: result.stderr });
  }

  if (!result.success) {
    const failedTask = taskService.updateStatus(workspaceId, taskId, 'failed', {
      result: {
        success: false,
        summary: `Command failed with exit code ${result.exitCode}`,
        artifacts: [],
        error: result.stderr || `Exit code: ${result.exitCode}`,
      },
    });
    broadcastTaskUpdate(ctx, failedTask, 'running');
    await handleTaskFailure(workspaceId, issueId, taskId, {
      success: false,
      summary: `Command failed with exit code ${result.exitCode}`,
      artifacts: [],
      error: result.stderr || `Exit code: ${result.exitCode}`,
    }, ctx);
    return;
  }

  const completedTask = taskService.complete(workspaceId, taskId, {
    success: true,
    summary: result.stdout.slice(-500) || 'Command completed',
    artifacts: [],
    output: [result.stdout],
  });
  broadcastTaskUpdate(ctx, completedTask, 'running');

  if (issueService.getById(workspaceId, issueId)?.continuousRun !== false) {
    await scheduleRunnableIssueTasks(workspaceId, issueId, ctx);
  }
}
```

- [ ] **Step 4: Branch in runIssueTask to detect command tasks**

In `runIssueTask`, after the early return checks (around line 193), and before `const taskAgentPreset = findAgentForTask(...)` (line 194), insert the command-node branch:

Find this block (lines 193-214):
```typescript
  const taskAgentPreset = findAgentForTask(workspaceId, issue, task);
  if (!taskAgentPreset) {
    if (issueService.getById(workspaceId, issueId)?.status === 'error') return;
    ...
  }
```

Replace it with:

```typescript
  // Check if this task came from a command workflow node
  const workflow = findWorkflowForIssue(workspaceId, issue);
  const commandNode = findCommandNodeForTask(workflow, task);
  if (commandNode) {
    await runCommandTask(workspaceId, issueId, taskId, commandNode, ctx);
    return;
  }

  const taskAgentPreset = findAgentForTask(workspaceId, issue, task);
  if (!taskAgentPreset) {
    if (issueService.getById(workspaceId, issueId)?.status === 'error') return;
    const missingExecutorResult = {
      success: false,
      summary: 'No runnable agent configured in issue channel members',
      artifacts: [],
      error: 'No runnable agent member found for issue channel',
    };
    const failed = taskService.updateStatus(workspaceId, taskId, 'failed', {
      result: {
        success: false,
        summary: missingExecutorResult.summary,
        artifacts: [],
        error: missingExecutorResult.error,
      },
    });
    broadcastTaskUpdate(ctx, failed, task.status);
    await handleTaskFailure(workspaceId, issueId, taskId, missingExecutorResult, ctx);
    return;
  }
```

- [ ] **Step 5: Add helper functions for finding command nodes**

Before the `broadcastTaskUpdate` function, add:

```typescript
function findWorkflowForIssue(workspaceId: string, issue: Issue): WorkflowTemplate | null {
  if (!issue.workflowId) return null;
  return getWorkflow(issue.workflowId);
}

function findCommandNodeForTask(workflow: WorkflowTemplate | null, task: Task): WorkflowCommandNode | null {
  if (!workflow) return null;
  // task.agentConfigId is undefined for command tasks — match by task title to node label
  if (task.agentConfigId) return null;
  for (const node of workflow.nodes) {
    if (node.type === 'command' && (task.title === node.data.label || task.description?.startsWith('Command:'))) {
      return node;
    }
  }
  return null;
}
```

Add the missing import for `getWorkflow`:

```typescript
import { mapWorkflowToTaskDrafts, validateWorkflowForRun } from '../services/workflow.js';
```

Change to:

```typescript
import { getWorkflow, mapWorkflowToTaskDrafts, validateWorkflowForRun } from '../services/workflow.js';
```

Note: `getWorkflow` is already exported from `services/workflow.ts`.

- [ ] **Step 6: Update ensureWorkflowAgentsForRun to handle command nodes**

In `ensureWorkflowAgentsForRun` (around line 503), the line:

```typescript
const workflowAgentIds = [...new Set(template.nodes.map((node) => node.data.agentConfigId).filter(Boolean))];
```

Needs to handle the union type — `node.data.agentConfigId` only exists on agent nodes. Replace with:

```typescript
const workflowAgentIds = [...new Set(template.nodes.filter((node): node is import('@agent-spaces/shared').WorkflowAgentNode => node.type === 'agent').map((node) => node.data.agentConfigId))];
```

- [ ] **Step 7: Verify build**

Run: `pnpm --filter @agent-spaces/server build 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/agents/issue-task-controller.ts
git commit -m "feat(server): branch on node type for command vs agent execution"
```

---

### Task 5: Frontend — Command node renderer

**Files:**
- Create: `packages/web/src/components/workflow/workflow-command-node.tsx`

- [ ] **Step 1: Create command node component**

```tsx
'use client';

import { memo, useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { Terminal, X } from 'lucide-react';

type CommandNodeData = {
  label: string;
  script: string;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  failStrategy?: 'stop';
};

type CommandNode = Node<CommandNodeData, 'command'>;

function WorkflowCommandNodeComponent({ id, data, selected }: NodeProps<CommandNode>) {
  const { setNodes } = useReactFlow();
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [id, setNodes]);

  const handleToggleDelete = useCallback(() => {
    setShowDelete((v) => !v);
  }, []);

  const scriptPreview = data.script
    ? data.script.split('\n')[0].slice(0, 40) + (data.script.split('\n')[0].length > 40 ? '...' : '')
    : 'No script';

  return (
    <div
      onClick={handleToggleDelete}
      className={`rounded-lg border-2 bg-zinc-900 p-3 shadow-sm min-w-[160px] transition-colors duration-150 group relative ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-zinc-700'}`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-zinc-500 !border-2 !border-zinc-900 hover:!bg-primary" />
      <button
        type="button"
        onClick={handleDelete}
        className="absolute -top-2 -right-2 flex items-center justify-center size-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/80 transition-opacity z-10 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
        style={{ opacity: showDelete ? 1 : undefined }}
      >
        <X className="size-3" />
      </button>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-md bg-zinc-800 text-green-400">
          <Terminal className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-zinc-100 font-mono">{data.label}</div>
          <div className="text-[10px] text-zinc-400 truncate font-mono mt-0.5">{scriptPreview}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-zinc-500 !border-2 !border-zinc-900 hover:!bg-primary" />
    </div>
  );
}

export const WorkflowCommandNode = memo(WorkflowCommandNodeComponent);
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workflow/workflow-command-node.tsx
git commit -m "feat(web): add command node renderer for workflow canvas"
```

---

### Task 6: Frontend — Command node edit dialog

**Files:**
- Create: `packages/web/src/components/workflow/workflow-command-edit-dialog.tsx`

- [ ] **Step 1: Create edit dialog**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';

interface CommandNodeData {
  label: string;
  script: string;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  failStrategy?: 'stop';
}

interface WorkflowCommandEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CommandNodeData;
  onSave: (data: CommandNodeData) => void;
}

export function WorkflowCommandEditDialog({ open, onOpenChange, data, onSave }: WorkflowCommandEditDialogProps) {
  const [label, setLabel] = useState(data.label);
  const [script, setScript] = useState(data.script);
  const [cwd, setCwd] = useState(data.cwd || '');
  const [shell, setShell] = useState(data.shell || '');
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>(() => {
    if (!data.env) return [];
    return Object.entries(data.env).map(([key, value]) => ({ key, value }));
  });

  useEffect(() => {
    if (open) {
      setLabel(data.label);
      setScript(data.script);
      setCwd(data.cwd || '');
      setShell(data.shell || '');
      setEnvPairs(data.env ? Object.entries(data.env).map(([key, value]) => ({ key, value })) : []);
    }
  }, [open, data]);

  const addEnvPair = useCallback(() => {
    if (!envKey.trim()) return;
    setEnvPairs((prev) => [...prev, { key: envKey.trim(), value: envValue }]);
    setEnvKey('');
    setEnvValue('');
  }, [envKey, envValue]);

  const removeEnvPair = useCallback((index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    const env: Record<string, string> = {};
    for (const pair of envPairs) {
      env[pair.key] = pair.value;
    }
    onSave({
      label: label || 'Command',
      script,
      cwd: cwd || undefined,
      shell: shell || undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      failStrategy: 'stop',
    });
    onOpenChange(false);
  }, [label, script, cwd, shell, envPairs, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-4" />
            Edit Command Node
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Command" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Script</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="#!/bin/bash&#10;pnpm test"
              spellCheck={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Working Directory</label>
              <Input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Default: workspace root" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Shell</label>
              <Input value={shell} onChange={(e) => setShell(e.target.value)} placeholder="Default: system shell" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Environment Variables</label>
            {envPairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={pair.key} readOnly className="h-8 text-xs font-mono flex-1" />
                <span className="text-muted-foreground">=</span>
                <Input value={pair.value} readOnly className="h-8 text-xs font-mono flex-1" />
                <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => removeEnvPair(index)}>X</Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input value={envKey} onChange={(e) => setEnvKey(e.target.value)} placeholder="KEY" className="h-8 text-xs font-mono flex-1" />
              <span className="text-muted-foreground">=</span>
              <Input value={envValue} onChange={(e) => setEnvValue(e.target.value)} placeholder="value" className="h-8 text-xs font-mono flex-1" />
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={addEnvPair}>Add</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workflow/workflow-command-edit-dialog.tsx
git commit -m "feat(web): add command node edit dialog"
```

---

### Task 7: Frontend — Update palette with collapsible + Tools section

**Files:**
- Modify: `packages/web/src/components/workflow/workflow-agent-palette.tsx`

- [ ] **Step 1: Rewrite palette component**

Replace entire file content:

```tsx
'use client';

import { useState, useCallback } from 'react';
import type { AgentConfig, WorkflowCommandNode } from '@agent-spaces/shared';
import type { Node } from '@xyflow/react';
import type { WorkflowNode } from '@agent-spaces/shared';
import { AgentDialog } from '@/components/sidebar/agent-dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Eye, Plus, Terminal, ChevronRight } from 'lucide-react';

type AgentNodeData = WorkflowNode['data'];
type AgentNode = Node<AgentNodeData, 'agent'>;

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agent', scheduler: 'Scheduler', task_creator: 'Task Creator', bot: 'Bot',
};

function groupByRole(agents: AgentConfig[]): Record<string, AgentConfig[]> {
  const groups: Record<string, AgentConfig[]> = {};
  for (const agent of agents) {
    if (!agent.enabled) continue;
    const role = agent.role || 'agent';
    if (!groups[role]) groups[role] = [];
    groups[role].push(agent);
  }
  return groups;
}

interface WorkflowAgentPaletteProps {
  agents: AgentConfig[];
  onNodeAdd?: (node: AgentNode | Node<WorkflowCommandNode['data'], 'command'>) => void;
}

export function WorkflowAgentPalette({ agents, onNodeAdd }: WorkflowAgentPaletteProps) {
  const grouped = groupByRole(agents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAgentId, setDialogAgentId] = useState<string | undefined>();

  const openAgentDialog = (agent: AgentConfig) => {
    setDialogAgentId(agent.id);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setDialogAgentId(undefined);
  };

  const onDragStart = (event: React.DragEvent, agent: AgentConfig) => {
    event.dataTransfer.setData('application/json', JSON.stringify(agent));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onCommandDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/x-workflow-command', 'true');
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAddToCanvas = useCallback((agent: AgentConfig) => {
    if (!onNodeAdd) return;
    onNodeAdd({
      id: `node-${Date.now()}`,
      type: 'agent',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: agent.name, agentConfigId: agent.id, role: agent.role, avatarUrl: agent.avatarUrl, modelId: agent.modelId },
    });
  }, [onNodeAdd]);

  const handleAddCommand = useCallback(() => {
    if (!onNodeAdd) return;
    onNodeAdd({
      id: `node-${Date.now()}`,
      type: 'command',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: 'Command', script: '' },
    });
  }, [onNodeAdd]);

  const enabledAgents = agents.filter(a => a.enabled);

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <div className="hidden md:block w-56 border-r bg-muted/30 p-3 overflow-y-auto">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Nodes</h3>

        {Object.entries(grouped).map(([role, roleAgents]) => (
          <Collapsible key={role} defaultOpen className="mb-1">
            <CollapsibleTrigger className="flex items-center gap-1 w-full text-left py-1 group/trigger cursor-pointer">
              <ChevronRight className="size-3 text-muted-foreground transition-transform [[data-panel-open]>&]:rotate-90" />
              <span className="text-[10px] font-medium uppercase text-muted-foreground/60 group-hover/trigger:text-muted-foreground">
                {ROLE_LABELS[role] || role}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {roleAgents.map(agent => (
                <div key={agent.id} draggable onDragStart={(e) => onDragStart(e, agent)}
                  className="group flex items-center gap-2 p-2 rounded-md bg-card border cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors mb-1 ml-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {agent.modelId || agent.runtimeKind || agent.role}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openAgentDialog(agent); }}
                    className="shrink-0 flex items-center justify-center size-5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity cursor-pointer"
                  >
                    <Eye className="size-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}

        {/* Tools section */}
        <Collapsible defaultOpen className="mb-1 mt-2">
          <CollapsibleTrigger className="flex items-center gap-1 w-full text-left py-1 group/trigger cursor-pointer">
            <ChevronRight className="size-3 text-muted-foreground transition-transform [[data-panel-open]>&]:rotate-90" />
            <span className="text-[10px] font-medium uppercase text-muted-foreground/60 group-hover/trigger:text-muted-foreground">
              Tools
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div
              draggable
              onDragStart={onCommandDragStart}
              className="group flex items-center gap-2 p-2 rounded-md bg-zinc-900 border border-zinc-700 cursor-grab active:cursor-grabbing hover:bg-zinc-800 transition-colors mb-1 ml-2"
            >
              <div className="flex items-center justify-center size-6 rounded bg-zinc-800 text-green-400">
                <Terminal className="size-3" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-zinc-100 font-mono">Command</div>
                <div className="text-[10px] text-zinc-400">Shell script node</div>
              </div>
              {onNodeAdd && (
                <button
                  type="button"
                  onClick={handleAddCommand}
                  className="shrink-0 flex items-center justify-center size-5 rounded hover:bg-zinc-700 transition-opacity cursor-pointer"
                >
                  <Plus className="size-3 text-zinc-400" />
                </button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {enabledAgents.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No agents configured.</p>
        )}
      </div>

      {/* Mobile: horizontal strip */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-muted/30 overflow-x-auto shrink-0">
        {enabledAgents.map(agent => (
          <div key={agent.id}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-card border shrink-0 cursor-grab active:cursor-grabbing"
            draggable
            onDragStart={(e) => onDragStart(e, agent)}
          >
            <span className="text-xs font-medium whitespace-nowrap">{agent.name}</span>
            {onNodeAdd && (
              <button
                type="button"
                onClick={() => handleAddToCanvas(agent)}
                className="flex items-center justify-center size-4 rounded hover:bg-accent cursor-pointer"
              >
                <Plus className="size-3" />
              </button>
            )}
          </div>
        ))}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 shrink-0 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={onCommandDragStart}
        >
          <Terminal className="size-3 text-green-400" />
          <span className="text-xs font-medium whitespace-nowrap text-zinc-100">Command</span>
          {onNodeAdd && (
            <button type="button" onClick={handleAddCommand} className="flex items-center justify-center size-4 rounded hover:bg-zinc-700 cursor-pointer">
              <Plus className="size-3 text-zinc-400" />
            </button>
          )}
        </div>
        {enabledAgents.length === 0 && (
          <p className="text-xs text-muted-foreground">No agents configured.</p>
        )}
      </div>
      <AgentDialog open={dialogOpen} onOpenChange={handleDialogClose} initialAgentId={dialogAgentId} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workflow/workflow-agent-palette.tsx
git commit -m "feat(web): collapsible palette with tools section"
```

---

### Task 8: Frontend — Update canvas to support command nodes

**Files:**
- Modify: `packages/web/src/components/workflow/workflow-canvas.tsx`

- [ ] **Step 1: Import command node and register nodeType**

Add import after existing imports:

```typescript
import { WorkflowCommandNode } from './workflow-command-node';
```

Update `nodeTypes` from:

```typescript
const nodeTypes = { agent: WorkflowAgentNode };
```

to:

```typescript
const nodeTypes = { agent: WorkflowAgentNode, command: WorkflowCommandNode };
```

- [ ] **Step 2: Handle command drop in onDrop**

In the `onDrop` callback, after the existing agent JSON handling, add command handling. Replace the `onDrop` function:

```typescript
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const commandData = event.dataTransfer.getData('application/x-workflow-command');
    if (commandData) {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onNodeAdd?.({
        id: `node-${Date.now()}`,
        type: 'command',
        position,
        data: { label: 'Command', script: '' },
      });
      return;
    }

    const agentJson = event.dataTransfer.getData('application/json');
    if (!agentJson) return;
    const agent: AgentConfig = JSON.parse(agentJson);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onNodeAdd?.({
      id: `node-${Date.now()}`,
      type: 'agent',
      position,
      data: { label: agent.name, agentConfigId: agent.id, role: agent.role, avatarUrl: agent.avatarUrl, modelId: agent.modelId },
    });
  }, [screenToFlowPosition, onNodeAdd]);
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/workflow/workflow-canvas.tsx
git commit -m "feat(web): register command nodeType in canvas, handle command drop"
```

---

### Task 9: Frontend — Update editor for union types + edit dialog integration

**Files:**
- Modify: `packages/web/src/components/workflow/workflow-editor.tsx`

- [ ] **Step 1: Import command edit dialog**

Add after existing imports:

```typescript
import { WorkflowCommandEditDialog } from './workflow-command-edit-dialog';
import type { WorkflowCommandNode } from '@agent-spaces/shared';
```

- [ ] **Step 2: Update node type to support union**

Change the type aliases from:

```typescript
type AgentNodeData = WorkflowNode['data'];
type AgentNode = Node<AgentNodeData, 'agent'>;
```

to:

```typescript
type AgentNodeData = Extract<WorkflowNode, { type: 'agent' }>['data'];
type CommandNodeData = Extract<WorkflowNode, { type: 'command' }>['data'];
type AgentNode = Node<AgentNodeData, 'agent'>;
type CommandNode = Node<CommandNodeData, 'command'>;
type WorkflowNodeRF = AgentNode | CommandNode;
```

- [ ] **Step 3: Update state types to use union**

Replace `AgentNode` with `WorkflowNodeRF` in the state and callbacks.

Change the nodes state from:
```typescript
  const [nodes, setNodes] = useState<AgentNode[]>(
```
to:
```typescript
  const [nodes, setNodes] = useState<WorkflowNodeRF[]>(
```

Change the template mapping from:
```typescript
      template?.nodes.map((n) => ({
        id: n.id,
        type: 'agent' as const,
        position: n.position,
        data: n.data,
      })) ?? []
```
to:
```typescript
      template?.nodes.map((n) => ({
        id: n.id,
        type: n.type as 'agent' | 'command',
        position: n.position,
        data: n.data,
      })) ?? []
```

- [ ] **Step 4: Update onNodesChange type**

Change:
```typescript
  const onNodesChange = useCallback(
    (changes: NodeChange<AgentNode>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
```
to:
```typescript
  const onNodesChange = useCallback(
    (changes: NodeChange<WorkflowNodeRF>[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
```

- [ ] **Step 5: Update onNodeAdd callback type**

Change:
```typescript
  const onNodeAdd = useCallback(
    (node: AgentNode) => {
```
to:
```typescript
  const onNodeAdd = useCallback(
    (node: WorkflowNodeRF) => {
```

- [ ] **Step 6: Update save serialization**

In `handleSave`, update the serialization to handle both types. Replace:

```typescript
      const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
        id: n.id,
        type: 'agent' as const,
        position: n.position,
        data: n.data,
      }));
```

with:

```typescript
      const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
        id: n.id,
        type: n.type as 'agent' | 'command',
        position: n.position,
        data: n.data,
      }));
```

- [ ] **Step 7: Add command edit dialog state and handler**

After the existing `isSaving` state, add:

```typescript
  const [editCommandNode, setEditCommandNode] = useState<CommandNode | null>(null);
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);
```

Add a handler for double-click on command nodes, and a save callback. After `markDirty`:

```typescript
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: WorkflowNodeRF) => {
    if (node.type === 'command') {
      setEditCommandNode(node as CommandNode);
      setCommandDialogOpen(true);
    }
  }, []);

  const handleCommandSave = useCallback((data: CommandNodeData) => {
    if (!editCommandNode) return;
    setNodes((nds) =>
      nds.map((n) => n.id === editCommandNode.id ? { ...n, data } : n)
    );
    markDirty();
  }, [editCommandNode, markDirty]);
```

- [ ] **Step 8: Wire up onNodeDoubleClick to canvas**

Update the `WorkflowCanvas` JSX to pass the double-click handler. Change:

```typescript
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeAdd={onNodeAdd}
        />
```

to:

```typescript
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeAdd={onNodeAdd}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
```

- [ ] **Step 9: Add edit dialog JSX**

After `<AgentDialog .../>` at the end, add:

```tsx
      <WorkflowCommandEditDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
        data={editCommandNode?.data ?? { label: '', script: '' }}
        onSave={handleCommandSave}
      />
```

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/components/workflow/workflow-editor.tsx
git commit -m "feat(web): union node types in editor + command edit dialog wiring"
```

---

### Task 10: Frontend — Wire onNodeDoubleClick in canvas

**Files:**
- Modify: `packages/web/src/components/workflow/workflow-canvas.tsx`

- [ ] **Step 1: Add onNodeDoubleClick prop**

Update the `WorkflowCanvasProps` interface:

```typescript
interface WorkflowCanvasProps {
  nodes: AgentNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<AgentNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeAdd?: (node: AgentNode) => void;
  onNodeDoubleClick?: (_: React.MouseEvent, node: any) => void;
}
```

Add to the destructured props:

```typescript
export function WorkflowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeAdd, onNodeDoubleClick }: WorkflowCanvasProps) {
```

Pass `onNodeDoubleClick` to `ReactFlow`:

```tsx
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onDragOver={onDragOver} onDrop={onDrop}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView snapToGrid snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        defaultEdgeOptions={{ type: 'smoothstep', animated: false, style: { strokeWidth: 2 } }}
      >
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/workflow/workflow-canvas.tsx
git commit -m "feat(web): pass onNodeDoubleClick to ReactFlow canvas"
```

---

### Task 11: Build verification

**Files:**
- None (verification only)

- [ ] **Step 1: Build shared package**

Run: `pnpm --filter @agent-spaces/shared build`
Expected: Success.

- [ ] **Step 2: Build server**

Run: `pnpm --filter @agent-spaces/server build`
Expected: No type errors.

- [ ] **Step 3: Build web**

Run: `pnpm --filter @agent-spaces/web build`
Expected: No type errors. If there are type errors from the union WorkflowNode, fix them.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve type errors from WorkflowNode union type"
```

---

## Self-Review

**Spec coverage:**
- WorkflowNode union type → Task 1
- mapWorkflowToTaskDrafts + validateWorkflowForRun → Task 2
- executeCommandNode → Task 3
- issue-task-controller branching → Task 4
- Command node renderer → Task 5
- Command edit dialog → Task 6
- Palette collapsible + Tools → Task 7
- Canvas command drop → Task 8
- Editor union types + dialog wiring → Task 9
- Canvas double-click wiring → Task 10
- Build verification → Task 11

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:**
- `WorkflowCommandNode.data.script` used consistently in runner, controller, node component, dialog
- `CommandNodeData` type matches `WorkflowCommandNode['data']` across all frontend files
- `TaskDraftForWorkflow.commandNode` typed as `import('@agent-spaces/shared').WorkflowCommandNode`
- `findCommandNodeForTask` returns `WorkflowCommandNode | null`
