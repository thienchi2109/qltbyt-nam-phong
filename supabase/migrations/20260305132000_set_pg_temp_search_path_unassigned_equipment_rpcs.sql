-- Ensure SECURITY DEFINER RPCs use safe search_path including pg_temp
-- Aligns deployed function settings with REVIEW.md SQL Function Security Checklist

BEGIN;

ALTER FUNCTION public.dinh_muc_thiet_bi_unassigned(
  BIGINT, TEXT, INT, INT, TEXT[], TEXT[], TEXT[], TEXT[]
) SET search_path = public, pg_temp;

ALTER FUNCTION public.dinh_muc_thiet_bi_unassigned_filter_options(BIGINT)
SET search_path = public, pg_temp;

COMMIT;
