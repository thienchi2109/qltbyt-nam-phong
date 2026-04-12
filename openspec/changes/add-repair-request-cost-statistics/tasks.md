## 1. Backend Batch
- [x] 1.1 Add SQL smoke test for `chi_phi_sua_chua` schema, default, null semantics, and no backfill.
- [x] 1.2 Add SQL smoke test for `repair_request_complete` storing `NULL`, `0`, and positive cost values.
- [x] 1.3 Add SQL smoke test for negative cost rejection and terminal-state idempotency.
- [x] 1.4 Add SQL smoke test for missing JWT claims and wrong-tenant write rejection.
- [x] 1.5 Create migration adding `yeu_cau_sua_chua.chi_phi_sua_chua numeric(14,2) NULL`, then setting default `0`.
- [x] 1.6 Add non-negative check constraint allowing `NULL`.
- [x] 1.7 Recreate `repair_request_complete` with `p_chi_phi_sua_chua numeric DEFAULT NULL`.
- [x] 1.8 Preserve hardened lifecycle RPC security: `SECURITY DEFINER`, `SET search_path`, role/user guards, tenant guard, row locks, `admin`/`global` handling, and regional write restriction.
- [x] 1.9 Extend `repair_request_list` payload with `chi_phi_sua_chua`.
- [x] 1.10 Extend `get_maintenance_report_data` with repair cost totals, averages, recorded count, missing count, and cost breakdowns.
- [x] 1.11 Extend `maintenance_stats_for_reports(date,date,bigint,text)` with repair cost summary fields while preserving report scoping.
- [ ] 1.12 Run SQL smoke test and Supabase MCP `get_advisors(security)`.

## 2. Frontend Batch
- [ ] 2.1 Add cost parser/formatter unit tests for Vietnamese thousands separators, blank-to-`NULL`, zero, positive values, and invalid input.
- [ ] 2.2 Implement `repairRequestCost` helper.
- [ ] 2.3 Add completion dialog tests for optional "Tổng chi phí sửa chữa" visibility and payloads.
- [ ] 2.4 Update completion mutation to send `p_chi_phi_sua_chua` only for the `Hoàn thành` flow.
- [ ] 2.5 Add `chi_phi_sua_chua: number | null` to repair request/report types.
- [ ] 2.6 Add repair detail display tests for `NULL` versus `0`.
- [ ] 2.7 Update repair detail display with Vietnamese cost formatting.
- [ ] 2.8 Add report hook/UI tests for total cost, average completed cost, recorded count, and missing count.
- [ ] 2.9 Update maintenance report hooks and UI.
- [ ] 2.10 Add export sheet tests for cost summary rows and existing row preservation.
- [ ] 2.11 Update export sheet builder for repair cost statistics.
- [ ] 2.12 Run TypeScript/React verification gates in repo-required order.

## 3. Verification
- [ ] 3.1 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 3.2 Run `node scripts/npm-run.js run typecheck`.
- [ ] 3.3 Run focused SQL smoke test for repair request cost.
- [ ] 3.4 Run focused Vitest suites for repair requests and reports.
- [ ] 3.5 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`.
- [ ] 3.6 Run `openspec validate add-repair-request-cost-statistics --strict`.
- [ ] 3.7 Commit backend and frontend batches separately if implemented separately.
