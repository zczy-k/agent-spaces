# Quick Command Design Spec

> Terminal panel left sidebar command management — VS Code task runner style.

## Overview

Add a quick command management panel to the left side of `terminal-panel.tsx`. Users can create, edit, delete, run, and stop commands. Each command is bound to a workspace and persisted in `commands.json`. A backend `CommandProcessManager` service manages command-to-terminal lifecycle including auto-restart.

## Requirements

- Commands are workspace-scoped, persisted in `commands.json`
- Each command: name + command + cwd + shell + env + autoRestart
- Run: reuse existing terminal if command already running, otherwise create new
- Stop: send Ctrl+C (`\x03`), keep terminal tab alive
- autoRestart: on PTY exit, delay 1s then re-run
- Agent tools: ListQuickCommands / RunQuickCommand / StopQuickCommand (workspaceId param)
- Left sidebar with command list, right header has add button
- Command list items show run/stop toggle, hover reveals edit/delete
- CommandDialog for create/edit with form fields

## Data Model

```typescript
// shared/src/types/command.ts

export interface QuickCommand {
  id: string;
  name: string;
  command: string;
  cwd?: string;           // override workspace boundDirs[0]
  shell?: string;         // explicit shell
  env?: Record<string, string>;
  autoRestart?: boolean;  // auto-restart on exit
  createdAt: string;
  updatedAt: string;
}

// Runtime state — in-memory only, not persisted
export interface CommandProcess {
  commandId: string;
  workspaceId: string;
  sessionId: string;      // PTY session ID
  status: 'running' | 'stopping';
  startedAt: string;
  restartCount: number;
}
```

**Storage**: `~/.agent-spaces-data/workspaces/{workspaceId}/commands.json` — array of `QuickCommand`.

## Backend

### `services/command.ts` — CRUD

Synchronous JSON read/write (same pattern as `workflow.ts`):

- `listCommands(workspaceId): QuickCommand[]`
- `getCommand(workspaceId, commandId): QuickCommand | null`
- `createCommand(workspaceId, input): QuickCommand`
- `updateCommand(workspaceId, commandId, updates): QuickCommand`
- `deleteCommand(workspaceId, commandId): void`

### `services/command-process-manager.ts` — Process Lifecycle

In-memory `Map<string, CommandProcess>` keyed by `commandId`.

**`runCommand(workspaceId, commandId)`**:
1. Look up command definition from command service
2. Check existing CommandProcess for this commandId — if found, skip (reuse)
3. Resolve cwd: `command.cwd || workspace.boundDirs[0] || process.env.HOME`
4. Resolve shell: `command.shell || default`
5. Call `ptyService.createSession(workspaceId, cwd, onOutput, onExit, shell)`
6. Store `CommandProcess` mapping: `commandId -> { sessionId, status: 'running', ... }`
7. `ptyService.write(sessionId, command.command + '\n')` to execute
8. Broadcast `command.started` event to workspace
9. Return `sessionId`

**`stopCommand(workspaceId, commandId)`**:
1. Look up `CommandProcess`
2. `ptyService.write(sessionId, '\x03')` — send Ctrl+C
3. Mark `status = 'stopping'`
4. Broadcast `command.stopped` event to workspace
5. Do NOT kill terminal — tab stays alive

**PTY `onExit` hook**:
1. Look up `CommandProcess` by `sessionId` (reverse index: `sessionId -> commandId`)
2. Remove mapping from `Map`
3. If `autoRestart === true` and `status !== 'stopping'`:
   - Increment `restartCount`
   - Broadcast `command.restarted` event
   - `setTimeout(1000)` then call `runCommand()` again
4. If `status === 'stopping'` or no autoRestart:
   - Broadcast `command.stopped` event with `exitCode`

**`getCommandProcesses(workspaceId): CommandProcess[]`**

### `routes/command.ts` — REST API

All routes require auth, nested under workspace:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/workspaces/:id/commands` | List commands |
| POST | `/api/workspaces/:id/commands` | Create command |
| PUT | `/api/workspaces/:id/commands/:commandId` | Update command |
| DELETE | `/api/workspaces/:id/commands/:commandId` | Delete command |
| POST | `/api/workspaces/:id/commands/:commandId/run` | Run command — returns `{ sessionId }` |
| POST | `/api/workspaces/:id/commands/:commandId/stop` | Stop command |

**Delete guard**: if command has running process, stop it first (send Ctrl+C, remove mapping).

### `builtin-tools.ts` — 3 New Agent Tools

Each tool receives `workspaceId` as parameter:

| Tool Name | Input Schema | Description |
|-----------|-------------|-------------|
| `ListQuickCommands` | `{ workspaceId: string }` | Returns commands list with running status |
| `RunQuickCommand` | `{ workspaceId: string, commandId: string }` | Start a command, returns sessionId |
| `StopQuickCommand` | `{ workspaceId: string, commandId: string }` | Stop a running command |

### WebSocket Events (server -> client)

3 new events in `ServerEventMap`:

```
command.started   { commandId, sessionId, workspaceId }
command.stopped   { commandId, exitCode?, workspaceId }
command.restarted { commandId, sessionId, restartCount, workspaceId }
```

No new client->server events needed. Run/stop go through REST API.

## Frontend

### `stores/command.ts` (new)

```typescript
interface CommandStore {
  commands: QuickCommand[];
  runningMap: Record<string, { sessionId: string; status: 'running' | 'stopping' }>;
  loaded: boolean;

