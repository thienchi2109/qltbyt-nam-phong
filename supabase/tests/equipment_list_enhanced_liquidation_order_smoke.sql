-- Purpose: smoke-test liquidation chronology across filters, sorts, and pagination.
-- Non-destructive: wrapped in a transaction and rolled back.
-- Run only after the superseding chronology migration has been applied.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._ele_liquidation_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_role,
      'role', p_role,
      'user_id', p_user_id::text,
      'don_vi', p_don_vi::text,
      'khoa_phong', ''
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp._ele_liquidation_assert_codes(
  p_scenario text,
  p_expected text[],
  p_sort text,
  p_page integer,
  p_page_size integer,
  p_don_vi bigint,
  p_khoa_phong text,
  p_liquidation_last boolean
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload jsonb;
  v_codes text[];
BEGIN
  v_payload := public.equipment_list_enhanced(
    p_sort => p_sort,
    p_page => p_page,
    p_page_size => p_page_size,
    p_don_vi => p_don_vi,
    p_khoa_phong => p_khoa_phong,
    p_liquidation_last => p_liquidation_last
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '% failed: expected %, got %', p_scenario, p_expected, v_codes;
  END IF;

  RETURN v_payload;
END;
$$;

DO $$
DECLARE
  v_tenant_id bigint;
  v_user_id bigint := 3383002;
  v_payload jsonb;
  v_liquidation_department CONSTANT text := 'VT-TBYT- KHO THANH LÍ';
  v_liquidation_status CONSTANT text := 'Ngưng sử dụng';
  v_same_date CONSTANT text := '2025-06-20';
  v_id_sort CONSTANT text := 'id.asc';
BEGIN
  INSERT INTO public.don_vi(name)
  VALUES ('Tenant equipment liquidation order smoke')
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    ngay_ngung_su_dung
  )
  VALUES
    (
      'ELE-LIQ-1',
      'Liquidation null Z',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      NULL
    ),
    (
      'ELE-LIQ-2',
      'Status only Y',
      v_tenant_id,
      'Khoa A',
      v_liquidation_status,
      '2026-07-28'
    ),
    (
      'ELE-LIQ-3',
      'Warehouse only X',
      v_tenant_id,
      v_liquidation_department,
      'Hoạt động',
      NULL
    ),
    (
      'ELE-LIQ-4',
      'Normal W',
      v_tenant_id,
      'Khoa B',
      'Hoạt động',
      NULL
    ),
    (
      'ELE-LIQ-5',
      'Liquidation blank Y',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      ''
    ),
    (
      'ELE-LIQ-6',
      'Liquidation old A',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      '2024-01-15'
    ),
    (
      'ELE-LIQ-7',
      'Liquidation same Z',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      v_same_date
    ),
    (
      'ELE-LIQ-8',
      'Liquidation same M',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      v_same_date
    ),
    (
      'ELE-LIQ-9',
      'Liquidation same M',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      v_same_date
    ),
    (
      'ELE-LIQ-10',
      'Liquidation newest Z',
      v_tenant_id,
      v_liquidation_department,
      v_liquidation_status,
      '2026-07-29'
    );

  PERFORM pg_temp._ele_liquidation_set_claims('to_qltb', v_user_id, v_tenant_id);

  v_payload := pg_temp._ele_liquidation_assert_codes(
    'Flag false ID order',
    ARRAY[
      'ELE-LIQ-1',
      'ELE-LIQ-2',
      'ELE-LIQ-3',
      'ELE-LIQ-4',
      'ELE-LIQ-5',
      'ELE-LIQ-6',
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    v_id_sort,
    1,
    10,
    v_tenant_id,
    NULL,
    false
  );

  v_payload := pg_temp._ele_liquidation_assert_codes(
    'Flag true chronology',
    ARRAY[
      'ELE-LIQ-2',
      'ELE-LIQ-3',
      'ELE-LIQ-4',
      'ELE-LIQ-1',
      'ELE-LIQ-5',
      'ELE-LIQ-6',
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    v_id_sort,
    1,
    10,
    v_tenant_id,
    NULL,
    true
  );

  IF (v_payload->>'total')::integer <> 10 THEN
    RAISE EXCEPTION 'Expected unchanged total 10, got %', v_payload->>'total';
  END IF;

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Warehouse filter chronology',
    ARRAY[
      'ELE-LIQ-3',
      'ELE-LIQ-1',
      'ELE-LIQ-5',
      'ELE-LIQ-6',
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    v_id_sort,
    1,
    10,
    v_tenant_id,
    v_liquidation_department,
    true
  );

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Custom sort chronology and ID tie-break',
    ARRAY[
      'ELE-LIQ-3',
      'ELE-LIQ-2',
      'ELE-LIQ-4',
      'ELE-LIQ-1',
      'ELE-LIQ-5',
      'ELE-LIQ-6',
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    'ten_thiet_bi.desc',
    1,
    10,
    v_tenant_id,
    NULL,
    true
  );

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Unfiltered page 1',
    ARRAY[
      'ELE-LIQ-2',
      'ELE-LIQ-3',
      'ELE-LIQ-4',
      'ELE-LIQ-1',
      'ELE-LIQ-5'
    ]::text[],
    v_id_sort,
    1,
    5,
    v_tenant_id,
    NULL,
    true
  );

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Unfiltered page 2',
    ARRAY[
      'ELE-LIQ-6',
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    v_id_sort,
    2,
    5,
    v_tenant_id,
    NULL,
    true
  );

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Warehouse page 1',
    ARRAY[
      'ELE-LIQ-3',
      'ELE-LIQ-1',
      'ELE-LIQ-5',
      'ELE-LIQ-6'
    ]::text[],
    v_id_sort,
    1,
    4,
    v_tenant_id,
    v_liquidation_department,
    true
  );

  PERFORM pg_temp._ele_liquidation_assert_codes(
    'Warehouse page 2',
    ARRAY[
      'ELE-LIQ-7',
      'ELE-LIQ-8',
      'ELE-LIQ-9',
      'ELE-LIQ-10'
    ]::text[],
    v_id_sort,
    2,
    4,
    v_tenant_id,
    v_liquidation_department,
    true
  );

  RAISE NOTICE 'equipment_list_enhanced_liquidation_order smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
