# Repair Request Alert Banner — Pagination Root Cause & Fix Plan

- **Date**: 2026-05-04
- **Page**: `/repair-requests`
- **Component**: `<RepairRequestAlert />` (the destructive-styled accordion banner showing "Có N yêu cầu sửa chữa sắp/quá hạn cần chú ý!")
- **Status**: Implemented on branch; migration/spec files written, not yet applied.

## 1. Symptom

The alert banner at the top of the Repair Requests page only counts and lists overdue (`quá hạn`) and upcoming-due-within-7-days (`sắp quá hạn`) requests **on the currently active page**. When the page-size limits the row set (default 50 rows / page), overdue or upcoming requests on other pages are silently excluded from both the badge count in the title and the accordion list. The banner is therefore wrong whenever the filtered dataset exceeds one page.

## 2. Verified Data Flow

1. `useRepairRequestsData` calls the paginated RPC `repair_request_list` and returns `requests = repairRequestsRes?.data ?? []` — a single page of rows.
   - File: `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts:85-113`
2. `RepairRequestsPageClient` passes `requests` straight through to `RepairRequestsPageLayout`.
   - File: `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx:118-135`, `:293-323`
3. `RepairRequestsPageLayout` renders `<RepairRequestAlert requests={requests} />` (no transformation).
   - File: `src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx:120-122`
4. `RepairRequestAlert` filters `requests` **client-side**:
   ```ts
   const dueDate = startOfDay(parseISO(req.ngay_mong_muon_hoan_thanh));
   const daysDifference = differenceInDays(dueDate, today);
   return daysDifference <= 7;
   ```
   then sorts and renders `count` + accordion list.
   - File: `src/components/repair-request-alert.tsx:27-54`
5. Server side, `repair_request_list` applies `OFFSET v_offset / LIMIT v_limit` directly on the data query, so only rows in the current page reach the client.
   - File: `supabase/migrations/20260428132000_fix_repair_request_read_scope.sql:222-227`
   - Sort is `ORDER BY r.ngay_yeu_cau DESC` (request creation date), **not** by `ngay_mong_muon_hoan_thanh`. Older overdue requests easily fall to later pages and become invisible to the alert.

### Conclusion

The alert is **client-side counting on a server-side paginated dataset**. The badge count is the count of "overdue/upcoming" intersected with the current page only.

## 3. Why It Wasn't Caught Earlier

- The page already has a server-side `repair_request_status_counts` RPC (used by the KPI status bar) that correctly aggregates over the entire filtered dataset. The alert banner predates server pagination on this page, and was not migrated when pagination was added (see `supabase/migrations/2025-10-11_repair-request/20251011_add_pagination_to_repair_request_list.sql`).
- Manual testing tends to happen on small tenants where total < pageSize, hiding the bug.

## 4. Proposed Solutions

### Option A — Dedicated server-side RPC `repair_request_overdue_summary` (initial alternative, not chosen)

Retrospective: this was superseded by enriching `repair_request_status_counts`, which preserves page-independent metrics while avoiding an extra summary round-trip.

**Idea**: Create a small RPC that returns the summary AND a top-N list of overdue/upcoming items, computed across the entire filtered dataset.

**Response shape**:

```jsonc
{
  "total":      12, // total count of overdue + due-soon (≤ 7 days)
  "overdue":     5, // diff < 0
  "due_today":   2, // diff = 0
  "due_soon":    5, // 1 ≤ diff ≤ 7
  "items": [        // top N (e.g. 50) sorted by dueDate ASC
    {
      "id": ...,
      "ngay_mong_muon_hoan_thanh": "...",
      "trang_thai": "...",
      "mo_ta_su_co": "...",
      "nguoi_yeu_cau": "...",
      "thiet_bi": { "ten_thiet_bi": "...", "ma_thiet_bi": "..." },
      "days_difference": -3
    }
  ]
}
```

**Filter parameters** (mirror `repair_request_list` so the alert respects the same filter bar):
`p_q text, p_don_vi bigint, p_date_from date, p_date_to date`

**Server filter**:

```sql
r.trang_thai IN ('Chờ xử lý','Đã duyệt')
AND r.ngay_mong_muon_hoan_thanh IS NOT NULL
AND r.ngay_mong_muon_hoan_thanh <= (CURRENT_DATE AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '7 days'
ORDER BY r.ngay_mong_muon_hoan_thanh ASC
LIMIT 50
```

**Security/scoping**: must mirror `repair_request_list` exactly (`SECURITY DEFINER`, role check via `_get_jwt_claim('app_role')`, `allowed_don_vi_for_session()`, `_normalize_department_scope` for `role='user'`, sanitize ILIKE for `p_q`). See `supabase/migrations/20260428132000_fix_repair_request_read_scope.sql:91-165` as the canonical pattern. Do **not** mirror `repair_request_status_counts` for access control: use it only as a reference for the `count(*) FILTER (...)` aggregation shape.

