# Reports Excel Export — Overview

## Filters & Roles
- Tenant (global/admin must select tenant; non-global auto-scoped)
- Department (optional, server-side)
- Date range (used for maintenance/usage; inventory transactions remain UI slice)

## RPCs
- `equipment_status_distribution(p_q, p_don_vi, p_khoa_phong, p_vi_tri)`
  - Returns: totals, by-department, by-location arrays and lookup lists
  - Status keys: `hoat_dong`, `cho_sua_chua`, `cho_bao_tri`, `cho_hieu_chuan`, `ngung_su_dung`, `chua_co_nhu_cau`
- `maintenance_stats_for_reports(p_date_from, p_date_to, p_don_vi, p_khoa_phong)`
  - Repairs date window: `COALESCE(ngay_yeu_cau, ngay_duyet, ngay_hoan_thanh)`
  - Plans date window: `nam` between selected years
  - Completed tasks: any monthly completion flag or completion timestamp present
- `usage_analytics_overview(p_don_vi)` and `usage_analytics_daily(p_days, p_don_vi)`
  - Overview totals and daily series (minutes, sessions, unique users & equipment)

## Excel Sheets
- Tổng quan — time window, department, inventory summary
- Chi tiết giao dịch — per transaction (import/export)
- Thống kê giao dịch — per-department counts (import/export)
- Phân bố trạng thái — status counts + percentages
- Trạng thái theo khoa — status breakdown by department
- Trạng thái theo vị trí — status breakdown by location
- Sửa chữa - Tổng quan — requests totals (completed/in-progress/pending)
- Bảo trì - Tổng quan — plans/tasks/completed tasks
- Sử dụng TB - Tổng quan — sessions, active sessions, total minutes
- Sử dụng TB - Theo ngày — daily usage series

## Implementation Notes
- No new libraries; uses dynamic import for `xlsx`
- Claims derived from NextAuth session; proxy sanitizes tenant for non-global
- React Query gating via effective tenant key; staleTime tuned for UX
- Consolidated migration: `supabase/migrations/20250923_reports_exports_final.sql`
