# Regional Leader Role Rollout Plan

## Context
- New role `regional_leader` must read all data for every `don_vi` inside its `dia_ban`, stay read-only for domain entities, and never access accounts or data outside that area.
- `regional_leader` sits above `to_qltb` within the same `dia_ban`: they see every unit in the region but still have no write authority or user-management privileges.
- Scope enforcement must span authentication (JWT claims), API proxy sanitation, database RPC logic, and RLS once enabled.
- UI must hide `/users` and other privileged controls, while allowing regional leaders to navigate tenant data safely.

## Current Gaps
- `authenticate_user_dual_mode` and NextAuth callbacks only propagate `role`, `don_vi`, and `khoa_phong`; no `dia_ban` claim is available (see `src/auth/config.ts`, `supabase/migrations/20241221_secure_user_update_function.sql`).
- RPC proxy signs JWTs with `app_role`, `don_vi`, `user_id` only (`src/app/api/rpc/[fn]/route.ts`).
- Database schema lacks `dia_ban` metadata on `don_vi`/`nhan_vien`; RPCs use single-tenant filters and rely on input `p_don_vi` for non-global users.
- Tenant switch/membership APIs (`src/app/api/tenants/**`) only reason about explicit memberships.
- Users page and navigation guard based on `global|admin` but allow reachability for any role if links are exposed; client-side Supabase queries bypass proxy and would leak data.
- High-volume tables use `WHERE don_vi = ...` predicates; area reads will introduce `= ANY(array)` or `IN` filters that may need extra indexes.

