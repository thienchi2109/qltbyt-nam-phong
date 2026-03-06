# Gợi ý phân loại — Implementation Plan (v3 — Batch)

Auto-suggest device-to-category mapping using Supabase Hybrid Search (tsvector + pgvector + RRF).
Full design: [2026-03-06-suggested-mapping-design.md](./2026-03-06-suggested-mapping-design.md)

## User Review Required

> [!IMPORTANT]
> **Architecture**: Client-side hook orchestrates via **batch** calls — only ~6 HTTP round trips total for ~200 unique device names. Edge Function handles embeddings only (zero DB access). All DB operations go through `/api/rpc/[fn]` proxy.

> [!WARNING]
> Total processing time: **2-5 seconds** (v3 batch) vs 10-30s (v1/v2 sequential). Still show a progress indicator for UX clarity.

> [!CAUTION]
> `generate-category-embeddings` uses `SUPABASE_SERVICE_ROLE_KEY` — acceptable as one-time admin utility, not user-facing.

---

## Performance: Batch vs Sequential

| Approach | HTTP Calls | Estimated Time |
|----------|-----------|---------------|
| v1 (EF orchestrate, security issues) | 1 | 10-30s |
| v2 (client sequential, compliant) | ~200 | 10-30s |
| **v3 (batch, compliant)** | **~6** | **2-5s** |

**v3 flow:**
1. `callRpc('dinh_muc_thiet_bi_unassigned_names')` → ~200 unique names (**1 call**)
2. Edge Function `embed-device-name` batches 50 names/call → **4 calls** → 200 embeddings
3. `callRpc('hybrid_search_category_batch')` → all 200 (text,embedding) pairs in **1 call**
4. Results → Preview Dialog → `callRpc('dinh_muc_thiet_bi_link_batch')` (**1 call**)

---

## Proposed Changes

### Database (Migration 1 of 2)

#### [NEW] `20260306205600_add_hybrid_search_category.sql`

1. Enables `pgvector`: `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`
2. Adds `embedding extensions.vector(384)` column to `nhom_thiet_bi`
3. Adds `fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED`
4. Creates GIN index on `fts`
5. Creates HNSW index: `USING hnsw (embedding extensions.vector_cosine_ops)`
6. Creates `hybrid_search_category_batch` RPC with JWT guards + tenant isolation

**`hybrid_search_category_batch` RPC** — Processes all names in single call:

```sql
CREATE OR REPLACE FUNCTION public.hybrid_search_category_batch(
  p_queries JSONB,        -- [{"text":"Bơm tiêm","embedding":[0.1,...]}, ...]
  p_don_vi BIGINT DEFAULT NULL,
  p_match_count int DEFAULT 1,
  p_full_text_weight float DEFAULT 1.0,
  p_semantic_weight float DEFAULT 1.0,
  p_rrf_k int DEFAULT 50
)
RETURNS JSONB  -- [{"query_text":"...","results":[{id,ten_nhom,ma_nhom,phan_loai,rrf_score}]}]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_query JSONB;
  v_query_text TEXT;
  v_query_embedding extensions.vector(384);
  v_results JSONB := '[]'::JSONB;
  v_matches JSONB;
BEGIN
  -- JWT claim guards per CLAUDE.md
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;
  IF p_don_vi IS NULL THEN RETURN '[]'::JSONB; END IF;

  -- Process each query
  FOR v_query IN SELECT * FROM jsonb_array_elements(p_queries)
  LOOP
    v_query_text := v_query->>'text';
    v_query_embedding := (v_query->>'embedding')::extensions.vector(384);

    SELECT jsonb_agg(row_to_json(r)) INTO v_matches
    FROM (
      WITH full_text AS (
        SELECT ntb.id,
          row_number() OVER (ORDER BY ts_rank_cd(fts, plainto_tsquery('simple', v_query_text)) DESC) AS rank_ix
        FROM nhom_thiet_bi ntb
        WHERE ntb.don_vi_id = p_don_vi
          AND fts @@ plainto_tsquery('simple', v_query_text)
        ORDER BY rank_ix LIMIT p_match_count * 2
      ),
      semantic AS (
        SELECT ntb.id,
          row_number() OVER (ORDER BY ntb.embedding <=> v_query_embedding) AS rank_ix
        FROM nhom_thiet_bi ntb
        WHERE ntb.don_vi_id = p_don_vi AND ntb.embedding IS NOT NULL
        ORDER BY rank_ix LIMIT p_match_count * 2
      )
      SELECT ntb.id, ntb.ten_nhom, ntb.ma_nhom, ntb.phan_loai,
        (COALESCE(1.0/(p_rrf_k + ft.rank_ix), 0.0) * p_full_text_weight +
         COALESCE(1.0/(p_rrf_k + s.rank_ix), 0.0) * p_semantic_weight)::float AS rrf_score
      FROM full_text ft
      FULL OUTER JOIN semantic s ON ft.id = s.id
      JOIN nhom_thiet_bi ntb ON COALESCE(ft.id, s.id) = ntb.id
      ORDER BY rrf_score DESC LIMIT p_match_count
    ) r;

    v_results := v_results || jsonb_build_object(
      'query_text', v_query_text,
      'results', COALESCE(v_matches, '[]'::JSONB)
    );
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hybrid_search_category_batch TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hybrid_search_category_batch FROM PUBLIC;
```

