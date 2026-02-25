-- Migration: align dinh_muc_nhom_delete with JWT helpers and require user_id guard
-- Date: 2026-02-25

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_delete(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := public._get_jwt_user_id();
  v_category_don_vi BIGINT;
  v_equipment_count BIGINT;
  v_child_count BIGINT;
  v_quota_count BIGINT;
BEGIN
  -- 1. Permission check: only global, admin, to_qltb can delete
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role.';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user_id claim is required';
  END IF;

  -- 2. Tenant isolation: non-global/admin users must use their own tenant
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := v_claim_donvi;
    -- SECURITY: Non-global/admin roles MUST have a tenant - fail closed if missing
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Access denied: tenant context required';
    END IF;
  END IF;

  -- Validate category ID
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Category ID (p_id) is required.';
  END IF;

  -- Verify category exists and lock row to prevent TOCTOU before dependency checks + delete
  SELECT don_vi_id INTO v_category_don_vi
  FROM public.nhom_thiet_bi
  WHERE id = p_id
  FOR UPDATE;

  IF v_category_don_vi IS NULL THEN
    RAISE EXCEPTION 'Category not found.';
  END IF;

  -- Enforce tenant ownership
  IF p_don_vi IS NOT NULL AND v_category_don_vi != p_don_vi THEN
    RAISE EXCEPTION 'Category belongs to different tenant.';
  END IF;

  -- 3. Check for linked equipment
  SELECT COUNT(*) INTO v_equipment_count
  FROM public.thiet_bi
  WHERE nhom_thiet_bi_id = p_id;

  IF v_equipment_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % equipment item(s) are linked. Unlink equipment first.', v_equipment_count;
  END IF;

  -- 4. Check for child categories
  SELECT COUNT(*) INTO v_child_count
  FROM public.nhom_thiet_bi
  WHERE parent_id = p_id;

  IF v_child_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % child category(ies) exist. Delete or reassign children first.', v_child_count;
  END IF;

  -- 5. Check for quota line items referencing this category
  SELECT COUNT(*) INTO v_quota_count
  FROM public.chi_tiet_dinh_muc
  WHERE nhom_thiet_bi_id = p_id;

  IF v_quota_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % quota line item(s) reference this category. Remove from quotas first.', v_quota_count;
  END IF;

  -- 6. Delete the category
  DELETE FROM public.nhom_thiet_bi
  WHERE id = p_id;

  RETURN TRUE;
END;
$$;

COMMIT;
