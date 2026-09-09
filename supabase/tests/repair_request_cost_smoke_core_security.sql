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

ROLLBACK;
