# Technical Configuration Dossier Search Design

## Context

As verified against the repository and live Supabase on August 26, 2026:

- `technical_configuration_dossiers_list` accepts only `p_page`, `p_page_size`, and `p_include_archived`.
- The UI always requests active dossiers with a fixed page size of 20.
- The list is ordered by `updated_at DESC, id` and returns a filtered page plus `total` and `can_delete`.
- The dossier table has indexes for the current fixed ordering but no text-search index.
- `pg_trgm` is installed in the `extensions` schema; `unaccent` is not installed.
- The shared `SearchInput` is controlled and intentionally has no internal debounce.
- `ListFilterSearchCard`, `useDebounce`, `useServerPagination`, and TanStack Query previous-data patterns already provide the required primitives.
- `TechnicalConfigurationsClient.tsx` is already near the repository's 350-line extraction threshold, so list behavior should move into a module-local hook.

## Goals / Non-Goals

### Goals

- Find dossiers across all server pages by dossier name or device type.
- Provide deterministic Vietnamese accent-insensitive matching without enabling a new database extension.
- Keep pagination totals, ranking, authorization, and archive behavior authoritative on the server.
- Preserve stable UI during debounce and background refetch.
- Keep the implementation decomposed into deploy-safe, reviewable phases.

### Non-Goals

- Searching description or dossier UUID.
- Showing archived dossiers or adding an archive filter.
- User-selectable sorting.
- Typo-tolerant, semantic, vector, or fuzzy search.
- Autocomplete, suggestions, highlighting, or search analytics.
- URL persistence or deep links for search terms.
- A global `useServerSearch` hook or a broad refactor of other list pages.
- Applying a migration to live Supabase without separate explicit permission.

## Decisions

### 1. Search normalization is deterministic and extension-free

Add one internal SQL helper:

`public._normalize_search_text(input TEXT) -> TEXT`

The helper SHALL be immutable and suitable for expression indexes. Its semantic pipeline is:

1. Normalize Unicode representation so composed and decomposed input compare consistently.
2. Convert to lowercase.
3. Translate Vietnamese accented letters to ASCII and map `đ`/`Đ` to `d`.
4. Replace punctuation, symbols, slashes, underscores, hyphens, and other separators with spaces.
5. Trim and collapse repeated whitespace.
6. Return `NULL` for `NULL`; callers treat normalized empty text as no search.

The helper remains internal: preserve explicit deny-by-default function privileges and invoke it through the guarded list RPC. Do not enable `unaccent` for this scoped feature.

The client SHALL keep the raw text visible but use a dossier-module normalizer with the same semantics for pagination reset and query-key identity. The server remains authoritative and normalizes again. Do not broaden the contract of the existing shared `normalizeSearchText` utility because its current consumers do not all share the punctuation semantics selected for dossier search.

### 2. Search input validation is bounded and literal

- `p_search` is optional and defaults to `NULL`.
- Raw input longer than 200 characters is rejected with the list RPC's validation error contract.
- Any non-empty normalized query, including one character, activates search.
- Whitespace-only or punctuation-only input normalizes to no search.
- Tokens are deduplicated before predicate construction.
- Every token is passed through `public._sanitize_ilike_pattern()` before `LIKE`/`ILIKE` pattern construction, even though punctuation normalization removes common wildcard symbols.
- `%`, `_`, and `\` never act as caller-controlled SQL wildcards.

### 3. Every token must match across the two identity fields

For each unique normalized token, at least one of these expressions must contain the token:

- normalized dossier `name`
- normalized `device_type_name`

All tokens are combined with `AND`; the two fields for each token are combined with `OR`. This permits:

- reordered words,
- one token matching the device type and another matching the dossier name,
- searches such as `x quang` matching `X-quang`,
- accentless searches such as `may sieu am` matching `Máy siêu âm`.

Description and UUID are intentionally excluded.

### 4. Active search uses deterministic relevance ranking

When normalized search is non-empty, order by:

1. full normalized query equals either normalized searchable field,
2. either normalized searchable field starts with the full query,
3. all-token substring match,
4. `updated_at DESC`,
5. `id`.

When search is empty, preserve `updated_at DESC, id` exactly.

The filtered `total` and page data MUST use the same archive and search predicate. `can_delete` remains derived set-wise only for the selected page.

### 5. Use two trigram expression indexes

Add one GIN trigram expression index for each searchable field:

- normalized dossier name,
- normalized device type.

Schema-qualify the `pg_trgm` operator class from `extensions`. Validate representative active-list searches with `EXPLAIN (FORMAT JSON)` during the database phase gate.

One- and two-character searches are allowed for UX consistency even though PostgreSQL may not use a trigram index for those queries. The RPC's 200-character bound and the narrow dossier table keep this behavior controlled; no promise of index use is made for short tokens.

### 6. Replace the RPC signature atomically and deploy the migration first

Adding a defaulted fourth argument creates a distinct PostgreSQL signature. The migration SHALL:

1. Compare its timestamp against every local migration that defines the dossier list function.
2. Run in one transaction.
3. Drop the old three-argument function signature.
4. Create the four-argument function:
   `technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN, TEXT)`.
5. Keep `p_search TEXT DEFAULT NULL` last so old callers that omit it remain compatible.
6. Preserve the current authorization helper, archive predicate, validation, JSON payload, `can_delete`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`, and explicit grants/revokes.

The migration must land and be eligible for deployment before the client starts sending `p_search`. The application can be rolled out after the migration because old callers still work through the defaulted parameter.

### 7. Centralize dossier list state in a module-local hook

Create `useTechnicalConfigurationDossierList` to own:

