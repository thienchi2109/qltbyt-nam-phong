# CLAUDE.md

AI assistant guidance for this repository (medical equipment management system).

<!-- OPENSPEC:START -->
## OpenSpec Instructions

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning/proposals/specs/changes
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and requires authoritative spec before coding

<!-- OPENSPEC:END -->

## Superpowers System

<EXTREMELY_IMPORTANT>
Before any other command, run:
- WSL: `node ~/.codex/superpowers/.codex/superpowers-codex bootstrap`
- Git Bash/PowerShell/CMD: `~/.codex/superpowers/.codex/superpowers-codex bootstrap`
</EXTREMELY_IMPORTANT>

## Session Completion Workflow

**MANDATORY when ending work session:**
1. File issues for remaining work
2. Run quality gates (tests, linters, builds) if code changed
3. Update issue status
4. **PUSH TO REMOTE** (MANDATORY):
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. Clean up (stashes, prune branches)
6. Verify all changes committed AND pushed
7. Hand off context for next session

**CRITICAL**: Work is NOT complete until `git push` succeeds. NEVER stop before pushing. YOU must push, not the user.

## Project Overview

Vietnamese Medical Equipment Management System - Multi-tenant healthcare app. Next.js 15, React 18, TypeScript, Supabase (PostgreSQL), NextAuth v4.

**Critical**: Security-sensitive with strict multi-tenant isolation.

### Technology Stack

**Core**: Next.js 15.3.3 (App Router, Turbopack) • React 18.3.1 • TypeScript 5.x (strict) • Tailwind CSS 3.x • Radix UI (42 components) • shadcn/ui

**State**: TanStack Query v5 (server state) • NextAuth v4 (auth/sessions) • React Context (language, branding, realtime)

**Backend**: Supabase (PostgreSQL + PostgREST, 154 migrations) • Custom RPC Gateway (tenant isolation)

**Key Libraries**: react-hook-form + zod • Recharts • react-window • lucide-react • date-fns • qrcode.react • html5-qrcode • xlsx • next-pwa • workbox • firebase (FCM, Drive)

**Deploy**: Vercel (primary) • Cloudflare Pages (edge)

## Commands

```bash
# Dev
npm run dev              # Dev server (port 3000, Turbopack)
npm run dev-https        # HTTPS dev (port 9002)
npm run typecheck        # TypeScript check (REQUIRED before commits)

# Build
npm run build            # Standard build
npm run build:vercel     # Vercel build
npm run build:cloudflare # Cloudflare build

# Deploy
npm start                # Production server
npm run deploy:dual      # Deploy to Vercel + Cloudflare

# Quality
npm run lint             # ESLint (no Prettier)
```

**Notes**: 
- `npm run typecheck` mandatory before commits
- Use `npm` only (NOT pnpm/yarn)
- No test runner configured (sample tests in `src/lib/__tests__/`)

## Key Features

**Equipment**: CRUD • QR generation/scanning • Lifecycle tracking • Attachments • Bulk import • Advanced filtering (tenant/dept/category/status)

**Maintenance**: Preventive scheduling • Task management • Calendar view • Frequency-based planning • Completion tracking • History/reports

**Repairs**: Request creation/tracking • Multi-level approval • Status tracking • Technician assignment • History/analytics • Frequency insights

**Transfers**: Internal (dept-to-dept) + External (tenant-to-tenant) • Approval workflows • Kanban board • Audit trail

**Users**: RBAC (5 roles: global, regional_leader, to_qltb, technician, user) • Multi-tenant assignments • Department restrictions

**Reports**: Status distribution • Maintenance stats • Usage analytics • Inventory • Dept performance • Custom date ranges

**Audit**: Activity logs (global only) • Equipment history • User action tracking

**Multi-Tenant**: Strict isolation • Tenant-aware queries • Tenant switching (global/regional) • Per-tenant branding • Regional leader access (multi-tenant within region)

**PWA**: Offline caching • Mobile-first responsive • QR scanner • Firebase Cloud Messaging (repair/transfer/maintenance notifications)

## Architecture

### Multi-Tenant Security Model

**RPC-Only Architecture**: All DB access via `/api/rpc/[fn]` proxy. Direct table access PROHIBITED.

**Isolation Flow**:
1. NextAuth auth → `authenticate_user_dual_mode` RPC
2. JWT includes: `role`, `don_vi` (tenant), `dia_ban_id` (region), `user_id`
3. Proxy validates session, signs JWT with `SUPABASE_JWT_SECRET`
4. **Non-global users**: Proxy forcibly overrides `p_don_vi` to user's tenant
5. RPC functions enforce boundaries via JWT claims

**Roles**: `global` (all tenants) • `regional_leader` (multi-tenant in region) • `to_qltb` (equipment team) • `technician` (dept-restricted) • `user` (basic)

### Authentication

