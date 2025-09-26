# Project State Snapshot (qltbyt-nam-phong) — 2025-09-26

## Tech stack & architecture
- Next.js (App Router), React, TypeScript
- Tailwind CSS + Radix UI (custom wrappers in `src/components/ui`)
- Auth: NextAuth
- Data: Supabase via RPC-only access (no direct table reads/writes)
- State/query: @tanstack/react-query
- Realtime: custom providers/hooks (RealtimeProvider)
- PWA bits present (install prompt, status)
- Path alias: `@/*`

## Key modules
- Maintenance module
  - Hooks in `src/hooks/use-cached-maintenance.ts` (plans, schedules, mutations) use RPCs defined in Supabase SQL migrations (e.g., `maintenance_plan_*`, `maintenance_tasks_*`).
  - UI in `src/app/(app)/maintenance/page.tsx`, dialogs in `src/components/*maintenance*-dialog.tsx`.
  - Current behavior: realtime sync disabled/commented to avoid conflicts with RealtimeProvider.
- Activity Logs
  - Viewer: `src/components/activity-logs/activity-logs-viewer.tsx`
  - Hooks: `use-audit-logs*` (server data).

## Recent fixes (committed)
1) Mobile dialog/dropdown layering (critical)
   - Issue: on mobile, Select/Dropdown content rendered behind dialog overlay; sometimes black strip behind dialog.
   - Fix: explicit stacking order
     - Dialog overlay: `z-[999]`
     - Dialog content: `z-[1000]`
     - Select/Dropdown portals: `z-[1001]`
   - Scoped mobile animation overrides in `globals.css` to `[data-radix-dialog-content]` only so Radix Select isn’t affected.
   - Removed z-50 baked into dialog content classes; content now uses explicit `z-[1000]`.
   - Made `AddMaintenancePlanDialog` loai_cong_viec Select controlled (`value={field.value}`).
   - Files touched: `src/components/ui/dialog.tsx`, `src/components/ui/select.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/app/globals.css`, `src/components/add-maintenance-plan-dialog.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/maintenance/page.tsx`.

2) Activity logs search null guards (P1)
   - Issue: `admin_full_name` can be NULL from `audit_logs_list_v2`, causing `.toLowerCase()` crash during client-side filtering.
   - Fix: coalesce nullable fields before lowercasing in `activity-logs-viewer.tsx`.
   - Safe fields: `admin_username`, `admin_full_name`, `target_username`, `target_full_name`.

## Conventions & rules (must follow)
- RPC proxy for all database operations; whitelist and RLS/tenant validation enforced per project rules.
- Multi-tenancy: filter by current tenant, validate role permissions.
- TypeScript strict: no `any`, explicit types/returns.
- UI: Tailwind-only styling, Radix components from `src/components/ui`.
- Imports: use `@/*` alias; keep grouping order.

## Tooling status
- `npm run typecheck` passes.
- ESLint not installed/configured (Next.js `next lint` fails). Consider adding ESLint later; currently relying on TS + conventions.

## Branch & commit context
- Current branch: `feat/new_role`.
- Commits include: mobile dialog/dropdown layering fix, logs search guard, debug cleanup.

## Operational notes
- Mobile-safe CSS overrides exist; when adding new overlays/portals, respect the z-index scheme above.
- Realtime interactions around maintenance page are cautious; if re-enabling, ensure no double subscriptions with RealtimeProvider.

## Useful paths
- Maintenance: `src/app/(app)/maintenance/page.tsx`, `src/components/*maintenance*-dialog.tsx`, `src/hooks/use-cached-maintenance.ts`, `supabase/migrations/*maintenance*`
- Activity logs: `src/components/activity-logs/activity-logs-viewer.tsx`, `src/hooks/use-audit-logs*`
- UI primitives: `src/components/ui/*`
- Providers: `src/providers/*`, `src/contexts/*`

## Commands
- Dev: `npm run dev`
- Typecheck: `npm run typecheck`

This snapshot reflects the project state after resolving mobile dialog/dropdown issues and the activity logs search guard, ensuring consistent mobile UX and resilient client-side filtering.