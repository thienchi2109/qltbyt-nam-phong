-- supabase/tests/repair_request_status_counts_overdue_summary_smoke.sql
-- Purpose: executable smoke coverage for the enriched
-- public.repair_request_status_counts contract introduced for Issue #384.
-- Run only after the migration is explicitly applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rr_counts_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint DEFAULT NULL,
  p_dia_ban bigint DEFAULT NULL,
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
      'role', p_role,
      'user_id', p_user_id::text,
      'sub', p_user_id::text,
      'don_vi', CASE WHEN p_don_vi IS NULL THEN NULL ELSE p_don_vi::text END,
      'dia_ban', CASE WHEN p_dia_ban IS NULL THEN NULL ELSE p_dia_ban::text END,
      'khoa_phong', p_khoa_phong
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp._rr_assert_eq_int(
  p_label text,
  p_actual integer,
  p_expected integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '%: expected %, got %', p_label, p_expected, p_actual;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp._rr_assert_eq_bigint(
  p_label text,
  p_actual bigint,
  p_expected bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '%: expected %, got %', p_label, p_expected, p_actual;
  END IF;
END;
$$;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

  v_region_1 bigint;
  v_region_2 bigint;
  v_facility_a bigint;
  v_facility_b bigint;
  v_facility_c bigint;

  v_global_user bigint;
  v_regional_user bigint;
  v_tenant_user bigint;
  v_department_user bigint;
  v_departmentless_user bigint;

  v_equipment_a bigint;
  v_equipment_a_other_dept bigint;
  v_equipment_b bigint;
  v_equipment_c bigint;

  v_result jsonb;
BEGIN
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('RR-DB-1-' || v_suffix, 'Review smoke region 1 ' || v_suffix, true)
  RETURNING id INTO v_region_1;

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('RR-DB-2-' || v_suffix, 'Review smoke region 2 ' || v_suffix, true)
  RETURNING id INTO v_region_2;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('RR smoke facility A ' || v_suffix, true, v_region_1)
  RETURNING id INTO v_facility_a;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('RR smoke facility B ' || v_suffix, true, v_region_1)
  RETURNING id INTO v_facility_b;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('RR smoke facility C ' || v_suffix, true, v_region_2)
  RETURNING id INTO v_facility_c;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id, khoa_phong)
  VALUES ('rr_global_' || v_suffix, 'smoke-password', 'RR Global ' || v_suffix, 'global', v_facility_a, v_facility_a, NULL, NULL)
  RETURNING id INTO v_global_user;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id, khoa_phong)
  VALUES ('rr_regional_' || v_suffix, 'smoke-password', 'RR Regional ' || v_suffix, 'regional_leader', v_facility_a, v_facility_a, v_region_1, NULL)
  RETURNING id INTO v_regional_user;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id, khoa_phong)
  VALUES ('rr_tenant_' || v_suffix, 'smoke-password', 'RR Tenant ' || v_suffix, 'to_qltb', v_facility_a, v_facility_a, NULL, NULL)
  RETURNING id INTO v_tenant_user;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id, khoa_phong)
  VALUES ('rr_user_' || v_suffix, 'smoke-password', 'RR User ' || v_suffix, 'user', v_facility_a, v_facility_a, NULL, 'Khoa-A')
  RETURNING id INTO v_department_user;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id, khoa_phong)
  VALUES ('rr_user_blank_' || v_suffix, 'smoke-password', 'RR User Blank ' || v_suffix, 'user', v_facility_a, v_facility_a, NULL, NULL)
  RETURNING id INTO v_departmentless_user;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai
  )
  VALUES ('RR-A-' || v_suffix, 'RR Facility A equipment ' || v_suffix, v_facility_a, 'Khoa-A', 'Hoạt động')
  RETURNING id INTO v_equipment_a;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai
  )
  VALUES ('RR-A2-' || v_suffix, 'RR Facility A other dept ' || v_suffix, v_facility_a, 'Khoa B', 'Hoạt động')
  RETURNING id INTO v_equipment_a_other_dept;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai
  )
  VALUES ('RR-B-' || v_suffix, 'RR Facility B equipment ' || v_suffix, v_facility_b, 'Khoa-A', 'Hoạt động')
  RETURNING id INTO v_equipment_b;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai
  )
  VALUES ('RR-C-' || v_suffix, 'RR Facility C equipment ' || v_suffix, v_facility_c, 'Khoa-A', 'Hoạt động')
  RETURNING id INTO v_equipment_c;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    trang_thai,
    nguoi_yeu_cau,
    ngay_yeu_cau
  )
  VALUES
    (v_equipment_a, 'Overdue 100% marker ' || v_suffix, 'Scope A', v_today - 1, 'Chờ xử lý', 'Requester A', now() - interval '1 day'),
    (v_equipment_a, 'Due today approved ' || v_suffix, 'Scope A', v_today, 'Đã duyệt', 'Requester A', now()),
    (v_equipment_a, 'Due in 7 days ' || v_suffix, 'Scope A', v_today + 7, 'Chờ xử lý', 'Requester A', now() - interval '10 day'),
    (v_equipment_a, 'Due in 8 days ' || v_suffix, 'Scope A', v_today + 8, 'Chờ xử lý', 'Requester A', now()),
    (v_equipment_a, 'Null due date ' || v_suffix, 'Scope A', NULL, 'Chờ xử lý', 'Requester A', now()),
    (v_equipment_a, 'Completed overdue ' || v_suffix, 'Scope A', v_today - 1, 'Hoàn thành', 'Requester A', now()),
    (v_equipment_a, 'Failed overdue ' || v_suffix, 'Scope A', v_today - 1, 'Không HT', 'Requester A', now()),
    (v_equipment_a_other_dept, 'Other department due today ' || v_suffix, 'Scope B', v_today, 'Chờ xử lý', 'Requester B', now()),
    (v_equipment_b, 'Region peer due today ' || v_suffix, 'Scope B', v_today, 'Chờ xử lý', 'Requester B', now()),
    (v_equipment_c, 'Cross tenant due today ' || v_suffix, 'Scope C', v_today, 'Chờ xử lý', 'Requester C', now());

  -- global: sees all 10 rows, summary excludes due+8/null/completed/failed.
  PERFORM pg_temp._rr_counts_set_claims('global', v_global_user, NULL, NULL, NULL);
  SELECT public.repair_request_status_counts() INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('global count cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 7);
  PERFORM pg_temp._rr_assert_eq_int('global count da_duyet', (v_result->'counts'->>'Đã duyệt')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('global count hoan_thanh', (v_result->'counts'->>'Hoàn thành')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('global count khong_ht', (v_result->'counts'->>'Không HT')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('global overdue total', (v_result->'overdue_summary'->>'total')::integer, 6);
  PERFORM pg_temp._rr_assert_eq_int('global overdue overdue', (v_result->'overdue_summary'->>'overdue')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('global overdue today', (v_result->'overdue_summary'->>'due_today')::integer, 4);
  PERFORM pg_temp._rr_assert_eq_int('global overdue soon', (v_result->'overdue_summary'->>'due_soon')::integer, 1);

  -- regional leader: sees facilities A + B, not C.
  PERFORM pg_temp._rr_counts_set_claims('regional_leader', v_regional_user, v_facility_a, v_region_1, NULL);
  SELECT public.repair_request_status_counts() INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('regional count cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 6);
  PERFORM pg_temp._rr_assert_eq_int('regional overdue total', (v_result->'overdue_summary'->>'total')::integer, 5);
  PERFORM pg_temp._rr_assert_eq_int('regional due today', (v_result->'overdue_summary'->>'due_today')::integer, 3);

  -- regional leader facility filter narrows to B only.
  SELECT public.repair_request_status_counts(p_don_vi := v_facility_b) INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('regional facility B cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('regional facility B overdue total', (v_result->'overdue_summary'->>'total')::integer, 1);

  -- tenant role: sees only facility A, including other departments in that facility.
  PERFORM pg_temp._rr_counts_set_claims('to_qltb', v_tenant_user, v_facility_a, NULL, NULL);
  SELECT public.repair_request_status_counts() INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('tenant count cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 5);
  PERFORM pg_temp._rr_assert_eq_int('tenant overdue total', (v_result->'overdue_summary'->>'total')::integer, 4);
  PERFORM pg_temp._rr_assert_eq_int('tenant due today', (v_result->'overdue_summary'->>'due_today')::integer, 2);
  PERFORM pg_temp._rr_assert_eq_bigint('tenant items length', jsonb_array_length(v_result->'overdue_summary'->'items'), 4);

  -- department-scoped user: excludes facility-A row in "Khoa B".
  PERFORM pg_temp._rr_counts_set_claims('user', v_department_user, v_facility_a, NULL, 'Khoa-A');
  SELECT public.repair_request_status_counts() INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('user count cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 4);
  PERFORM pg_temp._rr_assert_eq_int('user overdue total', (v_result->'overdue_summary'->>'total')::integer, 3);
  PERFORM pg_temp._rr_assert_eq_int('user due today', (v_result->'overdue_summary'->>'due_today')::integer, 1);

  -- departmentless user: fail closed to zero + empty items.
  PERFORM pg_temp._rr_counts_set_claims('user', v_departmentless_user, v_facility_a, NULL, NULL);
  SELECT public.repair_request_status_counts() INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('user blank count cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 0);
  PERFORM pg_temp._rr_assert_eq_int('user blank overdue total', (v_result->'overdue_summary'->>'total')::integer, 0);
  PERFORM pg_temp._rr_assert_eq_bigint('user blank items length', jsonb_array_length(v_result->'overdue_summary'->'items'), 0);

  -- Sanitized ILIKE: "%" should only match the literal percent marker row.
  PERFORM pg_temp._rr_counts_set_claims('to_qltb', v_tenant_user, v_facility_a, NULL, NULL);
  SELECT public.repair_request_status_counts(p_q := '%') INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('sanitized percent cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 1);
  PERFORM pg_temp._rr_assert_eq_int('sanitized percent overdue total', (v_result->'overdue_summary'->>'total')::integer, 1);

  -- Date range filter uses ngay_yeu_cau, so the 7-day item drops out here.
  SELECT public.repair_request_status_counts(
    p_date_from := v_today - 2,
    p_date_to := v_today
  ) INTO v_result;
  PERFORM pg_temp._rr_assert_eq_int('date filtered cho_xu_ly', (v_result->'counts'->>'Chờ xử lý')::integer, 4);
  PERFORM pg_temp._rr_assert_eq_int('date filtered overdue total', (v_result->'overdue_summary'->>'total')::integer, 3);

  RAISE NOTICE 'OK: repair_request_status_counts overdue summary smoke passed';
END $$;

ROLLBACK;
