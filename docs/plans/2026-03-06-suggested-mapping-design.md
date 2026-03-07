# Gợi ý phân loại — Thiết kế tính năng

## Tóm tắt

Tính năng này tự động gợi ý mapping thiết bị -> danh mục cho **toàn bộ thiết bị chưa gán của đơn vị đang chọn**, dùng hybrid search gồm full-text search (`tsvector`) + semantic search (`pgvector`) + Reciprocal Rank Fusion (RRF). Ở phiên bản đầu, semantic search dùng **exact cosine scan trên tập category của tenant**, chưa dùng ANN/HNSW, vì dữ liệu hiện còn nhỏ và yêu cầu chính là độ đúng, không phải tối đa throughput.

## Bối cảnh

- Khoảng **567** category (`nhom_thiet_bi`) trong toàn hệ thống, khoảng **2,740** thiết bị chưa gán
- `pg_trgm` đã có; `pgvector` có sẵn nhưng chưa enable trong schema này
- RPC proxy hiện giới hạn body khoảng **2MB**, nên request embedding/search phải chunk
- Luồng save hiện hữu (`dinh_muc_thiet_bi_link`) đã là bulk update theo model **1 danh mục -> nhiều thiết bị**; flow mới không nên làm mờ model này mà phải đóng gói nhiều nhóm cùng model vào một command riêng

## Kiến trúc đề xuất

### Tại sao vẫn dùng Hybrid Search?

Hybrid search vẫn là lựa chọn đúng vì nó kết hợp được hai tín hiệu khác nhau:

- Full-text search cho các trường hợp tên thiết bị gần trùng tên category
- Semantic similarity cho các trường hợp khác từ ngữ nhưng cùng ngữ nghĩa
- RRF để gộp hai ranking mà không phải viết heuristic fallback phức tạp

Điểm thay đổi quan trọng là **không ANN hóa sớm**. Với tập category nhỏ và luôn filter theo `don_vi_id`, exact scan trên tenant-local set đơn giản hơn, đúng 100%, và tránh trường hợp HNSW/IVFFlat trả thiếu hàng khi kết hợp thêm filter phụ.

### Luồng xử lý

```text
Client bấm "Gợi ý phân loại"
  |
  v
callRpc('dinh_muc_thiet_bi_unassigned_names')
  -> lấy toàn bộ tên thiết bị chưa gán của đơn vị đã chọn
  -> group theo tên để giảm số query thực tế
  |
  v
Batch 50 tên / lần
  |- Edge Function `embed-device-name` sinh embedding
  '- callRpc('hybrid_search_category_batch')
       |- full-text match trên fts
       |- exact cosine similarity trên category của tenant
       '- RRF merge -> lấy category tốt nhất + score
  |
  v
Client merge kết quả các chunk -> preview dialog grouped theo category
  |
  |- role = regional_leader -> chỉ xem
  '- role ghi -> xác nhận lưu
       |
       v
callRpc('dinh_muc_thiet_bi_link_batch')
  -> chỉ update các thiết bị vẫn còn chưa gán tại thời điểm lưu
  -> mỗi group vẫn là 1 category -> many devices; một device không được nằm ở 2 group trong cùng payload
  -> trả summary số row đã lưu và số row bị skip
```

### Model tương tác cần giữ rõ

- **Manual mapping hiện tại**:
  - User chọn `selectedCategoryId`
  - User chọn nhiều thiết bị
  - Save gọi `dinh_muc_thiet_bi_link`
  - Domain shape: `1 category -> many devices`

- **Suggested mapping mới**:
  - Hệ thống sinh nhiều group theo category
  - User review các group này trong một preview
  - Save gọi `dinh_muc_thiet_bi_link_batch`
  - Domain shape vẫn là tập hợp của nhiều thao tác `1 category -> many devices`
  - Không coi đây là một mô hình many-to-many tổng quát

- **Invariant bắt buộc**:
  - Trong một payload save của suggested flow, mỗi `device_id` chỉ được xuất hiện tối đa một lần trên toàn bộ các group
  - Nếu duplicate `device_id` xuất hiện ở 2 group, RPC phải reject request thay vì cố đoán group thắng

### Tối ưu hiệu năng thực tế

1. **Group by `ten_thiet_bi`**
   - 2,740 thiết bị chưa gán nhưng chỉ khoảng 200 tên duy nhất.
   - Đây là tối ưu lớn nhất của luồng: giảm mạnh số lần embedding và search.

