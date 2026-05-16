# Device Quota Suggestion Service on VM

GitHub issue: <https://github.com/thienchi2109/qltbyt-nam-phong/issues/490>

## Context

The current `/device-quota/mapping` suggested-mapping flow helps users map
unassigned equipment into `nhom_thiet_bi` categories. The feature is useful, but
the expensive part currently runs through Supabase Free-tier AI/vector
infrastructure:

1. The user opens `Goi y phan loai` from the mapping action bar.
2. `useSuggestMapping` fetches all distinct unassigned equipment names for the
   selected facility.
3. The browser calls `/api/embeddings/generate` in chunks of 10 names.
4. That route proxies to the Supabase Edge Function `embed-device-name`.
5. The browser then calls `hybrid_search_category_batch` in chunks of 10 query
   embeddings.
6. The hook groups the best result per device name and the user confirms the
   final mapping.

The Oracle VM already has Docker and Coolify installed. It is a better fit for
the CPU/RAM-heavy embedding and matching workload than Supabase Free Edge
Functions.

## Current Evidence

Code anchors:

- UI entrypoint: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingActions.tsx`
- Orchestration hook: `src/app/(app)/device-quota/mapping/_hooks/useSuggestMapping.ts`
- Embedding proxy: `src/app/api/embeddings/generate/route.ts`
- Edge Function: `supabase/functions/embed-device-name/index.ts`
- Hybrid search RPC: `supabase/migrations/2026-03-07/20260307120000_add_hybrid_search_category.sql`
- Helper RPC: `supabase/migrations/2026-03-07/20260307120100_add_suggest_mapping_helper_rpcs.sql`

Live DB read-only checks on 2026-05-16:

- `nhom_thiet_bi` category counts:
  - facility 17: 291 categories, 291 with embeddings
  - facility 21: 276 categories, 276 with embeddings
- unassigned equipment:
  - facility 17: 1,940 rows, 504 distinct unassigned names
  - facility 21: 1,052 rows, 350 distinct unassigned names
  - facility 26: 117 rows, 50 distinct unassigned names
  - facility 24: 49 rows, 28 distinct unassigned names
  - facility 25: 9 rows, 8 distinct unassigned names
- `vector` and `pg_trgm` extensions are enabled.
- `nhom_thiet_bi.embedding` is `extensions.vector(384)`.
- There is no vector index on `nhom_thiet_bi.embedding`; current SQL intentionally
  does an exact scan because the category set is small.

The current batch limit is intentional:

- `src/app/api/embeddings/generate/route.ts` has `MAX_BATCH_SIZE = 10`.
- `supabase/functions/embed-device-name/index.ts` documents Free-tier 512 MB RAM
  and notes that batch 10 works while batch 20 caused a `546`.
- `scripts/device-quota/backfill-category-embeddings.ts` is even more
  conservative with batch size 5 for backfill.

For facility 17, one suggestion run can require roughly 51 embedding batches and
51 search batches. The main pain is not just pgvector search; it is the whole
client-driven, small-batch pipeline.

## Proposed Direction

Create a separate service on the VM:

`device-quota-suggestion-service`

This service should replace the expensive preview pipeline only. It should not
replace Supabase as the source of truth.

Recommended responsibility split:

- Supabase remains source of truth for equipment, categories, tenant access, and
  final writes.
- The Next.js app remains responsible for session auth and role/facility checks.
- The VM service handles embedding generation and in-memory matching for one
  selected facility at a time.
- The existing `dinh_muc_thiet_bi_link_batch` RPC remains the final write path.

## Recommended Architecture

### Phase 1: Stateless Suggestion Service

The first implementation should be stateless and simple:

1. Next.js server route receives a user request for suggested mapping.
2. It validates session, role, and selected facility using existing app patterns.
3. It fetches:
   - distinct unassigned names via `dinh_muc_thiet_bi_unassigned_names`
   - categories via `dinh_muc_nhom_list`
4. It sends only the selected facility's device names and category list to the VM
   service.
5. The VM service computes:
   - lexical score from normalized text tokens
   - semantic score from local embeddings
   - combined ranking with an RRF-like formula
6. The VM service returns suggestions in the same logical shape expected by the
   current preview dialog.

This keeps the service independent of Supabase credentials in phase 1. It also
preserves the app's current tenant and role boundaries.

### API Contract Sketch

Request:

```json
{
  "requestId": "uuid-or-ulid",
  "facilityId": 17,
  "deviceNames": [
    {
      "name": "Monitor theo doi benh nhan",
      "deviceIds": [1, 2, 3]
    }
  ],
  "categories": [
    {
      "id": 291,
      "code": "03.02.001",
      "name": "Monitor theo doi benh nhan",
      "classification": "..."
    }
  ],
  "options": {
    "matchCount": 1,
    "semanticWeight": 1,
    "lexicalWeight": 1
  }
}
```

Response:

```json
{
  "requestId": "uuid-or-ulid",
  "groups": [
    {
      "nhom_id": 291,
      "nhom_label": "Monitor theo doi benh nhan",
      "nhom_code": "03.02.001",
      "phan_loai": null,
      "score": 0.91,
      "device_names": ["Monitor theo doi benh nhan"],
      "device_ids": [1, 2, 3],
      "device_name_to_ids": {
        "Monitor theo doi benh nhan": [1, 2, 3]
      }
    }
  ],
  "unmatched": [],
  "totalDevices": 3,
  "matchedDevices": 3,
  "metrics": {
    "deviceNameCount": 1,
    "categoryCount": 291,
    "durationMs": 120,
    "model": "gte-small-compatible"
  }
}
```

### Authentication

Use service-to-service authentication:

- Next.js calls the VM service from server-side code only.
- The VM service is not called directly from the browser.
- Use a shared secret header such as `X-Internal-Token`.
- Store the token in environment-managed secrets and define a rotation policy,
  including dual-key rollover so deployment does not require downtime.
- Require replay resistance with a short-lived signed token such as HMAC/JWT
  using `iat`/`exp`; add nonce reuse checks only when a shared nonce store is in
  place.
- Keep the service behind Coolify/Traefik with TLS.
- Prefer IP allow-listing or private network access if the deployment topology
  allows it.
- The VM service should not receive `SUPABASE_SERVICE_ROLE_KEY` in phase 1.

### Model Choice

There are two viable model strategies:

1. Keep a `gte-small` compatible model first.
   - Lowest behavioral drift.
   - Embeddings remain 384 dimensions.
   - Easier to compare against current Supabase output.
   - Still not ideal for Vietnamese, but matches current behavior.

2. Move to a multilingual embedding model.
   - Better long-term fit for Vietnamese equipment/category names.
   - Requires re-evaluating suggestion quality.
   - Existing stored category embeddings in Supabase become incompatible.

Recommended first pass: keep the model family compatible enough to preserve the
current behavior, then run an explicit A/B evaluation before changing model
semantics.

### Why Not Qdrant First

Qdrant is not needed in the first phase.

Current category counts are tiny: 291 and 276 categories for the main facilities.
An in-memory exact cosine scan is simpler, easier to deploy, and easier to
debug. Qdrant can be added later if one of these becomes true:

- category count grows to tens of thousands
- multiple domains need vector search
- suggestion requests become high-concurrency
- persistent vector indexes and cache warming become operationally useful

## Rollout Plan

### Step 1: Baseline Current Flow

Measure the current flow before changing it:

- number of distinct names per facility
- embedding duration
- hybrid search duration
- total suggestion duration
- failure rate
- percentage matched
- manual acceptance rate after preview

Use facility 17 as the main stress case because it currently has 504 distinct
unassigned names.

### Step 2: Build VM Service Behind Feature Flag

Add an app-level feature flag:

- `DEVICE_QUOTA_SUGGESTION_PROVIDER=supabase`
- `DEVICE_QUOTA_SUGGESTION_PROVIDER=vm`

The existing flow remains the fallback path.

### Step 3: Server-Side Route Integration

Add a Next.js server route that owns the full suggestion pipeline:

- validates auth/session/role/facility
- fetches names/categories from Supabase through existing RPCs
- calls the VM service once with an explicit timeout, bounded retries, exponential
  backoff with jitter, and circuit-breaker protection
- maps response to the existing dialog shape

The browser should stop orchestrating dozens of embedding/search batches.

The VM call policy should be configurable through app env values such as:

- `DEVICE_QUOTA_VM_TIMEOUT_MS`
- `DEVICE_QUOTA_VM_MAX_RETRIES`
- `DEVICE_QUOTA_VM_BACKOFF_BASE_MS`
- `DEVICE_QUOTA_VM_CIRCUIT_THRESHOLD`
- `DEVICE_QUOTA_VM_CIRCUIT_WINDOW_MS`

The route should fall back immediately to the `supabase` provider when the VM
request times out, exhausts its retry budget, returns repeated 5xx responses, or
the circuit is open. Logs/metrics should include timeout, retry count, provider,
circuit state, and fallback reason.

### Step 4: Canary

Enable the VM provider for internal users or a single facility first.

Go/no-go checks:

- no role/facility boundary regression
- matched count is comparable to current flow
- suggestion duration is materially lower
- no VM OOM or process restart
- fallback to Supabase provider works

### Step 5: Optional Persistent Cache

Only add cache after the stateless service works.

Useful cache keys:

- normalized category name -> embedding
- normalized device name -> embedding
- facility category catalog version

Cache invalidation can follow category create/update/import events.

## Acceptance Criteria

- The VM service can process at least 600 distinct device names against 300
  categories in one request without OOM.
- Suggestion preview returns one response from the app route instead of 50+
  embedding/search batches from the browser.
- Existing roles remain enforced:
  - write-capable roles can save mappings
  - regional leaders can preview only within allowed facilities
  - restricted roles cannot call the suggestion route
- Existing `dinh_muc_thiet_bi_link_batch` remains the only batch write path.
- A feature flag can switch back to the current Supabase path without redeploying
  DB schema.
- VM call behavior is implemented with timeout, bounded retry/backoff, circuit
  breaker, and fast fallback to the `supabase` provider on timeout/5xx/open
  circuit.
- Logs include request ID, facility ID, item counts, duration, provider, and
  failure reason without logging secrets.
- Basic load test and one real facility smoke test are documented.

## Risks

- Model drift can change suggested categories. Mitigation: keep compatible model
  first and compare a fixed sample set before rollout.
- Moving the orchestration server-side can accidentally broaden facility access.
  Mitigation: keep all auth/facility checks in the Next.js route and do not give
  the VM service Supabase credentials in phase 1.
- VM service may become an unmonitored dependency. Mitigation: add health check,
  uptime monitor, structured logs, restart policy, and fallback provider.
- Network latency from app host to VM can offset gains if app remains on Vercel.
  Mitigation: still worthwhile because current flow is many calls; if app later
  moves to Coolify, service and app can sit near each other.

## Open Questions

- Should phase 1 preserve `gte-small` behavior, or intentionally evaluate a
  multilingual embedding model for Vietnamese?
- Should the VM service live inside this repository, or in a separate repository
  with its own deployment lifecycle?
- Should suggestion result quality be measured by manual user acceptance, a
  curated fixture set, or both?
- Should category embeddings continue to be stored in Supabase after the VM
  service exists, or become a service-local cache only?

## Recommendation

Build `device-quota-suggestion-service` as a small stateless Docker service
first. Do not introduce Qdrant or Supabase self-hosting in the first PR. The
largest immediate win is removing Supabase Free Edge Function memory pressure
and replacing the browser-driven 10-item batch pipeline with one server-side
suggestion request.
