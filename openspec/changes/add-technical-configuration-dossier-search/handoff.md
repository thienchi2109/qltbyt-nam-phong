# Technical Configuration Dossier Search Handoff

## Phase 1: Contract Foundation

- Date: 2026-08-26
- Status: merged to `main`
- Landed commit: `2643cff234ba1136c199bad472277bfa4c6bee35`
- Scope completed:
  - reusable normalization and boundary fixtures
  - module-local search constants and deterministic normalizer
  - optional nullable `p_search` RPC argument
  - module-local dossier list query-key builder
- Verification:
  - 11 focused dossier/RPC test files, 82 tests passed
  - format, explicit-`any`, dedupe, typecheck, React Doctor, and strict OpenSpec gates passed
  - database gate skipped as expected because Phase 1 changed no migration or SQL-test registry
- Boundary respected: no SQL, UI, dossier-list caller, or live database changes.

## Phase 2: Database Search Contract

- Date: 2026-08-26
- Status: implementation and review fixes complete; exact-commit static evidence pending
- Branch: `feat/technical-configuration-dossier-search-p2`
- Base commit: `2643cff234ba1136c199bad472277bfa4c6bee35`
- Scope completed:
  - append-only migration with immutable SQL normalization helper
  - defaulted four-argument list RPC replacing the three-argument signature
  - bounded, literal, all-token search across dossier name and device type
  - longest-token GIN candidate selection before all-token filtering
  - deterministic exact/prefix/token ranking and filtered totals
  - two schema-qualified trigram expression indexes
  - static migration contracts plus rollback-only search and delete SQL phase gates
  - unconditional registration of the dossier-search phase gate
- TDD evidence:
  - static RED: 6 of 8 contract tests failed before the migration existed
  - migration skeleton RED: 5 of 8 contract tests failed
  - Oracle RED: the disposable-clone gate failed on the missing four-argument signature
  - focused GREEN: 6 files, 53 tests passed
  - Oracle GREEN after review fixes: migration, search phase gate, and existing delete phase gate passed; the disposable clone was dropped
- Review fixes:
  - production-shaped EXPLAIN now proves both trigram indexes through positive candidate predicates
  - runtime fixtures prove `updated_at DESC, id` tie-break ordering
  - runtime coverage accepts a one-character search
  - helper ACL is revoked after expression-index creation
- Final non-database verification:
  - format, explicit-`any`, dedupe, TypeScript docstrings, and typecheck gates passed
  - 6 focused test files, 45 tests passed
  - React Doctor scored 100/100
  - strict OpenSpec validation passed
- Current database gate status:
  - static: `INCOMPLETE`; expected `DROP FUNCTION` and `GRANT EXECUTE` findings require exact-commit approval evidence, and two JWT-guard findings are analyzer gaps
  - baseline-forward: manual disposable-clone validation passed on the final working-tree bytes; canonical harness evidence remains affected by `#967`
  - aggregate: not yet `PASS`
- Follow-up gate issues:
  - `#966`: recognize pure helpers and prior-migration guard delegation
  - `#967`: do not skip SQL tests for warning-only catalog findings
  - `#958`: refresh stale SQL-test inventory counts
- Boundary respected: no UI or hook changes and no live database write.
- Next entry point:
  - obtain exact-commit approval evidence for the expected dangerous statements
  - rerun the static lane after the analyzer gaps are fixed
  - do not apply the migration to live without separate explicit permission

## Phase 3: Module-Local List Hook

- Date: 2026-08-26
- Status: implementation complete; PR review findings addressed and verified
- Branch: `feat/technical-configuration-dossier-search-p3`
- Base commit: `353e1a90da1821634e83426ee76b9f1faf982924` (`origin/main`)
- Implementation commit: `4c88b5a6` `refactor(technical-config): centralize dossier list query state`
- Scope completed:
  - module-local `useTechnicalConfigurationDossierList` owning raw/normalized/debounced search (300 ms), `useServerPagination` with `resetKey: normalizedSearch`, pinned last-settled `{search,page,pageSize}` identity, `placeholderData: keepPreviousData`, and execution gated until the settled identity matches the current debounced search
  - pagination totals derived from the active query response so rows, total, and page count cannot come from different query snapshots
  - delegation of `TechnicalConfigurationsClient` to the hook without visible UI change; `p_search` omitted when empty, `staleTime 30_000` preserved
  - search-aware active `listQueryKey` passed into `useTechnicalConfigurationDossierActions` while root invalidation boundary `TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT` remains
  - delete fallback marks the dossier root stale without refetching the obsolete active page; the newly active previous-page key performs the only follow-up fetch
  - hook consistency and action integration regressions split into module-prefixed files; changed test files are 298, 198, and 264 lines
- TDD evidence:
  - RED: `use-technical-configuration-dossier-list.test.tsx` failed on missing hook module import (expected feature-missing failure)
  - interim RED: 6 of 8 new tests failed due to TanStack Query v5 `notifyManager` using `setTimeout(0)` under fake timers — fixed with `advanceTimersByTimeAsync(0)` pump plus cache-overwrite-aware mock for cross-variant invalidation
  - review RED: invalidating the previous page/search key produced a fourth obsolete RPC when debounce settled; fixed by requiring the settled search to equal the current debounced search before enabling the query
  - review RED: the first new-search row rendered once with the previous query's `total` and `pageCount`; fixed by deriving totals directly from query data
  - review GREEN: 4 review-focused files, 26 tests passed, including create/update/delete invalidation across search variants and detail-key independence
  - reviewer follow-up RED: delete fallback issued page-2 then page-1 RPCs; fixed with `refetchType: "none"` only when moving to the previous page
  - reviewer follow-up GREEN: exact delete RPC sequence, active-key merge before deferred refetch, complete snapshot consistency, and request-signal cancellation all pass
- Non-database verification:
  - `format:check` passed for the full diff
  - `verify:no-explicit-any` passed
  - `verify:dedupe` passed (diff-only)
  - semantic dedupe reused the dossier action harness; the generic `createTestQueryClient` was not substituted because its `gcTime: 0` removes inactive search variants required by these cache tests
  - `typecheck` passed
  - 14 focused dossier/RPC test files, 94 tests passed
  - React Doctor scored 100/100
  - `openspec validate add-technical-configuration-dossier-search --strict` passed via `@fission-ai/openspec`
  - `TechnicalConfigurationsClient.tsx` 281 lines, dossier action/list hooks 255/131 lines, and changed test files 298/198/264 lines
- Review:
  - custom `post_implementation_reviewer` findings were triaged and fixed; final follow-up review returned no findings
- Boundary respected: no SQL, no visible search toolbar (Phase 4), no live database write.
