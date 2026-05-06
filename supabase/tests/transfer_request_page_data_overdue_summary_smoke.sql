-- Smoke tests for Issue #386 transfer_request_page_data.overdue_summary.
-- Run only after applying 20260506080000_enrich_transfer_page_data_with_overdue_summary.sql.
-- Non-destructive: wrapped in a transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_user_id bigint;
  v_tenant_a bigint;
  v_tenant_b bigint;
  v_equipment_a_overdue bigint;
  v_equipment_a_upcoming bigint;
  v_equipment_a_old bigint;
  v_equipment_b_overdue bigint;
  v_request_a_overdue bigint;
  v_request_a_upcoming bigint;
  v_request_a_old bigint;
  v_request_b_overdue bigint;
  v_page jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('transfer_request_page_data_overdue_summary_smoke'));

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
  VALUES ('Transfer Overdue Smoke A ' || v_suffix, true)
  RETURNING id INTO v_tenant_a;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Transfer Overdue Smoke B ' || v_suffix, true)
  RETURNING id INTO v_tenant_b;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('SMK-TRF-OD-A-' || v_suffix, 'Transfer Overdue Smoke A ' || v_suffix, v_tenant_a, 'Khoa A', 'Hoat dong', false)
  RETURNING id INTO v_equipment_a_overdue;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('SMK-TRF-UP-A-' || v_suffix, 'Transfer Upcoming Smoke A ' || v_suffix, v_tenant_a, 'Khoa A', 'Hoat dong', false)
  RETURNING id INTO v_equipment_a_upcoming;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('SMK-TRF-OLD-A-' || v_suffix, 'Transfer Old Smoke A ' || v_suffix, v_tenant_a, 'Khoa A', 'Hoat dong', false)
  RETURNING id INTO v_equipment_a_old;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('SMK-TRF-OD-B-' || v_suffix, 'Transfer Overdue Smoke B ' || v_suffix, v_tenant_b, 'Khoa B', 'Hoat dong', false)
  RETURNING id INTO v_equipment_b_overdue;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'global',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant_a::text
    )::text,
    true
  );

  v_request_a_overdue := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_equipment_a_overdue,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke overdue ' || v_suffix,
    'muc_dich', 'cho_muon',
    'don_vi_nhan', 'External A'
  ));

  v_request_a_upcoming := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_equipment_a_upcoming,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke upcoming ' || v_suffix,
    'muc_dich', 'cho_muon',
    'don_vi_nhan', 'External A'
  ));

  v_request_a_old := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_equipment_a_old,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke old created ' || v_suffix,
    'muc_dich', 'cho_muon',
    'don_vi_nhan', 'External A'
  ));

  v_request_b_overdue := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_equipment_b_overdue,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke tenant B ' || v_suffix,
    'muc_dich', 'cho_muon',
    'don_vi_nhan', 'External B'
  ));

  UPDATE public.yeu_cau_luan_chuyen
  SET
    trang_thai = 'da_ban_giao',
    ngay_du_kien_tra = ((v_today - 3)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    created_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    updated_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  WHERE id = v_request_a_overdue;

  UPDATE public.yeu_cau_luan_chuyen
  SET
    trang_thai = 'dang_luan_chuyen',
    ngay_du_kien_tra = ((v_today + 4)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    created_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    updated_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  WHERE id = v_request_a_upcoming;

  UPDATE public.yeu_cau_luan_chuyen
  SET
    trang_thai = 'da_ban_giao',
    ngay_du_kien_tra = ((v_today - 5)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    created_at = ((v_today - 30)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    updated_at = ((v_today - 30)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  WHERE id = v_request_a_old;

  UPDATE public.yeu_cau_luan_chuyen
  SET
    trang_thai = 'da_ban_giao',
    ngay_du_kien_tra = ((v_today - 2)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    created_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'),
    updated_at = ((v_today - 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  WHERE id = v_request_b_overdue;

  v_page := public.transfer_request_page_data(
    NULL, NULL, ARRAY['ben_ngoai'], 1, 10, v_tenant_a, NULL, NULL, NULL, 'table', 30, false, true
  );

  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected tenant A overdue summary total 3, got %', v_page->'overdue_summary'->>'total';
  END IF;
  IF (v_page->'overdue_summary'->>'overdue')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Expected tenant A overdue count 2, got %', v_page->'overdue_summary'->>'overdue';
  END IF;
  IF (v_page->'overdue_summary'->>'due_soon')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected tenant A due_soon count 1, got %', v_page->'overdue_summary'->>'due_soon';
  END IF;
  IF jsonb_array_length(v_page->'overdue_summary'->'items') IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected tenant A overdue items length 3';
  END IF;

  v_page := public.transfer_request_page_data(
    NULL, NULL, ARRAY['ben_ngoai'], 1, 10, v_tenant_b, NULL, NULL, NULL, 'table', 30, false, true
  );
  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected tenant B overdue summary total 1, got %', v_page->'overdue_summary'->>'total';
  END IF;

  v_page := public.transfer_request_page_data(
    NULL, NULL, ARRAY['ben_ngoai'], 1, 10, v_tenant_a, v_today - 2, NULL, NULL, 'table', 30, false, true
  );
  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Expected date-filtered tenant A total 2, got %', v_page->'overdue_summary'->>'total';
  END IF;

  v_page := public.transfer_request_page_data(
    'UP-A-' || v_suffix, NULL, ARRAY['ben_ngoai'], 1, 10, v_tenant_a, NULL, NULL, NULL, 'table', 30, false, true
  );
  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected search-filtered summary total 1, got %', v_page->'overdue_summary'->>'total';
  END IF;

  v_page := public.transfer_request_page_data(
    NULL, ARRAY['cho_duyet'], ARRAY['ben_ngoai'], 1, 10, v_tenant_a, NULL, NULL, NULL, 'table', 30, false, true
  );
  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Expected status-filtered summary total 0, got %', v_page->'overdue_summary'->>'total';
  END IF;

  v_page := public.transfer_request_page_data(
    NULL, NULL, ARRAY['ben_ngoai'], 1, 10, v_tenant_a, NULL, NULL, ARRAY[999999999::bigint], 'table', 30, false, true
  );
  IF (v_page->'overdue_summary'->>'total')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Expected assignee-filtered summary total 0, got %', v_page->'overdue_summary'->>'total';
  END IF;

  IF has_function_privilege('anon', 'public.transfer_request_external_pending_returns()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon should not execute legacy external pending returns RPC';
  END IF;
  IF has_function_privilege('authenticated', 'public.transfer_request_external_pending_returns()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated should not execute legacy external pending returns RPC';
  END IF;

  RAISE NOTICE 'OK: transfer_request_page_data overdue_summary smoke passed';
END $$;

ROLLBACK;
