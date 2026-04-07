-- supabase/tests/transfer_external_location_sync_smoke.sql
-- Purpose: prove external transfer vi_tri_lap_dat sync works end-to-end.
-- How to run: psql "$DATABASE_URL" -f supabase/tests/transfer_external_location_sync_smoke.sql
-- Non-destructive: wrapped in a transaction and rolled back.

BEGIN;

CREATE TEMP TABLE _ext_loc_ctx (
  suffix          text    NOT NULL,
  tenant_id       bigint  NOT NULL,
  tenant_id_other bigint  NOT NULL,
  user_id         bigint  NOT NULL,
  equipment_id    bigint  NOT NULL,
  equipment_id_other bigint NOT NULL
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp._ext_loc_move_request(
  p_request_id integer,
  p_user_id bigint,
  p_target_status text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.transfer_request_update_status(
    p_request_id,
    'da_duyet',
    jsonb_build_object(
      'nguoi_duyet_id', p_user_id::text,
      'ngay_duyet', clock_timestamp()
    )
  );

  IF p_target_status IN ('dang_luan_chuyen', 'da_ban_giao') THEN
    PERFORM public.transfer_request_update_status(
      p_request_id,
      'dang_luan_chuyen',
      jsonb_build_object('ngay_ban_giao', clock_timestamp())
    );
  END IF;

  IF p_target_status = 'da_ban_giao' THEN
    PERFORM public.transfer_request_update_status(
      p_request_id,
      'da_ban_giao',
      jsonb_build_object('ngay_ban_giao', clock_timestamp())
    );
  END IF;
END;
$$;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant_id bigint;
  v_tenant_id_other bigint;
  v_user_id bigint;
  v_equipment_id bigint;
  v_equipment_id_other bigint;
BEGIN
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row';
  END IF;

  INSERT INTO public.don_vi(name, active)
  VALUES ('ExtLoc Smoke ' || v_suffix, true)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.don_vi(name, active)
  VALUES ('ExtLoc Smoke Other ' || v_suffix, true)
  RETURNING id INTO v_tenant_id_other;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly,
    vi_tri_lap_dat, tinh_trang_hien_tai, is_deleted
  ) VALUES (
    'SMK-EXT-' || v_suffix, 'ExtLoc Smoke Equipment ' || v_suffix,
    v_tenant_id, 'Khoa Noi ' || v_suffix,
    'Phong 101', 'Hoat dong', false
  ) RETURNING id INTO v_equipment_id;

  -- Equipment in OTHER tenant but same khoa_phong_quan_ly name (for cross-tenant test)
  INSERT INTO public.thiet_bi(
    ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly,
    vi_tri_lap_dat, tinh_trang_hien_tai, is_deleted
  ) VALUES (
    'SMK-EXT-OTH-' || v_suffix, 'ExtLoc Smoke Other Tenant ' || v_suffix,
    v_tenant_id_other, 'Khoa Noi ' || v_suffix,
    'Phong 999 Tenant Khac', 'Hoat dong', false
  ) RETURNING id INTO v_equipment_id_other;

  INSERT INTO _ext_loc_ctx(suffix, tenant_id, tenant_id_other, user_id, equipment_id, equipment_id_other)
  VALUES (v_suffix, v_tenant_id, v_tenant_id_other, v_user_id, v_equipment_id, v_equipment_id_other);
END $$;

----------------------------------------------------------------------
-- 1) dang_luan_chuyen sets vi_tri_lap_dat = 'Đang luân chuyển bên ngoài'
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_vi_tri text;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke outbound ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van A',
    'so_dien_thoai', '0900000000'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'dang_luan_chuyen');

  SELECT vi_tri_lap_dat INTO v_vi_tri
  FROM public.thiet_bi WHERE id = v_ctx.equipment_id;

  IF v_vi_tri IS DISTINCT FROM 'Đang luân chuyển bên ngoài' THEN
    RAISE EXCEPTION 'Test 1 FAIL: expected vi_tri_lap_dat = Đang luân chuyển bên ngoài, got %', v_vi_tri;
  END IF;

  RAISE NOTICE 'OK 1: dang_luan_chuyen sets vi_tri_lap_dat for ben_ngoai';
END $$;

----------------------------------------------------------------------
-- 2) da_ban_giao preserves fixed location
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_vi_tri text;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke handover ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 2 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van B',
    'so_dien_thoai', '0900000001'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'da_ban_giao');

  SELECT vi_tri_lap_dat INTO v_vi_tri
  FROM public.thiet_bi WHERE id = v_ctx.equipment_id;

  IF v_vi_tri IS DISTINCT FROM 'Đang luân chuyển bên ngoài' THEN
    RAISE EXCEPTION 'Test 2 FAIL: expected vi_tri_lap_dat preserved as Đang luân chuyển bên ngoài after da_ban_giao, got %', v_vi_tri;
  END IF;

  RAISE NOTICE 'OK 2: da_ban_giao preserves fixed location';
