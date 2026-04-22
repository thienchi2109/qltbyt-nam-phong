-- supabase/tests/equipment_department_scope_reads_smoke.sql
-- Purpose: lock role=user department-scoped read behavior for Issue #301
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_allowed_id bigint;
  v_blocked_id bigint;
  v_other_tenant_id bigint;
  v_payload jsonb;
  v_count integer;
  v_name text;
  v_rec public.thiet_bi;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
  v_names text[];
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Department Scope Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Department Scope Other Tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    nguoi_dang_truc_tiep_quan_ly,
    vi_tri_lap_dat,
    phan_loai_theo_nd98,
    nguon_kinh_phi,
    is_deleted
  )
  VALUES (
    'SMK-DEP-ALLOW-' || v_suffix,
    'Smoke Department Allowed ' || v_suffix,
    v_tenant,
    '  Nội thận - Tiết niệu  ',
    'Hoat dong',
    'User Allowed ' || v_suffix,
    'Room Allowed ' || v_suffix,
    'Class Allowed ' || v_suffix,
    'Fund Allowed ' || v_suffix,
    false
  )
  RETURNING id INTO v_allowed_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    nguoi_dang_truc_tiep_quan_ly,
    vi_tri_lap_dat,
    phan_loai_theo_nd98,
    nguon_kinh_phi,
    is_deleted
  )
  VALUES (
    'SMK-DEP-BLOCK-' || v_suffix,
    'Smoke Department Blocked ' || v_suffix,
    v_tenant,
    'Khoa Ngoai ' || v_suffix,
    'Cho sua chua',
    'User Blocked ' || v_suffix,
    'Room Blocked ' || v_suffix,
    'Class Blocked ' || v_suffix,
    'Fund Blocked ' || v_suffix,
    false
  )
  RETURNING id INTO v_blocked_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-DEP-OTHER-' || v_suffix,
    'Smoke Department Other Tenant ' || v_suffix,
    v_other_tenant,
    'Khoa Noi Tong Hop',
    'Hoat dong',
    false
  )
  RETURNING id INTO v_other_tenant_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', v_tenant::text,
      'khoa_phong', ' ' || chr(160) || E'NỘI\nTHẬN\t  - TIẾT   NIỆU '
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant
  );

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'equipment_list should return exactly 1 scoped row for role user, got %', v_count;
  END IF;

  SELECT public.equipment_list_enhanced(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant
  )
  INTO v_payload;

  IF COALESCE((v_payload->>'total')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'equipment_list_enhanced should report total=1 for scoped user rows, got %', v_payload->>'total';
  END IF;

  IF COALESCE(jsonb_array_length(v_payload->'data'), 0) <> 1 THEN
    RAISE EXCEPTION 'equipment_list_enhanced should return exactly 1 scoped row, got %', COALESCE(jsonb_array_length(v_payload->'data'), 0);
  END IF;

  IF ((v_payload->'data'->0->>'id')::bigint) IS DISTINCT FROM v_allowed_id THEN
    RAISE EXCEPTION 'equipment_list_enhanced returned wrong scoped row for role user';
  END IF;

  SELECT public.equipment_get(v_allowed_id)
  INTO v_rec;

  IF v_rec.id IS DISTINCT FROM v_allowed_id THEN
    RAISE EXCEPTION 'equipment_get should return the same-department equipment for role user';
  END IF;

  SELECT public.equipment_get_by_code('SMK-DEP-ALLOW-' || v_suffix)
  INTO v_rec;

  IF v_rec.id IS DISTINCT FROM v_allowed_id THEN
    RAISE EXCEPTION 'equipment_get_by_code should return the same-department equipment for role user';
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.equipment_get(v_blocked_id);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected equipment_get to deny same-tenant cross-department role user access';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'equipment_get should deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.equipment_get_by_code('SMK-DEP-BLOCK-' || v_suffix);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected equipment_get_by_code to deny same-tenant cross-department role user access';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'equipment_get_by_code should deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*),
         array_agg((entry->>'name') ORDER BY entry->>'name')
  INTO v_count, v_names
  FROM public.departments_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'departments_list_for_tenant should expose exactly 1 scoped option, got %', v_count;
  END IF;

  IF array_position(v_names, 'Khoa Ngoai ' || v_suffix) IS NOT NULL THEN
    RAISE EXCEPTION 'departments_list_for_tenant leaked a blocked department option';
  END IF;

  SELECT COUNT(*), max(entry->>'name')
  INTO v_count, v_name
  FROM public.equipment_users_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 OR v_name IS DISTINCT FROM 'User Allowed ' || v_suffix THEN
    RAISE EXCEPTION 'equipment_users_list_for_tenant should derive options only from scoped equipment';
  END IF;

  SELECT COUNT(*), max(entry->>'name')
  INTO v_count, v_name
  FROM public.equipment_locations_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 OR v_name IS DISTINCT FROM 'Room Allowed ' || v_suffix THEN
    RAISE EXCEPTION 'equipment_locations_list_for_tenant should derive options only from scoped equipment';
  END IF;

  SELECT COUNT(*), max(entry->>'name')
  INTO v_count, v_name
  FROM public.equipment_classifications_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 OR v_name IS DISTINCT FROM 'Class Allowed ' || v_suffix THEN
    RAISE EXCEPTION 'equipment_classifications_list_for_tenant should derive options only from scoped equipment';
  END IF;

  SELECT COUNT(*), max(entry->>'name')
  INTO v_count, v_name
  FROM public.equipment_statuses_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 OR v_name IS DISTINCT FROM 'Hoat dong' THEN
    RAISE EXCEPTION 'equipment_statuses_list_for_tenant should derive options only from scoped equipment';
  END IF;

  SELECT COUNT(*), max(entry->>'name')
  INTO v_count, v_name
  FROM public.equipment_funding_sources_list_for_tenant(p_don_vi => v_tenant) entry;

  IF v_count <> 1 OR v_name IS DISTINCT FROM 'Fund Allowed ' || v_suffix THEN
    RAISE EXCEPTION 'equipment_funding_sources_list_for_tenant should derive options only from scoped equipment';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', v_tenant::text,
      'khoa_phong', ''
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant
  );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_list should fail closed to empty for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT public.equipment_list_enhanced(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant
  )
  INTO v_payload;

  IF COALESCE((v_payload->>'total')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'equipment_list_enhanced should fail closed to total=0 for blank khoa_phong claim';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.departments_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'departments_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_users_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_users_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_locations_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_locations_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_classifications_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_classifications_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_statuses_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_statuses_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.equipment_funding_sources_list_for_tenant(p_don_vi => v_tenant);

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'equipment_funding_sources_list_for_tenant should fail closed for blank khoa_phong claim, got %', v_count;
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.equipment_get(v_allowed_id);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'equipment_get should deny when role user has blank khoa_phong claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'equipment_get blank khoa_phong deny should use 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.equipment_get_by_code('SMK-DEP-ALLOW-' || v_suffix);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'equipment_get_by_code should deny when role user is missing khoa_phong claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'equipment_get_by_code missing khoa_phong deny should use 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'admin',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  SELECT public.equipment_get(v_blocked_id)
  INTO v_rec;

  IF v_rec.id IS DISTINCT FROM v_blocked_id THEN
    RAISE EXCEPTION 'Non-user admin/global control should preserve current access behavior';
  END IF;

  SELECT public.equipment_list_enhanced(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant
  )
  INTO v_payload;

  IF COALESCE((v_payload->>'total')::integer, 0) <> 2 THEN
    RAISE EXCEPTION 'Admin/global control should still see both same-tenant rows, got %', v_payload->>'total';
  END IF;

  RAISE NOTICE 'OK: equipment department scope read smoke checks passed';
END $$;

ROLLBACK;
