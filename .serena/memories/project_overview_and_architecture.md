# qltbyt-nam-phong Project Overview

## Project Identity
- **Name**: qltbyt-nam-phong (Vietnamese Medical Equipment Management System)
- **Purpose**: Comprehensive web application for managing medical equipment in healthcare institutions
- **Current Branch**: feat/rpc-enhancement
- **Repository**: thienchi2109/qltbyt-nam-phong

## Technology Stack
- **Framework**: Next.js 15.3.3 (App Router) + React 18.3.1 + TypeScript
- **Database**: Supabase (PostgreSQL) via PostgREST RPC
- **Auth**: NextAuth v4 with JWT strategy (3-hour expiry)
- **UI**: Radix UI + TailwindCSS
- **State**: TanStack Query v5.81.5
- **Deployment**: Dual target (Vercel + Cloudflare Pages)

## Core Architecture

### Authentication System
- **Provider**: NextAuth v4 with CredentialsProvider
- **RPC Function**: `authenticate_user_dual_mode`
- **Session Claims**: role, don_vi (tenant), user_id
- **Protection**: Middleware-based (`src/middleware.ts`)
- **Roles**: global, admin, to_qltb, technician, user, regional_leader

### Data Access Pattern (CRITICAL)
- **ALWAYS** use RPC proxy: `src/app/api/rpc/[fn]/route.ts`
- **NEVER** direct Supabase table access from client/server
- **RPC Functions**: Must be whitelisted in ALLOWED_FUNCTIONS
- **JWT Signing**: SUPABASE_JWT_SECRET signs all RPC calls
- **Claims Mapping**: role → app_role, don_vi, user_id

### Multi-Tenancy Model
- **Tenants**: `public.don_vi` table
- **Users**: `nhan_vien` with `current_don_vi`
- **Isolation**: Tenant filtering enforced in RPC functions
- **UI**: `src/components/tenant-switcher.tsx`
- **APIs**: `src/app/api/tenants/**`

### Database Migration Workflow
- **Author runs SQL** directly in Supabase SQL Editor (no CLI)
- **Commit SQL** under `supabase/migrations/**` for history
- **Idempotent**: All migrations must be safely re-runnable
- **Permissions**: GRANT EXECUTE to authenticated role
- **File Format**: `YYYYMMDDHHMMSS_description.sql`

## File Structure
```
src/
  app/(app)/[feature]/page.tsx    # Pages
  app/api/[feature]/route.ts       # API Routes
  components/[feature]/            # Components
  lib/                             # Utilities
  types/                           # TypeScript types
  auth/config.ts                   # Auth configuration
  middleware.ts                    # Route protection
supabase/migrations/               # SQL migrations
```

## Development Commands
- `npm run dev` / `npm run dev-https` - Local development
- `npm run build` - Standard build
- `npm run build:cloudflare` - Cloudflare Workers build
- `npm run typecheck` - Type checking (MUST pass before commit)
- `npm run lint` - Linting (optional)
- `npm run cf:preview` - Cloudflare preview
- `npm run deploy:dual` - Deploy to both platforms

## Important Conventions
- **Imports**: Use `@/*` alias (not relative paths)
- **Types**: Strict TypeScript, no `any`
- **API Routes**: Mark `export const runtime = 'nodejs'` when needed
- **RPC Functions**: Include tenant validation and role checks
- **Error Handling**: Parse `error.details` as JSON from RPC client
- **UI Patterns**: stopPropagation on row actions, responsive lists/cards

## Security Rules
- Never trust client headers for role/tenant
- Derive from server session only
- Sanitize `p_don_vi` for non-global users
- Keep SUPABASE_* secrets in environment only
- No console.log in production code

## PWA Features
- Service worker: `public/sw.js`
- Manifest: `public/manifest.json`
- Install prompt: `src/components/pwa-install-prompt`
- Realtime status: `src/components/realtime-status`

## Testing
- No test runner configured yet
- Example tests: `src/lib/__tests__/`
- Jest-style expected when configured
