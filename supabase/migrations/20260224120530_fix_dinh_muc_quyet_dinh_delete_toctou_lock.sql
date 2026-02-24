-- Migration: fix TOCTOU race in dinh_muc_quyet_dinh_delete
-- Date: 2026-02-24
-- Issue: status validation and delete used an unlocked read, allowing concurrent status flips.

BEGIN;

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

COMMIT;
