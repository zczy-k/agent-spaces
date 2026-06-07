# Findings

- `packages/web/src/components/ui/floating-chat-widget.tsx` currently defines its own `ChatMessage` type and inline renders message bubbles, thinking blocks, Markdown, copy/delete controls, and `renderMessageExtras`.
- Workflow chat passes `renderMessageExtras` to `FloatingChatPanel` to display tool timeline entries.
- `packages/web/src/components/chat/inline-chat-panel.tsx` uses `ChatMessageBubble`, which does not expose `renderMessageExtras`; this explains why inline chat does not show tools.
- `inline-chat-panel.tsx` also handles grouped agent versions and regeneration state around the bubble component.
- `packages/web/src/components/chat/chat-message-bubble.tsx` has similar but separate bubble rendering with version navigation and regenerate controls.
- After extraction, `chat-message-bubble.tsx` has no remaining imports and can be removed to avoid a second message display implementation.
- `/api/chat/sessions/:sessionId/run` and `/api/chat/agents/:id/run` already emit `tool_use` and `tool_result` SSE events.
- `useChatStore.handleChatRunEvent` did not consume `tool_use` / `tool_result`, so inline chat had no runtime tool timeline to render.
