# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vietnamese Medical Equipment Management System (Hệ thống quản lý thiết bị y tế) - A multi-tenant web application for healthcare institutions in Vietnam. Built with Next.js 15, React 18, TypeScript, Supabase (PostgreSQL), and NextAuth v4.

**Critical**: This is a security-sensitive healthcare application with strict multi-tenant isolation requirements.

### Technology Stack

**Frontend**:
- **Next.js 15.3.3** - App Router with Turbopack
- **React 18.3.1** - UI library
- **TypeScript 5.x** - Strict mode enabled
- **Tailwind CSS 3.x** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives (42 components)
- **shadcn/ui** - Component library built on Radix + Tailwind

**State Management**:
- **TanStack Query v5** (React Query) - Server state management
- **NextAuth v4** - Authentication and session management
- React Context API - Global state (language, branding, realtime)

**Backend & Database**:
- **Supabase** - PostgreSQL database + PostgREST
- **PostgreSQL** - Relational database (154 migrations)
- Custom RPC Gateway - Tenant isolation and security

**Data Visualization**:
- **Recharts** - Charts and analytics
- **react-window** - Virtualized lists for performance

**Forms & Validation**:
- **react-hook-form** - Form state management
- **zod** - Schema validation

**UI Utilities**:
- **lucide-react** - Icon library
- **date-fns** - Date/time manipulation
- **class-variance-authority** - Component variant management
- **clsx** / **tailwind-merge** - Conditional class names

**QR Code**:
- **qrcode.react** - QR code generation
- **html5-qrcode** - QR code scanning

**Excel Export**:
- **xlsx** - Excel file generation

**PWA**:
- **next-pwa** - Progressive Web App support
- **workbox** - Service worker caching

**Firebase**:
- **firebase** - Cloud Messaging for push notifications
- Google Drive integration

**Development Tools**:
- **ESLint** - Code linting
- **TypeScript** - Type checking
- **Vercel** - Primary deployment
- **Cloudflare Pages** - Edge deployment

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

## Key Features

### Core Functionality

**Equipment Management**:
- CRUD operations for medical equipment
- QR code generation and scanning for equipment tracking
- Equipment lifecycle tracking (purchase, maintenance, repair, transfer, retirement)
- Equipment attachments and documentation
- Bulk import capabilities
- Advanced filtering by tenant, department, category, status

**Maintenance Planning**:
- Preventive maintenance scheduling
- Maintenance task management
- Maintenance calendar view
- Frequency-based planning (daily, weekly, monthly, yearly)
- Maintenance completion tracking
- Maintenance history and reports

**Repair Workflows**:
- Repair request creation and tracking
- Multi-level approval process
- Repair status tracking (pending, approved, in-progress, completed)
- Repair history and analytics
- Technician assignment
- Repair frequency insights

**Transfer Management**:
- Internal transfers (between departments within same tenant)
- External transfers (between different tenants)
- Transfer approval workflows
- Transfer status tracking (pending, approved, completed)
- Kanban board for transfer visualization
- Transfer history and audit trail

**User Management**:
- Role-based access control (global, regional_leader, to_qltb, technician, user)
- Multi-tenant user assignments
- User-tenant membership management
- Department-level access restrictions

**Reports & Analytics**:
- Equipment status distribution
- Maintenance reports and statistics
- Usage analytics
- Inventory reports
- Department performance metrics
- Repair frequency insights
- Custom date range filtering

**Audit Logging**:
- Activity logs for all administrative actions (global users only)
- Equipment history tracking
- User action tracking
- Comprehensive audit trail

### Multi-Tenant Features

**Tenant Isolation**:
- Strict data separation between organizational units
- Tenant-aware filtering on all queries
- Tenant switching for global/regional users
- Tenant-specific branding and configuration

**Regional Leader Access**:
- Multi-tenant access within assigned region (dia_ban)
- Cross-tenant visibility for regional oversight
- Regional reporting and analytics

**Tenant Management**:
- Tenant creation and configuration
- User-tenant membership management
- Tenant branding customization
- Tenant-specific settings

### Progressive Web App (PWA)

