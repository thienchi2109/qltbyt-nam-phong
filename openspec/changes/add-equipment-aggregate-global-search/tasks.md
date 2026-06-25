# Implementation Tasks

## 1. Discovery And Contracts

- [ ] 1.1 Inspect current equipment list search fields, route query params, and facility/region filters.
- [ ] 1.2 Inspect live schema/RPC patterns for `thiet_bi`, `don_vi`, `dia_ban`, equipment group/category, and regional leader scoping.
- [ ] 1.3 Confirm whether existing equipment page supports `search`, `region`, and `facility` deep-link params.
- [ ] 1.4 Define final RPC name, request shape, response shape, and TypeScript types.
- [ ] 1.5 Confirm existing indexes and query plan before adding new indexes.

## 2. Backend Aggregate Search

- [ ] 2.1 Create Supabase migration for the aggregate equipment search RPC.
- [ ] 2.2 Validate JWT role/user claims inside the RPC.
- [ ] 2.3 Normalize `admin` to `global` where needed.
- [ ] 2.4 Enforce admin/global all-facility scope.
- [ ] 2.5 Enforce regional leader allowed-region/facility scope server-side.
- [ ] 2.6 Reject unsupported roles for this RPC.
- [ ] 2.7 Match keyword against equipment name, model, serial, and equipment group/category.
- [ ] 2.8 Exclude internal equipment code from search matching.
- [ ] 2.9 Return grouped aggregate counts for `region` and `facility` modes.
- [ ] 2.10 Grant execute permission only as required by the app's RPC pattern.
- [ ] 2.11 Add the RPC to the API proxy allowlist if the app calls it through `/api/rpc/[fn]`.
- [ ] 2.12 Run Supabase MCP security advisors after applying the migration.

## 3. Client Data Layer

- [ ] 3.1 Add TypeScript request/response types for aggregate equipment search.
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
- [ ] 5.8 Build deep-links to the existing equipment page for region/facility context.
- [ ] 5.9 Add focused tests for drill-down, URL updates, and deep-link construction.

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
- [ ] 7.4 Run focused backend/RPC verification for role scopes and field matching.
- [ ] 7.5 Run focused React tests for changed UI behavior.
- [ ] 7.6 Verify global-search URL hydration by loading `/global-search?q=...` directly and confirming the query and selected scope restore after refresh or back navigation.
- [ ] 7.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 7.8 Manually verify chart rendering and drill-down in browser.

## 8. Release Notes

- [ ] 8.1 Document that v1 is submit-only and has no autocomplete.
- [ ] 8.2 Document that global search aggregates equipment counts only.
- [ ] 8.3 Document that detail inspection happens through existing equipment page deep-links.
