# Gợi ý phân loại — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng luồng gợi ý phân loại cho toàn bộ thiết bị chưa gán của một đơn vị, cho phép role có quyền ghi xem trước và lưu hàng loạt, đồng thời giữ hiệu năng, tính đúng và an toàn dữ liệu ổn định ở quy mô hiện tại.

**Architecture:** Client-side hook điều phối các call theo batch/chunk qua `/api/rpc/[fn]`, cộng thêm một Edge Function chỉ dùng để sinh embedding. Tìm category dùng hybrid search gồm full-text + exact cosine similarity trên tập category của đúng tenant; chưa dùng ANN/HNSW ở v1 vì số lượng category hiện còn nhỏ và độ chính xác quan trọng hơn throughput. Suggested save là **một command riêng** với manual flow hiện tại: manual flow vẫn là `1 category -> many devices` qua `dinh_muc_thiet_bi_link`, còn suggested flow commit **nhiều group `1 category -> many devices` trong một lần xác nhận** qua `dinh_muc_thiet_bi_link_batch`. Batch save phải race-safe: chỉ link những thiết bị vẫn còn chưa gán tại thời điểm lưu, không cho một `device_id` xuất hiện ở nhiều group trong cùng payload, và phải trả về summary các row bị skip.

**Tech Stack:** Next.js App Router, React/TypeScript, Supabase RPC, Supabase Edge Functions, Postgres `tsvector`, `pgvector`, React Query.

---

## Locked Decisions

- Scope: "Gợi ý phân loại" chạy trên **toàn bộ thiết bị chưa gán của đơn vị đang chọn**, không phụ thuộc filter/search đang hiển thị.
- Permissions: `global`, `admin`, `to_qltb` được gợi ý + lưu. `regional_leader` chỉ được xem preview, không được lưu.
- Chunking: `embed-device-name` và `hybrid_search_category_batch` chạy theo chunk **50 item/lần** để giữ headroom so với giới hạn body 2MB của RPC proxy.
- Embedding lifecycle: backfill 1 lần bằng utility chạy ở server tin cậy; refresh tự động chỉ cho các luồng thực sự làm thay đổi category.
- Security: không deploy public function `verify_jwt = false` với `SUPABASE_SERVICE_ROLE_KEY`.
- Save model: manual mapping hiện tại **giữ nguyên** contract `selectedCategoryId + selectedEquipmentIds -> dinh_muc_thiet_bi_link`; suggested mapping là flow riêng với payload grouped theo category.
- Suggested payload invariant: trong một lần xác nhận suggested mapping, mỗi `device_id` chỉ được phép xuất hiện **tối đa một lần** trên toàn bộ `p_mappings`.
- Frontend reuse: ưu tiên **tận dụng `DeviceQuotaMappingActions.tsx` và refactor các phần tái sử dụng được từ `DeviceQuotaMappingPreviewDialog.tsx`** thay vì tạo thêm một preview dialog monolith.
- File-size guard: không để bất kỳ file preview-related nào vượt khoảng **350 lines**; nếu có nguy cơ vượt ngưỡng, tách theo trách nhiệm trước khi thêm logic mới.

## Performance And Concurrency Decisions

1. **Exact semantic scan trước, ANN sau nếu benchmark thật sự cần**
   - Không tạo HNSW ở v1.
   - Lý do: hiện chỉ khoảng `567` category tổng cộng; query semantic luôn bị filter theo tenant. Exact scan trên tập category của tenant đơn giản hơn, đúng 100%, ít tuning, và tránh nhược điểm recall của ANN khi kết hợp thêm filter.
   - Nếu sau benchmark thực tế exact scan không đạt yêu cầu, tạo follow-up migration riêng để thêm ANN sau.

