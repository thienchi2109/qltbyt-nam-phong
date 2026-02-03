-- Migration: Device Quota Line Item RPC Functions
-- Date: 2026-02-01
-- Purpose: RPC functions for managing quota line items (chi_tiet_dinh_muc)
-- Security: All functions enforce tenant isolation per CLAUDE.md security template
-- Related: 20260131_device_quota_schema.sql, 20260201_device_quota_rpc_decisions.sql

-- ============================================================================
-- SECTION 1: dinh_muc_chi_tiet_list
-- ============================================================================
-- Lists quota line items for a decision with category details and current counts
-- Returns: JSONB with data array containing line items with category info
-- Security: Tenant isolation only, no role restriction (all authenticated users can read)

CREATE OR REPLACE FUNCTION public.dinh_muc_chi_tiet_list(
  p_quyet_dinh_id BIGINT,
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
  v_decision_donvi BIGINT;
  v_data JSONB := '[]'::jsonb;
BEGIN
  -- Input validation
  IF p_quyet_dinh_id IS NULL THEN
    RAISE EXCEPTION 'Decision ID (p_quyet_dinh_id) is required';
  END IF;

  -- Tenant isolation: global/admin can specify, others forced to their tenant
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants for global
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  -- Verify decision exists and get its tenant
  SELECT don_vi_id INTO v_decision_donvi
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_quyet_dinh_id;

  IF v_decision_donvi IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found (id=%)', p_quyet_dinh_id;
  END IF;

  -- Verify tenant access
  IF v_effective_donvi IS NOT NULL AND v_decision_donvi != v_effective_donvi THEN
    RAISE EXCEPTION 'Access denied: decision belongs to different tenant';
  END IF;

  -- Get line items with category details and current equipment count
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ct.id,
      'quyet_dinh_id', ct.quyet_dinh_id,
      'nhom_thiet_bi_id', ct.nhom_thiet_bi_id,
      'so_luong_dinh_muc', ct.so_luong_toi_da,  -- Alias for frontend compatibility
      'so_luong_toi_thieu', ct.so_luong_toi_thieu,
      'ghi_chu', ct.ghi_chu,
      'created_at', ct.created_at,
      'updated_at', ct.updated_at,
      -- Category info
      'ma_nhom', nt.ma_nhom,
      'ten_nhom', nt.ten_nhom,
      'phan_loai', nt.phan_loai,
      'don_vi_tinh', nt.don_vi_tinh,
      -- Current equipment count in this category for this tenant
      'so_luong_hien_co', (
        SELECT count(*)
        FROM public.thiet_bi tb
        WHERE tb.nhom_thiet_bi_id = ct.nhom_thiet_bi_id
          AND tb.don_vi = v_decision_donvi
      )
    ) ORDER BY nt.thu_tu_hien_thi, nt.ma_nhom
  ), '[]'::jsonb) INTO v_data
  FROM public.chi_tiet_dinh_muc ct
  JOIN public.nhom_thiet_bi nt ON nt.id = ct.nhom_thiet_bi_id
  WHERE ct.quyet_dinh_id = p_quyet_dinh_id;

  RETURN jsonb_build_object(
    'data', v_data,
    'quyet_dinh_id', p_quyet_dinh_id,
    'total', jsonb_array_length(v_data)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_chi_tiet_list(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_chi_tiet_list(BIGINT, BIGINT) IS
'Lists quota line items for a decision with category details and current equipment counts.
Returns: {data: [...], quyet_dinh_id, total}
Each item includes: id, quyet_dinh_id, nhom_thiet_bi_id, so_luong_dinh_muc, so_luong_toi_thieu,
  ghi_chu, ma_nhom, ten_nhom, phan_loai, don_vi_tinh, so_luong_hien_co
Tenant isolation: global/admin can specify tenant, others see only their tenant decisions.';

-- ============================================================================
-- SECTION 2: dinh_muc_chi_tiet_upsert
-- ============================================================================
-- Create or update a quota line item
-- If p_id is NULL: INSERT new line item
-- If p_id is NOT NULL: UPDATE existing line item
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='tao' or 'dieu_chinh'

CREATE OR REPLACE FUNCTION public.dinh_muc_chi_tiet_upsert(
  p_id BIGINT DEFAULT NULL,
  p_quyet_dinh_id BIGINT DEFAULT NULL,
  p_nhom_thiet_bi_id BIGINT DEFAULT NULL,
  p_so_luong_toi_da INT DEFAULT NULL,
  p_so_luong_toi_thieu INT DEFAULT NULL,
  p_ghi_chu TEXT DEFAULT NULL,
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
  v_decision_record RECORD;
  v_category_donvi BIGINT;
  v_existing RECORD;
  v_new_id BIGINT;
  v_snapshot_truoc JSONB := NULL;
  v_snapshot_sau JSONB;
  v_thao_tac TEXT;
BEGIN
  -- Permission check: only global, admin, to_qltb can create/update
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- Validate required fields for new line items
  IF p_id IS NULL THEN
    IF p_quyet_dinh_id IS NULL THEN
      RAISE EXCEPTION 'Decision ID (p_quyet_dinh_id) is required for new line items';
    END IF;
    IF p_nhom_thiet_bi_id IS NULL THEN
      RAISE EXCEPTION 'Category ID (p_nhom_thiet_bi_id) is required for new line items';
    END IF;
    IF p_so_luong_toi_da IS NULL THEN
      RAISE EXCEPTION 'Maximum quantity (p_so_luong_toi_da) is required for new line items';
    END IF;
  END IF;

  -- Validate quantity range
  IF p_so_luong_toi_da IS NOT NULL AND p_so_luong_toi_da < 0 THEN
    RAISE EXCEPTION 'Maximum quantity must be non-negative';
  END IF;
  IF p_so_luong_toi_thieu IS NOT NULL AND p_so_luong_toi_thieu < 0 THEN
    RAISE EXCEPTION 'Minimum quantity must be non-negative';
  END IF;
  IF p_so_luong_toi_da IS NOT NULL AND p_so_luong_toi_thieu IS NOT NULL
     AND p_so_luong_toi_thieu > p_so_luong_toi_da THEN
    RAISE EXCEPTION 'Minimum quantity (%) cannot exceed maximum quantity (%)',
      p_so_luong_toi_thieu, p_so_luong_toi_da;
  END IF;

  -- Branch: UPDATE existing or INSERT new
  IF p_id IS NOT NULL THEN
    -- ========== UPDATE PATH ==========

    -- Get existing line item with decision info
    SELECT ct.*, qd.don_vi_id as decision_donvi, qd.trang_thai as decision_status
    INTO v_existing
    FROM public.chi_tiet_dinh_muc ct
    JOIN public.quyet_dinh_dinh_muc qd ON qd.id = ct.quyet_dinh_id
    WHERE ct.id = p_id;

    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'Line item not found (id=%)', p_id;
    END IF;

    -- Verify tenant access
    IF v_effective_donvi IS NOT NULL AND v_existing.decision_donvi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied: line item belongs to different tenant';
    END IF;

    -- Verify decision is in draft status
    IF v_existing.decision_status != 'draft' THEN
      RAISE EXCEPTION 'Cannot modify line items of non-draft decisions. Decision status: %',
        v_existing.decision_status;
    END IF;

    -- If changing category, validate cross-tenant
    IF p_nhom_thiet_bi_id IS NOT NULL AND p_nhom_thiet_bi_id != v_existing.nhom_thiet_bi_id THEN
      SELECT don_vi_id INTO v_category_donvi
      FROM public.nhom_thiet_bi WHERE id = p_nhom_thiet_bi_id;

      IF v_category_donvi IS NULL THEN
        RAISE EXCEPTION 'Category not found (id=%)', p_nhom_thiet_bi_id;
      END IF;

      IF v_category_donvi != v_existing.decision_donvi THEN
        RAISE EXCEPTION 'Category must belong to the same facility as the decision';
      END IF;
    END IF;

    -- Create snapshot before update
    v_snapshot_truoc := jsonb_build_object(
      'id', v_existing.id,
      'quyet_dinh_id', v_existing.quyet_dinh_id,
      'nhom_thiet_bi_id', v_existing.nhom_thiet_bi_id,
      'so_luong_toi_da', v_existing.so_luong_toi_da,
      'so_luong_toi_thieu', v_existing.so_luong_toi_thieu,
      'ghi_chu', v_existing.ghi_chu
    );

    -- Validate final min/max values after COALESCE (prevents partial update constraint violations)
    DECLARE
      v_final_min INT := COALESCE(p_so_luong_toi_thieu, v_existing.so_luong_toi_thieu);
      v_final_max INT := COALESCE(p_so_luong_toi_da, v_existing.so_luong_toi_da);
    BEGIN
      IF v_final_min > v_final_max THEN
        RAISE EXCEPTION 'Minimum quantity (%) cannot exceed maximum quantity (%). Current min=%, max=%; updating min to %, max to %',
          v_final_min, v_final_max,
          v_existing.so_luong_toi_thieu, v_existing.so_luong_toi_da,
          COALESCE(p_so_luong_toi_thieu::TEXT, '(unchanged)'),
          COALESCE(p_so_luong_toi_da::TEXT, '(unchanged)');
      END IF;
    END;

    -- Perform update
    UPDATE public.chi_tiet_dinh_muc SET
      nhom_thiet_bi_id = COALESCE(p_nhom_thiet_bi_id, nhom_thiet_bi_id),
      so_luong_toi_da = COALESCE(p_so_luong_toi_da, so_luong_toi_da),
      so_luong_toi_thieu = COALESCE(p_so_luong_toi_thieu, so_luong_toi_thieu),
      ghi_chu = CASE WHEN p_ghi_chu IS NOT NULL THEN p_ghi_chu ELSE ghi_chu END,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_new_id;

    v_thao_tac := 'dieu_chinh';

  ELSE
    -- ========== INSERT PATH ==========

    -- Get decision info
    SELECT * INTO v_decision_record
    FROM public.quyet_dinh_dinh_muc
    WHERE id = p_quyet_dinh_id;

    IF v_decision_record IS NULL THEN
      RAISE EXCEPTION 'Quota decision not found (id=%)', p_quyet_dinh_id;
    END IF;

    -- Verify tenant access
    IF v_effective_donvi IS NOT NULL AND v_decision_record.don_vi_id != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied: decision belongs to different tenant';
    END IF;

    -- Verify decision is in draft status
    IF v_decision_record.trang_thai != 'draft' THEN
      RAISE EXCEPTION 'Cannot add line items to non-draft decisions. Decision status: %',
        v_decision_record.trang_thai;
    END IF;

    -- Validate category exists and belongs to same tenant
    SELECT don_vi_id INTO v_category_donvi
    FROM public.nhom_thiet_bi WHERE id = p_nhom_thiet_bi_id;

    IF v_category_donvi IS NULL THEN
      RAISE EXCEPTION 'Category not found (id=%)', p_nhom_thiet_bi_id;
    END IF;

    IF v_category_donvi != v_decision_record.don_vi_id THEN
      RAISE EXCEPTION 'Category must belong to the same facility as the decision';
    END IF;

    -- Insert new line item
    INSERT INTO public.chi_tiet_dinh_muc (
      quyet_dinh_id,
      nhom_thiet_bi_id,
      so_luong_toi_da,
      so_luong_toi_thieu,
      ghi_chu
    ) VALUES (
      p_quyet_dinh_id,
      p_nhom_thiet_bi_id,
      p_so_luong_toi_da,
      COALESCE(p_so_luong_toi_thieu, 0),
      p_ghi_chu
    )
    RETURNING id INTO v_new_id;

    v_thao_tac := 'tao';
  END IF;

  -- Get the updated/created record for snapshot_sau
  SELECT ct.*, qd.don_vi_id as decision_donvi
  INTO v_existing
  FROM public.chi_tiet_dinh_muc ct
  JOIN public.quyet_dinh_dinh_muc qd ON qd.id = ct.quyet_dinh_id
  WHERE ct.id = v_new_id;

  v_snapshot_sau := jsonb_build_object(
    'id', v_existing.id,
    'quyet_dinh_id', v_existing.quyet_dinh_id,
    'nhom_thiet_bi_id', v_existing.nhom_thiet_bi_id,
    'so_luong_toi_da', v_existing.so_luong_toi_da,
    'so_luong_toi_thieu', v_existing.so_luong_toi_thieu,
    'ghi_chu', v_existing.ghi_chu
  );

  -- Write audit log
  INSERT INTO public.lich_su_dinh_muc (
    chi_tiet_id,
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_truoc,
    snapshot_sau,
    thuc_hien_boi
  ) VALUES (
    v_new_id,
    v_existing.quyet_dinh_id,
    v_existing.decision_donvi,
    v_thao_tac,
    v_snapshot_truoc,
    v_snapshot_sau,
    v_user_id
  );

  -- Return result
  RETURN jsonb_build_object(
    'id', v_new_id,
    'operation', CASE WHEN v_thao_tac = 'tao' THEN 'created' ELSE 'updated' END,
    'quyet_dinh_id', v_existing.quyet_dinh_id,
    'nhom_thiet_bi_id', v_existing.nhom_thiet_bi_id,
    'so_luong_toi_da', v_existing.so_luong_toi_da,
    'so_luong_toi_thieu', v_existing.so_luong_toi_thieu,
    'ghi_chu', v_existing.ghi_chu
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_chi_tiet_upsert(BIGINT, BIGINT, BIGINT, INT, INT, TEXT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_chi_tiet_upsert(BIGINT, BIGINT, BIGINT, INT, INT, TEXT, BIGINT) IS
'Create or update a quota line item.
If p_id is NULL: INSERT new line item (requires p_quyet_dinh_id, p_nhom_thiet_bi_id, p_so_luong_toi_da)
If p_id is NOT NULL: UPDATE existing line item
Validates: decision is in draft status, category belongs to same tenant
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=tao (insert) or dieu_chinh (update).';

-- ============================================================================
-- SECTION 3: dinh_muc_chi_tiet_delete
-- ============================================================================
-- Delete a quota line item
-- Security: Only global, admin, to_qltb roles
-- Audit: Writes to lich_su_dinh_muc with thao_tac='huy' before deletion

CREATE OR REPLACE FUNCTION public.dinh_muc_chi_tiet_delete(
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
  v_existing RECORD;
  v_category_info RECORD;
BEGIN
  -- Permission check: only global, admin, to_qltb can delete
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  -- Input validation
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Line item ID (p_id) is required';
  END IF;

  -- Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- Get existing line item with decision info
  SELECT ct.*, qd.don_vi_id as decision_donvi, qd.trang_thai as decision_status,
         qd.so_quyet_dinh
  INTO v_existing
  FROM public.chi_tiet_dinh_muc ct
  JOIN public.quyet_dinh_dinh_muc qd ON qd.id = ct.quyet_dinh_id
  WHERE ct.id = p_id;

  IF v_existing IS NULL THEN
    RAISE EXCEPTION 'Line item not found (id=%)', p_id;
  END IF;

  -- Verify tenant access
  IF v_effective_donvi IS NOT NULL AND v_existing.decision_donvi != v_effective_donvi THEN
    RAISE EXCEPTION 'Access denied: line item belongs to different tenant';
  END IF;

  -- Verify decision is in draft status
  IF v_existing.decision_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot delete line items from non-draft decisions. Decision status: %',
      v_existing.decision_status;
  END IF;

  -- Get category info for better audit log
  SELECT ma_nhom, ten_nhom INTO v_category_info
  FROM public.nhom_thiet_bi WHERE id = v_existing.nhom_thiet_bi_id;

  -- Write audit log BEFORE deletion (since chi_tiet_id will be SET NULL on delete)
  INSERT INTO public.lich_su_dinh_muc (
    chi_tiet_id,
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_truoc,
    ly_do,
    thuc_hien_boi
  ) VALUES (
    p_id,
    v_existing.quyet_dinh_id,
    v_existing.decision_donvi,
    'huy',
    jsonb_build_object(
      'id', v_existing.id,
      'quyet_dinh_id', v_existing.quyet_dinh_id,
      'nhom_thiet_bi_id', v_existing.nhom_thiet_bi_id,
      'ma_nhom', v_category_info.ma_nhom,
      'ten_nhom', v_category_info.ten_nhom,
      'so_luong_toi_da', v_existing.so_luong_toi_da,
      'so_luong_toi_thieu', v_existing.so_luong_toi_thieu,
      'ghi_chu', v_existing.ghi_chu
    ),
    COALESCE(p_ly_do, 'Line item deleted'),
    v_user_id
  );

  -- Delete the line item
  DELETE FROM public.chi_tiet_dinh_muc WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_id,
    'quyet_dinh_id', v_existing.quyet_dinh_id,
    'nhom_thiet_bi_id', v_existing.nhom_thiet_bi_id,
    'ma_nhom', v_category_info.ma_nhom,
    'ten_nhom', v_category_info.ten_nhom
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_chi_tiet_delete(BIGINT, BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_chi_tiet_delete(BIGINT, BIGINT, TEXT) IS
'Delete a quota line item from a draft decision.
Validates: decision is in draft status
Returns: {success, deleted_id, quyet_dinh_id, nhom_thiet_bi_id, ma_nhom, ten_nhom}
Roles: global, admin, to_qltb only.
Audit: Creates lich_su_dinh_muc record with thao_tac=huy before deletion.';

-- ============================================================================
-- SECTION 4: Index Suggestions for Performance
-- ============================================================================
-- These indexes support the RPC functions above

-- Already created in schema migration:
-- idx_chi_tiet_quyet_dinh (quyet_dinh_id)
-- idx_chi_tiet_nhom (nhom_thiet_bi_id)

-- No additional indexes needed for line item queries

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Rollback procedure:
/*
DROP FUNCTION IF EXISTS public.dinh_muc_chi_tiet_delete(BIGINT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.dinh_muc_chi_tiet_upsert(BIGINT, BIGINT, BIGINT, INT, INT, TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.dinh_muc_chi_tiet_list(BIGINT, BIGINT);
*/
