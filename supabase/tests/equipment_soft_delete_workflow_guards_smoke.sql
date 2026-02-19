-- supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql
-- Purpose: verify workflow mutation RPCs reject soft-deleted equipment
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_source_equipment bigint;
  v_deleted_equipment bigint;
  v_transfer_id integer;
  v_user_id integer := 1;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Workflow Guard Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-WF-SRC-' || v_suffix,
    'Smoke Workflow Source Equipment ' || v_suffix,
    v_tenant,
    'Khoa Smoke',
    'Hoat dong',
    false
  )
  RETURNING id INTO v_source_equipment;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-WF-DEL-' || v_suffix,
    'Smoke Workflow Deleted Equipment ' || v_suffix,
    v_tenant,
    'Khoa Smoke',
    'Hoat dong',
    false
  )
  RETURNING id INTO v_deleted_equipment;

  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = v_deleted_equipment;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', null
    )::text,
    true
  );

  v_transfer_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_source_equipment,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Seed transfer ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa A',
      'khoa_phong_nhan', 'Khoa B',
      'nguoi_yeu_cau_id', v_user_id,
      'created_by', v_user_id,
      'updated_by', v_user_id
    )
  );

  v_failed := false;
  BEGIN
    PERFORM public.repair_request_create(
      v_deleted_equipment::integer,
      'Smoke repair guard ' || v_suffix,
      'Guard check',
      current_date + 1,
      'Smoke user',
      'Noi bo',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected repair_request_create to reject soft-deleted equipment';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0002' THEN
    RAISE EXCEPTION
      'Expected repair_request_create to fail with P0002 equipment guard, got % (%).',
      v_sqlstate, v_sqlerrm;
  END IF;

  RAISE NOTICE 'OK: repair_request_create blocked soft-deleted equipment (% / %)', v_sqlstate, v_sqlerrm;

  v_failed := false;
  BEGIN
    PERFORM public.transfer_request_create(
      jsonb_build_object(
        'thiet_bi_id', v_deleted_equipment,
        'loai_hinh', 'noi_bo',
        'ly_do_luan_chuyen', 'Guard transfer create ' || v_suffix,
        'khoa_phong_hien_tai', 'Khoa A',
        'khoa_phong_nhan', 'Khoa B',
        'nguoi_yeu_cau_id', v_user_id,
        'created_by', v_user_id,
        'updated_by', v_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_create to reject soft-deleted equipment';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0002' THEN
    RAISE EXCEPTION
      'Expected transfer_request_create to fail with P0002 equipment guard, got % (%).',
      v_sqlstate, v_sqlerrm;
  END IF;

  RAISE NOTICE 'OK: transfer_request_create blocked soft-deleted equipment (% / %)', v_sqlstate, v_sqlerrm;

  v_failed := false;
  BEGIN
    PERFORM public.transfer_request_update(
      v_transfer_id,
      jsonb_build_object(
        'thiet_bi_id', v_deleted_equipment,
        'updated_by', v_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_update to reject soft-deleted target equipment';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0002' THEN
    RAISE EXCEPTION
      'Expected transfer_request_update to fail with P0002 equipment guard, got % (%).',
      v_sqlstate, v_sqlerrm;
  END IF;

  RAISE NOTICE 'OK: transfer_request_update blocked soft-deleted equipment switch (% / %)', v_sqlstate, v_sqlerrm;

  v_failed := false;
  BEGIN
    PERFORM public.usage_session_start(
      p_thiet_bi_id => v_deleted_equipment,
      p_nguoi_su_dung_id => v_user_id,
      p_tinh_trang_thiet_bi => 'Tot',
      p_ghi_chu => 'Guard usage start ' || v_suffix,
      p_don_vi => v_tenant
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected usage_session_start to reject soft-deleted equipment';
  END IF;

  RAISE NOTICE 'OK: usage_session_start blocked soft-deleted equipment (% / %)', v_sqlstate, v_sqlerrm;

  -- Admin/global mapping guard: admin should behave as global and still hit equipment guard.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'admin',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', null
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.usage_session_start(
      p_thiet_bi_id => v_deleted_equipment,
      p_nguoi_su_dung_id => v_user_id,
      p_tinh_trang_thiet_bi => 'Tot',
      p_ghi_chu => 'Guard usage start admin ' || v_suffix,
      p_don_vi => v_tenant
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected usage_session_start (admin role) to reject soft-deleted equipment';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0002' THEN
    RAISE EXCEPTION
      'Expected usage_session_start (admin role) to fail with P0002 equipment guard, got % (%).',
      v_sqlstate, v_sqlerrm;
  END IF;

  RAISE NOTICE 'OK: usage_session_start admin/global mapping check passed (% / %)', v_sqlstate, v_sqlerrm;
  RAISE NOTICE 'OK: workflow guard smoke checks passed';
END $$;

ROLLBACK;
