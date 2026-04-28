-- supabase/tests/repair_request_read_scope_smoke.sql
-- Purpose: lock tenant + role=user department scope across repair_request_get,
-- repair_request_list, and repair_request_active_for_equipment for Issue #342.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rrrs_set_claims(
  p_app_role text DEFAULT NULL,
  p_user_id bigint DEFAULT NULL,
  p_don_vi bigint DEFAULT NULL,
  p_khoa_phong text DEFAULT NULL,
  p_include_role_claim boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_claims jsonb := '{}'::jsonb;
BEGIN
  IF p_app_role IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('app_role', p_app_role);
  END IF;

  IF p_include_role_claim THEN
    v_claims := v_claims || jsonb_build_object('role', coalesce(p_app_role, 'authenticated'));
  END IF;

  IF p_user_id IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object(
      'user_id', p_user_id::text,
      'sub', p_user_id::text
    );
  END IF;

  IF p_don_vi IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('don_vi', p_don_vi::text);
  END IF;

  IF p_khoa_phong IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('khoa_phong', p_khoa_phong);
  END IF;

  PERFORM set_config('request.jwt.claims', v_claims::text, true);
END;
$$;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant_a bigint;
  v_tenant_b bigint;
  v_user_id bigint := 990342;
  v_eq_allowed bigint;
  v_eq_blocked bigint;
  v_eq_other_tenant bigint;
  v_req_allowed bigint;
  v_req_blocked bigint;
  v_req_other_tenant bigint;
  v_payload jsonb;
  v_row jsonb;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Issue 342 tenant A ' || v_suffix, true)
  RETURNING id INTO v_tenant_a;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Issue 342 tenant B ' || v_suffix, true)
  RETURNING id INTO v_tenant_b;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'RRS-ALLOW-' || v_suffix,
    'Repair request allowed ' || v_suffix,
    v_tenant_a,
    '  Nội thận - Tiết niệu  ',
    'Chờ sửa chữa',
    false
  )
  RETURNING id INTO v_eq_allowed;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'RRS-BLOCK-' || v_suffix,
    'Repair request blocked ' || v_suffix,
    v_tenant_a,
    'Khoa Ngoại Tổng Hợp',
    'Chờ sửa chữa',
    false
  )
  RETURNING id INTO v_eq_blocked;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'RRS-OTHER-' || v_suffix,
    'Repair request other tenant ' || v_suffix,
    v_tenant_b,
    'Khoa Nội Tổng Hợp',
    'Chờ sửa chữa',
    false
  )
  RETURNING id INTO v_eq_other_tenant;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    ngay_yeu_cau,
    trang_thai,
    mo_ta_su_co
  )
  VALUES (
    v_eq_allowed,
    now() - interval '1 day',
    'Chờ xử lý',
    'Issue 342 allowed ' || v_suffix
  )
  RETURNING id INTO v_req_allowed;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    ngay_yeu_cau,
    trang_thai,
    mo_ta_su_co
  )
  VALUES (
    v_eq_blocked,
    now() - interval '2 day',
    'Chờ xử lý',
    'Issue 342 blocked ' || v_suffix
  )
  RETURNING id INTO v_req_blocked;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    ngay_yeu_cau,
    trang_thai,
    mo_ta_su_co
  )
  VALUES (
    v_eq_other_tenant,
    now() - interval '3 day',
    'Chờ xử lý',
    'Issue 342 other tenant ' || v_suffix
  )
  RETURNING id INTO v_req_other_tenant;

  ---------------------------------------------------------------------------
  -- Scenario 1: role=user same tenant + normalized same department succeeds
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => 'user',
    p_user_id => v_user_id,
    p_don_vi => v_tenant_a,
    p_khoa_phong => ' ' || chr(160) || E'NỘI\nTHẬN\t  - TIẾT   NIỆU '
  );

  v_row := public.repair_request_get(v_req_allowed::int);
  IF (v_row->>'id')::bigint IS DISTINCT FROM v_req_allowed THEN
    RAISE EXCEPTION 'Scenario 1 failed: repair_request_get did not return the allowed row';
  END IF;

  v_payload := public.repair_request_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_a
  );
  IF COALESCE((v_payload->>'total')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'Scenario 1 failed: repair_request_list total should be 1, got %', v_payload->>'total';
  END IF;
  IF COALESCE(jsonb_array_length(v_payload->'data'), 0) <> 1 THEN
    RAISE EXCEPTION 'Scenario 1 failed: repair_request_list row count should be 1, got %', COALESCE(jsonb_array_length(v_payload->'data'), 0);
  END IF;
  IF ((v_payload->'data'->0->>'id')::bigint) IS DISTINCT FROM v_req_allowed THEN
    RAISE EXCEPTION 'Scenario 1 failed: repair_request_list returned wrong row';
  END IF;

  v_payload := public.repair_request_active_for_equipment(v_eq_allowed::int);
  IF (v_payload->>'active_count')::int <> 1 THEN
    RAISE EXCEPTION 'Scenario 1 failed: active_count should be 1, got %', v_payload;
  END IF;
  IF ((v_payload->'request')->>'id')::bigint IS DISTINCT FROM v_req_allowed THEN
    RAISE EXCEPTION 'Scenario 1 failed: active request row mismatch';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 2: role=user same tenant + different department is fail-closed
  ---------------------------------------------------------------------------
  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.repair_request_get(v_req_blocked::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Scenario 2 failed: repair_request_get should deny cross-department access with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  v_payload := public.repair_request_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_a
  );
  IF COALESCE((v_payload->>'total')::int, 0) <> 1 THEN
    RAISE EXCEPTION 'Scenario 2 failed: list should still only expose the allowed row, got %', v_payload;
  END IF;

  v_payload := public.repair_request_active_for_equipment(v_eq_blocked::int);
  IF (v_payload->>'active_count')::int <> 0 OR v_payload->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 2 failed: cross-department active lookup should be empty, got %', v_payload;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 3: role=user different tenant is fail-closed
  ---------------------------------------------------------------------------
  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.repair_request_get(v_req_other_tenant::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Scenario 3 failed: repair_request_get should deny cross-tenant access with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  v_payload := public.repair_request_list(
    p_q => 'other tenant ' || v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_a
  );
  IF COALESCE((v_payload->>'total')::int, 0) <> 0 OR COALESCE(jsonb_array_length(v_payload->'data'), 0) <> 0 THEN
    RAISE EXCEPTION 'Scenario 3 failed: cross-tenant list should be empty, got %', v_payload;
  END IF;

  v_payload := public.repair_request_active_for_equipment(v_eq_other_tenant::int);
  IF (v_payload->>'active_count')::int <> 0 OR v_payload->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 3 failed: cross-tenant active lookup should be empty, got %', v_payload;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 4: role=user with missing khoa_phong claim is fail-closed
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => 'user',
    p_user_id => v_user_id,
    p_don_vi => v_tenant_a,
    p_khoa_phong => NULL
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.repair_request_get(v_req_allowed::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Scenario 4 failed: repair_request_get should deny missing-department role user with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  v_payload := public.repair_request_list(
    p_q => v_suffix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_a
  );
  IF COALESCE((v_payload->>'total')::int, 0) <> 0 OR COALESCE(jsonb_array_length(v_payload->'data'), 0) <> 0 THEN
    RAISE EXCEPTION 'Scenario 4 failed: missing-department list should be empty, got %', v_payload;
  END IF;

  v_payload := public.repair_request_active_for_equipment(v_eq_allowed::int);
  IF (v_payload->>'active_count')::int <> 0 OR v_payload->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 4 failed: missing-department active lookup should be empty, got %', v_payload;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 5: non-user tenant role keeps same-tenant cross-department access
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => 'to_qltb',
    p_user_id => v_user_id,
    p_don_vi => v_tenant_a
  );

  v_row := public.repair_request_get(v_req_blocked::int);
  IF (v_row->>'id')::bigint IS DISTINCT FROM v_req_blocked THEN
    RAISE EXCEPTION 'Scenario 5 failed: to_qltb should still read same-tenant cross-department row';
  END IF;

  v_payload := public.repair_request_active_for_equipment(v_eq_blocked::int);
  IF (v_payload->>'active_count')::int <> 1 THEN
    RAISE EXCEPTION 'Scenario 5 failed: to_qltb active lookup should remain visible, got %', v_payload;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 6: global can still read across tenants
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => 'global',
    p_user_id => v_user_id
  );

  v_row := public.repair_request_get(v_req_other_tenant::int);
  IF (v_row->>'id')::bigint IS DISTINCT FROM v_req_other_tenant THEN
    RAISE EXCEPTION 'Scenario 6 failed: global should still read cross-tenant row';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 7: missing role claim raises 42501 across the family
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => NULL,
    p_user_id => v_user_id,
    p_don_vi => v_tenant_a,
    p_khoa_phong => 'Nội thận',
    p_include_role_claim => false
  );

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_get(v_req_allowed::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 7 failed: repair_request_get should reject missing role claim';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_list(
      p_q => v_suffix,
      p_page => 1,
      p_page_size => 50,
      p_don_vi => v_tenant_a
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 7 failed: repair_request_list should reject missing role claim';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_active_for_equipment(v_eq_allowed::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 7 failed: repair_request_active_for_equipment should reject missing role claim';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 8: missing user_id claim raises 42501 across the family
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrrs_set_claims(
    p_app_role => 'to_qltb',
    p_user_id => NULL,
    p_don_vi => v_tenant_a
  );

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_get(v_req_allowed::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 8 failed: repair_request_get should reject missing user_id claim';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_list(
      p_q => v_suffix,
      p_page => 1,
      p_page_size => 50,
      p_don_vi => v_tenant_a
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 8 failed: repair_request_list should reject missing user_id claim';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_active_for_equipment(v_eq_allowed::int);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLSTATE = '42501';
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Scenario 8 failed: repair_request_active_for_equipment should reject missing user_id claim';
  END IF;

  RAISE NOTICE 'repair_request_read_scope_smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