  load(workspaceId: string): Promise<void>;
  create(workspaceId: string, input: CreateCommandInput): Promise<void>;
  update(workspaceId: string, id: string, updates: Partial<QuickCommand>): Promise<void>;
  remove(workspaceId: string, id: string): Promise<void>;
  run(workspaceId: string, commandId: string): Promise<void>;
  stop(workspaceId: string, commandId: string): Promise<void>;
}
```

REST API for CRUD + run/stop. WebSocket events update `runningMap` reactively.

### `stores/terminal.ts` changes

`TerminalSession` adds optional `commandId` field. When `command.started` event arrives, find the session by `sessionId` and tag it.

### `terminal-panel.tsx` changes

Layout becomes horizontal split:

```
┌──────────────────────────────────────────────────┐
│  Tab bar (existing)                     [+ Add]  │
├──────────────┬───────────────────────────────────┤
│  Command     │  Terminal content (existing)       │
│  list        │                                   │
│  (200px)     │                                   │
│  resize|     │                                   │
└──────────────┴───────────────────────────────────┘
```

- **Left panel**: 200px fixed width, resizable via drag handle
- **Header right**: `[+]` button opens `CommandDialog`
- **Command list items**:
  - Left: run/stop toggle button (Play/Circle icon)
  - Center: command name
  - Right (hover): edit + delete icons
  - Running indicator: green dot or spinner for running commands
- **Click run**: calls `store.run()` -> backend creates terminal + executes command -> `terminal.created` event adds new tab -> `command.started` event updates running state
- **Click stop**: calls `store.stop()` -> backend sends Ctrl+C -> terminal tab preserved

### `command-dialog.tsx` (new)

Dialog form for create/edit:

| Field | Control | Required | Default |
|-------|---------|----------|---------|
| Name | Input text | Yes | — |
| Command | Input monospace | Yes | — |
| Working Directory | Input text | No | `boundDirs[0]` |
| Shell | Dropdown (cmd/zsh/bash/powershell) | No | OS default |
| Environment Variables | Dynamic key-value list | No | — |
| Auto Restart | Switch | No | false |

Uses shadcn Dialog + Input + Select + Switch components.

### i18n

Add `commands` namespace keys to `zh.json` / `en.json`:

- `commands.title`, `commands.addCommand`, `commands.editCommand`
- `commands.name`, `commands.command`, `commands.workingDirectory`, `commands.shell`
- `commands.environmentVariables`, `commands.autoRestart`
- `commands.run`, `commands.stop`, `commands.delete`, `commands.noCommands`

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `shared/src/types/command.ts` | QuickCommand + CommandProcess types |
| Modify | `shared/src/types/index.ts` | Export command types |
| Create | `server/src/services/command.ts` | Command CRUD (commands.json) |
| Create | `server/src/services/command-process-manager.ts` | Process manager (run/stop/autoRestart) |
| Create | `server/src/routes/command.ts` | REST API (6 endpoints) |
| Modify | `server/src/app.ts` | Register command route |
| Modify | `server/src/ws/terminal-handler.ts` | PTY exit -> process manager hook |
| Modify | `server/src/services/builtin-tools.ts` | 3 new Agent tools |
| Modify | `shared/src/types/tool.ts` | 3 new BuiltInAgentToolName |
| Modify | `shared/src/types/events.ts` | 3 new WebSocket events |
| Create | `web/src/stores/command.ts` | Command store (CRUD + running state) |
| Modify | `web/src/stores/terminal.ts` | TerminalSession.commandId |
| Modify | `web/src/components/terminal/terminal-panel.tsx` | Left sidebar + split layout |
| Create | `web/src/components/terminal/command-dialog.tsx` | Command create/edit dialog |
| Modify | `web/src/locales/zh.json` | Chinese translations |
| Modify | `web/src/locales/en.json` | English translations |

**Total: 5 new files + 11 modified files.**
