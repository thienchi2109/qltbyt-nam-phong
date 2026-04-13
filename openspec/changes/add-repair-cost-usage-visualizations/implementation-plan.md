# Repair Cost Usage Visualizations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/reports` maintenance repair visualizations for top repair-cost equipment and usage-duration vs repair-cost correlation.

**Architecture:** Extend the existing tenant-scoped `get_maintenance_report_data(date,date,bigint)` RPC without changing its signature, then add typed report payload handling and focused report chart components. Keep `topEquipmentRepairs` as the existing request-count ranking and add separate cost/correlation payloads.

**Tech Stack:** Supabase Postgres PL/pgSQL, SQL smoke tests, Next.js App Router, React, TanStack Query, Vitest, Recharts through `src/components/dynamic-chart.tsx`, OpenSpec.

**SQL references to follow exactly:**
- Latest `get_maintenance_report_data`: `supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql`
- Original maintenance report aggregation shape: `supabase/migrations/2025-10-13_reports/20251013190000_add_repair_frequency_insights.sql`
- Smoke-test helper style: `supabase/tests/repair_request_cost_smoke.sql`
- Usage-log index precedent: `supabase/migrations/20260310145700_add_ai_usage_summary_rpc.sql`
- SQL safety checklist: `AGENTS.md` / `CLAUDE.md` SQL Code Generation Checklist and SQL Migration Safety Rules

**Live Supabase baseline checked on 2026-04-13 via MCP:**
- `public.get_maintenance_report_data(date,date,bigint)` is currently deployed as `SECURITY DEFINER`, `search_path=public, pg_temp`, returns `jsonb`, and its body matches the repair-cost statistics RPC shape from `20260412100000_add_repair_request_cost_statistics.sql`.
- `public.nhat_ky_su_dung.thiet_bi_id` is `integer NOT NULL`; `public.thiet_bi.id` and `public.yeu_cau_sua_chua.thiet_bi_id` are `bigint NOT NULL`.
- `public.thiet_bi.don_vi` is the actual tenant column and is `bigint`; there is no `don_vi_id` on `thiet_bi`.
- `public.yeu_cau_sua_chua.chi_phi_sua_chua` is `numeric(14,2) NULL` with no default and the live non-negative check constraint `yeu_cau_sua_chua_chi_phi_sua_chua_non_negative`.
- `idx_nhat_ky_su_dung_thiet_bi_bat_dau ON public.nhat_ky_su_dung(thiet_bi_id, thoi_gian_bat_dau)` already exists in live DB, along with `idx_nhat_ky_su_dung_thiet_bi_id`.
- Relevant repair/equipment indexes already exist in live DB: `idx_yeu_cau_sua_chua_thiet_bi_id`, `idx_yeu_cau_sua_chua_ngay_yeu_cau`, `idx_yeu_cau_sua_chua_ngay_hoan_thanh`, `idx_yeu_cau_sua_chua_status_date`, `idx_thiet_bi_don_vi`, and `idx_thiet_bi_don_vi_join`.
- Current live ACL check reports `anon`, `authenticated`, and `service_role` can execute the RPC, while `PUBLIC` cannot. This visualization migration must not silently broaden privileges. If tightening `anon` is desired, treat it as a separate security decision or document it explicitly in this SQL batch and verify PostgREST callers.

---

## Chunk 1: SQL Data Contract

**Files:**
- Create: `supabase/tests/repair_cost_usage_visualizations_smoke.sql`
- Create: `supabase/migrations/[timestamp]_add_repair_cost_usage_visualizations.sql`
- Reference: `supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql`
- Reference: `openspec/changes/add-repair-cost-usage-visualizations/specs/repair-request-cost-statistics/spec.md`

- [ ] **Step 1: Write the failing SQL smoke test**

Create `supabase/tests/repair_cost_usage_visualizations_smoke.sql`. Wrap it in `BEGIN; ... ROLLBACK;`, set JWT claims with a temp helper, seed at least:
- Three tenant-scoped equipment rows with valid completed usage intervals and completed repair costs.
- One open usage log with `thoi_gian_ket_thuc IS NULL`.
- One invalid usage log where end time is before start time.
- One same-tenant completed repair with `chi_phi_sua_chua IS NULL`.
- One other-tenant equipment with usage and cost that must not appear under the first tenant.

