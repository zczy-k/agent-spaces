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

## Errors Encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| `TS18048: 'options' is possibly 'undefined'` in `hermes-runtime.ts` | Server build attempt 1 | Introduced local `agentDir` variable so TypeScript can safely narrow config directory usage |
