# Review — Issue #384 Implementation on `fix/issue-384-repair-request-alert-rootcause`

- **Date**: 2026-05-04
- **Branch reviewed**: `fix/issue-384-repair-request-alert-rootcause`
- **Commits reviewed**: `5fe2ca5..742aeda` (4 commits on top of the initial docs commit)
  - `b5a86a4` docs(repair-requests): tighten issue 384 TDD plan
  - `33adf06` fix(repair-requests): summarize overdue alerts across full scope
  - `ccfbe09` refactor(repair-requests): merge alert summary into page metrics rpc
  - `742aeda` fix(repair-requests): address review follow-ups
- **Reviewer**: Devin
- **Scope**: Static review of SQL migration, hook wiring, component refactor, tests, and deployment orderings. Live DB state checked via Supabase MCP.

## TL;DR

The chosen implementation is a **hybrid of Plan Option B** (merge overdue summary into `repair_request_status_counts`) rather than the recommended Option A (dedicated `repair_request_overdue_summary` RPC). Performance-wise this saves one round-trip per page load, which is reasonable. The frontend carries a defensive compat shim that accepts both the old flat-count shape and the new `{counts, overdue_summary}` shape, which is good.

However, the branch is **not safe to deploy in its current state**:

1. **Blocker (HIGH)**: The migration `20260504110000_enrich_repair_request_status_counts_with_overdue_summary.sql` is not applied to the live DB. Deploying the frontend before applying it causes the alert banner to **silently disappear** (not incorrect → empty). This is a regression of user-facing behaviour relative to `main`.
2. **Blocker (HIGH)**: The smoke test file was downgraded from executable `.sql` to a comment-only `.spec.sql` checklist. RBAC parity with `repair_request_list` — the exact regression vector of issue #342 — is unverified.
3. **Medium**: The SQL count path uses 4 correlated scalar subqueries over the `filtered` CTE, which can be materialised or inlined differently by the planner. The idiomatic `count(*) FILTER (WHERE trang_thai = …)` single-pass pattern should be used.
4. **Medium**: The partial index recommended by the plan (`(ngay_mong_muon_hoan_thanh, trang_thai) WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')`) was not added.

Frontend changes are otherwise clean, well-typed, and include reasonable unit tests for the new hook shape.

---

## What Changed (Summary)

### Backend (SQL)

- **New migration** `supabase/migrations/20260504110000_enrich_repair_request_status_counts_with_overdue_summary.sql`
  - Supersedes the `public.repair_request_status_counts(text, bigint, date, date)` body from `supabase/migrations/2025-10-25/20251025_status_filter_and_counts_rpc.sql`.
  - Same parameter signature.
  - **Breaking** response shape: `{ counts: { "Chờ xử lý": n, "Đã duyệt": n, "Hoàn thành": n, "Không HT": n }, overdue_summary: { total, overdue, due_today, due_soon, items: [...] } }`.
  - Computes `v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`.
  - Builds a `filtered` CTE with RBAC guards + ILIKE sanitization + date-range filter (mirroring `repair_request_list` body), then a `due_items` CTE (`trang_thai IN ('Chờ xử lý','Đã duyệt') AND ngay_mong_muon_hoan_thanh <= v_today + 7`), then `ranked_items` (`ORDER BY ngay_mong_muon_hoan_thanh ASC, id ASC LIMIT 50`).
  - Output aggregated via 4 scalar subqueries over `filtered` for counts + 4 subqueries over `due_items` for summary + 1 JSON build pass over `ranked_items`.
- **Smoke test** `supabase/tests/repair_request_status_counts_overdue_summary_smoke.spec.sql` — **renamed** from `.sql` to `.spec.sql` in commit `742aeda`; the file body was converted from executable SQL placeholders to a pure comment-only checklist.

### Frontend

- `src/app/(app)/repair-requests/types.ts` — new `RepairRequestOverdueSummary`, `RepairRequestOverdueItem`, `RepairRequestStatusCounts`, `RepairRequestPageMetrics` types.
- `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts`
  - Retains the single `useQuery` for `repair_request_status_counts`; response type widened to `RepairRequestPageMetrics | RepairRequestStatusCounts`.
  - `isRepairRequestPageMetrics` narrows at runtime and exposes `statusCounts` + `overdueSummary` + `overdueLoading`.