**Offline Capabilities**:
- Service worker for offline caching
- Workbox caching strategies
- Offline-first architecture for critical features

**Mobile Experience**:
- Responsive mobile-first design
- PWA install prompts
- Mobile-optimized forms and print templates
- QR code scanner for mobile devices

**Push Notifications**:
- Firebase Cloud Messaging integration
- Repair request alerts
- Transfer approval notifications
- Maintenance reminders

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

**Current RPC Functions (100+)**:
- **Equipment**: list, get, create, update, delete, count, attachments, history, bulk import, filters, aggregates
- **Repairs**: list, get, create, update, approve, complete, delete, status counts, alerts
- **Transfers**: list, create, update, delete, complete, history, external returns, status counts, kanban operations
- **Maintenance**: plans (CRUD, approve, reject), tasks (CRUD, bulk insert, complete), stats, reports, calendar
- **Tenants/Users**: list, create, update, memberships, set current tenant, user hierarchy, RBAC checks
- **Reports**: status distribution, usage analytics, audit logs, inventory reports, maintenance reports
- **Usage Logs**: list, session start/end, delete
- **Authentication**: authenticate_user_dual_mode, password management, session validation

### File Structure

```
src/                        # 222 TypeScript files total
├── app/
│   ├── (app)/              # Protected routes (requires auth)
│   │   ├── activity-logs/  # Audit logs (global users only)
│   │   ├── dashboard/      # Dashboard with KPIs, charts, maintenance calendar
│   │   │   └── components/ # Dashboard-specific components
│   │   ├── equipment/      # Equipment CRUD, QR codes, filters
│   │   ├── forms/          # Print templates (handover, maintenance, repair)
│   │   │   ├── handover/, handover-demo/, handover-template/
│   │   │   ├── handover-update/, log-template/, login-template/
│   │   │   ├── maintenance/, maintenance-form/, repair-result/
│   │   ├── maintenance/    # Maintenance planning & task management
│   │   ├── qr-scanner/     # QR code scanner for equipment lookup
│   │   ├── repair-requests/ # Repair workflow with approval process
│   │   │   └── _components/
│   │   ├── reports/        # Analytics, exports, charts
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   ├── tenants/        # Tenant switching (global/regional only)
│   │   ├── transfers/      # Equipment transfer workflows (internal + external)
│   │   │   └── __tests__/  # Transfer history tests
│   │   ├── users/          # User management
│   │   └── layout.tsx      # App layout with navigation
│   │
│   ├── api/                # API Routes
│   │   ├── auth/[...nextauth]/ # NextAuth v4 endpoints
│   │   ├── rpc/[fn]/       # **CRITICAL** - RPC proxy gateway (100+ functions)
│   │   ├── tenants/
│   │   │   ├── memberships/ # User-tenant membership API
│   │   │   └── switch/      # Tenant switching API
│   │   └── transfers/
│   │       ├── counts/      # Transfer status counts
│   │       ├── list/        # Transfer list API
│   │       └── legacy-adapter.ts
│   │
│   ├── globals.css         # Global Tailwind styles
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Login page (24KB comprehensive)
│
├── auth/
│   └── config.ts           # NextAuth v4 configuration (JWT strategy)
│
├── components/             # 117+ React components
│   ├── activity-logs/      # Audit log viewer
│   ├── admin/              # User management components
│   ├── dashboard/          # KPI cards, tables, tabs
│   ├── equipment/          # Equipment filters, tenant selector
│   ├── summary/            # Summary bar
│   ├── transfers/          # Transfer cards, badges, kanban
│   └── ui/                 # 42 Radix UI + Tailwind primitives
│       ├── accordion, alert-dialog, avatar, badge, button
│       ├── calendar, card, chart, checkbox, dialog
│       ├── dropdown-menu, form, input, select, sheet
│       ├── table, tabs, toast, tooltip, popover
│       └── ... (complete Radix UI component library)
│
├── contexts/               # React Contexts
│   ├── auth-context.tsx.backup  # Legacy auth (replaced by NextAuth)
│   ├── language-context.tsx
│   ├── realtime-context.tsx
│   └── tenant-branding-provider.tsx
│
├── hooks/                  # 25 Custom React Hooks
│   ├── use-audit-logs.ts
│   ├── use-cached-equipment.ts, use-cached-lookups.ts
│   ├── use-dashboard-stats.ts, use-department-performance.ts
│   ├── use-equipment-distribution.ts
│   ├── use-realtime-*.ts (debug, query, subscription, sync)
│   ├── use-repair-alerts.ts, use-transfer-alerts.ts
│   ├── use-tenant-branding.ts
│   └── useFacilityFilter.ts, useTransferDataGrid.ts
│
├── lib/                    # Utility Libraries
│   ├── __tests__/          # Jest-style unit tests
│   │   ├── audit_logs_utils.spec.ts
│   │   └── department-utils.test.ts
│   ├── advanced-cache-manager.ts
│   ├── chart-utils.ts, data.ts
│   ├── database-index-checker.ts
│   ├── department-utils.ts, equipment-utils.ts
│   ├── excel-utils.ts      # Excel export functionality
│   ├── feature-flags.ts
│   ├── firebase.ts, firebase-utils.tsx
│   ├── query-utils.ts
│   ├── rpc-client.ts       # **CRITICAL** - RPC proxy client
│   ├── supabase.ts         # Supabase client (minimal direct use)
│   └── utils.ts            # General utilities (cn, etc.)
│
├── providers/
│   ├── query-provider.tsx  # TanStack Query provider
│   └── session-provider.tsx # NextAuth session provider
│
├── types/
│   ├── database.ts         # Database type definitions
│   ├── next-auth.d.ts      # NextAuth session types
│   ├── next-pwa.d.ts
│   └── transfers-data-grid.ts
│
└── middleware.ts           # Route protection (NextAuth)

supabase/
├── functions/              # Edge Functions
│   ├── _shared/
│   │   ├── cors.ts
│   │   └── google-auth.ts
│   ├── save-fcm-token/     # Firebase Cloud Messaging
│   └── send-push-notification/ # Push notifications
└── migrations/             # 154 SQL migration files (timestamped)
    └── YYYYMMDDHHMMSS_description.sql

scripts/                    # Build & DevOps automation (10+ files)
├── build-cloudflare.js     # Cloudflare Pages build orchestration
├── deploy-dual.js          # Dual deployment (Vercel + Cloudflare)
├── setup-cicd.js           # CI/CD pipeline setup
├── devops-workflow.ps1     # DevOps PowerShell workflow
└── local-dev.ps1           # Local development setup

docs/                       # 111+ documentation files
├── Deployment/             # Deployment guides
├── Future-tasks/           # Roadmap and planned features
├── Issues/                 # Issue tracking and resolutions
├── Kanban-Transfer/        # Transfer kanban documentation
├── Local_development_setup/ # Development environment setup
├── Maintenance-page-improvements/ # Maintenance UI enhancements
├── Regional-leader-role/   # Regional leader implementation
├── Repair-request-filtering-issues/ # Bug fixes
├── Reports-RBAC/           # Reports role-based access control
├── archive/                # Archived documentation
├── fixes/                  # Bug fix documentation
├── schema/                 # Database schema documentation
├── security/               # Security reviews and vulnerability fixes
└── session-notes/          # Development session notes

openspec/                   # 60+ OpenSpec files
├── project.md              # Project overview
├── specs/                  # Feature specifications
└── changes/                # Change proposals and implementations

public/                     # Static assets & PWA files
├── icons/                  # PWA icons (192x192, 512x512, maskable)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── workbox-*.js            # Workbox caching
└── firebase-messaging-sw.js # Firebase messaging service worker
```

