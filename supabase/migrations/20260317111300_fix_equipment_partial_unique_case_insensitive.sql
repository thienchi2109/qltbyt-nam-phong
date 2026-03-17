-- Migration: Fix case-sensitivity mismatch in partial unique index on ma_thiet_bi
-- Date: 2026-03-17
--
-- Problem: idx_thiet_bi_ma_unique_active uses raw ma_thiet_bi (case-sensitive),
--          but the entire codebase treats equipment codes as case-insensitive:
--          - equipment_get_by_code: lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
--          - equipment_restore guard: lower(ma_thiet_bi) = lower(v_code)
--          This allows 'ABC' and 'abc' to coexist as active, which lookups
--          would treat as duplicates.
--
-- Fix: Recreate the partial unique index on lower(ma_thiet_bi) to enforce
--      case-insensitive uniqueness matching application semantics.

BEGIN;

DROP INDEX IF EXISTS public.idx_thiet_bi_ma_unique_active;

CREATE UNIQUE INDEX idx_thiet_bi_ma_unique_active
  ON public.thiet_bi (lower(ma_thiet_bi))
  WHERE is_deleted = false;

COMMENT ON INDEX idx_thiet_bi_ma_unique_active IS
  'Partial unique (case-insensitive): only active (non-deleted) equipment must '
  'have unique codes. Uses lower() to match application lookup semantics.';

COMMIT;
