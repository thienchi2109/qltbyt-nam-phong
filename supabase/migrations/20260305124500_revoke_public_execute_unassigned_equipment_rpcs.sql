-- Revoke default PUBLIC execute privileges for unassigned equipment RPCs
-- Aligns production function privileges with REVIEW.md SQL security checklist

BEGIN;

REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned(
  BIGINT, TEXT, INT, INT, TEXT[], TEXT[], TEXT[], TEXT[]
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_filter_options(BIGINT) FROM PUBLIC;

COMMIT;
