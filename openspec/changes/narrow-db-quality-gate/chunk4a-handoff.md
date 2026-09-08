# Chunk 4a handoff — AI kill switch

- Scope: only `ai_kill_switch_smoke.sql`; original mixed test remains unchanged
  and remains the active selected test.
- Added staged extraction files:
  `ai_kill_switch_smoke_core_security.sql` and
  `ai_kill_switch_smoke_migration_specific.sql`.
- Core keeps role/claim authorization and denial SQLSTATE assertions. The
  migration-specific file keeps default state, enable/disable, invalid input,
  and blank/NULL reason behavior.
- Both files preserve `BEGIN`, isolated fixture cleanup, `DO $$` blocks, and
  `ROLLBACK` transaction contract. No migration, lane orchestration, or live DB
  was changed.
- RED: the new split contract test failed before extracted files existed.
- GREEN: `database-quality-gate-ai-kill-switch-split.test.ts` passed 3/3;
  registry and scope regression suite passed 23/23. Pre-commit formatting,
  duplicate-code, explicit-any, and docstring hooks passed.
- Commit: `dfa7e8ec`. Dynamic SQL execution and registry cutover remain
  deferred to the approved later chunks.
