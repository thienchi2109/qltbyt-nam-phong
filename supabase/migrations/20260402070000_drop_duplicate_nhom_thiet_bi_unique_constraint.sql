-- Drop duplicate unique constraint on public.nhom_thiet_bi(don_vi_id, ma_nhom)
-- The base schema already created nhom_thiet_bi_don_vi_id_ma_nhom_key in
-- 20260131_device_quota_schema.sql. A later migration added the same uniqueness
-- again as uq_nhom_thiet_bi_don_vi_ma_nhom, which created a redundant index.

BEGIN;

ALTER TABLE public.nhom_thiet_bi
  DROP CONSTRAINT IF EXISTS uq_nhom_thiet_bi_don_vi_ma_nhom;

COMMIT;
