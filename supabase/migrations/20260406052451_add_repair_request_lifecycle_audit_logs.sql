BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_update(
  p_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
  v_req public.yeu_cau_sua_chua%ROWTYPE;
  v_tb_don_vi bigint;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_locked.tb_don_vi;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET mo_ta_su_co = p_mo_ta_su_co,
      hang_muc_sua_chua = p_hang_muc_sua_chua,
      ngay_mong_muon_hoan_thanh = p_ngay_mong_muon_hoan_thanh,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = p_ten_don_vi_thue
  WHERE id = p_id
  RETURNING * INTO v_req;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Cập nhật nội dung yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', v_req.mo_ta_su_co,
      'hang_muc', v_req.hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', v_req.ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    ),
    p_id
  );

  PERFORM public.audit_log(
    'repair_request_update',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'mo_ta_su_co', v_req.mo_ta_su_co,
      'hang_muc_sua_chua', v_req.hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', v_req.ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_update(integer, text, text, date, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_update(integer, text, text, date, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_approve(
  p_id integer,
  p_nguoi_duyet text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
  v_req public.yeu_cau_sua_chua%ROWTYPE;
  v_tb_don_vi bigint;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_locked.tb_don_vi;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = 'Đã duyệt',
      ngay_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = CASE
        WHEN p_don_vi_thuc_hien = 'thue_ngoai' THEN p_ten_don_vi_thue
        ELSE NULL
      END
  WHERE id = p_id
  RETURNING * INTO v_req;

  UPDATE public.thiet_bi
  SET tinh_trang_hien_tai = 'Chờ sửa chữa'
  WHERE id = v_req.thiet_bi_id
    AND is_deleted = false
    AND coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Duyệt yêu cầu sửa chữa',
    jsonb_build_object(
      'nguoi_duyet', v_req.nguoi_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    ),
    p_id
  );

  PERFORM public.audit_log(
    'repair_request_approve',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'nguoi_duyet', v_req.nguoi_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_approve(integer, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_approve(integer, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
  v_req public.yeu_cau_sua_chua%ROWTYPE;
  v_tb_don_vi bigint;
  v_status text;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_locked.tb_don_vi;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
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
  WHERE id = p_id
  RETURNING * INTO v_req;

  IF v_status = 'Hoàn thành' THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = 'Hoạt động'
    WHERE id = v_req.thiet_bi_id
      AND is_deleted = false;
  END IF;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object(
      'ket_qua', coalesce(v_req.ket_qua_sua_chua, v_req.ly_do_khong_hoan_thanh),
      'trang_thai', v_req.trang_thai
    ),
    p_id
  );

  PERFORM public.audit_log(
    'repair_request_complete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'ket_qua_sua_chua', v_req.ket_qua_sua_chua,
      'ly_do_khong_hoan_thanh', v_req.ly_do_khong_hoan_thanh
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_delete(
  p_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_global AND v_locked.tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  PERFORM public.audit_log(
    'repair_request_delete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', v_locked.thiet_bi_id,
      'trang_thai', v_locked.trang_thai
    )
  );

  DELETE FROM public.yeu_cau_sua_chua
  WHERE id = p_id;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_locked.thiet_bi_id,
    'Sửa chữa',
    'Xóa yêu cầu sửa chữa',
    jsonb_build_object('yeu_cau_id', p_id)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_delete(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_delete(integer) FROM PUBLIC;

COMMIT;