END $$;

----------------------------------------------------------------------
-- 2b) External completion requires da_ban_giao
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke invalid complete state ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 2B ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van B2',
    'so_dien_thoai', '0900000011'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'dang_luan_chuyen');

  BEGIN
    PERFORM public.transfer_request_complete(
      v_request_id::int,
      jsonb_build_object('vi_tri_hoan_tra', 'Phong 202')
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Test 2b FAIL: expected transfer_request_complete to reject ben_ngoai completion before da_ban_giao';
  END IF;

  RAISE NOTICE 'OK 2b: ben_ngoai completion requires da_ban_giao';
END $$;

----------------------------------------------------------------------
-- 3) Return rejects missing vi_tri_hoan_tra
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke missing loc ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 3 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van C',
    'so_dien_thoai', '0900000002'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'da_ban_giao');

  BEGIN
    PERFORM public.transfer_request_complete(v_request_id::int, '{}'::jsonb);
  EXCEPTION
    WHEN SQLSTATE '22023' THEN v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Test 3 FAIL: expected transfer_request_complete to reject missing vi_tri_hoan_tra for ben_ngoai';
  END IF;

  RAISE NOTICE 'OK 3: return rejects missing vi_tri_hoan_tra';
END $$;

----------------------------------------------------------------------
-- 4) Return rejects forbidden value 'Đang luân chuyển bên ngoài'
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke forbidden loc ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 4 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van D',
    'so_dien_thoai', '0900000003'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'da_ban_giao');

  BEGIN
    PERFORM public.transfer_request_complete(
      v_request_id::int,
      jsonb_build_object('vi_tri_hoan_tra', 'Đang luân chuyển bên ngoài')
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Test 4 FAIL: expected transfer_request_complete to reject forbidden vi_tri_hoan_tra value';
  END IF;

  RAISE NOTICE 'OK 4: return rejects forbidden vi_tri_hoan_tra value';
END $$;

----------------------------------------------------------------------
-- 5) Valid return updates vi_tri_lap_dat to provided value
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_vi_tri text;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke valid return ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 5 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van E',
    'so_dien_thoai', '0900000004'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'da_ban_giao');

  PERFORM public.transfer_request_complete(
    v_request_id::int,
    jsonb_build_object('vi_tri_hoan_tra', 'Phong 501')
  );

  SELECT vi_tri_lap_dat INTO v_vi_tri
  FROM public.thiet_bi WHERE id = v_ctx.equipment_id;

  IF v_vi_tri IS DISTINCT FROM 'Phong 501' THEN
    RAISE EXCEPTION 'Test 5 FAIL: expected vi_tri_lap_dat = Phong 501, got %', v_vi_tri;
  END IF;

  RAISE NOTICE 'OK 5: valid return updates vi_tri_lap_dat';
END $$;

----------------------------------------------------------------------
-- 6) Audit log includes vi_tri_truoc_do + vi_tri_hoan_tra_moi
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_log record;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  -- Reset equipment location for a clean test
  UPDATE public.thiet_bi SET vi_tri_lap_dat = 'Đang luân chuyển bên ngoài'
  WHERE id = v_ctx.equipment_id;

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke audit ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 6 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van F',
    'so_dien_thoai', '0900000005'
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'da_ban_giao');

  PERFORM public.transfer_request_complete(
    v_request_id::int,
    jsonb_build_object('vi_tri_hoan_tra', 'Phong 302')
  );

  SELECT al.action_details INTO v_log
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete'
  ORDER BY al.id DESC LIMIT 1;

  IF v_log IS NULL THEN
    RAISE EXCEPTION 'Test 6 FAIL: no transfer_request_complete audit row found';
  END IF;

  IF v_log.action_details->>'vi_tri_truoc_do' IS NULL THEN
    RAISE EXCEPTION 'Test 6 FAIL: audit action_details missing vi_tri_truoc_do';
  END IF;

  IF v_log.action_details->>'vi_tri_hoan_tra_moi' IS DISTINCT FROM 'Phong 302' THEN
    RAISE EXCEPTION 'Test 6 FAIL: expected audit vi_tri_hoan_tra_moi = Phong 302, got %',
      v_log.action_details->>'vi_tri_hoan_tra_moi';
  END IF;

  RAISE NOTICE 'OK 6: audit log includes vi_tri_truoc_do + vi_tri_hoan_tra_moi';
END $$;

