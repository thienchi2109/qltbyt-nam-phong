-- Fix transfer_request_get for regional_leader sessions.
-- regional_leader scope is derived from dia_ban via allowed_don_vi_for_session_safe(),
-- so this RPC must not reject the session just because don_vi is NULL.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_request_get(p_id INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id TEXT := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := NULL;
  v_result JSONB;
BEGIN
  IF p_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');

  IF NOT v_is_global THEN
    IF v_role <> 'regional_leader' AND v_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
    END IF;

    -- regional_leader may legitimately have don_vi = NULL because scope comes from dia_ban.
    v_allowed := public.allowed_don_vi_for_session_safe();

    IF array_length(v_allowed, 1) IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'id', yclc.id,
    'ma_yeu_cau', yclc.ma_yeu_cau,
    'thiet_bi_id', yclc.thiet_bi_id,
    'loai_hinh', yclc.loai_hinh,
    'trang_thai', yclc.trang_thai,
    'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
    'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
    'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
    'khoa_phong_nhan', yclc.khoa_phong_nhan,
    'muc_dich', yclc.muc_dich,
    'don_vi_nhan', yclc.don_vi_nhan,
    'dia_chi_don_vi', yclc.dia_chi_don_vi,
    'nguoi_lien_he', yclc.nguoi_lien_he,
    'so_dien_thoai', yclc.so_dien_thoai,
    'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
    'ngay_ban_giao', yclc.ngay_ban_giao,
    'ngay_hoan_tra', yclc.ngay_hoan_tra,
    'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
    'nguoi_duyet_id', yclc.nguoi_duyet_id,
    'ngay_duyet', yclc.ngay_duyet,
    'ghi_chu_duyet', yclc.ghi_chu_duyet,
    'created_at', yclc.created_at,
    'updated_at', yclc.updated_at,
    'created_by', yclc.created_by,
    'updated_by', yclc.updated_by,
    'equipment_is_deleted', tb.is_deleted,
    'thiet_bi',
      CASE
        WHEN tb.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', tb.id,
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'serial_number', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', dv.id,
          'don_vi', dv.id,
          'tinh_trang', tb.tinh_trang_hien_tai
        )
      END,
    'nguoi_yeu_cau',
      CASE
        WHEN requester.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', requester.id,
          'username', requester.username,
          'full_name', requester.full_name,
          'role', requester.role,
          'khoa_phong', requester.khoa_phong,
          'created_at', requester.created_at
        )
      END,
    'nguoi_duyet',
      CASE
        WHEN approver.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', approver.id,
          'username', approver.username,
          'full_name', approver.full_name,
          'role', approver.role,
          'khoa_phong', approver.khoa_phong,
          'created_at', approver.created_at
        )
      END
  )
  INTO v_result
  FROM public.yeu_cau_luan_chuyen yclc
  LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  LEFT JOIN public.nhan_vien requester ON requester.id = yclc.nguoi_yeu_cau_id
  LEFT JOIN public.nhan_vien approver ON approver.id = yclc.nguoi_duyet_id
  WHERE yclc.id = p_id
    AND (
      v_is_global
      OR (
        array_length(v_allowed, 1) IS NOT NULL
        AND tb.don_vi = ANY(v_allowed)
      )
    )
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_get(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_get(INT) FROM PUBLIC;

COMMENT ON FUNCTION public.transfer_request_get(INT) IS
'Fetches a single transfer request detail payload with related requester and approver user objects for the Transfers detail dialog.';

COMMIT;
