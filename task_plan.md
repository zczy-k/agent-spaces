# Task Plan - Issue Planning and Task Orchestration

## Context

User is opening a new session. The next agent should continue from this file instead of restarting discovery.

Current repository root: `g:/agent_spaces`

User requirements, restated:

1. When backend auto-detects a `draft` issue and starts planner mode, frontend `issue-list` and `issue-detail` must update immediately.
2. Planner agent must not be prompted with the hardcoded `buildPlannerPrompt()` text in `packages/server/src/agents/planner-agent.ts`. It should run with the configured planner agent prompt/system prompt and the actual issue context, without overriding the planner agent's own behavior.
3. After planner finishes writing the plan file, a separate agent/controller should run with a custom prompt and limited MCP/function tools. Its job is to update the current issue's `tasks`.
4. Task records need richer fields:
   - bind to an agent config id, not just runtime session id;
   - support predecessor/dependency task ids;
   - still keep existing runtime session assignment field.
5. Task-sync agent must know which agents are members of the issue channel and which ids are valid for assignment.
6. Issue task execution should respect task dependencies:
   - tasks with all predecessors complete can run;
   - independent tasks may run in parallel;
   - blocked tasks wait until predecessors complete.
7. Prefer a new standalone controller file for task sync + task scheduling instead of continuing to grow `planner-agent.ts`.

## Current Git State

At the time this plan was written, `git status --short` showed only:

```text
 M packages/server/src/routes/task.ts
 M packages/server/src/services/task.ts
 M packages/shared/src/types/task.ts
?? findings.md
?? progress.md
?? task_plan.md
```

No commits or branch operations were performed.

## Completed Work

Phase 1 - Inspect Baseline: complete

Findings:
- `scheduler-agent.ts` calls `runPlanner(workspaceId, issueId, ctx)` for draft/changes_requested issues.
- `planner-agent.ts` currently:
  - updates issue status to `planned`;
  - broadcasts only `issue.status_changed`, not always a full `issue.updated`;
  - runs `runtime.execute(buildPlannerPrompt(plannedIssue), ...)`, which overrides the configured planner agent prompt;
  - creates one hardcoded task from issue title/description;
  - moves issue to `in_progress`;
  - immediately calls internal `runExecutor()`;
  - internal executor calls `onExecutorComplete()`, which triggers reviewer.
- Frontend issue list/detail reliably update from `issue.updated`, because that event carries the full issue object. `issue.status_changed` carries only `{ issueId, from, to }`.
- Existing `Task.assignedAgentId` is used as an agent session id when executor starts. Do not repurpose it for config binding.

Phase 2 - Data Model: complete

Already modified:

`packages/shared/src/types/task.ts`
- Added:
  - `agentConfigId?: string`
  - `dependsOnTaskIds?: string[]`

`packages/server/src/services/task.ts`
- `create()` now accepts:
  - `agentConfigId`
  - `dependsOnTaskIds`
  - `sandboxDirs`
- `update()` now accepts:
  - `agentConfigId`
  - `dependsOnTaskIds`
  - `sandboxDirs`
- Added `replaceIssueTasks(workspaceId, issueId, data)`:
  - deletes non-running existing tasks for the issue;
  - creates new tasks with rich fields;
  - currently does not update `issue.tasks`; next agent should fix/handle that in the controller.
- Added `normalizeTaskIds()`.

`packages/server/src/routes/task.ts`
- POST/PUT now pass through `agentConfigId`, `dependsOnTaskIds`, and `sandboxDirs`.

## Important Current Files

Read these first:

- `packages/server/src/agents/planner-agent.ts`
- `packages/server/src/agents/scheduler-agent.ts`
- `packages/server/src/hooks/agent-hooks.ts`
- `packages/server/src/agents/reviewer-agent.ts`
- `packages/server/src/services/task.ts`
- `packages/server/src/services/issue.ts`
- `packages/server/src/services/channel.ts`
- `packages/server/src/services/agent.ts`
- `packages/server/src/adapters/agent-runtime-types.ts`
- `packages/server/src/ws/handler.ts`
- `packages/shared/src/types/task.ts`
- `packages/shared/src/types/issue.ts`
- `packages/shared/src/types/workspace.ts`
- `packages/web/src/stores/issue.ts`
- `packages/web/src/components/issue/issue-detail.tsx`

## Recommended Architecture

### 1. Create New Controller

Add a new file, recommended path:

`packages/server/src/agents/issue-task-controller.ts`

Responsibilities:

- `syncIssueTasksAfterPlanning(workspaceId, issueId, plannerResult, ctx)`
  - Runs after planner completes successfully.
  - Calls a selected task-sync agent or runtime with custom prompt.
  - Exposes limited function tools only.
  - Lets tool update/replace tasks.
  - Broadcasts `task.created`/`task.updated`/`issue.updated`.
  - Then starts dependency scheduler.

