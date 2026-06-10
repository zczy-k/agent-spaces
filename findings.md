# Findings

- Initial issue: execution completion selected the execution log but did not call `enterPreview(log)`. A small auto-preview effect was added in `workflow-editor.tsx` before this follow-up request.
- Current editor locks preview through `isWorkflowReadOnly = state.isPreview || isWorkflowRunning`, and `WorkflowCanvas` also computes `isCanvasLocked = isPreview || isRunning`.
- Node/edge/group operation hooks call `markDirty()` for edits. In preview this must not trigger the normal dirty/autosave path.
- Version creation is available via `workflowVersionApi.add(workflowId, name, nodes, edges)`, used by `WorkflowVersionPanel`.
