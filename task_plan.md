# Task Plan: Multi-Agent Coding Workspace

## Goal
Create an actionable implementation plan for the PRD-defined local multi-agent collaborative coding workspace.

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements Baseline
- [x] Read `PRD.md`
- [x] Extract core product goals, roles, state models, storage rules, and UI modules
- [x] Record findings in `findings.md`
- **Status:** complete

### Phase 2: Architecture Definition
- [ ] Define frontend/backend/package structure
- [ ] Define workspace, `.agentspace`, `share/`, issue, task, and agent session data models
- [ ] Define WebSocket event contracts and state transitions
- [ ] Define filesystem and Git service boundaries
- [ ] Verify and map selected libraries: FlexLayout, xterm.js, OpenAI Codex, open-agent-sdk-typescript, and react-dev-inspector
- **Status:** pending

### Phase 3: MVP Scope Breakdown
- [ ] Split PRD into MVP, post-MVP, and future extension scope
- [ ] Define first usable vertical slice
- [ ] Identify implementation milestones and acceptance criteria
- [ ] Map each milestone to user-visible behavior
- **Status:** pending

### Phase 4: Backend Implementation Plan
- [ ] Plan Express API routes and WebSocket channels
- [ ] Plan local JSON persistence layout
- [ ] Plan workspace binding and `.agentspace` claiming rules
- [ ] Plan scheduler, planner, executor, reviewer, and hook orchestration
- [ ] Plan Codex and Claude Code adapter boundaries
- [ ] Plan xterm.js backend PTY/session streaming protocol
- [ ] Plan Git branch, diff, commit, and PR integration boundaries
- **Status:** pending

### Phase 5: Frontend Implementation Plan
- [ ] Plan Next.js app routes and shell layout
- [ ] Plan workspace tabs, left panel, right panel, and bottom dock using FlexLayout
- [ ] Plan channel chat, issue center, Monaco editor, terminal, and Git panel modules
- [ ] Plan xterm.js terminal tabs, resize handling, and WebSocket binding
- [ ] Plan Codex, Claude Code, VSCode debug/inspection dock panels
- [ ] Plan shadcn/ui component usage and state management
- **Status:** pending

### Phase 6: Risk, Testing, and Delivery Plan
- [ ] Identify security and filesystem risks
- [ ] Define test strategy for backend services, WebSocket flows, state transitions, and UI workflows
- [ ] Define delivery checklist and documentation outputs
- [ ] Record unresolved questions for product decisions
- **Status:** pending

## Key Questions
1. What is the exact MVP boundary for the first usable version?
2. Should the first version support real agent process spawning, or mock agent execution behind stable interfaces?
3. Which Git providers must be implemented first: GitHub, GitLab, or both?
4. What is the required persistence schema for workspaces, issues, tasks, channels, messages, and agent sessions?
5. How should `.agentspace` ownership be enforced when a workspace binds multiple local directories?
6. What terminal implementation should be used for local shell sessions and WebSocket streaming?
7. What safety constraints, if any, should apply despite the PRD saying file operations are unrestricted?
8. How should FlexLayout state be persisted per workspace and restored across sessions?
9. Which exact Codex and Claude Code SDK/runtime APIs should be wrapped by backend adapters?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use file-based planning documents in the project root | The requested workflow explicitly uses persistent planning files generated from `PRD.md`. |
| Treat PRD as the authoritative source for the initial plan | No other project files or implementation exist in the workspace yet. |
| Plan the product in architecture, MVP, backend, frontend, and verification phases | The PRD spans product flows, agent orchestration, storage, UI, and integrations, so the plan needs separate tracks. |
| Use user-supplied libraries as preferred implementation candidates | The user provided concrete repositories for dock layout, terminal, Codex, Claude Code, and VSCode inspection/debug integration. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None | 1 | No errors encountered while creating the initial plan. |

## Notes
- Planning files live in `/Users/Zhuanz/Documents/agent_spaces`.
- `PRD.md` currently defines product intent but does not yet define API contracts, schema details, or exact MVP acceptance criteria.
- Keep web or third-party research out of `task_plan.md`; write external findings to `findings.md`.
- User-supplied GitHub links should be verified during Phase 2 before finalizing implementation contracts.
