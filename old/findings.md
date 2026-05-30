# Hermes Runtime Findings

## Existing Runtime Architecture
- `packages/server/src/adapters/agent-runtime.ts` is a simple factory over `AgentRuntimeKind`.
- `packages/server/src/adapters/agent-runtime-types.ts` defines the shared server runtime interface.
- `CodexRuntime` is the closest local implementation pattern for a CLI/agent runtime, but it uses `@openai/codex-sdk` structured events.
- Runtime kinds are also validated in `packages/server/src/services/agent.ts`.
- Runtime kinds are duplicated in shared workspace types and web runtime options.
- Web labels are in `packages/web/src/locales/en/agent.json`, `packages/web/src/locales/zh/agent.json`, and `packages/web/src/components/chat/member-info-card.tsx`.
- Session resume prompt behavior is special-cased in `packages/server/src/ws/agent-runner.ts` for `claude-code` and `codex`; Hermes resume should not be enabled until CLI session-id handling is verified.

## Hermes Constraints
- Hermes is expected to be available as an external `hermes` CLI.
- The local environment does not currently expose a `hermes` command.
- Hermes profile support can provide independent per-agent config/state.
- Verbose output can expose chain/tool details, but the initial adapter should treat it as text unless a stable structured stream is available.
- Agent Spaces built-in function tools cannot be passed directly to Hermes without a bridge; MCP is the pragmatic future bridge.
- Official CLI examples show `hermes chat -q`, `--model`, `--provider`, `--verbose`, and `-s` for preloading skills.
- Configuration docs state settings live under `~/.hermes/`, and `HERMES_HOME` is supported for scoped home/config files.

# Codex Runtime Tool Findings

## Root Cause
- `runMentionedAgent()` builds built-in Agent Spaces tools via `createIssueFunctionTools()`, `createCommandFunctionTools()`, `createDatabaseFunctionTools()`, and `createKanbanFunctionTools()`, then passes them as `AgentRunOptions.functionTools`.
- `ClaudeCodeRuntime` converts those `functionTools` into an in-process SDK MCP server named `agent-spaces`.
- `CodexRuntime` currently only normalizes `options.mcpServers`; it does not include `options.functionTools` in Codex config.
- The prompt still tells the model to call names such as `mcp__agent-spaces__ListDatabases`, but Codex has no actual `agent-spaces` MCP server/tool registered, so the model reports that the tool is unavailable.

## Fix
- Added a Codex-only bridge that exposes `AgentFunctionTool[]` as a short-lived local Streamable HTTP MCP server named `agent-spaces`.
- `CodexRuntime` starts the bridge before creating the Codex thread, merges its URL into `mcp_servers`, and closes it in `finally`.
- The bridge uses stateful MCP sessions because the MCP SDK rejects reusing a stateless transport across the initialize/list/call request sequence.
- Prompt context now receives `runtimeKind`, so Codex prompts say runtime tools are available through Codex instead of Claude Code.
- Database and Kanban built-in tool instructions are now runtime-neutral and still use the MCP callable names such as `mcp__agent-spaces__ListDatabases`.

## Verification
- `pnpm --filter @agent-spaces/shared build && pnpm --filter @agent-spaces/server build` passed.
- Standard MCP client smoke test against `startCodexFunctionToolBridge()` passed: `listTools()` returned `EchoTool`, and `callTool()` returned the expected JSON response with `structuredContent`.

## Relevant Files
- `packages/server/src/adapters/codex-runtime.ts`
- `packages/server/src/adapters/codex-function-tool-bridge.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/adapters/claude-code-runtime/sdk-config.ts`
- `packages/server/src/ws/agent-runner.ts`
- `packages/server/src/ws/agent-prompt.ts`
- `docs/function-call-tools.md`

# Web Memory Usage Findings

## Likely Retention Points
- `packages/web/src/components/terminal/terminal-instance.tsx` keeps a global `terminalRegistry` alive across mounts; old session terminals are only disposed when the session is explicitly removed.
- `packages/web/src/stores/terminal.ts` clears session state on workspace switch, but does not clear the global terminal registry, so old xterm instances can survive a workspace change.
- `packages/web/src/stores/activity-log.ts` starts websocket listeners per workspace and exposes `stopActivityLogListeners()`, but current callers do not clean them up on unmount.
- `packages/web/src/components/layout/workspace-shell.tsx` starts activity-log listeners and loads workspace state on mount, making it the right place to dispose listeners on unmount.

## Reporting Approach
- Use a lightweight periodic snapshot rather than a heavy profiler.
- Prefer counts and aggregate string lengths from stores plus `performance.memory` when the browser exposes it.
- Surface the history through an existing global command entry so the report is easy to open without adding another always-visible panel.
- xterm exposes enough buffer metadata to estimate retained terminal output per session from the active buffer.
- Browser-side GC is not a standard production control surface. It can only be requested in diagnostic environments where `window.gc` is exposed, so the real fix path remains disposing objects and limiting retained buffers.
