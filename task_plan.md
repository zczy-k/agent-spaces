# Task Plan

## Goal
Add a workflow-agent floating chat entry to `packages/web/src/components/workflow/workflow-editor.tsx`, reusing the existing floating chat widget. The agent runtime must be the existing LangChain runtime, with fixed prompt and enabled tools based on `/Users/Zhuanz/Documents/work_fox/src/lib/agent`, and tool calls should render with custom cards.

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1. Inspect existing workflow editor and floating chat widget | complete | `FloatingChatPanel` is a controlled UI-only component; workflow editor can host it at root. |
| 2. Inspect existing agent runtime/tool-call rendering | complete | `agent-sse` now supports server function tools and fixed LangChain runtime for workflow-agent draft requests. |
| 3. Reference work_fox agent defaults | complete | Ported workflow editor prompt/tool names and behavior into a server function-tools bridge. |
| 4. Implement workflow floating agent | complete | Workflow editor hosts the floating agent, streams SSE events, renders custom tool cards, and applies workflow patches. |
| 5. Add workflow agent model settings and clear controls | complete | Header has model settings and clear actions; settings reuse `AgentEditor` with prompt/tools/runtime locked. |
| 6. Verify build/typecheck and UI behavior | complete | Targeted lint and server build pass; web full tsc is blocked by existing unrelated errors. |
| 7. Persist workflow agent chat messages | complete | Added `chat.json` sidecar storage, REST/SDK/web APIs, editor restore/autosave, and backend clear. |
| 8. Polish workflow floating chat controls | complete | Removed empty assistant placeholder text, added stop button while sending, and jump scroll to bottom when opened. |
| 9. Fix thinking block rendering with custom chat content | complete | `<think>...</think>` is extracted before custom message renderers run, so custom workflow chat content still shows a collapsible thinking block. |
| 10. Add per-message hover actions | complete | Added hover-only copy/delete icons below messages and wired deletion in workflow/database chat state. |
| 11. Remove empty waiting bubble | complete | Empty agent messages no longer render a bubble; the dots indicator remains the waiting UI. |
| 12. Interleave workflow thinking and tool timeline | complete | Workflow chat now stores ordered timeline items so multiple thinking blocks render between tool cards in event order. |
| 13. Distinguish timeline messages from thinking | complete | Normal streamed output now renders as ordered message timeline items; only text inside `<think>` or explicit reasoning events renders as thinking. |
| 14. Pin and accumulate workflow thinking | complete | Merge all thinking chunks into the first timeline item and render it before message/tool items. |
| 15. Migrate workflow property field editors from Vue | in_progress | Restore output field details, variable insertion, property collapsibles, and array item variable mode in React. |
| 16. Verify workflow field migration | pending | Run targeted type/lint checks for touched workflow components. |

## Decisions

- Planning files live at project root as required by the planning skill.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Browser plugin returned `Browser is not available: iab` | Visual verification | Fell back to local HTTP checks; will retry only if browser becomes available. |
| Web full `tsc --noEmit` failed | Verification | Existing errors are in `workflow-operation-history.tsx` and `workflow-properties-panel.tsx`, not in modified files. |