### Database Schema (Key Tables)

**Core Tables**:
- `nhan_vien` - User accounts (username, password hash, role, don_vi, current_don_vi)
- `don_vi` - Organizational units (tenants)
- `dia_ban` - Regions for regional_leader access
- `thiet_bi` - Equipment records with full lifecycle tracking
- `khoa_phong` - Departments within tenants
- `loai_thiet_bi` - Equipment categories
- `nha_cung_cap` - Suppliers/vendors

**Workflow Tables**:
- `yeu_cau_sua_chua` - Repair requests with approval workflow
- `ke_hoach_bao_tri` - Maintenance plans (scheduled preventive maintenance)
- `nhiem_vu_bao_tri` - Maintenance tasks
- `yeu_cau_luan_chuyen` - Transfer requests (internal between departments + external to other tenants)
- `lich_su_thiet_bi` - Equipment history/audit trail
- `lich_su_hoat_dong` - Activity logs (global audit trail)

**Lookup/Configuration Tables**:
- `trang_thai_sua_chua` - Repair status definitions
- `muc_do_uu_tien` - Priority levels
- `tan_suat_bao_tri` - Maintenance frequency definitions
- Various enumeration tables for status tracking

**No RLS (Row-Level Security)**: Security enforced entirely through RPC functions with role/tenant checks.