**Frontend changes**:

- `useRepairRequestsData`: add a 3rd `useQuery` with key `['repair_request_overdue_summary', { tenant, role, diaBan, facilityId, search, dateFrom, dateTo }]` (deliberately NOT keyed on `page/pageSize`). Expose `overdueSummary`, `overdueLoading`.
- `RepairRequestAlert`: replace `requests: RepairRequestWithEquipment[]` prop with `summary: OverdueSummary | undefined` + `isLoading: boolean`. Drop the client-side `useMemo` filter; render `summary.total` and `summary.items` directly.
- `RepairRequestsPageClient` / `RepairRequestsPageLayout`: pass `overdueSummary` instead of raw `requests`.

**Cache invalidation**: after create / edit / approve / complete / delete repair-request mutations, also invalidate `['repair_request_overdue_summary']` (mirror the existing pattern for `repair_request_list`).

**Pros**: accurate count over full dataset; small payload; respects all UI filters; independent cache.
**Cons**: requires a new migration + RBAC smoke tests (one-time cost).

### Option A′ — Server count only, no items

Same RPC but returns only `{ total, overdue, due_today, due_soon }`. Accordion list keeps client-side filter against the current page.

**Pros**: smaller surface, simpler RPC, banner count is correct.
**Cons**: accordion still shows an incomplete list, which contradicts the count. Confusing UX.

### Option B — Extend `repair_request_status_counts`

Add `overdue` / `due_soon` counters to the existing `repair_request_status_counts` RPC.

**Pros**: no new RPC.
**Cons**: pollutes semantics of `status_counts` (now also knows about deadlines), and we still need a 2nd round-trip to fetch `items` for the accordion list — defeats the simplification.

### Option C — Fetch full unpaginated list for the alert

Hit `repair_request_list` with `p_page_size = 1000` just for the alert.

