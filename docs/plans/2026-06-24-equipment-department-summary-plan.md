# Equipment Search Department Summary Plan

## Summary

After users search or filter the Equipment page, show how the filtered result set is distributed by `khoa_phong_quan_ly`. Keep the feature narrow: this is not a generic grouping system for model, manager, location, or funding source.

Column sorting does not solve this pain point. Sorting can place similar rows near each other, but it does not show exact counts and it only operates on the paginated table view.

## Key Changes

- Add a compact "Phan bo theo khoa/phong" summary near the existing Equipment toolbar.
- Show each department with an exact equipment count for the full filtered/search result set, not only the current page.
- Sort department summary items by count descending.
- Let users click a department summary item to apply the existing `khoa_phong_quan_ly` filter for quick drill-down.
- Apply only subtle visual grouping:
  - very light pastel row backgrounds for rows on the current page,
  - matching department badges/chips with slightly stronger color,
  - neutral gray for empty or missing departments shown as `Chua cap nhat`.
- Do not add collapsible group sections or alter pagination behavior in v1.

## Interface And Data

- Add a scoped aggregate RPC, for example `equipment_department_distribution`.
- The RPC should reuse the same access rules and filter contract as `equipment_list_enhanced`: text search, tenant/facility, departments, users, locations, statuses, classifications, and funding sources.
- Return only the fields needed by the UI:
  - `department: string | null`
  - `label: string`
  - `count: number`
- Treat `NULL` and empty department names as `Chua cap nhat`.
- Add a parallel React Query request in `useEquipmentData`; the query key should include the same search/filter inputs as the equipment list but must not include pagination.
- Do not use `equipment_filter_buckets` for this feature. It is for tenant/facility filter options and does not represent the current search/filter result distribution.

## Test Plan

- SQL smoke test: verifies distribution counts after search/filter, tenant scope, and `Chua cap nhat` handling.
- Hook test: verifies the aggregate query receives the same search/filter args and ignores pagination.
- UI test: verifies summary counts render, clicking a department applies the existing department filter, and row/badge colors are subtle and stable.
- Implementation verification for TypeScript/React and SQL changes:
  - Supabase MCP for DB inspection and migration work.
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run verify:dedupe`
  - `node scripts/npm-run.js run typecheck`
  - focused tests for changed behavior
  - `node scripts/npm-run.js run react-doctor`

## Assumptions

- The count must cover the full filtered/search result set.
- Version 1 only summarizes by department.
- Color is a light scanning aid, not the primary information channel.
