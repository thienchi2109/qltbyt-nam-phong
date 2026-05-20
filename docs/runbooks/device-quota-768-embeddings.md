# Làm mới embedding 768 chiều cho Device Quota

Runbook này chỉ dùng cho bảng side-by-side `public.device_quota_category_embeddings`.
Không ghi vào `public.nhom_thiet_bi.embedding` 384 chiều hiện tại.

## Dry-run

```bash
DEVICE_QUOTA_768_EMBEDDING_URL="http://127.0.0.1:18080/embed" \
DEVICE_QUOTA_768_REFRESH_DRY_RUN=true \
node scripts/npm-run.js npx tsx scripts/device-quota/refresh-category-embeddings-768.ts
```

Dry-run là mặc định. Lệnh chỉ đếm danh mục và in bảng đích.

## Ghi dữ liệu

Chỉ chạy sau khi dry-run đúng môi trường và endpoint embedding trả vector 768 chiều.

```bash
DEVICE_QUOTA_768_EMBEDDING_URL="http://127.0.0.1:18080/embed" \
DEVICE_QUOTA_768_REFRESH_DRY_RUN=false \
DEVICE_QUOTA_768_MODEL_NAME="dangvantuan/vietnamese-embedding" \
node scripts/npm-run.js npx tsx scripts/device-quota/refresh-category-embeddings-768.ts
```

Script dùng `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` từ `.env.local`.
Không commit `.env.local`.

## Kiểm tra nhanh

```sql
SELECT model_name, dimension, count(*)
FROM public.device_quota_category_embeddings
GROUP BY model_name, dimension
ORDER BY model_name, dimension;
```

## Rollback

Rollback an toàn là tắt đường đọc 768/rerank trước, sau đó xóa đúng model nếu cần:

```bash
DEVICE_QUOTA_AI_RERANK_ENABLED=false
```

```sql
DELETE FROM public.device_quota_category_embeddings
WHERE model_name = 'dangvantuan/vietnamese-embedding'
  AND dimension = 768;
```

Không xóa hoặc sửa `public.nhom_thiet_bi.embedding`; cột đó vẫn là đường 384 chiều hiện tại.
