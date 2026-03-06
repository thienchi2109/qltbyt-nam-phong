# Gợi ý phân loại — Thiết kế tính năng

## Tóm tắt

Tự động gợi ý mapping thiết bị → danh mục cho toàn bộ thiết bị chưa gán, sử dụng **Supabase Hybrid Search**: kết hợp full-text search (tsvector) + semantic search (pgvector + gte-small) thông qua **Reciprocal Rank Fusion (RRF)**. Toàn bộ chạy trong Supabase, zero API cost.

## Bối cảnh

- **567** danh mục (`nhom_thiet_bi`), **2,740** thiết bị chưa gán
- `pg_trgm` v1.6 đã cài; `pgvector` v0.8.0 có sẵn, chưa cài
- Edge Functions hỗ trợ `gte-small` model (384 dimensions) chạy nội bộ, miễn phí

## Kiến trúc: Hybrid Search + RRF

### Tại sao Hybrid Search thay vì 2-tier fallback?

Phương án trước dùng 2 tầng tuần tự: string match trước → AI fallback cho phần còn lại. **Hybrid Search tốt hơn** vì:

- **Chạy song song**: Full-text search + semantic search cùng lúc qua RRF
- **Kết quả chính xác hơn**: RRF kết hợp ranking từ cả 2 phương pháp, thiết bị xuất hiện cao ở cả 2 phương pháp sẽ được ưu tiên
- **Đơn giản hơn**: 1 RPC function thay vì 2 tầng logic
- **Tunable**: `full_text_weight` và `semantic_weight` điều chỉnh tầm quan trọng của từng phương pháp

### Luồng xử lý

```
Client bấm "Gợi ý phân loại"
  │
  ▼
Edge Function: suggest-mapping
  │
  ├─ Fetch all unassigned devices (tên thiết bị)
  ├─ Group devices by unique tên (giảm 2,740 → ~200 tên duy nhất)
  │
  ├─ Cho mỗi unique tên thiết bị:
  │    ├─ gte-small tạo embedding cho tên
  │    └─ Gọi RPC hybrid_search_category:
  │         ├── CTE 1: tsvector full-text match trên nhom_thiet_bi
  │         ├── CTE 2: pgvector cosine similarity trên embeddings
  │         └── RRF merge → trả category tốt nhất + score
  │
  ├─ Map kết quả: nhóm devices theo category được gợi ý
  └─ Return kết quả grouped

  ▼
Preview Dialog (grouped by category)
  User review & confirm
  │
  ▼
Bulk save via dinh_muc_thiet_bi_link (batch theo nhóm)
```

### Tối ưu hiệu năng: Group by unique tên

2,740 thiết bị nhưng nhiều thiết bị cùng tên (ví dụ 8 máy "Máy chạy thận"). Thay vì gọi hybrid search 2,740 lần, ta **group by `ten_thiet_bi`** → chỉ cần ~200 lần search. Tiết kiệm ~93% computation.

## Database Setup

### 1. Enable pgvector + thêm cột embedding

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Thêm cột embedding vào nhom_thiet_bi
ALTER TABLE nhom_thiet_bi ADD COLUMN embedding extensions.vector(384);

-- Thêm cột tsvector generated cho full-text search
ALTER TABLE nhom_thiet_bi ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED;

