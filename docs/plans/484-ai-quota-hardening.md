# TDD Plan — Issue #484: AI Quota Hardening (Backend) — Revised

## Status
Rev 3 — incorporates second code review pass. Adds explicit global lock order (reservation rows before counter rows), concrete Postgres `interval` math, locks down JWT identity check (no `global` override on `/api/chat`), and defines mid-stream token-accounting fallback (provider-reported usage only; no estimation).

Rev 2 — first round of code review fixes: cross-user locking for tenant/global, RPC accepts limits as params (no env in SQL), sliding rate-limit semantics preserved, reservations record exact counter refs, dedicated server-side RPC helper, retry/abort paths release/finalize explicitly, TTL > route maxDuration.

## Decisions (locked in)
- **Backend**: Supabase RPC (Postgres) — no new vendor dependency
- **Kill switch**: Env var only (`AI_KILL_SWITCH=on`) — accepted deviation from issue AC (redeploy required). Follow-up issue MUST be opened to track a DB-backed switch before closing #484
- **Scope**: Items 1–5 from the issue (backend). UI retry cooldown (item 6) deferred — follow-up issue MUST be opened before closing #484
- **Branch**: `feat/484-ai-quota-hardening`
- **Methodology**: TDD — failing test first, minimum code to pass, refactor. **Ralph flow not used** for this plan (no `prd.json` integration; current `prd.json` is on `ralph/vercel-ai-sdk-strategic-spec`).

## Code Review Findings Addressed
1. **Cross-user locking for tenant/global** — drop user-only advisory lock as the sole guard. Use `SELECT … FOR UPDATE` on counter rows in **stable canonical order** (sorted by `scope`, then `key`, then `window_id`) so concurrent reserves across users serialize correctly on shared counters.
2. **RPC accepts limits + TTL as parameters** — SQL cannot read app env. All limits and TTL passed by the TS caller, sourced from `src/lib/ai/limits.ts`. No hardcoded limits in SQL.
3. **Sliding rate-limit preserved** — use a per-event table `ai_rate_events`, not a minute bucket. Matches existing in-memory semantics (`src/lib/ai/usage-metering.ts:74,114`).
4. **Exact counter refs on reservations** — add `counter_refs JSONB` column listing `{scope,key,window_id}` tuples touched at reserve time. Finalize/sweeper decrement those exact rows, immune to window-boundary drift.
5. **Server-side RPC helper** — `src/lib/rpc-client.ts` uses relative `fetch('/api/rpc/...')` and is unsuitable from server routes. Introduce `src/lib/ai/server-rpc.ts` that signs the JWT (same secret + claims as `src/app/api/rpc/[fn]/route.ts`) and calls Supabase PostgREST directly. Allowlist file is `src/app/api/rpc/[fn]/allowed-functions.ts` (corrected path).
6. **Retry / abort paths finalize/release** — every exit path (pre-stream retry `continue`, 500 response, client abort, `onError`, `onFinish`) MUST call `finalizeUsage`. Reservation IDs tracked per attempt; no path relies on TTL sweep.
7. **TTL default raised** — default reservation TTL set to **120s** (route `maxDuration=60s` + artifact/draft work). Env-tunable via `AI_QUOTA_RESERVATION_TTL_MS`.
8. **Deviation tracking** — env kill switch + UI cooldown deviations explicitly listed under "Follow-ups Required" and must be filed as issues before #484 is closed.
9. **Ralph flow removed** — no `prd.json` updates; stories tracked here only.

