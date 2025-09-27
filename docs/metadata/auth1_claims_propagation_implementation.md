# Claims Propagation Implementation (AUTH-1)

## Overview
This document records the implementation work for Phase AUTH-1 of the Regional Leader rollout. The goal is to surface `dia_ban` context through the authentication pipeline so downstream RPCs and UI layers can enforce regional access controls.

## Deliverables Summary ✅
- ✅ `authenticate_user_dual_mode` now returns `don_vi`, `dia_ban_id`, and `dia_ban_ma` alongside authentication metadata.
- ✅ NextAuth credential flow persists `don_vi` and `dia_ban` details in JWT and session payloads with automatic refresh on profile changes.
- ✅ RPC proxy injects `dia_ban` claim into PostgREST JWTs and sanitizes `p_dia_ban` parameters for scoped roles.
- ✅ Type augmentations (`src/types/next-auth.d.ts`) describe custom session/JWT fields for compile-time safety.
- ✅ `npm run typecheck` executed successfully post-change.

## Technical Changes

### 1. Database RPC Enhancements
- **File**: `supabase/migrations/20250927_global_admin_user_management.sql`
  - Added hardened `authenticate_user_dual_mode` definition with:
    - Hashed/plain password verification and suspicious password guard.
    - Tenant and `dia_ban` resolution with active-state checks.
    - Explicit failure states for inactive tenants or missing `dia_ban` on `regional_leader` logins.
  - Returns resolved `don_vi`, `dia_ban_id`, and `dia_ban_ma` to power JWT enrichment.
- **File**: `supabase/migrations/20250927164500_fix_authenticate_user_dia_ban.sql`
  - Re-issued the function with fully-qualified `dia_ban` lookups to resolve an ambiguous column error observed during login smoke tests.

### 2. NextAuth Pipeline Updates
- **File**: `src/auth/config.ts`
  - Credential authorize step captures new RPC fields.
  - JWT callback keeps `don_vi`/`dia_ban` values synchronized, including fallback lookups for legacy records.
  - Session callback exposes `dia_ban` metadata to client components.

### 3. RPC Proxy Claims
- **File**: `src/app/api/rpc/[fn]/route.ts`
  - Supabase JWT claims now include `dia_ban`.
  - Non-global requests have `p_dia_ban` coerced to the caller's assigned region to maintain tenant isolation.

### 4. Type Safety
- **File**: `src/types/next-auth.d.ts`
  - Augments NextAuth `Session` and `JWT` interfaces with custom fields (`don_vi`, `dia_ban_id`, `dia_ban_ma`, etc.).

## Verification & Testing
1. `npm run typecheck` — ✅ no TypeScript errors.
2. Manual smoke checklist (post-deployment recommended):
   - Attempt login with a regional leader whose `dia_ban` is populated → expect success and JWT claim present.
   - Attempt login with a regional leader missing `dia_ban` → expect failure with `missing_dia_ban` mode.
   - Call an RPC via `/api/rpc/*` as regional leader and confirm PostgREST claims includes `dia_ban`.

## Follow-Up Actions
- Update QA scenarios to cover regional leader tenant scoping (pending QA-1 phase).
- Monitor audit logs for `tenant_inactive`, `missing_dia_ban`, or `dia_ban_inactive` authentication modes after release.
- Coordinate with RPC-1 to consume new `dia_ban` claim for multi-tenant reads.
