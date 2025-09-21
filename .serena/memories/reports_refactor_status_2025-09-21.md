# Reports Page Refactor — Status (2025-09-21)

## Implemented
- Tenant gating (global/admin must choose tenant or "all"). Tip shown when gated. Persisted via `localStorage: reports_tenant_filter`.
- Server-side department filtering:
  - New RPC: `equipment_list_for_reports(p_q, p_sort, p_page, p_page_size, p_don_vi, p_khoa_phong)`.
  - Updated RPCs: `transfer_request_list_enhanced(..., p_don_vi, p_date_from, p_date_to, p_khoa_phong)`, `equipment_count_enhanced(p_statuses, p_q, p_don_vi, p_khoa_phong)`.
  - API whitelist includes `equipment_list_for_reports`.
- Frontend wiring:
  - `useInventoryData` passes `p_don_vi` + `p_khoa_phong`; removed client-side dept filtering.
  - React Query `staleTime: 0` for Inventory to force refetch on filter change.
  - Distribution components accept tenant props and use tenant-scoped data.
- Filter persistence across pages:
  - New hook `useReportInventoryFilters(tenantKey)` keeps `dateRange`, `selectedDepartment`, `searchTerm` in Query cache and mirrors to localStorage per tenant. Reactive state for instant UI updates.
- Debug cleanup: removed console logs in Reports paths and `notification-bell-dialog.tsx`; removed RPC proxy/SQL notices.

## Migrations
- `supabase/migrations/20250921_reports_enhanced_rpcs.sql`
- `supabase/migrations/20250921_reports_department_filter.sql`

## Resolved
- Dept filter not refetching immediately → set `staleTime: 0` + reactive filters hook.
- Tenant filter resetting → initialize from localStorage in useState.
- PWA dev 404 noise — PWA disabled in dev; unregister stale SW if needed.

## Follow-ups (optional)
- Move usage analytics fully to RPCs for top equipment/users.
- Consider trimming/casing `p_khoa_phong` server-side if source data varies.
