-- Retire the legacy Supabase 384-dimensional DQSS fallback.
-- The suggestion runtime now uses the VM-backed provider and the 768-dimensional
-- device_quota_category_embeddings table.

BEGIN;

DROP FUNCTION IF EXISTS public.hybrid_search_category_batch(
  JSONB,
  BIGINT,
  INTEGER,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  INTEGER
);

ALTER TABLE public.nhom_thiet_bi
  DROP COLUMN IF EXISTS embedding;

COMMENT ON TABLE public.device_quota_category_embeddings IS
  'Server-only 768-dimensional Device Quota category embeddings for the DQSS VM provider.';

COMMIT;
