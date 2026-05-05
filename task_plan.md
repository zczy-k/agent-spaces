# Task Plan: Agent Usage Billing

## Goal
Persist completed agent run usage in SQLite under the user data directory and show a shadcn-style billing dashboard on the home page.

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Understand user intent
- [x] Identify current agent storage, runtime result, API, and web patterns
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Backend Design
- [x] Decide SQLite schema and data directory layout
- [x] Define API contract for dashboard data
- [x] Document decisions
- **Status:** complete

### Phase 3: Backend Implementation
- [x] Add SQLite-backed agent run and usage storage
- [x] Record usage when agent execution completes
- [x] Expose billing statistics API
- **Status:** complete

### Phase 4: Frontend Implementation
- [x] Add shadcn-style usage dashboard component
- [x] Fetch and render real billing stats in home page
- **Status:** complete

### Phase 5: Verification
- [x] Run typecheck/build or targeted tests
- [x] Fix issues found
- [x] Summarize changes
- **Status:** complete

## Key Questions
1. Where are agent records currently read/written?
2. Which runtime result fields contain input/output usage?
3. Which package already provides SQLite support, if any?
4. What API shape should the home dashboard consume?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `node:sqlite` DatabaseSync | Node 25 supports it and avoids adding native third-party dependencies. |
| Store agent sessions and usage under `~/.agent-spaces-data/agents/agents.sqlite` | Matches requested user-level agent storage and centralizes usage across workspaces. |
| Estimate costs from known model family defaults | Existing runtime outputs tokens but not authoritative billing costs. This gives useful dashboard estimates without requiring provider billing APIs. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `curl` URL globbed by zsh because of `?days=7` | 1 | Reran with the URL quoted. |
| Node SQLite cannot bind `undefined` parameters | 1 | Normalized optional SQL values to `null` before binding. |
