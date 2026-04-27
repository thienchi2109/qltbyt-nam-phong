-- supabase/tests/equipment_list_enhanced_active_repair_smoke.sql
-- Purpose: smoke-test equipment_list_enhanced active_repair_request_id after migration.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._ele_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint DEFAULT NULL,
  p_khoa_phong text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::text,
      'sub', p_user_id::text,
      'don_vi', p_don_vi::text,
      'khoa_phong', p_khoa_phong
    )::text,
    true
  );
END;
$$;

DO $$
DECLARE
  v_tenant_a bigint;
  v_tenant_b bigint;
  v_user_id bigint := 999002;
  v_eq_active bigint;
  v_eq_no_active bigint;
  v_eq_multi bigint;
  v_eq_soft_deleted bigint;
  v_eq_b bigint;
  v_req_active bigint;
  v_req_approved bigint;
  v_req_old_completed bigint;
  v_req_b_active bigint;
  v_result jsonb;
  v_row jsonb;
BEGIN
  INSERT INTO public.don_vi(name) VALUES ('Tenant A ELE smoke') RETURNING id INTO v_tenant_a;
  INSERT INTO public.don_vi(name) VALUES ('Tenant B ELE smoke') RETURNING id INTO v_tenant_b;

  -- Equipment fixtures
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-A1', 'eq active', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_active;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-A2', 'eq no active', v_tenant_a, 'Khoa A1', 'Hoạt động') RETURNING id INTO v_eq_no_active;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-A3', 'eq multi', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_multi;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('ELE-A4', 'eq soft-deleted', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa', true) RETURNING id INTO v_eq_soft_deleted;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-B1', 'eq B', v_tenant_b, 'Khoa B1', 'Chờ sửa chữa') RETURNING id INTO v_eq_b;

  -- Repair request fixtures
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_active, now() - interval '3 days', 'Chờ xử lý', 'Active pending')
  RETURNING id INTO v_req_active;

  -- Multi: older pending + newer approved
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_multi, now() - interval '5 days', 'Chờ xử lý', 'Multi older')
  RETURNING id INTO v_req_old_completed; -- reuse var name

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
  VALUES (v_eq_multi, now() - interval '2 days', 'Đã duyệt', 'Multi newer', now() - interval '1 day')
  RETURNING id INTO v_req_approved;

  -- Non-active status (completed)
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_hoan_thanh)
  VALUES (v_eq_no_active, now() - interval '10 days', 'Hoàn thành', 'Completed only', now() - interval '5 days');

  -- Soft-deleted equipment with active request
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_soft_deleted, now() - interval '1 day', 'Chờ xử lý', 'Active on deleted eq');

  -- Tenant B active request
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_b, now() - interval '2 days', 'Chờ xử lý', 'Tenant B active')
  RETURNING id INTO v_req_b_active;

  ---------------------------------------------------------------------------
  -- Scenario A: equipment with active repair → active_repair_request_id populated
  ---------------------------------------------------------------------------
  PERFORM pg_temp._ele_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_result := public.equipment_list_enhanced(NULL, 'id.asc', 1, 50, v_tenant_a, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-A1';
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario A failed: ELE-A1 not found';
  END IF;
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_active THEN
    RAISE EXCEPTION 'Scenario A failed: expected %, got %', v_req_active, v_row->>'active_repair_request_id';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario B: equipment with no active repair → active_repair_request_id null
  ---------------------------------------------------------------------------
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-A2';
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario B failed: ELE-A2 not found';
  END IF;
  IF v_row->>'active_repair_request_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario B failed: expected null, got %', v_row->>'active_repair_request_id';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario C: multiple active repairs → latest by ngay_yeu_cau DESC, id DESC wins
  ---------------------------------------------------------------------------
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-A3';
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario C failed: ELE-A3 not found';
  END IF;
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_approved THEN
    RAISE EXCEPTION 'Scenario C failed: expected % (newer approved), got %', v_req_approved, v_row->>'active_repair_request_id';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario D: soft-deleted equipment excluded → not in result
  ---------------------------------------------------------------------------
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-A4';
  IF v_row IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario D failed: soft-deleted ELE-A4 should not appear';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario E: cross-tenant user → cannot see tenant B equipment or its active_repair_request_id
  ---------------------------------------------------------------------------
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-B1';
  IF v_row IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario E failed: cross-tenant ELE-B1 should not appear';
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario F: global role can see tenant B and its active_repair_request_id
  ---------------------------------------------------------------------------
  PERFORM pg_temp._ele_set_claims('global', v_user_id);
  v_result := public.equipment_list_enhanced(NULL, 'id.asc', 1, 50, v_tenant_b, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT t INTO v_row FROM jsonb_array_elements(v_result->'data') AS t WHERE t->>'ma_thiet_bi' = 'ELE-B1';
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario F failed: ELE-B1 not found for global';
  END IF;
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_b_active THEN
    RAISE EXCEPTION 'Scenario F failed: expected %, got %', v_req_b_active, v_row->>'active_repair_request_id';
  END IF;

  RAISE NOTICE 'equipment_list_enhanced_active_repair smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