When seeding `thiet_bi` rows for this test, keep equipment IDs inside the signed integer range because `nhat_ky_su_dung.thiet_bi_id` is `integer` while `thiet_bi.id` and `yeu_cau_sua_chua.thiet_bi_id` are `bigint`. Prefer normal sequence-generated IDs or explicit IDs no greater than `2147483647`.

Use the local smoke-test conventions from `repair_request_cost_smoke.sql`:
- File header with purpose, local `docker exec ... psql ...` command, and non-destructive transaction note.
- `pg_temp._..._set_claims()` helper that sets `request.jwt.claims` with `app_role`, `role`, `user_id`, `sub`, and `don_vi`.
- Temp seed helper that creates `don_vi`, `nhan_vien`, `thiet_bi`, approved repair requests, and usage logs without depending on production data.
- `DO $$ ... END $$;` assertion blocks with explicit `RAISE EXCEPTION` messages that include the returned JSON payload.
- Roll back all seeded rows at the end.

Assert:
- `get_maintenance_report_data(...) -> 'topEquipmentRepairCosts'` exists and is sorted by `totalRepairCost DESC`.
- Every top-cost item includes `equipmentId`, `equipmentName`, `equipmentCode`, `totalRepairCost`, `averageCompletedRepairCost`, `completedRepairRequests`, and `costRecordedCount`.
- `charts.repairUsageCostCorrelation.period.points` includes only valid completed usage intervals within the selected date range.
- `charts.repairUsageCostCorrelation.cumulative.points` includes valid completed usage/cost through `p_date_to`.
- Period mode excludes a usage interval that starts before `p_date_from`, while cumulative mode includes it if it ends before or on `p_date_to`.
- A usage interval that starts before or on `p_date_to` but ends after `p_date_to` is excluded from cumulative mode.
- Open usage logs and invalid intervals are excluded from `totalUsageHours`.
- Completed repair requests with `chi_phi_sua_chua IS NULL` contribute to `completedRepairRequests` but not `costRecordedCount` or the average cost numerator/denominator.
- Correlation points and `dataQuality` objects expose camelCase JSON keys, not snake_case keys from SQL CTE columns.
- `dataQuality.equipmentWithUsage`, `dataQuality.equipmentWithRepairCost`, and `dataQuality.equipmentWithBoth` are present.
- Other-tenant seeded rows are excluded for non-global claims, and a `global`/`admin` claim with `p_don_vi` still scopes to the selected facility.
- Existing payload keys remain present: `summary`, `charts.repairStatusDistribution`, `charts.maintenancePlanVsActual`, `charts.repairFrequencyByMonth`, `charts.repairCostByMonth`, `charts.repairCostByFacility`, `topEquipmentRepairs`, and `recentRepairHistory`.
- Live-schema expectations still hold in the test database: `chi_phi_sua_chua numeric(14,2) NULL`, no default, non-negative constraint present, `nhat_ky_su_dung.thiet_bi_id` is `integer`, and `thiet_bi.id` is `bigint`.

Use this SQL shape for the main assertions:

```sql
DO $$
DECLARE
  v_report jsonb;
  v_points jsonb;
BEGIN
  PERFORM pg_temp._set_claims('to_qltb', v_user_id, v_tenant_id);

  v_report := public.get_maintenance_report_data(current_date - 30, current_date, v_tenant_id);
  IF jsonb_array_length(v_report->'topEquipmentRepairCosts') <> 3 THEN
    RAISE EXCEPTION 'Expected 3 top repair cost equipment rows, got %', v_report->'topEquipmentRepairCosts';
  END IF;

  IF (v_report->'topEquipmentRepairCosts'->0->>'totalRepairCost')::numeric
     < (v_report->'topEquipmentRepairCosts'->1->>'totalRepairCost')::numeric THEN
    RAISE EXCEPTION 'Expected topEquipmentRepairCosts sorted descending: %', v_report->'topEquipmentRepairCosts';
  END IF;

  v_points := v_report #> '{charts,repairUsageCostCorrelation,period,points}';
  IF jsonb_array_length(v_points) < 3 THEN
    RAISE EXCEPTION 'Expected enough period correlation points, got %', v_points;
  END IF;
END $$;
```

