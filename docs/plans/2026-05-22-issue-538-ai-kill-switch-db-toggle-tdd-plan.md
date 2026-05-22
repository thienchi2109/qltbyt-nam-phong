# Plan: Issue #538 — DB-backed AI Kill Switch (TDD)

## Goal
Replace env-only `AI_KILL_SWITCH` with a DB-backed toggle stored in `public.internal_settings`. Operators (global role) can flip it without redeploy. `/api/chat` returns deterministic 429. Keep env var as emergency override.

## User-Confirmed Decisions
- **Storage:** Use `public.internal_settings` (live DB cols confirmed: `key TEXT PK`, `value TEXT NOT NULL`, `updated_at TIMESTAMPTZ`). Keys: `ai_kill_switch.enabled`, `ai_kill_switch.reason`.
- **Local migration source gap:** Local `supabase/migrations` currently references `internal_settings` but does not show the table creator. Before implementation, reconcile this source gap. If no correctly ordered creator exists elsewhere, add an idempotent bootstrap migration that sorts before the first local `internal_settings` reference; do not rely on the 20260522 kill-switch migration to create the table after older migrations already reference it.
- **RBAC:** Write = `global` only (normalize `admin` → `global` in SQL). Read = authenticated.
- **Cache:** In-process TTL cache (8s normal / 2s fail-closed) inside a new `kill-switch.ts` module.
- **Scope:** Backend + RPC + tests only. No admin UI in this issue.
- **Env fallback:** `AI_KILL_SWITCH=on` still hard-blocks instantly (bypasses cache and DB).

---

## TDD Order (write failing tests first)

### Step 0 — Reconcile `internal_settings` migration source
Before writing implementation SQL:
- Confirm via local search and Supabase MCP `list_migrations` whether a table-creation migration exists outside the visible local source.
- If missing, add a local bootstrap migration such as `supabase/migrations/20251122000000_create_internal_settings_table.sql` with `CREATE TABLE IF NOT EXISTS public.internal_settings (...)`, RLS enabled, and the existing service-role policy shape. This file must sort before `20251123_add_repair_request_notification_trigger.sql` and `20260111120000_fix_performance_warnings.sql`.
- Live DB already has the table, so the bootstrap SQL must be idempotent and safe on production.

### Step 1 — SQL/RPC smoke test first
File (new): `supabase/tests/ai_kill_switch_smoke.sql`

Write this before the RPC migration so it fails while `ai_kill_switch_status()` / `ai_kill_switch_set()` are absent. Use `BEGIN; ... ROLLBACK;` and `set_config('request.jwt.claims', ..., true)` fixtures.

Cases:
1. authenticated global reads default disabled row shape: `enabled=false`, nullable `reason`, nullable or existing `updated_at`.
2. global can set enabled with reason; subsequent status returns enabled + reason.
3. `admin` role is normalized to `global` and can write.
4. non-global authenticated role can read status but cannot write; assert SQLSTATE `42501`.
5. missing claims / missing `app_role` are rejected with `42501`.
6. `p_enabled IS NULL` is rejected with `22023`.
7. `p_reason = NULL` or blank clears/deletes the reason key while preserving enabled state.
8. transaction rolls back all `internal_settings` mutations made by the smoke test.

### Step 2 — Unit tests for new `kill-switch.ts` module
File (new): `src/lib/ai/__tests__/kill-switch.test.ts`
Cases (each calls `__resetKillSwitchCache()` in `beforeEach`; uses `vi.useFakeTimers` + `vi.stubEnv`):
1. env on → `{ active:true, source:'env' }`; RPC not called.
2. db enabled → `{ active:true, source:'db', reason:<from DB> }`.
3. db disabled → `{ active:false, source:'db' }`.
4. caches within TTL (one RPC call across two reads inside 8s).
5. re-fetches after TTL expiry.
6. env override beats cached db=false (no new RPC).
7. RPC throws → fail-closed `{ active:true, source:'db_error_fail_closed' }`; 2s short-TTL cache.
8. empty rows / `[]` → `{ active:false, source:'db' }`.

### Step 3 — Update `usage-metering.distributed.test.ts`
Mock `@/lib/ai/kill-switch`:
- short-circuits when `isAiKillSwitchActive()` returns active; `callServerRpc` not called.
- inactive → normal RPC reservation runs.
- reason text from DB propagates to `UsageReservationResult.message`; falls back to default when undefined.

