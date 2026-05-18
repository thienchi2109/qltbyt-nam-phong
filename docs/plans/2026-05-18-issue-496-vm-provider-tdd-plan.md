# Issue #496 VM Provider Integration TDD Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> or superpowers:executing-plans to implement this plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Wire the device-quota mapping suggestion route to the VM suggestion
service without exposing the VM service directly, without mixing embedding
spaces, and with measured latency targets before canary rollout.

**Architecture:** Next.js remains the auth, facility-scope, data-bundling, and
anti-spam boundary. The VM service remains suggestion-only and DB-credential-free.
The VM service is reached through Cloudflare Tunnel + Cloudflare Access service
token, not a public raw port.

**Tech Stack:** Next.js route handler, TypeScript, Vitest, Cloudflare Tunnel,
Cloudflare Access service tokens, VM-hosted FastAPI suggestion service,
Supabase RPC read/write source of truth.

---

## Decisions Locked

- **Connectivity:** use Cloudflare Tunnel as the default connectivity path.
  The FastAPI service stays bound to a local/private VM port such as
  `127.0.0.1:18080`; do not expose the raw service port to the Internet.
- **Access control:** the Next.js VM client must send
  `CF-Access-Client-Id`, `CF-Access-Client-Secret`, `X-Internal-Token`, and
  `X-Request-Id`. None of these envs may use `NEXT_PUBLIC_`.
- **Fallback:** in `vm` or `canary` mode, VM failure or an open circuit returns
  a controlled degraded response (`503`). Do not runtime-fallback to Supabase.
  Supabase is retained only as an operator rollback by setting
  `DEVICE_QUOTA_SUGGESTION_PROVIDER=supabase`.
- **Canary:** use a facility allow-list keyed by `donViId`.
- **Anti-spam:** serve a valid route-level result-cache hit first. If no valid
  cache exists and the same authenticated user/facility retries too quickly,
  return a clear `429` cooldown response.
- **Embedding mismatch:** do not mix embedding spaces. Supabase fallback remains
  on `nhom_thiet_bi.embedding vector(384)`. The VM path embeds both device names
  and categories with the VM model (`dangvantuan/vietnamese-embedding`, 768
  dimensions) and ranks fully inside the VM. The VM path must not read, compare,
  or write the Supabase 384-dimensional embedding column.
- **Payload shape:** the route must not send full equipment rows. Send grouped
  distinct device names plus IDs, and only the category fields the VM needs.

## Current Evidence

- Facility 17 is the stress case: 1,940 unassigned equipment rows, 504 distinct
  unassigned names, and 291 categories.
- Current Supabase path can trigger about 51 Supabase Edge embedding calls and
  51 `hybrid_search_category_batch` calls for one facility-17 preview.
- Live DB currently stores category embeddings as `vector(384)`.
- VM2 smoke from Issue #508: 3 device names and 4 categories returned in about
  `clientMs=254.961`, service `totalMs=249.33`; repeated identical request hit
  service cache in about `clientMs=2.267`.
- Estimated facility-17 VM request payload using the minimal shape is about
  77 KB; estimated topK=3 response is about 317 KB. This is safely below the
  Vercel Function 4.5 MB body limit, but add an app-level guard anyway.
- Synthetic Python benchmark of the current VM ranking loop for
  `504 x 291 x 768` took about 10 seconds with repeated cosine norm work, and
  about 4 seconds using dot product over normalized vectors. The VM path must
  be optimized before canary.

## Public Interfaces / Config

Add server-only config parsing near the suggestion route:

- `DEVICE_QUOTA_SUGGESTION_PROVIDER=supabase|vm|canary`, default `supabase`
- `DEVICE_QUOTA_SUGGESTION_CANARY_DON_VI_IDS=17,21`
- `DEVICE_QUOTA_VM_BASE_URL=https://<cloudflare-tunnel-hostname>`
- `DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_ID`
- `DEVICE_QUOTA_VM_CF_ACCESS_CLIENT_SECRET`
- `DQSS_INTERNAL_TOKEN`
- `DEVICE_QUOTA_VM_TIMEOUT_MS`, default `8000`
- `DEVICE_QUOTA_VM_MAX_RETRIES`, default `0` for the first canary
- `DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD`, default `3`
- `DEVICE_QUOTA_VM_CIRCUIT_WINDOW_MS`, default `60000`
- `DEVICE_QUOTA_VM_CIRCUIT_OPEN_MS`, default `60000`
- `DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES`, default `1000000`
- `DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_TTL_MS`, default `60000`
- `DEVICE_QUOTA_SUGGESTION_RESULT_CACHE_MAX_ENTRIES`, default `200`
- `DEVICE_QUOTA_SUGGESTION_COOLDOWN_MS`, default `10000`
- `DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_MAX`, default `3`
- `DEVICE_QUOTA_SUGGESTION_RATE_LIMIT_WINDOW_MS`, default `60000`

Response contract:

- Success remains UI-compatible: `{ result, meta }`.
- Controlled errors return `{ error, requestId, details? }` with `429`, `503`,
  or `413`.
- Logs include request ID, provider, selected policy, circuit state, cache hit,
  rate-limit/cooldown decision, VM provider/version/model, latency, payload
  bytes, and item counts. Logs must not include secrets.

## Task 1: Provider Config And Selection

**Files:**

- Modify: `src/app/api/device-quota/mapping/suggest/suggestion-types.ts`
- Modify: `src/app/api/device-quota/mapping/suggest/suggestion-service.ts`
- Test: `src/app/api/device-quota/mapping/suggest/__tests__/route.test.ts`

- [ ] Write failing tests for provider selection:
  - default provider is `supabase`
  - explicit `vm` selects VM provider
  - `canary` selects VM only for allow-listed `donViId`
  - non-allow-listed canary requests use Supabase
- [ ] Run the focused route test and verify it fails for missing config support.
- [ ] Implement the minimal config parser and provider-selection helper.
- [ ] Run the focused route test and verify it passes.

## Task 2: Split Existing Supabase Provider Before Adding VM Logic

**Files:**

- Modify: `src/app/api/device-quota/mapping/suggest/suggestion-service.ts`
- Create: provider/helper files under `src/app/api/device-quota/mapping/suggest/`
- Test: `src/app/api/device-quota/mapping/suggest/__tests__/suggestion-service.test.ts`

- [ ] Write or keep regression tests proving current Supabase preview semantics
  are unchanged.
- [ ] Split the current 363-line service before adding more logic:
  - access guard / orchestration stays route-owned
  - current Supabase embedding/search path becomes the Supabase provider
  - shared result merge/signature helpers stay reusable
- [ ] Verify Supabase tests still pass.

## Task 3: VM Client Through Cloudflare Tunnel

**Files:**

- Create: VM client module under `src/app/api/device-quota/mapping/suggest/`
- Test: route/service VM client tests in the same test folder

- [ ] Write failing tests that the VM client sends:
  - `POST ${DEVICE_QUOTA_VM_BASE_URL}/suggest`
  - `CF-Access-Client-Id`
  - `CF-Access-Client-Secret`
  - `X-Internal-Token`
  - `X-Request-Id`
- [ ] Write failing tests for timeout, structured 4xx/5xx/network errors, and
  missing env fail-fast behavior.
- [ ] Implement the VM client with `AbortController`, no browser exposure, and
  structured error mapping.
- [ ] Verify VM client tests pass.

## Task 4: VM Payload And Embedding-Space Separation

**Files:**

- Modify: VM provider/orchestration files from Task 2/3
- Test: `src/app/api/device-quota/mapping/suggest/__tests__/suggestion-service.test.ts`

- [ ] Write failing tests that the VM provider bundles only:
  - grouped distinct device names: `{ name, deviceIds }`
  - categories: `{ id, code, name, classification }`
  - signatures and ranking options
- [ ] Write failing tests that the VM normal path makes zero calls to
  `embed-device-name` and zero calls to `hybrid_search_category_batch`.
