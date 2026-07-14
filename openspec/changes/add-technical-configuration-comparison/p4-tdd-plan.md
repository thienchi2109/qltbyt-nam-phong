# P4 TDD Plan - Baseline Versioning, Lock And History

> **For agentic workers:** REQUIRED: Use `superpowers:test-driven-development` for every behavior slice and `superpowers:verification-before-completion` before any completion claim.

## Scope Boundary

- Implement only OpenSpec Phase P4 (`P4.1` through `P4.6`).
- Add draft/locked lifecycle, irreversible lock, version history, blank draft creation, and locked-version copy.
- Copy only baseline groups and criteria in P4.
- Preserve the P7A/P7B extension contract without creating reference product, response, document, or citation tables/RPCs.
- Do not add P5 Excel import/apply, P8 supplier/comparison behavior, or later-phase audit/AI work.

## Assumptions And Contracts

- `technical_configuration_baseline_versions_list` returns paginated complete baseline snapshots because the frozen RPC contract has no separate version-get RPC.
- `technical_configuration_baseline_lock` checks the current draft `p_expected_revision`.
- `technical_configuration_baseline_copy` checks the locked source version `p_expected_revision`.
- A copied version receives new row IDs, the next sequential version number, `source_baseline_version_id`, preserved criterion codes, and `source_criterion_id`.
- P5 must extend lock prerequisites when it introduces persisted import-error state; P4 has no import-error entity to inspect.
- All lifecycle functions lock the dossier row before the baseline row to preserve the existing lock order.

## Planned Files

- Create: `supabase/migrations/<ordered_timestamp>_technical_configuration_baseline_locking.sql`
- Create: `src/app/api/rpc/__tests__/technical-configuration-baseline-locking-migration.test.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationLockDialog.tsx`
- Modify: `src/lib/technical-configuration-baseline-rpcs.ts`
- Modify: `src/app/(app)/technical-configurations/baseline-types.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTabStates.tsx`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

## Task 1 - Freeze Backend Lifecycle Contracts

- [x] Write failing migration tests for lock metadata, lineage FKs/indexes, sequential versions, and all three P4 RPC signatures.
- [x] Write failing migration tests for lock prerequisites and expected-revision rejection.
- [x] Write failing migration tests proving every current descendant mutation keeps the editable-version guard.
- [x] Write failing copy-fidelity tests for new IDs, source linkage, preserved codes, remapped group IDs, and P4-only aggregate scope.
- [x] Run the focused SQL contract tests and confirm RED for the missing P4 migration/RPCs.

## Task 2 - Implement The Database Lifecycle

- [x] Add correctly ordered additive columns, constraints, and FK indexes.
- [x] Extend the baseline snapshot with source and lock metadata.
- [x] Make blank draft creation allocate the next sequential version number.
- [x] Add paginated version history with full snapshots and bounded page size.
- [x] Add irreversible lock with row locks, validation, actor/time metadata, and revision increment.
- [x] Add atomic locked-version copy for groups and criteria with complete ID remapping.
- [x] Keep grants fail-closed and expose only the three P4 RPCs to `authenticated`.
- [x] Run the focused SQL contract tests and confirm GREEN.

## Task 3 - Freeze Client Lifecycle Contracts

- [x] Write failing RPC adapter/allowlist tests for list, lock, and copy.
- [x] Write failing React tests for version selection, locked history rendering, lock confirmation, actor/time display, and removed edit affordances.
- [x] Write failing React tests for blank/copy draft creation and one-draft behavior.
- [x] Write failing stale lock/copy tests proving selected content and local editor state remain intact.
- [x] Run focused client tests and confirm RED for missing lifecycle UI and hook behavior.

## Task 4 - Implement Version History And Lock UI

- [x] Add P4 wire types and typed RPC wrappers.
- [x] Extend the baseline hook to own paginated versions, selected version, lifecycle mutations, and cache updates.
- [x] Add the version bar with selector and context-valid actions.
- [x] Add explicit irreversible lock confirmation using the shared confirmation shell.
- [x] Render locked groups/criteria read-only with `locked_by` and `locked_at`; do not render editor controls.
- [x] Preserve dirty/bulk buffers across rejected navigation and stale lifecycle conflicts.
- [x] Run focused client tests and confirm GREEN.

## Task 5 - Phase Gate And Delivery

- [x] Run format, explicit-any, dedupe, typecheck, focused tests, and React Doctor in repository order.
- [x] Run Code Review Graph and GitNexus impact review for the final diff.
- [x] Request explicit approval before applying the migration to live Supabase.
- [x] After approved apply, run phase-local role/claim, prerequisite, direct-mutation, copy, and history SQL verification.
- [x] Run Supabase security and performance advisors after apply.
- [x] Mark only P4 tasks complete in `tasks.md`.
- [x] Spawn one review subagent, wait for completion, triage findings, and rerun affected gates.
- [ ] Commit, pull with rebase, push the branch, and open a PR into `main`.
