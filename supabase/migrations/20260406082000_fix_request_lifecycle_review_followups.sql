-- Follow-up hardening for request lifecycle audit RPCs after PR review.
-- Fixes: explicit invalid-status rejection for transfer updates, idempotency guard
-- for repair completion, and documents intentional repair-delete cleanup behavior
-- on soft-deleted equipment.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_request_update_status(
  p_id integer,
  p_status text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_user_id bigint;
  v_req record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim in JWT for non-global user' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING errcode = '42501';
  END IF;

  SELECT
    t.*,
    tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id
  FOR UPDATE OF t, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF NOT v_is_global AND v_req.tb_don_vi::text IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên yêu cầu thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_req.trang_thai = 'hoan_thanh' AND p_status <> 'hoan_thanh' THEN
    RAISE EXCEPTION 'Không thể thay đổi trạng thái của yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  IF p_status = 'hoan_thanh' THEN
    RAISE EXCEPTION 'Hoàn thành yêu cầu phải dùng transfer_request_complete' USING errcode = '22023';
  END IF;

  IF p_status NOT IN ('da_duyet', 'dang_luan_chuyen', 'da_ban_giao') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_status USING errcode = '22023';
  END IF;

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = p_status,
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = p_id;

  IF p_status = 'da_duyet' THEN
    UPDATE public.yeu_cau_luan_chuyen
    SET nguoi_duyet_id = COALESCE(NULLIF(p_payload->>'nguoi_duyet_id', '')::bigint, nguoi_duyet_id),
        ngay_duyet = COALESCE((p_payload->>'ngay_duyet')::timestamptz, ngay_duyet, now()),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_id;
  ELSIF p_status IN ('dang_luan_chuyen', 'da_ban_giao') THEN
    UPDATE public.yeu_cau_luan_chuyen
    SET ngay_ban_giao = COALESCE((p_payload->>'ngay_ban_giao')::timestamptz, ngay_ban_giao, now()),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_id;
  END IF;

  SELECT
    t.*,
    tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF p_status IN ('da_duyet', 'dang_luan_chuyen', 'da_ban_giao') THEN
    PERFORM public.audit_log(
      'transfer_request_update_status',
      'transfer_request',
      v_req.id,
      v_req.ma_yeu_cau,
      jsonb_build_object(
        'trang_thai', v_req.trang_thai,
        'loai_hinh', v_req.loai_hinh,
        'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
        'khoa_phong_nhan', v_req.khoa_phong_nhan,
        'don_vi_nhan', v_req.don_vi_nhan,
        'ngay_duyet', v_req.ngay_duyet,
        'ngay_ban_giao', v_req.ngay_ban_giao
      )
    );
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update_status(integer, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update_status(integer, text, jsonb) FROM PUBLIC;

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

  IF v_locked.ngay_hoan_thanh IS NOT NULL OR v_locked.trang_thai IN ('Hoàn thành', 'Không HT') THEN
    RAISE EXCEPTION 'Không thể hoàn tất lại yêu cầu đã hoàn tất' USING errcode = '22023';
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

  -- Intentionally allow delete cleanup even after equipment soft-delete.
  -- Other repair RPCs block deleted equipment because they mutate active workflow state.
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
