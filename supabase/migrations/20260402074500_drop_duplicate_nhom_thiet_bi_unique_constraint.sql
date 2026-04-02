-- Drop the redundant nhom_thiet_bi unique constraint and backing index
-- public.nhom_thiet_bi already has the original UNIQUE (don_vi_id, ma_nhom)
-- from the schema migration; a later migration added the same constraint again.

BEGIN;

DO $$
DECLARE
  v_original_def TEXT;
  v_duplicate_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO v_original_def
  FROM pg_constraint
  WHERE conrelid = 'public.nhom_thiet_bi'::regclass
    AND conname = 'nhom_thiet_bi_don_vi_id_ma_nhom_key';

  SELECT pg_get_constraintdef(oid)
  INTO v_duplicate_def
  FROM pg_constraint
  WHERE conrelid = 'public.nhom_thiet_bi'::regclass
    AND conname = 'uq_nhom_thiet_bi_don_vi_ma_nhom';

  IF v_original_def IS NULL OR v_duplicate_def IS NULL THEN
    RETURN;
  END IF;

  IF v_original_def <> v_duplicate_def THEN
    RAISE EXCEPTION
      'Refusing to drop uq_nhom_thiet_bi_don_vi_ma_nhom because it no longer matches the original constraint';
  END IF;

  ALTER TABLE public.nhom_thiet_bi
    DROP CONSTRAINT uq_nhom_thiet_bi_don_vi_ma_nhom;
END $$;

COMMIT;