2. **Chunk 50 item/lần**
   - Giữ request body đủ nhỏ cho proxy.
   - Giữ round-trip ở mức khoảng `~10` calls cho `~200` tên duy nhất.

3. **Exact semantic scan trước**
   - V1 không tạo HNSW.
   - Chỉ thêm ANN trong follow-up migration nếu benchmark dữ liệu thật chứng minh exact scan không đạt.

4. **Index đúng query shape của `unassigned_names`**
   - Tạo partial composite index cho pattern `don_vi + ten_thiet_bi + nhom_thiet_bi_id IS NULL`.

## Database Setup

### 1. Hybrid-search foundation trên `nhom_thiet_bi`

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.nhom_thiet_bi
ADD COLUMN embedding extensions.vector(384);

ALTER TABLE public.nhom_thiet_bi
ADD COLUMN fts tsvector
GENERATED ALWAYS AS (to_tsvector('simple', ten_nhom)) STORED;

CREATE INDEX IF NOT EXISTS idx_nhom_thiet_bi_fts
ON public.nhom_thiet_bi USING gin (fts);
```

**Không tạo HNSW ở migration đầu tiên.**

Lý do:
- Dataset hiện nhỏ
- Query luôn có tenant filter
- Exact scan giúp giữ accuracy tuyệt đối và tránh tuning sớm

### 2. Index cho query aggregate thiết bị chưa gán

```sql
CREATE INDEX IF NOT EXISTS idx_thiet_bi_unassigned_name_by_unit
ON public.thiet_bi (don_vi, ten_thiet_bi)
WHERE nhom_thiet_bi_id IS NULL;
```

Index này phục vụ trực tiếp cho RPC `dinh_muc_thiet_bi_unassigned_names`.

### 3. RPC `hybrid_search_category_batch`

Contract:

- Input: `p_queries JSONB`, tối đa 50 query/lần
- Tenant isolation đầy đủ bằng JWT guards
- `regional_leader` chỉ được đọc khi `p_don_vi` nằm trong `allowed_don_vi_for_session()`
- Must include explicit `GRANT EXECUTE ... TO authenticated` and `REVOKE EXECUTE ... FROM PUBLIC` statements in the migration
- Non-global users phải fail sớm với `Missing don_vi claim` nếu JWT thiếu `don_vi`; không được silent-return `[]`
- `embedding = null` phải rơi về FTS-only path, không được cast lỗi
- Semantic branch dùng exact cosine similarity trên tập category đã filter theo tenant

Pseudo-shape:

```sql
WITH tenant_categories AS (
  SELECT id, ten_nhom, ma_nhom, phan_loai, fts, embedding
  FROM public.nhom_thiet_bi
  WHERE don_vi_id = p_don_vi
),
full_text AS (...),
semantic AS (
  SELECT id
  FROM tenant_categories
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> v_query_embedding
  LIMIT p_match_count * 2
)
SELECT ... FROM full_text
FULL OUTER JOIN semantic ...
```

### 4. RPC `dinh_muc_thiet_bi_unassigned_names`

Mục tiêu:
- Trả về danh sách tên thiết bị duy nhất của toàn bộ thiết bị chưa gán trong đơn vị
- Gom sẵn `device_ids[]` để client không cần query lại
- Chuẩn hóa bằng `BTRIM()` để giảm duplicate group do whitespace vô tình
- Phải có đầy đủ JWT claim extraction/guards cho `v_role`, `v_user_id`, `v_don_vi`, tenant isolation theo role, và explicit `GRANT EXECUTE ... TO authenticated` + `REVOKE EXECUTE ... FROM PUBLIC`

### 5. RPC `dinh_muc_thiet_bi_link_batch`

Đây là chỗ cần guard về race condition.

Yêu cầu contract:
- Chỉ role ghi được gọi
- Chạy trong 1 transaction
- Input là mảng group theo category, ví dụ `[{ "nhom_id": 1, "thiet_bi_ids": [10, 11] }, { "nhom_id": 2, "thiet_bi_ids": [12] }]`
- Không thay thế `dinh_muc_thiet_bi_link`; manual flow hiện tại vẫn dùng RPC cũ
- Reject nếu cùng một `device_id` xuất hiện ở nhiều group trong cùng request
- Chỉ update row vẫn còn `nhom_thiet_bi_id IS NULL`
- Không ghi đè dữ liệu vừa được người khác map sau lúc preview
- Trả `JSONB` summary thay vì chỉ trả count

Ví dụ return:

```json
{
  "affected_count": 120,
  "skipped_already_assigned": 7,
  "skipped_not_found": 2
}
```

## Edge Functions Và Embedding Lifecycle

### 1. `embed-device-name`

Edge Function này chỉ sinh embedding cho tên thiết bị:

```typescript
const model = new Supabase.ai.Session('gte-small')
const embeddings = await Promise.all(
  texts.map((text) => model.run(text, { mean_pool: true, normalize: true }))
)
```

Yêu cầu:
- Batch tối đa 50 text/lần
- `verify_jwt: true`
- Không truy cập DB

### 2. Lifecycle của category embeddings

- **Backfill 1 lần** bằng utility chạy ở server tin cậy, dùng `SUPABASE_SERVICE_ROLE_KEY`
- **Refresh theo batch** sau các luồng làm thay đổi category
- Refresh helper nhận `category_ids[]`, re-read row hiện tại từ DB rồi mới sinh embedding
- Không dùng public function `verify_jwt = false`

Các luồng cần refresh:
- `dinh_muc_nhom_upsert`
- `dinh_muc_nhom_bulk_import`

Các luồng **không** cần refresh:
- `dinh_muc_unified_import`
  - Lý do: chỉ import quota line items, không sửa bảng `nhom_thiet_bi`

## UX Flow

### Nút "Gợi ý phân loại"

- Nằm cạnh nút "Phân loại" trong action bar
- Luôn hiện khi đã chọn đơn vị
- Có note rõ: **"Áp dụng cho toàn bộ thiết bị chưa gán của đơn vị hiện tại"**
- Không phụ thuộc các filter/search đang hiển thị trên bảng
- **Reuse `DeviceQuotaMappingActions.tsx`** để thêm suggested action; không tạo thêm một footer/action bar riêng chỉ cho flow mới

### Preview Dialog

Dialog hiển thị kết quả grouped theo category, gồm:

- Tổng số thiết bị được match / không match
- Nhóm theo category được gợi ý
- Exclude/restore từng thiết bị hoặc cả nhóm
- `regional_leader`: chỉ xem kết quả, không có nút lưu
- Role ghi: có nút xác nhận lưu toàn bộ phần còn được chọn
- Wording của nút xác nhận phải thể hiện đây là một lần áp dụng **nhiều group gợi ý**, không phải single-category save của manual flow
- Footer note nhỏ, luôn hiện gần vùng action: **"Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu"**

Ngoài trạng thái loading/error/saving thông thường, dialog phải xử lý thêm case **stale preview**:
- Nếu một số thiết bị đã được map ở nơi khác sau lúc preview, save vẫn thành công phần còn lại
- UI hiện rõ số lượng thiết bị bị skip, thay vì báo thành công mơ hồ

### Reuse strategy và file-size guard

Không nên tạo một `SuggestedMappingPreviewDialog.tsx` lớn rồi nhồi toàn bộ logic vào đó. Trong codebase hiện đã có `DeviceQuotaMappingPreviewDialog.tsx`; đó là ứng viên tốt để **trích các phần dùng chung** cho preview flows, ví dụ:

- Dialog shell/header/footer pattern
- Count badge / summary badge
- Loading skeleton list
- Equipment row với tương tác exclude/restore
- Footer disclaimer note

Thiết kế khuyến nghị:
- Reuse `DeviceQuotaMappingActions.tsx` cho action bar
- Refactor `DeviceQuotaMappingPreviewDialog.tsx` để lấy ra shared preview primitives nếu cần
- Nếu suggested flow cần container riêng, giữ nó ở dạng **thin container**; phần summary, category-group section, unmatched section nên là các component trình bày nhỏ
- Không để bất kỳ file preview-related nào vượt khoảng **350 lines**

Mục tiêu là tránh vừa duplicate UI, vừa tạo thêm file monolith khó review và khó test.

### Concrete file split đề xuất

Đề xuất chia preview thành các file sau:

1. `DeviceQuotaMappingActions.tsx`
   - Action bar hiện hữu
   - Chỉ thêm wiring cho nút "Gợi ý phân loại"

2. `DeviceQuotaMappingPreviewDialog.tsx`
   - Giữ preview manual mapping hiện tại
   - Dùng shared preview primitives sau khi refactor
   - Vẫn giữ model `targetCategory + confirmedIds`, không gánh grouped save state của suggested flow

3. `MappingPreviewPrimitives.tsx`
   - Shared pieces cho các preview dialog
   - Gồm dialog shell, count badge, footer note, loading state, equipment row

4. `SuggestedMappingPreviewDialog.tsx`
   - Thin container cho suggested flow
   - Chỉ chịu trách nhiệm compose dữ liệu và save action
   - Giữ grouped mapping state riêng, không phụ thuộc `selectedCategoryId` của manual flow

5. `SuggestedMappingGroupSection.tsx`
   - Render từng nhóm category được gợi ý

6. `SuggestedMappingUnmatchedSection.tsx`
   - Render section thiết bị chưa match được

Cách chia này giữ reuse cao nhưng vẫn tránh việc một file đơn phải gánh toàn bộ state machine, group rendering, unmatched rendering và footer/action logic cùng lúc.

## Quyết định thiết kế

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Search method | Hybrid (FTS + semantic + RRF) | Kết hợp tốt nhất giữa string match và semantic match |
| Semantic execution | Exact cosine scan trên tenant-local category set | Dataset nhỏ, accuracy cao, tránh filtered ANN issues |
| ANN/HNSW | Chưa dùng ở v1 | Chỉ thêm khi benchmark chứng minh cần |
| tsvector config | `'simple'` | Phù hợp tên tiếng Việt, không cần stemming kiểu English |
| Search batching | Chunk 50 queries/lần | Tránh chạm body limit, vẫn giữ ít round-trip |
| Suggestion scope | Toàn bộ thiết bị chưa gán của đơn vị | Phục vụ bulk triage, không phụ thuộc filter tạm thời |
| `regional_leader` | Được xem, không được lưu | Phù hợp quyền read-only |
| Save interaction model | Manual và suggested là 2 command khác nhau | Giữ rõ model `1 category -> many devices` của manual flow, suggested chỉ là batch của nhiều group cùng model |
| Batch save contract | Chỉ link row còn unassigned, trả summary JSONB | Tránh overwrite do stale preview, dễ hiển thị UX |
| Preview UI architecture | Shared preview primitives + thin suggested container + section components | Reuse cao, không phình file |
| Footer disclaimer | Luôn hiển thị trong suggested preview | Nhấn mạnh tính gợi ý và yêu cầu user kiểm tra lại |
| Category embeddings | Backfill 1 lần + refresh server-side theo batch | Giữ embeddings mới mà không lộ service role |
| Unified import | Không refresh category embeddings | Luồng này không sửa category |

## Thành phần cần xây dựng

### Database
1. Enable `pgvector` extension
2. Cột `embedding vector(384)` + `fts tsvector` trên `nhom_thiet_bi`
3. GIN index cho `fts`
4. Partial index cho `thiet_bi` unassigned-name aggregation
5. RPC `hybrid_search_category_batch`
6. RPC `dinh_muc_thiet_bi_unassigned_names`
7. RPC `dinh_muc_thiet_bi_link_batch`

### Edge Functions
1. `embed-device-name` — sinh embedding theo batch

### Server-side utilities
1. Backfill category embeddings utility
2. Protected refresh helper nhận `category_ids[]`

### Frontend
1. Mở rộng `DeviceQuotaMappingActions.tsx` thay vì tạo action bar mới
2. Refactor `DeviceQuotaMappingPreviewDialog.tsx` để lấy shared preview pieces nếu cần
3. `MappingPreviewPrimitives.tsx` cho shared preview UI
4. `SuggestedMappingPreviewDialog.tsx` làm thin container
5. `SuggestedMappingGroupSection.tsx` cho grouped results
6. `SuggestedMappingUnmatchedSection.tsx` cho unmatched results
7. Hook orchestration gọi RPC + Edge Function theo chunk
8. UI hiển thị save summary khi có row bị skip do concurrent update
9. Footer disclaimer note luôn hiện trong suggested preview

## Deferred Optimization

Nếu benchmark thực tế sau khi backfill cho thấy exact scan không còn phù hợp, tạo follow-up plan riêng để:

- Benchmark exact scan vs HNSW trên dữ liệu thật
- Chọn ngưỡng kích hoạt ANN rõ ràng
- Thêm HNSW trong migration tách biệt
- Đánh giá lại recall khi kết hợp tenant filter
