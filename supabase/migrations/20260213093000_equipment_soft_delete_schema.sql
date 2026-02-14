-- Migration: Add soft-delete schema flag for equipment
-- Date: 2026-02-13
-- Purpose:
--   1) add public.thiet_bi.is_deleted with non-null default false
--   2) add indexes used by active-row filtering paths

BEGIN;

ALTER TABLE public.thiet_bi
  ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_is_deleted
  ON public.thiet_bi (is_deleted);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_active_don_vi
  ON public.thiet_bi (don_vi)
  WHERE is_deleted = false AND don_vi IS NOT NULL;

COMMIT;
