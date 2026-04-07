-- Sync equipment vi_tri_lap_dat for external transfer lifecycle.
-- 1. transfer_request_update_status: set location to 'Đang luân chuyển bên ngoài' on dang_luan_chuyen for ben_ngoai
-- 2. transfer_request_complete: require & validate return location for ben_ngoai, enrich audit
-- 3. get_equipment_location_suggestions: new RPC scoped by transfer request → tenant + khoa_phong

BEGIN;

----------------------------------------------------------------------
-- 1. transfer_request_update_status — add external location sync
----------------------------------------------------------------------
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

  IF p_status IS NULL THEN
    RAISE EXCEPTION 'p_status is required' USING errcode = '22023';
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

  -- Forward-only guard: prevent status rollback and duplicate side effects.
  -- Ordinals: cho_duyet=0, da_duyet=1, dang_luan_chuyen=2, da_ban_giao=3
  IF (
    CASE v_req.trang_thai
      WHEN 'cho_duyet'        THEN 0
      WHEN 'da_duyet'         THEN 1
      WHEN 'dang_luan_chuyen' THEN 2
      WHEN 'da_ban_giao'      THEN 3
      ELSE -1
    END
  ) >= (
    CASE p_status
      WHEN 'da_duyet'         THEN 1
      WHEN 'dang_luan_chuyen' THEN 2
      WHEN 'da_ban_giao'      THEN 3
      ELSE 99
    END
  ) THEN
    RAISE EXCEPTION 'Không thể chuyển từ % sang %', v_req.trang_thai, p_status
      USING errcode = '22023';
  END IF;

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = p_status,
      updated_by = v_user_id,
      updated_at = now()
  WHERE id = p_id;

  IF p_status = 'da_duyet' THEN
    UPDATE public.yeu_cau_luan_chuyen
    SET nguoi_duyet_id = v_user_id,
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

  -- External transfer outbound: mark equipment as "in external transit"
  IF p_status = 'dang_luan_chuyen' AND v_req.loai_hinh = 'ben_ngoai' THEN
    UPDATE public.thiet_bi
    SET vi_tri_lap_dat = 'Đang luân chuyển bên ngoài'
    WHERE id = v_req.thiet_bi_id;
  END IF;
  -- da_ban_giao: no location change needed (stays as 'Đang luân chuyển bên ngoài')

  SELECT
    t.*,
    tb.don_vi AS tb_don_vi
  INTO v_req
  FROM public.yeu_cau_luan_chuyen t
  JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.id = p_id;

  IF p_status IN ('da_duyet', 'dang_luan_chuyen', 'da_ban_giao') THEN
    IF NOT public.audit_log(
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
    ) THEN
      RAISE EXCEPTION 'audit_log failed for transfer_request %', v_req.id;
    END IF;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_update_status(integer, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_update_status(integer, text, jsonb) FROM PUBLIC;

----------------------------------------------------------------------
-- 2. transfer_request_complete — add return location sync for ben_ngoai
----------------------------------------------------------------------
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
  v_vi_tri_hoan_tra text;
  v_vi_tri_truoc_do text;
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

  -- External transfer return: validate and apply return location
  IF v_req.loai_hinh = 'ben_ngoai' THEN
    v_vi_tri_hoan_tra := NULLIF(BTRIM(p_payload->>'vi_tri_hoan_tra'), '');

    IF v_vi_tri_hoan_tra IS NULL THEN
      RAISE EXCEPTION 'Thiếu vi_tri_hoan_tra cho hoàn trả bên ngoài' USING errcode = '22023';
    END IF;

    IF v_vi_tri_hoan_tra = 'Đang luân chuyển bên ngoài' THEN
      RAISE EXCEPTION 'Vị trí hoàn trả không được là "Đang luân chuyển bên ngoài"' USING errcode = '22023';
    END IF;

    -- Capture previous location before update
    SELECT vi_tri_lap_dat INTO v_vi_tri_truoc_do
    FROM public.thiet_bi WHERE id = v_req.thiet_bi_id;

    -- Update equipment location to the return location
    UPDATE public.thiet_bi
    SET vi_tri_lap_dat = v_vi_tri_hoan_tra
    WHERE id = v_req.thiet_bi_id;
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
      'ngay_hoan_tra', v_req.ngay_hoan_tra,
      'vi_tri_truoc_do', v_vi_tri_truoc_do,
      'vi_tri_hoan_tra_moi', v_vi_tri_hoan_tra
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for transfer_request %', v_req.id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_complete(integer, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_complete(integer, jsonb) FROM PUBLIC;

----------------------------------------------------------------------
-- 3. get_equipment_location_suggestions — new RPC
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_equipment_location_suggestions(
  p_transfer_request_id integer
) RETURNS TABLE(vi_tri text)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_user_id bigint;
  v_khoa_phong text;
  v_tb_don_vi bigint;
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
  -- Deny regional_leader: write-adjacent RPC (feeds transfer_request_complete).
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'regional_leader không có quyền thực hiện hoàn trả' USING errcode = '42501';
  END IF;
  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim in JWT for non-global user' USING errcode = '42501';
  END IF;

  SELECT tb.khoa_phong_quan_ly, tb.don_vi
  INTO v_khoa_phong, v_tb_don_vi
  FROM public.yeu_cau_luan_chuyen ylc
  JOIN public.thiet_bi tb ON tb.id = ylc.thiet_bi_id
  WHERE ylc.id = p_transfer_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF NOT v_is_global AND v_tb_don_vi::text IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên yêu cầu thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT tb2.vi_tri_lap_dat
  FROM public.thiet_bi tb2
  WHERE tb2.khoa_phong_quan_ly = v_khoa_phong
    AND tb2.don_vi = v_tb_don_vi
    AND tb2.vi_tri_lap_dat IS NOT NULL
    AND tb2.vi_tri_lap_dat <> ''
    AND tb2.vi_tri_lap_dat <> 'Đang luân chuyển bên ngoài'
    AND tb2.is_deleted = false
  ORDER BY 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_equipment_location_suggestions(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_equipment_location_suggestions(integer) FROM PUBLIC;

COMMIT;
