-- Migration: lock decision update target row to prevent TOCTOU with activation
-- Date: 2026-02-24

BEGIN;

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

  -- Lock row during validation to prevent status races with activate/delete RPCs.
  SELECT * INTO v_current
  FROM public.quyet_dinh_dinh_muc
  WHERE id = p_id
    AND (v_effective_donvi IS NULL OR don_vi_id = v_effective_donvi)
  FOR UPDATE;

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

COMMIT;
