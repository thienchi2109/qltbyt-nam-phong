-- Migration: Device Quota Decision RPC Functions
-- Date: 2026-02-01
-- Purpose: RPC functions for managing quota decisions (quyet_dinh_dinh_muc)
-- Security: All functions enforce tenant isolation per CLAUDE.md security template
-- Related: 20260131_device_quota_schema.sql

-- ============================================================================
-- SECTION 1: Helper - Get current user ID from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public._get_jwt_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
$$;

COMMENT ON FUNCTION public._get_jwt_user_id() IS 'Extract user_id from JWT claims as BIGINT';

-- ============================================================================
-- SECTION 2: dinh_muc_quyet_dinh_list
-- ============================================================================
-- Lists quota decisions with aggregated counts for categories and equipment
-- Returns: JSONB with data array, total count, page, pageSize
-- Security: Tenant isolation enforced via JWT claims

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_list(
  p_don_vi BIGINT DEFAULT NULL,
  p_trang_thai TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
BEGIN
  -- Tenant isolation: global/admin can specify, others forced to their tenant
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  -- Total count for pagination
  SELECT count(*) INTO v_total
  FROM public.quyet_dinh_dinh_muc qd
  WHERE (v_effective_donvi IS NULL OR qd.don_vi_id = v_effective_donvi)
    AND (p_trang_thai IS NULL OR qd.trang_thai = p_trang_thai);

  -- Data page with aggregated counts
  SELECT COALESCE(jsonb_agg(row_data ORDER BY ngay_ban_hanh DESC, id DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'id', qd.id,
      'don_vi_id', qd.don_vi_id,
      'so_quyet_dinh', qd.so_quyet_dinh,
      'ngay_ban_hanh', qd.ngay_ban_hanh,
      'ngay_hieu_luc', qd.ngay_hieu_luc,
      'ngay_het_hieu_luc', qd.ngay_het_hieu_luc,
      'nguoi_ky', qd.nguoi_ky,
      'chuc_vu_nguoi_ky', qd.chuc_vu_nguoi_ky,
      'trang_thai', qd.trang_thai,
      'ghi_chu', qd.ghi_chu,
      'thay_the_cho_id', qd.thay_the_cho_id,
      'created_at', qd.created_at,
      'updated_at', qd.updated_at,
      'created_by', qd.created_by,
      'updated_by', qd.updated_by,
      -- Aggregated counts
      'total_categories', (
        SELECT count(DISTINCT ct.nhom_thiet_bi_id)
        FROM public.chi_tiet_dinh_muc ct
        WHERE ct.quyet_dinh_id = qd.id
      ),
      'total_equipment_mapped', (
        SELECT count(*)
        FROM public.thiet_bi tb
        JOIN public.chi_tiet_dinh_muc ct ON ct.nhom_thiet_bi_id = tb.nhom_thiet_bi_id
        WHERE ct.quyet_dinh_id = qd.id
          AND tb.don_vi = qd.don_vi_id
      ),
      -- Facility info
      'don_vi', (
        SELECT jsonb_build_object('id', dv.id, 'name', dv.name)
        FROM public.don_vi dv
        WHERE dv.id = qd.don_vi_id
      )
    ) as row_data,
    qd.ngay_ban_hanh,
    qd.id
    FROM public.quyet_dinh_dinh_muc qd
    WHERE (v_effective_donvi IS NULL OR qd.don_vi_id = v_effective_donvi)
      AND (p_trang_thai IS NULL OR qd.trang_thai = p_trang_thai)
    ORDER BY qd.ngay_ban_hanh DESC, qd.id DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subq;

  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_list(BIGINT, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_list(BIGINT, TEXT, INT, INT) IS
'Lists quota decisions with aggregated category and equipment counts.
Returns JSONB with {data, total, page, pageSize} structure.
Tenant isolation: global/admin can filter by tenant, others see only their tenant.';

-- ============================================================================
-- SECTION 3: dinh_muc_quyet_dinh_get
-- ============================================================================
-- Get single decision with line items
-- Returns: JSONB with decision details and chi_tiet array
-- Security: Tenant isolation enforced via JWT claims

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_get(
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
  v_effective_donvi BIGINT := NULL;
  v_result JSONB := NULL;
BEGIN
  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- Get decision with line items
  SELECT jsonb_build_object(
    'id', qd.id,
    'don_vi_id', qd.don_vi_id,
    'so_quyet_dinh', qd.so_quyet_dinh,
    'ngay_ban_hanh', qd.ngay_ban_hanh,
    'ngay_hieu_luc', qd.ngay_hieu_luc,
    'ngay_het_hieu_luc', qd.ngay_het_hieu_luc,
    'nguoi_ky', qd.nguoi_ky,
    'chuc_vu_nguoi_ky', qd.chuc_vu_nguoi_ky,
    'trang_thai', qd.trang_thai,
    'ghi_chu', qd.ghi_chu,
    'thay_the_cho_id', qd.thay_the_cho_id,
    'created_at', qd.created_at,
    'updated_at', qd.updated_at,
    'created_by', qd.created_by,
    'updated_by', qd.updated_by,
    -- Facility info
    'don_vi', (
      SELECT jsonb_build_object('id', dv.id, 'name', dv.name)
      FROM public.don_vi dv
      WHERE dv.id = qd.don_vi_id
    ),
    -- Line items with category details
    'chi_tiet', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ct.id,
        'quyet_dinh_id', ct.quyet_dinh_id,
        'nhom_thiet_bi_id', ct.nhom_thiet_bi_id,
        'so_luong_toi_da', ct.so_luong_toi_da,
        'so_luong_toi_thieu', ct.so_luong_toi_thieu,
        'ghi_chu', ct.ghi_chu,
        'created_at', ct.created_at,
        'updated_at', ct.updated_at,
        -- Category info
        'nhom_thiet_bi', jsonb_build_object(
          'id', nt.id,
          'ma_nhom', nt.ma_nhom,
          'ten_nhom', nt.ten_nhom,
          'phan_loai', nt.phan_loai,
          'don_vi_tinh', nt.don_vi_tinh
        ),
        -- Current equipment count in this category
        'so_luong_hien_tai', (
          SELECT count(*)
          FROM public.thiet_bi tb
          WHERE tb.nhom_thiet_bi_id = ct.nhom_thiet_bi_id
            AND tb.don_vi = qd.don_vi_id
        )
      ) ORDER BY nt.thu_tu_hien_thi, nt.ma_nhom)
      FROM public.chi_tiet_dinh_muc ct
      JOIN public.nhom_thiet_bi nt ON nt.id = ct.nhom_thiet_bi_id
      WHERE ct.quyet_dinh_id = qd.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.quyet_dinh_dinh_muc qd
  WHERE qd.id = p_id
    AND (v_effective_donvi IS NULL OR qd.don_vi_id = v_effective_donvi);

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found or access denied (id=%)', p_id;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_get(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_get(BIGINT, BIGINT) IS
'Get single quota decision with all line items and category details.
Returns JSONB with decision data and chi_tiet array containing category info and current equipment counts.
Tenant isolation: global/admin can access any tenant, others only their tenant.';

-- ============================================================================
-- SECTION 4: dinh_muc_quyet_dinh_create
-- ============================================================================
-- Create new quota decision in draft status
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='tao'

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

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_create(TEXT, DATE, DATE, TEXT, TEXT, BIGINT, DATE, TEXT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_create(TEXT, DATE, DATE, TEXT, TEXT, BIGINT, DATE, TEXT, BIGINT) IS
'Create a new quota decision in draft status.
Required: so_quyet_dinh, ngay_ban_hanh, ngay_hieu_luc, nguoi_ky, chuc_vu_nguoi_ky
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=tao.';

-- ============================================================================
-- SECTION 5: dinh_muc_quyet_dinh_update
-- ============================================================================
-- Update draft decision only
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='cap_nhat'

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

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
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

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_update(BIGINT, TEXT, DATE, DATE, DATE, TEXT, TEXT, TEXT, BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_update(BIGINT, TEXT, DATE, DATE, DATE, TEXT, TEXT, TEXT, BIGINT, BIGINT) IS
'Update a draft quota decision. Active/inactive decisions cannot be updated.
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=cap_nhat and before/after snapshots.';

-- ============================================================================
-- SECTION 6: dinh_muc_quyet_dinh_activate
-- ============================================================================
-- Activate a draft decision, deactivate any current active decision
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='cong_khai'

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

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
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

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_activate(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_activate(BIGINT, BIGINT) IS
'Activate a draft quota decision. Any currently active decision for the same tenant will be deactivated.
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=cong_khai.';

-- ============================================================================
-- SECTION 7: dinh_muc_quyet_dinh_delete
-- ============================================================================
-- Delete a draft decision only
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='huy' before deletion

CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_delete(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL,
  p_ly_do TEXT DEFAULT NULL
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
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- Get decision to delete
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi);

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
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_delete(BIGINT, BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_quyet_dinh_delete(BIGINT, BIGINT, TEXT) IS
'Delete a draft quota decision. Active/inactive decisions cannot be deleted.
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=huy before deletion.';

-- ============================================================================
-- SECTION 8: Index Suggestions for Performance
-- ============================================================================
-- These indexes support the RPC functions above

-- Already created in schema migration:
-- idx_quyet_dinh_don_vi (don_vi_id)
-- idx_quyet_dinh_trang_thai (trang_thai)

-- Additional indexes for list queries with ordering
CREATE INDEX IF NOT EXISTS idx_quyet_dinh_don_vi_date
ON public.quyet_dinh_dinh_muc(don_vi_id, ngay_ban_hanh DESC, id DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Rollback procedure:
/*
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_delete(BIGINT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_activate(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_update(BIGINT, TEXT, DATE, DATE, DATE, TEXT, TEXT, TEXT, BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_create(TEXT, DATE, DATE, TEXT, TEXT, BIGINT, DATE, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_get(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.dinh_muc_quyet_dinh_list(BIGINT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public._get_jwt_user_id();
DROP INDEX IF EXISTS public.idx_quyet_dinh_don_vi_date;
*/