**NextAuth v4** (NOT custom auth)
- Config: `src/auth/config.ts` (JWT, 3hr sessions)
- Routes: `src/middleware.ts` protects `/(app)/*`
- Session: JWT includes `{id, username, role, khoa_phong, don_vi, dia_ban_id, full_name}`
- Auto-refresh validates `password_changed_at`
- Access: `useSession()` from `next-auth/react`

### RPC Gateway (`/api/rpc/[fn]`)

**Critical Security**: `src/app/api/rpc/[fn]/route.ts`

**Client**: `callRpc({ fn: 'function_name', args: {...} })` from `@/lib/rpc-client.ts`

**Flow**:
1. Whitelist check (`ALLOWED_FUNCTIONS`)
2. Session validation (`getServerSession`)
3. Role normalization (`admin` → `global`)
4. **Tenant isolation**: Overwrites `p_don_vi` for non-global/non-regional
5. Signs JWT: `{role: 'authenticated', app_role, don_vi, user_id, dia_ban}`
6. Proxies to Supabase PostgREST `/rest/v1/rpc/{fn}`

**Adding RPC Functions**:
1. Add to `ALLOWED_FUNCTIONS`
2. Include role/tenant checks: `current_setting('request.jwt.claims')`
3. Grant: `GRANT EXECUTE ON FUNCTION fn TO authenticated;`
4. **Always prefer RPC over direct table access**

**100+ Functions**: Equipment, Repairs, Transfers, Maintenance, Tenants/Users, Reports, Usage Logs, Auth

### File Structure

```
src/                        # 222 TypeScript files
├── app/(app)/              # Protected routes
│   ├── activity-logs/, dashboard/, equipment/, forms/, maintenance/
│   ├── qr-scanner/, repair-requests/, reports/, tenants/, transfers/, users/
│   └── layout.tsx
├── app/api/
│   ├── auth/[...nextauth]/ # NextAuth endpoints
│   ├── rpc/[fn]/           # **CRITICAL** RPC gateway (100+ functions)
│   └── tenants/, transfers/
├── auth/config.ts          # NextAuth JWT config
├── components/             # 117+ components (activity-logs, admin, dashboard, equipment, ui/42 Radix)
├── contexts/               # language, realtime, tenant-branding
├── hooks/                  # 25 hooks (cached, dashboard, realtime, repair/transfer alerts)
├── lib/                    # **rpc-client.ts**, supabase.ts, excel-utils, firebase, etc.
├── providers/              # query-provider, session-provider
├── types/                  # database, next-auth, next-pwa
└── middleware.ts           # Route protection

supabase/
├── functions/              # Edge functions (FCM, push notifications)
└── migrations/             # 154 SQL migrations (timestamped)

scripts/                    # build-cloudflare.js, deploy-dual.js, setup-cicd.js
docs/                       # 111+ docs (Deployment, Issues, security, session-notes)
openspec/                   # 60+ files (specs, changes)
public/                     # PWA assets (icons, manifest, sw, workbox)
```

### Database Schema

**Core**: `nhan_vien` (users) • `don_vi` (tenants) • `dia_ban` (regions) • `thiet_bi` (equipment) • `khoa_phong` (departments) • `loai_thiet_bi` (categories) • `nha_cung_cap` (suppliers)

**Workflows**: `yeu_cau_sua_chua` (repairs) • `ke_hoach_bao_tri` (maintenance plans) • `nhiem_vu_bao_tri` (tasks) • `yeu_cau_luan_chuyen` (transfers) • `lich_su_thiet_bi` (equipment history) • `lich_su_hoat_dong` (activity logs)

**Lookups**: `trang_thai_sua_chua`, `muc_do_uu_tien`, `tan_suat_bao_tri` + enumeration tables

**No RLS**: Security via RPC functions with role/tenant checks.

**154 Migrations** (2024-12 to 2025-11): Initial schema → Multi-tenant → Regional leader → Maintenance → Analytics → Performance

### Data Fetching

**TanStack Query v5 ONLY** - NEVER use useState for server data.

```typescript
import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

const { data, isLoading, error } = useQuery({
  queryKey: ['equipment', { don_vi: currentTenant }],
  queryFn: () => callRpc({ fn: 'equipment_list', args: { p_don_vi: currentTenant } }),
  enabled: !!currentTenant
})
```

**Notes**: Equipment list doesn't fetch until tenant selected (global users) • `callRpc` wraps `/api/rpc/[fn]`

### Conventions

**Imports**: Always `@/*` alias. Order: React/Next → 3rd-party → `@/components` → `@/lib` → `@/types`. No relative imports beyond `./`

**TypeScript**: NEVER `any` • Explicit types for public interfaces • Return types required • DB types in `src/types/database.ts`

**UI**: Radix UI + Tailwind (no inline styles unless dynamic) • Mobile-first • react-hook-form + zod • stopPropagation on row actions

