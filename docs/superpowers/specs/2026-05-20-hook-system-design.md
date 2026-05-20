# Hook System Design Spec

> Per-tool-call hook system for Agent Spaces — Claude Code–style hooks, multi-file storage, workspace-scoped.

## Overview

Add a configurable hook system that triggers custom actions before and after each tool call during agent execution. Hooks are defined as JSON files (one per hook), stored per-workspace, and support three action types: shell command, webhook, and built-in script. The system intercepts `AgentRuntimeEvent` at the `onEvent` callback layer (Plan A), keeping runtime implementations untouched.

## Requirements

- Per-tool-call granularity: hooks fire on `PreToolUse` and `PostToolUse` phases
- JSON format follows Claude Code `hooks.json` convention
- Multiple hook files per workspace, each file is one hook config (`{name}.hook.json`)
- Stored under `~/.agent-spaces-data/workspaces/{id}/hooks/`
- Three action types: shell command, webhook, built-in script
- MVP only fully implements shell command; webhook and script are stubs
- Workspace-level toggle to enable/disable hooks
- Sidebar dialog for managing hooks (CRUD + upload JSON + Monaco editor)
- "Apply to workspace" button to copy a hook to another workspace
- Initially only integrates with ClaudeCodeRuntime's event stream
- No execution blocking (Plan A — fire-and-forget hooks)

## Data Model

### HookConfig

```typescript
// packages/shared/src/types/hooks.ts

export interface HookConfig {
  name: string
  description?: string
  enabled: boolean
  hooks: {
    PreToolUse?: HookRule[]
    PostToolUse?: HookRule[]
  }
}

export interface HookRule {
  matcher: string            // exact tool name, "*" wildcard, or "/regex/" pattern
  type: 'command' | 'webhook' | 'script'
  command?: string           // shell command template (type=command)
  url?: string               // HTTP endpoint (type=webhook)
  function?: string          // built-in function name (type=script)
  timeout?: number           // ms, default 10000
}
```

### Workspace Extension

Add `hooksEnabled?: boolean` to `Workspace` interface in `packages/shared/src/types/workspace.ts`.

### File Storage

```
~/.agent-spaces-data/workspaces/{id}/hooks/
  log-bash.hook.json
  notify-write.hook.json
  ...
```

File naming: `{name}.hook.json`. The `name` field in the JSON must match the filename stem.

### Matcher Rules

| Pattern | Meaning | Example |
|---------|---------|---------|
| `"Bash"` | Exact match | Only Bash tool |
| `"*"` | Match all | Every tool call |
| `"/Edit\|Write/"` | Regex (delimited by `/`) | Edit or Write tool |

### Action Types

| type | Required field | Behavior |
|------|---------------|----------|
| `command` | `command` | Execute shell command. Env vars injected: `HOOK_TOOL_NAME`, `HOOK_TOOL_INPUT` (JSON string), `HOOK_TOOL_RESULT` (PostToolUse only), `HOOK_WORKSPACE_ID` |
| `webhook` | `url` | POST to URL with JSON body: `{ event, toolName, toolInput, toolResult?, timestamp, workspaceId }` |
| `script` | `function` | Call registered built-in function. MVP: no-op with warning log |

## Backend Architecture

### New Files

```
packages/server/src/
  services/hook-engine.ts       # Core engine: load, match, execute
  storage/hook-store.ts         # File CRUD for .hook.json files
  routes/hooks.ts               # REST API endpoints
```

### HookEngine

```typescript
class HookEngine {
  private hooks: Map<string, HookConfig>
  private workspaceId: string

  constructor(workspaceId: string)
  load(): void
  reload(): void
  getHooks(): HookConfig[]

  async executeHooks(
    phase: 'PreToolUse' | 'PostToolUse',
    toolName: string,
    context: { toolInput?: unknown; toolResult?: unknown }
  ): Promise<void>
}
```

`executeHooks` flow:
1. Filter hooks where `enabled === true`
2. For each hook, iterate `hooks[phase]` rules
3. Match `toolName` against `matcher` (exact → wildcard → regex)
4. Execute matched rules in parallel (Promise.allSettled)
5. `command`: `child_process.exec` with env injection, timeout from rule
6. `webhook`: `fetch(url, { method: 'POST', body: JSON(...) })`, timeout from rule
7. `script`: log warning "not implemented", skip
8. Errors caught and logged, never propagate to caller

### Integration: wrapOnEventWithHooks

Utility function in `services/hook-engine.ts`:

