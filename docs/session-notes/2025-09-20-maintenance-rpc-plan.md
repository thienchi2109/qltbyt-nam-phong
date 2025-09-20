# Session Note — Maintenance Reports RPC Refactor

Date: 2025-09-20

Summary
- Added `docs/maintenance-reports-rpc-refactor-plan.md` to move maintenance reports to RPC-first.
- Plan aligns with existing patterns (tenant-aware SQL via JWT claims, proxy whitelist, idempotent migrations).

Planned RPCs
- `repair_request_list(...) returns setof jsonb` — tenant-filtered; embeds equipment and requester.
- `maintenance_task_list(...) returns setof jsonb` — tenant-filtered; embeds plan and assignee.
- Reuse `maintenance_plan_list(...)` for plans; add params if needed.
- `maintenance_stats(...) returns jsonb` — aggregates for charts; whitelist `group_by`.

Frontend Refactor
- Replace direct table reads in `src/app/(app)/reports/hooks/use-maintenance-data.ts` with `callRpc` calls.
- Add response types under `src/types/maintenance.ts`.
- Handle 404 RPCs as empty sets; surface concise errors otherwise.

Proxy + Grants
- Add new RPCs to `ALLOWED_FUNCTIONS` in `src/app/api/rpc/[fn]/route.ts`.
- Ensure `GRANT EXECUTE` to `authenticated` for all new functions.

Indexes & Performance
- Verify indexes for common filters/sorts on `yeu_cau_sua_chua`, `cong_viec_bao_tri`, `ke_hoach_bao_tri`, and `thiet_bi(don_vi)`.
- Use pagination and server-side aggregates for charts.

Actionable Next Steps
1) Write migration `supabase/migrations/20250920_maintenance_reports_rpcs.sql` with the new functions + grants.
2) Add RPCs to the proxy whitelist.
3) Create `src/types/maintenance.ts` with minimal UI-aligned types.
4) Refactor `use-maintenance-data.ts` to use RPCs and map results.
5) Typecheck and validate `/reports` maintenance tab; adjust fields if necessary.
6) Add a follow-up note after rollout with any tweaks/index additions.
