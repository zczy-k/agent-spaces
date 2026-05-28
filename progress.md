# Hermes Runtime Progress

## 2026-05-25
- Created file-based plan for Hermes runtime integration.
- Confirmed no existing planning files were present in the project root.
- Completed initial runtime surface scan.
- Confirmed `hermes` CLI is not installed in the current environment, so implementation must fail clearly at runtime when missing.
- Added `HermesRuntime` CLI adapter and wired it into server runtime types, factory, exports, and runtime-kind validation.
- Added `hermes` to shared AgentConfig runtime kind, web runtime selector, member runtime labels, and i18n runtime labels.
- `pnpm --filter @agent-spaces/shared build` passed.
- `pnpm --filter @agent-spaces/server build` initially failed on strict optional access in `hermes-runtime.ts`; fixed by introducing `agentDir`.
- Adjusted Hermes CLI arguments to avoid an undocumented `--base-url` flag and added `-s` skill preloading.
- `pnpm --filter @agent-spaces/server build` passed after the Hermes argument adjustment.
- `pnpm --filter @agent-spaces/web build` exited with code 0 and passed TypeScript; it logged an existing Next deprecation warning and an `ENVIRONMENT_FALLBACK` page-generation message.
- Documented verification results and known limitations in `task_plan.md`.
- Started follow-up documentation task for `docs/hermes-agent-runtime.md`.
- Added `docs/hermes-agent-runtime.md` describing current behavior, configuration mapping, known limitations, troubleshooting, and verification steps.

## 2026-05-28
- Started Codex runtime tool-call investigation after `ListDatabases` was unavailable in Codex.
- Confirmed `CodexRuntime` ignores `AgentRunOptions.functionTools`, while Claude Code bridges them through an SDK MCP server named `agent-spaces`.
- Added Codex follow-up phases and root-cause notes to `task_plan.md` and `findings.md`.
- Added `codex-function-tool-bridge.ts`, a short-lived local Streamable HTTP MCP bridge for Codex `functionTools`.
- Wired Codex runtime to start the bridge, inject it into `mcp_servers.agent-spaces`, and close it after each run.
- Updated prompt runtime context so Codex is no longer described as Claude Code, and made built-in database/Kanban tool instructions runtime-neutral.
- Updated Codex/function-tool docs for the new bridge behavior.
- `pnpm --filter @agent-spaces/shared build && pnpm --filter @agent-spaces/server build` passed.
- MCP client smoke test against the compiled bridge passed for `listTools()` and `callTool()`.

## 2026-05-29
- Investigated background-tab memory growth in the web app and identified terminal registry retention plus activity-log listener cleanup as the highest-risk spots.
- Moved the terminal xterm registry into a shared utility module so session cleanup can happen on workspace switches, not only when sessions are explicitly closed.
- Added workspace-switch cleanup for terminal registry entries in `useTerminalStore.init()`.
- Added `stopActivityLogListeners()` cleanup to `WorkspaceShell` unmount so websocket listeners do not accumulate across workspace changes.
- Added a periodic content usage reporter with a command-palette entry and a dialog for viewing recent snapshots.
- The reporter captures heap, editor, terminal, chat, issue/task, database, command, notification, and activity-log counts.
- Ran targeted ESLint on the touched web files successfully.
- Ran `pnpm --filter @agent-spaces/web build`, which failed in an unrelated existing type error in `src/components/activity-graph.tsx` before reaching this patch's files.
