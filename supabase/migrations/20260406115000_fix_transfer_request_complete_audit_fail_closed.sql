-- Fix: make transfer_request_complete fail closed when public.audit_log(...)
-- returns FALSE so completion side effects cannot commit without an audit row.

BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_request_complete(
  p_id integer,
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
  v_mo_ta text;
  v_loai_su_kien text;
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

  IF v_req.trang_thai = 'hoan_thanh' THEN
    RAISE EXCEPTION 'Không thể hoàn thành lại yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = 'hoan_thanh',
      ngay_hoan_thanh = now(),
      ngay_hoan_tra = COALESCE(
        (p_payload->>'ngay_hoan_tra')::timestamptz,
        CASE WHEN v_req.loai_hinh = 'ben_ngoai' THEN now() ELSE ngay_hoan_tra END
      ),
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = p_id;

  IF v_req.loai_hinh = 'noi_bo' AND v_req.khoa_phong_nhan IS NOT NULL THEN
    UPDATE public.thiet_bi
    SET khoa_phong_quan_ly = v_req.khoa_phong_nhan
    WHERE id = v_req.thiet_bi_id;
  ELSIF v_req.loai_hinh = 'thanh_ly' THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = 'Ngưng sử dụng',
        khoa_phong_quan_ly = 'Tổ QLTB'
    WHERE id = v_req.thiet_bi_id;
  END IF;

  IF v_req.loai_hinh = 'noi_bo' THEN
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format(
      'Thiết bị được luân chuyển từ "%s" đến "%s".',
      coalesce(v_req.khoa_phong_hien_tai, ''),
      coalesce(v_req.khoa_phong_nhan, '')
    );
  ELSIF v_req.loai_hinh = 'thanh_ly' THEN
    v_loai_su_kien := 'Thanh lý';
    v_mo_ta := format('Thiết bị được thanh lý. Lý do: %s', coalesce(v_req.ly_do_luan_chuyen, ''));
  ELSE
    v_loai_su_kien := 'Luân chuyển';
    v_mo_ta := format(
      'Thiết bị được hoàn trả từ đơn vị bên ngoài "%s".',
      coalesce(v_req.don_vi_nhan, '')
    );
  END IF;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_req.thiet_bi_id,
    v_loai_su_kien,
    v_mo_ta,
    jsonb_build_object(
      'ma_yeu_cau', v_req.ma_yeu_cau,
      'loai_hinh', v_req.loai_hinh,
      'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
      'khoa_phong_nhan', v_req.khoa_phong_nhan,
      'don_vi_nhan', v_req.don_vi_nhan,
      'yeu_cau_id', v_req.id
    )
  );

  SELECT
    t.*,
    tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF NOT public.audit_log(
    'transfer_request_complete',
    'transfer_request',
    v_req.id,
    v_req.ma_yeu_cau,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'loai_hinh', v_req.loai_hinh,
      'khoa_phong_hien_tai', v_req.khoa_phong_hien_tai,
      'khoa_phong_nhan', v_req.khoa_phong_nhan,
      'don_vi_nhan', v_req.don_vi_nhan,
      'ngay_hoan_thanh', v_req.ngay_hoan_thanh,
      'ngay_hoan_tra', v_req.ngay_hoan_tra
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for transfer_request %', v_req.id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_complete(integer, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_complete(integer, jsonb) FROM PUBLIC;

COMMIT;
