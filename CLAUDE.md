# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vietnamese Medical Equipment Management System (Hệ thống quản lý thiết bị y tế) - A multi-tenant web application for healthcare institutions in Vietnam. Built with Next.js 15, React 18, TypeScript, Supabase (PostgreSQL), and NextAuth v4.

**Critical**: This is a security-sensitive healthcare application with strict multi-tenant isolation requirements.

## Commands

### Development
```bash
npm run dev              # Start dev server with Turbopack (port 3000)
npm run dev-https        # Start dev server with HTTPS (port 9002)
npm run typecheck        # TypeScript type checking (REQUIRED before commits)
```

### Building
```bash
npm run build            # Standard Next.js build
npm run build:vercel     # Build for Vercel deployment
npm run build:cloudflare # Build for Cloudflare Pages (uses scripts/build-cloudflare.js)
```

### Production & Deployment
```bash
npm start                # Start production server
npm run start:cloudflare # Start on Cloudflare Workers
npm run cf:preview       # Preview Cloudflare build locally
npm run deploy:cloudflare # Deploy to Cloudflare Pages
npm run deploy:dual      # Deploy to both Vercel and Cloudflare (orchestrates dual deployment)
```

### Code Quality
```bash
npm run typecheck        # Check TypeScript errors
npm run lint             # ESLint (no Prettier - follow existing file style)
```

### Testing
No test runner currently configured. Sample unit tests exist in `src/lib/__tests__/` (Jest-style). When test runner is added, use pattern-based single test execution (e.g., `vitest src/lib/__tests__/department-utils.test.ts -t "case"`).

**Note**: `npm run typecheck` is mandatory before committing. Use `npm` as package manager (NOT pnpm or yarn).

## Architecture

### Multi-Tenant Security Model

**RPC-Only Architecture**: All database access goes through Supabase RPC functions via `/api/rpc/[fn]` proxy. Direct table access is strictly prohibited.

**Tenant Isolation Flow**:
1. User authenticates via NextAuth (credentials provider)
2. NextAuth calls `authenticate_user_dual_mode` RPC
3. JWT token includes: `role`, `don_vi` (tenant ID), `dia_ban_id` (region), `user_id`
4. `/api/rpc/[fn]` proxy validates session and signs JWT with `SUPABASE_JWT_SECRET`
5. For non-global users, proxy forcibly overrides `p_don_vi` parameter to user's tenant
6. RPC functions enforce tenant boundaries using JWT claims

**Role Hierarchy**:
- `global` - Full system access across all tenants (includes legacy `admin`)
- `regional_leader` - Multi-tenant access within assigned region (`dia_ban`)
- `to_qltb` - Equipment management team (single tenant)
- `technician` - Technical staff (single tenant, department-restricted)
- `user` - Basic access (single tenant)

### Authentication Architecture

**NextAuth v4 (NOT custom auth context)**

Key files:
- `src/auth/config.ts` - NextAuth configuration with JWT strategy (3-hour sessions)
- `src/middleware.ts` - Route protection for `/(app)/*` routes
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth endpoints

**Session Management**:
- JWT-based sessions (3-hour expiry)
- Auto-refresh checks `password_changed_at` to invalidate sessions on password change
- Session includes: `id`, `username`, `role`, `khoa_phong`, `don_vi`, `dia_ban_id`, `full_name`
- Access session via: `useSession()` hook from `next-auth/react`

### RPC Gateway (`/api/rpc/[fn]`)

**Critical Security Component**: `src/app/api/rpc/[fn]/route.ts`

Client calls: `callRpc({ fn: 'function_name', args: {...} })` from `@/lib/rpc-client.ts`

**Proxy Flow**:
1. Validates function name against `ALLOWED_FUNCTIONS` whitelist
2. Retrieves session via `getServerSession(authOptions)`
3. Extracts and normalizes role (`admin` → `global`, lowercase)
4. **Enforces tenant isolation**: **Sanitizes `p_don_vi`** - overwrites parameter for non-global/non-regional users with their `session.don_vi`
5. Signs JWT with claims: `{role: 'authenticated', app_role, don_vi, user_id, dia_ban}` using `SUPABASE_JWT_SECRET`
6. Proxies request to Supabase PostgREST `/rest/v1/rpc/{fn}` with signed JWT
7. Returns response or error with detailed logging

**When adding new RPC functions**:
1. Add function name to `ALLOWED_FUNCTIONS` Set in `/api/rpc/[fn]/route.ts`
2. Ensure function includes role/tenant checks in SQL using `current_setting('request.jwt.claims')`
3. Grant execute permission: `GRANT EXECUTE ON FUNCTION function_name TO authenticated;`
4. **Prefer RPC over direct table access** - this is a core architectural principle

### File Structure

