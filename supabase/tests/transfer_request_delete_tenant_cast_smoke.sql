-- supabase/tests/transfer_request_delete_tenant_cast_smoke.sql
-- Purpose: prove transfer_request_delete enforces fail-closed tenant isolation.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant_id bigint;
  v_other_tenant_id bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_missing_claim_equipment_id bigint;
  v_mismatch_equipment_id bigint;
  v_global_equipment_id bigint;
  v_request_id bigint;
  v_missing_claim_request_id bigint;
  v_mismatch_request_id bigint;
  v_global_request_id bigint;
  v_remaining_count integer;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
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

  INSERT INTO public.don_vi(name, active)
  VALUES ('Transfer Delete Cast Smoke Other ' || v_suffix, true)
  RETURNING id INTO v_other_tenant_id;

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

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-TRF-DEL-MISS-' || v_suffix,
    'Transfer Delete Missing Claim Smoke Equipment ' || v_suffix,
    v_tenant_id,
    'Khoa Hien Tai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_missing_claim_equipment_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-TRF-DEL-MIS-' || v_suffix,
    'Transfer Delete Mismatch Smoke Equipment ' || v_suffix,
    v_tenant_id,
    'Khoa Hien Tai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_mismatch_equipment_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-TRF-DEL-GLOB-' || v_suffix,
    'Transfer Delete Global Smoke Equipment ' || v_suffix,
    v_tenant_id,
    'Khoa Hien Tai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_global_equipment_id;

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

  v_missing_claim_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_missing_claim_equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke delete missing claim ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_suffix,
      'khoa_phong_nhan', 'Khoa Nhan ' || v_suffix
    )
  );

  v_mismatch_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_mismatch_equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke delete mismatch ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_suffix,
      'khoa_phong_nhan', 'Khoa Nhan ' || v_suffix
    )
  );

  v_global_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_global_equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke delete global ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_suffix,
      'khoa_phong_nhan', 'Khoa Nhan ' || v_suffix
    )
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_delete(v_missing_claim_request_id::integer);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_delete to fail closed for missing don_vi claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected missing-claim transfer_request_delete to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT count(*)
  INTO v_remaining_count
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_missing_claim_request_id;

  IF v_remaining_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Missing-claim transfer delete deny should keep request %, remaining count %',
      v_missing_claim_request_id,
      v_remaining_count;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_other_tenant_id::text
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_delete(v_mismatch_request_id::integer);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_delete to deny mismatched don_vi claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected mismatched transfer_request_delete to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT count(*)
  INTO v_remaining_count
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_mismatch_request_id;

  IF v_remaining_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Mismatched transfer delete deny should keep request %, remaining count %',
      v_mismatch_request_id,
      v_remaining_count;
  END IF;

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

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text
    )::text,
    true
  );

  PERFORM public.transfer_request_delete(v_global_request_id::integer);

  SELECT count(*)
  INTO v_remaining_count
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_global_request_id;

  IF v_remaining_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Expected global transfer_request_delete to remove pending request %, remaining count %',
      v_global_request_id,
      v_remaining_count;
  END IF;
END $$;

ROLLBACK;
