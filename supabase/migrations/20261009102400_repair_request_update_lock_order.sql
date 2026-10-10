-- Preserve repair metadata-edit authorization; align lock order only.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_update(p_id integer, p_mo_ta_su_co text, p_hang_muc_sua_chua text, p_ngay_mong_muon_hoan_thanh date, p_don_vi_thuc_hien text, p_ten_don_vi_thue text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb;
  v_initial_equipment_id bigint;
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

  SELECT thiet_bi_id INTO v_initial_equipment_id
  FROM public.yeu_cau_sua_chua WHERE id = p_id;
  PERFORM tb.id FROM public.thiet_bi tb WHERE tb.id = v_initial_equipment_id
  FOR UPDATE OF tb;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF v_locked.thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'repair_request_equipment_changed' USING ERRCODE = '40001';
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

  IF NOT public.audit_log(
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
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;
COMMIT;
