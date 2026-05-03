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
- `src/app/_components/LoginForm.tsx`: no DB sink writes planned; remains UX-only unless tests reveal gap.
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
| `signout`, `forced_signout` | NextAuth `events.signOut` server | server-only sink |

- Decision notes:
  - Keep DB writes server-side only; client never calls PostgREST audit function directly.
  - Signout reason propagation:
    - User-initiated and forced-password-change flows set `pending_signout_reason` via `session.update(...)` before `signOut()`.
    - `events.signOut` reads token reason and falls back to `session_expired` if missing.
  - This removes the unauthenticated `session_expired` endpoint problem and removes custom idempotency endpoint scope.
  - `LoginForm.tsx` stays UX-only.

## API / Data Contract Changes
- Step 0 (pre-RED): extract sanitizer to shared module `src/lib/log-sanitizer.ts` and reuse in RPC proxy + auth logger.
- Add `public.auth_audit_log`:
  - Core: `id`, `created_at`, `event`, `reason_code`, `signout_reason`, `user_id`, `username`, `tenant_id`, `request_id`, `trace_id`, `source`, `metadata`.
  - For brute-force investigation: `ip_address inet null`, `user_agent text null` (truncate safe length).
  - Constraints:
    - `source` check enum: `authorize | jwt_callback | events_signin | events_signout`.
    - `reason_code` check enum: `invalid_credentials | rpc_error | tenant_inactive | authorize_exception | config_error`.
  - Metadata soft taxonomy (documented contract, no strict CHECK): `attempt_count`, `failed_rpc_code`, `session_duration_ms`, `previous_don_vi`, `user_agent_family`.
- Add `public.auth_audit_log_insert(...)`:
  - `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
  - Fail-safe (never changes auth behavior if insert fails).
  - Grant **only** `service_role`; revoke `PUBLIC` and do not grant `authenticated`.
- Indexing:
  - BRIN on `created_at`.
  - BTREE `(user_id, created_at desc)` and `(event, created_at desc)`.
- Retention:
  - Decide at GREEN:
    - If retention migration is safe/small, include it in same PR.
    - If deferred, open follow-up issue and link it in PR description before merge.

## TDD Execution Plan
1. RED: logger contract tests:
   - one structured JSON line per event.
   - deep redaction for nested sensitive keys (`password`, `token`, `secret`, `mat_khau`, etc.).
2. RED: `auth-config.jwt-rpc.test.ts`:
   - `authorize` emits `login_failure` with `reason_code` for `invalid_credentials`, `rpc_error`, `authorize_exception`.
   - tenant inactive emits `tenant_inactive`.
   - missing Supabase env maps to `login_failure` + `reason_code=config_error`.
3. RED: `events.signIn`/`events.signOut` emission tests:
   - `events.signIn` emits `login_success` with lowercased username and no secrets.
   - `events.signOut` emits exactly one signout event with mapped reason or `session_expired` fallback.
4. RED: `auth-config.jwt-cooldown.test.ts`:
   - `token_invalidated_password_change`, `profile_refresh_failed` emitted correctly.
   - DB sink down still does not break auth flow (best-effort guarantee).
5. RED: signout dedup tests in `AppLayoutShell.test.tsx` (+ new focused tests if needed):
   - user menu signout => one `signout/user_initiated`.
   - session-expired path => one `forced_signout/session_expired`.
   - password-change flow => one `forced_signout/forced_password_change`, no ghost `session_expired`.
6. RED: correlation tests:
   - request carries `x-request-id` => event includes it.
   - missing header => `request_id` is `null`.
7. GREEN:
   - implement shared logger + server-only sink.
   - wire `authorize`, `jwt`, `events.signIn`, `events.signOut`.
   - implement pending-reason propagation via `session.update(...)` before `signOut()` in user-triggered flows.
   - keep password-change UX: success toast must be visible before forced signout (short delay or redirected message).
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
- If retention DDL increases risk/scope, a follow-up issue is opened and linked in PR before merge.
- Migration apply path for execution phase must use Supabase MCP (`apply_migration`), not Supabase CLI.
