-- supabase/tests/equipment_filter_buckets_smoke.sql
-- Purpose: smoke-test cascading equipment_filter_buckets after the migration is applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_payload jsonb;
  v_count integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Filter Buckets Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Filter Buckets Other Tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    model,
    serial,
    so_luu_hanh,
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
      'SMK-BUCKET-A-' || v_suffix,
      'Smoke Cascade Alpha ' || v_suffix,
      'Model Alpha ' || v_suffix,
      'Serial Alpha ' || v_suffix,
      'Reg Alpha ' || v_suffix,
      v_tenant,
      'Khoa ICU ' || v_suffix,
      'Hoat dong',
      'User A ' || v_suffix,
      'Room A ' || v_suffix,
      'Class A ' || v_suffix,
      'Fund A ' || v_suffix,
      false
    ),
    (
      'SMK-BUCKET-B-' || v_suffix,
      'Smoke Cascade Beta ' || v_suffix,
      'Model Beta ' || v_suffix,
      'Serial Beta ' || v_suffix,
      'Reg Beta ' || v_suffix,
      v_tenant,
      'Khoa ICU ' || v_suffix,
      'Bao tri',
      'User B ' || v_suffix,
      'Room B ' || v_suffix,
      'Class B ' || v_suffix,
      'Fund B ' || v_suffix,
      false
    ),
    (
      'SMK-BUCKET-C-' || v_suffix,
      'Smoke Cascade Alpha Other Dept ' || v_suffix,
      'Model Gamma ' || v_suffix,
      'Serial Gamma ' || v_suffix,
      'Reg Gamma ' || v_suffix,
      v_tenant,
      'Khoa Surgery ' || v_suffix,
      'Hoat dong',
      'User C ' || v_suffix,
      'Room C ' || v_suffix,
      'Class C ' || v_suffix,
      'Fund C ' || v_suffix,
      false
    ),
    (
      'SMK-BUCKET-D-' || v_suffix,
      'Smoke Cascade Delta ' || v_suffix,
      'Model Delta ' || v_suffix,
      'Serial Delta ' || v_suffix,
      'Reg Delta ' || v_suffix,
      v_tenant,
      'Khoa Surgery ' || v_suffix,
      'Bao tri',
      'User D ' || v_suffix,
      'Room D ' || v_suffix,
      'Class D ' || v_suffix,
      'Fund D ' || v_suffix,
      false
    ),
    (
      'SMK-BUCKET-DELETED-' || v_suffix,
      'Smoke Cascade Deleted ' || v_suffix,
      'Model Deleted ' || v_suffix,
      'Serial Deleted ' || v_suffix,
      'Reg Deleted ' || v_suffix,
      v_tenant,
      'Khoa Deleted ' || v_suffix,
      'Hoat dong',
      'User Deleted ' || v_suffix,
      'Room Deleted ' || v_suffix,
      'Class Deleted ' || v_suffix,
      'Fund Deleted ' || v_suffix,
      true
    ),
    (
      'SMK-BUCKET-OTHER-' || v_suffix,
      'Smoke Cascade Other Tenant ' || v_suffix,
      'Model Other ' || v_suffix,
      'Serial Other ' || v_suffix,
      'Reg Other ' || v_suffix,
      v_other_tenant,
      'Khoa Other Tenant ' || v_suffix,
      'Hoat dong',
      'User Other Tenant ' || v_suffix,
      'Room Other Tenant ' || v_suffix,
      'Class Other Tenant ' || v_suffix,
      'Fund Other Tenant ' || v_suffix,
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

  v_payload := public.equipment_filter_buckets(
    p_don_vi => v_tenant,
    p_tinh_trang_array => ARRAY['Hoat dong']
  );

  IF jsonb_typeof(v_payload->'department') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'equipment_filter_buckets.department must be an array: %', v_payload;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM jsonb_array_elements(v_payload->'department') entry
  WHERE entry->>'name' IN ('Khoa ICU ' || v_suffix, 'Khoa Surgery ' || v_suffix)
    AND (entry->>'count')::integer = 1;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'status filter should narrow department buckets across full tenant scope: %', v_payload;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'department') entry
    WHERE entry->>'name' IN ('Khoa Deleted ' || v_suffix, 'Khoa Other Tenant ' || v_suffix)
  ) THEN
    RAISE EXCEPTION 'equipment_filter_buckets leaked deleted or cross-tenant department bucket: %', v_payload;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'status') entry
    WHERE entry->>'name' = 'Hoat dong'
      AND (entry->>'count')::integer = 2
  ) OR NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'status') entry
    WHERE entry->>'name' = 'Bao tri'
      AND (entry->>'count')::integer = 2
  ) THEN
    RAISE EXCEPTION 'status bucket should exclude its own selected status filter: %', v_payload;
  END IF;

  v_payload := public.equipment_filter_buckets(
    p_don_vi => v_tenant,
    p_khoa_phong_array => ARRAY['Khoa ICU ' || v_suffix],
    p_tinh_trang_array => ARRAY['Hoat dong']
  );

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'status') entry
    WHERE entry->>'name' = 'Bao tri'
      AND (entry->>'count')::integer = 1
  ) THEN
    RAISE EXCEPTION 'status bucket should keep same-department unselected statuses visible: %', v_payload;
  END IF;

  v_payload := public.equipment_filter_buckets(
    p_q => 'Smoke Cascade Alpha',
    p_don_vi => v_tenant
  );

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'status') entry
    WHERE entry->>'name' = 'Hoat dong'
      AND (entry->>'count')::integer = 2
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'status') entry
    WHERE entry->>'name' = 'Bao tri'
  ) THEN
    RAISE EXCEPTION 'search text should narrow every bucket to matching server rows: %', v_payload;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '900002',
      'don_vi', v_tenant,
      'khoa_phong', 'Khoa ICU ' || v_suffix
    )::text,
    true
  );

  v_payload := public.equipment_filter_buckets(
    p_don_vi => v_tenant,
    p_khoa_phong_array => ARRAY['Khoa Surgery ' || v_suffix],
    p_tinh_trang_array => ARRAY['Hoat dong']
  );

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'department') entry
    WHERE entry->>'name' = 'Khoa ICU ' || v_suffix
      AND (entry->>'count')::integer = 1
  ) THEN
    RAISE EXCEPTION 'role=user department bucket must keep JWT department scope even when own filter is excluded: %', v_payload;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'department') entry
    WHERE entry->>'name' = 'Khoa Surgery ' || v_suffix
  ) THEN
    RAISE EXCEPTION 'role=user department bucket leaked cross-department data: %', v_payload;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '900003',
      'don_vi', v_tenant,
      'khoa_phong', ' '
    )::text,
    true
  );

  v_payload := public.equipment_filter_buckets(p_don_vi => v_tenant);

  IF COALESCE(jsonb_array_length(v_payload->'department'), 0) <> 0
     OR COALESCE(jsonb_array_length(v_payload->'status'), 0) <> 0 THEN
    RAISE EXCEPTION 'role=user with blank khoa_phong must fail closed to empty buckets: %', v_payload;
  END IF;

  RAISE NOTICE 'equipment_filter_buckets smoke: PASSED';
END;
$$;

ROLLBACK;
