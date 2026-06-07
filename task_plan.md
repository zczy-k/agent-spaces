# Task Plan: Workflow Agent Node IO Field Parity

## Goal
Fix the migrated workflow agent execution capability for adding input/output fields to nodes, using the current log and WorkFox source as parity references.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Inspect current workflow editor tool implementation
- [x] Inspect WorkFox reference implementation
- [x] Inspect failing chat log for exact tool calls/results
- **Status:** complete

### Phase 2: Diagnosis
- [x] Identify mismatch in add input/output field behavior
- [x] Determine minimal compatible fix
- **Status:** complete

### Phase 3: Implementation
- [x] Patch current implementation
- [x] Keep changes scoped to workflow agent tool behavior
- **Status:** complete

### Phase 4: Verification
- [x] Run focused tests/build/typecheck as available
- [x] Add smoke coverage if practical
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize changes and verification
- **Status:** complete

### Phase 6: Follow-up Failure Fix
- [x] Inspect latest failed chat log
- [x] Patch tool parameter compatibility
- [x] Verify update_node JSON-string data path
- **Status:** complete

### Phase 7: set_node_io_fields Fields Compatibility
- [x] Inspect latest `set_node_io_fields` failure
- [x] Accept JSON-string `fields`
- [x] Verify log-shaped `set_node_io_fields` call
- **Status:** complete

### Phase 8: Start Input Reference Semantics
- [x] Verify runtime source for start-node input fields
- [x] Update workflow agent guidance to use `__data__` for start inputs
- [x] Preserve compatibility for existing `__inputs__` expressions
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Reset planning files for this task | Existing plan files were for a completed node search parity task |
| Add a dedicated `set_node_io_fields` workflow editor tool | The log showed the agent lacked a direct, schema-guided way to add node input/output fields |
| Accept string boolean values for `summarize` | The log showed the model passed `"false"` and got a summary instead of full node data |
| Make generic `update_node` more forgiving | Latest log shows the agent still used `update_node` with `id` and JSON-string `data`; rejecting/dropping those makes the edit fail despite a success response |
| Make `set_node_io_fields.fields` forgiving too | Latest log shows the agent sends `fields` as a JSON-string array |
| Start-node runtime input should be referenced through `__data__` | Execution stores start node result in `__data__`; the UI's workflow input picker already emits `__data__` |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| TypeScript cast warning in `summarizeOutputFields` | First build after patch | Removed unnecessary `JsonRecord` casts and read typed `OutputField` properties directly |
| `set_node_io_fields` returned `fields must be an array` | Latest chat log replay | Added JSON array string parsing for `fields` |