- `src/components/repair-request-alert.tsx`
  - Replaces client-side `useMemo(requests.filter(...))` with a simple render of `summary.total` + `summary.items` coming pre-computed from the server.
  - New props: `summary: RepairRequestOverdueSummary | undefined`, `isLoading: boolean`.
  - Render gate: `if (isLoading || !summary || summary.total === 0) return null;`.
- `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` / `RepairRequestsPageLayout.tsx` — wire `overdueSummary` + `overdueLoading` through; `requests` prop dropped from `RepairRequestsPageLayout`.
- `src/hooks/use-cached-repair.ts` — removed `['repair_request_overdue_summary']` invalidations (key never existed in this implementation; the summary comes back through `['repair_request_status_counts']` which is invalidated separately by `RepairRequestsContext.tsx`).
- Tests
  - New: `src/app/(app)/repair-requests/__tests__/RepairRequestsKpi.test.tsx` (asserts KPI totals come from status counts, not from the gated table query; asserts the status-counts query is page-independent and carries the overdue summary).
  - New: `src/app/(app)/repair-requests/__tests__/RepairRequestsContext.completeMutation.test.tsx` (invalidation assertion on `['repair_request_status_counts']`).
  - Updated: `useRepairRequestsData.test.ts` — shape expectations updated.

---

## Findings

### 🔴 BLOCKER-1 — Live migration not applied; frontend deploy would make the banner disappear

The live Supabase DB does not yet contain this migration. Verified via MCP:

```sql
-- pg_proc for public.repair_request_status_counts (live)
-- has_overdue_summary = false
-- has_left_join     = false  -- i.e. old body (no LEFT JOIN thiet_bi inside filtered CTE)
-- body_len          = 2149   -- new body is ~8 KB, this is the old one
```

`list_migrations` confirms `20260504110000` is absent (last applied = `20260503041649`).

**Consequence** if the branch is merged and only the app is deployed:

- The RPC returns the legacy flat shape `{ "Chờ xử lý": n, ... }`.
- `isRepairRequestPageMetrics(pageMetrics)` → `false`.
- `overdueSummary` = `undefined`.
- `<RepairRequestAlert summary={undefined} isLoading={...}>` hits the `if (!summary) return null` branch.
- **User sees no banner at all** — previously they saw a partially-wrong banner (page-scoped). This is a silent user-facing regression.

**Recommendation**: Apply the migration via MCP `apply_migration` before or in the same deploy window as the frontend ship. If a phased rollout is required, add an explicit fallback in `RepairRequestAlert` that, when `overdueSummary` is undefined but `statusCounts` indicate open requests, shows a neutral "KPI only" banner instead of disappearing — or simply keep old behaviour behind a feature flag until migration lands.

### 🔴 BLOCKER-2 — Smoke test was downgraded to non-runnable

Commit `742aeda` renamed `supabase/tests/repair_request_status_counts_overdue_summary_smoke.sql` → `...smoke.spec.sql` and replaced every executable line with comments ("Keep this file non-runnable until the migration is explicitly approved for apply").

**Why this matters**:

- Issue #342 was a regression caused by a body rewrite of `repair_request_get` / `repair_request_list` that broke tenant scoping for non-global roles. This change is structurally identical (full body rewrite of `repair_request_status_counts`), and merges logic from `repair_request_list` into `repair_request_status_counts`.
- The plan explicitly listed RBAC parity with `repair_request_list` as an acceptance criterion for every role: `global`, `regional_leader`, `to_qltb`, `user` (department-scoped), and cross-tenant isolation.
- A checklist comment cannot enforce parity in CI; only executable assertions can.

