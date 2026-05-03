# 20260503 — Issue #366 Auth Lifecycle Observability TDD Plan

## Summary
- Goal: implement structured auth lifecycle logging and persistent audit trail for critical auth events in issue `#366`.
- Constraints locked:
  - Persist critical events to DB.
  - Use 3 signout reasons: `user_initiated`, `session_expired`, `forced_password_change`.
  - After successful password change, sign out immediately.
  - DB sink target: new `public.auth_audit_log` table (not `audit_logs`).

## Blast Radius (GitNexus + repo check)
- `src/auth/config.ts`:
  - Main auth lifecycle source (`authorize`, `jwt`, `session` callbacks).
  - Imported by `src/app/api/auth/[...nextauth]/route.ts` and multiple server routes.
  - Highest regression risk; keep behavior unchanged except logging/audit side effects.
- `src/app/(app)/_components/AppLayoutShell.tsx`:
  - Owns current signout triggers from user menu and session-expired flow.
- `src/components/change-password-dialog.tsx`:
  - Password-change success path; currently closes dialog without forced signout.
- `src/app/_components/LoginForm.tsx`:
  - Login submit success/failure UI seam.
- Existing test seams to extend:
  - `src/auth/__tests__/auth-config.jwt-rpc.test.ts`
  - `src/auth/__tests__/auth-config.jwt-cooldown.test.ts`
  - `src/app/(app)/__tests__/AppLayoutShell.test.tsx`

## API / Data Contract Changes
- Add table `public.auth_audit_log` with fields:
  - `id bigserial pk`
  - `created_at timestamptz not null default now()`
  - `event text not null`
  - `reason_code text null`
  - `signout_reason text null`
  - `user_id bigint null`
  - `username text null`
  - `tenant_id text null`
  - `request_id text null`
  - `trace_id text null`
  - `source text not null`
  - `metadata jsonb not null default '{}'::jsonb`
- Add `public.auth_audit_log_insert(...)`:
  - `SECURITY DEFINER`
  - `SET search_path = public, pg_temp`
  - Fail-safe insert (never breaks auth flow)
  - Grants: `authenticated`, `service_role`; revoke `PUBLIC`.
- Logging event taxonomy:
  - `login_success`
  - `login_failure`
  - `tenant_inactive`
  - `token_invalidated_password_change`
  - `signout`
  - `forced_signout`
  - `profile_refresh_failed`
- Sensitive data policy:
  - Never log raw password/token/secret/full DB stack.
  - Redact sensitive keys using shared sanitizer logic reused from RPC proxy behavior.

## TDD Execution Plan
1. RED tests for structured logger:
   - assert single JSON line shape with required keys.
   - assert redaction for sensitive fields.
2. RED tests in `auth-config.jwt-rpc.test.ts`:
   - `authorize` emits correct events + `reason_code` for `invalid_credentials`, `rpc_error`, `tenant_inactive`, `authorize_exception`.
3. RED tests in `auth-config.jwt-cooldown.test.ts`:
   - `token_invalidated_password_change` and `profile_refresh_failed` emit expected structured events.
4. RED tests in `AppLayoutShell.test.tsx`:
   - user menu signout => `signout` + `user_initiated`.
   - session unauthenticated path => `forced_signout` + `session_expired`.
   - no double-log on single exit path.
5. RED tests for change-password flow:
   - successful password change => emits `forced_signout` + `forced_password_change` and calls `signOut`.
6. GREEN implementation:
   - add auth logger helper + DB sink adapter.
   - wire into `config.ts`, `AppLayoutShell.tsx`, `change-password-dialog.tsx`, `LoginForm.tsx`.
   - update `scripts/test_session_management.md` with new debug fields.

## Verification
- Run in this order for TS/React changes:
  1. `node scripts/npm-run.js run verify:no-explicit-any`
  2. `node scripts/npm-run.js run typecheck`
  3. Focused tests for updated suites
  4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

## Assumptions
- Correlation IDs are optional in current paths; when unavailable, keep `request_id`/`trace_id` as `null`.
- Audit sink is best-effort and non-blocking for auth behavior.
- Migration naming must be ordered after existing audit migrations and follow repo SQL safety conventions.
