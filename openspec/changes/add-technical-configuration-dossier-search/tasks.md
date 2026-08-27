# Implementation Tasks

## TDD Execution Rule

- [ ] For every phase that changes behavior, write the focused failing regression first and record the expected failure before production changes.
- [ ] Keep each phase independently reviewable and green; do not merge a phase that depends on uncommitted work from a later phase.
- [ ] Do not apply any migration to live Supabase without separate explicit permission for that specific write.

## Phase 1. Contract And Test Foundation

- [x] 1.1 Add shared dossier-search fixtures covering Vietnamese accents, `đ`, decomposed Unicode, punctuation/separators, repeated whitespace, wildcard characters, empty normalization, and the 200-character boundary.
- [x] 1.2 Add failing TypeScript tests for the module-local normalizer, normalized query-key identity, and optional `p_search`.
- [x] 1.3 Extend `TechnicalConfigurationDossierListRpcArgs` with optional `p_search?: string | null` without changing any caller yet.
- [x] 1.4 Add a dossier-list query-key builder that includes page, page size, and normalized search while preserving the existing root invalidation key.
- [x] 1.5 Add the module-local search constants/normalizer and make the Phase 1 tests pass.
- [x] 1.6 Review checkpoint: confirm no UI sends `p_search`, no SQL file exists yet, and all existing dossier tests remain green.

## Phase 2. Database Search Contract

- [x] 2.1 Invoke `supabase-postgres-best-practices` before creating the migration and compare migration ordering against every local migration that defines `technical_configuration_dossiers_list`.
- [x] 2.2 Add failing static migration contract tests and a failing rollback-only SQL phase gate for the new signature, exact RPC ACL, normalization, matching, ranking, archive behavior, pagination, totals, indexes, and fixture cleanup.
- [x] 2.3 Update the existing dossier-delete phase gate to resolve the four-argument signature while retaining three-argument calls, and register the new dossier-search phase gate unconditionally.
- [x] 2.4 Add one append-only migration that creates `public._normalize_search_text`, atomically replaces the three-argument list RPC with the defaulted four-argument signature, preserves authorization/archive/pagination/`can_delete`/fixed `search_path`, revokes all RPC privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then grants only `EXECUTE` to `authenticated`.
- [x] 2.5 Implement bounded input validation, deduplicated all-token matching across name/device type, literal wildcard sanitization, filtered totals, and deterministic exact/prefix/token relevance tiers.
- [x] 2.6 Add two schema-qualified GIN trigram expression indexes for normalized dossier name and device type and make the Phase 2 database contracts pass.
- [x] 2.7 Run the static Database Quality Gate and an early Oracle baseline-forward validation; record each lane separately.
- [x] 2.8 Review checkpoint: migration-first deploy remains backward-compatible with callers that omit `p_search`; no live write has occurred.

## Phase 3. Module-Local List Hook

- [x] 3.1 `vercel-react-best-practices`/`react-best-practices` unavailable in this session; proceeded with `test-driven-development` + `karpathy-coding-heuristics` fallback — no visible UI change.
- [x] 3.2 Added RED hook tests for exact 300 ms debounce, immediate first-page reset from page 2+, zero RPC through 299 ms, one current-search page-1 request at 300 ms, pre-cached previous-search page-1 isolation, query-key isolation, `p_search` transport, filtered totals, and previous-data retention (failure: missing hook module; 6/8 RED before notifyManager pump fix).
- [x] 3.3 Created `_hooks/useTechnicalConfigurationDossierList.ts` to own raw/normalized/debounced search, `useServerPagination`, TanStack Query state, retry, and derived loading/empty state; pagination totals are derived directly from the active query snapshot instead of mirrored local state.
- [x] 3.4 Uses `useDebounce(normalizedSearch, 300)`, `useServerPagination({ resetKey: normalizedSearch })`, and `placeholderData: keepPreviousData`; while debounce is pending, pins query identity and rows to the last-settled search/page/page-size and disables execution until that settled identity matches the current debounced search.
- [x] 3.5 Moved dossier list query/pagination behavior out of `TechnicalConfigurationsClient` without changing visible UI (281 lines, below 350-line extraction threshold; hook 131 lines).
- [x] 3.6 Preserved dossier action cache behavior by passing the search-aware active list key and retaining root invalidation (`TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT`).
- [x] 3.7 Added regressions for delete-last-row page fallback on a filtered later page, create/update/delete invalidation across inactive search variants, and detail-key independence from list search state.
- [x] 3.8 Review checkpoint: default empty-search behavior matches the current dossier list exactly (`p_search` omitted, `staleTime 30_000`, same `TechnicalConfigurationDossierTable` output); `TechnicalConfigurationsClient` remains below the extraction threshold.
- [x] 3.9 PR review fixes: prevent the obsolete settled query from re-enabling for one render, keep rows/totals on one query snapshot, and split the hook/action integration tests so every changed source file remains below the 450-line ceiling.
- [x] 3.10 Post-implementation review fixes: avoid refetching the obsolete filtered page during delete fallback, prove active-key update merging before refetch completion, validate complete row/total/page-count snapshots, assert request cancellation, and split hook regressions to keep test files below the 350-line extraction threshold.

