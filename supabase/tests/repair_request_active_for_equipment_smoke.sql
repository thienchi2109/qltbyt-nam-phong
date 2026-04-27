-- supabase/tests/repair_request_active_for_equipment_smoke.sql
-- Purpose: smoke-test repair_request_active_for_equipment after the migration is applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rrafe_set_claims(
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
  v_user_id bigint := 999001;
  v_eq_a_active1 bigint;
  v_eq_a_active2 bigint;
  v_eq_a_completed_only bigint;
  v_eq_a_soft_deleted bigint;
  v_eq_b bigint;
  v_req_a1_pending bigint;
  v_req_a1_approved bigint;
  v_req_b_active bigint;
  v_result jsonb;
  v_req_id_first bigint;
  v_req_id_second bigint;
BEGIN
  INSERT INTO public.don_vi(name) VALUES ('Tenant A RRAFE smoke') RETURNING id INTO v_tenant_a;
  INSERT INTO public.don_vi(name) VALUES ('Tenant B RRAFE smoke') RETURNING id INTO v_tenant_b;

  -- equipment fixtures
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A1', 'eq A active1', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_a_active1;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A2', 'eq A active2', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_a_active2;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-A3', 'eq A completed-only', v_tenant_a, 'Khoa A1', 'Hoạt động') RETURNING id INTO v_eq_a_completed_only;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES ('RRAFE-A4', 'eq A soft-deleted', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa', true) RETURNING id INTO v_eq_a_soft_deleted;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
  VALUES ('RRAFE-B1', 'eq B', v_tenant_b, 'Khoa B1', 'Chờ sửa chữa') RETURNING id INTO v_eq_b;

  -- requests on eq_a_active1: 1 'Chờ xử lý' (older) + 1 'Đã duyệt' (newer)
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_a_active1, now() - interval '5 days', 'Chờ xử lý', 'Pending older')
  RETURNING id INTO v_req_a1_pending;

  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
  VALUES (v_eq_a_active1, now() - interval '4 days', 'Đã duyệt', 'Approved newer', now() - interval '1 day')
  RETURNING id INTO v_req_a1_approved;

  -- requests on eq_a_active2: only completed history
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_hoan_thanh)
  VALUES (v_eq_a_active2, now() - interval '10 days', 'Hoàn thành', 'Old completed', now() - interval '5 days');

  -- requests on eq_a_soft_deleted: 1 active (should still be filtered out by soft-delete guard)
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_a_soft_deleted, now() - interval '1 day', 'Chờ xử lý', 'Active on soft-deleted equipment');

  -- requests on eq_b: 1 active in tenant B
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co)
  VALUES (v_eq_b, now() - interval '2 days', 'Chờ xử lý', 'Tenant B active')
  RETURNING id INTO v_req_b_active;

  ---------------------------------------------------------------------------
  -- Scenario 1: same-tenant user, equipment with only completed history → 0
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_result := public.repair_request_active_for_equipment(v_eq_a_active2::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 1 failed (completed-only): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 2: same-tenant user, soft-deleted equipment → 0
  ---------------------------------------------------------------------------
  v_result := public.repair_request_active_for_equipment(v_eq_a_soft_deleted::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 2 failed (soft-deleted): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 3: same-tenant user, multi-active → count=2, returns most-recent (approved)
  ---------------------------------------------------------------------------
  v_result := public.repair_request_active_for_equipment(v_eq_a_active1::int);
  IF (v_result->>'active_count')::int <> 2 THEN
    RAISE EXCEPTION 'Scenario 3 count mismatch: %', v_result;
  END IF;
  IF ((v_result->'request')->>'id')::bigint <> v_req_a1_approved THEN
    RAISE EXCEPTION 'Scenario 3 tie-break wrong: returned %, expected %', v_result, v_req_a1_approved;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 4: cross-tenant user → 0
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
  v_result := public.repair_request_active_for_equipment(v_eq_b::int);
  IF (v_result->>'active_count')::int <> 0 OR v_result->'request' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Scenario 4 failed (cross-tenant): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 5: global role can see across tenants
  ---------------------------------------------------------------------------
  PERFORM pg_temp._rrafe_set_claims('global', v_user_id);
  v_result := public.repair_request_active_for_equipment(v_eq_b::int);
  IF (v_result->>'active_count')::int <> 1 THEN
    RAISE EXCEPTION 'Scenario 5 failed (global): %', v_result;
  END IF;

  ---------------------------------------------------------------------------
  -- Scenario 6: identical ngay_duyet ⇒ falls back to id DESC deterministically
  ---------------------------------------------------------------------------
  -- Force two rows with identical ngay_duyet on a fresh equipment.
  DECLARE
    v_eq_tie bigint;
    v_first bigint;
    v_second bigint;
  BEGIN
    INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai)
    VALUES ('RRAFE-A5', 'eq A tie-break', v_tenant_a, 'Khoa A1', 'Chờ sửa chữa') RETURNING id INTO v_eq_tie;
    INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
    VALUES (v_eq_tie, now(), 'Đã duyệt', 'Tie 1', now()) RETURNING id INTO v_first;
    INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id, ngay_yeu_cau, trang_thai, mo_ta_su_co, ngay_duyet)
    VALUES (v_eq_tie, now(), 'Đã duyệt', 'Tie 2', (SELECT ngay_duyet FROM public.yeu_cau_sua_chua WHERE id = v_first))
    RETURNING id INTO v_second;

    PERFORM pg_temp._rrafe_set_claims('to_qltb', v_user_id, v_tenant_a);
    v_result := public.repair_request_active_for_equipment(v_eq_tie::int);
    IF (v_result->>'active_count')::int <> 2 THEN
      RAISE EXCEPTION 'Scenario 6 count mismatch: %', v_result;
    END IF;
    IF ((v_result->'request')->>'id')::bigint <> greatest(v_first, v_second) THEN
      RAISE EXCEPTION 'Scenario 6 id-desc tie-break wrong: %', v_result;
    END IF;
  END;

  RAISE NOTICE 'repair_request_active_for_equipment smoke: ALL SCENARIOS PASSED';
END;
$$;

ROLLBACK;
