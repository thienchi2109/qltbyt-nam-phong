## 1. Backend Batch
- [x] 1.1 Add SQL smoke test for `chi_phi_sua_chua` schema, no-default contract, null semantics, and no backfill.
- [x] 1.2 Add SQL smoke test for `repair_request_complete` storing `NULL`, `0`, and positive cost values.
- [x] 1.3 Add SQL smoke test for negative cost rejection and terminal-state idempotency.
- [x] 1.4 Add SQL smoke test for missing JWT claims and wrong-tenant write rejection.
- [x] 1.5 Create migration adding `yeu_cau_sua_chua.chi_phi_sua_chua numeric(14,2) NULL` with no default.
- [x] 1.6 Add non-negative check constraint allowing `NULL`.
- [x] 1.7 Recreate `repair_request_complete` with `p_chi_phi_sua_chua numeric DEFAULT NULL`.
- [x] 1.8 Preserve hardened lifecycle RPC security: `SECURITY DEFINER`, `SET search_path`, role/user guards, tenant guard, row locks, `admin`/`global` handling, and regional write restriction.
- [x] 1.9 Extend `repair_request_list` payload with `chi_phi_sua_chua`.
- [x] 1.10 Extend `get_maintenance_report_data` with repair cost totals, averages, recorded count, missing count, and cost breakdowns.
- [x] 1.11 Extend `maintenance_stats_for_reports(date,date,bigint,text)` with repair cost summary fields while preserving report scoping.
- [x] 1.12 Run SQL smoke test and Supabase MCP `get_advisors(security)`.

## 2. Frontend Batch
- [x] 2.1 Add cost parser/formatter unit tests for Vietnamese thousands separators, blank-to-`NULL`, zero, positive values, and invalid input.
- [x] 2.2 Implement `repairRequestCost` helper.
- [x] 2.3 Add completion dialog tests for optional "Tổng chi phí sửa chữa" visibility and payloads.
- [x] 2.4 Update completion mutation to send `p_chi_phi_sua_chua` only for the `Hoàn thành` flow.
- [x] 2.5 Add `chi_phi_sua_chua: number | null` to repair request/report types.
- [x] 2.6 Add repair detail display tests for `NULL` versus `0`.
- [x] 2.7 Update repair detail display with Vietnamese cost formatting.
- [x] 2.8 Add report hook/UI tests for total cost, average completed cost, recorded count, and missing count.
- [x] 2.9 Update maintenance report hooks and UI.
- [x] 2.10 Add export sheet tests for cost summary rows and existing row preservation.
- [x] 2.11 Update export sheet builder for repair cost statistics.
- [x] 2.12 Run TypeScript/React verification gates in repo-required order.

## 3. Verification
- [x] 3.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [x] 3.2 Run `node scripts/npm-run.js run typecheck`.
- [x] 3.3 Run focused SQL smoke test for repair request cost.
- [x] 3.4 Run focused Vitest suites for repair requests and reports.
- [x] 3.5 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [x] 3.6 Run `openspec validate add-repair-request-cost-statistics --strict`.
- [x] 3.7 Commit backend and frontend batches separately if implemented separately.

## Archive Notes
- 2026-04-13: `verify:no-explicit-any`, `typecheck`, focused Vitest suites, OpenSpec validation, and Supabase MCP security advisor were run during archive cleanup.
- 2026-04-13: Full `psql` SQL smoke test was not rerun from shell during archive cleanup because `SUPABASE_DB_URL` was not present; Supabase MCP confirmed the column contract, non-negative constraint, and search path settings for the cost-related RPCs.
- 2026-04-13: React Doctor was not rerun during archive cleanup after operator feedback to avoid extra `npx` execution for this docs/archive task.
- 2026-04-13: Remaining tasks were marked complete per operator confirmation that the cost capture feature is finished.