---

### Database (Migration 2 of 2)

#### [NEW] `20260306205700_add_suggest_mapping_helper_rpcs.sql`

**1. `dinh_muc_thiet_bi_unassigned_names`** — Distinct device names (avoids 500-row cap):

```sql
-- Returns ~200 rows (unique names), not 2740 individual devices
-- Each row: ten_thiet_bi, device_count, device_ids (all IDs with that name)
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned_names(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (ten_thiet_bi TEXT, device_count BIGINT, device_ids BIGINT[])
-- Full JWT guards + tenant isolation + SECURITY DEFINER
```

**2. `dinh_muc_thiet_bi_link_batch`** — Batch link in single transaction:

```sql
-- Accepts JSONB: [{"nhom_id": 1, "thiet_bi_ids": [10,11,12]}, ...]
-- Single transaction, per-group audit logging
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link_batch(
  p_mappings JSONB,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS INT  -- total affected count
-- Full JWT guards + tenant isolation + SECURITY DEFINER
-- Roles: global, admin, to_qltb
```

Both RPCs: `SECURITY DEFINER SET search_path = public, pg_temp` + JWT guards + `GRANT/REVOKE`.

---

### Edge Functions

#### [NEW] `embed-device-name/index.ts`

**Lightweight embedding-only** (~50 lines, zero DB access):

- Accepts `{ texts: string[] }` (batch up to 50)
- Uses `new Supabase.ai.Session('gte-small')` → 384d embeddings
- Returns `{ embeddings: number[][] }`
- `verify_jwt: true`

#### [NEW] `generate-category-embeddings/index.ts`

One-time admin utility:
- `verify_jwt: false` — admin-only, manual invocation
- Uses `SUPABASE_SERVICE_ROLE_KEY` for batch DB update
- Processes 567 categories in batches of 50

---

### Frontend

#### [MODIFY] `DeviceQuotaMappingActions.tsx`

1. **Remove early-return** at L54 — action bar always renders when `donViId` set
2. Add "Gợi ý phân loại" button (`Sparkles` icon, `variant="outline"`)
3. Opens `SuggestedMappingPreviewDialog` on click
4. "Phân loại" button only visible when `canLink` (unchanged)

#### [NEW] `SuggestedMappingPreviewDialog.tsx`

~300 lines. States: **Loading** → **Results** / **Error** → **Saving** → **Done**