- `scheduleRunnableIssueTasks(workspaceId, issueId, ctx)`
  - Reads issue tasks.
  - Starts all pending tasks whose dependencies are done.
  - Does not start tasks already running/retrying/waiting_review.
  - If no runnable task and all tasks done, update issue to completed/approved depending on existing status model.

- `runIssueTask(workspaceId, issueId, taskId, ctx)`
  - Similar to current internal `runExecutor()` from `planner-agent.ts`.
  - Select executor agent:
    - prefer `task.agentConfigId`;
    - fallback to first enabled `executor` agent in issue channel members.
  - Create/reuse session with `agentService.getOrCreateSessionForConfig()`.
  - Assign task session via `taskService.assignAgent()` so `assignedAgentId` remains session id.
  - Execute runtime with executor preset config.
  - On completion:
    - mark task done/failed or call reviewer depending on desired existing review semantics;
    - broadcast full `task.updated` and `task.status_changed`;
    - call `scheduleRunnableIssueTasks()` again so successors can start.

### 2. Function Tools for Task Sync Agent

Use `AgentFunctionTool[]` from `packages/server/src/adapters/agent-runtime-types.ts`.

Suggested limited tools:

- `ViewIssueTaskPlanningContext`
  - read-only;
  - returns issue, existing tasks, channel members, valid assignable agents.
  - assignable agents should include id/name/role/description and only channel members where `enabled !== false`.

- `ReplaceIssueTasks`
  - destructive but closed-world;
  - input schema roughly:

```json
{
  "type": "object",
  "properties": {
    "issueId": { "type": "string" },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "agentConfigId": { "type": "string" },
          "dependsOnTaskIds": {
            "type": "array",
            "items": { "type": "string" }
          },
          "sandboxDirs": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["title", "description"],
        "additionalProperties": false
      }
    }
  },
  "required": ["issueId", "tasks"],
  "additionalProperties": false
}
```

Implementation detail:
- Dependency ids are difficult if the model creates new tasks and does not know generated ids.
- Preferred practical schema:
  - let task-sync tool accept client-provided stable `key` per task and `dependsOnKeys`;
  - controller maps keys to generated task ids;
  - stores `dependsOnTaskIds` in actual tasks.
- If using this better schema, update `replaceIssueTasks()` or implement mapping inside the controller.

Suggested task item shape for tool:

```ts
{
  key: string;
  title: string;
  description: string;
  agentConfigId?: string;
  dependsOnKeys?: string[];
  sandboxDirs?: string[];
}
```

Then map:

1. create all tasks without dependencies;
2. build `key -> task.id`;
3. update each task's `dependsOnTaskIds` from `dependsOnKeys`.

### 3. Planner Flow Changes

Modify `packages/server/src/agents/planner-agent.ts`:

- Remove or stop using `buildPlannerPrompt()`.
- Do not create hardcoded tasks in planner.
- Do not call internal `runExecutor()`.
- After status update to planned:
  - broadcast `issue.status_changed`;
  - also broadcast full `issue.updated` with `issueService.getById(...)`.
- Execute planner with prompt that preserves configured agent behavior.

Recommended prompt construction:

```ts
const prompt = [
  plannerPreset.systemPrompt?.trim(),
  '',
  'Current issue context:',
  `- Issue id: ${plannedIssue.id}`,
  `- Channel id: ${plannedIssue.channelId}`,
  `- Title: ${plannedIssue.title}`,
  `- Status: ${plannedIssue.status}`,
  `- Description: ${plannedIssue.description || '(empty)'}`,
].filter(Boolean).join('\n');
```

This is not ideal if `systemPrompt` is also passed elsewhere, but current runtime API only takes a prompt string. The key is to not replace the user's configured planner instructions with the hardcoded Chinese planner prompt.

After planner result:

```ts
await syncIssueTasksAfterPlanning(workspaceId, issueId, {
  plannerPreset,
  plannerSessionId: planner.id,
  planSummary: planResult.summary,
  planOutput: tracker.output.length ? tracker.output : planResult.output,
}, ctx);
```

Then complete planner. Do not directly schedule executor inside planner; let controller own that.

### 4. UI Update Fix

Backend fix should be enough:

- Whenever issue status changes in backend agent flow, broadcast:
  - `issue.status_changed` for narrow status consumers;
  - `issue.updated` with the full issue object for stores.

Specific in planner:

```ts
const updated = issueService.updateStatus(...);
if (updated) {
  ctx.broadcast('issue.status_changed', ...);
  ctx.broadcast('issue.updated', updated);
}
```

Also do this for later `in_progress`/`completed` updates in the new controller.

### 5. Dependency Scheduling Algorithm

Pseudo:

```ts
export async function scheduleRunnableIssueTasks(workspaceId, issueId, ctx) {
  const tasks = taskService.list(workspaceId, issueId);
  const done = new Set(tasks.filter(t => t.status === 'done').map(t => t.id));
  const active = tasks.some(t => ['running', 'retrying', 'waiting_review'].includes(t.status));
  const runnable = tasks.filter(t =>
    t.status === 'pending' &&
    (t.dependsOnTaskIds ?? []).every(id => done.has(id))
  );

  if (runnable.length === 0) {
    if (!active && tasks.length > 0 && tasks.every(t => t.status === 'done')) {
      update issue completed and broadcast issue.updated;
    }
    return;
  }

  await Promise.all(runnable.map(t => runIssueTask(workspaceId, issueId, t.id, ctx)));
}
```

