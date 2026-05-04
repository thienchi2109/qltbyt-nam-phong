# 20260503 — Issue #366 Backend-First Roadmap

## Summary
- Umbrella issue: `#366`
- Goal: add structured auth lifecycle logging and optional persistent audit trail without widening auth blast radius.
- Delivery rule: split into independently mergeable PR-sized batches. No batch may leave auth behavior broken while waiting for a later batch.
- Chosen order: backend-first. Stabilize server contracts first, then persistence, then frontend wiring and docs.

## Batch Roadmap

### Batch 1 — Backend Foundation and Log Contract
- Scope:
  - Extract shared `src/lib/log-sanitizer.ts` from RPC proxy behavior.
  - Add auth logger helper for structured JSON lines only.
  - Augment NextAuth JWT/session types with `pending_signout_reason`.
  - Lock base event taxonomy, redaction rules, and failure reason taxonomy in tests.
- In scope events:
  - `login_failure`
  - `tenant_inactive`
  - `profile_refresh_failed`
  - logger contract helpers used by later batches
- Out of scope:
  - DB writes
  - frontend `signOut()` wiring
  - `events.signIn` / `events.signOut`
- Mergeability:
  - Safe to merge because it only adds shared backend plumbing and tests.
- TDD focus:
  - single structured log line per event
  - deep redaction for nested sensitive keys
  - `config_error` maps to `login_failure`
  - no explicit `any`

### Batch 2 — Backend Auth Event Emission
- Scope:
  - Wire `authorize`, `jwt`, `events.signIn`, `events.signOut`.
  - Add `pending_signout_reason` propagation through `session.update(...)`.
  - Preserve `pending_signout_reason` when JWT invalidation returns an otherwise empty token.
  - Add request correlation, IP, user-agent, and `session_duration_ms` capture where context exists.
- In scope events:
  - `login_success`
  - `login_failure`
  - `tenant_inactive`
  - `token_invalidated_password_change`
  - `profile_refresh_failed`
  - `signout`
  - `forced_signout`
- Out of scope:
  - persistent DB sink
  - migration / retention work
  - final frontend UX polish
- Mergeability:
  - Safe to merge because all event emission stays server-first and falls back to stdout only.
- TDD focus:
  - `events.signIn` emits `login_success` with lowercased username and no secrets
  - `events.signOut` maps reason correctly or falls back to `session_expired`
  - `session.update(...) -> events.signOut` propagation chain
  - `await session.update(...)` before `signOut()`
  - probe/no-session signout does not emit DB sink event
  - password-change invalidation preserves `pending_signout_reason`

### Batch 3 — Persistent Auth Audit Sink
- Scope:
  - Add `public.auth_audit_log`.
  - Add `public.auth_audit_log_insert(...)` with `SECURITY DEFINER`, `SET search_path = public, pg_temp`, fail-safe behavior.
  - Service-role-only DB sink from Next server.
  - Add minimal indexes required for forensic queries.
- Schema contract:
  - Core fields: `id`, `created_at`, `event`, `reason_code`, `signout_reason`, `user_id`, `username`, `tenant_id`, `request_id`, `trace_id`, `source`, `metadata`
  - For brute-force investigation: `ip_address inet null`, `user_agent text null`
  - `source` enum: `authorize | jwt_callback | events_signin | events_signout`
  - `reason_code` enum: `invalid_credentials | rpc_error | tenant_inactive | authorize_exception | config_error`
  - Metadata soft taxonomy: `attempt_count`, `failed_rpc_code`, `session_duration_ms`, `previous_don_vi`, `user_agent_family`
- Mergeability:
  - Safe to merge because persistence is best-effort and must never change auth outcome if insert fails.
- TDD focus:
  - DB sink down still leaves stdout logging and auth behavior intact
  - service-role-only sink path
  - BRIN `created_at`
  - BTREE `(user_id, created_at desc)` and `(event, created_at desc)`

### Batch 4 — Frontend Wiring, Correlation Hardening, and Docs
- Scope:
  - Wire user-triggered signout reason propagation in `AppLayoutShell` and `change-password-dialog`.
  - Ensure password-change success toast remains visible before forced signout.
  - Update `scripts/test_session_management.md`.
  - Final correlation/documentation hardening and closeout verification.
- Frontend contract:
  - User-initiated and forced-password-change flows call `await session.update(...)` before `signOut()`.
  - `LoginForm.tsx` remains UX-only by default; only revisit if tests expose a `config_error` UX gap.
- Mergeability:
  - Safe to merge because it consumes already-stable backend/event contracts from Batches 1-3.
- TDD focus:
  - one `forced_signout/forced_password_change` on password change path
  - no ghost `session_expired`
  - cross-tab behavior documented: non-initiating tabs may emit `session_expired`, correlated via `token_invalidated_password_change`
  - request id prefers `x-request-id`, then `x-vercel-id`, then `null`

## Shared Technical Decisions
- DB writes are server-side only. Client code never calls PostgREST audit functions directly.
- `events.signOut` reads `pending_signout_reason` from token and falls back to `session_expired` if missing.
- If `password_changed_at > loginTime`, preserve `pending_signout_reason` instead of returning a fully empty token object.
- Guard against signout probe noise: if `events.signOut` has neither identity nor pending reason, skip DB sink emit.
- `session.update(...)` before `signOut()` can trigger one extra JWT refresh/RPC. Accept this unless telemetry proves it noisy enough to optimize.
- Request / header capture:
  - `authorize(..., req)` reads `x-request-id`, `x-forwarded-for`, and `user-agent` directly.
  - `jwt` / `events.*` try `headers().get('x-request-id')`, then `headers().get('x-vercel-id')`, plus the same IP / UA headers; otherwise store `null`.
- `events.signOut` computes `session_duration_ms = now - token.loginTime` when `loginTime` exists.
- `tenant_id` stays `text` for multi-tenant compatibility.
- `dia_ban lookup failure` from the original issue text is stale against current code and stays out of scope.

## Tracking Model
- `#366` remains the umbrella tracker.
- Child issues:
  - `#376` — Batch 1: backend foundation and log contract
  - `#377` — Batch 2: backend auth event emission and signout reason propagation
  - `#378` — Batch 3: persistent auth audit sink
  - `#379` — Batch 4: frontend signout wiring, docs, and closeout
- If retention is not safely included in Batch 4, open one explicit follow-up issue before merging Batch 4.
- After each batch:
  - update `#366` with status + PR link
  - update the next batch issue if assumptions changed
  - save one concise Memori note with durable progress, gotchas, and verification

## Verification Order
1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run typecheck`
3. Focused auth / signout tests for the current batch
4. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

## Constraints
- Migration apply path for execution must use Supabase MCP `apply_migration`, not Supabase CLI.
- Each batch PR must be independently mergeable and deploy-safe.

## Assumptions
- Migration names follow `YYYYMMDDHHMMSS_auth_audit_log_*.sql`.
- Correlation fields may legitimately be `null` when callback context does not expose headers.
- If retention DDL is deferred, the follow-up issue must be linked in the umbrella and final PR before closeout.
