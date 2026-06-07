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
