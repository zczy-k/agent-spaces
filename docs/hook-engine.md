# Hook Engine

This document describes the current backend hook implementation for Agent Spaces.

## Storage

Hooks are workspace-scoped JSON files loaded from:

```text
${AGENT_SPACES_DATA_DIR:-$HOME/.agent-spaces-data}/workspaces/<workspace-id>/hooks/*.hook.json
```

The loader only reads files ending in `.hook.json`.

Core storage code:

- `packages/server/src/storage/hook-store.ts`
- `packages/server/src/services/hook-engine.ts`
- `packages/shared/src/types/hooks.ts`

The shared shape is:

```ts
interface HookConfig {
  name: string;
  description?: string;
  enabled: boolean;
  hooks: Partial<Record<ClaudeHookEventName, HookRule[]>>;
}

interface HookRule {
  matcher: string;
  type: 'command' | 'webhook' | 'script';
  command?: string;
  url?: string;
  function?: string;
  timeout?: number;
}
```

## Supported Events

The backend currently supports these hook event keys:

```text
SessionStart
UserPromptSubmit
UserPromptExpansion
PreToolUse
PermissionDenied
PostToolUse
PostToolUseFailure
PostToolBatch
Notification
SubagentStart
SubagentStop
TaskCreated
TaskCompleted
Stop
StopFailure
TeammateIdle
InstructionsLoaded
CwdChanged
WorktreeRemove
PreCompact
PostCompact
Elicitation
ElicitationResult
SessionEnd
```

Not every event has a natural source in the current Claude SDK stream. The engine supports all keys above, but only fires events that the runtime emits.

Currently wired Claude Code events include:

- `SessionStart`: emitted before the Claude SDK query starts.
- `UserPromptSubmit`: emitted before Claude receives the prompt.
- `InstructionsLoaded`: emitted when the expanded prompt contains loaded instruction markers.
- `PreToolUse`: emitted from `tool_use`.
- `PostToolUse`: emitted from `tool_result`.
- `PostToolUseFailure`: emitted when a tool result looks like a failure.
- `PostToolBatch`: emitted from Claude `tool_use_summary`.
- `Notification`: emitted from SDK notification-like system messages.
- `SubagentStart`: emitted from SDK `task_started` system messages.
- `TaskCreated` / `TaskCompleted`: emitted when matching tool-use names are observed.
- `Stop`: emitted when a turn completes or waits for user input.
- `StopFailure`: emitted when the runtime fails.
- `SessionEnd`: emitted in runtime cleanup.

## Matching

Each event has a `matcherValue`.

For tool events, `matcherValue` is the tool name, for example `TodoWrite` or `CreateCurrentChannelIssue`.

For lifecycle events, `matcherValue` is normally `*` unless the runtime has a more specific value.

Rule matching supports:

- `*`: match everything.
- Exact string: match the value exactly.
- Regex string: strings that start and end with `/`, for example `/.*Database.*/`.

Invalid regex matchers do not throw. The engine logs a warning and falls back to exact matching.

## Execution Flow

Runtime events enter the hook engine through:

```ts
wrapOnEventWithHooks(onEvent, workspaceId, hooksEnabled)
```

The wrapper:

1. Loads enabled workspace hook configs once when the runtime starts.
2. For normal runtime events, forwards the event to the original handler.
3. For internal `hook_event` events, keeps the event backend-only and does not forward it to UI/SSE consumers.
4. Resolves tool-use ids so `tool_result` can trigger `PostToolUse`.
5. Falls back to the most recent `tool_use` when Claude Code returns a tool result without a `toolUseId`.
6. Executes all matching rules concurrently with `Promise.allSettled`.

Hook command/webhook errors are logged and swallowed. They do not block the agent run.

## Rule Types

### `command`

Runs with `node:child_process.exec`.

Timeout defaults to `10000ms` and is capped at `30000ms`.

The process receives the normal server environment plus hook-specific variables:

```text
HOOK_NAME
HOOK_PHASE
HOOK_EVENT_NAME
HOOK_EVENT_PAYLOAD
HOOK_MATCHER_VALUE
HOOK_RULE_MATCHER
HOOK_RULE_TYPE
HOOK_RULE_TIMEOUT
HOOK_TOOL_NAME
HOOK_TOOL_USE_ID
HOOK_TOOL_INPUT
HOOK_TOOL_RESULT
HOOK_WORKSPACE_ID
HOOK_TRIGGER_CHECKED_RULES
HOOK_TRIGGER_MATCHED_RULES
HOOK_TRIGGERED_AT
```

For `UserPromptSubmit`, `HOOK_EVENT_PAYLOAD` contains both:

- `userMessage`: the low-noise user prompt passed through `AgentRunOptions.userPrompt`.
- `fullPrompt`: the expanded prompt actually sent to Claude.

This separation is intentional. Hook consumers that need to understand the user request should read `userMessage`, not `fullPrompt`.

For `Stop`, `HOOK_EVENT_PAYLOAD` contains:

- `message`
- `finalMessage`
- `output`
- status and usage metadata when available

### `webhook`

Sends a JSON `POST` request to `rule.url`.

The request body includes:

```ts
{
  event,
  toolName,
  matcherValue,
  toolInput,
  toolResult,
  payload,
  timestamp,
  workspaceId
}
```

Non-2xx responses and network failures are logged but do not fail the agent run.

### `script`

`script` is recognized by the schema but not implemented. The engine logs a warning and skips it.

## Prompt Handling

Agent execution often sends an expanded prompt to the runtime. That prompt may contain:

- persistent agent instructions
- workspace prompt
- runtime configuration
- conversation history
- built-in tool context
- user message

For hooks, this expanded prompt is noisy. The backend therefore supports `AgentRunOptions.userPrompt`.

Main runtime callers pass the low-noise prompt separately:

- chat runner passes `runtimeUserPrompt`
- SSE route passes `userPrompt`
- workflow/task agents pass their task prompt
- database agent passes the database chat prompt
- commit and bot agents pass their request-specific prompt

Claude Code `UserPromptSubmit` logs:

- `userMessage`: low-noise prompt for hook consumers
- `fullPrompt`: expanded prompt for debugging only

## Debug Hook Example

A workspace-local debug setup can place these files in the hooks directory:

```text
hooks/test-all-features.hook.json
hooks/hook-debug-logger.cjs
hooks/hook-debug.log
```

The debug logger should append, not overwrite:

```js
fs.appendFileSync(logFile, `${JSON.stringify(entry, null, 2)}\n\n`, {
  encoding: 'utf8',
  flag: 'a',
});
```

The current debug logger also lifts conversation fields into:

```json
{
  "conversation": {
    "userMessage": "...",
    "agentMessage": "..."
  }
}
```

## Current Limitations

- Hooks are loaded once per agent run. Editing a hook file affects new runs, not an already-running engine instance.
- Hook commands are fire-and-forget relative to agent success. Failures are logged and swallowed.
- Blocking or modifying tool execution is not implemented.
- `script` rules are not implemented.
- Some Claude Code hook names exist in upstream Claude Code but are intentionally not listed in the local supported type union because this backend does not currently emit them.
