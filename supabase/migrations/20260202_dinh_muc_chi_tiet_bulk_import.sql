-- Migration: Bulk Import for Quota Line Items (chi_tiet_dinh_muc)
-- Date: 2026-02-02
-- Purpose: RPC function for importing multiple quota line items from Excel
-- Security: Enforces tenant isolation per CLAUDE.md security template
-- Related: 20260201_device_quota_rpc_line_items.sql (uses dinh_muc_chi_tiet_upsert)

-- ============================================================================
-- FUNCTION: dinh_muc_chi_tiet_bulk_import
-- ============================================================================
-- Bulk import quota line items for a decision
-- Uses existing dinh_muc_chi_tiet_upsert for each item (reuses validation/audit logic)
-- Security: Only global, admin, to_qltb roles
-- Tenant isolation: Enforced via JWT claims

CREATE OR REPLACE FUNCTION public.dinh_muc_chi_tiet_bulk_import(
  p_quyet_dinh_id BIGINT,
  p_items JSONB,  -- [{ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu?, ghi_chu?}]
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
  v_decision_record RECORD;
  v_len INT;
  v_idx INT := 0;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_failed INT := 0;
  v_details JSONB := '[]'::jsonb;
  v_item JSONB;
  v_ma_nhom TEXT;
  v_so_luong_dinh_muc INT;
  v_so_luong_toi_thieu INT;
  v_ghi_chu TEXT;
  v_nhom_thiet_bi_id BIGINT;
  v_existing_id BIGINT;
  v_upsert_result JSONB;
  v_err TEXT;
  v_operation TEXT;
BEGIN
  -- ========================================================================
  -- SECURITY: Permission check
  -- ========================================================================
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  -- ========================================================================
  -- SECURITY: Tenant isolation
  -- ========================================================================
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;  -- Force user's tenant
  END IF;

  -- ========================================================================
  -- INPUT VALIDATION
  -- ========================================================================
  IF p_quyet_dinh_id IS NULL THEN
    RAISE EXCEPTION 'Decision ID (p_quyet_dinh_id) is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  v_len := jsonb_array_length(p_items);
  IF v_len = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'inserted', 0,
      'updated', 0,
      'failed', 0,
      'total', 0,
      'details', '[]'::jsonb
    );
  END IF;

  -- ========================================================================
  -- VALIDATE DECISION: exists, belongs to tenant, and is in draft status
  -- ========================================================================
  SELECT id, don_vi_id, trang_thai, so_quyet_dinh
  INTO v_decision_record
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
    RAISE EXCEPTION 'Cannot import line items to non-draft decisions. Decision status: %',
      v_decision_record.trang_thai;
  END IF;

  -- ========================================================================
  -- PROCESS EACH ITEM
  -- ========================================================================
  FOR v_idx IN 0 .. v_len - 1 LOOP
    v_item := p_items->v_idx;
    v_ma_nhom := v_item->>'ma_nhom';

    BEGIN
      -- Extract fields from item
      v_so_luong_dinh_muc := NULLIF(v_item->>'so_luong_dinh_muc', '')::INT;
      v_so_luong_toi_thieu := NULLIF(v_item->>'so_luong_toi_thieu', '')::INT;
      v_ghi_chu := NULLIF(v_item->>'ghi_chu', '');

      -- Validate required field: ma_nhom
      IF v_ma_nhom IS NULL OR v_ma_nhom = '' THEN
        RAISE EXCEPTION 'Category code (ma_nhom) is required';
      END IF;

      -- Validate required field: so_luong_dinh_muc
      IF v_so_luong_dinh_muc IS NULL THEN
        RAISE EXCEPTION 'Quota quantity (so_luong_dinh_muc) is required';
      END IF;

      -- Validate so_luong_dinh_muc > 0
      IF v_so_luong_dinh_muc <= 0 THEN
        RAISE EXCEPTION 'Quota quantity must be greater than 0 (got: %)', v_so_luong_dinh_muc;
      END IF;

      -- Validate so_luong_toi_thieu <= so_luong_dinh_muc (if provided)
      IF v_so_luong_toi_thieu IS NOT NULL THEN
        IF v_so_luong_toi_thieu < 0 THEN
          RAISE EXCEPTION 'Minimum quantity cannot be negative (got: %)', v_so_luong_toi_thieu;
        END IF;
        IF v_so_luong_toi_thieu > v_so_luong_dinh_muc THEN
          RAISE EXCEPTION 'Minimum quantity (%) cannot exceed quota quantity (%)',
            v_so_luong_toi_thieu, v_so_luong_dinh_muc;
        END IF;
      END IF;

      -- Lookup nhom_thiet_bi_id from ma_nhom (CRITICAL: filter by tenant!)
      SELECT id INTO v_nhom_thiet_bi_id
      FROM public.nhom_thiet_bi
      WHERE ma_nhom = v_ma_nhom
        AND don_vi_id = v_decision_record.don_vi_id;

      IF v_nhom_thiet_bi_id IS NULL THEN
        RAISE EXCEPTION 'Category not found: % (for this facility)', v_ma_nhom;
      END IF;

      -- CRITICAL: Only allow leaf nodes (categories with no children)
      -- Per plan requirement: "Import targets Level 3 (individual equipment items)"
      IF EXISTS (
        SELECT 1 FROM public.nhom_thiet_bi
        WHERE parent_id = v_nhom_thiet_bi_id
      ) THEN
        RAISE EXCEPTION 'Category % is a parent category. Only leaf categories (no children) can have quotas.', v_ma_nhom;
      END IF;

      -- Check if line item already exists for this decision + category
      SELECT id INTO v_existing_id
      FROM public.chi_tiet_dinh_muc
      WHERE quyet_dinh_id = p_quyet_dinh_id
        AND nhom_thiet_bi_id = v_nhom_thiet_bi_id;

      -- Call existing upsert function (reuses all validation and audit logic)
      v_upsert_result := public.dinh_muc_chi_tiet_upsert(
        p_id := v_existing_id,  -- NULL for insert, existing ID for update
        p_quyet_dinh_id := p_quyet_dinh_id,
        p_nhom_thiet_bi_id := v_nhom_thiet_bi_id,
        p_so_luong_toi_da := v_so_luong_dinh_muc,
        p_so_luong_toi_thieu := COALESCE(v_so_luong_toi_thieu, 0),
        p_ghi_chu := v_ghi_chu,
        p_don_vi := v_effective_donvi
      );

      -- Determine operation type
      v_operation := v_upsert_result->>'operation';
      IF v_operation = 'created' THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      -- Record success
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', true,
        'operation', v_operation,
        'ma_nhom', v_ma_nhom,
        'id', v_upsert_result->'id'
      ));

    EXCEPTION WHEN OTHERS THEN
      -- Record failure
      v_failed := v_failed + 1;
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', false,
        'error', COALESCE(v_err, SQLERRM),
        'ma_nhom', v_ma_nhom
      ));
    END;
  END LOOP;

  -- ========================================================================
  -- RETURN RESULT
  -- ========================================================================
  RETURN jsonb_build_object(
    'success', v_failed = 0,
    'inserted', v_inserted,
    'updated', v_updated,
    'failed', v_failed,
    'total', v_len,
    'details', v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_chi_tiet_bulk_import(BIGINT, JSONB, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_chi_tiet_bulk_import(BIGINT, JSONB, BIGINT) IS
'Bulk import quota line items from Excel for a decision.
Input: p_items = [{ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu?, ghi_chu?}]
Validates:
  - Decision exists, belongs to tenant, and is in draft status
  - Each ma_nhom exists in nhom_thiet_bi for the same facility
  - Each ma_nhom must be a LEAF category (no children) - parent categories rejected
  - so_luong_dinh_muc > 0 (required)
  - so_luong_toi_thieu <= so_luong_dinh_muc (if provided, must be >= 0)
Returns:
  {success, inserted, updated, failed, total, details: [{index, success, operation?, error?, ma_nhom}]}
Roles: global, admin, to_qltb only.
Uses: dinh_muc_chi_tiet_upsert for each item (inherits validation and audit logging).';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Rollback procedure:
/*
DROP FUNCTION IF EXISTS public.dinh_muc_chi_tiet_bulk_import(BIGINT, JSONB, BIGINT);
*/
