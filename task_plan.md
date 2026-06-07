# Task Plan: Chat Regenerate Inline Streaming

## Goal
Fix chat regeneration so the in-progress regenerated agent message appears in the original message version slot immediately, instead of rendering as a separate bottom message until completion.

## Current Phase
Delivery

## Phases

### Phase 1: Requirements & Discovery
- [x] Inspect chat regenerate button, inline panel, and streaming store flow
- **Status:** complete

### Phase 2: Diagnosis
- [x] Regenerate sets selected version to a future index, but streaming content is rendered by the shared bottom streaming block
- [x] Completed message later joins the adjacent agent-message version group, which is why the merge happens only at the end
- **Status:** complete

### Phase 3: Implementation
- [x] Track the regenerating version group in `InlineChatPanel`
- [x] Render streaming content as a temporary version in that group
- [x] Keep normal send streaming behavior unchanged
- **Status:** complete

### Phase 4: Verification
- [x] Run focused checks
- **Status:** complete

### Phase 5: Delivery
- [ ] Summarize changes and verification
- **Status:** in_progress

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Track regeneration locally in `InlineChatPanel` | Existing stream state is agent-scoped and does not identify whether the run is a send or regenerate |
| Render a temporary message only inside the selected version group | Matches the existing completed-message grouping model without changing store/API contracts |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| ESLint file pattern not found under `pnpm --filter` | 1 | Re-ran ESLint with package-relative `src/...` paths |
| Full web TypeScript blocked by unrelated existing errors | 1 | Recorded affected files; focused ESLint for touched chat files passed |
