-- supabase/tests/equipment_department_distribution_smoke.sql
-- Purpose: smoke-test filtered equipment department distribution.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_count integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Department Distribution Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Department Distribution Other Tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    model,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    nguoi_dang_truc_tiep_quan_ly,
    vi_tri_lap_dat,
    phan_loai_theo_nd98,
    nguon_kinh_phi,
    is_deleted
  )
  VALUES
    (
      'SMK-DEPT-DIST-NGOAI-1-' || v_suffix,
      'Bom tiem dien ' || v_suffix,
      'BTD-100',
      v_tenant,
      'Khoa Ngoai ' || v_suffix,
      'Hoat dong',
      'User A ' || v_suffix,
      'Room 101 ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-DEPT-DIST-NGOAI-2-' || v_suffix,
      'Bom tiem dien ' || v_suffix,
      'BTD-200',
      v_tenant,
      'Khoa Ngoai ' || v_suffix,
      'Hoat dong',
      'User B ' || v_suffix,
      'Room 102 ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-DEPT-DIST-NOI-' || v_suffix,
      'Bom tiem dien ' || v_suffix,
      'BTD-300',
      v_tenant,
      'Khoa Noi ' || v_suffix,
      'Hoat dong',
      'User C ' || v_suffix,
      'Room 103 ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-DEPT-DIST-MISSING-' || v_suffix,
      'Bom tiem dien ' || v_suffix,
      'BTD-400',
      v_tenant,
      NULL,
      'Hoat dong',
      'User D ' || v_suffix,
      'Room 104 ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-DEPT-DIST-SEARCH-OUT-' || v_suffix,
      'May tho khac ' || v_suffix,
      'BTD-500',
      v_tenant,
      'Khoa Ngoai ' || v_suffix,
      'Hoat dong',
      'User E ' || v_suffix,
      'Room 105 ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-DEPT-DIST-OTHER-' || v_suffix,
      'Bom tiem dien ' || v_suffix,
      'BTD-600',
      v_other_tenant,
      'Khoa Ngoai ' || v_suffix,
      'Hoat dong',
      'User Other ' || v_suffix,
      'Room Other ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'user_id', '900001',
      'don_vi', v_tenant
    )::text,
    true
  );

  SELECT count
  INTO v_count
  FROM public.equipment_department_distribution(
    p_q => 'Bom tiem dien ' || v_suffix,
    p_don_vi => v_tenant
  )
  WHERE department = 'Khoa Ngoai ' || v_suffix;

  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected Khoa Ngoai count 2, got %', v_count;
  END IF;

  SELECT count
  INTO v_count
  FROM public.equipment_department_distribution(
    p_q => 'Bom tiem dien ' || v_suffix,
    p_don_vi => v_tenant
  )
  WHERE department = 'Khoa Noi ' || v_suffix;

  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'expected Khoa Noi count 1, got %', v_count;
  END IF;

  SELECT count
  INTO v_count
  FROM public.equipment_department_distribution(
    p_q => 'Bom tiem dien ' || v_suffix,
    p_don_vi => v_tenant
  )
  WHERE department IS NULL
    AND label = 'Chưa cập nhật';

  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'expected missing department count 1, got %', v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.equipment_department_distribution(
    p_q => 'Bom tiem dien ' || v_suffix,
    p_don_vi => v_tenant,
    p_khoa_phong_array => ARRAY['Khoa Ngoai ' || v_suffix]
  );

  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'department filter should return one distribution bucket, got %', v_count;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'user',
      'user_id', '900002',
      'don_vi', v_tenant,
      'khoa_phong', 'Khoa Ngoai ' || v_suffix
    )::text,
    true
  );

  SELECT count(*)
  INTO v_count
  FROM public.equipment_department_distribution(
    p_q => 'Bom tiem dien ' || v_suffix,
    p_don_vi => v_tenant
  );

  IF v_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'role=user should see one department bucket, got %', v_count;
  END IF;

  RAISE NOTICE 'equipment_department_distribution smoke: PASSED';
END;
$$;

ROLLBACK;
