[ARCHIVED] See `openspec/changes/archive/2025-10-25-refactor-server-status-and-search-filtering-repair-requests/`.

### Database
- [x] Extend `public.repair_request_list` with `p_statuses TEXT[] DEFAULT NULL` (keep `p_status` for back-compat).
- [x] Implement `v_statuses` precedence logic and apply `r.trang_thai = ANY(v_statuses)` in both total and data queries.
- [x] Create `public.repair_request_status_counts(p_q TEXT, p_don_vi BIGINT, p_date_from DATE, p_date_to DATE)` that mirrors scoping and non-status filters; returns JSONB map of counts.
- [x] Verify/ensure indexes: `idx_yeu_cau_sua_chua_status_date (trang_thai, ngay_yeu_cau desc)`.
- [x] Add `COMMENT ON FUNCTION` and `GRANT EXECUTE` for both RPCs.
- [x] Migration gotcha: PostgreSQL does NOT support `IF EXISTS` on `REVOKE ... ON FUNCTION`; use `DROP FUNCTION IF EXISTS ...` to remove prior signatures instead of `REVOKE ... IF EXISTS`.

### API Proxy
- [x] Ensure `p_statuses` is forwarded unchanged; optional: validate it is an array of strings.

### Client
- [x] Update `src/app/(app)/repair-requests/page.tsx`:
  - [x] Query key includes `{ statuses, q, dateFrom, dateTo, donVi, page, pageSize }`.
  - [x] RPC args include `p_statuses` (null if empty) and `p_q`.
  - [x] Remove column-based status filtering sync; rely solely on server.
  - [x] Reset to page 1 upon status or q changes.
  - [x] Replace N RPC calls with `repair_request_status_counts` for summary bar.
  - [x] Keep debounce for search input; no client-side `globalFilter`.
- [x] Update `FilterModal` and `FilterChips` wiring (no table column filter coupling).

### QA & Validation
- [x] Verify totals and list length match direct SQL under combinations of filters for roles (tenant, regional_leader, global).
- [x] Verify regional_leader can only see facilities within region and has read-only UI.
- [x] Validate pagination after changing statuses and q resets to page 1.
- [x] Confirm counts RPC matches list filters (excluding status) and updates in one request.

### Docs / OpenSpec
- [x] Update OpenSpec archive after implementation.
- [x] Note migration signature change and status counts RPC in changelog.

