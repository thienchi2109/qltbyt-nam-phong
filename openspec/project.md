# Project Context

Note: CLAUDE.md is the authoritative source for security, architecture, and conventions. This document summarizes and normalizes project expectations for OpenSpec-driven work.

## Purpose
Vietnamese Medical Equipment Management System (Hệ thống quản lý thiết bị y tế) — multi-tenant web application for healthcare institutions in Vietnam. Focused on secure tenant isolation, efficient device lifecycle workflows (inventory, repair, maintenance, transfers), and professional, mobile-friendly UX.

## Tech Stack
- App framework: Next.js 15 (App Router), React 18, TypeScript (strict)
- Styling/UI: Tailwind CSS, Radix UI primitives, lucide-react icons
- Forms/validation: react-hook-form + zod
- Data access: Supabase (PostgreSQL) via PostgREST RPC-only (no direct table access)
- Auth: NextAuth v4 (JWT sessions, ~3 hours), session claims enriched from RPC
- Client data: TanStack Query v5 for all server state
- Dates: date-fns with vi locale; VN timezone handling (Asia/Ho_Chi_Minh)
- PWA: next-pwa (enabled in prod)
- Deployment: Dual (Vercel + Cloudflare Pages/Workers); Node runtime where needed

## Project Conventions

### Code Style
- TypeScript strict; never use `any`; explicit exports and return types
- ESLint only (no Prettier); follow existing file style
- Imports: always use `@/*` alias; grouping order: core → third-party → components → lib → types
- Styling: Tailwind CSS; avoid inline styles unless truly dynamic
- UI events: ensure `stopPropagation` on row/action buttons to prevent unintended parent handlers
- Vietnamese language in all user-facing strings

### Architecture Patterns
- RPC-Only Architecture
  - All DB access goes through Supabase RPC functions via `/api/rpc/[fn]` proxy
  - Whitelist `ALLOWED_FUNCTIONS`; reject unknown function names
  - Proxy signs JWT with `{role: 'authenticated', app_role, don_vi, user_id, dia_ban}` using `SUPABASE_JWT_SECRET`
  - For non-global/non-regional users, proxy forcibly overrides `p_don_vi` from session
  - Every RPC must enforce role/tenant boundaries using `current_setting('request.jwt.claims')`
  - GRANT EXECUTE on functions to `authenticated`
- Roles & Multi-tenancy
  - Roles: `global`, `regional_leader`, `to_qltb`, `technician`, `user` (legacy `admin` → `global`)
  - No database RLS; all isolation enforced in RPC + proxy
- Authentication
  - NextAuth v4 (JWT), 3-hour sessions, auto invalidation on `password_changed_at`
  - Session includes: `id, username, role, khoa_phong, don_vi, dia_ban_id, full_name`
- Data fetching pattern (client)
  - Use TanStack Query with stable `queryKey`s and `callRpc` helper
  - Gate queries by tenant selection for global/regional users where necessary
- UI/Components
  - Base components in `src/components/ui/*` (Radix + Tailwind)
  - Responsive, mobile-first; PWA helpers for prod

### Testing Strategy
- No full test runner yet; sample Jest-style tests in `src/lib/__tests__/`
- Mandatory: `npm run typecheck` before commits/PRs
- Focus areas: multi-tenant isolation (role claims), error scenarios (not only happy paths), RPC client error parsing

### Git Workflow
- Branching: feature branches `feat/<scope>`, fixes `fix/<scope>`, docs `docs/<scope>`, chore `chore/<scope>`
- Commits: Conventional Commit style recommended (e.g., `feat(rr): sticky columns`)
- PRs: prefer PRs over direct pushes; keep atomic and focused
- Required pre-PR checks: `npm run typecheck` and `npm run lint` must pass; avoid committing `console.log` to production
- Migrations: commit SQL files to `supabase/migrations/` for history; apply manually in Supabase SQL Editor (no CLI auto-apply)

## Domain Context
- Core entities (tables):
  - `nhan_vien` (users), `don_vi` (tenants), `dia_ban` (regions)
  - `thiet_bi` (equipment), `yeu_cau_sua_chua` (repair requests)
  - `ke_hoach_bao_tri` (maintenance plans), `yeu_cau_luan_chuyen` (transfers), `lich_su_thiet_bi` (equipment history)
- Key workflows:
  - Repair requests: create → approve (internal/external unit) → complete/not completed → sheet export/printing
  - Maintenance plans: draft → approve → task execution tracking
  - Equipment: CRUD, QR code generation/scanning, attention status
- UX: Vietnamese terminology; dashboard with KPIs; mobile-friendly list/card layouts

## Important Constraints
- Security-first healthcare app with strict tenant isolation
- Absolutely no direct Supabase table access from app code; RPC-only via `/api/rpc/[fn]`
- Never trust client `p_don_vi` (proxy overrides for non-global/regional)
- No RLS; all checks in RPC and API proxy level
- Type safety mandatory; do not bypass with `@ts-ignore`
- Package manager: `npm` only (no pnpm/yarn)
- Environment variables required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `AUTH_MIDDLEWARE_ENABLED`

## External Dependencies
- Supabase (PostgreSQL, PostgREST RPC)
- NextAuth (authentication)
- Vercel (preferred) and Cloudflare (dual deploy); Workers/Pages for edge/static as applicable
- next-pwa (service worker in prod)
- TanStack Query, Radix UI, Tailwind CSS, date-fns, lucide-react
- Utilities: QR code generation/scanning, Excel export helpers (where used)

## References
- Architecture and rules: `CLAUDE.md`
- Critical files:
  - `src/app/api/rpc/[fn]/route.ts` (RPC proxy, security)
  - `src/auth/config.ts`, `src/middleware.ts` (auth + route protection)
  - `src/lib/rpc-client.ts`, `src/lib/supabase.ts`
  - `supabase/migrations/**`
- File structure overview in `CLAUDE.md`
