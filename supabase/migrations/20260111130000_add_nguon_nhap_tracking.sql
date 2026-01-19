-- Migration: Add nguon_nhap (import source) tracking to equipment
-- Date: 2026-01-11
-- Purpose: Track whether equipment was added manually or via Excel bulk import
-- Backfill Strategy: Simple - all existing records default to 'manual'
--
-- This enables the inventory charts to distinguish between:
--   - 'manual' = Added via Add Equipment dialog
--   - 'excel' = Imported via Excel bulk import
--
-- Security: Maintains existing tenant isolation via JWT claims

BEGIN;

-- ============================================================================
-- PART 1: Add nguon_nhap column to thiet_bi table
-- ============================================================================

ALTER TABLE public.thiet_bi
ADD COLUMN IF NOT EXISTS nguon_nhap TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.thiet_bi.nguon_nhap IS
  'Import source: manual (Add Equipment dialog) or excel (Bulk Excel import)';

-- Backfill: All existing records get 'manual' (simple strategy)
UPDATE public.thiet_bi SET nguon_nhap = 'manual' WHERE nguon_nhap IS NULL;

-- ============================================================================
-- PART 2: Update equipment_create to accept and store nguon_nhap
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_create(p_payload JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong TEXT := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'technician' THEN
    PERFORM 1
    FROM public.nhan_vien nv
    WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT
      AND nv.khoa_phong = v_khoa_phong;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.thiet_bi (
    ten_thiet_bi,
    ma_thiet_bi,
    khoa_phong_quan_ly,
    model,
    serial,
    hang_san_xuat,
    noi_san_xuat,
    nam_san_xuat,
    ngay_nhap,
    ngay_dua_vao_su_dung,
    nguon_kinh_phi,
    gia_goc,
    nam_tinh_hao_mon,
    ty_le_hao_mon,
    han_bao_hanh,
    vi_tri_lap_dat,
    nguoi_dang_truc_tiep_quan_ly,
    tinh_trang_hien_tai,
    ghi_chu,
    chu_ky_bt_dinh_ky,
    ngay_bt_tiep_theo,
    chu_ky_hc_dinh_ky,
    ngay_hc_tiep_theo,
    chu_ky_kd_dinh_ky,
    ngay_kd_tiep_theo,
    phan_loai_theo_nd98,
    don_vi,
    nguon_nhap
  )
  VALUES (
    p_payload->>'ten_thiet_bi',
    p_payload->>'ma_thiet_bi',
    v_khoa_phong,
    NULLIF(p_payload->>'model',''),
    NULLIF(p_payload->>'serial',''),
    NULLIF(p_payload->>'hang_san_xuat',''),
    NULLIF(p_payload->>'noi_san_xuat',''),
    NULLIF(p_payload->>'nam_san_xuat','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_nhap','') = '' THEN NULL ELSE (p_payload->>'ngay_nhap')::DATE END,
    CASE WHEN COALESCE(p_payload->>'ngay_dua_vao_su_dung','') = '' THEN NULL ELSE (p_payload->>'ngay_dua_vao_su_dung')::DATE END,
    NULLIF(p_payload->>'nguon_kinh_phi',''),
    NULLIF(p_payload->>'gia_goc','')::NUMERIC,
    NULLIF(p_payload->>'nam_tinh_hao_mon','')::INT,
    NULLIF(p_payload->>'ty_le_hao_mon',''),
    CASE WHEN COALESCE(p_payload->>'han_bao_hanh','') = '' THEN NULL ELSE (p_payload->>'han_bao_hanh')::DATE END,
    NULLIF(p_payload->>'vi_tri_lap_dat',''),
    NULLIF(p_payload->>'nguoi_dang_truc_tiep_quan_ly',''),
    NULLIF(p_payload->>'tinh_trang_hien_tai',''),
    NULLIF(p_payload->>'ghi_chu',''),
    NULLIF(p_payload->>'chu_ky_bt_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_bt_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_bt_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_hc_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_hc_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_hc_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_kd_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_kd_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_kd_tiep_theo')::DATE END,
    NULLIF(p_payload->>'phan_loai_theo_nd98',''),
    v_donvi,
    COALESCE(NULLIF(p_payload->>'nguon_nhap',''), 'manual')
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_create(JSONB) TO authenticated;

-- ============================================================================
-- PART 3: Update equipment_bulk_import to inject nguon_nhap='excel'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_bulk_import(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_len int;
  v_idx int := 0;
  v_success int := 0;
  v_failed int := 0;
  v_details jsonb := '[]'::jsonb;
  v_item jsonb;
  v_err text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array' USING ERRCODE = '22P02';
  END IF;

  v_len := jsonb_array_length(p_items);
  IF v_len = 0 THEN
    RETURN jsonb_build_object('success', true, 'inserted', 0, 'failed', 0, 'total', 0, 'details', '[]'::jsonb);
  END IF;

  FOR v_idx IN 0 .. v_len - 1 LOOP
    v_item := p_items->v_idx;

    -- Inject nguon_nhap='excel' for bulk imports
    v_item := v_item || '{"nguon_nhap": "excel"}'::jsonb;

    BEGIN
      -- Reuse existing single-insert RPC for validations and tenant assignment
      PERFORM public.equipment_create(v_item);
      v_success := v_success + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', true
      ));
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_idx,
        'success', false,
        'error', COALESCE(v_err, SQLERRM)
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_success,
    'failed', v_failed,
    'total', v_len,
    'details', v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_bulk_import(jsonb) TO authenticated;

-- ============================================================================
-- PART 4: Update equipment_list_for_reports to return nguon_nhap
-- Note: This function already returns *, so nguon_nhap is included automatically
-- ============================================================================

-- No changes needed - the function uses RETURNING * which includes nguon_nhap

COMMIT;
