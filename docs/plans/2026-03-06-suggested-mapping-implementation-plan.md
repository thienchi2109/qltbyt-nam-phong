# Gợi ý phân loại — Revised Implementation Plan (v2)

Auto-suggest device-to-category mapping using Supabase Hybrid Search (tsvector + pgvector + RRF). Revised after [audit review](file:///C:/Users/admin/.gemini/antigravity/brain/a9635aa6-833f-4d04-91fc-1fc0a09505b4/plan_review.md) against codebase state.

Full design reference: [2026-03-06-suggested-mapping-design.md](file:///d:/qltbyt-nam-phong/docs/plans/2026-03-06-suggested-mapping-design.md)

## User Review Required

> [!IMPORTANT]
> **Architecture redesign**: Edge Function no longer orchestrates the full flow. Instead, a **client-side hook** (`useSuggestMapping`) orchestrates: it calls a lightweight Edge Function (`embed-device-name`) for embeddings only, then calls `hybrid_search_category` RPC through the existing `/api/rpc/[fn]` proxy. This fully respects the mandatory RPC-only security model from [CLAUDE.md](file:///d:/qltbyt-nam-phong/CLAUDE.md).

> [!WARNING]
> Processing ~200 unique device names generates ~200 sequential embedding calls + ~200 RPC calls. Total time ~10-30 seconds. A progress indicator (not just a spinner) showing "X/Y tên thiết bị đã xử lý" is essential.

> [!CAUTION]
> The `generate-category-embeddings` Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` — this is acceptable because it's a **one-time admin utility** called manually, not user-facing. It does NOT bypass the proxy for reads.

---

## Proposed Changes

### Database (Migration 1 of 2)

#### [NEW] `20260306205600_add_hybrid_search_category.sql`

Single migration that:

1. Enables `pgvector` extension: `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`
2. Adds `embedding extensions.vector(384)` column to `nhom_thiet_bi`
3. Adds `fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED` column
4. Creates GIN index on `fts`
5. Creates HNSW index: `USING hnsw (embedding extensions.vector_cosine_ops)` ← **fixed**: cosine ops
6. Creates `hybrid_search_category` RPC with full JWT guards + tenant isolation

**`hybrid_search_category` RPC** — Full security compliance:

```sql
CREATE OR REPLACE FUNCTION public.hybrid_search_category(
  p_query_text text,
  p_query_embedding extensions.vector(384),
  p_don_vi BIGINT DEFAULT NULL,          -- tenant isolation
  p_match_count int DEFAULT 3,
  p_full_text_weight float DEFAULT 1.0,
  p_semantic_weight float DEFAULT 1.0,
  p_rrf_k int DEFAULT 50
)
RETURNS TABLE (id int, ten_nhom text, ma_nhom text, phan_loai text, rrf_score float)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
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
  IF p_don_vi IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH full_text AS (
    SELECT ntb.id,
      row_number() OVER (ORDER BY ts_rank_cd(fts, plainto_tsquery('simple', p_query_text)) DESC) AS rank_ix
    FROM nhom_thiet_bi ntb
    WHERE ntb.don_vi_id = p_don_vi
      AND fts @@ plainto_tsquery('simple', p_query_text)
    ORDER BY rank_ix LIMIT p_match_count * 2
  ),
  semantic AS (
    SELECT ntb.id,
      row_number() OVER (ORDER BY ntb.embedding <=> p_query_embedding) AS rank_ix
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
  ORDER BY rrf_score DESC LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hybrid_search_category TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hybrid_search_category FROM PUBLIC;
```

---

### Database (Migration 2 of 2)

#### [NEW] `20260306205700_add_suggest_mapping_helper_rpcs.sql`

**1. `dinh_muc_thiet_bi_unassigned_names`** — Distinct device names (avoids 500-row cap):

```sql
-- Returns ~200 rows (unique names), not 2740 individual devices
-- Each row includes sample_ids (up to 500) for batch linking
RETURNS TABLE (ten_thiet_bi TEXT, device_count BIGINT, sample_ids BIGINT[])
```

**2. `dinh_muc_thiet_bi_link_batch`** — Batch link in single call (replaces N+1):

```sql
-- Accepts JSONB array: [{"nhom_id": 1, "thiet_bi_ids": [10,11,12]}, ...]
-- Executes all links in one transaction with per-group audit logging
RETURNS INT  -- total affected count
```

Both RPCs follow full security template: `SECURITY DEFINER SET search_path = public, pg_temp` + JWT guards + tenant isolation + `GRANT/REVOKE`.

---

### Edge Functions

#### [NEW] `embed-device-name/index.ts`

**Lightweight embedding-only** (replaces full orchestrator):

- Accepts `{ texts: string[] }` (batch up to 50)
- Uses `new Supabase.ai.Session('gte-small')` → 384d embeddings
- Returns `{ embeddings: number[][] }`
- `verify_jwt: true` — requires authenticated user
- **Zero database access** — pure embedding generation, ~50 lines

#### [NEW] `generate-category-embeddings/index.ts`

One-time admin utility (unchanged):
- `verify_jwt: false` — admin-only, manual invocation
- Uses `SUPABASE_SERVICE_ROLE_KEY` for batch DB update

---

### Frontend

#### [MODIFY] [DeviceQuotaMappingActions.tsx](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/DeviceQuotaMappingActions.tsx)

1. **Remove early-return** at L54 — bar always renders when `donViId` set
2. Add "Gợi ý phân loại" button (`Sparkles` icon, `variant="outline"`)
3. "Phân loại" button only visible when `canLink` is true (unchanged behavior)

#### [NEW] [SuggestedMappingPreviewDialog.tsx](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/SuggestedMappingPreviewDialog.tsx)

~300 lines. States: **Loading** → **Results** / **Error** → **Saving** → **Done**

- Progress indicator: "X/Y tên thiết bị đã xử lý" during Loading
- Confidence: ✅ High (≥0.03) / 🔶 Medium (0.015–0.03)
- Confirm: single `dinh_muc_thiet_bi_link_batch` call
- Error: retry button for timeout, toast for save failures
- Cache invalidation: all 4 queries (matches existing [invalidateAndRefetch](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx#L318-L323))

#### [NEW] [useSuggestMapping.ts](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_hooks/useSuggestMapping.ts)

Client-side orchestration hook:

```typescript
// Flow: all through proxy/Edge Function, no security bypass
// 1. callRpc('dinh_muc_thiet_bi_unassigned_names', {p_don_vi})
// 2. For each batch of 50 names:
//    a. Edge Function 'embed-device-name' → embeddings
//    b. For each name: callRpc('hybrid_search_category', {text, embedding, p_don_vi})
// 3. Group: score ≥ 0.015 → mapped, < 0.015 → unmatched
// 4. Return SuggestMappingResult with progress updates
```

#### [MODIFY] [route.ts](file:///d:/qltbyt-nam-phong/src/app/api/rpc/%5Bfn%5D/route.ts) — ALLOWED_FUNCTIONS

Add:
```typescript
'hybrid_search_category',
'dinh_muc_thiet_bi_unassigned_names',
'dinh_muc_thiet_bi_link_batch',
```

---

## Verification Plan

### Automated Tests

**Database** (after migration):
```sql
-- hybrid_search_category with tsvector only (embeddings not yet populated)
SELECT * FROM hybrid_search_category('Bơm tiêm điện', NULL::extensions.vector(384), <don_vi_id>, 3);
-- unassigned_names returns grouped data
SELECT * FROM dinh_muc_thiet_bi_unassigned_names(<don_vi_id>);
-- link_batch in single transaction
SELECT dinh_muc_thiet_bi_link_batch('[{"nhom_id":1,"thiet_bi_ids":[10,11]}]'::JSONB, <don_vi_id>);
```

**Frontend unit tests**:

| File | Run Command |
|------|------------|
| [DeviceQuotaMappingActions.test.tsx](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/__tests__/DeviceQuotaMappingActions.test.tsx) (add to existing) | `node scripts/npm-run.js run test:run -- --testPathPattern="DeviceQuotaMappingActions"` |
| `SuggestedMappingPreviewDialog.test.tsx` (new) | `node scripts/npm-run.js run test:run -- --testPathPattern="SuggestedMappingPreviewDialog"` |
| All mapping tests | `node scripts/npm-run.js run test:run -- --testPathPattern="device-quota/mapping"` |

### Manual Verification

1. Deploy Edge Functions, generate embeddings (one-time)
2. Navigate `/device-quota/mapping` → click "Gợi ý phân loại" → verify full flow
3. Run `get_advisors(security)` via Supabase MCP post-migration

---

## Changes vs Original Plan

| # | Issue | Original | Revised |
|---|-------|----------|---------|
| 1 | JWT guards | `LANGUAGE sql`, none | `plpgsql` + full guards |
| 2 | Proxy bypass | EF orchestrates with service role | Client-side via `callRpc()` |
| 3 | 500-row cap | Fetch all via unassigned RPC | New `unassigned_names` RPC |
| 4 | N+1 links | Sequential per group | `link_batch` single call |
| 5 | Tenant filter | Search all categories | `p_don_vi` on `don_vi_id` |
| 6 | Error UX | Loading → Preview only | + Error/Retry/PartialError |
| 7 | Visibility | Hidden when no selection | Always visible |
| 8 | Whitelist | Not mentioned | 3 RPCs added |
| 9 | Scope | Global 567 categories | Per-tenant |
| 10 | Threshold | 0.01 | 0.015 (matches design) |
| 11 | Cache | Partial | All 4 queries |
| 12 | Index | `vector_ip_ops` | `vector_cosine_ops` |