-- Indexes
CREATE INDEX ON nhom_thiet_bi USING gin(fts);
CREATE INDEX ON nhom_thiet_bi USING hnsw (embedding extensions.vector_ip_ops);
```

> **Lưu ý**: Dùng `'simple'` thay vì `'english'` cho tsvector vì tên thiết bị y tế bằng **tiếng Việt**.

### 2. RPC: Hybrid Search Category

```sql
CREATE OR REPLACE FUNCTION hybrid_search_category(
  query_text text,
  query_embedding extensions.vector(384),
  match_count int DEFAULT 3,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50
)
RETURNS TABLE (
  id int, ten_nhom text, ma_nhom text,
  phan_loai text, rrf_score float
)
LANGUAGE sql AS $$
  WITH full_text AS (
    SELECT ntb.id,
      row_number() OVER (ORDER BY ts_rank_cd(fts, plainto_tsquery('simple', query_text)) DESC) AS rank_ix
    FROM nhom_thiet_bi ntb
    WHERE fts @@ plainto_tsquery('simple', query_text)
    ORDER BY rank_ix
    LIMIT match_count * 2
  ),
  semantic AS (
    SELECT ntb.id,
      row_number() OVER (ORDER BY ntb.embedding <#> query_embedding) AS rank_ix
    FROM nhom_thiet_bi ntb
    WHERE ntb.embedding IS NOT NULL
    ORDER BY rank_ix
    LIMIT match_count * 2
  )
  SELECT
    ntb.id, ntb.ten_nhom, ntb.ma_nhom, ntb.phan_loai,
    (COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
     COALESCE(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight) AS rrf_score
  FROM full_text ft
  FULL OUTER JOIN semantic s ON ft.id = s.id
  JOIN nhom_thiet_bi ntb ON COALESCE(ft.id, s.id) = ntb.id
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;
```

## Edge Functions

### 1. `generate-category-embeddings` (chạy 1 lần)

Sinh embedding cho 567 categories, lưu vào cột `embedding`:

```typescript
const model = new Supabase.ai.Session('gte-small')

// Fetch all categories → generate embedding → update
for (const cat of categories) {
  const embedding = await model.run(cat.ten_nhom, {
    mean_pool: true, normalize: true
  })
  await supabase
    .from('nhom_thiet_bi')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', cat.id)
}
```

### 2. `suggest-mapping` (gọi khi user bấm nút)

Orchestrator: fetch unassigned devices → group by tên → hybrid search → merge → return:

```typescript
const model = new Supabase.ai.Session('gte-small')

// 1. Fetch unique device names
// 2. For each unique name, generate embedding + call hybrid_search_category
// 3. Group results: { category_id → [device_ids] }
// 4. Return grouped result with score
```

## UX Flow

### Nút "Gợi ý phân loại"

- Nằm bên cạnh nút "Phân loại" trong action bar (sticky bottom)
- Luôn hiện khi đã chọn đơn vị (không cần chọn thiết bị trước)
- Khi bấm → loading state → gọi Edge Function → mở Preview Dialog

### Preview Dialog — Grouped by Category

```
┌──────────────────────────────────────────────┐
│ Gợi ý phân loại                         [X]  │
├──────────────────────────────────────────────┤
│ Kết quả: 2,450/2,740 thiết bị được gợi ý    │
│                                              │
│ ▼ 📁 Bơm tiêm điện (5 TB) ✅ High           │
│   ├ NT-TN.007 Bơm tiêm điện         [Loại]  │
│   ├ NT-TN.008 Bơm tiêm điện         [Loại]  │
│   └ ...                                      │
│                                              │
│ ▼ 📁 Máy thận nhân tạo (8 TB) 🔶 Medium     │
│   ├ TT.1.92004.08T6409 Máy chạy thận [Loại] │
│   └ ...                                      │
│                                              │
│ ▶ 📁 Siêu âm (3 TB) 🔶 Medium               │
│                                              │
│ ▼ ❌ Chưa gợi ý được (290 TB)                │
│   ├ ... (thiết bị không match được)          │
│   └ ...                                      │
│                                              │
├──────────────────────────────────────────────┤
│ [Bỏ chọn tất cả]   [Xác nhận 2,450 thiết bị]│
└──────────────────────────────────────────────┘
```

**Tương tác:**
- Mỗi thiết bị có nút [Loại] để loại bỏ khỏi gợi ý
- Mỗi nhóm collapse/expand + checkbox để loại cả nhóm
- Nhóm "❌ Chưa gợi ý được" cho những thiết bị không match → user mapping thủ công sau
- Nút "Xác nhận N thiết bị" lưu tất cả (gọi `dinh_muc_thiet_bi_link` tuần tự theo nhóm)

**Confidence levels dựa trên RRF score:**

| RRF Score | Confidence | Badge |
|-----------|-----------|-------|
| ≥ 0.03 | High | ✅ |
| 0.015 – 0.03 | Medium | 🔶 |
| < 0.015 | Low (không gợi ý) | ❌ |

## Quyết định thiết kế

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Search method | Hybrid (FTS + semantic + RRF) | Chính xác nhất, kết hợp ưu điểm cả 2 |
| Embedding model | gte-small (384d, built-in Edge) | Miễn phí, không dependency ngoài |
| tsvector config | `'simple'` | Tiếng Việt, không cần stemming |
| Xác nhận | Xác nhận toàn bộ (1 nút) | Đơn giản, user loại bỏ cái không muốn rồi confirm |
| Batch save | `dinh_muc_thiet_bi_link` tuần tự | Tái sử dụng RPC có sẵn |
| Category embeddings | Sinh 1 lần + webhook | 567 categories ít thay đổi |

## Thành phần cần xây dựng

### Database
1. Enable `pgvector` extension
2. Cột `embedding vector(384)` + `fts tsvector` trên `nhom_thiet_bi`
3. Indexes (GIN + HNSW)
4. RPC `hybrid_search_category`

### Edge Functions
1. `generate-category-embeddings` — sinh embedding 1 lần
2. `suggest-mapping` — orchestrator gọi khi user bấm nút

### Frontend
1. Nút "Gợi ý phân loại" trong `DeviceQuotaMappingActions.tsx`
2. `SuggestedMappingPreviewDialog` — dialog mới grouped by category
3. Hook gọi Edge Function + xử lý kết quả
