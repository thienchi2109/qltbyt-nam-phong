-- Migration: add explicit JWT user guards for decision write RPCs and lock category delete row
-- Date: 2026-02-24

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_create(
  p_so_quyet_dinh TEXT,
  p_ngay_ban_hanh DATE,
  p_ngay_hieu_luc DATE,
  p_nguoi_ky TEXT,
  p_chuc_vu_nguoi_ky TEXT,
  p_don_vi BIGINT DEFAULT NULL,
  p_ngay_het_hieu_luc DATE DEFAULT NULL,
  p_ghi_chu TEXT DEFAULT NULL,
  p_thay_the_cho_id BIGINT DEFAULT NULL
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
  v_new_id BIGINT;
  v_result JSONB;
BEGIN
  -- Permission check: only global, admin, to_qltb can create
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user_id claim is required';
  END IF;

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := COALESCE(p_don_vi, v_claim_donvi);
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  IF v_effective_donvi IS NULL THEN
    RAISE EXCEPTION 'Tenant (don_vi) is required';
  END IF;

  -- Validate required fields
  IF p_so_quyet_dinh IS NULL OR trim(p_so_quyet_dinh) = '' THEN
    RAISE EXCEPTION 'Decision number (so_quyet_dinh) is required';
  END IF;

  IF p_nguoi_ky IS NULL OR trim(p_nguoi_ky) = '' THEN
    RAISE EXCEPTION 'Signer name (nguoi_ky) is required';
  END IF;

  IF p_chuc_vu_nguoi_ky IS NULL OR trim(p_chuc_vu_nguoi_ky) = '' THEN
    RAISE EXCEPTION 'Signer position (chuc_vu_nguoi_ky) is required';
  END IF;

  -- Create decision in draft status
  INSERT INTO public.quyet_dinh_dinh_muc (
    don_vi_id,
    so_quyet_dinh,
    ngay_ban_hanh,
    ngay_hieu_luc,
    ngay_het_hieu_luc,
    nguoi_ky,
    chuc_vu_nguoi_ky,
    trang_thai,
    ghi_chu,
    thay_the_cho_id,
    created_by,
    updated_by
  ) VALUES (
    v_effective_donvi,
    trim(p_so_quyet_dinh),
    p_ngay_ban_hanh,
    p_ngay_hieu_luc,
    p_ngay_het_hieu_luc,
    trim(p_nguoi_ky),
    trim(p_chuc_vu_nguoi_ky),
    'draft',
    p_ghi_chu,
    p_thay_the_cho_id,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_new_id;

  -- Write audit log
  INSERT INTO public.lich_su_dinh_muc (
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_sau,
    thuc_hien_boi
  ) VALUES (
    v_new_id,
    v_effective_donvi,
    'tao',
    jsonb_build_object(
      'so_quyet_dinh', trim(p_so_quyet_dinh),
      'ngay_ban_hanh', p_ngay_ban_hanh,
      'ngay_hieu_luc', p_ngay_hieu_luc,
      'ngay_het_hieu_luc', p_ngay_het_hieu_luc,
      'nguoi_ky', trim(p_nguoi_ky),
      'chuc_vu_nguoi_ky', trim(p_chuc_vu_nguoi_ky),
      'trang_thai', 'draft'
    ),
    v_user_id
  );

  -- Return the created decision
  v_result := public.dinh_muc_quyet_dinh_get(v_new_id, v_effective_donvi);

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_update(
  p_id BIGINT,
  p_so_quyet_dinh TEXT DEFAULT NULL,
  p_ngay_ban_hanh DATE DEFAULT NULL,
  p_ngay_hieu_luc DATE DEFAULT NULL,
  p_ngay_het_hieu_luc DATE DEFAULT NULL,
  p_nguoi_ky TEXT DEFAULT NULL,
  p_chuc_vu_nguoi_ky TEXT DEFAULT NULL,
  p_ghi_chu TEXT DEFAULT NULL,
  p_thay_the_cho_id BIGINT DEFAULT NULL,
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
  v_snapshot_truoc JSONB;
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

  -- Get current decision for validation and snapshot
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi);

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found or access denied (id=%)', p_id;
  END IF;

  -- Only draft decisions can be updated
  IF v_current.trang_thai != 'draft' THEN
    RAISE EXCEPTION 'Only draft decisions can be updated. Current status: %', v_current.trang_thai;
  END IF;

  -- Create snapshot before update
  v_snapshot_truoc := jsonb_build_object(
    'so_quyet_dinh', v_current.so_quyet_dinh,
    'ngay_ban_hanh', v_current.ngay_ban_hanh,
    'ngay_hieu_luc', v_current.ngay_hieu_luc,
    'ngay_het_hieu_luc', v_current.ngay_het_hieu_luc,
    'nguoi_ky', v_current.nguoi_ky,
    'chuc_vu_nguoi_ky', v_current.chuc_vu_nguoi_ky,
    'ghi_chu', v_current.ghi_chu,
    'thay_the_cho_id', v_current.thay_the_cho_id
  );

  -- Update decision
  UPDATE public.quyet_dinh_dinh_muc SET
    so_quyet_dinh = COALESCE(NULLIF(trim(p_so_quyet_dinh), ''), so_quyet_dinh),
    ngay_ban_hanh = COALESCE(p_ngay_ban_hanh, ngay_ban_hanh),
    ngay_hieu_luc = COALESCE(p_ngay_hieu_luc, ngay_hieu_luc),
    ngay_het_hieu_luc = COALESCE(p_ngay_het_hieu_luc, ngay_het_hieu_luc),
    nguoi_ky = COALESCE(NULLIF(trim(p_nguoi_ky), ''), nguoi_ky),
    chuc_vu_nguoi_ky = COALESCE(NULLIF(trim(p_chuc_vu_nguoi_ky), ''), chuc_vu_nguoi_ky),
    ghi_chu = CASE WHEN p_ghi_chu IS NOT NULL THEN p_ghi_chu ELSE ghi_chu END,
    thay_the_cho_id = CASE WHEN p_thay_the_cho_id IS NOT NULL THEN p_thay_the_cho_id ELSE thay_the_cho_id END,
    updated_at = NOW(),
    updated_by = v_user_id
  WHERE id = p_id;

  -- Get updated decision for snapshot_sau
  v_result := public.dinh_muc_quyet_dinh_get(p_id, v_effective_donvi);

  -- Write audit log
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
    'cap_nhat',
    v_snapshot_truoc,
    jsonb_build_object(
      'so_quyet_dinh', COALESCE(NULLIF(trim(p_so_quyet_dinh), ''), v_current.so_quyet_dinh),
      'ngay_ban_hanh', COALESCE(p_ngay_ban_hanh, v_current.ngay_ban_hanh),
      'ngay_hieu_luc', COALESCE(p_ngay_hieu_luc, v_current.ngay_hieu_luc),
      'ngay_het_hieu_luc', COALESCE(p_ngay_het_hieu_luc, v_current.ngay_het_hieu_luc),
      'nguoi_ky', COALESCE(NULLIF(trim(p_nguoi_ky), ''), v_current.nguoi_ky),
      'chuc_vu_nguoi_ky', COALESCE(NULLIF(trim(p_chuc_vu_nguoi_ky), ''), v_current.chuc_vu_nguoi_ky),
      'ghi_chu', CASE WHEN p_ghi_chu IS NOT NULL THEN p_ghi_chu ELSE v_current.ghi_chu END,
      'thay_the_cho_id', CASE WHEN p_thay_the_cho_id IS NOT NULL THEN p_thay_the_cho_id ELSE v_current.thay_the_cho_id END
    ),
    v_user_id
  );

  RETURN v_result;
END;
$$;

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

  -- Get decision to activate
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi);

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
    AND id != p_id;

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

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_delete(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL,
  p_ly_do TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := public._get_jwt_user_id();
  v_effective_donvi BIGINT := NULL;
  v_current RECORD;
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

  -- Lock decision row to avoid TOCTOU between status check and delete
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi)
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found or access denied (id=%)', p_id;
  END IF;

  -- Only draft decisions can be deleted
  IF v_current.trang_thai != 'draft' THEN
    RAISE EXCEPTION 'Only draft decisions can be deleted. Current status: %', v_current.trang_thai;
  END IF;

  -- Write audit log BEFORE deletion (since quyet_dinh_id will be SET NULL on delete)
  INSERT INTO public.lich_su_dinh_muc (
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_truoc,
    ly_do,
    thuc_hien_boi
  ) VALUES (
    p_id,
    v_current.don_vi_id,
    'huy',
    jsonb_build_object(
      'id', v_current.id,
      'so_quyet_dinh', v_current.so_quyet_dinh,
      'ngay_ban_hanh', v_current.ngay_ban_hanh,
      'ngay_hieu_luc', v_current.ngay_hieu_luc,
      'ngay_het_hieu_luc', v_current.ngay_het_hieu_luc,
      'nguoi_ky', v_current.nguoi_ky,
      'chuc_vu_nguoi_ky', v_current.chuc_vu_nguoi_ky,
      'trang_thai', v_current.trang_thai,
      'ghi_chu', v_current.ghi_chu
    ),
    COALESCE(p_ly_do, 'Draft decision deleted'),
    v_user_id
  );

  -- Delete the decision (cascade will delete chi_tiet_dinh_muc)
  DELETE FROM public.quyet_dinh_dinh_muc WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_id,
    'so_quyet_dinh', v_current.so_quyet_dinh
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_delete(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