- [ ] **Step 2: Run the SQL smoke test and verify RED**

Run if local DB URL is available:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_cost_usage_visualizations_smoke.sql
```

Expected: FAIL because `topEquipmentRepairCosts` and `charts.repairUsageCostCorrelation` do not exist yet.

If `SUPABASE_DB_URL` is not available, use Supabase MCP to execute the test SQL body in one transaction and confirm the same missing-payload failure before continuing.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/[timestamp]_add_repair_cost_usage_visualizations.sql` with the actual migration timestamp at creation time and `CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(p_date_from date, p_date_to date, p_don_vi bigint DEFAULT NULL)`.

Start from the full current RPC body from live Supabase MCP (`pg_get_functiondef('public.get_maintenance_report_data(date,date,bigint)'::regprocedure)`) and cross-check it against `supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql`; do not rebuild a simplified version from scratch. Preserve from the existing RPC:
- `LANGUAGE plpgsql`
- `SECURITY DEFINER`
- `SET search_path = public, pg_temp`
- JWT role and user guards:

```sql
v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
v_user_id := nullif(public._get_jwt_claim('user_id'), '');
v_is_global := v_role IN ('global', 'admin');

IF v_role IS NULL OR v_role = '' THEN
  RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
END IF;

IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
END IF;
```

- `admin` -> `global` handling via `v_role IN ('global', 'admin')`
- `allowed_don_vi_for_session_safe()` tenant scoping
- Existing summary, charts, `topEquipmentRepairs`, and `recentRepairHistory` payloads
- Existing empty/unauthorized return payload, extended with the new keys as empty/default data. `topEquipmentRepairCosts` is a root-level report key; `repairUsageCostCorrelation` belongs under `charts`:

```sql
jsonb_build_object(
  'summary', jsonb_build_object(...),
  'charts', jsonb_build_object(
    'repairStatusDistribution', '[]'::jsonb,
    'maintenancePlanVsActual', '[]'::jsonb,
    'repairFrequencyByMonth', '[]'::jsonb,
    'repairCostByMonth', '[]'::jsonb,
    'repairCostByFacility', '[]'::jsonb,
    'repairUsageCostCorrelation', jsonb_build_object(
      'period', jsonb_build_object(
        'points', '[]'::jsonb,
        'dataQuality', jsonb_build_object('equipmentWithUsage', 0, 'equipmentWithRepairCost', 0, 'equipmentWithBoth', 0)
      ),
      'cumulative', jsonb_build_object(
        'points', '[]'::jsonb,
        'dataQuality', jsonb_build_object('equipmentWithUsage', 0, 'equipmentWithRepairCost', 0, 'equipmentWithBoth', 0)
      )
    )
  ),
  'topEquipmentRepairs', '[]'::jsonb,
  'topEquipmentRepairCosts', '[]'::jsonb,
  'recentRepairHistory', '[]'::jsonb
)
```

Preserve equipment tenant scoping by using the actual tenant column:

```sql
tb.don_vi = ANY(v_effective)
```

Do not use `tb.don_vi_id`; that column does not exist on `thiet_bi`.

Use an explicit scoped-equipment CTE instead of repeated table scans:

```sql
scoped_equipment AS (
  SELECT
    tb.id AS equipment_id,
    coalesce(nullif(trim(tb.ten_thiet_bi), ''), tb.ma_thiet_bi, 'Không xác định') AS equipment_name,
    tb.ma_thiet_bi AS equipment_code,
    tb.don_vi AS facility_id
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
)
```

Then keep the existing `repair_data_raw` pattern, adding only the missing equipment code:

```sql
repair_data_raw AS (
  SELECT
    yc.id,
    yc.trang_thai,
    yc.mo_ta_su_co,
    yc.ngay_yeu_cau,
    yc.ngay_duyet,
    yc.ngay_hoan_thanh,
    yc.chi_phi_sua_chua,
    se.equipment_id,
    se.equipment_name,
    se.equipment_code,
    se.facility_id,
    coalesce(dv.name, 'Không xác định') AS facility_name,
    coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AS reference_timestamp,
    (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%' OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%') AS is_completed
  FROM public.yeu_cau_sua_chua yc
  INNER JOIN scoped_equipment se ON yc.thiet_bi_id = se.equipment_id
  LEFT JOIN public.don_vi dv ON dv.id = se.facility_id
)
```

