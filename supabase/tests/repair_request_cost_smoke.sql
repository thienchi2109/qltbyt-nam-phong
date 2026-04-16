-- supabase/tests/repair_request_cost_smoke.sql
-- Purpose: smoke-test repair request cost storage and reporting after the migration is applied.
-- How to run (local): docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_cost_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rr_cost_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint DEFAULT NULL
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
      'don_vi', p_don_vi::text
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp._rr_cost_create_approved_request(
  p_tenant_id bigint,
  p_user_id bigint,
  p_suffix text
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_equipment_id bigint;
  v_request_id bigint;
BEGIN
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (
    'RR-COST-' || p_suffix,
    'Repair cost smoke ' || p_suffix,
    p_tenant_id
  )
  RETURNING id INTO v_equipment_id;

  PERFORM pg_temp._rr_cost_set_claims('to_qltb', p_user_id, p_tenant_id);

  v_request_id := public.repair_request_create(
    v_equipment_id::integer,
    'Mô tả sửa chữa smoke ' || p_suffix,
    'Hạng mục sửa chữa smoke ' || p_suffix,
    CURRENT_DATE + 7,
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'noi_bo',
    NULL
  );

  RETURN v_request_id;
END;
$$;

-- 1) Schema contract: nullable numeric(14,2), no default, non-negative constraint.
-- No-backfill is covered by the migration DDL order: ADD COLUMN without default, then DROP DEFAULT.
DO $$
DECLARE
  v_data_type text;
  v_precision integer;
  v_scale integer;
  v_is_nullable text;
  v_default text;
  v_constraint_count integer;
BEGIN
  SELECT c.data_type, c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default
  INTO v_data_type, v_precision, v_scale, v_is_nullable, v_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'yeu_cau_sua_chua'
    AND c.column_name = 'chi_phi_sua_chua';

  IF v_data_type IS NULL THEN
    RAISE EXCEPTION 'Expected public.yeu_cau_sua_chua.chi_phi_sua_chua to exist';
  END IF;

  IF v_data_type <> 'numeric' OR v_precision <> 14 OR v_scale <> 2 THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua numeric(14,2), got %(%,%)', v_data_type, v_precision, v_scale;
  END IF;

  IF v_is_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua to be nullable';
  END IF;

  IF v_default IS NOT NULL THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua to have no default, got %', v_default;
  END IF;

  SELECT count(*)
  INTO v_constraint_count
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'yeu_cau_sua_chua'
    AND con.conname = 'yeu_cau_sua_chua_chi_phi_sua_chua_non_negative'
    AND pg_get_constraintdef(con.oid) ILIKE '%chi_phi_sua_chua%>=%0%';

  IF v_constraint_count <> 1 THEN
    RAISE EXCEPTION 'Expected non-negative chi_phi_sua_chua check constraint';
  END IF;

  RAISE NOTICE 'OK: repair cost schema contract passed';
END $$;

