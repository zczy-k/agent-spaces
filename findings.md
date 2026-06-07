# Findings & Decisions

## Requirements
- Reference behavior:
  - `/Users/Zhuanz/Documents/work_fox/src/components/workflow/ExecutionBar.vue` lines 478-484: selecting an execution history item calls `selectLog(log)`.
  - `/Users/Zhuanz/Documents/work_fox/src/components/workflow/WorkflowEditor.vue`: selection enters preview mode with the execution snapshot.
  - `/Users/Zhuanz/Documents/work_fox/src/components/workflow/CanvasToolbar.vue` lines 134-142: preview mode shows an exit-preview button.
- Restore the same behavior in `/Users/Zhuanz/Documents/agent_spaces/packages/web/src/components/workflow/workflow-editor.tsx`.

## Research Findings
- Agent Spaces already has preview UI surface:
  - `WorkflowCanvas` receives `isPreview` and locks editing.
  - `CanvasToolbar` displays `退出预览` when `isPreview` is true.
  - `WorkflowExecutionBar` calls `onSelectLog(item)` when a history entry is clicked.
- Current split-hook editor state only has `isPreview` and `setIsPreview`; it does not preserve the live workflow or replace the canvas with `log.snapshot`.
- `useWorkflowEditorExecution.handleSelectExecutionLog` only sets the selected/current log and status.
- Old `packages/web/src/stores/workflow-editor.ts` still contains the WorkFox-like logic:
  - keep `_prePreviewWorkflow`
  - replace nodes/edges/groups with `log.snapshot`
  - restore the pre-preview workflow on exit.
- `WorkflowEditorToolbar` currently renders a top `退出预览` button but calls `onBack`, which leaves the editor instead of exiting preview.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `enterPreview(log)` and `exitPreview()` to `useWorkflowEditorState` | Current editor uses this hook as its workflow source of truth |
| Deep-copy workflow and snapshot via JSON helpers | Matches existing store behavior and avoids snapshot mutation through editor state |
| Set selected node state to empty when entering/exiting preview | Prevents stale selection from pointing at missing nodes |
| Skip save while `isPreview` is true | Prevents dirty workflows from auto-saving an execution snapshot as the live workflow |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Existing worktree has unrelated modified files | Leave unrelated changes untouched |
| Full web `tsc --noEmit` is blocked by unrelated type errors | Record and report the blocking files |

## Resources
- Current editor: `packages/web/src/components/workflow/workflow-editor.tsx`
- Current state hook: `packages/web/src/components/workflow/use-workflow-editor-state.ts`
- Current execution hook: `packages/web/src/components/workflow/use-workflow-editor-execution.ts`
- Current toolbar: `packages/web/src/components/workflow/workflow-editor-toolbar.tsx`
