# Task Plan

Goal: Update `workflow-node.tsx` node controls: run/delete in `NodeToolbar` shown on selection, logs icon top right, custom resize control bottom right, and customview drag handle icon top right.

## Phases

- [complete] Inspect current node component and related styles/dependencies.
- [complete] Implement toolbar, log icon placement, resize control, and customview drag handle.
- [complete] Run focused checks and summarize results.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing planning files listed but not readable | Initial restore | Confirmed files did not exist in project root; created fresh task files. |
| `NodeResizeControl` rejected `isVisible` prop | TypeScript check | Changed to conditionally render the control only when selected and editable. |
| Full web lint/type checks fail on unrelated files | Verification | Ran focused ESLint successfully; documented existing full-check failures. |
