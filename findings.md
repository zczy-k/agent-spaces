# Findings & Decisions

## Requirements
- User reports that after entering execution record preview mode, workflow nodes do not show the bottom-right icon for hovering/opening node output logs.
- Reference behavior is in `/Users/Zhuanz/Documents/work_fox/src/components/workflow/CustomNodeWrapper.vue`.

## Research Findings
- WorkFox `CustomNodeWrapper.vue` computes the current node's execution step from `store.isPreview ? store.selectedExecutionLog : store.executionLog`.
- WorkFox shows an execution result affordance when node status is `completed` or `error` and an execution step exists.
- The WorkFox popover includes error, input, output, and node logs.
- Agent Spaces `WorkflowCanvas` currently passes only `isRunning` into node data, and only when the log status is `running`.
- Agent Spaces `WorkflowNode` already tracks hover state and has absolute hover controls, so the missing feature belongs there.
- Agent Spaces already has `Popover` and `JsonViewer` components used by the execution bar.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `executionStep` to `WorkflowNodeData` | Gives each rendered node all data needed for its own result popover |
| Use a compact bottom-right `FileText` icon | Matches the user's requested visual affordance and avoids expanding node height |
| Use `HoverCard` instead of `Popover` | User explicitly requested hover-card floating display |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| In-app browser `iab` was unavailable | Could not perform screenshot verification; used static checks |