Keep the existing period date semantics:

```sql
WHERE reference_timestamp IS NOT NULL
  AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
```

Add cumulative repair data as a separate CTE, not by changing `repair_data`:

```sql
cumulative_repair_data AS (
  SELECT
    id,
    trang_thai,
    mo_ta_su_co,
    ngay_yeu_cau,
    ngay_duyet,
    ngay_hoan_thanh,
    chi_phi_sua_chua,
    equipment_id,
    equipment_name,
    equipment_code,
    facility_id,
    facility_name,
    reference_timestamp,
    is_completed
  FROM repair_data_raw
  WHERE reference_timestamp IS NOT NULL
    AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
)
```

Add usage CTEs using one scan of scoped equipment plus usage logs:

```sql
usage_data_raw AS (
  SELECT
    se.equipment_id,
    se.equipment_name,
    se.equipment_code,
    nk.thoi_gian_bat_dau,
    nk.thoi_gian_ket_thuc,
    extract(epoch from (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600.0 AS usage_hours
  FROM scoped_equipment se
  INNER JOIN public.nhat_ky_su_dung nk
    -- nhat_ky_su_dung.thiet_bi_id is integer; thiet_bi.id is bigint.
    -- Keep the join expression simple so Postgres can use the existing usage-log index.
    ON nk.thiet_bi_id = se.equipment_id
  WHERE nk.thoi_gian_ket_thuc IS NOT NULL
    AND nk.thoi_gian_ket_thuc > nk.thoi_gian_bat_dau
)
```

Do not use `SELECT *` in new CTEs or final payloads. Keep explicit column lists even when selecting from an immediately preceding CTE so future reviewers can see exactly which fields feed the report payload.

Aggregate period/cumulative usage separately:

```sql
period_usage_by_equipment AS (
  SELECT equipment_id, equipment_name, equipment_code, sum(usage_hours) AS total_usage_hours
  FROM usage_data_raw
  WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
    AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
  GROUP BY equipment_id, equipment_name, equipment_code
),
cumulative_usage_by_equipment AS (
  SELECT equipment_id, equipment_name, equipment_code, sum(usage_hours) AS total_usage_hours
  FROM usage_data_raw
  WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
    AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
  GROUP BY equipment_id, equipment_name, equipment_code
)
```

Aggregate repair costs separately for period and cumulative mode:

```sql
period_repair_costs_by_equipment AS (
  SELECT
    equipment_id,
    equipment_name,
    equipment_code,
    coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
    avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
    count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
    count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
  FROM repair_data
  GROUP BY equipment_id, equipment_name, equipment_code
),
cumulative_repair_costs_by_equipment AS (
  SELECT
    equipment_id,
    equipment_name,
    equipment_code,
    coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
    avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
    count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
    count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
  FROM cumulative_repair_data
  GROUP BY equipment_id, equipment_name, equipment_code
)
```

Use period repair costs for the top-10 chart and do not modify `topEquipmentRepairs`:

```sql
top_equipment_repair_costs AS (
  SELECT
    equipment_id,
    equipment_name,
    equipment_code,
    total_repair_cost,
    average_completed_repair_cost,
    completed_repair_requests,
    cost_recorded_count
  FROM period_repair_costs_by_equipment
  WHERE cost_recorded_count > 0
  ORDER BY total_repair_cost DESC, equipment_name
  LIMIT 10
)
```

Build correlation points only from equipment with positive usage and at least one recorded repair cost:

```sql
period_correlation_points AS (
  SELECT
    u.equipment_id,
    u.equipment_name,
    u.equipment_code,
    u.total_usage_hours,
    c.total_repair_cost,
    c.completed_repair_requests,
    c.cost_recorded_count,
    CASE WHEN u.total_usage_hours > 0 THEN c.total_repair_cost / u.total_usage_hours ELSE NULL END AS cost_per_usage_hour
  FROM period_usage_by_equipment u
  INNER JOIN period_repair_costs_by_equipment c ON c.equipment_id = u.equipment_id
  WHERE u.total_usage_hours > 0
    AND c.cost_recorded_count > 0
)
```