-- 2) Completion stores NULL, zero, and positive costs with distinct semantics.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_null_request_id bigint;
  v_zero_request_id bigint;
  v_positive_request_id bigint;
  v_cost numeric;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair cost smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_cost_smoke_' || v_suffix,
    'smoke-password',
    'Repair Cost Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_null_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-NULL');
  v_zero_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-ZERO');
  v_positive_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-POS');

  SELECT chi_phi_sua_chua INTO v_cost
  FROM public.yeu_cau_sua_chua
  WHERE id = v_null_request_id;

  IF v_cost IS NOT NULL THEN
    RAISE EXCEPTION 'Expected omitted request cost to stay NULL before completion, got %', v_cost;
  END IF;

  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  PERFORM public.repair_request_complete(
    p_id => v_null_request_id::integer,
    p_completion => 'Đã hoàn thành smoke null cost',
    p_reason => NULL,
    p_chi_phi_sua_chua => NULL
  );

  PERFORM public.repair_request_complete(
    p_id => v_zero_request_id::integer,
    p_completion => 'Đã hoàn thành smoke zero cost',
    p_reason => NULL,
    p_chi_phi_sua_chua => 0
  );

  PERFORM public.repair_request_complete(
    p_id => v_positive_request_id::integer,
    p_completion => 'Đã hoàn thành smoke positive cost',
    p_reason => NULL,
    p_chi_phi_sua_chua => 1234567
  );

  SELECT chi_phi_sua_chua INTO v_cost
  FROM public.yeu_cau_sua_chua
  WHERE id = v_null_request_id;

  IF v_cost IS NOT NULL THEN
    RAISE EXCEPTION 'Expected blank completion cost to persist NULL, got %', v_cost;
  END IF;

  SELECT chi_phi_sua_chua INTO v_cost
  FROM public.yeu_cau_sua_chua
  WHERE id = v_zero_request_id;

  IF v_cost IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Expected explicit zero completion cost, got %', v_cost;
  END IF;

  SELECT chi_phi_sua_chua INTO v_cost
  FROM public.yeu_cau_sua_chua
  WHERE id = v_positive_request_id;

  IF v_cost IS DISTINCT FROM 1234567 THEN
    RAISE EXCEPTION 'Expected positive completion cost 1234567, got %', v_cost;
  END IF;

  RAISE NOTICE 'OK: repair_request_complete cost write semantics passed';
END $$;

-- 3) Invalid or repeated completion attempts cannot mutate cost.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_request_id bigint;
  v_cost numeric;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair cost invalid smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_cost_invalid_smoke_' || v_suffix,
    'smoke-password',
    'Repair Cost Invalid Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-NEG');
  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  BEGIN
    PERFORM public.repair_request_complete(
      p_id => v_request_id::integer,
      p_completion => 'Đã hoàn thành smoke negative cost',
      p_reason => NULL,
      p_chi_phi_sua_chua => -1
    );
    RAISE EXCEPTION 'Expected negative repair cost to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for negative repair cost, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  PERFORM public.repair_request_complete(
    p_id => v_request_id::integer,
    p_completion => 'Đã hoàn thành smoke terminal cost',
    p_reason => NULL,
    p_chi_phi_sua_chua => 321
  );

  BEGIN
    PERFORM public.repair_request_complete(
      p_id => v_request_id::integer,
      p_completion => 'Cố gắng hoàn thành lại',
      p_reason => NULL,
      p_chi_phi_sua_chua => 999
    );
    RAISE EXCEPTION 'Expected second completion to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for second completion, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT chi_phi_sua_chua INTO v_cost
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_cost IS DISTINCT FROM 321 THEN
    RAISE EXCEPTION 'Expected second completion to preserve cost 321, got %', v_cost;
  END IF;

  RAISE NOTICE 'OK: invalid and repeated completion cost guards passed';
END $$;

-- 4) Security guards are preserved for missing claims and wrong tenant.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_request_id bigint;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair cost secure tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair cost secure other tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_cost_secure_smoke_' || v_suffix,
    'smoke-password',
    'Repair Cost Secure Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-SEC');

  PERFORM set_config('request.jwt.claims', '{}'::text, true);

  BEGIN
    PERFORM public.repair_request_complete(
      p_id => v_request_id::integer,
      p_completion => 'Thiếu claims',
      p_reason => NULL,
      p_chi_phi_sua_chua => 1
    );
    RAISE EXCEPTION 'Expected missing claims to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 42501 for missing claims, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_other_tenant);

  BEGIN
    PERFORM public.repair_request_complete(
      p_id => v_request_id::integer,
      p_completion => 'Sai đơn vị',
      p_reason => NULL,
      p_chi_phi_sua_chua => 1
    );
    RAISE EXCEPTION 'Expected wrong tenant to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '42501' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 42501 for wrong tenant, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'OK: repair_request_complete security guards passed';
END $$;

