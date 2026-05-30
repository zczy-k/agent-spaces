# Hermes Runtime Integration Plan

## Goal
Add a Hermes runtime option to Agent Spaces with a minimal, maintainable CLI-backed adapter.

## Scope
- Add `hermes` as a supported runtime kind across shared types, server validation, runtime factory, and web runtime selector.
- Implement `HermesRuntime` as a child-process adapter around the installed `hermes` CLI.
- Map per-agent configuration into an isolated Hermes home/profile directory where possible.
- Preserve existing runtime behavior and avoid unrelated refactors.

## Phases

| Phase | Status | Work |
| --- | --- | --- |
| 1 | complete | Inspect runtime patterns, config flow, UI/runtime type usage |
| 2 | complete | Implement server-side Hermes runtime adapter and factory wiring |
| 3 | complete | Add shared/web runtime kind support and labels |
| 4 | complete | Run focused type/build checks and fix issues |
| 5 | complete | Document behavior, limitations, and verification steps |
| 6 | complete | Add user-facing Hermes runtime documentation under `docs/` |

## Decisions
- Use a CLI subprocess adapter for Hermes because the target integration is the `hermes` command.
- Keep the first implementation text-stream based; structured tool events can be added once Hermes exposes stable machine-readable output.
- Do not change git branches or create commits.

## Verification
- `pnpm --filter @agent-spaces/shared build`
- `pnpm --filter @agent-spaces/server build`
- `pnpm --filter @agent-spaces/web build`

## Known Limitations
- Hermes must be installed separately and available on `PATH`.
- Runtime output is text-stream based; structured tool events require a stable Hermes machine-readable output mode.
- Agent Spaces built-in function tools are not bridged into Hermes yet; MCP is the intended future integration path.
- Custom base URL is passed through environment variables, not a CLI flag, because the current Hermes CLI examples do not document a `chat --base-url` option.

## Follow-up: Codex Runtime Tool Calls

## Goal
Make Agent Spaces built-in function tools such as `ListDatabases` actually callable from the Codex runtime, rather than only describing them in the prompt.

## Scope
- Trace how `AgentFunctionTool[]` reaches runtime adapters.
- Identify why Codex cannot call `ListDatabases`.
- Add a real Codex-compatible bridge for built-in function tools if supported by the local SDK/CLI.
- Update documentation and run focused verification.

## Phases

| Phase | Status | Work |
| --- | --- | --- |
| C1 | complete | Inspect existing Codex runtime, prompt, and function tool flow |
| C2 | complete | Determine the smallest Codex-compatible tool bridge |
| C3 | complete | Implement the bridge and wire it into `CodexRuntime` |
| C4 | complete | Update docs for Codex function-tool support and limitations |
| C5 | complete | Run focused build/tests |

## Initial Finding
- `CodexRuntime` currently passes configured external `mcpServers` but ignores `options.functionTools`.
- `ListDatabases` is created as an `AgentFunctionTool` in `createDatabaseFunctionTools()` and passed through `runMentionedAgent()`.
- Claude Code converts `functionTools` into an SDK MCP server named `agent-spaces`; Codex has no equivalent bridge yet, so the model sees prompt instructions but has no actual callable tool.

## Codex Follow-up Decisions
- Bridge Codex `functionTools` through a short-lived local Streamable HTTP MCP server named `agent-spaces`.
- Start the bridge only for the current run when `AgentRunOptions.functionTools` is non-empty.
- Listen only on `127.0.0.1` with a random port, then inject that URL into Codex `mcp_servers`.
- Use a stateful MCP transport because the MCP SDK does not allow reusing a stateless transport across initialize/list/call requests.
- Keep Agent Spaces channel tools separate from agent-configured MCP server names in prompt context.

## Codex Follow-up Verification
- `pnpm --filter @agent-spaces/shared build && pnpm --filter @agent-spaces/server build`
- Standard MCP client smoke test against `startCodexFunctionToolBridge()`: `listTools()` returned `EchoTool`; `callTool()` returned the expected JSON and `structuredContent`.

## Errors Encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| `TS18048: 'options' is possibly 'undefined'` in `hermes-runtime.ts` | Server build attempt 1 | Introduced local `agentDir` variable so TypeScript can safely narrow config directory usage |
| Type errors in `codex-function-tool-bridge.ts` around `structuredContent` and schema properties | Codex server build attempt 1 | Return `structuredContent` only for object results and normalize JSON Schema properties to object-valued maps |
| MCP SDK stateless Streamable HTTP transport cannot be reused across requests | Bridge review before final verification | Switched the bridge to a stateful transport with random session IDs |
| Web build failed in `src/components/activity-graph.tsx` on unsupported `Tooltip.Trigger render` prop | Web memory verification | Treated as existing unrelated blocker; targeted ESLint and filtered tsc output for touched files passed |

## Follow-up: Web Memory Usage Optimization

## Goal
Reduce likely long-lived web tab memory retention and add a periodic background report that exposes content/cache size details.

## Scope
- Clean up terminal xterm registry entries when switching workspaces.
- Clean up activity-log websocket listeners when workspace panels unmount.
- Add lightweight content usage snapshots for editor files, channels/messages, terminal sessions, database nodes, activity logs, and browser JS heap when available.
- Make recent reports viewable from the command palette.

## Phases

| Phase | Status | Work |
| --- | --- | --- |
| M1 | complete | Identify likely long-lived terminal/activity-log retention points |
| M2 | complete | Implement cleanup and content usage reporting |
| M3 | complete | Run focused type/build checks; full web build is blocked by an unrelated existing type error in `activity-graph.tsx` |