Mirror the same shape for `cumulative_correlation_points`.

Data-quality CTEs should count scoped equipment via joins to the aggregate CTEs, not infer counts from the final plotted points:

```sql
period_correlation_quality AS (
  SELECT
    count(*) FILTER (WHERE coalesce(u.total_usage_hours, 0) > 0)::integer AS equipment_with_usage,
    count(*) FILTER (WHERE coalesce(c.cost_recorded_count, 0) > 0)::integer AS equipment_with_repair_cost,
    count(*) FILTER (
      WHERE coalesce(u.total_usage_hours, 0) > 0
        AND coalesce(c.cost_recorded_count, 0) > 0
    )::integer AS equipment_with_both
  FROM scoped_equipment se
  LEFT JOIN period_usage_by_equipment u ON u.equipment_id = se.equipment_id
  LEFT JOIN period_repair_costs_by_equipment c ON c.equipment_id = se.equipment_id
)
```

Mirror the same shape for `cumulative_correlation_quality`.

Add `topEquipmentRepairCosts` as a root-level key, and add `repairUsageCostCorrelation` inside the existing `charts` object:

```sql
'topEquipmentRepairCosts', (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'equipmentId', te.equipment_id,
    'equipmentName', te.equipment_name,
    'equipmentCode', te.equipment_code,
    'totalRepairCost', te.total_repair_cost,
    'averageCompletedRepairCost', coalesce(te.average_completed_repair_cost, 0),
    'completedRepairRequests', te.completed_repair_requests,
    'costRecordedCount', te.cost_recorded_count
  ) ORDER BY te.total_repair_cost DESC, te.equipment_name), '[]'::jsonb)
  FROM top_equipment_repair_costs te
),
'repairUsageCostCorrelation', jsonb_build_object(
  'period', jsonb_build_object(
    'points', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'equipmentId', p.equipment_id,
        'equipmentName', p.equipment_name,
        'equipmentCode', p.equipment_code,
        'totalUsageHours', p.total_usage_hours,
        'totalRepairCost', p.total_repair_cost,
        'completedRepairRequests', p.completed_repair_requests,
        'costRecordedCount', p.cost_recorded_count,
        'costPerUsageHour', p.cost_per_usage_hour
      ) ORDER BY p.total_repair_cost DESC, p.equipment_name)
      FROM period_correlation_points p
    ), '[]'::jsonb),
    'dataQuality', coalesce((
      SELECT jsonb_build_object(
        'equipmentWithUsage', q.equipment_with_usage,
        'equipmentWithRepairCost', q.equipment_with_repair_cost,
        'equipmentWithBoth', q.equipment_with_both
      )
      FROM period_correlation_quality q
    ), jsonb_build_object('equipmentWithUsage', 0, 'equipmentWithRepairCost', 0, 'equipmentWithBoth', 0))
  ),
  'cumulative', jsonb_build_object(
    'points', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'equipmentId', c.equipment_id,
        'equipmentName', c.equipment_name,
        'equipmentCode', c.equipment_code,
        'totalUsageHours', c.total_usage_hours,
        'totalRepairCost', c.total_repair_cost,
        'completedRepairRequests', c.completed_repair_requests,
        'costRecordedCount', c.cost_recorded_count,
        'costPerUsageHour', c.cost_per_usage_hour
      ) ORDER BY c.total_repair_cost DESC, c.equipment_name)
      FROM cumulative_correlation_points c
    ), '[]'::jsonb),
    'dataQuality', coalesce((
      SELECT jsonb_build_object(
        'equipmentWithUsage', q.equipment_with_usage,
        'equipmentWithRepairCost', q.equipment_with_repair_cost,
        'equipmentWithBoth', q.equipment_with_both
      )
      FROM cumulative_correlation_quality q
    ), jsonb_build_object('equipmentWithUsage', 0, 'equipmentWithRepairCost', 0, 'equipmentWithBoth', 0))
  )
)
```

Use numeric aggregation that excludes invalid/open intervals before summing:

```sql
sum(extract(epoch from (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600)
  FILTER (
    WHERE nk.thoi_gian_ket_thuc IS NOT NULL
      AND nk.thoi_gian_ket_thuc > nk.thoi_gian_bat_dau
  )
```