----------------------------------------------------------------------
-- 7) Internal transfer completion unchanged
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_vi_tri_before text;
  v_vi_tri_after text;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  -- Restore a normal location before internal test
  UPDATE public.thiet_bi SET vi_tri_lap_dat = 'Phong 101 Internal'
  WHERE id = v_ctx.equipment_id;

  SELECT vi_tri_lap_dat INTO v_vi_tri_before
  FROM public.thiet_bi WHERE id = v_ctx.equipment_id;

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'noi_bo',
    'ly_do_luan_chuyen', 'Smoke internal unchanged ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'khoa_phong_nhan', 'Khoa Nhan Internal ' || v_ctx.suffix
  ));

  PERFORM pg_temp._ext_loc_move_request(v_request_id::int, v_ctx.user_id, 'dang_luan_chuyen');

  -- Internal complete should NOT require vi_tri_hoan_tra
  PERFORM public.transfer_request_complete(v_request_id::int, '{}'::jsonb);

  SELECT vi_tri_lap_dat INTO v_vi_tri_after
  FROM public.thiet_bi WHERE id = v_ctx.equipment_id;

  -- Internal transfers may change khoa_phong_quan_ly but should NOT
  -- inject 'Đang luân chuyển bên ngoài' or require location input.
  -- The existing behavior moves dept+status; vi_tri is NOT set to transit marker.
  IF v_vi_tri_after = 'Đang luân chuyển bên ngoài' THEN
    RAISE EXCEPTION 'Test 7 FAIL: internal transfer should not set vi_tri_lap_dat to transit marker';
  END IF;

  RAISE NOTICE 'OK 7: internal transfer completion unchanged';
END $$;

----------------------------------------------------------------------
-- 8) Suggestion RPC: cross-tenant isolation
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_suggestion_count bigint;
  v_leaked boolean := false;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  -- Restore equipment location for suggestion test
  UPDATE public.thiet_bi SET vi_tri_lap_dat = 'Phong 101'
  WHERE id = v_ctx.equipment_id;

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke cross tenant ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 7 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van G',
    'so_dien_thoai', '0900000006'
  ));

  -- Check: other tenant's location should NOT appear in suggestions
  SELECT EXISTS(
    SELECT 1 FROM public.get_equipment_location_suggestions(v_request_id::int)
    WHERE vi_tri = 'Phong 999 Tenant Khac'
  ) INTO v_leaked;

  IF v_leaked THEN
    RAISE EXCEPTION 'Test 8 FAIL: suggestion RPC leaked location from other tenant with same khoa_phong_quan_ly';
  END IF;

  -- Verify own tenant location IS returned
  SELECT COUNT(*) INTO v_suggestion_count
  FROM public.get_equipment_location_suggestions(v_request_id::int)
  WHERE vi_tri = 'Phong 101';

  IF v_suggestion_count < 1 THEN
    RAISE EXCEPTION 'Test 8 FAIL: expected own-tenant location in suggestions but got none';
  END IF;

  RAISE NOTICE 'OK 8: suggestion RPC isolates by tenant';
END $$;

----------------------------------------------------------------------
-- 9) Suggestion RPC: regional_leader denied
----------------------------------------------------------------------
DO $$
DECLARE
  v_ctx _ext_loc_ctx%ROWTYPE;
  v_request_id bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT * INTO v_ctx FROM _ext_loc_ctx LIMIT 1;

  -- Create request as to_qltb first
  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text,
    'don_vi', v_ctx.tenant_id::text
  )::text, true);

  v_request_id := public.transfer_request_create(jsonb_build_object(
    'thiet_bi_id', v_ctx.equipment_id,
    'loai_hinh', 'ben_ngoai',
    'ly_do_luan_chuyen', 'Smoke regional deny ' || v_ctx.suffix,
    'khoa_phong_hien_tai', 'Khoa Noi ' || v_ctx.suffix,
    'don_vi_nhan', 'BV Ngoai 8 ' || v_ctx.suffix,
    'nguoi_lien_he', 'Nguyen Van H',
    'so_dien_thoai', '0900000007'
  ));

  -- Switch to regional_leader session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'regional_leader', 'role', 'authenticated',
    'user_id', v_ctx.user_id::text, 'sub', v_ctx.user_id::text
    -- NOTE: no don_vi — regional_leader scope comes from dia_ban
  )::text, true);

  BEGIN
    PERFORM public.get_equipment_location_suggestions(v_request_id::int);
  EXCEPTION
    WHEN SQLSTATE '42501' THEN v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Test 9 FAIL: expected suggestion RPC to deny regional_leader';
  END IF;

  RAISE NOTICE 'OK 9: suggestion RPC denies regional_leader';
END $$;

----------------------------------------------------------------------
-- Cleanup: roll back all test data
----------------------------------------------------------------------
ROLLBACK;
