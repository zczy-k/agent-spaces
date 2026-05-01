# Findings & Decisions

## Requirements
- Build a local multi-agent collaborative coding platform.
- Frontend stack: Next.js, shadcn/ui, TailwindCSS.
- Backend stack: Express plus WebSocket/WSS.
- Single-user product; no login or account system required.
- Web frontend and backend are separate.
- A workspace can bind multiple local code directories.
- Each workspace claims exactly one `.agentspace` directory.
- `.agentspace` stores workspace metadata, skills, agent config, `claude.md`, tasks, cache/locks, and logs.
- New Git branches must include the `.agentspace` folder.
- Only the Planner role may update `.agentspace` content.
- Shared execution records live under `share/{issue_id}`.
- Each agent writes independent Markdown execution records.
- Historical execution records are archived under `archive/`.
- Agent roles include Scheduler, Planner, Executor, and Reviewer.
- Scheduler only wakes Planner when the server is idle and unfinished issues exist.
- Planner manages issues, task decomposition, agent creation, task distribution, result handling, documentation updates, and PR creation.
- Planner does not directly read or write code.
- Executor performs code analysis and modification within sandboxed assigned directories and limited tools.
- Reviewer reviews diffs and returns approve, request changes, or reject.
- Hooks connect executor completion, planner notification, reviewer review, and planner follow-up.
- Channel chat supports agent mentions, attachments, history search, and file/code snippet references.
- Issue center supports fuzzy issue creation, research agent planning, standardized `skill.md` plan files, and user editing.
- Code editor uses Monaco Editor with file tree, editor tabs, folder browsing, file modification, and Git operations.
- Layout includes workspace tabs, left panel, right panel, and bottom dock.
- Bottom dock includes terminal, Codex, Claude Code, VSCode debugging, and Git.
- Terminal supports resize and multiple sessions.
- Dock layout should use FlexLayout.
- Terminal UI should use xterm.js.
- Codex integration should target OpenAI Codex.
- Claude Code integration should consider `open-agent-sdk-typescript`.
- VSCode debugging/inspection panel should consider `react-dev-inspector`.
- Git panel initially supports diff viewing, with future commit/push/pull/branch/merge/log expansion.
- Storage is local filesystem only and should support Windows, macOS, and Linux.
- File operations are unrestricted by whitelist and do not provide undo/rollback.
- Git diff files should be generated to track file changes.
- Current storage format is JSON, with possible future database migration.
- Current scope does not require indexing, search implementation, automatic backups, or version history.
- GitHub/GitLab integration is required for branch creation, commit, and PR synchronization.

## Research Findings
- Current workspace contains `PRD.md` and no existing application scaffold.
- No existing `task_plan.md`, `findings.md`, or `progress.md` were present before this session.
- The PRD defines state enums but does not define exact transition rules.
- The PRD defines required storage areas but does not yet define JSON schemas.
- The PRD requires broad filesystem access but also role-based control over `.agentspace`, creating a security boundary that must be designed explicitly.
- The user supplied concrete library/repository candidates for dock layout, terminal, Codex, Claude Code, and VSCode inspection/debug integration.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Start with explicit architecture and MVP planning before implementation | The workspace currently has only a PRD, so implementation needs contract and scope definition first. |
| Separate agent orchestration from concrete agent runtime execution | Scheduler, Planner, Executor, Reviewer, and hooks are complex enough to need stable interfaces before real process execution. |
| Use local JSON schemas as the first persistence target | The PRD explicitly states JSON storage first and database migration later. |
| Treat `share/{issue_id}` records as append-only Markdown artifacts with archiving | This matches the PRD's readable execution record and history archive requirements. |
| Model Git provider integration behind an adapter boundary | GitHub/GitLab are both required, and provider-specific behavior should not leak into issue orchestration. |
| Prefer FlexLayout for dock/panel layout | User supplied `https://github.com/caplin/FlexLayout` as the dock layout candidate. |
| Prefer xterm.js for terminal rendering | User supplied `https://github.com/xtermjs/xterm.js` as the terminal candidate. |
| Wrap Codex and Claude Code behind agent runtime adapters | User supplied separate candidates for Codex and Claude Code, so orchestration should not depend directly on one runtime implementation. |
| Evaluate react-dev-inspector for VSCode-style debug/inspection workflows | User supplied `https://github.com/zthxxx/react-dev-inspector` for the VSCode debug area; exact fit needs validation. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| PRD lacks precise MVP boundary | Add MVP scoping as a dedicated planning phase. |
| PRD has potential tension between unrestricted file writes and `.agentspace` Planner-only writes | Track as a risk and define enforcement rules during architecture planning. |
| PRD requires PR sync to GitHub/GitLab but does not specify auth method | Track as an unresolved product/technical question. |
| Supplied GitHub repositories have not been validated in this session | Verify install packages, APIs, licenses, maintenance status, and framework compatibility during Phase 2. |

## Resources
- Local PRD: `/Users/Zhuanz/Documents/agent_spaces/PRD.md`
- Planning skill: `/Users/Zhuanz/.agents/skills/planning-with-files/SKILL.md`
- Planning templates: `/Users/Zhuanz/.agents/skills/planning-with-files/templates/`
- Dock layout: https://github.com/caplin/FlexLayout
- Terminal: https://github.com/xtermjs/xterm.js
- Codex: https://github.com/openai/codex
- Claude Code / agent SDK candidate: https://github.com/codeany-ai/open-agent-sdk-typescript
- VSCode debug/inspection candidate: https://github.com/zthxxx/react-dev-inspector

## Open Questions
1. Should MVP implement real Codex/Claude Code process control, or simulate agent runs while stabilizing workspace, issue, and review flows?
2. Which provider auth should be used for GitHub/GitLab integration: PAT, OAuth device flow, local CLI credentials, or user-provided tokens?
3. Should the backend expose unrestricted file operations to the frontend, or should restrictions apply only to automated agents?
4. How should conflicts be handled when multiple bound directories contain or request `.agentspace`?
5. What exact format should standardized research plan `skill.md` files follow?
6. Should the app support opening arbitrary existing repos that already contain `.agentspace`?
7. Should terminal sessions run in the backend process or be delegated to an external terminal multiplexer?
8. What package names and APIs correspond to the supplied GitHub repositories?
9. Does FlexLayout satisfy all dock requirements: bottom dock, nested tabs, drag resizing, persisted layout, and panel restore?
10. Should Codex and Claude Code run as local CLI processes, SDK calls, or remote service calls?
11. Does `react-dev-inspector` cover the intended VSCode debugging requirement, or only component/source inspection?

## Visual/Browser Findings
- No browser or visual assets were used during initial PRD planning.
