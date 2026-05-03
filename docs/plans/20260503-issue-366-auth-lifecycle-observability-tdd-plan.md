# 20260503 — Issue #366 Auth Lifecycle Observability TDD Plan

## Summary
- Goal: implement structured auth lifecycle logging + persistent audit for critical events in issue `#366`.
- Locked constraints:
  - Persist critical events to DB.
  - Keep 3 signout reasons: `user_initiated`, `session_expired`, `forced_password_change`.
  - Force signout right after successful password change.
  - Use dedicated `public.auth_audit_log` (not `audit_logs`).

## Blast Radius (GitNexus + repo check)
- `src/auth/config.ts`: highest risk (`authorize`, `jwt`, `session`), imported by auth route and multiple API routes.
- `src/app/(app)/_components/AppLayoutShell.tsx`: signout triggers (menu + unauthenticated path).
- `src/components/change-password-dialog.tsx`: password-change success path currently no forced-signout logging contract.
- `src/app/_components/LoginForm.tsx`: login submit flow.
- Primary tests to extend:
  - `src/auth/__tests__/auth-config.jwt-rpc.test.ts`
  - `src/auth/__tests__/auth-config.jwt-cooldown.test.ts`
  - `src/app/(app)/__tests__/AppLayoutShell.test.tsx`

## Emission Channel Matrix
| Event | Emit channel | DB sink caller |
|---|---|---|
| `login_failure`, `tenant_inactive` | `authorize()` server | server-only sink |
| `login_success` | NextAuth `events.signIn` server | server-only sink |
| `token_invalidated_password_change`, `profile_refresh_failed` | `jwt` callback server | server-only sink |
| `signout`, `forced_signout` | client intent + server-side write endpoint before `signOut()` | server-only sink |

- Decision notes:
  - Keep DB writes server-side only; client never calls PostgREST audit function directly.
  - Use an idempotency key for signout-intent endpoint to avoid duplicate writes in race conditions.
  - `LoginForm.tsx` is not a DB write path anymore; only UX/error surface.

## API / Data Contract Changes
- Step 0 (pre-RED): extract sanitizer to shared module `src/lib/log-sanitizer.ts` and reuse in RPC proxy + auth logger.
- Add `public.auth_audit_log`:
  - Core: `id`, `created_at`, `event`, `reason_code`, `signout_reason`, `user_id`, `username`, `tenant_id`, `request_id`, `trace_id`, `source`, `metadata`.
  - For brute-force investigation: `ip_address inet null`, `user_agent text null` (truncate safe length).
  - Constraints:
    - `source` check enum: `authorize | jwt_callback | events_signin | signout_intent`.
    - `reason_code` check enum: `invalid_credentials | rpc_error | tenant_inactive | authorize_exception | config_error`.
- Add `public.auth_audit_log_insert(...)`:
  - `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
  - Fail-safe (never changes auth behavior if insert fails).
  - Grant **only** `service_role`; revoke `PUBLIC` and do not grant `authenticated`.
- Indexing:
  - BRIN on `created_at`.
  - BTREE `(user_id, created_at desc)` and `(event, created_at desc)`.
- Retention:
  - Add retention policy in same rollout if small/safe; otherwise open follow-up issue before implementation completes.

## TDD Execution Plan
1. RED: logger contract tests:
   - one structured JSON line per event.
   - deep redaction for nested sensitive keys (`password`, `token`, `secret`, `mat_khau`, etc.).
2. RED: `auth-config.jwt-rpc.test.ts`:
   - `authorize` emits `login_failure` with `reason_code` for `invalid_credentials`, `rpc_error`, `authorize_exception`.
   - tenant inactive emits `tenant_inactive`.
   - missing Supabase env maps to `login_failure` + `reason_code=config_error`.
3. RED: `auth-config.jwt-cooldown.test.ts`:
   - `token_invalidated_password_change`, `profile_refresh_failed` emitted correctly.
   - DB sink down still does not break auth flow (best-effort guarantee).
4. RED: signout dedup tests in `AppLayoutShell.test.tsx` (+ new focused tests if needed):
   - user menu signout => one `signout/user_initiated`.
   - session-expired path => one `forced_signout/session_expired`.
   - password-change flow => one `forced_signout/forced_password_change`, no ghost `session_expired`.
5. RED: correlation tests:
   - request carries `x-request-id` => event includes it.
   - missing header => `request_id` is `null`.
6. GREEN:
   - implement shared logger + server-only sink.
   - wire `authorize`, `jwt`, `events.signIn`, and signout-intent server endpoint.
   - keep `change-password-dialog` immediate signout behavior, routed through signout-intent endpoint.
   - update `scripts/test_session_management.md` with new debug fields and event examples.

## Scope Clarifications
- Issue reference “dia_ban lookup failure” is stale against current `src/auth/config.ts`; keep out of scope for #366 and note explicitly in implementation PR.
- `tenant_id` stays `text` for multi-tenant context compatibility; coercion rules documented in logger helper.
- Enforce `unknown` + narrowing for logger payload types (`no any`).

## Verification
1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused auth/signout tests
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

## Assumptions
- Migration name follows ordered timestamp convention: `YYYYMMDDHHMMSS_auth_audit_log_*.sql`.
- Correlation fields are optional when headers are unavailable.
- If retention DDL increases risk/scope, a follow-up issue is opened before merge.