```typescript
export function wrapOnEventWithHooks(
  onEvent: (event: AgentRuntimeEvent) => void,
  workspaceId: string,
  hooksEnabled: boolean
): (event: AgentRuntimeEvent) => void {
  if (!hooksEnabled) return onEvent

  const engine = new HookEngine(workspaceId)
  engine.load()

  return (event: AgentRuntimeEvent) => {
    onEvent(event)
    if (event.type === 'tool_use') {
      engine.executeHooks('PreToolUse', event.name, { toolInput: event.input })
    }
    if (event.type === 'tool_result') {
      engine.executeHooks('PostToolUse', event.name, { toolResult: event.result })
    }
  }
}
```

Applied at all agent execution entry points:
- `ws/agent-runner.ts` — WebSocket @mention execution
- `routes/agent-sse.ts` — HTTP SSE execution
- `agents/issue-task-controller.ts` — Issue automation execution

### HookStore

```typescript
// storage/hook-store.ts
const hooksDir = (wsId) => path.join(workspaceDir(wsId), 'hooks')

listHooks(wsId: string): HookConfig[]
getHook(wsId: string, name: string): HookConfig | null
saveHook(wsId: string, config: HookConfig): void
deleteHook(wsId: string, name: string): void
uploadHook(wsId: string, jsonString: string): HookConfig
applyToWorkspace(sourceWsId: string, name: string, targetWsId: string): void
```

### REST API

```
GET    /api/workspaces/:id/hooks              List all hooks
GET    /api/workspaces/:id/hooks/:name        Get single hook
POST   /api/workspaces/:id/hooks              Create hook (body = HookConfig)
PUT    /api/workspaces/:id/hooks/:name        Update hook
DELETE /api/workspaces/:id/hooks/:name        Delete hook
POST   /api/workspaces/:id/hooks/upload       Upload JSON file (body = { content: string })
POST   /api/workspaces/:id/hooks/:name/apply  Apply to another workspace (body = { targetWorkspaceId })
```

All endpoints require Bearer Token auth.

## Frontend

### New Files

```
packages/web/src/
  components/sidebar/hooks-dialog.tsx     Hook management dialog
  stores/hooks.ts                         Zustand store for hook CRUD
```

### Sidebar Entry

In `app-sidebar.tsx` Settings section, add "Hooks" entry alongside Skills, MCPs, Prompts. Opens `HooksDialog`.

### HooksDialog

Layout: left list + right editor (same pattern as existing SkillsDialog/McpsDialog).

- **Left panel**: list of hooks (name + enabled badge + description). Click to select. Toggle enabled inline.
- **Right panel**: Monaco JSON editor for selected hook. Editable.
- **Toolbar buttons**:
  - New: input name → generate empty template → save
  - Upload: file picker → read JSON → POST upload API
  - Save: PUT updated config
  - Delete: confirm dialog → DELETE
  - Apply to workspace: workspace picker → POST apply API

### Workspace Settings

In `workspace-info-section.tsx`, add "Hooks" section with Switch toggle for `hooksEnabled`. Same save pattern as `autoProcessIssues`.

### Zustand Store

```typescript
// stores/hooks.ts
interface HookStore {
  hooks: HookConfig[]
  selectedName: string | null
  loading: boolean

  fetchHooks(workspaceId: string): Promise<void>
  createHook(workspaceId: string, name: string): Promise<void>
  updateHook(workspaceId: string, name: string, config: HookConfig): Promise<void>
  deleteHook(workspaceId: string, name: string): Promise<void>
  uploadHook(workspaceId: string, content: string): Promise<void>
  applyToWorkspace(workspaceId: string, name: string, targetWorkspaceId: string): Promise<void>
}
```

## Scope

### In Scope (MVP)

- HookEngine core: load, match, execute (command type fully working)
- HookStore file CRUD
- REST API (7 endpoints)
- `wrapOnEventWithHooks` integration at 3 entry points
- HooksDialog with full CRUD + upload + apply
- Workspace hooksEnabled toggle
- Shared types (`HookConfig`, `HookRule`)
- Webhook action type (basic POST, no retry/auth)

### Out of Scope (Future)

- `script` action type implementation
- Hook execution result display in agent output
- Pre-tool-call blocking/approval
- Hook testing/simulation UI
- Hook marketplace or sharing
- Hook execution history/audit log
- Per-agent hook override (workspace-level only for MVP)

## Error Handling

- Hook file parse errors: log warning, skip that hook
- Hook execution timeout: kill process, log warning
- Hook execution failure: log error, never propagate to agent
- Missing hooks directory: create on first write
- Invalid matcher pattern: treat as exact match fallback