- Progress indicator during Loading
- Grouped by category: accordion/collapsible
- Confidence badges: ✅ High (≥0.03) / 🔶 Medium (0.015–0.03)
- Exclude/restore per device + per group
- Unmatched section: "Chưa gợi ý được (N TB)"
- Confirm: single `dinh_muc_thiet_bi_link_batch` call
- Error state: retry button, toast for failures
- Cache invalidation: all 4 queries per existing `invalidateAndRefetch`

#### [NEW] `useSuggestMapping.ts`

Client-side batch orchestration:

```typescript
// ~6 total HTTP calls:
// 1× callRpc('dinh_muc_thiet_bi_unassigned_names', {p_don_vi})    → ~200 names
// 4× Edge Function 'embed-device-name' (50 names/batch)            → 200 embeddings
// 1× callRpc('hybrid_search_category_batch', {p_queries, p_don_vi}) → all matches

// Returns SuggestMappingResult:
interface SuggestMappingResult {
  suggestions: Array<{
    category: { id: number; ten_nhom: string; ma_nhom: string }
    confidence: 'high' | 'medium'
    rrf_score: number
    devices: Array<{ id: number; ten_thiet_bi: string }>
  }>
  unmatched: Array<{ ten_thiet_bi: string; device_ids: number[] }>
  stats: { total: number; matched: number; unmatched: number }
}
```

#### [MODIFY] `route.ts` — ALLOWED_FUNCTIONS

Add:
```typescript
'hybrid_search_category_batch',
'dinh_muc_thiet_bi_unassigned_names',
'dinh_muc_thiet_bi_link_batch',
```

---

## Verification Plan

### Automated Tests

**Database** (after migration):
```sql
-- batch search with tsvector only (embeddings not yet populated)
SELECT hybrid_search_category_batch(
  '[{"text":"Bơm tiêm điện","embedding":null}]'::JSONB, <don_vi_id>
);
-- unassigned_names
SELECT * FROM dinh_muc_thiet_bi_unassigned_names(<don_vi_id>);
-- link_batch
SELECT dinh_muc_thiet_bi_link_batch(
  '[{"nhom_id":1,"thiet_bi_ids":[10,11]}]'::JSONB, <don_vi_id>
);
```

**Frontend unit tests**:

| File | Scope |
|------|-------|
| `DeviceQuotaMappingActions.test.tsx` (extend) | "Gợi ý" button renders, opens dialog |
| `SuggestedMappingPreviewDialog.test.tsx` (new) | Grouped results, exclude/restore, confirm, error |
| `useSuggestMapping.test.ts` (new) | Batch orchestration, progress, error handling |

**Run**: `node scripts/npm-run.js run test:run -- --testPathPattern="device-quota/mapping"`

### Manual Verification

1. Deploy Edge Functions, generate embeddings (one-time)
2. Navigate `/device-quota/mapping` → click "Gợi ý phân loại" → verify full flow
3. Run `get_advisors(security)` via Supabase MCP post-migration

---

## Changes vs Original Plan

| # | Finding | Before | After |
|---|---------|--------|-------|
| 1 | JWT guards | `LANGUAGE sql`, none | `plpgsql` + full guards |
| 2 | Proxy bypass | EF orchestrates with service role | Client-side via `callRpc()` |
| 3 | 500-row cap | Fetch all via unassigned RPC | New `unassigned_names` RPC |
| 4 | N+1 links | Sequential per group | `link_batch` single call |
| 5 | Tenant filter | Search all categories | `p_don_vi` on `don_vi_id` |
| 6 | Error UX | Loading → Preview only | + Error/Retry states |
| 7 | Visibility | Hidden when no selection | Always visible |
| 8 | Whitelist | Not mentioned | 3 RPCs added |
| 9 | Scope | Global 567 categories | Per-tenant |
| 10 | Threshold | 0.01 | 0.015 (matches design) |
| 11 | Cache | Partial | All 4 queries |
| 12 | Index ops | `vector_ip_ops` | `vector_cosine_ops` |
| **13** | **Performance** | **~200 calls, 10-30s** | **~6 calls, 2-5s** |
