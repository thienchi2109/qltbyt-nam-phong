# Copilot Instructions for qltbyt-nam-phong

These rules help AI agents work productively in this repo. Keep guidance concise, specific, and grounded in the codebase.

## Architecture Overview
- Frontend: Next.js 15 (App Router) with TypeScript, Tailwind, Radix UI components.
  - Entry points: `src/app/**` routes; global styles in `src/app/globals.css`; layout in `src/app/(app)/layout.tsx`.
  - UI primitives and patterns live in `src/components/**`.
- Auth/Session: NextAuth in `src/auth/config.ts`. JWT/session includes `role` and active tenant `don_vi`.
- Data layer: Supabase Postgres accessed via RPC functions (no RLS by design). All tenant/role checks happen server-side in SQL.
  - Migrations: `supabase/migrations/**`. Key: `20250914_multi_tenant_phase1.sql` (schema + equipment RPCs), `20250914_multi_tenant_backfill.sql` (data seed/backfill).
  - Helpers: `_get_jwt_claim(claim)` reads PostgREST JWT claims.
- Multi-tenant model (Phase 1):
  - Tenants in `public.don_vi` (code, name, active).
  - Users `public.nhan_vien` have `don_vi` and `current_don_vi` (active tenant); memberships in `public.user_don_vi_memberships`.
  - Roles: `global` (bypass tenant filtering), `to_qltb`, `technician`, `user`.
- API glue: Next.js API routes under `src/app/api/**` for tenant switching and membership listing.

## Core Patterns to Follow
- Prefer `supabase.rpc('function_name', args)` over direct table access. The RPCs enforce tenant + role constraints.
  - Implement new features by adding SQL RPCs in `supabase/migrations/**`, granting `EXECUTE` to `authenticated`.
- Keep JWT in sync: Any changes to `nhan_vien.role` or `current_don_vi` require a session refresh (sign-out/in or explicit refresh endpoint) to update claims.
- Tenant context: Read `session.user.don_vi` on the client for current tenant. Use the Header Tenant Switcher (`src/components/tenant-switcher.tsx`) to change tenants.
- UI interactions: When making table rows clickable for details, ensure action menu buttons use `event.stopPropagation()` to avoid accidental dialog open (implemented in equipment/users/maintenance pages).

## Build, Run, Deploy
- Dev: `npm run dev` (Turbopack). HTTPS dev: `npm run dev-https` (port 9002).
- Build: `npm run build` (Next). Cloudflare static build: `npm run build:cloudflare`.
- Preview/Deploy:
  - Cloudflare Pages preview: `npm run cf:preview`.
  - Dual deploy helper: `npm run deploy:dual` (see `scripts/deploy-dual.js`).
- Type/Lint: `npm run typecheck`; `npm run lint`.

## Database Workflows
- Apply migrations (Supabase CLI): `supabase db push` (or run files manually).
- Phase 1 RPCs: equipment
  - `public.equipment_list(p_q, p_sort, p_page, p_page_size)` – tenant-filtered unless `role='global'`.
  - `public.equipment_get(p_id)` – returns any for `global`, else within tenant.
  - `public.equipment_create/update/delete(...)` – enforce role/tenant rules (see SQL body).
- Backfill script: `20250914_multi_tenant_backfill.sql` seeds tenants from legacy department names; respects pre-seeded `don_vi` (e.g., YKPNT); trims names; seeds memberships idempotently.

## Adding New Domains (pattern)
1) Add columns or tables and indexes in a new migration.
2) Write RPCs with role/tenant checks using `_get_jwt_claim('role'|'don_vi')`.
3) `GRANT EXECUTE` to `authenticated`; do NOT expose tables directly.
4) Refactor frontend to call `supabase.rpc` with typed args. Keep pagination/sorting whitelist on SQL side.

## Important Files
- Auth: `src/auth/config.ts`
- Tenant switch + APIs: `src/components/tenant-switcher.tsx`, `src/app/api/tenants/**`
- Middleware (if any cross-cutting concerns): `src/middleware.ts`
- Equipment UI example for row click/propagation: `src/app/(app)/equipment/page.tsx`
- Migrations: `supabase/migrations/20250914_multi_tenant_phase1.sql`, `..._backfill.sql`
- Docs: `docs/multi-tenant-plan.md`

## Conventions
- Role strings are lowercase (`global`, `to_qltb`, `technician`, `user`).
- Avoid dynamic SQL with string concatenation; use `EXECUTE ... USING` and whitelisted sort columns.
- Keep migrations idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING) where applicable.

## Quick Checks Before PRs
- Build passes: `npm run build`.
- Types clean: `npm run typecheck`.
- If DB changes: confirm new migration runs; verify RPC grants; test tenant filtering with a non-global user.
