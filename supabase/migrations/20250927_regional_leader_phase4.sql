-- 20250927190000_regional_leader_phase4.sql
-- Purpose: Finalize Phase 4 backend enforcement ensuring regional leaders remain read-only and all
--          tenant filters leverage public.allowed_don_vi_for_session(). Applies to repairs, transfers,
--          and maintenance RPCs while preserving audit logging.
-- Rollback: Reapply function bodies from 20250925_audit_logs_v2_instrument_rpcs.sql,
--           20250916_maintenance_rpcs_additions.sql, and 20250915_ops_rpcs.sql as needed.


-- ONLY FOR REFERENCE - NOP APPLY
BEGIN;

-- ============================================================================
-- Repairs RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100
) RETURNS SETOF public.yeu_cau_sua_chua
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.yeu_cau_sua_chua r
  JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed)
    )
    AND (p_status IS NULL OR r.trang_thai = p_status)
    AND (
      p_q IS NULL OR p_q = '' OR
      r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || p_q || '%'
    )
  ORDER BY r.ngay_yeu_cau DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_get(p_id INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_result JSONB;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT to_jsonb(r.*)
  INTO v_result
  FROM public.yeu_cau_sua_chua r
  JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE r.id = p_id
    AND (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu sửa chữa không tồn tại hoặc bạn không có quyền truy cập' USING ERRCODE = '42501';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_get(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id INT,
  p_mo_ta_su_co TEXT,
  p_hang_muc_sua_chua TEXT,
  p_ngay_mong_muon_hoan_thanh DATE,
  p_nguoi_yeu_cau TEXT,
  p_don_vi_thuc_hien TEXT,
  p_ten_don_vi_thue TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_id INT;
  v_device RECORD;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền tạo yêu cầu sửa chữa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id, don_vi, tinh_trang_hien_tai
  INTO v_device
  FROM public.thiet_bi
  WHERE id = p_thiet_bi_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại';
  END IF;

  IF v_role <> 'global' AND (v_device.don_vi IS NULL OR NOT v_device.don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue
  )
  VALUES (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue
  )
  RETURNING id INTO v_id;

  UPDATE public.thiet_bi
  SET tinh_trang_hien_tai = 'Chờ sửa chữa'
  WHERE id = p_thiet_bi_id AND COALESCE(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  PERFORM public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object('thiet_bi_id', p_thiet_bi_id, 'mo_ta_su_co', p_mo_ta_su_co)
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(INT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_update(
  p_id INT,
  p_mo_ta_su_co TEXT,
  p_hang_muc_sua_chua TEXT,
  p_ngay_mong_muon_hoan_thanh DATE,
  p_don_vi_thuc_hien TEXT,
  p_ten_don_vi_thue TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req public.yeu_cau_sua_chua;
  v_tb_don_vi BIGINT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật yêu cầu sửa chữa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_req FROM public.yeu_cau_sua_chua WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  SELECT don_vi INTO v_tb_don_vi FROM public.thiet_bi WHERE id = v_req.thiet_bi_id;
  IF v_role <> 'global' AND (v_tb_don_vi IS NULL OR NOT v_tb_don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET mo_ta_su_co = p_mo_ta_su_co,
      hang_muc_sua_chua = p_hang_muc_sua_chua,
      ngay_mong_muon_hoan_thanh = p_ngay_mong_muon_hoan_thanh,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = p_ten_don_vi_thue
  WHERE id = p_id;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Cập nhật nội dung yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    p_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_update(INT, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_approve(
  p_id INT,
  p_nguoi_duyet TEXT,
  p_don_vi_thuc_hien TEXT,
  p_ten_don_vi_thue TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req public.yeu_cau_sua_chua;
  v_tb_don_vi BIGINT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền duyệt yêu cầu sửa chữa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_req FROM public.yeu_cau_sua_chua WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  SELECT don_vi INTO v_tb_don_vi FROM public.thiet_bi WHERE id = v_req.thiet_bi_id;
  IF v_role <> 'global' AND (v_tb_don_vi IS NULL OR NOT v_tb_don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = 'Đã duyệt',
      ngay_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = CASE WHEN p_don_vi_thuc_hien = 'thue_ngoai' THEN p_ten_don_vi_thue ELSE NULL END
  WHERE id = p_id;

  UPDATE public.thiet_bi
  SET tinh_trang_hien_tai = 'Chờ sửa chữa'
  WHERE id = v_req.thiet_bi_id AND COALESCE(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Duyệt yêu cầu sửa chữa',
    jsonb_build_object('nguoi_duyet', p_nguoi_duyet, 'don_vi_thuc_hien', p_don_vi_thuc_hien, 'ten_don_vi_thue', p_ten_don_vi_thue),
    p_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_approve(INT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id INT,
  p_completion TEXT,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req public.yeu_cau_sua_chua;
  v_tb_don_vi BIGINT;
  v_status TEXT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật trạng thái sửa chữa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_req FROM public.yeu_cau_sua_chua WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  SELECT don_vi INTO v_tb_don_vi FROM public.thiet_bi WHERE id = v_req.thiet_bi_id;
  IF v_role <> 'global' AND (v_tb_don_vi IS NULL OR NOT v_tb_don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  IF p_completion IS NOT NULL THEN
    v_status := 'Hoàn thành';
  ELSE
    v_status := 'Không HT';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = CASE WHEN v_status = 'Hoàn thành' THEN p_completion ELSE NULL END,
      ly_do_khong_hoan_thanh = CASE WHEN v_status <> 'Hoàn thành' THEN p_reason ELSE NULL END
  WHERE id = p_id;

  IF v_status = 'Hoàn thành' THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = 'Hoạt động'
    WHERE id = v_req.thiet_bi_id;
  END IF;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object('ket_qua', COALESCE(p_completion, p_reason), 'trang_thai', v_status),
    p_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_complete(INT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.repair_request_delete(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req public.yeu_cau_sua_chua;
  v_tb_don_vi BIGINT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền xóa yêu cầu sửa chữa' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_req FROM public.yeu_cau_sua_chua WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT don_vi INTO v_tb_don_vi FROM public.thiet_bi WHERE id = v_req.thiet_bi_id;
  IF v_role <> 'global' AND (v_tb_don_vi IS NULL OR NOT v_tb_don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.yeu_cau_sua_chua WHERE id = p_id;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Xóa yêu cầu sửa chữa',
    jsonb_build_object('yeu_cau_id', p_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_delete(INT) TO authenticated;

-- ============================================================================
-- Transfers RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100
) RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(t)
         || jsonb_build_object('thiet_bi', to_jsonb(tb))
         || jsonb_build_object('nguoi_yeu_cau', to_jsonb(nyq))
         || jsonb_build_object('nguoi_duyet', to_jsonb(nd))
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  LEFT JOIN public.nhan_vien nyq ON nyq.id = t.nguoi_yeu_cau_id
  LEFT JOIN public.nhan_vien nd ON nd.id = t.nguoi_duyet_id
  WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed)
    )
    AND (p_status IS NULL OR t.trang_thai = p_status)
    AND (
      p_q IS NULL OR p_q = '' OR
      t.ly_do_luan_chuyen ILIKE '%' || p_q || '%'
    )
  ORDER BY t.created_at DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list(TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100
) RETURNS SETOF public.yeu_cau_luan_chuyen
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT t.*
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed)
    )
    AND (p_status IS NULL OR t.trang_thai = p_status)
    AND (
      p_q IS NULL OR p_q = '' OR
      t.ly_do_luan_chuyen ILIKE '%' || p_q || '%'
    )
  ORDER BY t.created_at DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list(TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_create(p_data JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_tb RECORD;
  v_id INT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền tạo yêu cầu luân chuyển' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT id, don_vi, khoa_phong_quan_ly
  INTO v_tb
  FROM public.thiet_bi
  WHERE id = (p_data->>'thiet_bi_id')::INT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại';
  END IF;

  IF v_role <> 'global' AND (v_tb.don_vi IS NULL OR NOT v_tb.don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  )
  VALUES (
    (p_data->>'thiet_bi_id')::INT,
    p_data->>'loai_hinh',
    NULLIF(p_data->>'ly_do_luan_chuyen', ''),
    NULLIF(p_data->>'khoa_phong_hien_tai', ''),
    NULLIF(p_data->>'khoa_phong_nhan', ''),
    NULLIF(p_data->>'muc_dich', ''),
    NULLIF(p_data->>'don_vi_nhan', ''),
    NULLIF(p_data->>'dia_chi_don_vi', ''),
    NULLIF(p_data->>'nguoi_lien_he', ''),
    NULLIF(p_data->>'so_dien_thoai', ''),
    CASE WHEN COALESCE(p_data->>'ngay_du_kien_tra', '') <> '' THEN (p_data->>'ngay_du_kien_tra')::DATE ELSE NULL END,
    COALESCE(NULLIF(p_data->>'nguoi_yeu_cau_id', '')::INT, v_user_id::INT),
    'cho_duyet',
    COALESCE(NULLIF(p_data->>'created_by', '')::INT, v_user_id::INT),
    COALESCE(NULLIF(p_data->>'updated_by', '')::INT, v_user_id::INT)
  )
  RETURNING id INTO v_id;

  PERFORM public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    NULL,
    p_data
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_update(
  p_id INT,
  p_data JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req RECORD;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật yêu cầu luân chuyển' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT t.*, tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF v_role <> 'global' AND (v_req.tb_don_vi IS NULL OR NOT v_req.tb_don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  IF v_req.trang_thai NOT IN ('cho_duyet', 'da_duyet') THEN
    RAISE EXCEPTION 'Chỉ có thể chỉnh sửa khi yêu cầu ở trạng thái Chờ duyệt hoặc Đã duyệt';
  END IF;

  UPDATE public.yeu_cau_luan_chuyen
  SET
    thiet_bi_id = COALESCE(NULLIF(p_data->>'thiet_bi_id', '')::INT, thiet_bi_id),
    loai_hinh = COALESCE(NULLIF(p_data->>'loai_hinh', ''), loai_hinh),
    ly_do_luan_chuyen = COALESCE(NULLIF(p_data->>'ly_do_luan_chuyen', ''), ly_do_luan_chuyen),
    khoa_phong_hien_tai = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) = 'noi_bo' THEN NULLIF(p_data->>'khoa_phong_hien_tai', '') ELSE NULL END,
    khoa_phong_nhan = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) = 'noi_bo' THEN NULLIF(p_data->>'khoa_phong_nhan', '') ELSE NULL END,
    muc_dich = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'muc_dich', '') ELSE NULL END,
    don_vi_nhan = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'don_vi_nhan', '') ELSE NULL END,
    dia_chi_don_vi = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'dia_chi_don_vi', '') ELSE NULL END,
    nguoi_lien_he = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'nguoi_lien_he', '') ELSE NULL END,
    so_dien_thoai = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' THEN NULLIF(p_data->>'so_dien_thoai', '') ELSE NULL END,
    ngay_du_kien_tra = CASE WHEN COALESCE(p_data->>'loai_hinh', loai_hinh) <> 'noi_bo' AND COALESCE(p_data->>'ngay_du_kien_tra', '') <> '' THEN (p_data->>'ngay_du_kien_tra')::DATE ELSE NULL END,
    updated_by = COALESCE(NULLIF(p_data->>'updated_by', '')::INT, updated_by),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update(INT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_history_list(p_yeu_cau_id INT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req RECORD;
BEGIN
  IF to_regclass('public.lich_su_luan_chuyen') IS NULL THEN
    RETURN;
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  SELECT t.id, tb.don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_yeu_cau_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_role <> 'global' AND (v_req.don_vi IS NULL OR NOT v_req.don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền xem lịch sử yêu cầu này' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(h) || jsonb_build_object('nguoi_thuc_hien', to_jsonb(u))
  FROM public.lich_su_luan_chuyen h
  LEFT JOIN public.nhan_vien u ON u.id = h.nguoi_thuc_hien_id
  WHERE h.yeu_cau_id = p_yeu_cau_id
  ORDER BY h.thoi_gian DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_history_list(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_external_pending_returns()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(t) || jsonb_build_object('thiet_bi', to_jsonb(tb))
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.loai_hinh = 'ben_ngoai'
    AND t.trang_thai IN ('da_ban_giao', 'dang_luan_chuyen')
    AND t.ngay_du_kien_tra IS NOT NULL
    AND (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_external_pending_returns() TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_update_status(
  p_id INT,
  p_status TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req RECORD;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật trạng thái luân chuyển' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT t.id, tb.don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF v_role <> 'global' AND (v_req.don_vi IS NULL OR NOT v_req.don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = p_status,
      updated_at = now()
  WHERE id = p_id;

  IF p_status = 'da_duyet' THEN
    UPDATE public.yeu_cau_luan_chuyen
    SET nguoi_duyet_id = (p_payload->>'nguoi_duyet_id')::INT,
        ngay_duyet = now()
    WHERE id = p_id;
  ELSIF p_status = 'hoan_thanh' THEN
    UPDATE public.yeu_cau_luan_chuyen
    SET ngay_hoan_thanh = now()
    WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update_status(INT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_request_delete(p_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_req RECORD;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền xóa yêu cầu luân chuyển' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT t.id, tb.don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_role <> 'global' AND (v_req.don_vi IS NULL OR NOT v_req.don_vi = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.yeu_cau_luan_chuyen WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_delete(INT) TO authenticated;

-- ============================================================================
-- Maintenance Plan RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.maintenance_plan_list(p_q TEXT DEFAULT NULL)
RETURNS SETOF public.ke_hoach_bao_tri
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT kh.*
  FROM public.ke_hoach_bao_tri kh
  WHERE (
      p_q IS NULL OR p_q = ''
      OR kh.ten_ke_hoach ILIKE '%' || p_q || '%'
      OR COALESCE(kh.khoa_phong, '') ILIKE '%' || p_q || '%'
      OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || p_q || '%'
    )
    AND (
      v_role = 'global'
      OR NOT EXISTS (
        SELECT 1
        FROM public.cong_viec_bao_tri cv
        JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
        WHERE cv.ke_hoach_id = kh.id
          AND tb.don_vi IS NOT NULL
          AND tb.don_vi <> ALL(v_allowed)
      )
    )
  ORDER BY kh.nam DESC, kh.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_list(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_create(
  p_ten_ke_hoach TEXT,
  p_nam INTEGER,
  p_loai_cong_viec TEXT,
  p_khoa_phong TEXT,
  p_nguoi_lap_ke_hoach TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_id INT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền tạo kế hoạch bảo trì' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.ke_hoach_bao_tri(ten_ke_hoach, nam, loai_cong_viec, khoa_phong, nguoi_lap_ke_hoach, trang_thai)
  VALUES (p_ten_ke_hoach, p_nam, p_loai_cong_viec, NULLIF(p_khoa_phong, ''), p_nguoi_lap_ke_hoach, 'Bản nháp')
  RETURNING id INTO v_id;

  PERFORM public.audit_log(
    'maintenance_plan_create',
    'maintenance_plan',
    v_id,
    p_ten_ke_hoach,
    jsonb_build_object('nam', p_nam, 'loai_cong_viec', p_loai_cong_viec, 'khoa_phong', NULLIF(p_khoa_phong, ''))
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_create(TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_update(
  p_id BIGINT,
  p_ten_ke_hoach TEXT,
  p_nam INT,
  p_loai_cong_viec TEXT,
  p_khoa_phong TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_plan public.ke_hoach_bao_tri;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_plan FROM public.ke_hoach_bao_tri WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kế hoạch không tồn tại';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền chỉnh sửa kế hoạch bảo trì' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cong_viec_bao_tri cv
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.ke_hoach_id = v_plan.id
        AND tb.don_vi IS NOT NULL
        AND tb.don_vi <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Không có quyền trên kế hoạch chứa thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET ten_ke_hoach = COALESCE(p_ten_ke_hoach, ten_ke_hoach),
      nam = COALESCE(p_nam, nam),
      loai_cong_viec = COALESCE(p_loai_cong_viec, loai_cong_viec),
      khoa_phong = NULLIF(p_khoa_phong, '')
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_update(BIGINT, TEXT, INT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_delete(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền xóa kế hoạch bảo trì' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cong_viec_bao_tri cv
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.ke_hoach_id = p_id
        AND tb.don_vi IS NOT NULL
        AND tb.don_vi <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Không có quyền trên kế hoạch chứa thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.ke_hoach_bao_tri WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_delete(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_approve(p_id BIGINT, p_nguoi_duyet TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền duyệt kế hoạch bảo trì' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cong_viec_bao_tri cv
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.ke_hoach_id = p_id
        AND tb.don_vi IS NOT NULL
        AND tb.don_vi <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Không có quyền trên kế hoạch chứa thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET trang_thai = 'Đã duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_approve(BIGINT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_reject(p_id BIGINT, p_nguoi_duyet TEXT, p_ly_do TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền từ chối kế hoạch bảo trì' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cong_viec_bao_tri cv
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.ke_hoach_id = p_id
        AND tb.don_vi IS NOT NULL
        AND tb.don_vi <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Không có quyền trên kế hoạch chứa thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET trang_thai = 'Không duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      ly_do_khong_duyet = p_ly_do
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_reject(BIGINT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_task_complete(p_task_id BIGINT, p_month INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_task RECORD;
  v_plan RECORD;
  v_date TIMESTAMPTZ := now();
  v_month_col TEXT;
  v_month_date_col TEXT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task FROM public.cong_viec_bao_tri WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật công việc bảo trì' USING ERRCODE = '42501';
    END IF;

    IF v_task.thiet_bi_id IS NOT NULL THEN
      PERFORM 1
      FROM public.thiet_bi tb
      WHERE tb.id = v_task.thiet_bi_id
        AND tb.don_vi = ANY(v_allowed);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  SELECT id, ten_ke_hoach, nam, khoa_phong
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = v_task.ke_hoach_id;

  v_month_col := format('thang_%s_hoan_thanh', p_month);
  v_month_date_col := format('ngay_hoan_thanh_%s', p_month);

  EXECUTE format('UPDATE public.cong_viec_bao_tri SET %I = true, %I = $1, updated_at = $1 WHERE id = $2', v_month_col, v_month_date_col)
    USING v_date, p_task_id;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, ngay_thuc_hien)
  VALUES (
    v_task.thiet_bi_id,
    v_task.loai_cong_viec,
    format('Hoàn thành %s tháng %s/%s theo kế hoạch "%s"', v_task.loai_cong_viec, p_month, v_plan.nam, v_plan.ten_ke_hoach),
    jsonb_build_object('cong_viec_id', p_task_id, 'thang', p_month, 'ten_ke_hoach', v_plan.ten_ke_hoach, 'khoa_phong', v_plan.khoa_phong, 'nam', v_plan.nam),
    v_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_task_complete(BIGINT, INT) TO authenticated;

-- ============================================================================
-- Maintenance Task RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.maintenance_tasks_list(
  p_ke_hoach_id BIGINT DEFAULT NULL,
  p_thiet_bi_id BIGINT DEFAULT NULL,
  p_loai_cong_viec TEXT DEFAULT NULL,
  p_don_vi_thuc_hien TEXT DEFAULT NULL
) RETURNS SETOF public.cong_viec_bao_tri
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT cv.*
  FROM public.cong_viec_bao_tri cv
  LEFT JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
  WHERE (p_ke_hoach_id IS NULL OR cv.ke_hoach_id = p_ke_hoach_id)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND (p_loai_cong_viec IS NULL OR cv.loai_cong_viec = p_loai_cong_viec)
    AND (p_don_vi_thuc_hien IS NULL OR cv.don_vi_thuc_hien = p_don_vi_thuc_hien)
    AND (
      v_role = 'global'
      OR cv.thiet_bi_id IS NULL
      OR tb.don_vi = ANY(v_allowed)
    )
  ORDER BY cv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_list(BIGINT, BIGINT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_bulk_insert(p_tasks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_item JSONB;
  v_thiet_bi_id BIGINT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền thêm công việc bảo trì' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_tasks IS NULL OR jsonb_array_length(p_tasks) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_tasks) AS value LOOP
    v_thiet_bi_id := NULLIF(v_item->>'thiet_bi_id', '')::BIGINT;

    IF v_role <> 'global' AND v_thiet_bi_id IS NOT NULL THEN
      PERFORM 1
      FROM public.thiet_bi tb
      WHERE tb.id = v_thiet_bi_id
        AND tb.don_vi = ANY(v_allowed);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.cong_viec_bao_tri (
    ke_hoach_id,
    thiet_bi_id,
    loai_cong_viec,
    diem_hieu_chuan,
    don_vi_thuc_hien,
    thang_1, thang_2, thang_3, thang_4, thang_5, thang_6, thang_7, thang_8, thang_9, thang_10, thang_11, thang_12,
    ghi_chu
  )
  SELECT 
    (t->>'ke_hoach_id')::BIGINT,
    NULLIF(t->>'thiet_bi_id', '')::BIGINT,
    t->>'loai_cong_viec',
    t->>'diem_hieu_chuan',
    t->>'don_vi_thuc_hien',
    COALESCE((t->>'thang_1')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_2')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_3')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_4')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_5')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_6')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_7')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_8')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_9')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_10')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_11')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_12')::BOOLEAN, FALSE),
    t->>'ghi_chu'
  FROM jsonb_array_elements(p_tasks) AS t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_bulk_insert(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_task_update(p_id BIGINT, p_task JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_existing public.cong_viec_bao_tri;
  v_new_tb BIGINT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.cong_viec_bao_tri WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Công việc không tồn tại';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền cập nhật công việc bảo trì' USING ERRCODE = '42501';
    END IF;

    IF v_existing.thiet_bi_id IS NOT NULL THEN
      PERFORM 1 FROM public.thiet_bi tb WHERE tb.id = v_existing.thiet_bi_id AND tb.don_vi = ANY(v_allowed);
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  v_new_tb := COALESCE(NULLIF(p_task->>'thiet_bi_id', '')::BIGINT, v_existing.thiet_bi_id);
  IF v_role <> 'global' AND v_new_tb IS NOT NULL THEN
    PERFORM 1 FROM public.thiet_bi tb WHERE tb.id = v_new_tb AND tb.don_vi = ANY(v_allowed);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.cong_viec_bao_tri
  SET 
      ke_hoach_id = COALESCE(NULLIF(p_task->>'ke_hoach_id', '')::BIGINT, ke_hoach_id),
      thiet_bi_id = v_new_tb,
      loai_cong_viec = COALESCE(p_task->>'loai_cong_viec', loai_cong_viec),
      diem_hieu_chuan = COALESCE(p_task->>'diem_hieu_chuan', diem_hieu_chuan),
      don_vi_thuc_hien = COALESCE(p_task->>'don_vi_thuc_hien', don_vi_thuc_hien),
      thang_1 = COALESCE((p_task->>'thang_1')::BOOLEAN, thang_1),
      thang_2 = COALESCE((p_task->>'thang_2')::BOOLEAN, thang_2),
      thang_3 = COALESCE((p_task->>'thang_3')::BOOLEAN, thang_3),
      thang_4 = COALESCE((p_task->>'thang_4')::BOOLEAN, thang_4),
      thang_5 = COALESCE((p_task->>'thang_5')::BOOLEAN, thang_5),
      thang_6 = COALESCE((p_task->>'thang_6')::BOOLEAN, thang_6),
      thang_7 = COALESCE((p_task->>'thang_7')::BOOLEAN, thang_7),
      thang_8 = COALESCE((p_task->>'thang_8')::BOOLEAN, thang_8),
      thang_9 = COALESCE((p_task->>'thang_9')::BOOLEAN, thang_9),
      thang_10 = COALESCE((p_task->>'thang_10')::BOOLEAN, thang_10),
      thang_11 = COALESCE((p_task->>'thang_11')::BOOLEAN, thang_11),
      thang_12 = COALESCE((p_task->>'thang_12')::BOOLEAN, thang_12),
      thang_1_hoan_thanh = COALESCE((p_task->>'thang_1_hoan_thanh')::BOOLEAN, thang_1_hoan_thanh),
      thang_2_hoan_thanh = COALESCE((p_task->>'thang_2_hoan_thanh')::BOOLEAN, thang_2_hoan_thanh),
      thang_3_hoan_thanh = COALESCE((p_task->>'thang_3_hoan_thanh')::BOOLEAN, thang_3_hoan_thanh),
      thang_4_hoan_thanh = COALESCE((p_task->>'thang_4_hoan_thanh')::BOOLEAN, thang_4_hoan_thanh),
      thang_5_hoan_thanh = COALESCE((p_task->>'thang_5_hoan_thanh')::BOOLEAN, thang_5_hoan_thanh),
      thang_6_hoan_thanh = COALESCE((p_task->>'thang_6_hoan_thanh')::BOOLEAN, thang_6_hoan_thanh),
      thang_7_hoan_thanh = COALESCE((p_task->>'thang_7_hoan_thanh')::BOOLEAN, thang_7_hoan_thanh),
      thang_8_hoan_thanh = COALESCE((p_task->>'thang_8_hoan_thanh')::BOOLEAN, thang_8_hoan_thanh),
      thang_9_hoan_thanh = COALESCE((p_task->>'thang_9_hoan_thanh')::BOOLEAN, thang_9_hoan_thanh),
      thang_10_hoan_thanh = COALESCE((p_task->>'thang_10_hoan_thanh')::BOOLEAN, thang_10_hoan_thanh),
      thang_11_hoan_thanh = COALESCE((p_task->>'thang_11_hoan_thanh')::BOOLEAN, thang_11_hoan_thanh),
      thang_12_hoan_thanh = COALESCE((p_task->>'thang_12_hoan_thanh')::BOOLEAN, thang_12_hoan_thanh),
      ngay_hoan_thanh_1 = COALESCE((p_task->>'ngay_hoan_thanh_1')::timestamptz, ngay_hoan_thanh_1),
      ngay_hoan_thanh_2 = COALESCE((p_task->>'ngay_hoan_thanh_2')::timestamptz, ngay_hoan_thanh_2),
      ngay_hoan_thanh_3 = COALESCE((p_task->>'ngay_hoan_thanh_3')::timestamptz, ngay_hoan_thanh_3),
      ngay_hoan_thanh_4 = COALESCE((p_task->>'ngay_hoan_thanh_4')::timestamptz, ngay_hoan_thanh_4),
      ngay_hoan_thanh_5 = COALESCE((p_task->>'ngay_hoan_thanh_5')::timestamptz, ngay_hoan_thanh_5),
      ngay_hoan_thanh_6 = COALESCE((p_task->>'ngay_hoan_thanh_6')::timestamptz, ngay_hoan_thanh_6),
      ngay_hoan_thanh_7 = COALESCE((p_task->>'ngay_hoan_thanh_7')::timestamptz, ngay_hoan_thanh_7),
      ngay_hoan_thanh_8 = COALESCE((p_task->>'ngay_hoan_thanh_8')::timestamptz, ngay_hoan_thanh_8),
      ngay_hoan_thanh_9 = COALESCE((p_task->>'ngay_hoan_thanh_9')::timestamptz, ngay_hoan_thanh_9),
      ngay_hoan_thanh_10 = COALESCE((p_task->>'ngay_hoan_thanh_10')::timestamptz, ngay_hoan_thanh_10),
      ngay_hoan_thanh_11 = COALESCE((p_task->>'ngay_hoan_thanh_11')::timestamptz, ngay_hoan_thanh_11),
      ngay_hoan_thanh_12 = COALESCE((p_task->>'ngay_hoan_thanh_12')::timestamptz, ngay_hoan_thanh_12),
      ghi_chu = COALESCE(p_task->>'ghi_chu', ghi_chu)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_task_update(BIGINT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_delete(p_ids BIGINT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền xóa công việc bảo trì' USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.cong_viec_bao_tri cv
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.id = ANY(p_ids)
        AND tb.don_vi IS NOT NULL
        AND tb.don_vi <> ALL(v_allowed)
    ) THEN
      RAISE EXCEPTION 'Không có quyền trên công việc thuộc thiết bị đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.cong_viec_bao_tri WHERE id = ANY(p_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_delete(BIGINT[]) TO authenticated;

-- Notify PostgREST to refresh cached definitions
NOTIFY pgrst, 'reload schema';

COMMIT;
