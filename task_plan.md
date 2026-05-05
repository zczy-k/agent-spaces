# Task Plan: WeChat Bot Notification Integration

## Goal
接入 wx robot iLink 到现有 workspace 通知后端，并在项目设置面板 WeChat tab 展示扫码配置二维码。

## Current Phase
Complete

## Phases

### Phase 1: Discovery
- [x] Read notification workflow doc
- [x] Inspect existing Lark notification adapter/backend routes
- [x] Inspect wx-robot-ilink reference project
- [x] Document findings
- **Status:** complete

### Phase 2: Backend Implementation
- [x] Extend shared workspace notification settings for WeChat credentials and QR state
- [x] Add WeChat iLink adapter/auth/API helpers inside notification hub
- [x] Add backend endpoint for WeChat QR login/status
- [x] Wire start/test behavior for WeChat provider
- **Status:** complete

### Phase 3: Frontend Implementation
- [x] Replace WeChat todo UI at project settings lines 384-388
- [x] Fetch and display WeChat QR code/status
- [x] Enable Start/Test controls for WeChat after login
- **Status:** complete

### Phase 4: Verification
- [x] Run targeted typecheck/build
- [x] Fix issues
- [x] Summarize changed files
- **Status:** complete

## Key Questions
1. What fields should be persisted for WeChat iLink login?
2. How should QR login be exposed safely in API?
3. How to reuse existing bot-agent command flow across Lark and WeChat?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Reuse existing `BotAdapter` and command/bot-agent helpers | Keeps platform I/O separate from issue/task/agent logic per docs. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Server build failed because `sleep` helper was missing | 1 | Added local promise-based `sleep(ms)` helper for WeChat poll backoff. |
| Web build/typecheck blocked by pre-existing `code-editor.tsx` and `models-dialog.tsx` errors | 1 | Verified settings panel with ESLint and recorded unrelated build blockers. |
