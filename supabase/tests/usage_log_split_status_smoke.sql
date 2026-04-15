-- supabase/tests/usage_log_split_status_smoke.sql
-- Purpose: validate split status columns, RPC params, backward compat, security fixes
-- How to run: docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/usage_log_split_status_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

-- 1) Schema: columns tinh_trang_ban_dau and tinh_trang_ket_thuc exist
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'nhat_ky_su_dung'
    AND column_name IN ('tinh_trang_ban_dau', 'tinh_trang_ket_thuc');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 new columns (tinh_trang_ban_dau, tinh_trang_ket_thuc), found %', v_count;
  END IF;

  RAISE NOTICE 'OK: schema columns exist';
END $$;

-- 2) usage_session_start: happy path with p_tinh_trang_ban_dau
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-START-HP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_result jsonb;
  v_row record;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split Start HP', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split start happy path', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  v_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_ban_dau := 'Hoạt động tốt',
    p_ghi_chu := 'smoke test'
  );

  -- JSON response must include tinh_trang_ban_dau
  IF v_result->>'tinh_trang_ban_dau' IS DISTINCT FROM 'Hoạt động tốt' THEN
    RAISE EXCEPTION 'JSON response tinh_trang_ban_dau mismatch: %', v_result->>'tinh_trang_ban_dau';
  END IF;

  -- DB row must have tinh_trang_ban_dau written
  SELECT tinh_trang_ban_dau, tinh_trang_thiet_bi
  INTO v_row
  FROM public.nhat_ky_su_dung
  WHERE id = (v_result->>'id')::bigint;

  IF v_row.tinh_trang_ban_dau IS DISTINCT FROM 'Hoạt động tốt' THEN
    RAISE EXCEPTION 'DB tinh_trang_ban_dau mismatch: %', v_row.tinh_trang_ban_dau;
  END IF;

  -- Legacy column should also be written (backward compat for reads)
  IF v_row.tinh_trang_thiet_bi IS DISTINCT FROM 'Hoạt động tốt' THEN
    RAISE EXCEPTION 'Legacy tinh_trang_thiet_bi not written: %', v_row.tinh_trang_thiet_bi;
  END IF;

  RAISE NOTICE 'OK: usage_session_start happy path passed';
END $$;

-- 3) usage_session_start: backward compat — NULL param, no exception
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-START-BC-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_result jsonb;
  v_row record;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split Start BC', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split start backward compat', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  -- Old caller: does NOT send p_tinh_trang_ban_dau at all
  v_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_thiet_bi := 'Hoạt động',
    p_ghi_chu := 'old caller smoke'
  );

  -- Should NOT raise exception (we got here = success)

  -- DB: tinh_trang_ban_dau should be NULL, legacy should be written
  SELECT tinh_trang_ban_dau, tinh_trang_thiet_bi
  INTO v_row
  FROM public.nhat_ky_su_dung
  WHERE id = (v_result->>'id')::bigint;

  IF v_row.tinh_trang_ban_dau IS NOT NULL THEN
    RAISE EXCEPTION 'Backward compat: tinh_trang_ban_dau should be NULL for old caller, got %', v_row.tinh_trang_ban_dau;
  END IF;

  IF v_row.tinh_trang_thiet_bi IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION 'Backward compat: legacy column not written: %', v_row.tinh_trang_thiet_bi;
  END IF;

  RAISE NOTICE 'OK: usage_session_start backward compat passed';
END $$;

