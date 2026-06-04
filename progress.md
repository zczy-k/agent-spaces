# Progress

## Session Log

- Created planning files and started Phase 1.
- Inspected workflow editor, floating chat widget, and existing chat tool-step component. Started tracing SSE runtime path and tool-call event shape.
- Added server-side workflow editor function tools and wired `agent-sse` to use fixed LangChain runtime when `workflowAgent` draft data is present.
- User added requirement: floating chat header needs model settings and clear messages; settings should reuse `AgentEditor`, lock workflow prompt/tools, and save model provider config to backend.
- Added locked-field support to `AgentEditor`/`AgentDetail`, added workflow-agent settings dialog and clear messages action, and verified targeted frontend lint plus server build.
