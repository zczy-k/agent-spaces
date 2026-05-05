# Findings & Decisions

## Requirements
- Move persisted agent execution records from per-workspace `workspaces/{workspaceId}/agents` JSON storage toward user-level `{user}/.agent-spaces-data/agents`.
- Replace JSON storage for agent records with SQLite.
- After each agent run completes, record input and output token usage/cost information in the database.
- Build a shadcn-style usage/billing dashboard based on `/Users/Zhuanz/Downloads/dashboard.html`.
- Render the dashboard in `packages/web/src/components/home/home-page.tsx`.

## Research Findings
- Initial files inspected:
  - `packages/server/src/adapters/agent-runtime.ts` is only the runtime factory.
  - `/Users/Zhuanz/Downloads/dashboard.html` is a compact Usage Dashboard layout with header, metric tiles, daily input/output token bars, cost by model, and recent high-cost queries.
  - `packages/web/src/components/home/home-page.tsx` currently renders workspace cards and has unused/commented dashboard demo imports.
- `packages/server/src/storage/agent-store.ts` was the old per-workspace JSON-backed store writing under `workspaces/{workspaceId}/agents`.
- `packages/server/src/adapters/codex-runtime.ts` emits usage lines in the form `[Usage] tokens=... input=... output=... reasoning=...`.
- Agent completion paths include chat websocket runs, issue planner/task creator/executor/reviewer, and commit agent.
- `node:sqlite` works in the local Node v25.8.1 runtime.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use `node:sqlite` | Available locally, keeps the repo dependency set unchanged. |
| Central SQLite file at `~/.agent-spaces-data/agents/agents.sqlite` | Satisfies requested move away from per-workspace JSON agent records. |
| Keep legacy JSON migration on first SQLite open | Existing sessions remain visible without destructive moves. |
| Record usage from runtime output lines at `agentService.complete` | Centralizes completed-run accounting with minimal changes to runtime adapters. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Shared types were not visible to server build until `@agent-spaces/shared` was built | Ran shared build before server build. |
| SQLite binding rejects `undefined` | Convert optional values to `null` before SQL binding. |

## Resources
- `packages/server/src/adapters/agent-runtime.ts`
- `packages/web/src/components/home/home-page.tsx`
- `/Users/Zhuanz/Downloads/dashboard.html`
- `packages/server/src/storage/agent-store.ts`
- `packages/server/src/storage/usage.ts`
- `packages/web/src/components/home/usage-dashboard.tsx`
