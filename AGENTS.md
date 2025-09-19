# AGENTS

- Build/lint/type: npm run dev | npm run dev-https | npm run build | npm run build:cloudflare | npm run typecheck | npm run lint; Preview/Deploy: npm run cf:preview | npm run deploy:dual; No test script configured; single-test N/A (sample tests live under src/lib/__tests__).
- Framework: Next.js 15 (App Router) + TypeScript + Tailwind + Radix; entry at src/app, layouts under src/app/(app)/layout.tsx, styles in src/app/globals.css; UI primitives in src/components.
- Auth: NextAuth with Credentials provider in src/auth/config.ts; JWT strategy; session exposes role, don_vi; middleware guard in src/middleware.ts protects /(app) routes.
- Data: Supabase Postgres via PostgREST RPC; client in src/lib/supabase.ts; app calls RPC through Next API proxy src/app/api/rpc/[fn]/route.ts with SUPABASE_JWT_SECRET-signed claims (role→app_role, don_vi, user_id); whitelist ALLOWED_FUNCTIONS enforced.
- Multi-tenant model: tenants public.don_vi; users nhan_vien with current_don_vi; roles include global, to_qltb, technician, user; tenant switching UI in src/components/tenant-switcher.tsx; related APIs in src/app/api/tenants/**.
- DB migrations: Author runs SQL directly in Supabase SQL Editor (no Supabase CLI). Keep migrations idempotent; commit SQL under supabase/migrations/** for history; GRANT EXECUTE to authenticated.
- Cloud/devops: Dual target (Vercel/Cloudflare). next.config.ts enables PWA, export mode for Cloudflare on CLOUDFLARE_WORKERS; scripts/build-cloudflare.js and scripts/deploy-dual.js orchestrate builds/deploys.
- Conventions: prefer supabase.rpc(...) via proxy over direct table access; put new features behind SQL RPCs with server-side tenant/role checks; keep JWT claims in sync (role, don_vi) after auth changes.
- Imports/paths: use TS path alias @/* (see tsconfig.json paths); keep modules colocated under src/*; avoid deep relative paths.
- Types: strict TypeScript (tsconfig strict: true); avoid any; export explicit types; keep server/client boundaries clear; mark runtime in API routes when needed (export const runtime = 'nodejs').
- Error handling: rpc-client throws Error with best effort JSON message; API proxy returns NextResponse.json with {error} on non-OK; prefer early returns and safe parsing.
- UI patterns: stopPropagation on row action buttons to avoid accidental opens; responsive lists/cards; PWA helpers in components (pwa-install-prompt, realtime-status, etc.).
- Performance: use @tanstack/react-query for async/data; memoize heavy charts; defer images (next/image unoptimized when CLOUDFLARE_WORKERS true).
- Lint/format: next lint; no Prettier config committed—follow existing file style; Tailwind via class utilities (see tailwind.config.ts, postcss.config.mjs).
- Security: never trust client headers for role/tenant; derive from server session; sanitize p_don_vi for non-global users in proxy; keep SUPABASE_* secrets set.
- Testing: no runner configured; example unit tests under src/lib/__tests__/ (Jest-style); wire up Jest/Vitest before relying on CI tests; typecheck excludes tests by default.
- Important files: next.config.ts | src/auth/config.ts | src/app/api/rpc/[fn]/route.ts | src/middleware.ts | src/lib/rpc-client.ts | supabase/migrations/** | docs/**.
- Tooling rules present: Copilot rules in .github/copilot-instructions.md (build/run, RPC-first data, tenant/role claims, idempotent migrations). No Cursor/Claude/Windsurf/Cline/Goose rules found.
- How to run a single test later: once a test runner exists, prefer pattern-based single test (e.g., vitest src/lib/__tests__/department-utils.test.ts -t "case"); add npm test script accordingly.

