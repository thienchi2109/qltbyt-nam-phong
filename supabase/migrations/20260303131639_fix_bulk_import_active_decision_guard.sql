-- Migration: Fix bulk import guard to allow active decisions
-- Version: 20260303131639
-- Purpose: Align schema migration history with deployed function behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_chi_tiet_bulk_import(
  p_quyet_dinh_id BIGINT,
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

  SELECT id, don_vi_id, trang_thai, so_quyet_dinh
  INTO v_decision_record
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_quyet_dinh_id;

  IF v_decision_record IS NULL THEN
    RAISE EXCEPTION 'Quota decision not found (id=%)', p_quyet_dinh_id;
  END IF;

  IF v_effective_donvi IS NOT NULL AND v_decision_record.don_vi_id != v_effective_donvi THEN
    RAISE EXCEPTION 'Access denied: decision belongs to different tenant';
  END IF;

  -- FIX: Allow both draft and active (was: != 'draft')
  IF v_decision_record.trang_thai NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'Cannot import line items to inactive decisions. Decision status: %',
      v_decision_record.trang_thai;
  END IF;

  FOR v_idx IN 0 .. v_len - 1 LOOP
    v_item := p_items->v_idx;
    v_ma_nhom := v_item->>'ma_nhom';

    BEGIN
      v_so_luong_dinh_muc := NULLIF(v_item->>'so_luong_dinh_muc', '')::INT;
      v_so_luong_toi_thieu := NULLIF(v_item->>'so_luong_toi_thieu', '')::INT;
      v_ghi_chu := NULLIF(v_item->>'ghi_chu', '');

      IF v_ma_nhom IS NULL OR v_ma_nhom = '' THEN
        RAISE EXCEPTION 'Category code (ma_nhom) is required';
      END IF;

      IF v_so_luong_dinh_muc IS NULL THEN
        RAISE EXCEPTION 'Quota quantity (so_luong_dinh_muc) is required';
      END IF;

      IF v_so_luong_dinh_muc <= 0 THEN
        RAISE EXCEPTION 'Quota quantity must be greater than 0 (got: %)', v_so_luong_dinh_muc;
      END IF;

      IF v_so_luong_toi_thieu IS NOT NULL THEN
        IF v_so_luong_toi_thieu < 0 THEN
          RAISE EXCEPTION 'Minimum quantity cannot be negative (got: %)', v_so_luong_toi_thieu;
        END IF;
        IF v_so_luong_toi_thieu > v_so_luong_dinh_muc THEN
          RAISE EXCEPTION 'Minimum quantity (%) cannot exceed quota quantity (%)',
            v_so_luong_toi_thieu, v_so_luong_dinh_muc;
        END IF;
      END IF;

      SELECT id INTO v_nhom_thiet_bi_id
      FROM public.nhom_thiet_bi
      WHERE ma_nhom = v_ma_nhom
        AND don_vi_id = v_decision_record.don_vi_id;

      IF v_nhom_thiet_bi_id IS NULL THEN
        RAISE EXCEPTION 'Category not found: % (for this facility)', v_ma_nhom;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.nhom_thiet_bi
        WHERE parent_id = v_nhom_thiet_bi_id
      ) THEN
        RAISE EXCEPTION 'Category % is a parent category. Only leaf categories (no children) can have quotas.', v_ma_nhom;
      END IF;

      SELECT id INTO v_existing_id
      FROM public.chi_tiet_dinh_muc
      WHERE quyet_dinh_id = p_quyet_dinh_id
        AND nhom_thiet_bi_id = v_nhom_thiet_bi_id;

      v_upsert_result := public.dinh_muc_chi_tiet_upsert(
        p_id := v_existing_id,
        p_quyet_dinh_id := p_quyet_dinh_id,
        p_nhom_thiet_bi_id := v_nhom_thiet_bi_id,
        p_so_luong_toi_da := v_so_luong_dinh_muc,
        p_so_luong_toi_thieu := COALESCE(v_so_luong_toi_thieu, 0),
        p_ghi_chu := v_ghi_chu,
        p_don_vi := v_effective_donvi
      );

      v_operation := v_upsert_result->>'operation';
      IF v_operation = 'created' THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;

      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', true,
        'operation', v_operation,
        'ma_nhom', v_ma_nhom,
        'id', v_upsert_result->'id'
      ));

    EXCEPTION WHEN OTHERS THEN
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

COMMIT;
