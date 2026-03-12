-- Migration: Deploy dinh_muc_unified_import
-- Version: 20260303132432
-- Purpose: Align schema migration history with deployed unified quota import RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_unified_import(
  p_items JSONB,
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
  v_decision_id BIGINT;
  v_so_quyet_dinh TEXT;
  v_bulk_result JSONB;
BEGIN
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    IF v_claim_donvi IS NULL THEN
      RAISE EXCEPTION 'Access denied: tenant claim (don_vi) is required for non-global users';
    END IF;
    v_effective_donvi := v_claim_donvi;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;

  IF v_effective_donvi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (don_vi) is required';
  END IF;

  -- Auto-generate decision number with timestamp
  v_so_quyet_dinh := 'AUTO-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');

  -- Create draft decision
  INSERT INTO public.quyet_dinh_dinh_muc (
    so_quyet_dinh,
    don_vi_id,
    trang_thai,
    ngay_ban_hanh,
    ngay_hieu_luc,
    created_by
  ) VALUES (
    v_so_quyet_dinh,
    v_effective_donvi,
    'draft',
    CURRENT_DATE,
    CURRENT_DATE,
    v_user_id
  )
  RETURNING id INTO v_decision_id;

  -- Audit log for decision creation
  INSERT INTO public.lich_su_dinh_muc (
    quyet_dinh_id,
    don_vi_id,
    thao_tac,
    snapshot_sau,
    thuc_hien_boi
  ) VALUES (
    v_decision_id,
    v_effective_donvi,
    'tao',
    jsonb_build_object(
      'id', v_decision_id,
      'so_quyet_dinh', v_so_quyet_dinh,
      'trang_thai', 'draft',
      'source', 'unified_import'
    ),
    v_user_id
  );

  -- Delegate to existing bulk import (reuses all validation + UPSERT logic)
  v_bulk_result := public.dinh_muc_chi_tiet_bulk_import(
    p_quyet_dinh_id := v_decision_id,
    p_items := p_items,
    p_don_vi := v_effective_donvi
  );

  -- Return combined result
  RETURN jsonb_build_object(
    'success', v_bulk_result->>'success',
    'decision_id', v_decision_id,
    'so_quyet_dinh', v_so_quyet_dinh,
    'inserted', v_bulk_result->'inserted',
    'updated', v_bulk_result->'updated',
    'failed', v_bulk_result->'failed',
    'total', v_bulk_result->'total',
    'details', v_bulk_result->'details'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_unified_import(JSONB, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_unified_import(JSONB, BIGINT) IS
'Creates a draft quota decision and imports quota line items in one step.
Input: p_items [{ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu?, ghi_chu?}]
Returns: {success, decision_id, so_quyet_dinh, inserted, updated, failed, total, details}.';

COMMIT;
