## 1. SQL / Data Contract
- [x] 1.1 Add failing SQL smoke coverage for live schema assumptions, top repair-cost sorting, exact camelCase payload keys, and usage-log seed equipment IDs that fit `nhat_ky_su_dung.thiet_bi_id integer`.
- [x] 1.2 Add failing SQL smoke coverage for valid usage-hour aggregation, invalid/open usage-log exclusion, cumulative-vs-range mode including usage intervals crossing past `p_date_to`, sparse-data counts, and tenant/global scoping.
- [x] 1.3 Extend the latest `get_maintenance_report_data(date,date,bigint)` body from live Supabase MCP / `20260412100000_add_repair_request_cost_statistics.sql` to return `topEquipmentRepairCosts` sorted by completed repair cost descending, preserving all existing payload keys and empty/default return payloads.
- [x] 1.4 Extend the same RPC without changing its signature to return `charts.repairUsageCostCorrelation.period` and `charts.repairUsageCostCorrelation.cumulative`, each with `points` and `dataQuality`, using explicit scoped-equipment, usage, period-cost, cumulative-cost, point, and quality CTEs.
- [x] 1.5 Preserve JWT guards, `admin`/`global` handling, regional scope, `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `GRANT`/`REVOKE`, existing live ACL posture unless explicitly hardened, and `COMMENT ON FUNCTION`, using `tb.don_vi = ANY(v_effective)` for equipment tenant scoping and documenting the `nhat_ky_su_dung.thiet_bi_id` integer to `thiet_bi.id` bigint join without casting the indexed usage-log column.
- [x] 1.6 Run the focused SQL smoke test and confirm it passes.

## 2. TypeScript Contract
- [x] 2.1 Add failing compile-time type assertion coverage for the maintenance report hook default payload and new report fields; do not rely on the mocked `maintenance-report-tab.test.tsx` fixture for the RED contract step.
- [x] 2.2 Extract/export maintenance report data types for `topEquipmentRepairCosts` and `repairUsageCostCorrelation.{period,cumulative}.{points,dataQuality}` into `use-maintenance-data.types.ts`.
- [x] 2.3 Keep `topEquipmentRepairs` unchanged for request-count ranking.
- [x] 2.4 Run `node scripts/npm-run.js run typecheck` and confirm the type assertions pass.

## 3. UI
- [x] 3.1 Add failing component tests for the Top 10 repair-cost chart, usage-cost correlation chart, cumulative toggle, insufficient-data state, and `DynamicScatterChart` test mock wiring.
- [x] 3.2 Add scatter support in `src/lib/chart-utils.ts` and `src/components/dynamic-chart.tsx`.
- [x] 3.3 Extract new chart/formatting helpers from `maintenance-report-tab.tsx` into focused report component files before adding chart UI.
- [x] 3.4 Render a horizontal bar chart for “Top 10 thiết bị có chi phí sửa chữa cao nhất”.
- [x] 3.5 Render a scatter/bubble chart for “Giờ sử dụng và chi phí sửa chữa” only when the data-quality threshold is met.
- [x] 3.6 Render a data-quality empty state when fewer than three equipment have both positive usage hours and recorded repair cost.
- [x] 3.7 Run the focused report UI tests and confirm they pass.

## 4. Verification
- [x] 4.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [x] 4.2 Run `node scripts/npm-run.js run typecheck`.
- [x] 4.3 Run focused SQL smoke tests.
- [x] 4.4 Run focused Vitest suites for reports and repair cost.
- [x] 4.5 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [x] 4.6 Run Supabase MCP `get_advisors(security)`.
- [x] 4.7 Run `openspec validate add-repair-cost-usage-visualizations --strict`.
