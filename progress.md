# Progress

## 2026-06-07 23:18:33 CST

- Inspected `inline-chat-panel.tsx`, `floating-chat-widget.tsx`, and `chat-message-bubble.tsx`.
- Confirmed duplicate message display logic and missing extras path in inline chat.
- Starting extraction of shared message display component.

## 2026-06-07 23:18:33 CST

- Added `packages/web/src/components/chat/chat-message-list.tsx` as the shared message display component.
- Replaced floating chat's inline message map with `ChatMessageList`.
- Replaced inline chat's `ChatMessageBubble` usage with `ChatMessageList` while preserving version navigation and regeneration handlers.
- Deleted the now-unused `chat-message-bubble.tsx`.

## 2026-06-07 23:18:33 CST

- Targeted eslint passed for `chat-message-list.tsx`, `inline-chat-panel.tsx`, and `floating-chat-widget.tsx`.
- Confirmed no remaining `ChatMessageBubble` references.
- Full lint/tsc are still blocked by unrelated existing errors outside the touched files.

## 2026-06-07 23:18:33 CST

- Added runtime `streamingTimeline` state to `useChatStore`.
- Added handlers for `tool_use` and `tool_result` SSE events.
- Passed active session tool timeline into `InlineChatPanel`.
- Added `ChatToolTimeline` and rendered tool calls under the inline streaming message.
- Avoided rendering the old standalone typing bubble when a tool timeline is already visible.
- Adjusted the touched chat page resizable prop to the local component type and narrowed tool timeline updates for TypeScript.

## 2026-06-07 23:18:33 CST

- Added `timeline` and `toolCalls` fields to chat message types.
- Collected runtime `tool_use` / `tool_result` events in `chat-run.ts` and persisted them with completed agent messages.
- Rendered persisted message timeline entries in `InlineChatPanel`.
- Kept prompt history generation unchanged so subsequent messages only include assistant/user text content.

## 2026-06-07 23:18:33 CST

- Changed `getAgentWorkspace()` to lazily create the chat agent default workspace directory when it is missing.

## 2026-06-07 23:18:33 CST

- Inspected the reported `messages.json`; confirmed tool timeline persistence exists but failed attempts were incorrectly marked as success.
- Updated LangChain runtime to pass each built-in tool's real input schema to `tool()`.
- Emitted `tool_result` events for function tool errors so UI and persisted timeline can show failed calls.
- Changed final timeline normalization so still-running tool calls become error entries instead of success entries.
- Made persisted tool call ids unique for new runs and made the restored timeline renderer tolerate old duplicate ids.
- Render old `success` tool entries without a result as an error-like result in the UI.
