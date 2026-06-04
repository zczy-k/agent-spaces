# Findings

## Research Notes

- `packages/web/src/components/ui/floating-chat-widget.tsx` exports `FloatingChatPanel`, a controlled UI-only chat panel. It accepts `messages`, `sending`, `input`, `onSend`, fixed `agent` display info, and optional markdown rendering.
- `packages/web/src/components/workflow/workflow-editor.tsx` currently renders editor layout plus dialogs inside `WorkflowEditorInner`; it has access to the current `workflow` object and can host the floating panel near the root container.
- Existing backend runtime path includes `packages/server/src/routes/agent-sse.ts`, which creates an agent runtime from a preset and supports runtime events/tool use. Need inspect request contract before implementing client call.
- Existing chat tool-call UI includes `packages/web/src/components/chat/message-tool-step.tsx`, but it expects shared `Message`/`MessagePart` chain structures and detail loading through channel APIs. The workflow floating agent likely needs a simpler custom card for SSE tool events.
- `agent-sse` originally required a saved `agentId` preset for model/provider config and did not expose function tools. It can be extended to accept a workflow draft while still reusing the existing runtime factory.
- Because LangChain tools execute on the server, workflow editing tools should mutate an in-memory workflow draft passed with the request and stream workflow patches back to the editor through `tool_result`.
- `packages/web/src/lib/workflow-nodes.ts` exports `allNodeDefinitions`, enough to seed node usage/search/create defaults for built-in node types.
