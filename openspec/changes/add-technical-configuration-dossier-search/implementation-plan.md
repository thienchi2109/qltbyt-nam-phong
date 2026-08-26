# Technical Configuration Dossier Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vietnamese-friendly, server-side dossier search above the `/technical-configurations` dossier table without changing the existing access, archive, pagination, mutation, or default ordering contracts.

**Architecture:** A migration-first RPC extension performs authoritative normalization, matching, ranking, totals, and pagination. A module-local React hook centralizes raw/normalized/debounced search and query state while composing existing shared search, debounce, pagination, and previous-data primitives.

**Tech Stack:** PostgreSQL/Supabase RPC, `pg_trgm`, Next.js App Router, React, TypeScript, TanStack Query, Vitest/Testing Library, OpenSpec, and the repository Database Quality Gate.

---

## Scope Guard

This plan implements only dossier-list search over `name` and `device_type_name`. It does not add description/UUID search, archive controls, URL persistence, user sorting, autocomplete, highlighting, fuzzy search, or a global server-search abstraction.

Live Supabase writes are excluded until the user gives explicit permission for the specific migration apply.

## File Map

### New files

- `openspec/changes/add-technical-configuration-dossier-search/*`: approved contract and execution plan.
- `src/app/(app)/technical-configurations/technical-configuration-dossier-search.ts`: module constants and client normalizer.
- `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDossierList.ts`: dossier list/search/query/pagination state owner.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-search.test.tsx`: visible search behavior and async states.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-search-cache.test.tsx`: query-key and mutation-cache isolation.
- `src/app/api/rpc/__tests__/technical-configuration-dossier-search-migration.test.ts`: static SQL contract.
- `supabase/migrations/<ordered_timestamp>_technical_configuration_dossier_search.sql`: append-only helper/RPC/index migration.
- `supabase/tests/technical_configuration_dossier_search_phase_gate.sql`: rollback-only dynamic contract.

### Modified files

- `src/app/(app)/technical-configurations/types.ts`: optional `p_search`.
- `src/app/(app)/technical-configurations/technical-configuration-query-keys.ts`: search-aware list key while retaining root/detail contracts.
- `src/app/(app)/technical-configurations/TechnicalConfigurationsClient.tsx`: delegate list state to the hook and render the shared toolbar.
- `src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierTable.tsx`: busy, filtered-empty, and pagination-disabled presentation.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-pagination.test.tsx`: page reset and filtered-page deletion regressions.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-dossier-shell.test.tsx`: initial/filtered empty, loading, and error states.
- `src/app/(app)/technical-configurations/__tests__/technical-configuration-rpc.test.ts`: typed `p_search` transport.
- The committed Database Quality Gate registry, only if required to select the new SQL phase gate.

## Phase 1: Contract And Test Foundation

**Review boundary:** TypeScript contract and failing/passing static fixtures only. No SQL migration and no visible UI.