Use caution with parallelism:
- Each runnable task can start in parallel.
- If shared workspace writes collide, user may later want concurrency limits.
- Minimal implementation can use `Promise.all` or a small loop. User explicitly asked dependencies and parallel execution where possible.

### 6. Hook/Reviewer Interaction

Current `onExecutorComplete()` always triggers reviewer on successful executor result.

Options:

- Conservative: keep reviewer after each task, but make scheduler continue only after reviewer marks task `done`.
- If reviewer is not desired for task-sync/planner completion, ensure planner no longer calls executor and no executor hook runs during planning.

The user's latest clarification mainly says reviewer was wrongly started because planner created/executed a fake task. Fixing planner/task controller separation should remove that erroneous reviewer.

Do not call `onExecutorComplete()` from planner.

### 7. Issue Task IDs Sync

Existing issue has `tasks: string[]`, and `issueService.addTask()` appends ids.

When replacing all issue tasks, controller must keep `issue.tasks` consistent.

Options:

- Add `issueService.replaceTasks(workspaceId, issueId, taskIds)`; recommended.
- Or update issue via `issueService.save()` after assigning `issue.tasks = taskIds`.

Recommended service helper:

```ts
export function replaceTasks(workspaceId: string, issueId: string, taskIds: string[]): Issue | null
```

Broadcast `issue.updated` after replacement.

## Current Known Partial Code Changes

These are already in the working tree and need review/continuation:

`packages/shared/src/types/task.ts`
- `agentConfigId?: string`
- `dependsOnTaskIds?: string[]`

`packages/server/src/services/task.ts`
- Expanded `create`, `update`
- Added `replaceIssueTasks`

`packages/server/src/routes/task.ts`
- Expanded POST/PUT request body handling

Potential improvements before finalizing:
- Validate `agentConfigId` belongs to enabled channel member when controller creates tasks.
- Validate dependency ids/keys resolve.
- Update frontend task UI later if user wants to display assignee/dependencies. Not required for backend orchestration but may be useful.

## Current Session Updates

- Added `issueService.replaceTasks()` to keep `issue.tasks` synchronized after task replacement.
- Added `packages/server/src/agents/issue-task-controller.ts`.
- Planner now calls the new controller after successful planning.
- Planner no longer creates a hardcoded single task or invokes executor directly.
- Planner prompt now combines configured `systemPrompt` with actual issue context.
- Reviewer no longer finalizes the issue after each approved task; dependency scheduling continues from controller after the reviewer hook returns.

## Current Phase

Implementation and compile verification are complete for the requested backend orchestration refactor.

## Follow-up Issues From Manual Test

Status: implemented, awaiting verification.

- Commit message was truncated because the Git panel used a single-line input. It now uses a textarea.
- Agents did not share issue context consistently. Planner, task creator, executor, and reviewer now receive `ViewCurrentChannelIssue` and prompts explicitly require calling it first.
- Removed `ViewIssueTaskPlanningContext` from task creator tools.
- `ViewCurrentChannelIssue` now returns full issue context: issue, comments, tasks, channel metadata, assignable agents, and valid agent config ids.
- Planner was the only agent with issue detail placeholder/comment flow. A shared progress helper now covers planner, task creator, executor, and reviewer.
- Planner comment completion now writes full agent output instead of truncated summary.

## Verification Completed

```powershell
pnpm --filter "@agent-spaces/shared" build
pnpm --filter "@agent-spaces/server" build
pnpm --filter "@agent-spaces/web" build
git -C "g:/agent_spaces" diff --check
```

## Verification Commands

Run after implementation:

```powershell
pnpm --filter "@agent-spaces/shared" build
pnpm --filter "@agent-spaces/server" build
pnpm --filter "@agent-spaces/web" build
```

If web build is too slow, at least run shared + server first because most changes are backend/shared.

## Suggested Next Steps for Next Agent

1. Read this file, `findings.md`, and `progress.md`.
2. Inspect current diffs:

```powershell
git -C "g:/agent_spaces" diff --stat
git -C "g:/agent_spaces" diff -- "packages/shared/src/types/task.ts" "packages/server/src/services/task.ts" "packages/server/src/routes/task.ts"
```

3. Finish Phase 2:
   - add `issueService.replaceTasks()`;
   - ensure routes still build.
4. Implement `packages/server/src/agents/issue-task-controller.ts`.
5. Refactor `planner-agent.ts`:
   - remove hardcoded prompt usage;
   - stop hardcoded task creation/executor call;
   - call new controller after planner completes;
   - broadcast full issue updates.
6. Wire scheduler continuation:
   - executor completion should call dependency scheduler after task done/review done.
7. Run builds.