-- 4) usage_session_start: empty string rejected
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-START-VAL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_error_raised boolean := false;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split Start Val', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split start validation', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  BEGIN
    PERFORM public.usage_session_start(
      p_thiet_bi_id := v_thiet_bi_id,
      p_nguoi_su_dung_id := v_user_id,
      p_tinh_trang_ban_dau := '',
      p_ghi_chu := 'should fail'
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected empty p_tinh_trang_ban_dau to raise 22023';
  END IF;

  RAISE NOTICE 'OK: usage_session_start empty string rejected';
END $$;

-- 5) usage_session_end: happy path with p_tinh_trang_ket_thuc + DDL search_path
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-END-HP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_start_result jsonb;
  v_end_result jsonb;
  v_log_id bigint;
  v_row record;
  v_proconfig text[];
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split End HP', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split end happy path', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  -- Start a session first
  v_start_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_ban_dau := 'Bình thường'
  );
  v_log_id := (v_start_result->>'id')::bigint;

  -- End with p_tinh_trang_ket_thuc
  v_end_result := public.usage_session_end(
    p_usage_log_id := v_log_id,
    p_tinh_trang_ket_thuc := 'Hư hỏng nhẹ'
  );

  -- JSON response must include tinh_trang_ket_thuc
  IF v_end_result->>'tinh_trang_ket_thuc' IS DISTINCT FROM 'Hư hỏng nhẹ' THEN
    RAISE EXCEPTION 'End JSON tinh_trang_ket_thuc mismatch: %', v_end_result->>'tinh_trang_ket_thuc';
  END IF;

  -- JSON response must include tinh_trang_ban_dau (from start)
  IF v_end_result->>'tinh_trang_ban_dau' IS DISTINCT FROM 'Bình thường' THEN
    RAISE EXCEPTION 'End JSON tinh_trang_ban_dau mismatch: %', v_end_result->>'tinh_trang_ban_dau';
  END IF;

  -- DB row verification
  SELECT tinh_trang_ban_dau, tinh_trang_ket_thuc, tinh_trang_thiet_bi, trang_thai
  INTO v_row
  FROM public.nhat_ky_su_dung WHERE id = v_log_id;

  IF v_row.tinh_trang_ket_thuc IS DISTINCT FROM 'Hư hỏng nhẹ' THEN
    RAISE EXCEPTION 'DB tinh_trang_ket_thuc mismatch: %', v_row.tinh_trang_ket_thuc;
  END IF;

  IF v_row.trang_thai IS DISTINCT FROM 'hoan_thanh' THEN
    RAISE EXCEPTION 'Session should be completed, got %', v_row.trang_thai;
  END IF;

  -- Legacy column should be written with end status for backward readers
  IF v_row.tinh_trang_thiet_bi IS DISTINCT FROM 'Hư hỏng nhẹ' THEN
    RAISE EXCEPTION 'Legacy tinh_trang_thiet_bi not updated: %', v_row.tinh_trang_thiet_bi;
  END IF;

  -- DDL-level search_path must be set (not just body-level set_config)
  SELECT p.proconfig
  INTO v_proconfig
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'usage_session_end'
    AND pg_get_function_identity_arguments(p.oid) = 'p_usage_log_id bigint, p_tinh_trang_thiet_bi text, p_ghi_chu text, p_don_vi bigint, p_tinh_trang_ket_thuc text'
  LIMIT 1;

  IF v_proconfig IS NULL OR NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(v_proconfig, ARRAY[]::text[])) AS c
    WHERE lower(c) = 'search_path=public, pg_temp'
  ) THEN
    RAISE EXCEPTION 'usage_session_end missing DDL-level search_path, proconfig = %', v_proconfig;
  END IF;

  RAISE NOTICE 'OK: usage_session_end happy path + DDL search_path passed';
END $$;

-- 6) usage_session_end: empty string rejected
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-END-VAL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_start_result jsonb;
  v_log_id bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split End Val', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split end validation', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  v_start_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_ban_dau := 'Tốt'
  );
  v_log_id := (v_start_result->>'id')::bigint;

  BEGIN
    PERFORM public.usage_session_end(
      p_usage_log_id := v_log_id,
      p_tinh_trang_ket_thuc := ''
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected empty p_tinh_trang_ket_thuc to raise 22023';
  END IF;

  RAISE NOTICE 'OK: usage_session_end empty string rejected';
END $$;

-- 7) usage_session_end: admin role should bypass tenant guard (same as global)
DO $$
DECLARE
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-END-ADM-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_start_result jsonb;
  v_end_result jsonb;
  v_log_id bigint;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  -- Pick a different tenant for the admin user to prove cross-tenant access
  SELECT id INTO v_other_tenant
  FROM public.don_vi WHERE active = true AND id <> v_tenant
  ORDER BY id LIMIT 1;

  IF v_other_tenant IS NULL THEN
    INSERT INTO public.don_vi(name, active)
    VALUES ('Smoke split admin tenant ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), true)
    RETURNING id INTO v_other_tenant;
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split End Admin', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split end admin test', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  -- Start session as to_qltb (valid tenant)
  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  v_start_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_ban_dau := 'OK'
  );
  v_log_id := (v_start_result->>'id')::bigint;

  -- Switch to admin role (different tenant) — should still be able to end session
  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'admin', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_other_tenant::text
  )::text, true);

  v_end_result := public.usage_session_end(
    p_usage_log_id := v_log_id,
    p_tinh_trang_ket_thuc := 'OK sau sử dụng'
  );

  -- If we reach here without exception, admin bypassed tenant guard
  IF v_end_result->>'trang_thai' IS DISTINCT FROM 'hoan_thanh' THEN
    RAISE EXCEPTION 'Admin end session should succeed, got trang_thai=%', v_end_result->>'trang_thai';
  END IF;

  RAISE NOTICE 'OK: usage_session_end admin role guard bypass passed';