```
src/
├── app/
│   ├── (app)/              # Protected routes (requires auth)
│   │   ├── dashboard/      # Dashboard with KPIs
│   │   ├── equipment/      # Equipment CRUD + QR codes
│   │   ├── maintenance/    # Maintenance planning
│   │   ├── repair-requests/ # Repair workflow
│   │   ├── transfers/      # Equipment transfers (including external)
│   │   ├── users/          # User management
│   │   ├── tenants/        # Tenant switching (global/regional only)
│   │   ├── reports/        # Analytics and exports
│   │   ├── qr-scanner/     # QR code scanner
│   │   ├── activity-logs/  # Audit logs (global only)
│   │   └── layout.tsx      # App layout with navigation
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth endpoints
│   │   ├── rpc/[fn]/       # RPC proxy gateway (CRITICAL)
│   │   └── tenants/        # Tenant switching API
│   ├── globals.css
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Login page
├── auth/
│   └── config.ts           # NextAuth configuration
├── components/             # Reusable UI (Radix UI + Tailwind)
├── hooks/                  # Custom React hooks
├── lib/
│   ├── rpc-client.ts       # Client-side RPC helper
│   ├── supabase.ts         # Supabase client (minimal use)
│   ├── utils.ts            # General utilities
│   └── __tests__/          # Test files
├── types/
│   ├── database.ts         # Database types
│   └── next-auth.d.ts      # NextAuth session types
└── middleware.ts           # Route protection (NextAuth)

supabase/
└── migrations/             # SQL migrations (timestamped)
    └── YYYYMMDDHHMMSS_description.sql
```

### Database Schema (Key Tables)

- `nhan_vien` - User accounts (username, password hash, role, don_vi, current_don_vi)
- `don_vi` - Organizational units (tenants)
- `dia_ban` - Regions for regional_leader access
- `thiet_bi` - Equipment records
- `yeu_cau_sua_chua` - Repair requests
- `ke_hoach_bao_tri` - Maintenance plans
- `yeu_cau_luan_chuyen` - Transfer requests (internal + external)
- `lich_su_thiet_bi` - Equipment history/audit trail

**No RLS (Row-Level Security)**: Security enforced entirely through RPC functions with role/tenant checks.

### Data Fetching Pattern

**TanStack Query (React Query v5)** for all client-side data fetching. **NEVER use useState for server data** - always use React Query for server state management.

```typescript
import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

const { data, isLoading, error } = useQuery({
  queryKey: ['equipment', { don_vi: currentTenant }],
  queryFn: () => callRpc({
    fn: 'equipment_list',
    args: { p_don_vi: currentTenant }
  }),
  enabled: !!currentTenant, // Gate queries on tenant selection
})
```

**Important**:
- Equipment list for global/admin users doesn't fetch until tenant filter selected (prevents overwhelming initial load)
- RPC client (`src/lib/rpc-client.ts`) throws Error with best-effort JSON message parsing
- Use `callRpc` helper from `@/lib/rpc-client` - it wraps `/api/rpc/[fn]` proxy calls

### Import Conventions

**ALWAYS use `@/*` alias for internal imports**. Group imports in order:
1. React/Next.js core
2. Third-party libraries
3. Internal components (`@/components`)
4. Internal utilities (`@/lib`)
5. Types (`@/types`)

Never use relative imports beyond `./` (same directory only).

### TypeScript Standards

- **NEVER use `any`** - find or create proper types
- Export explicit types for all public interfaces
- Define return types for all functions
- All database types in `src/types/database.ts`

### UI Component Architecture

- **Base**: Radix UI primitives in `src/components/ui/`
- **Styling**: Tailwind CSS only (no inline styles unless dynamic) - see `tailwind.config.ts`, `postcss.config.mjs`
- **Responsive**: Mobile-first with list/card layouts
- **Forms**: react-hook-form + zod validation
- **Event Handling**: **stopPropagation on row action buttons** to prevent accidental opens of parent elements
- **PWA Helpers**: Components like `pwa-install-prompt`, `realtime-status` for Progressive Web App features
- **Tenant Switching**: `src/components/tenant-switcher.tsx` for global/regional users

## Database Operations

### Migration Workflow

**Important**: Authors run SQL directly in Supabase SQL Editor (no Supabase CLI). Keep migrations idempotent and commit for history.

1. **Analyze**: Use MCP Supabase tools to inspect current schema
2. **Create**: Write migration in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. **Format**: Include transaction wrapper, rollback procedures, comments
4. **Idempotent**: Use `CREATE OR REPLACE`, `IF NOT EXISTS`, etc. - safe to run multiple times
5. **Grant**: Add `GRANT EXECUTE ON FUNCTION function_name TO authenticated;`
6. **Whitelist**: Add function name to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
7. **Commit**: Commit SQL file to `supabase/migrations/` for history
8. **Apply**: Run manually in Supabase SQL Editor (NEVER auto-execute via MCP for security)

### RPC Function Template

```sql
CREATE OR REPLACE FUNCTION function_name(
  p_param1 TYPE,
  p_don_vi TEXT DEFAULT NULL
)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Hardening
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi TEXT;
BEGIN
  -- Extract JWT claims
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';

  -- Validate permissions
  IF v_user_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Enforce tenant isolation for non-global users
  IF v_user_role != 'global' AND v_user_role != 'regional_leader' THEN
    p_don_vi := v_user_don_vi; -- Override client-supplied parameter
  END IF;

  -- Business logic here
  RETURN ...;
END;
$$;

GRANT EXECUTE ON FUNCTION function_name TO authenticated;
```