**Database Migration History (154 Files)**:
- **2024-12-20 to 2024-12-29**: Initial schema (users, transfers, equipment, indexes)
- **2025-09-14 to 2025-09-17**: Multi-tenant phase 1, equipment list enhancements, tenant config
- **2025-09-18 to 2025-09-30**: Regional leader role, reports RBAC, equipment updates, Google Drive integration
- **2025-10-04 to 2025-10-13**: Regional leader fixes, maintenance plans, repair frequency insights
- **2025-10-25 to 2025-11-06**: Date range filters, status filters, transfer data grid, tenant checks

**Migration Categories**:
- Authentication & Security (JWT claims, password management, role enforcement)
- Multi-tenant Infrastructure (tenant filtering, regional leader access)
- Equipment Management (CRUD RPCs, indexes, filters, aggregates)
- Maintenance & Repairs (planning, tasks, reports)
- Transfers (internal, external, kanban, status tracking)
- Reports & Analytics (inventory, maintenance, usage analytics)
- Audit Logs (v2 entities, instrumentation)
- Performance Optimizations (indexes on FKs, query optimization)

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

**Test Framework**: Jest-style (no test runner currently configured)

**Existing Test Files**:
- `src/lib/__tests__/audit_logs_utils.spec.ts` - Audit log utility tests
- `src/lib/__tests__/department-utils.test.ts` - Department utility tests
- `src/app/(app)/transfers/__tests__/transfer-history.test.ts` - Transfer history tests

**Testing Strategy**:
- Test multi-tenant isolation with different roles
- Test error scenarios, not just happy paths
- Test RPC function authorization and tenant filtering
- Test data transformations and business logic in utilities
- **Always run `npm run typecheck` before committing**

**Future Test Runner**: When test runner is added (e.g., Vitest), use pattern-based execution:
```bash
vitest src/lib/__tests__/department-utils.test.ts -t "specific test case"
```

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

## Documentation Structure

The repository contains extensive documentation (111+ markdown files) organized by topic:

**Primary Documentation**:
- **`README.md`** - Main project readme (Vietnamese)
- **`CLAUDE.md`** - This file - comprehensive AI assistant guidance
- **`AGENTS.md`** - AI agent guidelines
- **`OPENSPEC_TRANSFER_KANBAN_FIX.md`** - Transfer kanban implementation (25KB)

**`docs/` Directory**:
- **`Deployment/`** - Deployment guides and procedures
- **`Future-tasks/`** - Roadmap and planned features
- **`Issues/`** - Issue tracking, bug reports, and resolutions
- **`Kanban-Transfer/`** - Transfer kanban feature documentation
- **`Local_development_setup/`** - Development environment setup
- **`Maintenance-page-improvements/`** - Maintenance UI enhancements
- **`Regional-leader-role/`** - Regional leader implementation docs
- **`Repair-request-filtering-issues/`** - Bug fixes for repair request filters
- **`Reports-RBAC/`** - Reports role-based access control
- **`archive/`** - Archived documentation (historical reference)
- **`fixes/`** - Bug fix documentation and post-mortems
- **`legacy-html-templates/`** - Legacy HTML form templates
- **`schema/`** - Database schema documentation
- **`security/`** - Security reviews and vulnerability fixes
- **`session-notes/`** - Development session notes and decisions

