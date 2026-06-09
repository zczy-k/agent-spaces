# Progress

- Started task and created fresh planning files because prior listed planning files were not present when read.
- Replaced hover run/delete node controls with `NodeToolbar` buttons.
- Moved execution result/log trigger to top-right via a new `triggerClassName` prop.
- Replaced `NodeResizer` with bottom-right `NodeResizeControl` and a custom `MoveDiagonal` icon.
- Added customview-only top-right drag handle icon and set React Flow `dragHandle` for nodes with `customView`.
- Added English/Chinese `nodeUi.drag` and `nodeUi.delete` labels.
- Focused ESLint passed for modified workflow component files.
- Full `tsc --noEmit` still fails on pre-existing errors outside this change set.