2. **Index đúng query shape cho `dinh_muc_thiet_bi_unassigned_names`**
   - Bổ sung partial composite index cho pattern `WHERE don_vi = ? AND nhom_thiet_bi_id IS NULL GROUP BY ten_thiet_bi`.
   - Đề xuất:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_thiet_bi_unassigned_name_by_unit
   ON public.thiet_bi (don_vi, ten_thiet_bi)
   WHERE nhom_thiet_bi_id IS NULL;
   ```

3. **Race-safe batch save**
   - `dinh_muc_thiet_bi_link_batch` chỉ được update các row vẫn còn `nhom_thiet_bi_id IS NULL` tại thời điểm lưu.
   - Không được ghi đè mapping vừa được người khác phân loại thủ công sau lúc preview.
   - Về mặt domain, `dinh_muc_thiet_bi_link_batch` là tập hợp của nhiều thao tác `1 category -> many devices` trong một transaction; không mở rộng manual flow hiện tại thành mô hình many-to-many mơ hồ.
   - Một `device_id` không được xuất hiện ở nhiều `nhom_id` khác nhau trong cùng payload; RPC phải validate và fail sớm nếu payload sai.
   - RPC nên trả về `JSONB` summary thay vì chỉ `INT`, để UI hiện được số lượng/link bị skip do stale preview.

4. **Refresh embedding theo batch, không N+1**
   - Refresh helper nhận `category_ids[]`.
   - Helper phải đọc lại row hiện tại từ DB rồi mới sinh embedding để tránh stale write.
   - Chỉ hook vào `dinh_muc_nhom_upsert` và `dinh_muc_nhom_bulk_import`.
   - **Không** refresh sau `dinh_muc_unified_import` vì luồng đó chỉ import quota line items, không sửa `nhom_thiet_bi`.

5. **Giữ nhận định hiệu năng thực tế, không hứa quá mức**
   - Cải thiện chính của v3 đến từ giảm HTTP round trips (`~200` xuống `~10`), không phải do SQL bên trong đã hoàn toàn set-based.
   - `hybrid_search_category_batch` vẫn xử lý từng query bên trong DB, nhưng chấp nhận được ở quy mô hiện tại.

---

## Delivery Phases

### Phase 0 — Chốt nền tảng kỹ thuật

**Mục tiêu:** Khóa các quyết định hiệu năng và dữ liệu trước khi bắt đầu code.

**Files:**
- Modify: `docs/plans/2026-03-06-suggested-mapping-implementation-plan.md`
- Modify: `docs/plans/2026-03-06-suggested-mapping-design.md`

**Tasks:**
- [ ] Chốt exact semantic scan cho v1, không thêm HNSW trong migration đầu tiên.
- [ ] Chốt partial index cho query `unassigned_names`.
- [ ] Chốt command model: manual flow giữ `dinh_muc_thiet_bi_link`; suggested flow dùng `dinh_muc_thiet_bi_link_batch` với grouped payload riêng.
- [ ] Chốt contract race-safe cho `dinh_muc_thiet_bi_link_batch`.
- [ ] Chốt lifecycle refresh embedding và loại `dinh_muc_unified_import` khỏi danh sách refresh.
- [ ] Chốt chiến lược reuse component và giới hạn file-size cho preview UI.

**Exit criteria:** Design doc và implementation plan thống nhất hoàn toàn về query shape, index strategy, permission, concurrency guard, và interaction model giữa manual flow với suggested flow.

### Phase 1 — Schema nền và read-path RPCs

**Mục tiêu:** Hoàn thiện dữ liệu và RPC đọc để preview có thể chạy end-to-end.

**Files:**
- Create: `supabase/migrations/20260306205600_add_hybrid_search_category.sql`
- Create: `supabase/migrations/20260306205700_add_suggest_mapping_helper_rpcs.sql`
- Modify: `src/app/api/rpc/[fn]/route.ts`

**Tasks:**
- [ ] Enable `vector` extension nếu chưa có.
- [ ] Thêm `embedding extensions.vector(384)` vào `nhom_thiet_bi`.
- [ ] Thêm `fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED`.
- [ ] Tạo GIN index cho `fts`.
- [ ] Tạo partial index `idx_thiet_bi_unassigned_name_by_unit` trên `public.thiet_bi (don_vi, ten_thiet_bi) WHERE nhom_thiet_bi_id IS NULL`.
- [ ] Implement `hybrid_search_category_batch` với đầy đủ JWT guards: `role`, `user_id`, mandatory `don_vi` guard cho non-global users, tenant isolation, null-safe fallback, exact cosine scan.
- [ ] Implement `dinh_muc_thiet_bi_unassigned_names` với JWT guards, tenant isolation, grouping theo tên thiết bị.
- [ ] Whitelist 2 RPC mới trong `/api/rpc/[fn]`.

**Exit criteria:** Có thể gọi `dinh_muc_thiet_bi_unassigned_names` và `hybrid_search_category_batch` qua proxy với tenant rules đúng; `hybrid_search_category_batch` phải fail sớm với `Missing don_vi claim` cho malformed non-global JWT và không lỗi khi `embedding = null`.

### Phase 2 — Embedding lifecycle

**Mục tiêu:** Hoàn thiện đường sinh embedding cho thiết bị và lifecycle giữ category embeddings luôn mới.

**Files:**
- Create: `supabase/functions/embed-device-name/index.ts`
- Create: `scripts/device-quota/backfill-category-embeddings.ts`
- Create or Modify: protected server helper/route dùng để refresh category embeddings
- Modify: luồng category create/update/import phía server để gọi refresh helper

**Tasks:**
- [ ] Tạo Edge Function `embed-device-name` chỉ nhận `{ texts: string[] }` và trả về `{ embeddings }`.
- [ ] Viết backfill script chạy theo batch 50 category/lần.
- [ ] Viết protected refresh helper nhận `category_ids[]` và xử lý theo batch.
- [ ] Hook helper sau `dinh_muc_nhom_upsert`.
- [ ] Hook helper sau `dinh_muc_nhom_bulk_import`.
- [ ] Ghi rõ `dinh_muc_unified_import` không gọi refresh vì không đổi category.

**Exit criteria:** Category mới/sửa/import category có embedding mới; unified import quota không kích hoạt refresh thừa.

### Phase 3 — Frontend preview flow

**Mục tiêu:** Người dùng chạy gợi ý, xem preview grouped theo category và hiểu rõ scope mà không làm méo model `1 category -> many devices` của manual flow hiện tại.

**Files:**
- Modify: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingActions.tsx`
- Refactor: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingPreviewDialog.tsx`
- Create: `src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx`
- Create: `src/app/(app)/device-quota/mapping/_components/SuggestedMappingPreviewDialog.tsx`
- Create: `src/app/(app)/device-quota/mapping/_components/SuggestedMappingGroupSection.tsx`
- Create: `src/app/(app)/device-quota/mapping/_components/SuggestedMappingUnmatchedSection.tsx`
- Create: `src/app/(app)/device-quota/mapping/_hooks/useSuggestMapping.ts`
- Modify: `src/app/(app)/device-quota/mapping/__tests__/DeviceQuotaMappingActions.test.tsx`
- Modify: `src/app/(app)/device-quota/mapping/__tests__/DeviceQuotaMappingPreviewDialog.test.tsx`
- Create: `src/app/(app)/device-quota/mapping/__tests__/SuggestedMappingPreviewDialog.test.tsx`

**Concrete split proposal:**
- `DeviceQuotaMappingActions.tsx`: giữ vai trò action bar hiện có, chỉ thêm wiring cho nút "Gợi ý phân loại".
- `DeviceQuotaMappingPreviewDialog.tsx`: giữ nguyên manual flow `1 category -> many devices` hiện tại, nhưng refactor để dùng shared preview primitives.
- `MappingPreviewPrimitives.tsx`: file shared cho preview flows, gồm dialog shell, footer note, count badge, loading skeleton, equipment row với exclude/restore.
- `SuggestedMappingPreviewDialog.tsx`: thin container cho suggested flow; chỉ giữ state machine grouped-by-category, orchestration result binding, save action, và compose các section con.
- `SuggestedMappingGroupSection.tsx`: render một nhóm category được gợi ý.
- `SuggestedMappingUnmatchedSection.tsx`: render section "Chưa gợi ý được".

**Tasks:**
- [ ] Tận dụng `DeviceQuotaMappingActions.tsx` làm action bar hiện hữu; không tạo thêm footer/action component mới chỉ để phục vụ suggested flow.
- [ ] Refactor `DeviceQuotaMappingPreviewDialog.tsx` để trích các phần có thể dùng chung vào `MappingPreviewPrimitives.tsx`: dialog shell/header-footer pattern, count badge, loading skeleton, item row với exclude/restore.
- [ ] Tạo `SuggestedMappingPreviewDialog.tsx` như **thin container**; không nhồi toàn bộ rendering logic của grouped results và unmatched results vào đây, và không reuse trực tiếp manual confirm contract kiểu `targetCategory + confirmedIds`.
- [ ] Tách `SuggestedMappingGroupSection.tsx` để render mỗi nhóm category được gợi ý.
- [ ] Tách `SuggestedMappingUnmatchedSection.tsx` để render section "Chưa gợi ý được".
- [ ] Thêm note footer bắt buộc, dùng lại ở preview flow phù hợp: `"Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu"`.
- [ ] Giữ mỗi file preview-related dưới khoảng 350 lines; nếu một file tiến gần 250-300 lines thì tách trách nhiệm sớm.
- [ ] Implement hook orchestration: `unassigned_names` → `embed-device-name` theo chunk 50 → `hybrid_search_category_batch` theo chunk 50.
- [ ] Hiển thị progress/loading rõ trong dialog.
- [ ] Hiển thị grouped results, unmatched results, exclude/restore per item và per group.
- [ ] Suggested preview phải giữ state theo grouped mappings, ví dụ `{ nhom_id, nhom_label, thiet_bi_ids[] }[]`; không phụ thuộc `selectedCategoryId` của manual flow.
- [ ] Nút xác nhận của suggested flow phải phản ánh đây là nhiều group được áp dụng trong một lần lưu, ví dụ `Áp dụng 12 gợi ý phân loại`, không dùng wording dễ hiểu nhầm là single-category manual save.
- [ ] `regional_leader` chỉ xem preview, không có save action.
- [ ] Mở rộng test hiện có và thêm test mới cho suggested preview; không tạo test harness song song nếu logic có thể bám theo shared preview primitives.

**Exit criteria:** Preview chạy được end-to-end cho role đọc và role ghi; kiến trúc UI reuse tối đa component hiện có, footer disclaimer luôn hiển thị ở suggested preview, manual flow vẫn giữ contract `1 category -> many devices`, và không sinh thêm file preview monolith.

### Phase 4 — Save path an toàn và audit

**Mục tiêu:** Lưu batch trong một transaction mà không ghi đè dữ liệu mới hơn.

**Files:**
- Create or extend: `supabase/migrations/20260306205700_add_suggest_mapping_helper_rpcs.sql`
- Modify: thin suggested-preview container / shared preview subcomponents trong `src/app/(app)/device-quota/mapping/_components/`
- Modify: `src/app/(app)/device-quota/mapping/_hooks/useSuggestMapping.ts`

**Tasks:**
- [ ] Implement `dinh_muc_thiet_bi_link_batch`.
- [ ] `dinh_muc_thiet_bi_link_batch` nhận payload grouped theo category, ví dụ `[{ "nhom_id": 1, "thiet_bi_ids": [10, 11] }, { "nhom_id": 2, "thiet_bi_ids": [12] }]`.
- [ ] Validate payload để fail sớm nếu cùng một `device_id` xuất hiện ở nhiều group khác nhau trong cùng request.
- [ ] Giữ `dinh_muc_thiet_bi_link` nguyên trạng cho manual flow; suggested save không được bẻ sang reuse manual mutation signature.
- [ ] Contract trả về `JSONB` summary, ví dụ:
  ```sql
  {"affected_count": 120, "skipped_already_assigned": 7, "skipped_not_found": 2}
  ```
- [ ] Update SQL chỉ áp dụng cho row còn `nhom_thiet_bi_id IS NULL`.
- [ ] Ghi audit log theo từng mapping group đã lưu thành công.
- [ ] Chặn `regional_leader` ở cả UI lẫn RPC.
- [ ] UI hiển thị thông tin nếu có row bị skip do stale preview hoặc concurrent update.
- [ ] Sau khi lưu, invalidate/refetch đầy đủ các query liên quan.

**Exit criteria:** Save là idempotent và race-safe; stale preview không thể ghi đè mapping vừa được cập nhật bởi người khác.

### Phase 5 — Verification và benchmark gate

**Mục tiêu:** Xác nhận tính đúng và kiểm chứng exact scan có đủ nhanh hay không.

**Files:**
- Modify: test files cho mapping flow
- Use: Supabase MCP `get_advisors(security)` sau migration

**Tasks:**
- [ ] SQL smoke test cho `hybrid_search_category_batch` với `embedding = null`.
- [ ] SQL smoke test cho `dinh_muc_thiet_bi_unassigned_names`.
- [ ] SQL smoke test cho `dinh_muc_thiet_bi_link_batch` với case stale preview.
- [ ] SQL smoke test để xác nhận payload duplicate `device_id` across groups bị reject.
- [ ] Frontend unit tests cho button, preview dialog, chunk orchestration, preview-only flow.
- [ ] Frontend unit tests để xác nhận manual flow vẫn gọi `dinh_muc_thiet_bi_link`, còn suggested flow gọi `dinh_muc_thiet_bi_link_batch`.
- [ ] Chạy `EXPLAIN (ANALYZE, BUFFERS)` cho query `dinh_muc_thiet_bi_unassigned_names` trên tenant có dữ liệu thật.
- [ ] Chạy benchmark đại diện cho end-to-end suggestion flow.
- [ ] Chỉ khi benchmark không đạt mục tiêu mới mở follow-up plan để thêm ANN/HNSW.
- [ ] Chạy `get_advisors(security)` sau migration.

**Exit criteria:** Flow hoạt động đúng, exact scan đạt mục tiêu thực tế ở dataset hiện tại, hoặc có follow-up plan rõ ràng nếu benchmark chứng minh cần ANN.

---

## Detailed Changes

### Database (Migration 1 of 2)

#### [NEW] `20260306205600_add_hybrid_search_category.sql`

1. Enable `pgvector`: `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`
2. Add `embedding extensions.vector(384)` to `nhom_thiet_bi`
3. Add `fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED`
4. Create GIN index on `fts`
5. Create `hybrid_search_category_batch` RPC with JWT guards + tenant isolation + exact semantic scan
6. **Do not create HNSW in v1**

**`hybrid_search_category_batch` RPC** — Processes one chunk at a time (recommended: max 50 queries/call):

```sql
CREATE OR REPLACE FUNCTION public.hybrid_search_category_batch(
  p_queries JSONB,
  p_don_vi BIGINT DEFAULT NULL,
  p_match_count INT DEFAULT 1,
  p_full_text_weight FLOAT DEFAULT 1.0,
  p_semantic_weight FLOAT DEFAULT 1.0,
  p_rrf_k INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
  v_query JSONB;
  v_query_text TEXT;
  v_query_embedding extensions.vector(384);
  v_results JSONB := '[]'::JSONB;
  v_matches JSONB;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  FOR v_query IN SELECT * FROM jsonb_array_elements(p_queries)
  LOOP
    v_query_text := NULLIF(BTRIM(v_query->>'text'), '');
    IF jsonb_typeof(v_query->'embedding') = 'array' THEN
      v_query_embedding := (v_query->>'embedding')::extensions.vector(384);
    ELSE
      v_query_embedding := NULL;
    END IF;

    SELECT jsonb_agg(row_to_json(r)) INTO v_matches
    FROM (
      WITH tenant_categories AS (
        SELECT id, ten_nhom, ma_nhom, phan_loai, fts, embedding
        FROM public.nhom_thiet_bi
        WHERE don_vi_id = p_don_vi
      ),
      full_text AS (
        SELECT tc.id,
          row_number() OVER (
            ORDER BY ts_rank_cd(tc.fts, plainto_tsquery('simple', v_query_text)) DESC, tc.id
          ) AS rank_ix
        FROM tenant_categories tc
        WHERE v_query_text IS NOT NULL
          AND tc.fts @@ plainto_tsquery('simple', v_query_text)
        LIMIT p_match_count * 2
      ),
      semantic AS (
        SELECT tc.id,
          row_number() OVER (
            ORDER BY tc.embedding <=> v_query_embedding, tc.id
          ) AS rank_ix
        FROM tenant_categories tc
        WHERE v_query_embedding IS NOT NULL
          AND tc.embedding IS NOT NULL
        LIMIT p_match_count * 2
      )
      SELECT tc.id, tc.ten_nhom, tc.ma_nhom, tc.phan_loai,
        (COALESCE(1.0 / (p_rrf_k + ft.rank_ix), 0.0) * p_full_text_weight +
         COALESCE(1.0 / (p_rrf_k + s.rank_ix), 0.0) * p_semantic_weight)::FLOAT AS rrf_score
      FROM full_text ft
      FULL OUTER JOIN semantic s ON ft.id = s.id
      JOIN tenant_categories tc ON tc.id = COALESCE(ft.id, s.id)
      ORDER BY rrf_score DESC, tc.id
      LIMIT p_match_count
    ) r;

    v_results := v_results || jsonb_build_object(
      'query_text', v_query_text,
      'results', COALESCE(v_matches, '[]'::JSONB)
    );
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hybrid_search_category_batch(JSONB, BIGINT, INT, FLOAT, FLOAT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hybrid_search_category_batch(JSONB, BIGINT, INT, FLOAT, FLOAT, INT) FROM PUBLIC;
```

### Database (Migration 2 of 2)

#### [NEW] `20260306205700_add_suggest_mapping_helper_rpcs.sql`

**1. Partial index for unassigned-name aggregation**

```sql
CREATE INDEX IF NOT EXISTS idx_thiet_bi_unassigned_name_by_unit
ON public.thiet_bi (don_vi, ten_thiet_bi)
WHERE nhom_thiet_bi_id IS NULL;
```

**2. `dinh_muc_thiet_bi_unassigned_names`** — Distinct device names for the selected unit:

```sql
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned_names(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  ten_thiet_bi TEXT,
  device_count BIGINT,
  device_ids BIGINT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    BTRIM(tb.ten_thiet_bi) AS ten_thiet_bi,
    COUNT(*)::BIGINT AS device_count,
    ARRAY_AGG(tb.id ORDER BY tb.id) AS device_ids
  FROM public.thiet_bi tb
  WHERE tb.don_vi = p_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND NULLIF(BTRIM(tb.ten_thiet_bi), '') IS NOT NULL
  GROUP BY BTRIM(tb.ten_thiet_bi)
  ORDER BY COUNT(*) DESC, BTRIM(tb.ten_thiet_bi);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_names(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_names(BIGINT) FROM PUBLIC;
```

**3. `dinh_muc_thiet_bi_link_batch`** — Batch link in single transaction, race-safe:

This RPC is **not** a replacement for `dinh_muc_thiet_bi_link`. It is a separate command for suggested mapping, where one confirmation can commit many grouped operations of the existing domain shape `1 category -> many devices`.

```sql
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link_batch(
  p_mappings JSONB,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Full JWT guards + tenant isolation
  -- Roles: global, admin, to_qltb only
  -- regional_leader forbidden
  -- Payload shape:
  -- [
  --   { "nhom_id": 1, "thiet_bi_ids": [10, 11] },
  --   { "nhom_id": 2, "thiet_bi_ids": [12] }
  -- ]
  -- Validate no device_id appears in more than one group inside p_mappings
  -- Only update rows still nhom_thiet_bi_id IS NULL at save time
  -- Return summary JSONB instead of plain INT
END;
$$;
```

Recommended return shape:

```json
{
  "affected_count": 120,
  "skipped_already_assigned": 7,
  "skipped_not_found": 2,
  "invalid_duplicate_device_ids": [],
  "groups": [
    {"nhom_id": 1, "affected": 40, "skipped": 3}
  ]
}
```

Both RPCs: `SECURITY DEFINER SET search_path = public, pg_temp` + JWT guards + `GRANT/REVOKE`.

### Edge Functions

#### [NEW] `embed-device-name/index.ts`

Embedding-only function:

- Accepts `{ texts: string[] }` (batch up to 50)
- Uses `new Supabase.ai.Session('gte-small')` → 384d embeddings
- Returns `{ embeddings: number[][] }`
- `verify_jwt: true`
- Zero DB access

#### [NEW] `scripts/device-quota/backfill-category-embeddings.ts`

One-time admin utility:

- Runs in trusted server environment only
- Uses `SUPABASE_SERVICE_ROLE_KEY` for batch DB update
- Processes categories in batches of 50
- Not browser-callable

#### [NEW] Protected category embedding refresh path

After category create/update/import category:

- Trigger server-side refresh for **affected `category_ids[]`**
- Read the latest category rows from DB before generating new embeddings
- Recommended shape: protected Next.js route or server helper, not a public Edge Function
- Must cover `dinh_muc_nhom_upsert` and `dinh_muc_nhom_bulk_import`
- Must **not** run for `dinh_muc_unified_import`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser

### Frontend

#### [MODIFY] `DeviceQuotaMappingActions.tsx`

1. Reuse action bar hiện có; không tạo thêm bulk-action footer riêng cho suggested flow
2. Add "Gợi ý phân loại" button (`Sparkles`, `variant="outline"`)
3. Add helper copy: "Áp dụng cho toàn bộ thiết bị chưa gán của đơn vị hiện tại"
4. Keep existing write button visibility logic for save-capable roles

#### [REFACTOR] `DeviceQuotaMappingPreviewDialog.tsx`

Refactor dialog hiện có để trích các phần dùng chung cho preview flows:

- Dialog shell/header/footer pattern
- Count badge / summary badge
- Loading skeleton list
- Equipment/item row với exclude/restore interaction
- Footer note slot để có thể dùng chung disclaimer hoặc helper copy khi cần

Mục tiêu là dùng lại các phần này cho suggested preview thay vì copy-paste hoặc tạo thêm một file preview rất lớn. Dialog này vẫn giữ model manual `targetCategory + confirmedIds`; không mở rộng nó để gánh state grouped-by-category của suggested flow.

#### [CREATE ONLY IF NEEDED] thin suggested-preview container

- Nếu có thể mở rộng cleanly từ dialog hiện có, ưu tiên reuse hơn tạo component mới
- Nếu cần component mới cho suggested flow, giữ file orchestration/container đủ mỏng
- Group rendering, unmatched section, summary block nên tách sang các presentational components nhỏ
- Không để bất kỳ file preview-related nào vượt khoảng 350 lines

#### [NEW] `MappingPreviewPrimitives.tsx`

Shared preview pieces, dự kiến gồm:

- `MappingPreviewDialogShell`
- `MappingPreviewCountBadge`
- `MappingPreviewFooterNote`
- `MappingPreviewLoadingState`
- `MappingPreviewEquipmentItem`

Nếu file này tiến gần giới hạn kích thước, tách `MappingPreviewEquipmentItem` ra file riêng trước khi mở rộng thêm.

#### [NEW] `SuggestedMappingPreviewDialog.tsx`

Thin container cho suggested flow:

- Nhận dữ liệu đã được hook orchestration chuẩn hóa
- Compose `MappingPreviewPrimitives`, `SuggestedMappingGroupSection`, `SuggestedMappingUnmatchedSection`
- Hiển thị footer note bắt buộc: `"Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu"`
- Xử lý save action, preview-only state cho `regional_leader`, và summary sau save
- Giữ state dạng grouped mappings (`[{ nhom_id, thiet_bi_ids[] }]`) thay vì contract manual `targetCategory + confirmedIds`
- Confirm action phải thể hiện đây là một lần lưu nhiều group, không phải single-category save

#### [NEW] `SuggestedMappingGroupSection.tsx`

Presentational component cho một category group:

- Header nhóm + confidence badge
- Danh sách thiết bị trong nhóm
- Exclude/restore per item hoặc per group

#### [NEW] `SuggestedMappingUnmatchedSection.tsx`

Presentational component cho section không match được:

- Danh sách thiết bị chưa có gợi ý
- Collapsible/expand behavior nếu cần
- Không chứa save logic

#### [NEW] `useSuggestMapping.ts`

Client-side orchestration:

```typescript
// ~10 total HTTP calls for ~200 unique names:
// 1× callRpc('dinh_muc_thiet_bi_unassigned_names', { p_don_vi })
// 4× Edge Function 'embed-device-name' (50 names/batch)
// 4× callRpc('hybrid_search_category_batch', { p_queries, p_don_vi })
// 1× callRpc('dinh_muc_thiet_bi_link_batch') for write roles only
// manual flow continues to use callRpc('dinh_muc_thiet_bi_link')
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

**Database**

```sql
-- malformed non-global JWT without don_vi claim must fail with Missing don_vi claim
-- FTS-only fallback must work
SELECT hybrid_search_category_batch(
  '[{"text":"Bơm tiêm điện","embedding":null}]'::JSONB,
  <don_vi_id>
);

-- unassigned_names must group by trimmed name and stay tenant-scoped
-- malformed non-global JWT without don_vi claim must also fail for unassigned_names
SELECT * FROM dinh_muc_thiet_bi_unassigned_names(<don_vi_id>);

-- link_batch must skip rows that are no longer unassigned
SELECT dinh_muc_thiet_bi_link_batch(
  '[{"nhom_id":1,"thiet_bi_ids":[10,11]}]'::JSONB,
  <don_vi_id>
);

-- duplicate device_id across groups must be rejected
SELECT dinh_muc_thiet_bi_link_batch(
  '[{"nhom_id":1,"thiet_bi_ids":[10,11]},{"nhom_id":2,"thiet_bi_ids":[11]}]'::JSONB,
  <don_vi_id>
);
```

**Performance verification**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM dinh_muc_thiet_bi_unassigned_names(<don_vi_id>);
```

- Confirm planner uses the partial index where expected.
- Benchmark `hybrid_search_category_batch` on tenant data after backfill.
- Keep exact scan if real latency is acceptable; only then consider ANN follow-up.

**Frontend unit tests**

| File | Scope |
|------|-------|
| `DeviceQuotaMappingActions.test.tsx` | Reused action bar + scope copy + suggested button behavior |
| `DeviceQuotaMappingPreviewDialog.test.tsx` | Shared preview pieces after refactor |
| `SuggestedMappingPreviewDialog.test.tsx` | Grouped results, unmatched section, footer disclaimer note, preview-only state, save summary |
| `useSuggestMapping.test.ts` | Chunked orchestration, progress, no-save mode for `regional_leader` |
| `rpc-whitelist.unit.test.ts` | New RPCs allowed through proxy |

### Manual Verification

1. Run category embedding backfill utility once after migration.
2. Navigate `/device-quota/mapping` and run the full preview flow.
3. Verify the scope note is visible and clear.
4. Verify `regional_leader` can preview suggestions but cannot save.
5. Simulate stale preview: manually map one suggested device elsewhere, then confirm save and verify it is skipped rather than overwritten.
6. Verify category create/update/category bulk import refresh embeddings.
7. Verify `dinh_muc_unified_import` does not trigger category embedding refresh.
8. Run `get_advisors(security)` via Supabase MCP post-migration.

---

## Key Revisions In This Version

| Finding | Before | Now |
|---|---|---|
| Semantic index strategy | HNSW in initial migration | Exact semantic scan first, ANN deferred until benchmark proves need |
| Unassigned-name query | No dedicated index | Partial composite index for `(don_vi, ten_thiet_bi)` where `nhom_thiet_bi_id IS NULL` |
| Batch save contract | `RETURNS INT`, overwrite risk unspecified | `RETURNS JSONB` summary + skip rows no longer unassigned |
| Save interaction model | New flow could be mistaken for arbitrary many-to-many save | Manual flow stays `1 category -> many devices`; suggested flow commits many grouped `1 category -> many devices` operations in one confirm |
| Refresh lifecycle | Included `dinh_muc_unified_import` | Refresh only for category-changing flows |
| Preview UI architecture | Risk of new monolithic dialog | Concrete split: shared preview primitives + thin suggested container + section components |
| UX disclaimer | Not specified | Footer note bắt buộc: `"Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu"` |
| Performance framing | Focus on fewer calls only | Explicitly separates HTTP batching wins from SQL-internal loop cost |
| Execution tracking | Coarse sections | Phased delivery plan with task-level checklist |