- [ ] Write failing tests that payloads above
  `DEVICE_QUOTA_VM_MAX_PAYLOAD_BYTES` return controlled `413` before calling VM.
- [ ] Implement the VM provider mapper and payload-size guard.
- [ ] Verify tests pass.

## Task 5: VM Performance Fixes Required Before Canary

**Files:**

- Modify: `services/device-quota-suggestion-service/app/service.py`
- Modify: VM service tests under `services/device-quota-suggestion-service/tests/`

- [ ] Write a failing service test proving device-name embeddings are batched
  for a facility-sized request, not computed one name at a time.
- [ ] Write a failing perf-shape test for 504 names, 291 categories, `topK=3`.
  The test should not download the real model; use deterministic embeddings and
  assert algorithmic call count / bounded runtime shape.
- [ ] Replace per-device embedding calls with batch embedding for missing
  device names.
- [ ] Avoid repeated cosine norm work for normalized embeddings; use dot product
  or a vectorized similarity path.
- [ ] Preserve cache keys with provider/version/model in the engine signature.
- [ ] Verify service tests pass.

Performance acceptance for canary:

- first uncached facility-17-sized request: target p95 under 20 seconds
- warm embedding cache: target p95 under 8 seconds
- route result-cache hit: target p95 under 1.5 seconds
- if these targets are not met in smoke, keep production on `supabase`

## Task 6: Circuit Breaker, No Runtime Fallback, And Anti-Spam

**Files:**

- Modify: route/provider orchestration files
- Test: route/service tests

- [ ] Write failing tests that repeated VM failures open the circuit.
- [ ] Write failing tests that open circuit returns controlled `503`.
- [ ] Write failing tests that Supabase provider is not called from `vm` or
  allow-listed `canary` when VM fails.
- [ ] Write failing tests for result-cache hit, cooldown `429`, burst
  rate-limit, and same-key single-flight/coalescing.
- [ ] Implement circuit breaker, bounded in-memory LRU TTL result cache,
  cooldown/rate limiter, and single-flight.
- [ ] Verify route/service tests pass.

## Task 7: UI-Safe Degraded States

**Files:**

- Modify only if current hook/dialog tests show unsafe behavior:
  `src/app/(app)/device-quota/mapping/_hooks/useSuggestMapping.ts`
- Test: `src/app/(app)/device-quota/mapping/__tests__/useSuggestMapping.test.ts`

- [ ] Write failing tests for `429`, `503`, and `413` response messages if the
  current hook does not surface them clearly.
- [ ] Make the smallest hook/dialog change needed to show the server message.
- [ ] Verify existing UI behavior is unchanged for normal success.

## Verification

Run final checks in this order for TypeScript / React diffs:

1. `node scripts/npm-run.js run verify:no-explicit-any`
2. `node scripts/npm-run.js run verify:dedupe`
3. `node scripts/npm-run.js run typecheck`
4. Focused Vitest:
   - `node scripts/npm-run.js run test:run src/app/api/device-quota/mapping/suggest/__tests__/route.test.ts src/app/api/device-quota/mapping/suggest/__tests__/suggestion-service.test.ts`
   - `node scripts/npm-run.js run test:run src/app/(app)/device-quota/mapping/__tests__/useSuggestMapping.test.ts`
5. VM service tests:
   - `cd services/device-quota-suggestion-service && PYTHONPATH=. <venv-python> -m pytest tests -q`
6. React Doctor diff:
   - `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
7. Smoke through Cloudflare Tunnel before enabling canary:
   - `/healthz` and `/readyz`
   - small `/suggest`
   - facility-17-sized synthetic or live-safe request
   - repeated identical request proves route cache and VM cache behavior

## Rollout

- Keep default `DEVICE_QUOTA_SUGGESTION_PROVIDER=supabase`.
- Provision Cloudflare Tunnel and Access service token before setting `vm` or
  `canary`.
- Start with `canary` for facility 17 only after performance smoke meets the
  targets above.
- Roll back by setting `DEVICE_QUOTA_SUGGESTION_PROVIDER=supabase`.
- Do not open the VM service port publicly during rollout or rollback.

