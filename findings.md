# Findings & Decisions

## Requirements
- Stop using the `queue` component for tool/step display.
- Use `packages/web/src/components/chat/chain-of-thought.tsx` for chain rendering.
- Each chain should show tool usage and AI output messages, including non-summary intermediate output.
- Fix completed sessions showing a summary/final message again in the frontend.

## Research Findings
- `docs/ai-message-rendering.md` says `todo` parts currently represent TODO/tool records and are rendered by `queue.tsx`.
- `packages/web/src/components/chat/message-parts.tsx` is the only frontend import site for `queue.tsx`; its `todo` switch branch renders Queue primitives.
- `chain-of-thought.tsx` provides `ChainOfThought`, header/content, and steps with status and icons.
- `packages/server/src/ws/handler.ts` creates a streaming pending message, accumulates `liveOutput`, builds live parts from that stream, and updates the message during execution.
- On completion, `handler.ts` rebuilds `parts` from `result.output` and sets `content` from `result.output.join('\\n')`. If `result.output` repeats lines that already streamed through `liveOutput`, the completed UI can show a repeated final text/summary.
- `MessageParts` falls back to rendering `message.content` only when no `text` part exists, so duplication is most likely inside rebuilt completion `parts`, not the fallback.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Keep backend `todo` part type for tools | Lower risk than changing shared types and server parser shape. |
| Render `todo` parts with `ChainOfThoughtStep` | Satisfies the UI request without changing persisted message data. |
| Make `reasoning` use the same chain wrapper | This groups non-final AI output with tool usage in chain-of-thought UI. |
| Build final parts from `liveOutput` when present | Prevents completion from injecting a second copy of output already streamed. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- `docs/ai-message-rendering.md`
- `packages/web/src/components/chat/message-parts.tsx`
- `packages/web/src/components/chat/chain-of-thought.tsx`
- `packages/server/src/ws/handler.ts`

## Visual/Browser Findings
- No browser or image inspection used.