**`openspec/` Directory (60+ files)**:
- **`project.md`** - Project overview
- **`specs/`** - Feature specifications and requirements
- **`changes/`** - Change proposals and implementation logs
- Covers: Repair request filtering, transfer refactoring, reports redesign, mobile improvements

**When to Consult Documentation**:
- Before implementing new features (check `docs/Future-tasks/`)
- When fixing bugs (check `docs/Issues/` and `docs/fixes/`)
- For security changes (review `docs/security/`)
- Understanding past decisions (review `docs/session-notes/`)
- Database changes (consult `docs/schema/`)

## Additional Notes

- **PWA Features**: Enabled in production (disabled in dev) via `next-pwa` in `next.config.ts`
  - Service worker for offline caching in `public/sw.js`
  - Workbox for advanced caching strategies
  - Firebase Cloud Messaging for push notifications
  - PWA icons (192x192, 512x512, maskable variants)
- **QR Code System**: Generation and scanning for equipment tracking
- **Excel Export**: Utilities in `src/lib/excel-utils.ts` for report downloads
- **Audit Logging**: Administrative actions logged (global users only) via `lich_su_hoat_dong` table
- **Real-time Features**: Supabase channels available (use with caution) - hooks in `src/hooks/use-realtime-*.ts`
- **Firebase Integration**: FCM tokens, push notifications, Google Drive integration
- **Advanced Caching**: Multi-layer caching strategy in `src/lib/advanced-cache-manager.ts`
- **Feature Flags**: Controlled via `src/lib/feature-flags.ts`

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

## Tooling & IDE Configuration

### AI Assistant Rules

This project has comprehensive AI assistant configurations for multiple tools:

**GitHub Copilot** (`.github/copilot-instructions.md`):
- RPC-first data access patterns
- Tenant/role JWT claims usage
- Idempotent migration practices
- MCP database tool integration
- NextAuth v4 patterns (NOT custom auth)

**Cursor** (`.cursor/rules/cursor-rules.mdc`):
- Security-first development
- Token-efficient responses
- Project convention supremacy
- Strict TypeScript enforcement
- Multi-tenant isolation patterns

**Claude Code** (`CLAUDE.md` - this file):
- Comprehensive architecture guidance
- Security rules and tenant isolation
- RPC gateway patterns
- Database migration workflows
- Testing and deployment procedures

### IDE Configurations

**Visual Studio Code** (`.vscode/`):
- **`settings.json`** - Editor settings (TypeScript, ESLint, formatting)
- **`tasks.json`** - Build and dev server tasks
- **`extensions.json`** - Recommended extensions (ESLint, Tailwind, Prisma)
- **`mcp.json`** - Model Context Protocol configuration for Supabase integration

**IDX Environment** (`.idx/dev.nix`):
- Google IDX development environment configuration
- Nix-based package management
- Pre-configured development shell

**Recommended Extensions**:
- ESLint for code quality
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features
- Prisma (for database schema inspection)
- GitLens (for git history)

### Development Environment Setup

**Package Manager**: npm (NOT pnpm or yarn)

**Node.js Version**: Compatible with Next.js 15 (Node 18.17 or higher)

**Database Access**:
- Supabase PostgreSQL (cloud-hosted)
- No local Supabase CLI required
- Migrations run manually via Supabase SQL Editor

**Environment Files**:
- `.env.local` - Local development (gitignored)
- `.env.example` - Template with required variables

**Port Configuration**:
- Development HTTP: 3000 (default)
- Development HTTPS: 9002 (`npm run dev-https`)

### Build & Deployment Tools

**Scripts Available**:
- `scripts/build-cloudflare.js` - Cloudflare Pages build
- `scripts/deploy-dual.js` - Dual deployment automation
- `scripts/setup-cicd.js` - CI/CD pipeline setup
- `scripts/devops-workflow.ps1` - PowerShell DevOps workflow
- `scripts/local-dev.ps1` - Local development setup

**GitHub Actions** (`.github/workflows/`):
- `deploy-dual.yml` - Automated dual deployment
- `preview-deploy.yml` - PR preview deployments

**Deployment Targets**:
- **Vercel**: Primary deployment (automatic via git push)
- **Cloudflare Pages**: Secondary deployment (edge optimization)
