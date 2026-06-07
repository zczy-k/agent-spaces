# Task Plan

Goal: Share one chat message display implementation between `inline-chat-panel.tsx` and `floating-chat-widget.tsx`, so inline chat can render tool/timeline extras consistently.

## Phases

1. Context discovery - complete
2. Extract shared message display component - complete
3. Wire both panels to shared component - complete
4. Typecheck/lint targeted files - complete
5. Listen for inline chat tool SSE events - complete
6. Persist inline chat tool timeline without adding tool results to prompt history - complete
7. Fix missing chat agent workspace tree 404 - complete

## Decisions

- Keep existing public `ChatMessage` shape exported by `floating-chat-widget.tsx` for current floating chat callers.
- Move bubble rendering, thinking extraction, copy/delete actions, message extras, and version controls into a shared component.
- Leave panel chrome/input behavior in each panel.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Full `pnpm --filter @agent-spaces/web lint` failed on pre-existing repository issues | 1 | Ran targeted eslint for changed files; it passed. |
| Full `pnpm --filter @agent-spaces/web exec tsc --noEmit` failed on pre-existing repository issues | 1 | Filtered TypeScript output for changed files; no matches. |
