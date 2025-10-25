[ARCHIVED] Moved to `openspec/changes/archive/2025-10-25-refactor-server-status-and-search-filtering-repair-requests/`.

Status: Proposal
Date: 2025-10-25
Owner: Agent Mode

## Current State (Audit)
- RPC `public.repair_request_list` supports: `p_q TEXT`, `p_status TEXT`, pagination, facility filter (`p_don_vi`), VN-local date range filtering (added).
- Page `src/app/(app)/repair-requests/page.tsx`:
  - Passes `p_q` to RPC (server-side search) but also sets `globalFilter` and enables `getFilteredRowModel` (potential double filtering perception).
  - Status filtering is client-side via TanStack column filter; RPC call uses `p_status: null`.
  - Status counts are calculated by multiple RPC calls (one per status) to read `.total`.

## Problems
- Inconsistent filtering (status applied client-side vs others server-side) → confusing totals/pagination.
- Unnecessary over-fetching when status is used.
- Status counts query is N calls and not aligned with all filters (date, facility, q) unless carefully threaded.

## Goals
1. Move Status filter to server-side (supports multi-select) and keep pagination authoritative.
2. Keep Search fully server-side (no client-side global filtering) while preserving debounce behavior.
3. Provide a single RPC to return status counts consistent with the current filter set (excluding status filter).
4. Preserve existing security model: tenant isolation, regional_leader scoping, global visibility.

## What Changes

### Database (SQL / RPC)
- Extend `public.repair_request_list` to accept a multi-select parameter:
  - Add `p_statuses TEXT[] DEFAULT NULL`.
  - Back-compat: preserve existing `p_status TEXT`; if `p_statuses` is provided (non-empty), it takes precedence; otherwise, fold `p_status` into a 1-length array.
  - Apply filter using a computed array:
    ```sql
    DECLARE
      v_statuses TEXT[] := NULL;
    BEGIN
      IF p_statuses IS NOT NULL AND array_length(p_statuses,1) IS NOT NULL THEN
        v_statuses := p_statuses;
      ELSIF p_status IS NOT NULL AND p_status <> '' THEN
        v_statuses := ARRAY[p_status];
      END IF;
      -- ...
      AND (v_statuses IS NULL OR r.trang_thai = ANY (v_statuses))
    ```
- Add RPC `public.repair_request_status_counts(
    p_q TEXT DEFAULT NULL,
    p_don_vi BIGINT DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
  ) RETURNS JSONB`:
  - Applies the same tenant/facility scoping and VN-local date range + search filters as `repair_request_list`.
  - Returns counts for the canonical set: `['Chờ xử lý','Đã duyệt','Hoàn thành','Không HT']`.
  - Excludes status filter so the counts reflect the current non-status filters.
- Performance/Indexing (verify / recommend):
  - Ensure `idx_yeu_cau_sua_chua_status_date` on `(trang_thai, ngay_yeu_cau DESC)` exists.
  - GIN text search indices already exist for request and equipment tables (keep).

### API Proxy (`src/app/api/rpc/[fn]/route.ts`)
- No structural changes (pass-through args already supported).
- Optional: sanitize `p_statuses` to array of strings if present.

### Client (`src/app/(app)/repair-requests/page.tsx` and UI components)
- Query:
  - Include `statuses: uiFilters.status` in the react-query `queryKey`.
  - Pass `p_statuses: uiFilters.status?.length ? uiFilters.status : null` to `callRpc`.
  - Reset pagination when `uiFilters.status` or `debouncedSearch` changes.
- Remove client-side status column filtering linkage:
  - Stop syncing `columnFilters` → `uiFilters.status`.
  - Do not set `table.getColumn('trang_thai').setFilterValue(...)` for status.
- Search:
  - Keep debounce and pass `p_q` only; rely on server for results.
  - Optionally drop `globalFilter` from table state to avoid confusion.
- Status counts:
  - Replace N-per-status queries with a single `repair_request_status_counts` RPC.
  - Thread `q`, `date range`, and `facility` to counts query for consistent summaries.
- UI:
  - FilterModal retains multi-select; chips continue to display multi-status selections.

## Security
- Preserve existing function-level security:
  - `SECURITY DEFINER`, `search_path` hardened.
  - Tenant isolation via `allowed_don_vi_for_session()` for non-global users.
  - Global users may set `p_don_vi` (or NULL for all); non-global users’ `p_don_vi` validated against allowed facilities.
  - Regional leaders remain read-only; visibility scoped to allowed facilities.

## Success Criteria
- Server returns identical row counts to direct SQL for the same filter set.
- Pagination totals and pages reflect status filters.
- Status counts reflect (q, date range, facility) filters and update in a single RPC.
- No cross-tenant data exposure (verified by role tests).

## Rollout & Backward Compatibility
- The extended signature keeps `p_status` for back-compat; new clients use `p_statuses`.
- Deploy DB migration first; then ship client changes.

## Risks & Mitigations
- Risk: larger SQL conditional logic → regression. Mitigate with unit SQL tests for v_statuses logic.
- Risk: counts RPC drift. Mitigate by sharing WHERE clause blocks and reviewing via EXPLAIN.

## Appendix: SQL Sketch (for migration file)

```sql
-- 1) Extend repair_request_list (sketch only; follow existing function body)
CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_statuses TEXT[] := NULL;
  -- ... keep existing DECLARE vars
BEGIN
  IF p_statuses IS NOT NULL AND array_length(p_statuses,1) IS NOT NULL THEN
    v_statuses := p_statuses;
  ELSIF p_status IS NOT NULL AND p_status <> '' THEN
    v_statuses := ARRAY[p_status];
  END IF;

  -- ... existing WHERE
  AND (v_statuses IS NULL OR r.trang_thai = ANY (v_statuses))
  AND (p_q IS NULL OR p_q = '' OR ...)
  AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to   IS NULL OR r.ngay_yeu_cau <  ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));
  -- ... return JSONB with total/page/pageSize
END; $$;

GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT[]) TO authenticated;

-- 2) New status counts RPC
CREATE OR REPLACE FUNCTION public.repair_request_status_counts(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_result JSONB := '{}'::jsonb;
BEGIN
  -- same tenant scoping as repair_request_list (global vs allowed array)
  -- build filtered set as CTE, then aggregate counts per trang_thai into JSONB
  RETURN (
    WITH base AS (
      SELECT r.trang_thai
      FROM public.yeu_cau_sua_chua r
      JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
      WHERE -- tenant scoping (same as main RPC)
        AND (p_q IS NULL OR p_q = '' OR r.mo_ta_su_co ILIKE '%'||p_q||'%' OR r.hang_muc_sua_chua ILIKE '%'||p_q||'%' OR tb.ten_thiet_bi ILIKE '%'||p_q||'%' OR tb.ma_thiet_bi ILIKE '%'||p_q||'%')
        AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND (p_date_to   IS NULL OR r.ngay_yeu_cau <  ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    )
    SELECT jsonb_build_object(
      'Chờ xử lý', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'Chờ xử lý'),0),
      'Đã duyệt',   COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'Đã duyệt'),0),
      'Hoàn thành', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'Hoàn thành'),0),
      'Không HT',   COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'Không HT'),0)
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.repair_request_status_counts(TEXT, BIGINT, DATE, DATE) TO authenticated;
```