END $$;

-- 8) usage_log_list: both overloads return tinh_trang_ban_dau + tinh_trang_ket_thuc
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-LIST-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_start_result jsonb;
  v_log_id bigint;
  v_row_8p jsonb;
  v_row_7p jsonb;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split List Test', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split list test equip', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  v_start_result := public.usage_session_start(
    p_thiet_bi_id := v_thiet_bi_id,
    p_nguoi_su_dung_id := v_user_id,
    p_tinh_trang_ban_dau := 'Tốt'
  );
  v_log_id := (v_start_result->>'id')::bigint;

  -- End session to populate tinh_trang_ket_thuc
  PERFORM public.usage_session_end(
    p_usage_log_id := v_log_id,
    p_tinh_trang_ket_thuc := 'Vẫn tốt'
  );

  -- 8-param overload
  SELECT r INTO v_row_8p
  FROM public.usage_log_list(
    p_thiet_bi_id := v_thiet_bi_id,
    p_limit := 1
  ) r
  LIMIT 1;

  IF v_row_8p IS NULL THEN
    RAISE EXCEPTION '8-param usage_log_list returned no rows';
  END IF;

  IF NOT v_row_8p ? 'tinh_trang_ban_dau' THEN
    RAISE EXCEPTION '8-param overload missing tinh_trang_ban_dau key';
  END IF;

  IF NOT v_row_8p ? 'tinh_trang_ket_thuc' THEN
    RAISE EXCEPTION '8-param overload missing tinh_trang_ket_thuc key';
  END IF;

  IF v_row_8p->>'tinh_trang_ban_dau' IS DISTINCT FROM 'Tốt' THEN
    RAISE EXCEPTION '8-param tinh_trang_ban_dau value mismatch: %', v_row_8p->>'tinh_trang_ban_dau';
  END IF;

  IF v_row_8p->>'tinh_trang_ket_thuc' IS DISTINCT FROM 'Vẫn tốt' THEN
    RAISE EXCEPTION '8-param tinh_trang_ket_thuc value mismatch: %', v_row_8p->>'tinh_trang_ket_thuc';
  END IF;

  -- 7-param overload (uses to_jsonb → auto-includes new columns)
  SELECT r INTO v_row_7p
  FROM public.usage_log_list(
    p_q := v_code,
    p_page := 1,
    p_page_size := 1
  ) r
  LIMIT 1;

  IF v_row_7p IS NULL THEN
    RAISE EXCEPTION '7-param usage_log_list returned no rows';
  END IF;

  IF NOT v_row_7p ? 'tinh_trang_ban_dau' THEN
    RAISE EXCEPTION '7-param overload missing tinh_trang_ban_dau key';
  END IF;

  IF NOT v_row_7p ? 'tinh_trang_ket_thuc' THEN
    RAISE EXCEPTION '7-param overload missing tinh_trang_ket_thuc key';
  END IF;

  IF v_row_7p->>'tinh_trang_ban_dau' IS DISTINCT FROM 'Tốt' THEN
    RAISE EXCEPTION '7-param tinh_trang_ban_dau value mismatch: %', v_row_7p->>'tinh_trang_ban_dau';
  END IF;

  RAISE NOTICE 'OK: usage_log_list both overloads return split status fields';
END $$;

