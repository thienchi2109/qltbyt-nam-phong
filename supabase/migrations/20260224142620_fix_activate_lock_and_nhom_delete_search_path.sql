-- Migration: lock decision activation target row and harden category delete search_path
-- Date: 2026-02-24

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_activate(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := public._get_jwt_user_id();
  v_effective_donvi BIGINT := NULL;
  v_current RECORD;
  v_previous_active_id BIGINT;
  v_result JSONB;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user_id claim is required';
  END IF;

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants for global/admin only
  ELSE
    v_effective_donvi := v_claim_donvi;
    -- SECURITY: Non-global/admin roles MUST have a tenant - fail closed if missing
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Access denied: tenant context required';
    END IF;
  END IF;

  -- Get + lock decision row to reduce activation race window
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi)
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found or access denied (id=%)', p_id;
  END IF;

  -- Only draft decisions can be activated
  IF v_current.trang_thai != 'draft' THEN
    RAISE EXCEPTION 'Only draft decisions can be activated. Current status: %', v_current.trang_thai;
  END IF;

  -- Find and deactivate current active decision for this tenant
  SELECT id INTO v_previous_active_id
  FROM public.quyet_dinh_dinh_muc
  WHERE don_vi_id = v_current.don_vi_id
    AND trang_thai = 'active'
    AND id != p_id
  FOR UPDATE;

  IF v_previous_active_id IS NOT NULL THEN
    -- Deactivate previous active decision
    UPDATE public.quyet_dinh_dinh_muc
    SET trang_thai = 'inactive',
        updated_at = NOW(),
        updated_by = v_user_id
    WHERE id = v_previous_active_id;

    -- Audit log for deactivation
    INSERT INTO public.lich_su_dinh_muc (
      quyet_dinh_id,
      don_vi_id,
      thao_tac,
      snapshot_truoc,
      snapshot_sau,
      ly_do,
      thuc_hien_boi
    ) VALUES (
      v_previous_active_id,
      v_current.don_vi_id,
      'cap_nhat',
      jsonb_build_object('trang_thai', 'active'),
      jsonb_build_object('trang_thai', 'inactive'),
      'Auto-deactivated when decision #' || p_id || ' was activated',
      v_user_id
    );
  END IF;

  -- Activate the decision
  UPDATE public.quyet_dinh_dinh_muc
  SET trang_thai = 'active',
      updated_at = NOW(),
      updated_by = v_user_id
  WHERE id = p_id;

  -- Audit log for activation
  INSERT INTO public.lich_su_dinh_muc (
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_truoc,
    snapshot_sau,
    thuc_hien_boi
  ) VALUES (
    p_id,
    v_current.don_vi_id,
    'cong_khai',
    jsonb_build_object('trang_thai', 'draft'),
    jsonb_build_object('trang_thai', 'active'),
    v_user_id
  );

  -- Return updated decision
  v_result := public.dinh_muc_quyet_dinh_get(p_id, v_effective_donvi);

  RETURN v_result;
END;
$$;

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
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_category_don_vi BIGINT;
  v_equipment_count BIGINT;
  v_child_count BIGINT;
  v_quota_count BIGINT;
BEGIN
  -- Fallback for older tokens
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- 1. Permission check: only global, admin, to_qltb can delete
  IF v_role IS NULL OR v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role.';
  END IF;

  -- 2. Tenant isolation: non-global/admin users must use their own tenant
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
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
