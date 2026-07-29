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

DO $$
DECLARE
  v_tenant_id bigint;
  v_user_id bigint := 3383002;
  v_payload jsonb;
  v_codes text[];
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
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      NULL
    ),
    (
      'ELE-LIQ-2',
      'Status only Y',
      v_tenant_id,
      'Khoa A',
      'Ngưng sử dụng',
      '2026-07-28'
    ),
    (
      'ELE-LIQ-3',
      'Warehouse only X',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
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
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      ''
    ),
    (
      'ELE-LIQ-6',
      'Liquidation old A',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      '2024-01-15'
    ),
    (
      'ELE-LIQ-7',
      'Liquidation same Z',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      '2025-06-20'
    ),
    (
      'ELE-LIQ-8',
      'Liquidation same M',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      '2025-06-20'
    ),
    (
      'ELE-LIQ-9',
      'Liquidation same M',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      '2025-06-20'
    ),
    (
      'ELE-LIQ-10',
      'Liquidation newest Z',
      v_tenant_id,
      'VT-TBYT- KHO THANH LÍ',
      'Ngưng sử dụng',
      '2026-07-29'
    );

  PERFORM pg_temp._ele_liquidation_set_claims('to_qltb', v_user_id, v_tenant_id);

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 10,
    p_don_vi => v_tenant_id,
    p_liquidation_last => false
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
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
  ]::text[] THEN
    RAISE EXCEPTION 'Flag false failed: expected ID order, got %', v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 10,
    p_don_vi => v_tenant_id,
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
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
  ]::text[] THEN
    RAISE EXCEPTION
      'Flag true chronology failed: expected null/blank, old, same-day, newest order, got %',
      v_codes;
  END IF;

  IF (v_payload->>'total')::integer <> 10 THEN
    RAISE EXCEPTION 'Expected unchanged total 10, got %', v_payload->>'total';
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 10,
    p_don_vi => v_tenant_id,
    p_khoa_phong => 'VT-TBYT- KHO THANH LÍ',
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
    'ELE-LIQ-3',
    'ELE-LIQ-1',
    'ELE-LIQ-5',
    'ELE-LIQ-6',
    'ELE-LIQ-7',
    'ELE-LIQ-8',
    'ELE-LIQ-9',
    'ELE-LIQ-10'
  ]::text[] THEN
    RAISE EXCEPTION
      'Warehouse filter chronology failed: expected newest liquidation row last, got %',
      v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'ten_thiet_bi.desc',
    p_page => 1,
    p_page_size => 10,
    p_don_vi => v_tenant_id,
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
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
  ]::text[] THEN
    RAISE EXCEPTION
      'Custom sort failed: expected chronology, requested sort, then ID tie-break, got %',
      v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 5,
    p_don_vi => v_tenant_id,
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
    'ELE-LIQ-2',
    'ELE-LIQ-3',
    'ELE-LIQ-4',
    'ELE-LIQ-1',
    'ELE-LIQ-5'
  ]::text[] THEN
    RAISE EXCEPTION
      'Unfiltered page 1 failed: expected normal rows then legacy liquidation rows, got %',
      v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 2,
    p_page_size => 5,
    p_don_vi => v_tenant_id,
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
    'ELE-LIQ-6',
    'ELE-LIQ-7',
    'ELE-LIQ-8',
    'ELE-LIQ-9',
    'ELE-LIQ-10'
  ]::text[] THEN
    RAISE EXCEPTION
      'Unfiltered page 2 failed: expected dated chronology with newest last, got %',
      v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 4,
    p_don_vi => v_tenant_id,
    p_khoa_phong => 'VT-TBYT- KHO THANH LÍ',
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
    'ELE-LIQ-3',
    'ELE-LIQ-1',
    'ELE-LIQ-5',
    'ELE-LIQ-6'
  ]::text[] THEN
    RAISE EXCEPTION
      'Warehouse page 1 failed: expected grouping before filtered pagination, got %',
      v_codes;
  END IF;

  v_payload := public.equipment_list_enhanced(
    p_sort => 'id.asc',
    p_page => 2,
    p_page_size => 4,
    p_don_vi => v_tenant_id,
    p_khoa_phong => 'VT-TBYT- KHO THANH LÍ',
    p_liquidation_last => true
  );

  SELECT array_agg(row_value->>'ma_thiet_bi' ORDER BY ordinal_position)
  INTO v_codes
  FROM jsonb_array_elements(v_payload->'data')
    WITH ORDINALITY AS rows(row_value, ordinal_position);

  IF v_codes IS DISTINCT FROM ARRAY[
    'ELE-LIQ-7',
    'ELE-LIQ-8',
    'ELE-LIQ-9',
    'ELE-LIQ-10'
  ]::text[] THEN
    RAISE EXCEPTION
      'Warehouse page 2 failed: expected same-day cohort then newest row, got %',
      v_codes;
  END IF;

  RAISE NOTICE 'equipment_list_enhanced_liquidation_order smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