## Critical Security Rules

### Prohibited Actions

**NEVER**:
- Access Supabase tables directly without RPC proxy
- Trust client-supplied `p_don_vi` from non-global users
- Use `any` TypeScript type
- Create files outside established structure
- Modify `src/auth/config.ts` without explicit instruction
- Store sensitive data in client-side code
- Bypass tenant isolation checks
- Ignore TypeScript errors with `@ts-ignore`
- Commit `console.log` statements to production

### Multi-Tenancy Enforcement

- **Filter** all queries by `current_don_vi` for non-global users
- **Validate** tenant access in both RPC functions and API routes
- **Check** `session.don_vi` matches requested resource tenant
- **Override** `p_don_vi` parameter in RPC proxy for non-global users

### Error Handling

- Parse `error.details` from RPC client as JSON
- Return `NextResponse.json({ error: string, details?: any })` from API routes
- Log errors with context for debugging
- Validate input early, fail fast

## Deployment

### Dual Deployment (Vercel + Cloudflare)

**Vercel**: Preferred for Node.js API routes
**Cloudflare Pages**: Static export with edge functions

When using Node.js-specific APIs, add: `export const runtime = 'nodejs'`

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
AUTH_SECRET=
NEXTAUTH_SECRET=
AUTH_MIDDLEWARE_ENABLED=true
```

## Testing

- Test files in `src/lib/__tests__/`
- Test multi-tenant isolation with different roles
- Test error scenarios, not just happy paths
- Run `npm run typecheck` before committing

## Equipment Page Behavior (Global/Admin)

To reduce initial DB load, equipment list doesn't fetch until tenant selected in filter. Shows tip: "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị". Last tenant selection remembered in `localStorage` key: `equipment_tenant_filter`.

## Performance Optimization

- Use TanStack Query for all data fetching with proper cache keys
- Memoize expensive computations (charts, large lists)
- Implement loading states for all async operations
- Defer image loading (unoptimized for Cloudflare Workers)
- Cache tenant lists and frequently accessed data

## Vietnamese Language Support

- Primary UI language: Vietnamese
- Medical terminology localization
- Date/time formatting for Vietnam timezone (Asia/Ho_Chi_Minh)
- Maintain Vietnamese strings in all user-facing text

## Priority Hierarchy (When Rules Conflict)

1. **Security** - Never compromise authentication or data isolation
2. **Data Integrity** - Maintain consistency and validation
3. **Type Safety** - Enforce TypeScript strict mode
4. **Performance** - Optimize for user experience
5. **Maintainability** - Follow established patterns
6. **Features** - Implement new functionality

## Common Pitfalls

1. **Forgetting to add function to ALLOWED_FUNCTIONS**: New RPC functions must be whitelisted
2. **Direct Supabase access**: ALWAYS go through `/api/rpc/[fn]` proxy
3. **Trusting client tenant params**: Proxy overwrites `p_don_vi` for non-global users
4. **Missing role checks in SQL**: Every RPC must validate `app_role` from JWT claims
5. **Using `any` type**: Find or create proper TypeScript types
6. **Relative imports**: Use `@/*` alias instead
7. **Skipping typecheck**: Run `npm run typecheck` before commits

## Additional Notes

- PWA features enabled in production (disabled in dev) - configured via `next-pwa` in `next.config.ts`
- Service worker for offline caching in `public/sw.js`
- QR code generation and scanning for equipment tracking
- Excel export utilities in `src/lib/excel-utils.ts`
- Audit logging for administrative actions (global users only)
- Real-time subscriptions available via Supabase channels (use with caution) - components in `src/hooks/use-realtime-*.ts`

## Important Files Reference

Key files for understanding the system:
- `next.config.ts` - Next.js configuration with PWA, dual deployment, Cloudflare compatibility
- `src/auth/config.ts` - NextAuth configuration with JWT strategy and session management
- `src/app/api/rpc/[fn]/route.ts` - **CRITICAL**: RPC proxy with tenant isolation and security
- `src/middleware.ts` - Route protection for `/(app)` routes using NextAuth
- `src/lib/rpc-client.ts` - Client-side RPC helper
- `src/lib/supabase.ts` - Supabase client (minimal direct use - prefer RPC proxy)
- `supabase/migrations/**` - Database migrations (timestamped, idempotent)
- `scripts/build-cloudflare.js` - Cloudflare build orchestration
- `scripts/deploy-dual.js` - Dual deployment orchestration
- `.github/copilot-instructions.md` - Copilot rules (RPC-first, tenant isolation, migrations)
- `.cursor/rules/cursor-rules.mdc` - Cursor rules (security-first, token efficiency, conventions)
- `docs/**` - Additional project documentation

## Tooling & IDE Rules

This project has comprehensive AI assistant rules:
- **Copilot**: `.github/copilot-instructions.md` - RPC-first data access, tenant/role claims, idempotent migrations, MCP database tool usage
- **Cursor**: `.cursor/rules/cursor-rules.mdc` - Security-first, token-efficient responses, project convention supremacy, strict TypeScript