- [ ] Create reusable dossier-search fixtures for:
  - `Máy siêu âm` / `may sieu am`,
  - composed and decomposed Unicode,
  - `X-quang` / `x quang`,
  - `đ` / `d`,
  - repeated whitespace,
  - `%`, `_`, and `\`,
  - punctuation-only input,
  - one character,
  - 200 and 201 raw characters.
- [ ] Write the failing client normalizer tests.
- [ ] Write the failing query-key tests proving equivalent normalized terms share identity and different terms/pages do not.
- [ ] Write the failing typed RPC test for optional `p_search`.
- [ ] Implement only the module-local constants/normalizer, TypeScript arg, and query-key builder.
- [ ] Run focused Phase 1 tests and confirm all pre-existing dossier tests remain green.
- [ ] Commit checkpoint: `test(technical-config): define dossier search contract`.

## Phase 2: Database Search Contract

**Review boundary:** Append-only SQL, static contract, and rollback-only phase gate. Existing UI remains unchanged.

- [ ] Invoke `supabase-postgres-best-practices`.
- [ ] Inspect all later local definitions of `technical_configuration_dossiers_list` and choose a migration timestamp that sorts last.
- [ ] Write/finish failing SQL phase-gate assertions before the migration implementation.
- [ ] Add failing static migration expectations for the exact signature, helper, privileges, predicates, ranking, totals, and indexes.
- [ ] Add `public._normalize_search_text(TEXT)` as an immutable, internal helper with explicit privileges.
- [ ] In one transaction, drop only the old `(INTEGER, INTEGER, BOOLEAN)` signature and create `(INTEGER, INTEGER, BOOLEAN, TEXT)` with `p_search DEFAULT NULL`.
- [ ] Preserve the current authorization helper, validation, archive behavior, page projection, `can_delete`, JSON shape, fixed `search_path`, and ACLs.
- [ ] Add all-token predicates, filtered total, ranking tiers, and two `extensions.gin_trgm_ops` expression indexes.
- [ ] Add representative `EXPLAIN (FORMAT JSON)` checks for index-eligible queries; document that one-/two-character tokens may scan.
- [ ] Add the phase gate to the committed registry if required.
- [ ] Run static migration checks and an early Oracle baseline-forward execution.
- [ ] Commit checkpoint: `feat(db): add normalized dossier list search contract`.

## Phase 3: Module-Local List Hook

**Review boundary:** Search-capable data flow with default empty search; still no visible search input.

- [ ] Write failing tests for:
  - exact 300 ms debounce,
  - immediate page reset from normalized raw input,
  - `p_search` omission/value,
  - search-aware query keys,
  - `keepPreviousData`,
  - filtered totals/page count,
  - request cancellation through the existing query signal.
- [ ] Create `useTechnicalConfigurationDossierList`.
- [ ] Move total count, list query, retry, and `useServerPagination` ownership out of `TechnicalConfigurationsClient`.
- [ ] Derive:
  - `normalizedSearch`,
  - `debouncedSearch`,
  - `isSearchActive`,
  - `isSearchPending`,
  - initial loading,
  - background fetching,
  - filtered-empty state.
- [ ] Keep the existing action hook contract by passing the active search-aware list key and root invalidation boundary.
- [ ] Add cache regressions for create/update/delete and filtered-page fallback.
- [ ] Confirm empty-search output, ordering, pagination, and action behavior are unchanged.
- [ ] Commit checkpoint: `refactor(technical-config): centralize dossier list query state`.

## Phase 4: Search UI And Async States

**Review boundary:** User-visible search and its accessibility/responsive states only.

- [ ] Write failing Testing Library tests using fake timers for the 300 ms contract.
- [ ] Render `ListFilterSearchCard surface="plain"` before alert/table content.
- [ ] Configure shared `SearchInput` with:
  - raw controlled value,
  - `maxLength={200}`,
  - placeholder/ARIA label `Tìm theo loại thiết bị hoặc tên hồ sơ...`,
  - clear/Escape behavior from the shared component,
  - `Loader2` through `searchEndAddon`.
- [ ] Keep skeletons for initial load only.
- [ ] Preserve prior rows during debounce/fetch, set table-region `aria-busy`, and disable pagination navigation while pending.
- [ ] Keep row actions available while old rows are visible; only pagination is frozen to prevent competing page requests.
- [ ] Hide stale rows when the current search request errors and retain the toolbar plus retry alert.
- [ ] Add filtered no-results copy using the raw visible term.
- [ ] Verify mobile full-width and shared desktop sizing without a new dossier-specific toolbar component.
- [ ] Commit checkpoint: `feat(technical-config): add dossier list server search`.

## Phase 5: Verification And Deployment Readiness

**Review boundary:** No new feature behavior. Only evidence, fixes required by valid findings, and rollout documentation.

- [ ] Run one context-mode batch in repository order:
  - `node scripts/npm-run.js run format:check`
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run verify:dedupe`
  - `node scripts/npm-run.js run typecheck`
  - focused Vitest suites
  - `node scripts/npm-run.js run react-doctor`
- [ ] Invoke `code-deduplication` and document why the hook remains module-local.
- [ ] Run `openspec validate add-technical-configuration-dossier-search --strict`.
- [ ] Run the Database Quality Gate static lane and Oracle baseline-forward lane for the same exact commit.
- [ ] Use Supabase MCP read-only inspection to verify signature/grant/index/helper drift before live-apply review.
- [ ] Run `post_implementation_reviewer` against this proposal/spec and triage findings for technical validity.
- [ ] Re-run affected gates after any review fix.
- [ ] Record deployment order:
  1. explicit permission,
  2. apply migration through Supabase MCP,
  3. security/performance advisors and live read-only contract checks,
  4. deploy search-enabled application.
- [ ] Do not mark implementation complete if either Database Quality Gate lane is missing or if the migration/app deployment order is unresolved.
- [ ] Commit checkpoint: `docs(technical-config): record dossier search verification`.

## Acceptance Checklist

- [ ] Search covers all server pages, not only the loaded page.
- [ ] Search fields are exactly dossier name and device type.
- [ ] Accent, case, Unicode form, punctuation, and whitespace normalization match the approved semantics.
- [ ] Every token must match; no fuzzy behavior exists.
- [ ] Filtered totals and ranking are deterministic.
- [ ] Default empty-search behavior is unchanged.
- [ ] Debounce is exactly 300 ms and pagination resets immediately.
- [ ] Previous rows remain during pending work with clear busy feedback.
- [ ] Empty/error states are distinct and accessible.
- [ ] Existing authorization, archive, `can_delete`, and mutation-cache contracts are preserved.
- [ ] No global server-search abstraction or unrelated refactor is introduced.
- [ ] Static and Oracle baseline-forward database gates pass for the exact landed commit.
- [ ] No live database write occurs without separate explicit approval.
