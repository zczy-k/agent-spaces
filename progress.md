# Hermes Runtime Progress

## 2026-05-25
- Created file-based plan for Hermes runtime integration.
- Confirmed no existing planning files were present in the project root.
- Completed initial runtime surface scan.
- Confirmed `hermes` CLI is not installed in the current environment, so implementation must fail clearly at runtime when missing.
- Added `HermesRuntime` CLI adapter and wired it into server runtime types, factory, exports, and runtime-kind validation.
- Added `hermes` to shared AgentConfig runtime kind, web runtime selector, member runtime labels, and i18n runtime labels.
- `pnpm --filter @agent-spaces/shared build` passed.
- `pnpm --filter @agent-spaces/server build` initially failed on strict optional access in `hermes-runtime.ts`; fixed by introducing `agentDir`.
- Adjusted Hermes CLI arguments to avoid an undocumented `--base-url` flag and added `-s` skill preloading.
- `pnpm --filter @agent-spaces/server build` passed after the Hermes argument adjustment.
- `pnpm --filter @agent-spaces/web build` exited with code 0 and passed TypeScript; it logged an existing Next deprecation warning and an `ENVIRONMENT_FALLBACK` page-generation message.
- Documented verification results and known limitations in `task_plan.md`.
- Started follow-up documentation task for `docs/hermes-agent-runtime.md`.
- Added `docs/hermes-agent-runtime.md` describing current behavior, configuration mapping, known limitations, troubleshooting, and verification steps.
