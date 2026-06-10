# Task Plan

Goal: Allow workflow execution preview mode to remain editable without auto-persisting, and add a toolbar action to save preview edits either directly or as a new version before saving.

## Phases

1. Complete - Trace preview locking, edit persistence, and version creation APIs.
2. In progress - Update preview/edit state so canvas and node properties are editable in preview but not auto-saved.
3. Pending - Add toolbar "保存编辑" dialog with save, create-version-and-save, and cancel actions.
4. Pending - Validate with lint/type checks where practical and summarize residual repo issues.

## Decisions

- Keep preview edits in editor state only until the new explicit save action is confirmed.
- Use existing workflow/version APIs and component patterns rather than adding a new persistence path unless required.
- Treat running/paused execution as read-only, but allow editing once execution preview has completed.
