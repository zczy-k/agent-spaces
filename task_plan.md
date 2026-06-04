# Task Plan

## Goal
Add a workflow-agent floating chat entry to `packages/web/src/components/workflow/workflow-editor.tsx`, reusing the existing floating chat widget. The agent runtime must be the existing LangChain runtime, with fixed prompt and enabled tools based on `/Users/Zhuanz/Documents/work_fox/src/lib/agent`, and tool calls should render with custom cards.

## Phases

| Phase | Status | Notes |
|---|---|---|
| 1. Inspect existing workflow editor and floating chat widget | complete | `FloatingChatPanel` is a controlled UI-only component; workflow editor can host it at root. |
| 2. Inspect existing agent runtime/tool-call rendering | complete | `agent-sse` now supports server function tools and fixed LangChain runtime for workflow-agent draft requests. |
| 3. Reference work_fox agent defaults | complete | Ported workflow editor prompt/tool names and behavior into a server function-tools bridge. |
| 4. Implement workflow floating agent | in_progress | Keep edits scoped and consistent with existing app patterns. |
| 5. Verify build/typecheck and UI behavior | pending | Run relevant checks; use browser if app target is available. |

## Decisions

- Planning files live at project root as required by the planning skill.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
