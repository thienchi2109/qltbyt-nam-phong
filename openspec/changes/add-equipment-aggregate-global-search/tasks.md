# Implementation Tasks

## GitHub Roadmap

- Umbrella: #625
- Phase 1 contract/discovery: #626
- Phase 2 backend RPC: #627
- Phase 3 client data layer: #628
- Phase 4 header entry: #629
- Phase 5 Reports equipment-search tab: #630
- Phase 6 read-only quota context rendering: #631
- Phase 7 equipment deep-links and final rollout: #632

## Phase 1 - Discovery And Contracts (#626)

- [x] 1.1 Inspect current equipment list search fields, route query params, and facility/region filters.
- [x] 1.2 Inspect live schema/RPC patterns for `thiet_bi`, `don_vi`, `dia_ban`, equipment group/category, and regional leader scoping.
- [x] 1.3 Confirm whether existing equipment page supports `search`, `region`, and `facility` deep-link params.
- [x] 1.4 Inspect existing quota schema/RPCs for `quyet_dinh_dinh_muc`, `chi_tiet_dinh_muc`, `nhom_thiet_bi`, and compliance status labels.
- [x] 1.5 Define final RPC name, request shape, response shape, quota fields, and TypeScript types.
- [x] 1.6 Confirm existing indexes and query plan before adding new indexes.
- [x] 1.7 Document the v1 search algorithm and performance contract: deterministic SQL keyword search, no vector search, and `EXPLAIN` evidence before new indexes.

## Phase 2 - Backend Aggregate Search (#627)

- [ ] 2.1 Create Supabase migration for the aggregate equipment search RPC.
- [ ] 2.2 Validate JWT role/user claims inside the RPC.
- [ ] 2.3 Normalize `admin` to `global` where needed.
- [ ] 2.4 Enforce admin/global all-facility scope.
- [ ] 2.5 Enforce regional leader allowed-region/facility scope server-side.
- [ ] 2.6 Reject unsupported roles for this RPC.
- [ ] 2.7 Match keyword against equipment name, model, serial, and equipment group/category using sanitized SQL keyword predicates.
- [ ] 2.8 Exclude internal equipment code from search matching.
- [ ] 2.9 Keep vector search, semantic ranking, autocomplete, and client-side filtering out of the v1 backend RPC.
- [ ] 2.10 Apply role scope and soft-delete filters before grouping; do not return equipment rows for browser-side aggregation.
- [ ] 2.11 Join active quota decisions and quota details to compute facility-level quota context for matched equipment.
- [ ] 2.12 Return grouped aggregate counts for `region` and `facility` modes, with matching equipment count as the primary value.
- [ ] 2.13 Return quota display fields for facility mode: current count, min, max, status, notes, and multi-group indicator where applicable.
- [ ] 2.14 Return clear states for no active quota, unassigned equipment category, and equipment groups not assigned into the unit quota decision.
- [ ] 2.15 Capture representative `EXPLAIN (FORMAT JSON)` plans for `region` and `facility` grouping before adding new indexes.
- [ ] 2.16 Prefer query-shape fixes such as indexed-field/category CTEs or `UNION` before adding new indexes; add indexes only with plan evidence.
- [ ] 2.17 Grant execute permission only as required by the app's RPC pattern.
- [ ] 2.18 Add the RPC to the API proxy allowlist if the app calls it through `/api/rpc/[fn]`.
- [ ] 2.19 Run Supabase MCP security advisors after applying the migration.

## Phase 3 - Client Data Layer (#628)

- [x] 3.1 Add TypeScript request/response types for aggregate equipment search, including quota fields and status enum.
- [x] 3.2 Add a TanStack Query hook with stable query keys.
- [x] 3.3 Gate the hook on non-empty trimmed query and allowed role.
- [x] 3.4 Normalize API errors into existing UI error patterns.
- [x] 3.5 Keep the data layer route-agnostic so the Reports tab can consume it without coupling to a page path.

## Phase 4 - Header Entry Point (#629)

- [x] 4.1 Add a compact header search input for `admin`/`global` and `regional_leader`.
- [x] 4.2 Hide the entry point for all other roles.
- [x] 4.3 Submit only on Enter or search button click.
- [x] 4.4 URL-encode the keyword and navigate to `/reports?tab=equipment-search&q=<encodedKeyword>` on valid submit.
- [x] 4.5 Add focused tests for visibility, submit behavior, and encoded navigation for spaces/reserved characters.

## Phase 5 - Reports Equipment Search Tab Count-First Flow (#630)

- [ ] 5.1 Add a dedicated `equipment-search` tab to the existing Reports page with user-facing label `Tìm kiếm thiết bị`.
- [ ] 5.2 Read and update `tab=equipment-search` and `q=<keyword>` from Reports URL query state.
- [ ] 5.3 Render top search form, scope badge, summary, chart, table, breadcrumb, loading, error, and empty states.
- [ ] 5.4 Implement admin/global region-first view.
- [ ] 5.5 Implement region drill-down to facility grouping.
- [ ] 5.6 Implement regional leader default facility grouping for single-region scope.
- [ ] 5.7 Implement multi-region regional leader hierarchy when applicable.
- [ ] 5.8 Keep matching equipment count as the primary facility-row value.
- [ ] 5.9 Add focused tests for drill-down, URL updates, and count-first rendering.

## Phase 6 - Read-Only Quota Context Rendering (#631)

- [ ] 6.1 In facility grouping, show quota display/status as supplementary columns.
- [ ] 6.2 Use user-facing quota labels: `Trong giới hạn định mức`, `Dưới mức tối thiểu`, `Vượt giới hạn định mức`, `Chưa có định mức`, `Chưa gán danh mục định mức`, and `Chưa được gán vào định mức của đơn vị`.
- [ ] 6.3 Show `Gồm nhiều nhóm định mức` when one facility result aggregates multiple matched quota groups.
- [ ] 6.4 Keep global search read-only for quota data; do not add category assignment, quota editing, or fix-data CTAs.
- [ ] 6.5 Add focused tests for quota labels, missing quota/category states, and read-only quota behavior.

## Phase 7 - Equipment Deep-Links And Final Rollout (#632)

- [ ] 7.1 Add or verify support for `search=<keyword>`.
- [ ] 7.2 Add or verify support for `region=<regionId>`.
- [ ] 7.3 Add or verify support for `facility=<facilityId>`.
- [ ] 7.4 Preserve existing equipment page behavior for normal users.
- [ ] 7.5 Build deep-links only to the existing equipment page for region/facility context.
- [ ] 7.6 Add focused tests for query-param hydration if new support is required.
- [ ] 7.7 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 7.8 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 7.9 Run `node scripts/npm-run.js run typecheck`.
- [ ] 7.10 Run focused backend/RPC verification for role scopes, field matching, quota joining, unassigned/not-in-quota/no-active-quota states, and representative `EXPLAIN` plans.
- [ ] 7.11 Run focused React tests for changed UI behavior and quota status labels.
- [ ] 7.12 Verify Reports tab URL hydration by loading `/reports?tab=equipment-search&q=...` directly and confirming the query and selected scope restore after refresh or back navigation.
- [ ] 7.13 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 7.14 Manually verify header search, chart rendering, drill-down, quota labels, and equipment deep-links in browser.

## Release Notes

- [ ] 8.1 Document that v1 is submit-only and has no autocomplete.
- [ ] 8.2 Document that the Reports equipment search tab aggregates equipment counts only.
- [ ] 8.3 Document that detail inspection happens through existing equipment page deep-links.
- [ ] 8.4 Document that quota information is read-only in global search and unit-level quota assignment remains outside this workflow.
