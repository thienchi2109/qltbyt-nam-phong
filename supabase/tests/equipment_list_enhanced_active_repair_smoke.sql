-- supabase/tests/equipment_list_enhanced_active_repair_smoke.sql
-- Purpose: smoke-test equipment_list_enhanced active_repair_request_id.
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
    jsonb_build_object(
      'app_role', p_role,
      'role', p_role,
      'user_id', p_user_id::text,
      'don_vi', COALESCE(p_don_vi::text, ''),
      'khoa_phong', COALESCE(p_khoa_phong, '')
    )::text,
    true
  );
END;
$$;

DO $$
DECLARE
  v_tenant_a bigint;
  v_tenant_b bigint;
  v_user_id bigint := 3383001;
  v_eq_no_history bigint;
  v_eq_completed_only bigint;
  v_eq_active bigint;
  v_eq_multi bigint;
  v_eq_soft_deleted bigint;
  v_eq_b bigint;
  v_req_active bigint;
  v_req_multi_newer bigint;
  v_req_b_active bigint;
  v_payload jsonb;
  v_row jsonb;
BEGIN
  INSERT INTO public.don_vi(name)
  VALUES ('Tenant A ELE active repair smoke')
  RETURNING id INTO v_tenant_a;

  INSERT INTO public.don_vi(name)
  VALUES ('Tenant B ELE active repair smoke')
  RETURNING id INTO v_tenant_b;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-AR-A1', 'eq no history', v_tenant_a, 'Khoa A1', 'Hoạt động')
  RETURNING id INTO v_eq_no_history;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-AR-A2', 'eq completed only', v_tenant_a, 'Khoa A1', 'Hoạt động')
  RETURNING id INTO v_eq_completed_only;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-AR-A3', 'eq active', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa')
  RETURNING id INTO v_eq_active;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-AR-A4', 'eq multi active', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa')
  RETURNING id INTO v_eq_multi;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('ELE-AR-A5', 'eq soft deleted', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa', true)
  RETURNING id INTO v_eq_soft_deleted;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('ELE-AR-B1', 'eq tenant B active', v_tenant_b, 'Khoa B1', 'Chờ sửa chữa')
  RETURNING id INTO v_eq_b;

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_hoan_thanh)
  VALUES (v_eq_completed_only, now() - interval '5 days', 'Hoàn thành', 'Completed only', now() - interval '4 days');

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_active, now() - interval '3 days', 'Chờ xử lý', 'Single active')
  RETURNING id INTO v_req_active;

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_multi, now() - interval '7 days', 'Chờ xử lý', 'Older active');

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
  VALUES (v_eq_multi, now() - interval '1 day', 'Đã duyệt', 'Newer active', now() - interval '12 hours')
  RETURNING id INTO v_req_multi_newer;

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_soft_deleted, now() - interval '1 day', 'Chờ xử lý', 'Active but equipment soft deleted');

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_b, now() - interval '2 days', 'Chờ xử lý', 'Tenant B active')
  RETURNING id INTO v_req_b_active;

  PERFORM pg_temp._ele_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_payload := public.equipment_list_enhanced(NULL, 'id.asc', 1, 100, v_tenant_a, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

  v_row := (
    SELECT row_value
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-A1'
  );
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario A failed: no-history equipment not found';
  END IF;
  IF v_row->>'active_repair_request_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario A failed: expected null for no-history equipment, got %', v_row->>'active_repair_request_id';
  END IF;

  v_row := (
    SELECT row_value
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-A2'
  );
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Scenario B failed: completed-only equipment not found';
  END IF;
  IF v_row->>'active_repair_request_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Scenario B failed: expected null for completed-only equipment, got %', v_row->>'active_repair_request_id';
  END IF;

  v_row := (
    SELECT row_value
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-A3'
  );
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_active THEN
    RAISE EXCEPTION 'Scenario C failed: expected %, got %', v_req_active, v_row->>'active_repair_request_id';
  END IF;

  v_row := (
    SELECT row_value
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-A4'
  );
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_multi_newer THEN
    RAISE EXCEPTION 'Scenario D failed: expected latest active %, got %', v_req_multi_newer, v_row->>'active_repair_request_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-A5'
  ) THEN
    RAISE EXCEPTION 'Scenario E failed: soft-deleted equipment should be excluded';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-B1'
  ) THEN
    RAISE EXCEPTION 'Scenario F failed: cross-tenant equipment leaked';
  END IF;

  PERFORM pg_temp._ele_set_claims('global', v_user_id);
  v_payload := public.equipment_list_enhanced(NULL, 'id.asc', 1, 100, v_tenant_b, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  v_row := (
    SELECT row_value
    FROM jsonb_array_elements(v_payload->'data') AS row_value
    WHERE row_value->>'ma_thiet_bi' = 'ELE-AR-B1'
  );
  IF (v_row->>'active_repair_request_id')::bigint IS DISTINCT FROM v_req_b_active THEN
    RAISE EXCEPTION 'Scenario G failed: global expected tenant B active %, got %', v_req_b_active, v_row->>'active_repair_request_id';
  END IF;

  RAISE NOTICE 'equipment_list_enhanced_active_repair smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