Join usage through equipment without casting the indexed usage column:

```sql
nk.thiet_bi_id = se.equipment_id
```

Add a nearby SQL comment explaining that `nhat_ky_su_dung.thiet_bi_id` is `integer` while `thiet_bi.id` is `bigint`, and that test equipment IDs must remain in the integer range because usage logs cannot store larger values.

Project equipment code explicitly in the new cost and correlation CTEs. If using the `scoped_equipment` CTE above, read it through `se.equipment_code`; if extending `repair_data_raw` directly from `thiet_bi`, use:

```sql
tb.ma_thiet_bi AS equipment_code
```

For period mode, restrict usage start date and repair reference date to `p_date_from..p_date_to`, and exclude any usage interval ending after `p_date_to`. For cumulative mode, restrict repair reference date, usage start date, and usage end date to `<= p_date_to`.

Index/performance requirements:
- Live DB confirms `idx_nhat_ky_su_dung_thiet_bi_bat_dau ON public.nhat_ky_su_dung (thiet_bi_id, thoi_gian_bat_dau)` already exists; do not add a duplicate or renamed equivalent.
- In a branch/local DB, verify the index exists before test execution. If it is missing because the branch is not migrated to the live baseline, add it only with `CREATE INDEX IF NOT EXISTS idx_nhat_ky_su_dung_thiet_bi_bat_dau ON public.nhat_ky_su_dung (thiet_bi_id, thoi_gian_bat_dau);`.
- Live DB confirms existing repair indexes cover `yeu_cau_sua_chua(thiet_bi_id)`, `yeu_cau_sua_chua(ngay_yeu_cau)`, `yeu_cau_sua_chua(ngay_hoan_thanh)`, and `yeu_cau_sua_chua(trang_thai, ngay_yeu_cau)`; do not add speculative cost indexes unless `EXPLAIN` or advisor output shows a need.
- Keep all related data in one RPC query with joins/CTEs; do not introduce app-side N+1 calls.
- No pagination is needed inside this report RPC because it returns fixed top-10 and aggregate chart payloads.

Migration footer requirements:

```sql
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) FROM PUBLIC;

COMMENT ON FUNCTION public.get_maintenance_report_data(date, date, bigint)
IS 'Returns maintenance report data with tenant-aware aggregation, top equipment repairs, recent history, repair cost statistics, and repair cost usage visualizations.';
```

Privilege note: live DB currently reports `anon`, `authenticated`, and `service_role` execute on this function, with `PUBLIC` execute revoked. This feature must not add new `anon` permissions. If the implementation removes explicit `anon` execute, record that as an intentional security hardening decision in the migration comment and verify existing report access paths still use authenticated JWT claims.

- [ ] **Step 4: Run SQL smoke test and verify GREEN**

