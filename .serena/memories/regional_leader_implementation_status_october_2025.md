# Regional Leader Role Implementation Status - October 2025

## Current Branch: `feat/regional_leader`

## Project Overview
Medical equipment management system (QUẢN LÝ THIẾT BỊ Y TẾ) for Vietnamese healthcare facilities. Multi-tenant SaaS with region-based hierarchy, role-based access control, and PWA capabilities.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript + Tailwind + Radix UI
- **Auth**: NextAuth (JWT) with role/don_vi/dia_ban claims
- **Database**: Supabase Postgres via PostgREST RPC (proxy-only access)
- **Deployment**: Dual-target (Vercel + Cloudflare Workers)
- **State**: @tanstack/react-query for server state management
- **Build**: npm run typecheck (SKIP lint per project rule)

## Regional Leader Role Status

### ✅ COMPLETED (Phases 1-4)
1. **Schema Foundation (DM-1)**: `dia_ban` table created, `dia_ban_id` FK on `don_vi`/`nhan_vien`
2. **Claims Propagation (AUTH-1)**: JWT includes `dia_ban`, NextAuth session exposes it
3. **RPC Read Enforcement (RPC-1)**: `allowed_don_vi_for_session()` helper function filters all read RPCs by region
4. **Write Blocking**: All write RPCs (repairs, transfers, maintenance) hard-fail for `regional_leader`

### ✅ RECENT FIXES (October 5, 2025)
1. **React Hooks Violation**: Fixed TenantSelector early return before hooks (moved after all useMemo/useEffect)
2. **Facility Filter Bug**: Added `selectedDonVi` to React Query cache key + pagination reset on facility change
3. **Dashboard KPI Filtering**: All KPI cards (total equipment, maintenance, repairs, plans) now filter by region for regional leaders

### 🔄 IN PROGRESS (Phase 5: API/UI-1)
- **Navigation Guards**: `/users` blocked for regional_leader (middleware + UI)
- **Tenant Switching**: Regional leaders can switch between facilities in their dia_ban
- **UI Filters**: Equipment page facility selector working for regional leaders

### ⏳ PENDING
- **Tenant Dialogs**: Create/update tenant forms need `dia_ban_id` dropdown
- **User Dialogs**: Should remain write-restricted, derive `dia_ban_id` from selected `don_vi`
- **E2E Testing**: Comprehensive QA suite (Phase 6: QA-1)
- **Performance Monitoring**: Dashboard query benchmarks for region-spanning reads

## Role Hierarchy
```
global → Full system access (all regions)
  ↓
regional_leader → Read all facilities in assigned dia_ban (NO write/user mgmt)
  ↓
to_qltb → Manage single facility's equipment
  ↓
technician, user → Limited facility access
```

## Security Model
- **RPC Proxy**: Signs JWT with `app_role`, `don_vi`, `dia_ban`, `user_id` (src/app/api/rpc/[fn]/route.ts)
- **Whitelist**: ALLOWED_FUNCTIONS enforced at proxy layer
- **Tenant Isolation**: Server-side `p_don_vi` sanitization for non-global users
- **Regional Boundaries**: `allowed_don_vi_for_session()` returns permitted facilities array

## Database Patterns
- **Migrations**: Hand-authored SQL (no Supabase CLI), idempotent, run in SQL Editor
- **Indexes**: Covering indexes for `don_vi`, `dia_ban_id`, status filters on high-volume tables
- **RPC Functions**: SECURITY DEFINER with role checks, use `allowed_don_vi_for_session()` for regional filtering
- **Grants**: All RPCs `GRANT EXECUTE ON FUNCTION ... TO authenticated`

## Critical Files
- `src/auth/config.ts` - NextAuth with JWT callbacks (role, don_vi, dia_ban)
- `src/app/api/rpc/[fn]/route.ts` - RPC proxy with JWT signing + sanitization
- `src/middleware.ts` - Route guards for /(app)
- `src/components/equipment/tenant-selector.tsx` - Facility dropdown for regional leaders
- `src/hooks/use-dashboard-stats.ts` - KPI hooks with role/region cache keys
- `supabase/migrations/20251005*.sql` - Regional leader filtering migrations

## Known Issues & Conventions
- **Skip Lint**: Project rule - only run typecheck, skip `npm run lint`
- **No Test Runner**: Example tests exist but no Jest/Vitest configured yet
- **Dual Deployment**: Cloudflare Workers requires `export const runtime = 'nodejs'` for Node APIs
- **Image Optimization**: Disabled for Cloudflare (unoptimized: true)
- **Branding**: Global/admin see equipment owner's tenant branding (privileged mode)

## Next Development Steps
1. Add `dia_ban_id` dropdown to tenant create/update dialogs
2. Validate role assignments client-side (block regional_leader from user mgmt)
3. Extend equipment filters to other pages (repairs, transfers, maintenance)
4. Write E2E tests for regional leader scenarios
5. Monitor production query performance for region-spanning reads

## Documentation Locations
- `docs/regional-leader-role-plan.md` - Full implementation plan
- `docs/regional-leader-facility-filter-fix-2025-10-05.md` - Recent bug fixes
- `docs/database-optimization-status.md` - Index coverage report
- `docs/blueprint.md` - Original app requirements
- `.github/copilot-instructions.md` - Agent workflow rules
- `AGENTS.md` - Quick reference for tooling/conventions