### Step 4 — Update `route.kill-switch.test.ts`
Mock `@/lib/ai/kill-switch`. **Reconciliation needed first:** existing assertions (lines 76, 97) compare `await res.text()` to plain strings, but `usageLimitResponse` returns JSON. Run baseline once; switch new assertions to parse JSON: `expect(JSON.parse(text).error.message).toBe(...)`, `expect(JSON.parse(text).error.reason).toBe('kill_switch')`, and `expect(res.headers.get('Retry-After')).toBe('60')`. New cases:
- DB on, env off → 429, no quota RPC, DB-provided reason passed in body.
- DB off, env on → 429 with default message, source env.
- DB off, env off → falls through to quota path.
- DB read fails → 429 fail-closed.

### Step 5 — RPC proxy / allowlist test
Modify `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts` before editing the allowlist:
- assert `/api/rpc/ai_kill_switch_status` is accepted for authenticated callers.
- assert `/api/rpc/ai_kill_switch_set` is accepted by the proxy allowlist so SQL can enforce role-specific write authorization.
- keep a negative assertion for an unknown RPC to prove the route still blocks non-allowlisted functions.

This covers the operational access path in the issue. Direct SQL smoke tests prove function-level RBAC; this route test proves operators can reach the RPCs through the existing proxy once an admin UI or operational caller uses `callRpc`.

### Step 6 — Implementation (after tests are red)
See file list below.

### Step 7 — SQL operational verification (post-migration via Supabase MCP)
- `apply_migration` for new SQL file.
- `execute_sql`: run the transaction-wrapped body from `supabase/tests/ai_kill_switch_smoke.sql` against live DB after apply.
- Run `get_advisors(security)` and `get_advisors(performance)`.

---

## File Changes

| Path | Action | Notes |
|---|---|---|
| `supabase/migrations/20251122000000_create_internal_settings_table.sql` | NEW if source gap remains | Idempotent bootstrap for `public.internal_settings` so fresh local resets have the table before older references/policies. Include RLS/service-role policy only if no existing local creator is found. |
| `supabase/migrations/20260522120000_ai_kill_switch_db_toggle.sql` | NEW | RPCs `ai_kill_switch_status()` (auth read) and `ai_kill_switch_set(bool, text)` (global write). Both `SECURITY DEFINER SET search_path = public, pg_temp`. UPSERTs to `internal_settings`. `admin → global` normalization in SQL. JWT claim guards. `GRANT EXECUTE` to `authenticated`. |
| `supabase/tests/ai_kill_switch_smoke.sql` | NEW | Transaction-wrapped SQL/RPC smoke test covering default status, global/admin writes, non-global denial, missing-claim denial, null-enabled validation, reason clearing, and rollback cleanup. |
| `src/lib/ai/kill-switch.ts` | NEW | `isAiKillSwitchActive()` async; module-level cache `{ value, expiresAt }`; env override (lazy `process.env` read); 8s TTL on DB OK; 2s TTL on RPC error (fail-closed `active:true`). Uses `callServerRpc('ai_kill_switch_status', {}, systemRpcUser)` with synthetic principal `{ id:'system:ai-kill-switch-reader', role:'global' }`. Exports `__resetKillSwitchCache()` for tests. |
| `src/lib/ai/__tests__/kill-switch.test.ts` | NEW | 8 cases above. |
| `src/lib/ai/usage-metering.ts` | MODIFY | Replace `if (AI_KILL_SWITCH) { ... }` (lines 120–126) with `const ks = await isAiKillSwitchActive(); if (ks.active) return { allowed:false, reason:'kill_switch', message: ks.reason ?? 'AI usage is temporarily disabled.' }`. Drop unused `AI_KILL_SWITCH` import. |
| `src/lib/ai/__tests__/usage-metering.distributed.test.ts` | MODIFY | Replace env-based kill-switch test (lines 68–80) with mocked `@/lib/ai/kill-switch`; add reason-pass-through case. |
| `src/app/api/chat/__tests__/route.kill-switch.test.ts` | MODIFY | Mock `@/lib/ai/kill-switch`; reconcile JSON body assertions; add four cases (DB on, env on, both off, RPC error). |
| `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts` | MODIFY | Add allowlist coverage for `ai_kill_switch_status` and `ai_kill_switch_set` plus existing unknown-RPC rejection. |
| `src/app/api/rpc/[fn]/allowed-functions.ts` | MODIFY | Add `'ai_kill_switch_status'` and `'ai_kill_switch_set'` under the AI Assistant section. |
| `src/lib/ai/limits.ts` | UNCHANGED | Keep `AI_KILL_SWITCH` export (still consulted by tests / docs). |

