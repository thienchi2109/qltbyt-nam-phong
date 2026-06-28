# Implementation Tasks

## 1. Discovery And Contracts

- [ ] 1.1 Inspect current equipment list search fields, route query params, and facility/region filters.
- [ ] 1.2 Inspect live schema/RPC patterns for `thiet_bi`, `don_vi`, `dia_ban`, equipment group/category, and regional leader scoping.
- [ ] 1.3 Confirm whether existing equipment page supports `search`, `region`, and `facility` deep-link params.
- [ ] 1.4 Inspect existing quota schema/RPCs for `quyet_dinh_dinh_muc`, `chi_tiet_dinh_muc`, `nhom_thiet_bi`, and compliance status labels.
- [ ] 1.5 Define final RPC name, request shape, response shape, quota fields, and TypeScript types.
- [ ] 1.6 Confirm existing indexes and query plan before adding new indexes.

## 2. Backend Aggregate Search

- [ ] 2.1 Create Supabase migration for the aggregate equipment search RPC.
- [ ] 2.2 Validate JWT role/user claims inside the RPC.
- [ ] 2.3 Normalize `admin` to `global` where needed.
- [ ] 2.4 Enforce admin/global all-facility scope.
- [ ] 2.5 Enforce regional leader allowed-region/facility scope server-side.
- [ ] 2.6 Reject unsupported roles for this RPC.
- [ ] 2.7 Match keyword against equipment name, model, serial, and equipment group/category.
- [ ] 2.8 Exclude internal equipment code from search matching.
- [ ] 2.9 Join active quota decisions and quota details to compute facility-level quota context for matched equipment.
- [ ] 2.10 Return grouped aggregate counts for `region` and `facility` modes, with matching equipment count as the primary value.
- [ ] 2.11 Return quota display fields for facility mode: current count, min, max, status, notes, and multi-group indicator where applicable.
- [ ] 2.12 Return clear states for no active quota, unassigned equipment category, and equipment groups not assigned into the unit quota decision.
- [ ] 2.13 Grant execute permission only as required by the app's RPC pattern.
- [ ] 2.14 Add the RPC to the API proxy allowlist if the app calls it through `/api/rpc/[fn]`.
- [ ] 2.15 Run Supabase MCP security advisors after applying the migration.

## 3. Client Data Layer

- [ ] 3.1 Add TypeScript request/response types for aggregate equipment search, including quota fields and status enum.
- [ ] 3.2 Add a TanStack Query hook with stable query keys.
- [ ] 3.3 Gate the hook on non-empty trimmed query and allowed role.
- [ ] 3.4 Normalize API errors into existing UI error patterns.

## 4. Header Entry Point

- [ ] 4.1 Add a compact header search input for `admin`/`global` and `regional_leader`.
- [ ] 4.2 Hide the entry point for all other roles.
- [ ] 4.3 Submit only on Enter or search button click.
- [ ] 4.4 URL-encode the keyword and navigate to `/global-search?q=<encodedKeyword>` on valid submit.
- [ ] 4.5 Add focused tests for visibility, submit behavior, and encoded navigation for spaces/reserved characters.

## 5. Global Search Page

- [ ] 5.1 Add `/global-search` page/route.
- [ ] 5.2 Read and update keyword from URL query state.
- [ ] 5.3 Render top search form, scope badge, summary, chart, table, breadcrumb, loading, error, and empty states.
- [ ] 5.4 Implement admin/global region-first view.
- [ ] 5.5 Implement region drill-down to facility grouping.
- [ ] 5.6 Implement regional leader default facility grouping for single-region scope.
- [ ] 5.7 Implement multi-region regional leader hierarchy when applicable.
- [ ] 5.8 In facility grouping, show matching equipment count as the primary value and quota display/status as supplementary columns.
- [ ] 5.9 Use user-facing quota labels: `Trong giới hạn định mức`, `Dưới mức tối thiểu`, `Vượt giới hạn định mức`, `Chưa có định mức`, `Chưa gán danh mục định mức`, and `Chưa được gán vào định mức của đơn vị`.
- [ ] 5.10 Keep global search read-only for quota data; do not add category assignment, quota editing, or fix-data CTAs.
- [ ] 5.11 Build deep-links only to the existing equipment page for region/facility context.
- [ ] 5.12 Add focused tests for drill-down, URL updates, quota labels, read-only quota behavior, and deep-link construction.

## 6. Equipment Page Deep-Link Support

- [ ] 6.1 Add or verify support for `search=<keyword>`.
- [ ] 6.2 Add or verify support for `region=<regionId>`.
- [ ] 6.3 Add or verify support for `facility=<facilityId>`.
- [ ] 6.4 Preserve existing equipment page behavior for normal users.
- [ ] 6.5 Add focused tests for query-param hydration if new support is required.

## 7. Verification

- [ ] 7.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 7.2 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 7.3 Run `node scripts/npm-run.js run typecheck`.
- [ ] 7.4 Run focused backend/RPC verification for role scopes, field matching, quota joining, and unassigned/not-in-quota/no-active-quota states.
- [ ] 7.5 Run focused React tests for changed UI behavior and quota status labels.
- [ ] 7.6 Verify global-search URL hydration by loading `/global-search?q=...` directly and confirming the query and selected scope restore after refresh or back navigation.
- [ ] 7.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 7.8 Manually verify chart rendering and drill-down in browser.

## 8. Release Notes

- [ ] 8.1 Document that v1 is submit-only and has no autocomplete.
- [ ] 8.2 Document that global search aggregates equipment counts only.
- [ ] 8.3 Document that detail inspection happens through existing equipment page deep-links.
- [ ] 8.4 Document that quota information is read-only in global search and unit-level quota assignment remains outside this workflow.
