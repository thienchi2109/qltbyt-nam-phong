# P15C TDD Plan - Guarded Dossier Delete Activation

> **For agentic workers:** Execute test-first with
> `superpowers:test-driven-development`, `karpathy-coding-heuristics`,
> `next-best-practices`, `vercel-react-best-practices` and
> `code-deduplication`. Do not edit or reapply the P15A/P15A2 migrations in
> this leaf.

## Goal

Activate the already-applied P15A hard-delete RPC through the proxy, typed
client and P15B row-action surface. The UI warns that deletion is permanent,
uses `can_delete` only as an affordance and changes cache/workspace state only
after an authoritative server success.

**Tracking issue:** [#865](https://github.com/thienchi2109/qltbyt-nam-phong/issues/865)

## Hard Entry Gate

- P15A2 is merged and applied after P15A.
- The P15A2 success-path audit gate and updated two-session concurrency gate are
  green on live after their separate explicit authorizations.
- P15B is merged and its metadata edit regressions are green.
- Live read-only inspection confirms the exact P15A2 function signature, grants,
  fail-closed audit definition, `can_delete` response and migration versions.
- If any P15A/P15A2 evidence is missing or differs from the frozen contract,
  stop and fix the database boundary through its own follow-up leaf instead of
  widening P15C.

## Frozen Product And Client Contract

- Add `can_delete: boolean` to each dossier list wire item.
- Add delete args:
  `{ p_id: string, p_expected_revision: number }`.
- Add delete response: `{ data: { id: string } }`.
- Add one dedicated dossier RPC-name manifest and allowlist exactly
  `technical_configuration_dossiers_delete`.
- Never send the mutation before explicit destructive confirmation.
- Keep the delete action visible but disabled when `can_delete=false`, with
  accessible explanation text stating that a locked baseline permanently
  preserves the dossier.
- The server remains authoritative. Handle `locked_dossier`, `stale_revision`,
  `archived_dossier` and `not_found` even when the list previously reported
  `can_delete=true`.
- Success removes the matching dossier from cache, clears an open matching
  workspace and moves from page N to N-1 when the deletion empties page N and
  `N > 1`.
- Failure leaves list, workspace and page unchanged.
- Archive remains separate; P15C adds no archive or restore action.

## Planned Files

- Create: `src/lib/technical-configuration-dossier-rpcs.ts`
- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierDeleteDialog.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-delete-dialog.test.tsx`
- Modify: `src/app/api/rpc/[fn]/allowed-functions.ts`
- Modify:
  `src/app/api/rpc/__tests__/technical-configuration-rpc-whitelist.test.ts`
- Modify: `src/app/(app)/technical-configurations/types.ts`
- Modify:
  `src/app/(app)/technical-configurations/technical-configuration-rpc.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierRowActions.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDossierActions.ts`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx`
- Modify:
  `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-rpc.test.ts`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx`

Approved scope refinements:

- Keep `can_delete` list-only through
  `TechnicalConfigurationDossierListItemWire`.
- Add focused delete action/cache tests and a shared test harness so changed
  files remain below the repository line limits.
- Split the P15C dossier whitelist contract into
  `technical-configuration-dossier-delete-rpc-whitelist.test.ts`.
- Reuse `DestructiveConfirmDialog`; do not change the shared RPC transport.
- Browser verification was explicitly waived on 2026-08-06 and replaced with
  focused `@testing-library/user-event` coverage.

## Chunk 1: RED - Proxy Manifest And Typed Adapter

- [x] Add whitelist tests that require a dedicated dossier RPC manifest and one
      new allowed function.
- [x] Prove no other dossier/archive/baseline name is added accidentally.
- [x] Add type/adapter tests for `can_delete`, exact delete args and
      `{ data: { id } }`.
- [x] Prove typed error preservation for every authoritative conflict.
- [x] Run the dedicated dossier whitelist test plus
      `technical-configuration-rpc.test.ts`.
- [x] Confirm RED because the manifest, allowlist entry, types and adapter are
      missing.
- [x] Add the smallest manifest/allowlist/type/adapter implementation.
- [x] Rerun and confirm GREEN.

## Chunk 2: RED/GREEN - Destructive Confirmation Dialog

- [x] Add user-event tests for open, cancel, close, confirm, pending, error and
      retry.
- [x] Assert the dossier name is visible and the copy states deletion is
      permanent.
- [x] Assert no backend callback before explicit confirm.
- [x] Assert pending prevents duplicate submit and unsafe close.
- [x] Assert server error keeps the dialog open and does not claim deletion.
- [x] Build one focused dialog component using existing alert-dialog primitives
      and lucide destructive-action icons.
- [x] Keep query/mutation/cache knowledge outside the dialog.
- [x] Run:
      `rtk node scripts/npm-run.js run test -- 'src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-delete-dialog.test.tsx'`.

## Chunk 3: RED/GREEN - Row Eligibility And Authoritative Mutation

- [x] Extend shell tests for `can_delete=true` action availability and
      `can_delete=false` visible-disabled behavior with accessible explanation.
- [x] Keep the edit action independently available and cover no mutation before
      confirmation, success removal, changed eligibility, `locked_dossier`,
      stale, archived, not-found and network errors.
- [x] Extend the P15B action-state hook instead of creating a second competing
      mutation owner.
- [x] Send the current row revision at confirmation time.
- [x] Do not optimistic-remove the dossier.
- [x] After success, atomically reconcile: - matching list cache item removal - dossier query-root invalidation - selected/open workspace reset when IDs match - previous-page fallback when the current non-first page becomes empty
- [x] Prevent target changes and unsafe close while pending. Preserve
      authoritative cache reconciliation if the route unmounts after the server
      accepts the delete; local state updates are scoped to the mounted owner.
- [x] Run:
      `rtk node scripts/npm-run.js run test -- 'src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx'`.

## Chunk 4: Regression, Refactor And Visual Gate

- [x] Rerun P15A/P15A2 migration-source and whitelist tests to prove proxy
      activation matches the deployed DB signature without changing its SQL
      contract.
- [x] Rerun P15B form/edit tests to prove delete integration did not couple or
      regress metadata editing.
- [x] Use `code-deduplication` for mutation-state, page-fallback and destructive
      dialog patterns.
- [x] Recheck `TechnicalConfigurationsClient.tsx` and extracted action files
      against the 350/450-line limits.
- [x] Run in repository order through one context-mode batch.

  ```bash
  rtk node scripts/npm-run.js run format:check
  rtk node scripts/npm-run.js run verify:no-explicit-any
  rtk node scripts/npm-run.js run verify:dedupe
  rtk node scripts/npm-run.js run typecheck
  # Run focused whitelist/RPC/form/dialog/shell tests.
  rtk node scripts/npm-run.js run react-doctor
  rtk openspec validate add-technical-configuration-comparison --strict
  ```

- [x] Browser verification omitted by explicit user instruction on 2026-08-06;
      focused dialog/action `user-event` tests cover interaction, pending and
      error states instead.
- [x] Request code review, triage findings and rerun affected gates.

## Verification Evidence

- Chunk 1 RED: 8 expected failures for the missing manifest, allowlist, types
  and adapter.
- Chunk 2 RED: 5 expected failures before the dossier delete dialog existed.
- Chunk 3 RED: 11 expected failures before row eligibility and action ownership
  were implemented.
- Focused regression pack: 12 files, 156 tests passed.
- `format:check`, `verify:no-explicit-any`, `verify:dedupe` and `typecheck`
  passed.
- React Doctor diff scan: 92/100, no issues.
- Strict OpenSpec validation passed.
- Maximum changed TypeScript/React file length: 348 lines.
- Initial subagent review found a same-tick duplicate-delete race, missing
  post-unmount authoritative-cache coverage and missing locked-action keyboard
  coverage. All three were fixed test-first; re-review returned zero findings.
- No browser test and no live database write were performed.
- Shared dossier pagination reuse was intentionally deferred to follow-up
  Issue #871.

## Exit Gate

P15C is complete when hard-delete is reachable only through the gated RPC,
never executes before confirmation, never deletes a locked-history dossier and
reconciles UI state only after server success. Metadata edit and archive remain
independent lifecycle operations.