-- 8) Backfill: legacy tinh_trang_thiet_bi → new columns
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'UL-SPLIT-BKFILL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_row record;
BEGIN
  SELECT id INTO v_tenant
  FROM public.don_vi WHERE active = true
  ORDER BY id LIMIT 1;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (v_code, 'smoke', 'Split Backfill', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Split backfill test', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  -- Insert a legacy-style row directly (simulating pre-migration data)
  INSERT INTO public.nhat_ky_su_dung (
    thiet_bi_id, nguoi_su_dung_id, thoi_gian_bat_dau,
    tinh_trang_thiet_bi, trang_thai, created_at, updated_at
  ) VALUES (
    v_thiet_bi_id, v_user_id, timezone('utc', now()),
    'Legacy Status', 'hoan_thanh', timezone('utc', now()), timezone('utc', now())
  );

  -- Manually run backfill logic (same as migration does)
  UPDATE public.nhat_ky_su_dung
  SET tinh_trang_ban_dau = tinh_trang_thiet_bi
  WHERE thiet_bi_id = v_thiet_bi_id
    AND tinh_trang_ban_dau IS NULL
    AND tinh_trang_thiet_bi IS NOT NULL;

  UPDATE public.nhat_ky_su_dung
  SET tinh_trang_ket_thuc = tinh_trang_thiet_bi
  WHERE thiet_bi_id = v_thiet_bi_id
    AND tinh_trang_ket_thuc IS NULL
    AND tinh_trang_thiet_bi IS NOT NULL
    AND trang_thai = 'hoan_thanh';

  SELECT tinh_trang_ban_dau, tinh_trang_ket_thuc, tinh_trang_thiet_bi
  INTO v_row
  FROM public.nhat_ky_su_dung
  WHERE thiet_bi_id = v_thiet_bi_id
  LIMIT 1;

  IF v_row.tinh_trang_ban_dau IS DISTINCT FROM 'Legacy Status' THEN
    RAISE EXCEPTION 'Backfill tinh_trang_ban_dau mismatch: %', v_row.tinh_trang_ban_dau;
  END IF;

  IF v_row.tinh_trang_ket_thuc IS DISTINCT FROM 'Legacy Status' THEN
    RAISE EXCEPTION 'Backfill tinh_trang_ket_thuc for completed session mismatch: %', v_row.tinh_trang_ket_thuc;
  END IF;

  -- Test active session: tinh_trang_ket_thuc should NOT be backfilled
  INSERT INTO public.nhat_ky_su_dung (
    thiet_bi_id, nguoi_su_dung_id, thoi_gian_bat_dau,
    tinh_trang_thiet_bi, trang_thai, created_at, updated_at
  ) VALUES (
    v_thiet_bi_id, v_user_id, timezone('utc', now()),
    'Active Legacy', 'dang_su_dung', timezone('utc', now()), timezone('utc', now())
  );

  UPDATE public.nhat_ky_su_dung
  SET tinh_trang_ban_dau = tinh_trang_thiet_bi
  WHERE thiet_bi_id = v_thiet_bi_id
    AND tinh_trang_ban_dau IS NULL
    AND tinh_trang_thiet_bi IS NOT NULL;

  UPDATE public.nhat_ky_su_dung
  SET tinh_trang_ket_thuc = tinh_trang_thiet_bi
  WHERE thiet_bi_id = v_thiet_bi_id
    AND tinh_trang_ket_thuc IS NULL
    AND tinh_trang_thiet_bi IS NOT NULL
    AND trang_thai = 'hoan_thanh';

  SELECT tinh_trang_ban_dau, tinh_trang_ket_thuc
  INTO v_row
  FROM public.nhat_ky_su_dung
  WHERE thiet_bi_id = v_thiet_bi_id
    AND trang_thai = 'dang_su_dung'
  LIMIT 1;

  IF v_row.tinh_trang_ban_dau IS DISTINCT FROM 'Active Legacy' THEN
    RAISE EXCEPTION 'Backfill active session tinh_trang_ban_dau mismatch: %', v_row.tinh_trang_ban_dau;
  END IF;

  IF v_row.tinh_trang_ket_thuc IS NOT NULL THEN
    RAISE EXCEPTION 'Backfill should NOT fill tinh_trang_ket_thuc for active sessions, got %', v_row.tinh_trang_ket_thuc;
  END IF;

  RAISE NOTICE 'OK: backfill verification passed';
END $$;

ROLLBACK;
