## Why

The dossier list on `/technical-configurations` is paginated on the server with a fixed page size of 20, but it has no search capability. Users must scan pages manually, and client-side filtering would be incorrect because it could only inspect the currently loaded page while leaving totals and pagination stale.

The dossier name and device type are the two user-facing identity fields for this list. A server-side search must therefore preserve the current access boundary, archive behavior, pagination totals, delete eligibility, and deterministic ordering while adding Vietnamese-friendly matching and responsive loading feedback.

## What Changes

- Add a shared `SearchInput` through `ListFilterSearchCard` above the dossier table.
- Keep the raw search value local to the page; do not add URL query-string persistence.
- Debounce the normalized search value for exactly 300 ms with the existing generic `useDebounce`.
- Search only `technical_configuration_dossiers.name` and `device_type_name`; description, UUID, archive filters, user-selectable sorting, autocomplete, and fuzzy search remain out of scope.
- Normalize search text consistently:
  - normalize Unicode input,
  - lowercase,
  - remove Vietnamese diacritics and map `đ` to `d`,
  - treat punctuation and separators as spaces,
  - trim and collapse whitespace,
  - treat SQL wildcard characters literally,
  - accept any non-empty normalized query up to 200 raw characters.
- Require every normalized token to match either searchable field, in any order and across both fields.
- Rank active searches by exact field match, then field prefix, then complete token match, with `updated_at DESC, id` as the stable tie-breaker. Preserve the current fixed ordering when search is empty.
- Extend `technical_configuration_dossiers_list` with optional `p_search TEXT DEFAULT NULL`, filtered totals, and trigram expression indexes while preserving its existing authorization, archive, pagination, `can_delete`, grant/revoke, and `SECURITY DEFINER` contracts.
- Centralize client list behavior in a module-local `useTechnicalConfigurationDossierList` hook instead of adding a global server-search abstraction.
- Preserve prior rows during debounce/refetch, expose an in-input loading indicator, mark the table busy, and temporarily disable pagination without disabling typing or clearing.
- Distinguish the unfiltered empty state, filtered no-results state, and request error with retry.
- Use migration-first deployment compatibility. Repository migration work and Database Quality Gate evidence do not authorize a live write; applying the migration requires separate explicit permission through Supabase MCP.

## Impact

- Affected specs: `technical-configuration-comparison` (dossier list discovery and navigation)
- Affected code:
  - **DB/RPC**: a new append-only Supabase migration replacing `technical_configuration_dossiers_list`, one internal normalization helper, filtered-total logic, grants, and trigram expression indexes
  - **DB tests**: migration contract tests and a registry-selected rollback-only phase gate
  - **Types/RPC adapter**: dossier list args and existing typed transport tests
  - **Client state**: a module-local dossier-list hook, normalized query keys, pagination reset, and previous-data behavior
  - **UI**: `TechnicalConfigurationsClient`, `TechnicalConfigurationDossierTable`, `ListFilterSearchCard`, and shared `SearchInput` composition
  - **Tests**: normalization, debounce, query isolation, pagination reset, ranking contract, filtered totals, loading, empty, error, retry, and mutation-cache regressions
- Breaking changes: none for existing callers. Empty or omitted `p_search` preserves the current list behavior.
- Operational impact:
  - The migration must run before the search-enabled application deploy.
  - Static and Oracle baseline-forward Database Quality Gate lanes must pass for the exact landed commit before live-apply review.
  - No live Supabase write is part of proposal approval or repository implementation.
