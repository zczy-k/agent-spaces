# Findings

- CodeGraph index is healthy for `/Users/Zhuanz/Documents/agent_spaces`.
- Target file: `packages/web/src/components/workflow/workflow-node.tsx`.
- Existing run/delete controls were hover-only absolute buttons inside the node body.
- Execution result/log trigger was owned by `workflow-node-execution-result.tsx` and defaulted to bottom-right.
- React Flow nodes are built in `use-workflow-canvas-data.ts`; customview drag handles need `dragHandle` on the React Flow node plus a matching DOM class.
- Current `NodeResizeControl` type does not accept `isVisible`, so visibility is implemented by conditional rendering.