### Rev 3 additions
10. **Global lock order to prevent deadlock** — across all paths the canonical order is **reservation rows first, then counter rows**. `ai_quota_reserve` runs the expired-release sweep (which follows this order) **before** locking the new request's counter rows. New reservation row is `INSERT`ed last (fresh PK; no contention). Finalize and `ai_quota_release_expired` already follow this order.
11. **Explicit Postgres `interval` math** — all time math uses `p_now - (p_rate_window_ms * interval '1 millisecond')` and `p_now + (p_ttl_ms * interval '1 millisecond')`. No ad-hoc subtraction of integers from `timestamptz`.
12. **JWT identity strictly enforced** — `ai_quota_reserve` requires `current_setting('request.jwt.claims', true)::json->>'user_id' = p_user_id`. **No `app_role='global'` override path** on `/api/chat`. The chat route always passes the authenticated user's own id; admins consume quota under their own user just like everyone else.
13. **Mid-stream token-accounting fallback** — `tokens_in` / `tokens_out` are recorded **only when the provider reports usage** (`onFinish.usage` for completed streams; provider error payload's `usage` field for failures that consumed billing). When no provider usage is available (e.g., abort before first delta, network error before any token), the finalize call records `tokens_in=0, tokens_out=0, cost_usd=0` and the `count` increment alone reflects budget consumption for `success` / `error_with_usage`. **No token estimation** — accuracy over guesswork.

## Goals
1. Replace in-memory `Map` counters with durable counters in Postgres
2. Atomic **reserve-before-execution** semantics in a single RPC
3. **Finalize** after stream completion with actual tokens/cost
4. Account for **cost-aware failures** (provider usage consumed even on error)
5. Add **global daily cap** and **env-var kill switch**
6. Preserve sliding rate-limit semantics

## Critical Files
- `src/lib/ai/usage-metering.ts` — replace internals; new `reserveUsage` / `finalizeUsage`
- `src/lib/ai/limits.ts` — add `AI_DAILY_GLOBAL_QUOTA_REQUESTS`, `AI_KILL_SWITCH`, `AI_QUOTA_RESERVATION_TTL_MS`
- `src/lib/ai/server-rpc.ts` — **NEW** server-side RPC helper (JWT mint + direct PostgREST call)
- `src/app/api/chat/route.ts` — switch to reserve/finalize; finalize on **every** exit path including retry `continue` (~line 288), client abort, 500
- `src/app/api/rpc/[fn]/allowed-functions.ts` — add `ai_quota_reserve`, `ai_quota_finalize`, `ai_quota_release_expired` (only if any client-side path needs them — see S006)
- `supabase/migrations/<ts>_ai_quota_hardening.sql` — schema + RPCs
- Tests (vitest):
  - `src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts` (update mocks)
  - `src/lib/ai/__tests__/usage-metering.distributed.test.ts` (new)
  - `src/lib/ai/__tests__/server-rpc.test.ts` (new)
  - `src/app/api/chat/__tests__/route.kill-switch.test.ts` (new)
  - `src/app/api/chat/__tests__/route.cost-aware-failure.test.ts` (new)
  - `src/app/api/chat/__tests__/route.retry-and-abort-finalize.test.ts` (new)

## Architecture

### Tables (single migration)
```sql
-- Daily counters only (rate handled by events table below).
CREATE TABLE public.ai_quota_counters (
  scope        TEXT NOT NULL CHECK (scope IN ('user_daily','tenant_daily','global_daily')),
  key          TEXT NOT NULL,                 -- userId | tenantId | 'global'
  window_id    TEXT NOT NULL,                 -- YYYY-MM-DD (UTC)
  count        INTEGER NOT NULL DEFAULT 0,
  reserved     INTEGER NOT NULL DEFAULT 0,
  tokens_in    BIGINT  NOT NULL DEFAULT 0,
  tokens_out   BIGINT  NOT NULL DEFAULT 0,
  cost_usd     NUMERIC(12,6) NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key, window_id)
);
CREATE INDEX idx_ai_quota_counters_expires ON public.ai_quota_counters(expires_at);

-- Sliding rate window. One row per reserved attempt; pruned on each reserve.
CREATE TABLE public.ai_rate_events (
  reservation_id UUID PRIMARY KEY,            -- FK to ai_quota_reservations.id
  user_id        TEXT NOT NULL,
  ts             TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_ai_rate_events_user_ts ON public.ai_rate_events(user_id, ts DESC);

-- Reservations record exact counter rows touched, enabling precise finalize/release.
CREATE TABLE public.ai_quota_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  tenant_id     INTEGER,
  reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('reserved','success','error_with_usage','error_no_usage','expired')),
  counter_refs  JSONB NOT NULL,               -- [{"scope":"user_daily","key":"u1","window_id":"2026-05-21"}, ...]
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  cost_usd      NUMERIC(12,6)
);
CREATE INDEX idx_ai_quota_reservations_status_exp
  ON public.ai_quota_reservations(status, expires_at);
ALTER TABLE public.ai_rate_events
  ADD CONSTRAINT ai_rate_events_reservation_fk
  FOREIGN KEY (reservation_id) REFERENCES public.ai_quota_reservations(id) ON DELETE CASCADE;
```

### RPCs (SECURITY DEFINER, `SET search_path = public, pg_temp`, JWT claim guard)

```sql
ai_quota_reserve(
  p_user_id           TEXT,
  p_tenant_id         INTEGER,           -- NULL allowed
  p_rate_window_ms    INTEGER,
  p_rate_max          INTEGER,
  p_user_daily_max    INTEGER,
  p_tenant_daily_max  INTEGER,
  p_global_daily_max  INTEGER,
  p_ttl_ms            INTEGER,
  p_now               TIMESTAMPTZ DEFAULT now()
) RETURNS TABLE (allowed BOOLEAN, reservation_id UUID, reason TEXT, message TEXT)
```
Algorithm:
1. Validate JWT: require `current_setting('request.jwt.claims', true)::json->>'user_id' = p_user_id`. No `global` override — `/api/chat` always reserves under the authenticated user. Reject with `42501` on mismatch.
2. **Lazy expired-release first** (preserves global lock order: reservations → counters). For each `ai_quota_reservations` row with `status='reserved' AND expires_at < p_now` touched by `p_user_id`, optionally `p_tenant_id`, or `'global'` keys: lock the reservation row, then decrement `reserved` on each row in its `counter_refs`, set status='expired'. This sweep follows the reservation→counter order strictly.
3. Compute target counter rows for the new request: `user_daily(p_user_id, today)`, optional `tenant_daily(p_tenant_id, today)`, `global_daily('global', today)`. UPSERT each (`INSERT … ON CONFLICT (scope,key,window_id) DO UPDATE SET reserved = ai_quota_counters.reserved RETURNING *`) driven by an ordered VALUES list to acquire row locks in canonical order: `ORDER BY scope, key, window_id`.
4. Sliding rate check: first prune `ai_rate_events` where `user_id = p_user_id AND ts < p_now - (p_rate_window_ms * interval '1 millisecond')`. Then `SELECT count(*) FROM ai_rate_events WHERE user_id = p_user_id AND ts >= p_now - (p_rate_window_ms * interval '1 millisecond')`. If `>= p_rate_max` → return `(false, NULL, 'rate_limit', ...)`.
5. For each locked counter row, check `count + reserved >= limit` against its scope's max → return `(false, NULL, '<scope>_quota', ...)`.
6. Increment `reserved += 1` for each locked counter row. INSERT reservation with `counter_refs` JSONB listing those rows, `expires_at = p_now + (p_ttl_ms * interval '1 millisecond')`. INSERT `ai_rate_events(reservation_id, user_id, ts=p_now)`. Return `(true, reservation_id, NULL, NULL)`.

```sql
ai_quota_finalize(
  p_reservation_id UUID,
  p_status         TEXT,                  -- 'success' | 'error_with_usage' | 'error_no_usage'
  p_tokens_in      INTEGER,
  p_tokens_out     INTEGER,
  p_cost_usd       NUMERIC
) RETURNS VOID
```
Algorithm:
1. `SELECT … FOR UPDATE` the reservation row. If status != 'reserved' → no-op (idempotent).
2. For each ref in `counter_refs` (ordered canonical), `UPDATE ai_quota_counters SET reserved = reserved - 1 …` keyed by `(scope,key,window_id)`.
3. If `p_status IN ('success','error_with_usage')`: also `count += 1`, `tokens_in += p_tokens_in`, `tokens_out += p_tokens_out`, `cost_usd += p_cost_usd`.
4. If `p_status = 'error_no_usage'`: also delete the row's `ai_rate_events` entry so it does not count against the sliding window (failed-before-provider). Otherwise keep the event.
5. UPDATE reservation row with status + actuals.

```sql
ai_quota_release_expired(p_now TIMESTAMPTZ DEFAULT now()) RETURNS INTEGER
```
- For every `ai_quota_reservations` where `status='reserved' AND expires_at < p_now`: behave like finalize with `status='expired'`, decrement `reserved` per `counter_refs`, leave `ai_rate_events` (already-issued slot counted as used — conservative). Returns count of released reservations.

### Server-side TS surface (`src/lib/ai/usage-metering.ts`)
```ts
export interface ReservationResult {
  allowed: boolean
  reservationId?: string
  reason?: UsageLimitReason | 'kill_switch' | 'global_quota'
  message?: string
}
export type FinalizeStatus = 'success' | 'error_with_usage' | 'error_no_usage'

export async function reserveUsage(ctx: UsageContext): Promise<ReservationResult>
export async function finalizeUsage(
  reservationId: string,
  status: FinalizeStatus,
  record?: UsageRecord
): Promise<void>
```
- `reserveUsage` reads limits from `src/lib/ai/limits.ts`, short-circuits with `reason='kill_switch'` when `AI_KILL_SWITCH=on` (no RPC call), otherwise calls `ai_quota_reserve` via the new server helper.
- `finalizeUsage` is a safe no-op when `reservationId` is falsy or `kill_switch` was the cause.
- Legacy in-memory functions (`checkUsageLimits`, `recordUsage`, `confirmUsage`) and `__resetUsageMeteringForTests` removed after S003 (no other consumers remain — confirm during exploration before deleting).

### Server-side RPC helper (`src/lib/ai/server-rpc.ts` — NEW)
- Reuses the JWT signing logic and claims shape from `src/app/api/rpc/[fn]/route.ts` (extract a small `mintSupabaseJwt(claims)` helper shared between proxy and server callers).
- Calls Supabase PostgREST directly via `fetch(SUPABASE_URL + '/rest/v1/rpc/<fn>')` with `Authorization: Bearer <jwt>` and `apikey`.
- No reliance on relative URLs; safe inside route handlers/server actions.
- Strict, narrow generic types; zero `any` (passes `verify:no-explicit-any`).

## TDD Stories

> Per-story verify chain: `verify:no-explicit-any` → `verify:dedupe` → `typecheck` → focused vitest run → react-doctor diff. Migration stories also require `get_advisors(security)` + `get_advisors(performance)` clean.

### S001 — Schema + RPCs with cross-user locking & sliding rate
**Red tests** (SQL fixtures via `execute_sql` MCP):
- Reserve under all caps succeeds; counter rows + reservation + rate event created.
- Reserve at user_daily, tenant_daily, global_daily limit each returns `(false, _, '<scope>_quota')`.
- Concurrent reserves at tenant boundary for two different users: only one succeeds (canonical-order FOR UPDATE serializes on shared tenant row).
- Concurrent reserves at global boundary across tenants: only one succeeds.
- Sliding rate: N reserves in window pass, N+1 rejected; one event aged beyond window allows next reserve.
- Finalize `success` increments `count`, decrements `reserved`, accumulates tokens/cost on **exactly** the rows in `counter_refs`.
- Finalize `error_with_usage` increments `count` AND tokens/cost; rate event kept.
- Finalize `error_no_usage` only releases `reserved`; rate event removed.
- Finalize is idempotent.
- `ai_quota_release_expired` releases reserved counts for expired reservations, leaves rate events alone.
- Day-boundary reservation: reserved on day N at 23:59 with finalize on day N+1 at 00:00 decrements the day-N counter (proves `counter_refs` immunity to window drift).
- Lock-order deadlock probe: simultaneously run (a) `ai_quota_reserve` for user A (which triggers expired-release sweeping user B's old reservation) and (b) `ai_quota_finalize` of one of user B's active reservations sharing the same tenant counter. Neither transaction deadlocks; both complete in any order.
- JWT identity guard: calling `ai_quota_reserve(p_user_id='other-uid')` while JWT claims `user_id='self'` raises `42501`; the counters and `ai_rate_events` are unchanged.

**Impl**: single migration `ai_quota_hardening` applied via `apply_migration`. Functions follow security template; lock order strict.

### S002 — Server RPC helper + TS wrappers
**Red tests** (`server-rpc.test.ts`, `usage-metering.distributed.test.ts`):
- `mintSupabaseJwt` produces claims identical to RPC proxy for equivalent input (shared helper).
- `serverCallRpc` posts to absolute PostgREST URL with correct headers; rejects non-allowlisted fn names.
- `reserveUsage` payload includes all limit params and TTL from `src/lib/ai/limits.ts`.
- `reserveUsage` short-circuits to `kill_switch` when `AI_KILL_SWITCH=on`; no fetch occurs.
- `reserveUsage` maps RPC `reason` strings to `UsageLimitReason | 'global_quota' | 'kill_switch'`.
- `finalizeUsage` accepts all three statuses; no-op on missing reservationId.

**Impl**: extract `mintSupabaseJwt` from the proxy (Story S002 also updates `src/app/api/rpc/[fn]/route.ts` to use it — pure refactor, behavior-preserving). Add `server-rpc.ts` + new exports in `usage-metering.ts`.

### S003 — Wire `/api/chat` with finalize on every exit path
**Red tests** (`route.rate-limit-and-quota.test.ts` updated + `route.retry-and-abort-finalize.test.ts` new):
- Reserve called before `streamText`; finalize called on `onFinish` with `success` and provider-reported `usage.inputTokens` / `usage.outputTokens`.
- Reserve at limit → 429 with `reason`/`message` from RPC; no stream started.
- Pre-stream retry `continue` (existing behavior at ~`route.ts:288`): each attempt that reserved MUST finalize as `error_no_usage` before the next attempt is reserved. Test forces the retry path and asserts finalize per attempt.
- 500 thrown before stream after reserve → finalize `error_no_usage`.
- Client abort mid-stream (`AbortSignal`) → finalize `error_with_usage`; tokens recorded only if provider supplied usage, else zero.
- `onError` thrown after first chunk → finalize `error_with_usage`; tokens from provider error payload if present, else zero.

**Impl**:
- Replace existing limit-check + `recordUsage` (`route.ts:149`, `:182`) with `reserveUsage`.
- Track `currentReservationId` per attempt in the retry loop; centralize a `finalizeOnce(status, record?)` closure shared by all exit paths.
- Wire to `onFinish`, `onError`, top-level `try/catch`, retry `continue`, and `AbortSignal` listener.

### S004 — Cost-aware failure accounting refinements
**Red tests** (`route.cost-aware-failure.test.ts`):
- Provider returns 5xx with `usage` payload (mock provider error) → `error_with_usage` with parsed tokens from provider `usage`.
- Stream throws after first delta, **provider reported usage in `onError`** → `error_with_usage` with provider tokens.
- Stream throws after first delta, **no provider usage available** → `error_with_usage` with `tokens_in=0, tokens_out=0` (count still increments; cost remains 0).
- Stream throws before first delta, no provider usage → `error_no_usage` with zeroed tokens.

**Impl**: small classifier helper in `usage-metering.ts` (`classifyStreamFailure({ stage, providerUsage })`); wired into S003's `finalizeOnce`. **No token estimation** — only provider-reported usage is recorded.

### S005 — Global daily cap + env-var kill switch
**Red tests** (`route.kill-switch.test.ts`):
- `AI_KILL_SWITCH=on` → 429, `reason='kill_switch'`, no RPC fetch.
- With `AI_DAILY_GLOBAL_QUOTA_REQUESTS=1`: first reserve succeeds, second returns 429 `reason='global_quota'`.
- TTL env override (`AI_QUOTA_RESERVATION_TTL_MS=200`) is passed through to RPC.

**Impl**:
- Add limits to `src/lib/ai/limits.ts` (`AI_DAILY_GLOBAL_QUOTA_REQUESTS`, `AI_KILL_SWITCH`, `AI_QUOTA_RESERVATION_TTL_MS` with default `120_000`).
- TS short-circuit for kill switch in `reserveUsage`.
- Global cap enforced by S001 RPC via the `p_global_daily_max` parameter.

### S006 — Cleanup, advisors, allowlist
- Remove legacy in-memory functions + `__resetUsageMeteringForTests` once no consumers remain.
- Allowlist update in `src/app/api/rpc/[fn]/allowed-functions.ts` only if any client-side call path needs the quota RPCs. With `server-rpc.ts`, the proxy is bypassed for these calls — so allowlist edit is likely unnecessary. Confirm and document.
- `get_advisors(security)` + `get_advisors(performance)` clean.

## Follow-ups Required (file before closing #484)
1. **UI retry cooldown** — issue scope item 6, deferred.
2. **DB-backed kill switch** — replace env-var with table-row toggle so admins can flip without redeploy (issue AC mandates "without redeploying code").
3. **Cost-per-token config table** — replace hardcoded rates in `estimateCostUsd`.

## Risk Notes
- **Env kill switch requires redeploy** — explicitly noted in PR description; tracked by follow-up #2 above.
- **Cross-user lock contention** — canonical-order FOR UPDATE serializes shared tenant/global rows. Throughput cost is acceptable for current scale; revisit if metrics show contention.
- **Reservation TTL = 120s default** — must exceed worst-case stream + artifact work (`maxDuration=60s` + draft). Tunable via env.
- **`ai_rate_events` growth** — pruned on each reserve for the requesting user, plus periodic sweep by `ai_quota_release_expired`. Add a scheduled job if growth becomes an issue.

## Verification Order (mandatory each story)
1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run verify:dedupe`
3. `node scripts/npm-run.js run typecheck`
4. Focused vitest run for the story's test file(s)
5. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
6. `get_advisors(security)` + `get_advisors(performance)` after any migration