## Database Operations

### Migration Workflow

**Run SQL in Supabase SQL Editor** (no CLI). Keep idempotent.

1. Analyze schema (MCP Supabase tools)
2. Create: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
3. Format: Transaction wrapper, rollback, comments
4. Idempotent: `CREATE OR REPLACE`, `IF NOT EXISTS`
5. Grant: `GRANT EXECUTE ON FUNCTION fn TO authenticated;`
6. Whitelist: Add to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
7. Commit to `supabase/migrations/`
8. Apply manually in SQL Editor (NEVER auto-execute)

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

## Security Rules

**NEVER**: Direct DB access • Trust client `p_don_vi` • Use `any` • Modify `src/auth/config.ts` without instruction • Store secrets client-side • Bypass tenant checks • `@ts-ignore` • Commit `console.log`

**Multi-Tenancy**: Filter by `current_don_vi` • Validate tenant access • Check `session.don_vi` • Override `p_don_vi` in proxy

**Errors**: Parse `error.details` as JSON • Return `NextResponse.json({error, details?})` • Log with context • Fail fast

## Deployment

**Vercel** (primary, Node.js routes) • **Cloudflare Pages** (edge, static export)

Node.js APIs: `export const runtime = 'nodejs'`

**Env** (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_MIDDLEWARE_ENABLED=true`

## Testing

Jest-style tests in `src/lib/__tests__/`, `src/app/(app)/transfers/__tests__/` (no runner configured). Test: multi-tenant isolation • error scenarios • RPC auth • tenant filtering. **Always `npm run typecheck` before commits.**

## Performance

TanStack Query with cache keys • Memoize expensive computations • Loading states • Defer image loading • Cache tenants/lookups

**Equipment Page (Global)**: No fetch until tenant selected (reduce DB load). Tip shown. Last selection in `localStorage:equipment_tenant_filter`

## Vietnamese Support

Primary UI: Vietnamese • Medical terminology • Vietnam timezone (Asia/Ho_Chi_Minh)

## Priority Hierarchy

1. Security (auth, isolation) 2. Data Integrity 3. Type Safety 4. Performance 5. Maintainability 6. Features

## Common Pitfalls

1. Forgetting `ALLOWED_FUNCTIONS` whitelist
2. Direct Supabase access (use `/api/rpc/[fn]`)
3. Trusting client `p_don_vi` (proxy overwrites)
4. Missing role checks in RPC SQL
5. Using `any` type
6. Relative imports (use `@/*`)
7. Skipping typecheck

## Documentation

**111+ files**: `README.md` (Vietnamese) • `CLAUDE.md` (this) • `AGENTS.md` (consolidated here) • `OPENSPEC_TRANSFER_KANBAN_FIX.md`

**docs/**: Deployment • Future-tasks • Issues • security • session-notes • schema • fixes • archive
**openspec/**: 60+ files (project.md, specs/, changes/)

## Additional Notes

**PWA**: Production only • Service worker (`public/sw.js`) • Workbox • FCM • Icons (192/512/maskable)
**QR**: Generation + scanning (`qrcode.react`, `html5-qrcode`)
**Excel**: `src/lib/excel-utils.ts`
**Audit**: `lich_su_hoat_dong` (global only)
**Realtime**: Supabase channels (`use-realtime-*.ts`)
**Firebase**: FCM, Google Drive
**Caching**: `advanced-cache-manager.ts`
**Feature Flags**: `feature-flags.ts`

## Key Files

**Critical**: `src/app/api/rpc/[fn]/route.ts` (RPC proxy) • `src/lib/rpc-client.ts` • `src/auth/config.ts` • `src/middleware.ts`
**Config**: `next.config.ts` • `tailwind.config.ts` • `.env.local`
**DB**: `supabase/migrations/**` • `src/types/database.ts`
**Scripts**: `build-cloudflare.js` • `deploy-dual.js`
**AI Rules**: `.github/copilot-instructions.md` • `.cursor/rules/cursor-rules.mdc` • `CLAUDE.md` (this)

## IDE & Tooling

**AI Configs**: Copilot (`.github/copilot-instructions.md`) • Cursor (`.cursor/rules/cursor-rules.mdc`) • Claude (`CLAUDE.md`)

**VSCode** (`.vscode/`): settings.json, tasks.json, extensions.json, mcp.json
**Extensions**: ESLint • Tailwind IntelliSense • TypeScript • Prisma • GitLens

**Dev Setup**: npm (NOT pnpm/yarn) • Node 18.17+ • Supabase cloud (no CLI) • Ports: 3000 (HTTP), 9002 (HTTPS)

**Scripts**: build-cloudflare.js • deploy-dual.js • setup-cicd.js
**CI/CD**: `.github/workflows/` (deploy-dual.yml, preview-deploy.yml)
