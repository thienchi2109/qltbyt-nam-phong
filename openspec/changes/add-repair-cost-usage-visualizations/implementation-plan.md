# Repair Cost Usage Visualizations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/reports` maintenance repair visualizations for top repair-cost equipment and usage-duration vs repair-cost correlation.

**Architecture:** Extend the existing tenant-scoped `get_maintenance_report_data(date,date,bigint)` RPC without changing its signature, then add typed report payload handling and focused report chart components. Keep `topEquipmentRepairs` as the existing request-count ranking and add separate cost/correlation payloads.

**Tech Stack:** Supabase Postgres PL/pgSQL, SQL smoke tests, Next.js App Router, React, TanStack Query, Vitest, Recharts through `src/components/dynamic-chart.tsx`, OpenSpec.

---

## Chunk 1: SQL Data Contract

**Files:**
- Create: `supabase/tests/repair_cost_usage_visualizations_smoke.sql`
- Create: `supabase/migrations/20260413143000_add_repair_cost_usage_visualizations.sql`
- Reference: `supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql`
- Reference: `openspec/changes/add-repair-cost-usage-visualizations/specs/repair-request-cost-statistics/spec.md`

- [ ] **Step 1: Write the failing SQL smoke test**

Create `supabase/tests/repair_cost_usage_visualizations_smoke.sql`. Wrap it in `BEGIN; ... ROLLBACK;`, set JWT claims with a temp helper, seed at least:
- Three tenant-scoped equipment rows with valid completed usage intervals and completed repair costs.
- One open usage log with `thoi_gian_ket_thuc IS NULL`.
- One invalid usage log where end time is before start time.
- One same-tenant completed repair with `chi_phi_sua_chua IS NULL`.
- One other-tenant equipment with usage and cost that must not appear under the first tenant.

Assert:
- `get_maintenance_report_data(...) -> 'topEquipmentRepairCosts'` exists and is sorted by `totalRepairCost DESC`.
- `charts.repairUsageCostCorrelation.period.points` includes only valid completed usage intervals within the selected date range.
- `charts.repairUsageCostCorrelation.cumulative.points` includes valid completed usage/cost through `p_date_to`.
- `dataQuality.equipmentWithUsage`, `dataQuality.equipmentWithRepairCost`, and `dataQuality.equipmentWithBoth` are present.
- Other-tenant seeded rows are excluded for non-global claims.

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

Create `supabase/migrations/20260413143000_add_repair_cost_usage_visualizations.sql` with `CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(p_date_from date, p_date_to date, p_don_vi bigint DEFAULT NULL)`.

Preserve from the existing RPC:
- `LANGUAGE plpgsql`
- `SECURITY DEFINER`
- `SET search_path = public, pg_temp`
- JWT role and user guards
- `admin` -> `global` handling
- `allowed_don_vi_for_session_safe()` tenant scoping
- Existing summary, charts, `topEquipmentRepairs`, and `recentRepairHistory` payloads

Add these payloads:

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
    'points', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.total_repair_cost DESC, p.equipment_name) FROM period_correlation_points p), '[]'::jsonb),
    'dataQuality', (SELECT to_jsonb(q) FROM period_correlation_quality q)
  ),
  'cumulative', jsonb_build_object(
    'points', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.total_repair_cost DESC, c.equipment_name) FROM cumulative_correlation_points c), '[]'::jsonb),
    'dataQuality', (SELECT to_jsonb(q) FROM cumulative_correlation_quality q)
  )
)
```

Use CTEs that aggregate valid usage intervals per `equipment_id`:

```sql
sum(extract(epoch from (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600)
  FILTER (
    WHERE nk.thoi_gian_ket_thuc IS NOT NULL
      AND nk.thoi_gian_ket_thuc > nk.thoi_gian_bat_dau
  )
```

For period mode, restrict usage start date and repair reference date to `p_date_from..p_date_to`. For cumulative mode, restrict both to `<= p_date_to`.

- [ ] **Step 4: Run SQL smoke test and verify GREEN**

Run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/repair_cost_usage_visualizations_smoke.sql
```

Expected: PASS with transaction rolled back.

- [ ] **Step 5: Run Supabase advisor**

Run Supabase MCP `get_advisors(security)`.

Expected: no new advisor item attributable to `get_maintenance_report_data`. Existing project-wide advisor findings may remain; record them separately if unchanged.

- [ ] **Step 6: Commit SQL batch**

```bash
git add supabase/migrations/20260413143000_add_repair_cost_usage_visualizations.sql supabase/tests/repair_cost_usage_visualizations_smoke.sql
git commit -m "feat: add repair cost usage report data"
```

## Chunk 2: TypeScript Report Contract

**Files:**
- Modify: `src/app/(app)/reports/hooks/use-maintenance-data.ts`
- Test: `src/app/(app)/reports/components/__tests__/maintenance-report-tab.test.tsx`

- [ ] **Step 1: Add failing contract expectations**

Update the focused report test fixture so it expects:
- `topEquipmentRepairCosts`
- `charts.repairUsageCostCorrelation.period.points`
- `charts.repairUsageCostCorrelation.period.dataQuality`
- `charts.repairUsageCostCorrelation.cumulative.points`
- `charts.repairUsageCostCorrelation.cumulative.dataQuality`

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
```

Expected: FAIL because the hook types/defaults do not expose the new fields yet.

- [ ] **Step 2: Update the hook types and defaults**

In `src/app/(app)/reports/hooks/use-maintenance-data.ts`, add interfaces:

```ts
interface TopEquipmentRepairCostEntry {
  equipmentId: number
  equipmentName: string
  equipmentCode?: string | null
  totalRepairCost: number
  averageCompletedRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
}

interface RepairUsageCostCorrelationPoint {
  equipmentId: number
  equipmentName: string
  equipmentCode?: string | null
  totalUsageHours: number
  totalRepairCost: number
  completedRepairRequests: number
  costRecordedCount: number
  costPerUsageHour: number
}

interface RepairUsageCostDataQuality {
  equipmentWithUsage: number
  equipmentWithRepairCost: number
  equipmentWithBoth: number
}

interface RepairUsageCostCorrelationScope {
  points: RepairUsageCostCorrelationPoint[]
  dataQuality: RepairUsageCostDataQuality
}
```

Extend `MaintenanceReportData` and the fallback result. Keep `topEquipmentRepairs` unchanged.

- [ ] **Step 3: Run contract tests and verify GREEN**

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit TypeScript contract batch**

```bash
git add src/app/'(app)'/reports/hooks/use-maintenance-data.ts src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
git commit -m "feat: type repair cost usage report data"
```

## Chunk 3: UI Visualizations

**Files:**
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

Run:

```bash
node scripts/npm-run.js run test:run -- src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
```

Expected: FAIL because the UI components do not exist yet.

- [ ] **Step 2: Add chart support only if missing**

Check whether `src/components/dynamic-chart.tsx` already exports a scatter chart wrapper. If not, add `DynamicScatterChart` using the existing `DynamicChart` loader and Recharts components.

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
git add src/components/dynamic-chart.tsx src/app/'(app)'/reports/components/maintenance-report-tab.tsx src/app/'(app)'/reports/components/maintenance-report-cost-charts.tsx src/app/'(app)'/reports/components/maintenance-report-formatters.ts src/app/'(app)'/reports/components/__tests__/maintenance-report-tab.test.tsx
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
