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