---

## SQL Migration Sketch

Key shape (full body produced in implementation):

```sql
-- If Step 0 finds no local creator, add this in a correctly ordered bootstrap migration,
-- not only in the 20260522 kill-switch migration.
CREATE TABLE IF NOT EXISTS public.internal_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ai_kill_switch_status: any authenticated caller may read.
CREATE OR REPLACE FUNCTION public.ai_kill_switch_status()
RETURNS TABLE (enabled BOOLEAN, reason TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_claims TEXT := current_setting('request.jwt.claims', true); v_role TEXT;
BEGIN
  IF v_claims IS NULL OR btrim(v_claims) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;
  v_role := lower(coalesce(v_claims::jsonb->>'app_role',''));
  IF v_role = '' THEN RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501'; END IF;
  -- ... select 'ai_kill_switch.enabled' / '.reason', coalesce empty -> false, return one row.
END; $$;

-- ai_kill_switch_set: global only; admin normalized.
CREATE OR REPLACE FUNCTION public.ai_kill_switch_set(p_enabled BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS TABLE (enabled BOOLEAN, reason TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
-- IF p_enabled IS NULL -> 22023. JWT guard. Normalize admin->global. Reject if v_role <> 'global' (42501).
-- UPSERT ('ai_kill_switch.enabled', 'true'|'false'). UPSERT/DELETE 'ai_kill_switch.reason' based on NULLIF(trim).
$$;

REVOKE ALL ON FUNCTION public.ai_kill_switch_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_kill_switch_status() TO authenticated;
REVOKE ALL ON FUNCTION public.ai_kill_switch_set(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_kill_switch_set(BOOLEAN, TEXT) TO authenticated;
```

Filename timestamp `20260522120000` is strictly after the latest local migration (`20260521154307_ai_quota_review_hardening.sql`) per the migration-order rule.
If Step 0 adds `20251122000000_create_internal_settings_table.sql`, it intentionally sorts before the first local `internal_settings` reference and must remain idempotent for live DB safety.

---

## Risks & Mitigations
1. **Cache staleness** during emergency toggle: up to 8s lag from DB flip. Mitigation: `AI_KILL_SWITCH=on` env var = instant, cache-bypassing override.
2. **Fail-closed on RPC error**: outage in Supabase disables AI chat. Accepted; 2s short-TTL minimizes recovery delay; logged via `console.error`.
3. **SECURITY DEFINER + RLS**: function bodies bypass RLS; explicit JWT claim checks are the real boundary. RLS on `internal_settings` remains for non-RPC paths.
4. **Allowlist exposure of `ai_kill_switch_set`**: proxy signs caller's real role; in-body `v_role <> 'global'` check enforces. Required so a future admin UI can call through `/api/rpc/[fn]`.
5. **Existing test body assertions**: `route.kill-switch.test.ts` compares `await res.text()` to plain strings while `usageLimitResponse` returns JSON. Verify baseline before refactor; update to JSON parsing in new test rewrite.
6. **Module-load env capture**: `limits.ts` reads `process.env.AI_KILL_SWITCH` at import time, which fights `vi.stubEnv`. New module reads `process.env` lazily inside `ENV_KILL_SWITCH()`.
7. **Local migration drift for `internal_settings`**: live DB has the table, but local source currently lacks the creator. Step 0 prevents a fresh-reset-only failure and keeps the issue migration from hiding an older baseline gap.
8. **Proxy access gap**: direct SQL tests alone do not prove operators can reach the toggle through `/api/rpc/[fn]`. Step 5 adds route-level allowlist coverage while leaving final write authorization inside SQL.

---

## Verification Order (per repo `CLAUDE.md`)
1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run verify:dedupe`
3. `node scripts/npm-run.js run typecheck`
4. Focused tests: `kill-switch.test.ts`, `usage-metering.distributed.test.ts`, `route.kill-switch.test.ts`, `rpc-whitelist.unit.test.ts`.
5. Supabase MCP: `apply_migration`, transaction-wrapped `execute_sql` smoke from `supabase/tests/ai_kill_switch_smoke.sql`, `get_advisors(security|performance)`.

## Out of Scope (follow-ups)
- Admin UI page to call `ai_kill_switch_set` via `callRpc`.
- Removing `AI_KILL_SWITCH` export from `limits.ts` once stable.
- Audit log row on every toggle change (currently only `updated_at` on the row).
