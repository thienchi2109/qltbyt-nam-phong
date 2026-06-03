-- supabase/tests/transfer_request_delete_tenant_cast_smoke.sql
-- Purpose: prove to_qltb can delete a pending transfer request when don_vi claim is text.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant_id bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_request_id bigint;
  v_remaining_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('transfer_request_delete_tenant_cast_smoke'));

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Transfer Delete Cast Smoke ' || v_suffix, true)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-TRF-DEL-' || v_suffix,
    'Transfer Delete Cast Smoke Equipment ' || v_suffix,
    v_tenant_id,
    'Khoa Hien Tai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_equipment_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke delete pending ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_suffix,
      'khoa_phong_nhan', 'Khoa Nhan ' || v_suffix
    )
  );

  PERFORM public.transfer_request_delete(v_request_id::integer);

  SELECT count(*)
  INTO v_remaining_count
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  IF v_remaining_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Expected transfer_request_delete to remove pending request %, remaining count %',
      v_request_id,
      v_remaining_count;
  END IF;
END $$;

ROLLBACK;
