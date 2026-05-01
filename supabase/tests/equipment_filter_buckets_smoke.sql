-- supabase/tests/equipment_filter_buckets_smoke.sql
-- Purpose: smoke-test equipment_filter_buckets after the migration is applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_payload jsonb;
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
      'SMK-BUCKET-ALLOW-' || v_suffix,
      'Smoke Bucket Allowed ' || v_suffix,
      v_tenant,
      'Khoa Bucket ' || v_suffix,
      'Hoat dong',
      'User Bucket ' || v_suffix,
      'Room Bucket ' || v_suffix,
      'Class Bucket ' || v_suffix,
      'Fund Bucket ' || v_suffix,
      false
    ),
    (
      'SMK-BUCKET-OTHER-' || v_suffix,
      'Smoke Bucket Other ' || v_suffix,
      v_other_tenant,
      'Khoa Other ' || v_suffix,
      'Hoat dong',
      'User Other ' || v_suffix,
      'Room Other ' || v_suffix,
      'Class Other ' || v_suffix,
      'Fund Other ' || v_suffix,
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

  v_payload := public.equipment_filter_buckets(v_tenant);

  IF jsonb_typeof(v_payload->'department') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'equipment_filter_buckets.department must be an array: %', v_payload;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'department') entry
    WHERE entry->>'name' = 'Khoa Bucket ' || v_suffix
      AND (entry->>'count')::integer = 1
  ) THEN
    RAISE EXCEPTION 'equipment_filter_buckets missing scoped department bucket: %', v_payload;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'department') entry
    WHERE entry->>'name' = 'Khoa Other ' || v_suffix
  ) THEN
    RAISE EXCEPTION 'equipment_filter_buckets leaked cross-tenant department bucket: %', v_payload;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'fundingSource') entry
    WHERE entry->>'name' = 'Fund Bucket ' || v_suffix
      AND (entry->>'count')::integer = 1
  ) THEN
    RAISE EXCEPTION 'equipment_filter_buckets missing fundingSource bucket: %', v_payload;
  END IF;

  RAISE NOTICE 'equipment_filter_buckets smoke: PASSED';
END;
$$;

ROLLBACK;
