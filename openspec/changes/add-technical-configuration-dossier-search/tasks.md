# Implementation Tasks

## TDD Execution Rule

- [ ] For every phase that changes behavior, write the focused failing regression first and record the expected failure before production changes.
- [ ] Keep each phase independently reviewable and green; do not merge a phase that depends on uncommitted work from a later phase.
- [ ] Do not apply any migration to live Supabase without separate explicit permission for that specific write.

## Phase 1. Contract And Test Foundation

- [ ] 1.1 Add shared dossier-search fixtures covering Vietnamese accents, `đ`, decomposed Unicode, punctuation/separators, repeated whitespace, wildcard characters, empty normalization, and the 200-character boundary.
- [ ] 1.2 Add failing TypeScript tests for the module-local normalizer, normalized query-key identity, and optional `p_search`.
- [ ] 1.3 Extend `TechnicalConfigurationDossierListRpcArgs` with optional `p_search?: string | null` without changing any caller yet.
- [ ] 1.4 Add a dossier-list query-key builder that includes page, page size, and normalized search while preserving the existing root invalidation key.
- [ ] 1.5 Add the module-local search constants/normalizer and make the Phase 1 tests pass.
- [ ] 1.6 Review checkpoint: confirm no UI sends `p_search`, no SQL file exists yet, and all existing dossier tests remain green.

## Phase 2. Database Search Contract

- [ ] 2.1 Invoke `supabase-postgres-best-practices` before creating the migration and compare migration ordering against every local migration that defines `technical_configuration_dossiers_list`.
- [ ] 2.2 Add failing static migration contract tests and a failing rollback-only SQL phase gate for the new signature, normalization, matching, ranking, archive behavior, pagination, totals, indexes, and fixture cleanup.
- [ ] 2.3 Update the existing dossier-delete phase gate to resolve the four-argument signature while retaining three-argument calls, and register the new dossier-search phase gate unconditionally.
- [ ] 2.4 Add one append-only migration that creates `public._normalize_search_text`, atomically replaces the three-argument list RPC with the defaulted four-argument signature, and preserves authorization, archive, pagination, `can_delete`, grants/revokes, and fixed `search_path`.
- [ ] 2.5 Implement bounded input validation, deduplicated all-token matching across name/device type, literal wildcard sanitization, filtered totals, and deterministic exact/prefix/token relevance tiers.
- [ ] 2.6 Add two schema-qualified GIN trigram expression indexes for normalized dossier name and device type and make the Phase 2 database contracts pass.
- [ ] 2.7 Run the static Database Quality Gate and an early Oracle baseline-forward validation; record each lane separately.
- [ ] 2.8 Review checkpoint: migration-first deploy remains backward-compatible with callers that omit `p_search`; no live write has occurred.

## Phase 3. Module-Local List Hook

- [ ] 3.1 Invoke `vercel-react-best-practices` before changing the React hook/query flow in Phases 3 and 4.
- [ ] 3.2 Add failing hook/component tests for exact 300 ms debounce, immediate first-page reset from page 2 or later, zero RPC calls through 299 ms, one current-search page-1 request at 300 ms, query-key isolation, `p_search` transport, filtered totals, and previous-data retention.
- [ ] 3.3 Create `_hooks/useTechnicalConfigurationDossierList.ts` to own raw/normalized/debounced search, total count, `useServerPagination`, TanStack Query state, retry, and derived loading/empty state.
- [ ] 3.4 Use `useDebounce(normalizedSearch, 300)`, `useServerPagination({ resetKey: normalizedSearch })`, `placeholderData: keepPreviousData`, and disable query execution while normalized and debounced search differ.
- [ ] 3.5 Move the existing dossier list query/pagination behavior out of `TechnicalConfigurationsClient` without changing visible UI.
- [ ] 3.6 Preserve dossier action cache behavior by passing the search-aware active list key and retaining root invalidation.
- [ ] 3.7 Add regressions for delete-last-row page fallback and create/update/delete invalidation across search variants.
- [ ] 3.8 Review checkpoint: default empty-search behavior matches the current dossier list exactly and `TechnicalConfigurationsClient` remains below the extraction threshold.

## Phase 4. Search UI And Async States

- [ ] 4.1 Add a failing focused test for `ListFilterSearchCard.searchMaxLength` passthrough plus failing dossier UI tests for toolbar placement, placeholder/accessibility, loader timing, `aria-busy`, disabled pagination, clear/Escape behavior, and local-only state.
- [ ] 4.2 Add the optional `searchMaxLength` prop to `ListFilterSearchCard` and pass it to `SearchInput.maxLength`.
- [ ] 4.3 Render `ListFilterSearchCard surface="plain"` above the dossier alert/table, reuse the shared `SearchInput`, and set `searchMaxLength={200}`.
- [ ] 4.4 Show a small `Loader2` through `searchEndAddon` while debounce or fetch is pending; keep the input and clear action enabled.
- [ ] 4.5 Retain prior rows during refetch, use skeletons only for initial load, mark the table region busy, and disable pagination until the current request settles.
- [ ] 4.6 Distinguish `Chưa có hồ sơ cấu hình`, filtered no-results copy containing the raw term, and request error with retry while keeping the toolbar visible.
- [ ] 4.7 Verify responsive layout: full-width search on mobile and existing shared desktop width constraints without introducing a dossier-specific search component.
- [ ] 4.8 Review checkpoint: no archive filter, URL state, fuzzy search, description search, sortable headers, or unrelated shared-component refactor has entered scope.

## Phase 5. Verification And Deploy Readiness

- [ ] 5.1 Perform read-only live drift inspection through Supabase MCP for the current list signature, helper name conflicts, grants, indexes, and migration state.
- [ ] 5.2 Document migration-first rollout and require a new explicit authorization before any live `apply_migration`.
- [ ] 5.3 Run `post_implementation_reviewer` against the originating OpenSpec acceptance criteria, triage findings, and apply valid fixes.
- [ ] 5.4 Create the final implementation/documentation commit, confirm the worktree is clean, and record its `HEAD`.
- [ ] 5.5 Run one context-mode batch for `format:check`, `verify:no-explicit-any`, diff-only `verify:dedupe`, `typecheck`, focused dossier UI/RPC/migration Vitest suites, `react-doctor`, and strict OpenSpec validation.
- [ ] 5.6 Complete the semantic `code-deduplication` check for the module-local hook/helper.
- [ ] 5.7 Run Database Quality Gate `static` and Oracle `baseline-forward` against the exact clean `HEAD`; report both lanes separately and require aggregate PASS.
- [ ] 5.8 Do not modify or commit files after collecting exact-commit database evidence; any required change creates a new final commit and requires both lanes to rerun.
- [ ] 5.9 Final review checkpoint: verify the committed and tested `HEAD` is the same commit covered by both Database Quality Gate lanes before declaring implementation complete.
