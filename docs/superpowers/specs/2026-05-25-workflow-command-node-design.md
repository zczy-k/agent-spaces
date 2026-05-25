# Workflow Command Node Design

Date: 2026-05-25

## Summary

Add a new "command" node type to the Workflow DAG editor, allowing users to insert shell script execution steps between Agent nodes. This enables workflows like "Agent writes code → run tests → Agent reviews" without needing a dedicated Agent for each command step.

Additionally, the agent palette gets collapsible sections and a new "Tools" category.

## Data Model

### shared/types/workflow.ts

`WorkflowNode` becomes a union type:

```typescript
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
```

`WorkflowTemplate.nodes` stays `WorkflowNode[]` (now union). `WorkflowEdge` unchanged.

### Backend impact

- `mapWorkflowToTaskDrafts()`: command nodes have `agentConfigId: undefined`
- `validateWorkflowForRun()`: command nodes skip Agent validation
- `validateDAG()`: unchanged — operates on node IDs, not types

## Backend Execution

### New file: services/workflow-command-runner.ts

```typescript
export async function executeCommandNode(
  workspaceId: string,
  node: WorkflowCommandNode,
  ctx: AgentContext
): Promise<{ success: boolean; exitCode: number; stdout: string; stderr: string }>
```

- Uses `child_process.exec` with 5-minute timeout, 10MB maxBuffer
- `cwd` defaults to workspace `boundDirs[0]`
- Merges `node.data.env` onto `process.env`
- Returns exitCode, stdout, stderr

### Modified: agents/issue-task-controller.ts

In `runIssueTask()` or equivalent task execution path:

1. Look up the Workflow node by task key
2. If `node.type === 'command'`: call `executeCommandNode()`
3. If `node.type === 'agent'`: existing Agent execution path
4. On command failure (exitCode !== 0): Task → `failed`, dependent tasks stay `pending` (existing DAG scheduler behavior handles this)

### No new API endpoints

Command nodes are saved as part of Workflow template (existing CRUD). Execution happens through the existing Issue automation flow.

## Frontend UI

### Palette: collapsible sections + Tools category

**Modified: workflow-agent-palette.tsx**

- Each Agent role group wrapped in a Collapsible component
- New "Tools" section at the bottom with a "Command" card
- Dragging the Command card creates a `type: 'command'` node with default data
- Mobile strip also gets a Command card

### Command node on canvas

**New: workflow-command-node.tsx**

- Terminal icon (Terminal from lucide-react)
- Dark background (`bg-zinc-900` or similar) to visually distinguish from Agent nodes
- Monospace font for label
- Same Handle layout as Agent node (Top target, Bottom source)
- Double-click opens edit dialog
- Shows truncated script preview below label

### Command node edit dialog

**New: workflow-command-edit-dialog.tsx**

- Title input (maps to `data.label`)
- Monaco editor for script content (maps to `data.script`)
- Working directory input (maps to `data.cwd`, placeholder: workspace default)
- Environment variables key-value editor (maps to `data.env`)
- Shell selector (maps to `data.shell`, default: system shell)
- Save/Cancel buttons

### Canvas integration

**Modified: workflow-canvas.tsx**

- `nodeTypes` adds `command: WorkflowCommandNodeComponent`
- `onDrop` handles both agent JSON and command type drag data
- `onNodeDoubleClick` opens appropriate editor (Agent dialog vs Command dialog)

### Editor integration

**Modified: workflow-editor.tsx**

- Node state type: `Node<AgentNodeData | CommandNodeData>`
- Save serialization: checks `n.type` to build correct `WorkflowNode`

### i18n

Add keys for:
- "Tools" section label
- "Command" node type label
- Edit dialog labels (Script, Working Directory, Environment Variables, Shell)

## Constraints

- Command nodes do NOT have an associated Agent — they execute directly via `child_process`
- No streaming output during execution (stdout/stderr captured on completion, stored in Task output)
- Maximum 5-minute execution timeout per command node
- Failure always stops the workflow (no skip/continue option in v1)
- Command nodes are saved as part of the Workflow template JSON, no separate storage

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/types/workflow.ts` | WorkflowNode → union type, add WorkflowAgentNode, WorkflowCommandNode |
| `packages/shared/src/types/index.ts` | Re-export new types if needed |
| `packages/server/src/services/workflow.ts` | Update mapWorkflowToTaskDrafts + validateWorkflowForRun for command nodes |
| `packages/server/src/services/workflow-command-runner.ts` | **New**: executeCommandNode implementation |
| `packages/server/src/agents/issue-task-controller.ts` | Branch on node.type for agent vs command execution |
| `packages/web/src/components/workflow/workflow-agent-palette.tsx` | Collapsible groups + Tools section with Command card |
| `packages/web/src/components/workflow/workflow-command-node.tsx` | **New**: command node renderer |
| `packages/web/src/components/workflow/workflow-command-edit-dialog.tsx` | **New**: command node edit dialog |
| `packages/web/src/components/workflow/workflow-canvas.tsx` | Add command nodeType, handle command drop, double-click |
| `packages/web/src/components/workflow/workflow-editor.tsx` | Union node types in state, serialization |
| `packages/web/src/locales/zh.json` | Add i18n keys |
| `packages/web/src/locales/en.json` | Add i18n keys |
