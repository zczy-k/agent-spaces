# Function-Call Tools

This document describes the server-side function-call tool layer used by agents.

## Goals

Function-call tools must be real executable server-side capabilities, not prompt-only descriptions.

The layer provides:

- A runtime-neutral tool abstraction.
- Server-owned execution for workspace data operations.
- Strict channel-scoped validation for built-in issue tools.
- Runtime adapters that can expose the same tools through their native tool protocol.

## Core Abstraction

The shared server abstraction is `AgentFunctionTool` in:

```text
packages/server/src/adapters/agent-runtime-types.ts
```

Shape:

```ts
interface AgentFunctionTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    openWorld?: boolean;
  };
  execute: (input: unknown) => Promise<unknown>;
}
```

Runtime handlers receive these tools through `AgentRunOptions.functionTools`.

## Built-In Issue Tools

The current built-in tools live in:

```text
packages/server/src/services/builtin-tools.ts
```

Tools:

- `CreateCurrentChannelIssue`
- `ViewCurrentChannelIssue`

Both tools are available only when the active channel is an issue channel with a bound `issueId`.

Important constraints:

- Tool input must include `issueId`.
- `issueId` must match the current channel's bound `issueId`.
- The tool cannot create or view arbitrary issue ids from another channel.
- Creating or updating the current issue does not create another channel. Issue creation already creates and binds its channel in `issueService.create()`.

## Runtime Integration

### Claude Code Runtime

Implemented in:

```text
packages/server/src/adapters/claude-code-runtime.ts
```

Claude integration uses the Claude Agent SDK in-process SDK MCP server:

- `createSdkMcpServer()`
- `tool()`

The server registers an MCP server named:

```text
agent-spaces
```

Each `AgentFunctionTool` is converted into an SDK MCP tool. When the model calls the tool, the server executes `AgentFunctionTool.execute()` and returns the JSON result as MCP tool output.

### Other Runtimes

`codex` and `open-agent-sdk` currently do not expose the same local function-tool registration path in this codebase.

They should not pretend to support these tools through prompt-only behavior. Future adapter work should map their native custom tool API, if available, into the same `AgentFunctionTool` abstraction.

## Execution Flow

1. `runMentionedAgent()` loads the active channel.
2. `createIssueFunctionTools(workspaceId, channel)` returns channel-scoped tools.
3. The tools are passed to `runtime.execute()` as `functionTools`.
4. Runtime adapter exposes tools through its native tool protocol.
5. Model calls the function tool.
6. Server executes `AgentFunctionTool.execute(input)`.
7. Runtime emits `tool_use` / `tool_result` events.
8. WebSocket handler stores tool details and broadcasts updated channel / issue state.

## UI Surface

The chat input `Tools` menu displays built-in issue tools:

```text
packages/web/src/components/chat/chat-input.tsx
```

These entries are visible for all channels but disabled unless the current channel is an issue channel with a bound `issueId`.

The UI is only a capability indicator. Actual authorization and scoping are enforced on the server.

## Validation Rules

The built-in issue tools enforce validation in the service layer:

- input must be an object
- `input.issueId` must equal `channel.issueId`
- bound issue must exist

This keeps the trust boundary on the server even if a model or client sends malformed tool input.
