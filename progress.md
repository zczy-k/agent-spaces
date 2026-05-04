# Progress

## Session Summary

- Created planning files for handoff:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
- Inspected current planner/task orchestration baseline.
- Started Phase 2 data-model changes.

## Code Changes Already Made

Working tree currently has partial code changes:

- `packages/shared/src/types/task.ts`
  - Added `agentConfigId?: string`
  - Added `dependsOnTaskIds?: string[]`

- `packages/server/src/services/task.ts`
  - Expanded `create()` input with `agentConfigId`, `dependsOnTaskIds`, `sandboxDirs`.
  - Expanded `update()` input similarly.
  - Added `replaceIssueTasks()`.
  - Added `normalizeTaskIds()`.

- `packages/server/src/routes/task.ts`
  - POST accepts `agentConfigId`, `dependsOnTaskIds`, `sandboxDirs`.
  - PUT accepts those fields too.

## Not Yet Done

- No builds run after the partial changes.
- Added `issueService.replaceTasks()` and made `addTask()` idempotent.
- Created `packages/server/src/agents/issue-task-controller.ts` for task sync, dependency scheduling, and executor startup.
- Refactored `planner-agent.ts` to stop creating a fake task and stop directly running executors.
- Replaced hardcoded planner prompt with configured `systemPrompt` plus current issue context.
- Updated reviewer flow so approved tasks become `done`; controller continues dependency scheduling after reviewer hook returns.

## Current Verification State

- `pnpm --filter "@agent-spaces/shared" build` passed.
- `pnpm --filter "@agent-spaces/server" build` passed.
- `pnpm --filter "@agent-spaces/web" build` passed.
- `git -C "g:/agent_spaces" diff --check` passed.

## Last Known Git Status

```text
 M packages/server/src/routes/task.ts
 M packages/server/src/services/task.ts
 M packages/shared/src/types/task.ts
?? findings.md
?? progress.md
?? task_plan.md
```