**Pros**: zero schema work.
**Cons**: violates server-pagination discipline (issue #366 plan moves the opposite way), wastes bandwidth, scales badly with large tenants, may exceed payload limits. **Not recommended.**

## 5. Recommended Path: Option B (revised)

Update 2026-05-04: after implementation review, the chosen path is to keep `repair_request_list` paginated and page-bound, while enriching `repair_request_status_counts` with an `overdue_summary` payload. This preserves a page-independent query for KPI + banner data and removes the extra summary round-trip without coupling banner refreshes to pagination.

### Implementation Outline (TDD order)

1. **RED — frontend hook tests** `src/app/(app)/repair-requests/__tests__/useRepairRequestsData.test.ts`
   - Change the `repair_request_status_counts` contract to return both `counts` and `overdue_summary`.
   - Verify this query key includes tenant / role / diaBan / facility / search / date filters but deliberately excludes `page` / `pageSize`.
   - Verify the hook still exposes `statusCounts` and `overdueSummary` as separate fields derived from the shared payload.

2. **RED — page / alert regression tests**
   - Extend `src/app/(app)/repair-requests/__tests__/RepairRequestsKpi.test.tsx` or add a focused alert test file.
   - Prove the invariant that changing pagination does **not** change the banner summary.
   - Prove search / facility / date filter changes **do** flow into the summary query key.
   - Cover the `shouldFetchData = false` case so no summary query fires before a global user selects a facility.

3. **RED — invalidation tests**
   - Update repair-request mutation tests so create / edit / approve / complete / delete keep invalidating the shared `repair_request_status_counts` metrics query.
   - Cover both invalidation paths in the repo:
     - explicit invalidation in `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
     - shared-family invalidation in `src/hooks/use-cached-repair.ts`
   - If `repairKeys.all` does not cover the new key shape, the implementation must add explicit invalidation.

4. **RED — SQL spec / smoke checklist** `supabase/tests/repair_request_status_counts_overdue_summary_smoke.spec.sql`
   - Roles: global, regional_leader, to_qltb (same dia_ban), user (department scope), cross-tenant isolation.
   - Date boundaries: today, today−1, today+7, today+8, NULL `ngay_mong_muon_hoan_thanh`.
   - Status filter: only `Chờ xử lý` + `Đã duyệt` qualify; `Hoàn thành` / `Không HT` excluded.
   - Combined with `p_q`, `p_don_vi`, `p_date_from/to`.

5. **GREEN — migration** `supabase/migrations/<date>_enrich_repair_request_status_counts_with_overdue_summary.sql`
   - `CREATE OR REPLACE FUNCTION public.repair_request_status_counts(...) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`.
   - Mirror the live guard structure of `repair_request_list`, including:
     - non-empty `role` guard
     - non-empty `user_id` guard
     - `admin` treated the same as `global`
     - `allowed_don_vi_for_session()` enforcement for non-global roles
     - `_normalize_department_scope(...)` enforcement for `role = 'user'`
     - `_sanitize_ilike_pattern(p_q)` instead of raw ILIKE concatenation
   - Return:
     - `counts` for KPI cards
     - `overdue_summary` for the alert banner
   - `GRANT EXECUTE ... TO authenticated; REVOKE FROM PUBLIC;`
   - Do **not** apply the migration until explicitly requested.

6. **GREEN — frontend hook** `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts`
   - Add typed `OverdueSummary` / page-metrics interface in `src/app/(app)/repair-requests/types.ts`.
   - Reuse the existing `repair_request_status_counts` query and unpack `counts` + `overdue_summary`.
   - Remove the extra summary round-trip.

7. **GREEN — component** `src/components/repair-request-alert.tsx`
   - Replace `requests` prop with `summary` + `isLoading`.
   - Remove client-side `useMemo` filter; render `summary.total` in title and `summary.items` in accordion content.
   - Loading and empty states (`summary?.total === 0` → return null; loading → return null or a small skeleton).

8. **GREEN — wiring**
   - `RepairRequestsPageLayout`: drop `requests` prop, accept `overdueSummary` + `overdueLoading`.
   - `RepairRequestsPageClient`: pass `overdueSummary` from the hook.

9. **GREEN — mutation invalidations**
   - Keep invalidation on `repair_request_status_counts`; no extra summary query should exist after the merge.

10. **REFACTOR**
   - Keep type extraction and prop cleanup small and local after the RED tests have gone green.

### Verification (per AGENTS.md)

For TDD execution:

1. Run the new / updated focused tests first and confirm they fail for the intended reason.
2. Implement the smallest slice required to make them pass.
3. Re-run the same focused tests before moving to wider verification.

For the TypeScript / React diff after the focused tests are green:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused vitest on:
   - `useRepairRequestsData`
   - repair-request alert / page regression coverage
   - repair-request mutation invalidation coverage
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
5. Manual UI: paginate page 1 / 2 / 3 → banner count must NOT change; change search/date/facility filter → banner updates accordingly.

For the SQL migration when explicitly authorized to apply it:

- Run an executable version of `supabase/tests/repair_request_status_counts_overdue_summary_smoke.spec.sql` via MCP `execute_sql` once the migration is explicitly approved for apply.
- Post-migration: `get_advisors(security)` and `get_advisors(performance)`.

### Risks & Considerations

- **RBAC parity** — biggest risk. The new RPC must reproduce every guard `repair_request_list` has (issue #342 was a regression here once already). Smoke tests must cover it.
- **Proxy allow-list** — easy to miss. Without adding the RPC name to `allowed-functions.ts`, frontend code will fail even if the SQL is correct.
- **Timezone alignment** — server uses `Asia/Ho_Chi_Minh`; current frontend uses `startOfDay(new Date())` in browser local TZ. Recommend computing `days_difference` server-side and rendering `summary.items[*].days_difference` instead of recomputing on the client.
- **Cache invalidation** — must be added to every repair-request mutation site and matched to the actual query-key family, or the banner becomes stale after status changes.
- **Performance** — current live indexes do not yet prove that a due-date-specific index is required. Verify behavior first; only add a partial index on `ngay_mong_muon_hoan_thanh` for `trang_thai IN ('Chờ xử lý','Đã duyệt')` if explain/advisors show the need.
- **Filter semantics** — recommend the alert respect the full UI filter bar (search/date/facility) so users see exactly the alert that matches the list they're filtering. Diverging from this would be surprising.

## 6. Acceptance Criteria

- Alert banner count reflects the entire filtered dataset, not the current page.
- Pagination controls have no effect on the badge count or the accordion items.
- Filter bar (search, facility, date range) updates the banner consistently with the table.
- All RBAC roles (global, regional_leader, to_qltb, user with department scope) see exactly the rows they are allowed to see.
- `repair_request_status_counts` remains reachable through the RPC proxy allow-list and returns both `counts` and `overdue_summary`.
- No regression to existing tests; new smoke tests pass.
- `verify:no-explicit-any`, `typecheck`, focused vitest, and `react-doctor --diff main` all green.

## 7. References

- `src/components/repair-request-alert.tsx`
- `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`
- `src/app/(app)/repair-requests/_components/RepairRequestsPageLayout.tsx`
- `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts`
- `supabase/migrations/20260428132000_fix_repair_request_read_scope.sql`
- `supabase/migrations/2025-10-25/20251025_status_filter_and_counts_rpc.sql`
- `supabase/migrations/2025-10-11_repair-request/20251011_add_pagination_to_repair_request_list.sql`
