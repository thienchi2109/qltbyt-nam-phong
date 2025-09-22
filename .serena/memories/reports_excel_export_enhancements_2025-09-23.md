# Reports Excel Export Enhancements — 2025-09-23

## Summary
Completed Excel export for Reports with tenant/department wiring and added status distribution, maintenance/repairs, and usage analytics. Kept bundle size unchanged (dynamic XLSX import) and honored TanStack Query gating and server-side filtering via RPCs.

## Key Changes
- New RPCs (server-side aggregation)
  - `equipment_status_distribution(p_q, p_don_vi, p_khoa_phong, p_vi_tri)` → totals + by-department/location, robust status mapping; unknown defaults to active.
  - `maintenance_stats_for_reports(p_date_from, p_date_to, p_don_vi, p_khoa_phong)` → repair and maintenance summaries; repairs use `COALESCE(ngay_yeu_cau, ngay_duyet, ngay_hoan_thanh)`, plans filter by `nam` year window; completed tasks detected via monthly flags or completion timestamps.
- API allowlist: added both RPCs to `src/app/api/rpc/[fn]/route.ts`.
- Hooks & wiring
  - Refactored `useEquipmentDistribution` to consume server-aggregated RPC.
  - Added `useMaintenanceStats` and `useUsageAnalytics` hooks.
  - `inventory-report-tab.tsx` passes distribution + maintenance + usage data to export dialog following tenant/department filter state.
- Export template (Excel)
  - Existing: Tổng quan, Chi tiết giao dịch, Thống kê giao dịch.
  - New: Phân bố trạng thái, Trạng thái theo khoa, Trạng thái theo vị trí, Sửa chữa - Tổng quan, Bảo trì - Tổng quan, Sử dụng TB - Tổng quan, Sử dụng TB - Theo ngày.

## Migrations
- Consolidated final migration: `supabase/migrations/20250923_reports_exports_final.sql`.
- Removed earlier intermediate/faulty migrations for clarity.

## Acceptance Criteria
- No new libraries; dynamic import for `xlsx` preserved.
- Export reflects current filters (tenant, department, date range).
- Claims sanitized in proxy; non-global tenant enforced.
- TypeScript typecheck passed.

## Notes
- Status mapping is tolerant to common VN text variants; fallback → active.
- Plan filter uses `nam` year range; can switch to `ngay_phe_duyet` window if desired.
- Maintenance hook has graceful fallback (zeros) to keep UI/export stable on transient RPC errors.

## Potential Follow-ups
- Optional: add wrapper `maintenance_stats_enhanced` → call new function for legacy callers.
- Optional: add richer per-status/department charts to export (sparklines) if required later.
