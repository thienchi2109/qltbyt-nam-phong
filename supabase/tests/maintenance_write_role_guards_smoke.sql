-- supabase/tests/maintenance_write_role_guards_smoke.sql
-- Purpose: lock Issue #309 maintenance write role guards.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_region_id bigint;
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_plan_id bigint;
  v_other_plan_id bigint;
  v_admin_plan_id bigint;
  v_admin_plan_don_vi bigint;
  v_task_id bigint;
  v_other_task_id bigint;
  v_other_equipment_id bigint;
  v_mismatched_task_id bigint;
  v_count bigint;
  v_failed boolean;
  v_denied_role text;
BEGIN
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('SMK-MW-' || v_suffix, 'Smoke Maintenance Write Region ' || v_suffix, true)
  RETURNING id INTO v_region_id;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-MW-A-' || v_suffix, 'Smoke Maintenance Write Tenant A ' || v_suffix, true, v_region_id)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-MW-B-' || v_suffix, 'Smoke Maintenance Write Tenant B ' || v_suffix, true, v_region_id)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id)
  VALUES (
    'maintenance_write_smoke_' || v_suffix,
    'smoke-password',
    'Maintenance Write Smoke',
    'to_qltb',
    v_tenant,
    v_tenant,
    v_region_id
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    loai_cong_viec,
    khoa_phong,
    nguoi_lap_ke_hoach,
    trang_thai,
    don_vi
  )
  VALUES (
    'Smoke Maintenance Other Tenant Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Smoke Other Department',
    'Maintenance Write Smoke',
    'Bản nháp',
    v_other_tenant
  )
  RETURNING id INTO v_other_plan_id;

  INSERT INTO public.cong_viec_bao_tri(
    ke_hoach_id,
    loai_cong_viec,
    diem_hieu_chuan,
    don_vi_thuc_hien,
    thang_1,
    ghi_chu
  )
  VALUES (
    v_other_plan_id,
    'kiem_tra',
    'Smoke other tenant task ' || v_suffix,
    'noi_bo',
    true,
    'Smoke other tenant task ' || v_suffix
  )
  RETURNING id INTO v_other_task_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_plan_id := public.maintenance_plan_create(
    'Smoke Maintenance Allowed Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Smoke Department',
    'Maintenance Write Smoke'
  );

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Expected to_qltb maintenance_plan_create to return a plan id';
  END IF;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, is_deleted)
  VALUES (
    'SMK-MW-OTHER-EQ-' || v_suffix,
    'Smoke Maintenance Other Equipment ' || v_suffix,
    v_other_tenant,
    'Smoke Other Department',
    'Hoat dong',
    false
  )
  RETURNING id INTO v_other_equipment_id;

  INSERT INTO public.cong_viec_bao_tri(
    ke_hoach_id,
    thiet_bi_id,
    loai_cong_viec,
    diem_hieu_chuan,
    don_vi_thuc_hien,
    thang_1,
    ghi_chu
  )
  VALUES (
    v_plan_id,
    v_other_equipment_id,
    'kiem_tra',
    'Smoke mismatched equipment task ' || v_suffix,
    'noi_bo',
    true,
    'Smoke mismatched equipment task ' || v_suffix
  )
  RETURNING id INTO v_mismatched_task_id;

  PERFORM public.maintenance_plan_update(
    v_plan_id,
    'Smoke Maintenance Updated Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'bao_tri',
    'Smoke Department Updated'
  );

  PERFORM public.maintenance_plan_approve(v_plan_id, 'Maintenance Write Approver');
  PERFORM public.maintenance_plan_reject(v_plan_id, 'Maintenance Write Approver', 'Smoke reject reason');

  PERFORM public.maintenance_tasks_bulk_insert(
    jsonb_build_array(
      jsonb_build_object(
        'ke_hoach_id', v_plan_id,
        'loai_cong_viec', 'kiem_tra',
        'diem_hieu_chuan', 'Smoke allowed task ' || v_suffix,
        'don_vi_thuc_hien', 'noi_bo',
        'thang_1', true,
        'ghi_chu', 'Smoke allowed task ' || v_suffix
      )
    )
  );

  SELECT id
  INTO v_task_id
  FROM public.cong_viec_bao_tri
  WHERE ke_hoach_id = v_plan_id
    AND ghi_chu = 'Smoke allowed task ' || v_suffix;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Expected to_qltb maintenance_tasks_bulk_insert to persist a task';
  END IF;

  PERFORM public.maintenance_task_update(
    v_task_id,
    jsonb_build_object('ghi_chu', 'Smoke updated task ' || v_suffix, 'thang_2', true)
  );
  PERFORM public.maintenance_task_complete(v_task_id, 1);
  PERFORM public.maintenance_tasks_delete(ARRAY[v_task_id]);

  SELECT count(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE id = v_task_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected to_qltb maintenance_tasks_delete to remove allowed task';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'admin',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text
    )::text,
    true
  );

  v_admin_plan_id := public.maintenance_plan_create(
    'Smoke Maintenance Admin Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Smoke Admin Department',
    'Maintenance Write Smoke Admin'
  );

  IF v_admin_plan_id IS NULL THEN
    RAISE EXCEPTION 'Expected admin maintenance_plan_create without don_vi claim to remain allowed';
  END IF;

  SELECT don_vi
  INTO v_admin_plan_don_vi
  FROM public.ke_hoach_bao_tri
  WHERE id = v_admin_plan_id;

  IF v_admin_plan_don_vi IS NOT NULL THEN
    RAISE EXCEPTION 'Expected admin-created plan without don_vi claim to persist NULL don_vi, got %', v_admin_plan_don_vi;
  END IF;

  PERFORM public.maintenance_plan_delete(v_admin_plan_id);

  SELECT count(*)
  INTO v_count
  FROM public.ke_hoach_bao_tri
  WHERE id = v_admin_plan_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Expected admin maintenance_plan_delete to remove admin-created plan';
  END IF;

  FOREACH v_denied_role IN ARRAY ARRAY['user', 'regional_leader'] LOOP
    PERFORM set_config(
      'request.jwt.claims',
      CASE
        WHEN v_denied_role = 'regional_leader' THEN
          json_build_object(
            'app_role', v_denied_role,
            'role', 'authenticated',
            'user_id', v_user_id::text,
            'sub', v_user_id::text,
            'dia_ban', v_region_id::text
          )::text
        ELSE
          json_build_object(
            'app_role', v_denied_role,
            'role', 'authenticated',
            'user_id', v_user_id::text,
            'sub', v_user_id::text,
            'don_vi', v_tenant::text
          )::text
      END,
      true
    );

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_plan_create(
        'Smoke denied plan ' || v_denied_role || ' ' || v_suffix,
        EXTRACT(YEAR FROM current_date)::integer,
        'kiem_tra',
        'Smoke Denied Department',
        'Maintenance Write Smoke'
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_plan_create for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_plan_create for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_plan_update(
        v_plan_id,
        'Smoke denied update ' || v_denied_role || ' ' || v_suffix,
        EXTRACT(YEAR FROM current_date)::integer,
        'bao_tri',
        'Smoke Denied Department'
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_plan_update for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_plan_update for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_plan_approve(v_plan_id, 'Denied Approver');
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_plan_approve for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_plan_approve for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_plan_reject(v_plan_id, 'Denied Approver', 'Denied reason');
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_plan_reject for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_plan_reject for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_tasks_bulk_insert(
        jsonb_build_array(
          jsonb_build_object(
            'ke_hoach_id', v_plan_id,
            'loai_cong_viec', 'kiem_tra',
            'diem_hieu_chuan', 'Smoke denied task ' || v_denied_role || ' ' || v_suffix,
            'don_vi_thuc_hien', 'noi_bo',
            'thang_3', true,
            'ghi_chu', 'Smoke denied task ' || v_denied_role || ' ' || v_suffix
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_task_update(
        v_other_task_id,
        jsonb_build_object('ghi_chu', 'Smoke denied update task ' || v_denied_role || ' ' || v_suffix)
      );
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_task_update for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_task_update for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_task_complete(v_other_task_id, 1);
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_task_complete for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_task_complete for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_tasks_delete(ARRAY[v_other_task_id]);
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_tasks_delete for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_tasks_delete for % to deny with 42501', v_denied_role;
    END IF;

    v_failed := false;
    BEGIN
      PERFORM public.maintenance_plan_delete(v_plan_id);
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      IF SQLSTATE IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Expected maintenance_plan_delete for % to deny with 42501, got %', v_denied_role, SQLSTATE;
      END IF;
    END;
    IF NOT v_failed THEN
      RAISE EXCEPTION 'Expected maintenance_plan_delete for % to deny with 42501', v_denied_role;
    END IF;
  END LOOP;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_failed := false;
  BEGIN
    PERFORM public.maintenance_plan_update(
      v_other_plan_id,
      'Smoke cross-tenant update ' || v_suffix,
      EXTRACT(YEAR FROM current_date)::integer,
      'bao_tri',
      'Smoke Cross Tenant'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'Expected cross-tenant maintenance_plan_update to deny with 42501, got %', SQLSTATE;
    END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected cross-tenant maintenance_plan_update to deny with 42501';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.maintenance_task_update(
      v_other_task_id,
      jsonb_build_object('ghi_chu', 'Smoke cross-tenant task update ' || v_suffix)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'Expected cross-tenant maintenance_task_update to deny with 42501, got %', SQLSTATE;
    END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected cross-tenant maintenance_task_update to deny with 42501';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.maintenance_tasks_delete(ARRAY[v_other_task_id]);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'Expected cross-tenant maintenance_tasks_delete to deny with 42501, got %', SQLSTATE;
    END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected cross-tenant maintenance_tasks_delete to deny with 42501';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.maintenance_tasks_delete(ARRAY[v_mismatched_task_id]);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    IF SQLSTATE IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'Expected mismatched-equipment maintenance_tasks_delete to deny with 42501, got %', SQLSTATE;
    END IF;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected mismatched-equipment maintenance_tasks_delete to deny with 42501';
  END IF;

  RAISE NOTICE 'OK: maintenance write role guard smoke completed';
END $$;

ROLLBACK;
