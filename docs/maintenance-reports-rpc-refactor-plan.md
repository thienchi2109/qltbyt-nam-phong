# Maintenance Reports RPC Refactor Plan

## Goals
- Replace direct table reads in `use-maintenance-data.ts` with RPC calls via the API proxy.
- Enforce tenant and role constraints server-side in SQL.
- Keep UI behavior unchanged while improving reliability, security, and performance.

## Scope
- Frontend: `src/app/(app)/reports/hooks/use-maintenance-data.ts` (and any helpers it imports).
- Backend (SQL): New/updated RPCs for maintenance requests, plans, tasks, and stats.
- API Proxy: Whitelist additions (if new RPCs are introduced).

## Proposed RPCs (reuse where possible)
- Reuse: `public.maintenance_plan_list(...)` already exists and is used on Dashboard; confirm shape covers Reports needs. If gaps remain, add optional params.
- New RPCs:
  - `public.repair_request_list(p_q text default null, p_status text default null, p_date_from date default null, p_date_to date default null, p_page int default 1, p_page_size int default 100, p_sort text default 'created_at.desc') returns setof jsonb`
    - Tenant filter by equipment `don_vi` from claims; `global` bypass.
    - Embed relations: equipment (`thiet_bi`), requester (`nguoi_tao`), assignee/technician when applicable.
    - Whitelist `p_sort` columns; offset/limit via page + page_size.
  - `public.maintenance_task_list(p_q text default null, p_status text default null, p_assignee int default null, p_date_from date default null, p_date_to date default null, p_page int default 1, p_page_size int default 100, p_sort text default 'created_at.desc') returns setof jsonb`
    - Tenant filter via joined equipment; embed plan and assignee.
  - `public.maintenance_stats(p_date_from date, p_date_to date, p_group_by text default 'day') returns jsonb`
    - Aggregates for charts: counts by status, time series (created/completed), overdue counts.
    - Tenant-aware; `group_by` whitelist: `day|week|month`.

## SQL Design Guidelines
- Claims: Read `request.jwt.claims` and extract `app_role`/`role`, `don_vi`, `user_id`.
  - Safe-cast `don_vi` using numeric check before `::bigint`.
  - Non-`global` roles must have valid numeric `don_vi`; raise explicit error if missing/invalid.
- Tenant filtering: join to `thiet_bi` to compare `tb.don_vi = v_don_vi` when not `global`.
- Sorting: whitelist allowed columns; build ORDER BY via CASE or dynamic SQL with `EXECUTE ... USING` and validated tokens.
- Idempotent migrations: `create or replace function`; `drop function if exists` on signature changes.
- Grants: `grant execute on function ... to authenticated`.
- Return shapes: `setof jsonb` with embedded minimal related entities needed by UI.

## Frontend Refactor Plan
- Replace Supabase table queries with `callRpc` via `src/lib/rpc-client.ts`.
- Queries to add in `use-maintenance-data.ts`:
  - `repair_request_list` for requests, filtering by date range/status/text.
  - `maintenance_task_list` for tasks, filtering by status/assignee/date.
  - Reuse `maintenance_plan_list` for plans where needed.
  - Optional: `maintenance_stats` for chart series and summary cards to reduce client-side heavy lifting.
- Error handling:
  - Mirror inventory hook resilience: if a specific RPC is 404 (not deployed yet), treat as empty set and avoid destructive toasts; log in console.
  - For real errors (non-404), surface a concise, user-friendly message.
- Types:
  - Define response types for each RPC in `src/types/maintenance.ts` (e.g., `RepairRequest`, `MaintenanceTask`, `MaintenancePlan`, `MaintenanceStats`).
  - Keep fields minimal and align with current UI usage to avoid extra client transforms.

## API Proxy/Server
- Update `ALLOWED_FUNCTIONS` in `src/app/api/rpc/[fn]/route.ts` to include:
  - `repair_request_list`, `maintenance_task_list`, `maintenance_stats` (if added).
- No other server code changes expected.

## Performance & Indexes
- Confirm supporting indexes exist for filters/sorts used:
  - On `yeu_cau_sua_chua(created_at, trang_thai)`, `ke_hoach_bao_tri(next_due_at, enabled)`, `cong_viec_bao_tri(status, assignee_id)`.
  - Join paths: `thiet_bi(id)`, `thiet_bi(don_vi)`.
- Paginate large lists; default `page_size = 50-100` for Reports.

## Migration Rollout
1) Create migration file `supabase/migrations/20250920_maintenance_reports_rpcs.sql` with the new functions (and grants).
2) Apply in Supabase SQL Editor; verify functions compile and are visible.
3) Validate tenant filtering using a non-`global` user.
4) If needed, backfill or add missing indexes under `database/migrations/` or `supabase/migrations/` with idempotent DDL.

## Acceptance Criteria
- Reports page loads maintenance data without using any direct table reads.
- Non-`global` users see only tenant-related records; `global` sees all.
- Sorting and paging work as expected; charts match previous results.
- Typecheck passes; no new ESLint warnings in touched files.

## Risks & Mitigations
- Risk: RPC mismatch with existing UI expectations.
  - Mitigation: Define minimal, UI-aligned JSON shapes; adapt UI mapping as needed.
- Risk: Performance regressions with dynamic filters.
  - Mitigation: Add/confirm indexes; paginate; move aggregations server-side (`maintenance_stats`).
- Risk: Migration partially applied across environments.
  - Mitigation: Client treats 404 as empty; add session note with rollout steps.

## Task Breakdown
1) Write SQL RPCs per above (new migration).
2) Add RPC names to proxy whitelist.
3) Create `src/types/maintenance.ts` with RPC response types.
4) Refactor `use-maintenance-data.ts` to call RPCs and map results.
5) Update UI if field names differ; keep unchanged where possible.
6) Typecheck + manual validation on `/reports` maintenance tab.
7) Add session note documenting the change and rollout instructions.