## Phase 4. Search UI And Async States

- [x] 4.1 Added RED coverage for `ListFilterSearchCard.searchMaxLength` plus dossier toolbar placement, placeholder/accessibility, exact 299/300 ms loader timing, `aria-busy`, disabled pagination, enabled row/input/clear actions, clear/Escape focus, local-only state, distinct empty/error/retry states, and normalized-empty fallback.
- [x] 4.2 Added optional `searchMaxLength` passthrough from `ListFilterSearchCard` to `SearchInput.maxLength`.
- [x] 4.3 Rendered `ListFilterSearchCard surface="plain"` above dossier alerts/table with the shared input, exact placeholder/ARIA label, and `searchMaxLength={200}`.
- [x] 4.4 Added an accessible `Loader2` search end addon while debounce or list fetching is pending; input and clear remain enabled.
- [x] 4.5 Retained prior rows during debounce/refetch, preserved skeletons for initial load only, marked the table region busy, disabled pagination while pending, and kept row actions enabled.
- [x] 4.6 Distinguished unfiltered empty, filtered no-results using the raw visible term, and request error/retry while keeping the toolbar visible and stale rows hidden on error.
- [x] 4.7 Verified shared responsive sizing (`w-full` mobile and existing `md:min-w-[280px] md:max-w-[460px]` desktop constraints) without a dossier-specific search component.
- [x] 4.8 Review checkpoint: no archive filter, URL state, fuzzy search, description search, sortable headers, or unrelated shared-component refactor has entered scope.

## Phase 5. Verification And Deploy Readiness

- [ ] 5.1 Perform read-only live drift inspection through Supabase MCP for the current list signature, helper name conflicts, grants, indexes, and migration state.
- [ ] 5.2 Document migration-first rollout and require a new explicit authorization before any live `apply_migration`.
- [ ] 5.3 Spawn the custom `post_implementation_reviewer` without a full-history fork, using fixed point `origin/main` and the originating OpenSpec acceptance criteria; triage and apply valid fixes.
- [ ] 5.4 Run one context-mode batch for `format:check`, `verify:no-explicit-any`, diff-only `verify:dedupe`, `typecheck`, focused dossier UI/RPC/migration Vitest suites, `react-doctor`, and strict OpenSpec validation.
- [ ] 5.5 Complete the semantic `code-deduplication` check for the module-local hook/helper.
- [ ] 5.6 Create the final implementation/documentation commit, run `git pull --rebase`, rerun affected non-database checks if synchronization changes the commit/content, then confirm the worktree is clean and record final `HEAD`.
- [ ] 5.7 Run Database Quality Gate `static` and Oracle `baseline-forward` against that exact synchronized `HEAD`; report both lanes separately and require aggregate PASS.
- [ ] 5.8 Run `git push` and verify the remote branch plus `git status` are up to date with the same gated `HEAD`.
- [ ] 5.9 If a gate, rebase, push retry, or follow-up fix changes the commit, rerun both database lanes against the new exact `HEAD`.
- [ ] 5.10 Do not modify or commit files after collecting exact-commit database evidence unless restarting the exact-commit verification sequence.
- [ ] 5.11 Final review checkpoint: verify the pushed `HEAD` is the same commit covered by both Database Quality Gate lanes before declaring implementation complete.
