# TDD Plan — Issue #484: AI Quota Hardening (Backend)

## Decisions (locked in)
- **Backend**: Supabase RPC (Postgres) — no new vendor dependency
- **Kill switch**: Env var only (`AI_KILL_SWITCH=on`) — accepted deviation from issue AC
- **Scope**: Items 1–5 from the issue (backend). UI retry cooldown (item 6) deferred to a separate issue
- **Branch**: `feat/484-ai-quota-hardening`
- **Methodology**: TDD — failing test first, minimum code to pass, refactor. One story per iteration (Ralph flow)

## Goals
1. Replace in-memory `Map` counters with durable counters in Postgres
2. Atomic **reserve-before-execution** semantics in a single RPC
3. **Finalize** after stream completion with actual tokens/cost
4. Account for **cost-aware failures** (provider usage consumed even on error)
5. Add **global daily cap** and **env-var kill switch**
6. Preserve existing module API (`checkUsageLimits` / `recordUsage` / `confirmUsage`) so the route only swaps to reserve/finalize at the call sites

## Critical Files
- `src/lib/ai/usage-metering.ts` — replace internals; keep exported surface, add reserve/finalize
- `src/lib/ai/limits.ts` — add `AI_DAILY_GLOBAL_QUOTA_REQUESTS`, `AI_KILL_SWITCH`, reservation TTL
- `src/app/api/chat/route.ts` — switch to `reserveUsage` (pre-stream) and `finalizeUsage` (success / `error_with_usage` / `error_no_usage`)
- `src/app/api/rpc/[fn]/route.ts` — add `ai_quota_reserve`, `ai_quota_finalize`, `ai_quota_release_expired` to `ALLOWED_FUNCTIONS`
- `src/lib/rpc-client.ts` — used as-is for server-side calls from the chat route
- `supabase/migrations/<ts>_ai_quota_hardening.sql` — schema + RPCs
- Tests (vitest):
  - `src/app/api/chat/__tests__/route.rate-limit-and-quota.test.ts` (update mocks)
  - `src/lib/ai/__tests__/usage-metering.distributed.test.ts` (new)
  - `src/app/api/chat/__tests__/route.kill-switch.test.ts` (new)
  - `src/app/api/chat/__tests__/route.cost-aware-failure.test.ts` (new)

## Architecture

### Tables (single migration)
```sql
-- Durable counters bucketed by scope/key/window
CREATE TABLE public.ai_quota_counters (
  scope        TEXT NOT NULL CHECK (scope IN ('rate','user_daily','tenant_daily','global_daily')),
  key          TEXT NOT NULL,                 -- userId | tenantId | 'global'
  window_id    TEXT NOT NULL,                 -- minute bucket for rate, YYYY-MM-DD for daily
  count        INTEGER NOT NULL DEFAULT 0,    -- confirmed
  reserved     INTEGER NOT NULL DEFAULT 0,    -- in-flight
  tokens_in    BIGINT  NOT NULL DEFAULT 0,
  tokens_out   BIGINT  NOT NULL DEFAULT 0,
  cost_usd     NUMERIC(12,6) NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key, window_id)
);
CREATE INDEX idx_ai_quota_counters_expires ON public.ai_quota_counters(expires_at);

-- One row per inflight/historical request (audit + finalize lookup)
CREATE TABLE public.ai_quota_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  tenant_id     INTEGER,
  reserved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('reserved','success','error_with_usage','error_no_usage','expired')),
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  cost_usd      NUMERIC(12,6)
);
CREATE INDEX idx_ai_quota_reservations_status_exp
  ON public.ai_quota_reservations(status, expires_at);
```

### RPCs (SECURITY DEFINER, search_path locked)
- `ai_quota_reserve(p_user_id text, p_tenant_id int, p_now timestamptz default now())`
  - JWT claim guard (must be authenticated; user_id from JWT must match `p_user_id`)
  - Single transaction; per-key advisory lock via `pg_advisory_xact_lock(hashtext(p_user_id))`
  - UPSERT rate/user_daily/tenant_daily/global_daily counters with proper `window_id`
  - Lazy purge of rows where `expires_at < p_now` (cheap, scoped to the keys touched)
  - If `count + reserved >= limit` for any scope → return `{ allowed: false, reason, message }`
  - Else `reserved := reserved + 1` for all scopes, INSERT reservation `status='reserved'` with TTL (default 30s)
  - Returns `{ allowed: bool, reservation_id uuid, reason text }`
- `ai_quota_finalize(p_reservation_id uuid, p_status text, p_tokens_in int, p_tokens_out int, p_cost_usd numeric)`
  - Transaction; lock the reservation row
  - If reservation not in `reserved` state → no-op (idempotent)
  - For each scope counter touched by the reservation: `reserved := reserved - 1`
  - If `p_status IN ('success','error_with_usage')` then `count := count + 1`, accumulate tokens/cost
  - If `p_status = 'error_no_usage'` then only release `reserved`
  - UPDATE reservation row with actuals + final status
- `ai_quota_release_expired(p_now timestamptz default now())`
  - Sweeper: marks reservations `expired` and decrements `reserved` for any reservation whose `expires_at < now()` AND status='reserved'. Safe to call lazily from `ai_quota_reserve`

### TypeScript surface (`src/lib/ai/usage-metering.ts`)
Keep existing types. Add:
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
Implementation calls Supabase via existing server-side fetch path. Kill-switch check happens in TS before the RPC call (cheap short-circuit).