## Implementation Strategy
1. **Schema & Data Model**
   - Create `public.dia_ban` table to hold regional metadata:
     - `id BIGSERIAL PRIMARY KEY`
     - `ma_dia_ban TEXT NOT NULL UNIQUE`
     - `ten_dia_ban TEXT NOT NULL`
     - `ten_lanh_dao TEXT`
     - `so_luong_don_vi_truc_thuoc INTEGER NOT NULL DEFAULT 0 CHECK (so_luong_don_vi_truc_thuoc >= 0)`
     - `dia_chi TEXT`
     - `logo_dia_ban_url TEXT`
     - Recommended governance columns: `cap_do TEXT`, `parent_id BIGINT REFERENCES public.dia_ban(id)`, `active BOOLEAN DEFAULT TRUE`, `sort_order INTEGER`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()` with trigger to keep it fresh.
     - Indexes: keep the `UNIQUE (ma_dia_ban)`; add `CREATE INDEX idx_dia_ban_parent_active ON public.dia_ban(parent_id, active)` and optional `pg_trgm` GIN index on `ten_dia_ban` for fuzzy search.
   - Add `dia_ban_id` foreign keys to `don_vi` (required) and `nhan_vien` (optional-but-recommended). Provide an idempotent backfill that maps existing units to areas, and store the canonical mapping CSV/markdown under `docs/` for auditing.
   - Publish a helper SQL function (e.g., `public.allowed_don_vi_for_session()`) that derives the session's accessible `don_vi` set via `dia_ban`; reuse it across RPCs and future RLS policies.
   - Create covering indexes on `don_vi` and `dia_ban_id` for core transactional tables (`thiet_bi`, `yeu_cau_sua_chua`, `yeu_cau_luan_chuyen`, maintenance tables, history tables) to support `= ANY()` filters.
   - Run ANALYZE guidance post-index creation to keep query plans stable.

2. **Authentication Pipeline**
   - Extend `authenticate_user_dual_mode` to return `dia_ban` for the signed-in user (derive from `nhan_vien` or linked `don_vi`).
   - Modify NextAuth JWT callback to persist `dia_ban` and expose it in the session payload.
   - Update RPC proxy to sign Supabase JWTs with `dia_ban` claim and sanitize payloads for both `p_don_vi` and new `p_dia_ban` args.

3. **Role Semantics & DB Guardrails**
   - Treat `regional_leader` as the highest non-global tier: broader read scope than `to_qltb` inside the shared `dia_ban`, but hard-fail all create/update/delete RPCs and any user-management pathway when `app_role = 'regional_leader'`.
   - Update read RPCs to compute allowed `don_vi` via `dia_ban`; reject requests outside scope or return empty sets.
   - Add SQL-level tests (using DO blocks) verifying `regional_leader` cannot see outside data and is blocked from writes.

4. **API Layer & Tenant Switching**
   - Adjust `/api/tenants/memberships` and `/api/tenants/switch` to include area-based listings for regional leaders without granting write privileges.
   - Ensure proxy whitelist contains any new read-only RPCs required for dashboards/reports that now operate on multi-tenant sets.

5. **UI/UX Changes**
   - Hide `/users` link and user-management actions for `regional_leader`; add middleware redirect/403 for `/users` route.
   - Update navigation components (`AppLayout`, `MobileFooterNav`) and per-page guards to include `regional_leader` in read-only logic while reflecting its elevated viewing scope.
   - Surface optional filters or selectors so regional leaders can pivot between `don_vi` inside their `dia_ban` without needing manual tenant switching.
   - Update tenant create/update dialogs to collect `dia_ban` (dropdown sourced from the lookup table) and persist the selection through the existing RPCs once they accept the new foreign key.
   - Keep user create/update dialogs scoped to write-capable roles (`global`, optionally `to_qltb`). Do not expose separate `dia_ban` input; derive user `dia_ban_id` automatically from the selected `don_vi` memberships and let the RPC enforce tenant/role constraints. Validate role assignments client-side so unauthorized roles (including `regional_leader`) cannot be granted inadvertently.

6. **Testing & QA**
   - Unit tests: JWT callback includes `dia_ban`; proxy injects sanitized claims; role guard blocks writes.
   - Integration tests: RPCs return data for in-area units, empty/403 for outside area, tenant switch respects area scope.
   - E2E tests: `regional_leader` is blocked from `/users`, cannot trigger edit/delete buttons across UI, and dashboards reflect area-wide read access.
   - Regression checks: verify existing roles (`global`, `to_qltb`, `technician`, `user`, `qltb_khoa`) keep current behavior.

## Execution Breakdown
1. **DM-1 Schema foundation**
   - Draft Supabase migration creating `public.dia_ban` with required columns, constraints, indexes, and comments.
   - Prepare canonical `dia_ban` dataset (CSV/SQL) and commit under `docs/metadata/`.
   - Add `dia_ban_id` columns + FKs on `don_vi` / `nhan_vien`; create helper function `public.allowed_don_vi_for_session()`.
2. **DM-2 Backfill & performance**
   - Write idempotent backfill script mapping existing tenants/staff to `dia_ban`.
   - Add covering indexes on high-volume tables and run ANALYZE statements.
   - Capture verification queries ensuring no orphaned `don_vi` / `nhan_vien` remain unassigned.
3. **AUTH-1 Claims propagation**
   - Update `authenticate_user_dual_mode` to emit `dia_ban` + adjust unit tests/docs.
   - Persist `dia_ban` in NextAuth JWT/session; update Typescript session types if needed.
   - Enhance RPC proxy to embed `dia_ban` in signed JWT and sanitize payloads.
4. **RPC-1 Read scope enforcement**
   - Refactor read RPCs to consume `allowed_don_vi_for_session()` / new `p_dia_ban` args.
   - Ensure write RPCs short-circuit for `regional_leader`.
   - Add SQL DO-block tests validating in-scope vs out-of-scope access.
5. **API/UI-1 Tenant UX & guards**
   - Update tenant listing/switch endpoints for area scope.
   - Adjust app navigation, middleware, and page-level guards to block `/users` for `regional_leader`.
   - Introduce UI filters to browse all `don_vi` in region without manual switching.
   - Extend tenant create/update dialogs and RPC payloads to include `dia_ban_id` selection with validation and optimistic UI updates.
   - Confirm user create/update dialogs remain limited to write-capable roles, rely on RPC validation, and surface friendly errors when role/tenant constraints reject a submission.
6. **QA-1 Test suite & rollout**
   - Add unit/integration tests covering claims + RPC filters.
   - Script E2E scenarios for area access, `/users` blocking, and tenant create/update flows with `dia_ban` selection.
   - Document release checklist (monitoring, rollback steps, reporting performance review).

## Status Update – 2025-09-27
- Phase **RPC-1 Read scope enforcement (Phase 4)** is **complete**. Migration `20250927190000_regional_leader_phase4.sql` now applies `public.allowed_don_vi_for_session()` across repairs, transfers, and maintenance RPCs while hard-denying write attempts from `regional_leader`.
- UI guardrails for transfer workflows continue to block `regional_leader` from creating, editing, approving, or otherwise mutating transfer requests, aligning with Phase 5 (API/UI) goals.
- Dialog submit handlers (`AddTransferDialog`, `EditTransferDialog`) explicitly reject `regional_leader` actions, matching the read-only requirement.
- Automated tests were not executed for this tranche of work per request; schedule a focused QA sweep covering the new migration once TypeScript checks pass.

## Open Questions
- **Area catalog governance**: designate an owner for the `dia_ban` lookup table, store the primary mapping under version control, and define a change-control process (review + rollout window) before new regions are added.
- **Backfill sequencing**: stage migrations so schema changes land first, then run batched idempotent backfills with verification queries and a rollback plan; document expected cutover downtime (ideally zero) and monitoring checkpoints.
- **Reporting impact**: benchmark region-spanning dashboards on staging, evaluate whether materialized views or cached aggregates are needed, and add monitoring to track query latency once the role is live.

## Next Steps
1. Execute tasks under **DM-1 Schema foundation** and capture stakeholder sign-off on the `dia_ban` dataset.
2. Proceed with **DM-2 Backfill & performance**, validating indexes and backfill results before touching auth code.
3. Once data model work is stable, tackle **AUTH-1 Claims propagation** followed by **RPC-1 Read scope enforcement**.
4. Finish with **API/UI-1 Tenant UX & guards** (including tenant dialogs) and **QA-1 Test suite & rollout**, ensuring the QA checklist passes before release.