Run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_cost_usage_visualizations_smoke.sql
```

Expected: PASS with transaction rolled back.

- [ ] **Step 5: Run Supabase advisor**

Run Supabase MCP `get_advisors(security)`.

Also re-check function ACL so privilege changes are intentional:

```sql
SELECT role_name,
       has_function_privilege(role_name, 'public.get_maintenance_report_data(date,date,bigint)', 'EXECUTE') AS can_execute
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('public')) AS roles(role_name)
ORDER BY role_name;
```

Expected: no new advisor item attributable to `get_maintenance_report_data`. Existing project-wide advisor findings may remain; record them separately if unchanged. If `anon` execute changes relative to the live baseline, document whether that was an intentional hardening decision or a regression.

- [ ] **Step 6: Commit SQL batch**

```bash
git add supabase/migrations/*_add_repair_cost_usage_visualizations.sql supabase/tests/repair_cost_usage_visualizations_smoke.sql
git commit -m "feat: add repair cost usage report data"
```

## Chunk 2: TypeScript Report Contract

**Files:**
- Modify: `src/app/(app)/reports/hooks/use-maintenance-data.ts`
- Create: `src/app/(app)/reports/hooks/use-maintenance-data.types.ts`
- Create: `src/app/(app)/reports/hooks/use-maintenance-data.types.assert.ts`
- Test: `src/app/(app)/reports/components/__tests__/maintenance-report-tab.test.tsx`

- [ ] **Step 1: Add failing compile-time contract expectations**

Add `src/app/(app)/reports/hooks/use-maintenance-data.types.assert.ts` following the existing `use-inventory-data.types.assert.ts` pattern. Assert that the report hook and component-facing types expose:
- `topEquipmentRepairCosts`
- `charts.repairUsageCostCorrelation.period.points`
- `charts.repairUsageCostCorrelation.period.dataQuality`
- `charts.repairUsageCostCorrelation.cumulative.points`
- `charts.repairUsageCostCorrelation.cumulative.dataQuality`

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected: FAIL because the exported maintenance report types/defaults do not expose the new fields yet. Do not rely on `maintenance-report-tab.test.tsx` for the RED contract step; that test mocks `useMaintenanceReportData`, so adding fixture fields alone will not prove the hook contract changed.

- [ ] **Step 2: Update exported hook types and defaults**

Create `src/app/(app)/reports/hooks/use-maintenance-data.types.ts` and move/export the shared report data interfaces needed by both the hook and the new chart component. In `src/app/(app)/reports/hooks/use-maintenance-data.ts`, import those types and extend `MaintenanceReportData` plus the fallback result. Keep `topEquipmentRepairs` unchanged.

Include these exported interfaces:

```ts
export interface TopEquipmentRepairCostEntry {
  equipmentId: number
  equipmentName: string
  equipmentCode?: string | null
  totalRepairCost: number
  averageCompletedRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
}

export interface RepairUsageCostCorrelationPoint {
  equipmentId: number
  equipmentName: string
  equipmentCode?: string | null
  totalUsageHours: number
  totalRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
  costPerUsageHour: number
}

export interface RepairUsageCostDataQuality {
  equipmentWithUsage: number
  equipmentWithRepairCost: number
  equipmentWithBoth: number
}

export interface RepairUsageCostCorrelationScope {
  points: RepairUsageCostCorrelationPoint[]
  dataQuality: RepairUsageCostDataQuality
}
```

Use the exported types from `maintenance-report-cost-charts.tsx`; do not duplicate interface definitions in the component.

- [ ] **Step 3: Run contract tests and verify GREEN**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit TypeScript contract batch**

```bash
git add src/app/'(app)'/reports/hooks/use-maintenance-data.ts src/app/'(app)'/reports/hooks/use-maintenance-data.types.ts src/app/'(app)'/reports/hooks/use-maintenance-data.types.assert.ts src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
git commit -m "feat: type repair cost usage report data"
```

## Chunk 3: UI Visualizations

**Files:**
- Modify: `src/lib/chart-utils.ts`
- Modify: `src/components/dynamic-chart.tsx`
- Modify: `src/app/(app)/reports/components/maintenance-report-tab.tsx`
- Create: `src/app/(app)/reports/components/maintenance-report-cost-charts.tsx`
- Create: `src/app/(app)/reports/components/maintenance-report-formatters.ts`
- Test: `src/app/(app)/reports/components/__tests__/maintenance-report-tab.test.tsx`

- [ ] **Step 1: Add failing UI tests**

Add tests for:
- Renders “Top 10 thiết bị có chi phí sửa chữa cao nhất” when `topEquipmentRepairCosts` has data.
- Renders “Giờ sử dụng và chi phí sửa chữa” when period correlation has at least 3 points.
- Shows insufficient-data state when `equipmentWithBoth < 3`.
- Switching cumulative mode changes the displayed dataset label/count while keeping top-cost ranking period-scoped.

If the test file mocks `@/components/dynamic-chart`, extend the mock to include `DynamicScatterChart` alongside the existing `DynamicBarChart`, `DynamicLineChart`, and `DynamicPieChart` mocks.

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
```

Expected: FAIL because the UI components do not exist yet.

- [ ] **Step 2: Add chart support**

Update the dynamic chart loader stack for scatter support:
- In `src/lib/chart-utils.ts`, add `ScatterChart`, `Scatter`, and `ZAxis` to the `RechartsComponents` type.
- In `src/lib/chart-utils.ts`, return `ScatterChart`, `Scatter`, and `ZAxis` from `loadChartsLibrary()`.
- In `src/components/dynamic-chart.tsx`, add `DynamicScatterChart` using the existing `DynamicChart` loader and Recharts components.
- Keep this additive; `dynamic-chart.tsx` remains below the 450-line ceiling after one scatter wrapper. If more chart types are added later, extract chart wrappers into focused files first.

Keep the prop surface minimal:

```ts
interface ScatterChartProps {
  data: ChartData[]
  height?: number
  xAxisKey: string
  yAxisKey: string
  name?: string
  color?: string
  showGrid?: boolean
  showTooltip?: boolean
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}
```

- [ ] **Step 3: Add report formatting helpers**

Create `src/app/(app)/reports/components/maintenance-report-formatters.ts` with:
- `formatCurrencyVnd(value: number): string`
- `formatUsageHours(value: number): string`
- `parseNumericReportValue(value: unknown): number` if replacing the local helper in `maintenance-report-tab.tsx`

Use `Intl.NumberFormat("vi-VN")` and keep output stable for tests.

- [ ] **Step 4: Add focused chart component**

Create `src/app/(app)/reports/components/maintenance-report-cost-charts.tsx`.

Export a component that accepts:

```ts
interface MaintenanceReportCostChartsProps {
  isLoading: boolean
  topEquipmentRepairCosts: TopEquipmentRepairCostEntry[]
  correlation: {
    period: RepairUsageCostCorrelationScope
    cumulative: RepairUsageCostCorrelationScope
  }
}
```

Behavior:
- Horizontal bar chart for top repair cost equipment.
- Scatter chart for correlation when the selected scope has `dataQuality.equipmentWithBoth >= 3`.
- Empty state with usage/cost/both counts when below threshold.
- Toggle labels: `Theo kỳ báo cáo` and `Lũy kế đến cuối kỳ`.
- User-facing copy only; avoid self-referential UI descriptions.

- [ ] **Step 5: Wire into the maintenance report tab**

In `src/app/(app)/reports/components/maintenance-report-tab.tsx`:
- Import the new component and formatting helpers.
- Derive `topEquipmentRepairCosts` from `reportData?.topEquipmentRepairCosts ?? []`.
- Derive `repairUsageCostCorrelation` from `charts?.repairUsageCostCorrelation` with empty defaults.
- Place the new visualizations after the cost KPI cards and before existing trend/status charts.
- Keep existing tables and charts unchanged.

- [ ] **Step 6: Run UI tests and verify GREEN**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit UI batch**

```bash
git add src/lib/chart-utils.ts src/components/dynamic-chart.tsx src/app/'(app)'/reports/components/maintenance-report-tab.tsx src/app/'(app)'/reports/components/maintenance-report-cost-charts.tsx src/app/'(app)'/reports/components/maintenance-report-formatters.ts src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
git commit -m "feat: show repair cost usage visualizations"
```

## Chunk 4: Final Verification And OpenSpec

**Files:**
- Modify: `openspec/changes/add-repair-cost-usage-visualizations/tasks.md`

- [ ] **Step 1: Run required TypeScript gate**

```bash
node scripts/npm-run.js run verify:no-explicit-any
```

Expected: PASS with no explicit `any` in changed TypeScript files.

- [ ] **Step 2: Run typecheck**

```bash
node scripts/npm-run.js run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run focused tests**

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx src/app/'(app)'/repair-requests/__tests__/repairRequestCost.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run React Doctor diff scan**

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: no new issues attributable to this change.

- [ ] **Step 5: Run OpenSpec validation**

```bash
openspec validate add-repair-cost-usage-visualizations --strict
openspec validate repair-request-cost-statistics --type spec --strict
```

Expected: both PASS. Do not require `openspec validate --all --strict` to pass unless the unrelated pre-existing invalid changes have been fixed.

- [ ] **Step 6: Update OpenSpec tasks**

Mark completed items in `openspec/changes/add-repair-cost-usage-visualizations/tasks.md`. Add a short verification note if any environment-specific check could not run.

- [ ] **Step 7: Commit verification docs**

```bash
git add openspec/changes/add-repair-cost-usage-visualizations/tasks.md
git commit -m "docs: update repair cost usage visualization tasks"
```

- [ ] **Step 8: Push**

```bash
git pull --rebase
git push
git status
```

Expected: branch is up to date with `origin/main`, working tree clean.
