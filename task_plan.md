# Task Plan: AI Message Rendering Fix

## Goal
Use `chain-of-thought.tsx` for concise, useful tool/intermediate AI output rendering; avoid duplicate final output; support lazy tool details and opening referenced files in editor tabs.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Read the AI rendering doc and current chat components.
- [x] Locate queue usage and server completion update logic.
- [x] Document findings.
- **Status:** complete

### Phase 2: Technical Approach
- [x] Replace `todo` rendering with `ChainOfThought` primitives.
- [x] Keep `todo` as the data shape for compatibility, but stop using `queue.tsx`.
- [x] On final server update, build parts from the live stream when available so completed messages do not re-render a second final output.
- **Status:** complete

### Phase 3: Implementation
- [x] Update frontend message part rendering.
- [x] Update server final message update logic.
- [x] Update docs.
- **Status:** complete

### Phase 4: Verification
- [x] Run typecheck/build or targeted lint.
- [x] Inspect changed files.
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize changes and verification.
- **Status:** complete

### Phase 6: Concise Chain Tool UI
- [x] Discover editor file-opening flow and message detail storage/API options.
- [x] Add compact tool summaries instead of raw JSON parameters.
- [x] Make tool detail collapsible and lazy-loadable.
- [x] Allow file tool links to open files in editor tabs.
- **Status:** complete

### Phase 7: Verification
- [x] Run targeted server/client checks.
- [x] Document residual risks.
- **Status:** complete

### Phase 8: Tool Detail Output
- [x] Emit structured tool result events from Claude runtime.
- [x] Persist tool result output alongside tool input detail.
- [x] Render input and output sections in lazy-loaded detail.
- [x] Verify targeted builds/lint.
- **Status:** complete

### Phase 9: Monaco Detail Viewer
- [x] Add read-only Monaco code block component.
- [x] Render JSON input/output through read-only Monaco instead of plain pre blocks.
- [x] Render Edit/MultiEdit details through `DiffViewer`.
- [x] Verify targeted frontend lint and shared/server builds.
- **Status:** complete

### Phase 10: Repeated Edit Detail Matching
- [x] Reproduce root cause from code: repeated identical tool lines all matched the first saved detail.
- [x] Match chain item detail ids by raw-line occurrence order within a message build.
- [x] Update rendering documentation.
- [x] Verify server build.
- **Status:** complete

## Key Questions
1. Where is queue used? Answer: only `message-parts.tsx` imports it for `todo` parts.
2. Why does duplicate final text appear? Likely because live stream parts already include final text, then completion rebuilds parts from `result.output`, which can include the same assistant output again.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep `todo` message part type | Avoids shared schema churn and server/client compatibility risk. |
| Render `todo` via `ChainOfThought` | Matches user request to stop using queue component while showing tool usage in each chain. |
| Use live output as final display source when available | The UI has already streamed these parts; rebuilding from `result.output` can duplicate final text. |
| Consume matching tool details by occurrence order | Repeated identical Edit lines should map to distinct tool detail records instead of the first raw-line match. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Notes
- User specifically wants each chain to show tool usage including non-summary intermediate AI output.
- Follow-up request: make tool chain display concise and intuitive, do not show raw JSON by default, support read-file links opening in editor tabs, and lazy-load detailed edit contents via query API.
- Follow-up bug: repeated agent Edit calls against one file showed the same detail because chain item detail lookup matched the first identical raw tool line.
