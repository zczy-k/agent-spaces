# Task Plan: Execution Log Preview Migration

## Goal
Restore the WorkFox execution record preview behavior in Agent Spaces web: selecting an execution history item should preview that log snapshot on the canvas, and exiting preview should restore the live editable workflow.

## Current Phase
Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Inspect WorkFox `ExecutionBar.vue`, `WorkflowEditor.vue`, and `CanvasToolbar.vue` behavior
- [x] Inspect Agent Spaces workflow editor, canvas, execution bar, and hooks
- **Status:** complete

### Phase 2: Diagnosis
- [x] Identify missing current-hook preview state wiring
- [x] Identify incorrect toolbar exit-preview callback
- **Status:** complete

### Phase 3: Implementation
- [x] Add enter/exit preview actions to current editor state hook
- [x] Wire execution log selection to enter preview
- [x] Wire all exit-preview controls to restore the previous workflow
- [x] Prevent preview snapshots from being saved by auto/manual save
- **Status:** complete

### Phase 4: Verification
- [x] Run focused type/lint checks where practical
- [x] Record any existing unrelated blockers
- **Status:** complete

### Phase 5: Delivery
- [ ] Summarize changed files and verification
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Implement in current split hooks instead of old zustand store | `workflow-editor.tsx` no longer uses `packages/web/src/stores/workflow-editor.ts` |
| Restore full workflow from a ref when exiting preview | Matches WorkFox behavior and avoids marking preview as a real edit |
| Keep execution selection state in execution hook | The execution bar already consumes that state; editor coordinates canvas preview |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Full web `tsc --noEmit` fails in unrelated files | 1 | Recorded blockers: `images-badge.tsx`, `message-dock.tsx`, `workflow-version-panel.tsx` |
| Targeted `tsc` with explicit files does not load Next/tsconfig JSX aliases | 1 | Used full `tsc` for project signal and focused ESLint/diff checks for touched files |