**Recommendation**: Before merge, convert the checklist back to real SQL against seed data. At minimum cover:
- `role='user'` with and without `khoa_phong`, confirming rows outside `_normalize_department_scope(khoa_phong_quan_ly)` are excluded from both `counts` and `overdue_summary`.
- `role='regional_leader'` with `allowed_don_vi_for_session()` returning a subset.
- Cross-tenant: a `to_qltb` from tenant A must not see tenant B rows.
- Boundary dates: `ngay_mong_muon_hoan_thanh` = today, today−1, today+7, today+8, NULL.
- Status exclusion: `'Hoàn thành'` and `'Không HT'` must not appear in `overdue_summary.items` or counts `overdue/due_today/due_soon`.
- `p_q` ILIKE sanitization: `p_q = '%'` must NOT match everything (confirm `_sanitize_ilike_pattern` is wired).
- Orphaned rows: a `yeu_cau_sua_chua` whose `thiet_bi_id` has been hard-deleted — current behaviour with `LEFT JOIN` (see Finding #6) should be documented and asserted either way.

### 🟠 MEDIUM-3 — SQL counts path uses 4 correlated scalar subqueries instead of a single `FILTER` pass

```sql
'counts', jsonb_build_object(
  'Chờ xử lý', COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Chờ xử lý'), 0),
  'Đã duyệt',  COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Đã duyệt'),  0),
  'Hoàn thành',COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Hoàn thành'),0),
  'Không HT',  COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Không HT'),  0)
),
'overdue_summary', jsonb_build_object(
  'total',     COALESCE((SELECT count(*) FROM due_items), 0),
  'overdue',   COALESCE((SELECT count(*) FROM due_items WHERE days_difference < 0), 0),
  'due_today', COALESCE((SELECT count(*) FROM due_items WHERE days_difference = 0), 0),
  'due_soon',  COALESCE((SELECT count(*) FROM due_items WHERE days_difference BETWEEN 1 AND 7), 0),
  ...
)
```

Postgres ≥ 12 inlines CTEs by default. Each scalar subquery over `filtered` / `due_items` is a separate `SELECT` the planner may execute independently, and unless the planner notices a common scan it will re-scan the base tables per subquery. That's potentially **8 scans** (4 counts + 4 summary) plus the aggregation over `ranked_items`.

The pre-existing status_counts RPC used the same pattern (which is arguably what prompted the "why aren't we just using counts(*) FILTER" reflex). The idiomatic and provably-single-pass form is:

```sql
WITH filtered AS (...),
aggregated AS (
  SELECT
    count(*) FILTER (WHERE trang_thai = 'Chờ xử lý') AS cnt_cho_xu_ly,
    count(*) FILTER (WHERE trang_thai = 'Đã duyệt') AS cnt_da_duyet,
    count(*) FILTER (WHERE trang_thai = 'Hoàn thành') AS cnt_hoan_thanh,
    count(*) FILTER (WHERE trang_thai = 'Không HT') AS cnt_khong_ht,
    count(*) FILTER (
      WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')
        AND ngay_mong_muon_hoan_thanh IS NOT NULL
        AND ngay_mong_muon_hoan_thanh <= v_today + 7
    ) AS overdue_total,
    count(*) FILTER (
      WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')
        AND ngay_mong_muon_hoan_thanh < v_today
    ) AS overdue_cnt,
    count(*) FILTER (
      WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')
        AND ngay_mong_muon_hoan_thanh = v_today
    ) AS due_today_cnt,
    count(*) FILTER (
      WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')
        AND ngay_mong_muon_hoan_thanh BETWEEN v_today + 1 AND v_today + 7
    ) AS due_soon_cnt
  FROM filtered
),
items_cte AS (
  SELECT ... FROM filtered
  WHERE trang_thai IN ('Chờ xử lý','Đã duyệt')
    AND ngay_mong_muon_hoan_thanh IS NOT NULL
    AND ngay_mong_muon_hoan_thanh <= v_today + 7
  ORDER BY ngay_mong_muon_hoan_thanh ASC, id ASC
  LIMIT 50
)
SELECT jsonb_build_object('counts', ..., 'overdue_summary', ...) FROM aggregated, (SELECT jsonb_agg(...) FROM items_cte) items;
```

This guarantees a single scan of `filtered` for all counters and one additional scan (with LIMIT) for items.

**Recommendation**: Rewrite with `count(*) FILTER` aggregation; re-run `EXPLAIN (ANALYZE, BUFFERS)` on a realistic tenant before/after to confirm cost drop.

### 🟠 MEDIUM-4 — Partial index recommended by the plan was not added

The plan flagged:

> **Performance** — verify there is an index supporting `(ngay_mong_muon_hoan_thanh, trang_thai)`; if not, add a partial index on `trang_thai IN ('Chờ xử lý','Đã duyệt')` in the same migration.

The migration does not create any index. For tenants with lots of historical repair requests where most are `Hoàn thành`, the `due_items` CTE still has to filter a large base set. Adding:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yeu_cau_sua_chua_open_due_date
  ON public.yeu_cau_sua_chua (ngay_mong_muon_hoan_thanh)
  WHERE trang_thai IN ('Chờ xử lý','Đã duyệt');
```

(Note: `CREATE INDEX CONCURRENTLY` cannot run inside the existing `BEGIN ... COMMIT;` block — it has to be a separate migration or split out.)

**Recommendation**: Either add the partial index in a follow-up migration, or explicitly document why it's deferred (small dataset / measured and not needed).

### 🟡 MEDIUM-5 — API shape is a breaking change to `repair_request_status_counts` without a versioned endpoint

The contract moved from `Record<Status, number>` to `{ counts: Record<Status, number>, overdue_summary: {...} }`. The repo convention is "forward-only" and this is acceptable *if* the RPC is only called from this app. Search confirms:

- `src/app/api/rpc/[fn]/allowed-functions.ts` lists it (proxy allowlist only; not an external caller).
- `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts` is the only runtime consumer.

The defensive union type `RepairRequestPageMetrics | RepairRequestStatusCounts` + `isRepairRequestPageMetrics` narrowing in the hook is good defence during the deploy window. It becomes dead code once the migration is applied and should be removed in a follow-up to avoid drift.

**Recommendation**: After migration is applied and confirmed stable in prod, open a cleanup PR to drop the `| RepairRequestStatusCounts` fallback and the `isRepairRequestPageMetrics` type guard.

### 🟡 MEDIUM-6 — `LEFT JOIN thiet_bi` keeps orphan-row inconsistency

The new `filtered` CTE uses:

```sql
FROM public.yeu_cau_sua_chua r
LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
LEFT JOIN public.don_vi dv  ON dv.id = tb.don_vi
```

For global with `v_effective_donvi IS NULL`, the WHERE is satisfied regardless of `tb.don_vi`, so a repair request whose equipment row has been hard-deleted will appear in both `counts` and `overdue_summary`. Sibling fix `supabase/migrations/20260424112908_fix_header_notifications_inner_join.sql` specifically switched to `INNER JOIN` on `thiet_bi` to avoid exactly this shape of phantom row.

This matches the pre-existing behaviour of `repair_request_list`, so the review is **not a regression** — but the counts banner now includes phantom rows that the paginated list can also show only for global role. It's a consistency pitfall worth explicit acknowledgement.

**Recommendation**: Either switch to `INNER JOIN` on `thiet_bi` (matching the notifications fix), or explicitly document the decision in a migration comment. Tests should cover a hard-deleted equipment row.

### 🟡 MEDIUM-7 — `use-cached-repair.ts` mutations no longer invalidate the status-counts key

In `ccfbe09`, every `invalidateQueries({ queryKey: ['repair_request_overdue_summary'] })` call was removed. The remaining invalidations in that file are:

```ts
queryClient.invalidateQueries({ queryKey: repairKeys.all })
queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
```

where `repairKeys.all = ['repair']`. React Query's `invalidateQueries` is prefix-matched on array keys. `['repair']` does NOT match `['repair_request_status_counts', {...}]` (the first-element strings differ), so these hooks would not refresh the alert summary on mutation.

This is currently a **latent issue** only — verified via grep that `useCreateRepairRequest` / `useUpdateRepairRequest` / `useAssignRepairRequest` / `useCompleteRepairRequest` / `useDeleteRepairRequest` are not referenced anywhere in production code (only in test harnesses and a typecheck helper). The real UI dispatches mutations through `RepairRequestsContext.tsx`, which still invalidates `['repair_request_status_counts']` explicitly.

**Recommendation**: either
- Delete `src/hooks/use-cached-repair.ts` entirely (and its tests) if it is truly dead code, or
- Add `queryClient.invalidateQueries({ queryKey: ['repair_request_status_counts'] })` to each mutation in the file so a future wiring change doesn't silently break the banner.

### 🟢 LOW-8 — Dead imports in `repair-request-alert.tsx`

`src/components/repair-request-alert.tsx` still imports `Link from "next/link"` and `* as React from "react"` but uses neither at runtime (the JSX compiles fine without the React import in the Next.js automatic JSX runtime; `Link` is entirely unreferenced).

**Recommendation**: Remove both imports. Confirm `no-unused-vars` / `@typescript-eslint/no-unused-vars` pass after.

### 🟢 LOW-9 — Timezone drift between server-computed `days_difference` and client-rendered dates

Server computes `days_difference = ngay_mong_muon_hoan_thanh - v_today` where `v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`. Client renders the raw `ngay_mong_muon_hoan_thanh` via `parseISO(dueDateString)` + `format(dueDate, 'dd/MM/yyyy')` in the browser's local TZ.

For browsers outside Indochina Time near midnight, the displayed date could be one day off from what the "Quá hạn X ngày" badge suggests. Low impact; matches the pre-existing behaviour of the page table.

**Recommendation**: For alert items, render `ngay_mong_muon_hoan_thanh` as a raw `YYYY-MM-DD` string formatted with `parse(dueDateString, 'yyyy-MM-dd', new Date())` so no TZ shift occurs, or just display `days_difference` directly (already shown in the badge).

### ✅ What's Good

- **Single RPC round-trip** for the repair-requests page load is a legitimate performance improvement over the originally-proposed two-RPC design.
- **Defensive type narrowing** (`isRepairRequestPageMetrics`) makes staged deploys safer.
- **ILIKE sanitization added** to `p_q` via `_sanitize_ilike_pattern` — tightens a small security gap that existed in the pre-#384 body of `repair_request_status_counts`.
- **Stable item ordering** (`ORDER BY ngay_mong_muon_hoan_thanh ASC, id ASC LIMIT 50`) — good for UX and for testability.
- **Frontend test additions** (`RepairRequestsKpi.test.tsx`, `RepairRequestsContext.completeMutation.test.tsx`) cover the new shape and invalidation behaviour.

---

## Recommended Pre-Merge Checklist

- [ ] Convert `supabase/tests/repair_request_status_counts_overdue_summary_smoke.spec.sql` into an executable smoke test with role-specific `SET request.jwt.claims` fixtures and explicit assertions.
- [ ] Rewrite the SQL aggregation with `count(*) FILTER` (single-pass).
- [ ] Decide on and document the orphan-row behaviour (`LEFT JOIN` vs `INNER JOIN`).
- [ ] Apply the migration via Supabase MCP (`apply_migration`) **before or synchronously with** the frontend deploy, or add a feature flag to keep the legacy banner behaviour alive during a staged rollout.
- [ ] Run `get_advisors(security)` + `get_advisors(performance)` post-migration.
- [ ] Re-run `verify:no-explicit-any`, `typecheck`, focused vitest, and `react-doctor --diff main`.
- [ ] Remove dead imports from `src/components/repair-request-alert.tsx`.
- [ ] Either delete `src/hooks/use-cached-repair.ts` or restore the `['repair_request_status_counts']` invalidation inside each mutation (pick one; current state is fragile).
- [ ] Decide on the partial index — add or document deferral.

## References

- Plan: `docs/plans/2026-05-04-repair-request-alert-pagination-rootcause.md`
- Issue: #384
- Migration: `supabase/migrations/20260504110000_enrich_repair_request_status_counts_with_overdue_summary.sql`
- Prior RBAC regression context: `supabase/migrations/20260428132000_fix_repair_request_read_scope.sql` (issue #342)
- Sibling INNER-JOIN fix pattern: `supabase/migrations/20260424112908_fix_header_notifications_inner_join.sql`