- raw search text,
- module-local normalized search,
- exact 300 ms debounce through `useDebounce`,
- total count,
- `useServerPagination`,
- immediate page reset through the raw normalized value as `resetKey`,
- TanStack Query key and RPC args,
- `placeholderData: keepPreviousData`,
- initial loading, debounce-pending, background-fetching, error, retry, and filtered-empty state.

The query key includes the debounced normalized search value or `null`. The RPC receives the same value through `p_search`.

`isSearchPending` is true while the normalized raw value differs from the debounced value or while the current query is fetching.

This is intentionally module-local. Existing list screens vary in URL persistence, minimum length, role scope, filters, and normalization, so a global server-search hook would add flags and couple unrelated behavior.

### 8. Compose existing shared UI primitives

Render `ListFilterSearchCard` with `surface="plain"` before the list alert/table and use:

- shared `SearchInput`,
- placeholder and accessible label `Tìm theo loại thiết bị hoặc tên hồ sơ...`,
- full width on mobile and the shared desktop width constraints,
- `searchEndAddon` with a small `Loader2` while `isSearchPending`,
- input `maxLength={200}`.

Loading behavior:

- Initial load: keep the existing skeleton rows.
- Debounce/refetch: retain previous rows, set `aria-busy` on the table region, and disable pagination by passing false navigation capabilities.
- Search input and clear behavior remain enabled.
- Request error: keep the search toolbar visible, show the existing retry alert, and do not present stale rows as current results.

Empty behavior:

- Empty unfiltered list: `Chưa có hồ sơ cấu hình`.
- Empty filtered list: `Không tìm thấy hồ sơ phù hợp với "<raw search>"`.
- Clearing by button or Escape restores the default list after the same 300 ms contract and returns focus through the shared input behavior.

### 9. Preserve mutation cache behavior across search variants

The dossier list query root remains the invalidation boundary for create, update, and delete. The active list key passed into dossier actions includes page, page size, and normalized search so direct cache updates only target the visible variant.

Regression tests must confirm:

- search variants do not share page data,
- create/update/delete still invalidate the dossier-list root,
- deleting the final row on a later filtered page returns to a valid prior page,
- search state does not affect dossier detail keys.

## Risks / Trade-offs

- Client and SQL normalization can drift.
  - Mitigation: use explicit shared fixtures covering Vietnamese accents, `đ`, decomposed Unicode, punctuation, repeated whitespace, and wildcard characters in both TypeScript and SQL tests.
- Relevance ranking adds SQL expressions beyond the current fixed sort.
  - Mitigation: keep the ranking tiers small, deterministic, and tested; use the current sort as the final tie-breaker.
- Trigram indexes add write and storage overhead.
  - Mitigation: limit indexes to the two selected identity fields and inspect representative query plans before live-apply review.
- One-character searches may scan because trigram indexes cannot accelerate every short token.
  - Mitigation: retain the requested one-character UX, enforce the 200-character limit, and document short-token query-plan behavior rather than claiming index coverage.
- Previous rows can be mistaken for current results during refetch.
  - Mitigation: expose a visible input loader, set the table region busy, and disable pagination until the current request settles.
- Replacing a PostgreSQL function signature can leave an obsolete overload or break deployment ordering.
  - Mitigation: drop the exact old signature in the same transaction, lock contract tests to one deployed signature, and require migration-first rollout.
- `TechnicalConfigurationsClient` is near the extraction threshold.
  - Mitigation: move list/search/query behavior into the module-local hook before adding the toolbar.

## Migration And Rollout Plan

1. Land the TypeScript contract and test harness without sending `p_search`.
2. Land the append-only migration and database tests; run the static lane and an early Oracle baseline-forward check.
3. Land the module-local hook with default empty search.
4. Enable the search toolbar and UX states.
5. Run all final quality gates and both Database Quality Gate lanes for the exact landed commit.
6. After separate explicit approval, apply the migration through Supabase MCP before deploying the search-enabled client.

If rollback is required after deployment:

1. Roll back the client first so it stops sending `p_search`.
2. Restore the prior RPC behavior only through a new forward migration; never edit or delete the applied migration.
3. Remove obsolete search indexes/helper only after confirming no remaining callers.

## Test Strategy

- TDD is mandatory for every behavior phase: add a focused failing regression first, prove the failure, implement the smallest change, and rerun.
- TypeScript unit/component tests:
  - normalization fixtures,
  - exact 300 ms debounce,
  - immediate page reset,
  - query-key isolation,
  - RPC argument omission/value,
  - previous-data transition,
  - loading addon and `aria-busy`,
  - disabled pagination,
  - unfiltered/filtered empty states,
  - error/retry,
  - mutation-cache regressions.
- Static migration contract tests:
  - one four-argument signature,
  - old signature removed,
  - helper volatility and privileges,
  - `SECURITY DEFINER` and fixed `search_path`,
  - authorization helper preserved,
  - literal wildcard sanitization,
  - filtered total and stable order,
  - both trigram expression indexes.
- Registry-selected rollback-only SQL phase gate:
  - accent/case/Unicode/punctuation equivalence,
  - cross-field all-token matching,
  - description exclusion,
  - literal `%`, `_`, and `\`,
  - 200-character validation,
  - exact/prefix/token ranking,
  - archive behavior,
  - pagination and filtered totals,
  - no persistent fixtures.
- Required final checks:
  - `format:check`,
  - `verify:no-explicit-any`,
  - `verify:dedupe`,
  - `typecheck`,
  - focused Vitest suites,
  - `react-doctor`,
  - `openspec validate add-technical-configuration-dossier-search --strict`,
  - Database Quality Gate `static` and Oracle `baseline-forward` for the exact commit.