In-memory functions stay only for backward-compat in tests that already exercise them; the chat route stops using them.

## TDD Stories (Ralph one-per-iteration)

> Every story ends with: `verify:no-explicit-any` → `verify:dedupe` → `typecheck` → targeted tests → react-doctor diff. Each story commits as `feat: [Sxxx] - <title>` and sets `passes: true` in `prd.json`.

### S001 — Schema + RPCs (red→green)
- **Tests (new)**: `supabase/tests/ai_quota_hardening.sql` or vitest integration shim that calls RPCs via `execute_sql` MCP fixtures. Cover:
  - Reserve under limit succeeds; reservation row created
  - Reserve at limit returns `allowed=false` with correct reason for each scope
  - Two concurrent reserves at the boundary cannot both succeed (advisory lock + UPSERT)
  - Finalize `success` increments `count`, decrements `reserved`, records tokens/cost
  - Finalize `error_with_usage` increments `count` AND tokens/cost
  - Finalize `error_no_usage` only releases `reserved`
  - Finalize is idempotent (double-call no-op)
  - Expired reservation is swept and `reserved` is released
- **Impl**: single migration `ai_quota_hardening` applied via MCP `apply_migration`. Functions follow security template (`SECURITY DEFINER`, `SET search_path = public, pg_temp`, JWT claim guard)
- **Post**: `get_advisors(security)` and `get_advisors(performance)` clean

### S002 — TS wrapper `reserveUsage` / `finalizeUsage`
- **Tests (new)** in `src/lib/ai/__tests__/usage-metering.distributed.test.ts`:
  - Mocks `callRpc` and asserts payload shape for `ai_quota_reserve`
  - Maps RPC `reason` → existing `UsageLimitReason` plus new `global_quota`
  - `reserveUsage` short-circuits with `reason='kill_switch'` when `AI_KILL_SWITCH=on`
  - `finalizeUsage` accepts all three statuses; missing reservationId is a no-op
- **Impl**: add the two exports; keep legacy in-memory functions untouched (still used by old tests)
- **Constraint**: zero `any` in the diff (`verify:no-explicit-any` gate)

### S003 — Wire `/api/chat` to reserve/finalize
- **Tests (update)**: `route.rate-limit-and-quota.test.ts`
  - Replace `checkUsageLimits`/`recordUsage`/`confirmUsage` mocks with `reserveUsage`/`finalizeUsage`
  - Assert reserve called BEFORE streaming, finalize called on stream finish
  - Assert 429 body includes RPC `reason` and `message`
  - Assert reservationId passed through to `onFinish` and `onError`
- **Impl**:
  - Replace lines 149–155 with `reserveUsage(...)`; on `!allowed` return 429 (including new `kill_switch` / `global_quota` reasons)
  - Remove line 182 `recordUsage`
  - In `onFinish`: call `finalizeUsage(reservationId, 'success', { inputTokens, outputTokens })`
  - In `onError` / catch around stream: distinguish `error_with_usage` vs `error_no_usage` based on whether any tokens were emitted; for safety, default partial-stream errors to `error_with_usage`

### S004 — Cost-aware failure accounting
- **Tests (new)** `route.cost-aware-failure.test.ts`:
  - Stream throws after first chunk → finalize called with `error_with_usage` and observed tokens
  - Stream throws before any chunk → finalize called with `error_no_usage`
  - 4xx/5xx from provider with `usage` in error payload → `error_with_usage`
- **Impl**: refine the error branch from S003; centralize the classification in a small helper inside `usage-metering.ts`

### S005 — Global daily cap + env-var kill switch
- **Tests (new)** `route.kill-switch.test.ts`:
  - `AI_KILL_SWITCH=on` → 429 with `reason='kill_switch'`, RPC not called
  - `AI_DAILY_GLOBAL_QUOTA_REQUESTS=1` + two reserves → second returns `reason='global_quota'`
- **Impl**:
  - Add limits to `src/lib/ai/limits.ts`
  - TS short-circuit for kill switch
  - RPC enforces global cap (already included in S001 schema; flag-on with env-provided limit injected as parameter, not hardcoded in SQL)

### S006 — Cleanup, docs, advisors
- Remove now-unreachable code paths in `usage-metering.ts` (legacy daily Maps if no consumers remain). Keep `__resetUsageMeteringForTests` and update to clear new state where applicable.
- `get_advisors(security)` and `get_advisors(performance)` clean after final apply
- Update `docs/` if a runbook exists for AI quotas (read-only check first; do not create new docs unless one already exists)

## Out of Scope (this plan)
- UI retry cooldown (issue item 6) — separate issue
- Migrating cost-per-token rates to a config table — separate issue
- DB-backed kill switch — explicitly deferred (env var per user decision)

## Risk Notes
- **Env-var kill switch requires redeploy**, which deviates from the issue's "without redeploying code" AC. User accepted this trade-off; flag in PR description.
- Advisory locks are per-user-key; cross-user contention is not serialized — intentional for throughput.
- Reservation TTL (30s) must exceed worst-case stream time. Make it env-configurable (`AI_QUOTA_RESERVATION_TTL_MS`) with a sane default.

## Verification Order (mandatory each story)
1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run verify:dedupe`
3. `node scripts/npm-run.js run typecheck`
4. Focused vitest run for the story's test file(s)
5. `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
6. `get_advisors(security)` after any migration