-- 5) List/detail/report RPCs expose cost values and NULL-aware aggregate semantics.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_null_request_id bigint;
  v_zero_request_id bigint;
  v_positive_request_id bigint;
  v_list jsonb;
  v_pagination jsonb;
  v_detail jsonb;
  v_report jsonb;
  v_stats jsonb;
  v_total numeric;
  v_average numeric;
  v_recorded_count integer;
  v_missing_count integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair cost report smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_cost_report_smoke_' || v_suffix,
    'smoke-password',
    'Repair Cost Report Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_null_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-REPORT-NULL');
  v_zero_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-REPORT-ZERO');
  v_positive_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-REPORT-POS');

  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  PERFORM public.repair_request_complete(v_null_request_id::integer, 'Report null cost', NULL, NULL);
  PERFORM public.repair_request_complete(v_zero_request_id::integer, 'Report zero cost', NULL, 0);
  PERFORM public.repair_request_complete(v_positive_request_id::integer, 'Report positive cost', NULL, 1234567);

  v_list := public.repair_request_list(
    p_q => NULL,
    p_status => NULL,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant,
    p_date_from => CURRENT_DATE - 1,
    p_date_to => CURRENT_DATE + 1,
    p_statuses => ARRAY['Hoàn thành']::text[]
  );

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_list->'data') AS item(row_data)
    WHERE (row_data->>'id')::bigint = v_positive_request_id
      AND row_data ? 'chi_phi_sua_chua'
      AND (row_data->>'chi_phi_sua_chua')::numeric = 1234567
  ) THEN
    RAISE EXCEPTION 'repair_request_list should include positive chi_phi_sua_chua row, got %', v_list;
  END IF;

  v_pagination := public.repair_request_list(
    p_q => NULL,
    p_status => NULL,
    p_page => 0,
    p_page_size => 0,
    p_don_vi => v_tenant,
    p_date_from => CURRENT_DATE - 1,
    p_date_to => CURRENT_DATE + 1,
    p_statuses => ARRAY['Hoàn thành']::text[]
  );

  IF (v_pagination->>'page')::integer IS DISTINCT FROM 1
     OR (v_pagination->>'pageSize')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'repair_request_list should return normalized pagination metadata page=1 pageSize=1, got %', v_pagination;
  END IF;

  v_detail := public.repair_request_get(v_positive_request_id::integer);

  IF (v_detail->>'chi_phi_sua_chua')::numeric IS DISTINCT FROM 1234567 THEN
    RAISE EXCEPTION 'repair_request_get should expose chi_phi_sua_chua 1234567, got %', v_detail->>'chi_phi_sua_chua';
  END IF;

  v_report := public.get_maintenance_report_data(CURRENT_DATE - 1, CURRENT_DATE + 1, v_tenant);
  v_total := (v_report #>> '{summary,totalRepairCost}')::numeric;
  v_average := (v_report #>> '{summary,averageCompletedRepairCost}')::numeric;
  v_recorded_count := (v_report #>> '{summary,costRecordedCount}')::integer;
  v_missing_count := (v_report #>> '{summary,costMissingCount}')::integer;

  IF v_total IS DISTINCT FROM 1234567 THEN
    RAISE EXCEPTION 'Expected report totalRepairCost 1234567, got % in %', v_total, v_report;
  END IF;

  IF v_average IS DISTINCT FROM 617283.5 THEN
    RAISE EXCEPTION 'Expected report averageCompletedRepairCost 617283.5, got % in %', v_average, v_report;
  END IF;

  IF v_recorded_count IS DISTINCT FROM 2 OR v_missing_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected report cost counts recorded=2 missing=1, got recorded=% missing=% in %', v_recorded_count, v_missing_count, v_report;
  END IF;

  v_stats := public.maintenance_stats_for_reports(CURRENT_DATE - 1, CURRENT_DATE + 1, v_tenant, NULL);

  IF (v_stats #>> '{repair_summary,total_cost}')::numeric IS DISTINCT FROM 1234567 THEN
    RAISE EXCEPTION 'Expected stats repair_summary.total_cost 1234567, got %', v_stats;
  END IF;

  IF (v_stats #>> '{repair_summary,average_completed_cost}')::numeric IS DISTINCT FROM 617283.5 THEN
    RAISE EXCEPTION 'Expected stats repair_summary.average_completed_cost 617283.5, got %', v_stats;
  END IF;

  IF (v_stats #>> '{repair_summary,cost_recorded_count}')::integer IS DISTINCT FROM 2
     OR (v_stats #>> '{repair_summary,cost_missing_count}')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected stats repair cost counts recorded=2 missing=1, got %', v_stats;
  END IF;

  RAISE NOTICE 'OK: repair cost list/detail/report payloads passed';
END $$;

-- 6) Empty completion payload must raise and leave the request approved.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_request_id bigint;
  v_status text;
  v_completed_at timestamptz;
  v_completion text;
  v_reason text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair empty smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_empty_smoke_' || v_suffix,
    'smoke-password',
    'Repair Empty Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix);
  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  BEGIN
    PERFORM public.repair_request_complete(v_request_id::integer, '   ', NULL, NULL);
    RAISE EXCEPTION 'Expected whitespace-only completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for whitespace completion, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT trang_thai, ngay_hoan_thanh, ket_qua_sua_chua, ly_do_khong_hoan_thanh
  INTO v_status, v_completed_at, v_completion, v_reason
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_status <> 'Đã duyệt'
     OR v_completed_at IS NOT NULL
     OR v_completion IS NOT NULL
     OR v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'Blank completion must not mutate request; got status=%, completed_at=%, completion=%, reason=%',
      v_status, v_completed_at, v_completion, v_reason;
  END IF;

  RAISE NOTICE 'OK: empty completion payload guard passed';
END $$;

-- 7) Non-space whitespace payloads must raise and leave the request approved.
DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_user_id bigint;
  v_completion_request_id bigint;
  v_reason_request_id bigint;
  v_status text;
  v_completed_at timestamptz;
  v_completion text;
  v_reason text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair control-char smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_control_char_smoke_' || v_suffix,
    'smoke-password',
    'Repair Control Char Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  v_completion_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-COMP');
  v_reason_request_id := pg_temp._rr_cost_create_approved_request(v_tenant, v_user_id, v_suffix || '-REASON');
  PERFORM pg_temp._rr_cost_set_claims('to_qltb', v_user_id, v_tenant);

  BEGIN
    PERFORM public.repair_request_complete(v_completion_request_id::integer, E'\n\t', NULL, NULL);
    RAISE EXCEPTION 'Expected newline/tab-only completion to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for control-char completion, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT trang_thai, ngay_hoan_thanh, ket_qua_sua_chua, ly_do_khong_hoan_thanh
  INTO v_status, v_completed_at, v_completion, v_reason
  FROM public.yeu_cau_sua_chua
  WHERE id = v_completion_request_id;

  IF v_status <> 'Đã duyệt'
     OR v_completed_at IS NOT NULL
     OR v_completion IS NOT NULL
     OR v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'Control-char completion must not mutate request; got status=%, completed_at=%, completion=%, reason=%',
      v_status, v_completed_at, v_completion, v_reason;
  END IF;

  BEGIN
    PERFORM public.repair_request_complete(v_reason_request_id::integer, NULL, E'\n\t', NULL);
    RAISE EXCEPTION 'Expected newline/tab-only reason to raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> '22023' THEN
      RAISE EXCEPTION 'Expected SQLSTATE 22023 for control-char reason, got [%] %', SQLSTATE, SQLERRM;
    END IF;
  END;

  SELECT trang_thai, ngay_hoan_thanh, ket_qua_sua_chua, ly_do_khong_hoan_thanh
  INTO v_status, v_completed_at, v_completion, v_reason
  FROM public.yeu_cau_sua_chua
  WHERE id = v_reason_request_id;

  IF v_status <> 'Đã duyệt'
     OR v_completed_at IS NOT NULL
     OR v_completion IS NOT NULL
     OR v_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'Control-char reason must not mutate request; got status=%, completed_at=%, completion=%, reason=%',
      v_status, v_completed_at, v_completion, v_reason;
  END IF;

  RAISE NOTICE 'OK: control-char completion and reason guards passed';
END $$;

ROLLBACK;
