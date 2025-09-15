Repo quick facts:
- Frontend: Next.js 15 TS, Tailwind, Radix. App Router under src/app; components in src/components.
- Auth: NextAuth in src/auth/config.ts with JWT/session including role + don_vi; server RPC gateway signs JWT with app_role + don_vi.
- Data: Supabase Postgres, RPC-only, SECURITY DEFINER; no RLS. Tenant/role checks in SQL via JWT claims.
- Key RPCs: equipment_list/get/create/update/delete; repair_request_list/get/create/update/approve/complete/delete; transfers/maintenance RPCs planned.
- Important files: src/app/api/rpc/[fn]/route.ts; src/app/(app)/repair-requests/page.tsx; supabase/migrations/.
- Conventions: lowercase role strings; cast claims to correct types; whitelist sorting in SQL; avoid UI-side tenant filtering.
- Build: npm run dev; lint/typecheck scripts available.
- Current branch: feat/multi-tenant.