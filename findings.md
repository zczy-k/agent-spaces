# Findings

## Baseline Behavior

- Scheduler:
  - `packages/server/src/agents/scheduler-agent.ts`
  - Finds `draft` or `changes_requested` issues.
  - Calls `runPlanner(workspaceId, nextIssue.id, ctx)`.

- Planner:
  - `packages/server/src/agents/planner-agent.ts`
  - Uses issue channel members to find planner.
  - Runs runtime with `buildPlannerPrompt(plannedIssue)`.
  - This hardcoded prompt is the main problem: it overrides the configured planner agent instructions.
  - Creates exactly one task:
    - title: `Implement: ${issue.title}`
    - description: `issue.description`
  - Immediately calls internal `runExecutor()`.

- Executor:
  - Currently implemented inside `planner-agent.ts`.
  - Finds executor from issue channel members.
  - Assigns task to an agent session.
  - Calls runtime.
  - Calls `onExecutorComplete()`.

- Hook:
  - `packages/server/src/hooks/agent-hooks.ts`
  - `onExecutorComplete()` triggers reviewer on any successful executor result.
  - This is why reviewer was incorrectly started after the fake planner-created task.

- Reviewer:
  - `packages/server/src/agents/reviewer-agent.ts`
  - Finds reviewer from issue channel members.
  - Runs runtime with a hardcoded review prompt.
  - Currently mock-approves.

## UI Update Finding

- Frontend `issue-detail.tsx` reloads comments on `issue.updated`.
- `workspace-shell.tsx` upserts full issues on `issue.updated`.
- `issue.status_changed` payload only has `{ issueId, from, to }`, so it cannot update title/status/updatedAt in issue list/detail reliably.
- Backend agent flows should broadcast `issue.updated` with full `Issue` after every status mutation.

## Data Model Finding

- `Task.assignedAgentId` is session id, not agent config id.
- New field should be `Task.agentConfigId`.
- New dependency field should be `Task.dependsOnTaskIds`.

## Tooling Finding

- `AgentRunOptions.functionTools` exists and Claude Code runtime supports function tools through MCP adapter.
- Existing example: `packages/server/src/services/builtin-tools.ts`
- New task-sync controller can expose custom `AgentFunctionTool[]` without changing runtime adapters.

## Risk Notes

- Replacing tasks must keep `issue.tasks` consistent.
- If the task-sync model emits dependencies by generated task ids, it cannot know them. Use stable task keys in tool input and map them to generated ids.
- Parallel execution may produce write conflicts if multiple executor agents edit same files. Dependency graph should reduce this, but no conflict prevention exists yet.
