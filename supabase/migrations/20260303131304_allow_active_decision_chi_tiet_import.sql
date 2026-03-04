-- Migration: Allow chi_tiet import/upsert for active decisions
-- Date: 2026-03-03
-- Purpose: Relax draft-only guard to allow both draft AND active decisions
-- Affected functions:
--   1. dinh_muc_chi_tiet_upsert (UPDATE path, line ~197)
--   2. dinh_muc_chi_tiet_upsert (INSERT path, line ~270)
--   3. dinh_muc_chi_tiet_bulk_import (bulk guard, line ~108)
-- Reason: Active decisions with no chi_tiet were permanently locked out

BEGIN;

-- ============================================================================
-- FIX 1 & 2: dinh_muc_chi_tiet_upsert — both UPDATE and INSERT paths
-- ============================================================================
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

    -- FIX: Allow both draft and active decisions (was: != 'draft')
    IF v_existing.decision_status NOT IN ('draft', 'active') THEN
      RAISE EXCEPTION 'Cannot modify line items of inactive decisions. Decision status: %',
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

    -- FIX: Allow both draft and active decisions (was: != 'draft')
    IF v_decision_record.trang_thai NOT IN ('draft', 'active') THEN
      RAISE EXCEPTION 'Cannot add line items to inactive decisions. Decision status: %',
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

-- ============================================================================
-- FIX 3: dinh_muc_chi_tiet_bulk_import — bulk import guard
-- ============================================================================
-- Original check at line ~108: IF v_decision_record.trang_thai != 'draft'
-- Changed to: NOT IN ('draft', 'active')
-- Full function recreation needed because CREATE OR REPLACE requires full body

-- NOTE: FIX 3 implementation is provided by follow-up migration:
--   20260303131639_fix_bulk_import_active_decision_guard.sql
-- This migration intentionally does not recreate dinh_muc_chi_tiet_bulk_import.

COMMIT;
