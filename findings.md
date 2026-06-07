# Findings & Decisions

## Requirements
- User reports that after clicking regenerate, the new message does not display over the original message. It opens as a new message and only merges into the version branch when completion arrives.

## Research Findings
- `ChatMessageBubble` only invokes `onRegenerate`; it does not control where streaming output appears.
- `InlineChatPanel` groups adjacent agent replies into version groups with `groupMessageVersions`.
- On regenerate, `InlineChatPanel` sets the selected version index to `item.messages.length`, anticipating a future version.
- The in-progress stream still renders through the common bottom streaming block because `streamingContent` and `streamingThinking` are agent-level state.
- After completion, the saved agent message becomes adjacent to the original reply and `groupMessageVersions` merges it into the version group.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Keep regenerate placement state in `InlineChatPanel` | It already knows the version group key and controls rendering |
| Represent active regenerated output as a temporary `ChatMessage` | Reuses existing `ChatMessageBubble` rendering, version controls, and Markdown handling |
| Suppress the bottom streaming block only while regenerating | Normal user sends should still show a new bottom response |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
