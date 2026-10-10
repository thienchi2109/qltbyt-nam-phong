-- Real RPC contract on isolated fixtures; run only on disposable gate clones.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '25s';

DO $$
DECLARE
  v_tenant bigint;
  v_other bigint;
  v_user bigint;
  v_active integer;
  v_terminal integer;
  v_unknown integer;
  v_warehouse integer;
  v_plan bigint;
  v_task bigint;
  v_terminal_task bigint;
  v_approve integer;
  v_complete integer;
  v_delete integer;
  v_repair integer;
  v_usage bigint;
  v_result jsonb;
  v_labels text[];
  v_expected text[] := ARRAY['Hoạt động', 'Chờ sửa chữa', 'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định', 'Ngưng sử dụng', 'Chưa có nhu cầu sử dụng', 'Thanh lý nội bộ'];
  v_sql text;
  v_message text;
  v_flag boolean;
  v_suffix text := txid_current()::text;
  v_saved_date text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Catalog consumers ' || v_suffix, true) RETURNING id INTO v_tenant;
  INSERT INTO public.don_vi(name, active)
  VALUES ('Other consumers ' || v_suffix, true) RETURNING id INTO v_other;
  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES ('catalog_consumers_' || v_suffix, 'smoke-password',
    'Catalog consumers gate', 'to_qltb', v_tenant, v_tenant) RETURNING id INTO v_user;
  INSERT INTO public.ke_hoach_bao_tri(ten_ke_hoach, nam, loai_cong_viec,
    khoa_phong, nguoi_lap_ke_hoach, trang_thai, don_vi)
  VALUES ('Catalog plan ' || v_suffix, 2026, 'kiem_tra', 'Catalog department',
    'Catalog gate', 'Bản nháp', v_tenant) RETURNING id INTO v_plan;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'to_qltb',
    'role', 'authenticated', 'user_id', v_user::text, 'sub', v_user::text,
    'don_vi', v_tenant::text)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'role fixture failed'; END IF;

  -- The new status must be selectable/reportable even before any equipment uses it.
  v_result := public.equipment_filter_buckets(p_don_vi => v_tenant);
  SELECT array_agg(c->>'status_value' ORDER BY (c->>'display_order')::integer)
  INTO v_labels FROM jsonb_array_elements(v_result->'status_catalog') c;
  IF v_labels IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'filter buckets catalog metadata/order missing: %', v_labels;
  END IF;
  IF v_result->'status_catalog' IS DISTINCT FROM (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order)
    FROM public.equipment_status_catalog_list() c WHERE c.is_active
  ) THEN RAISE EXCEPTION 'filter metadata lost catalog fields'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'status') s
      WHERE s->>'name' = 'Thanh lý nội bộ' AND (s->>'count')::integer = 0) THEN
    RAISE EXCEPTION 'zero-count liquidation bucket missing';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'status_catalog') c
      WHERE (c->>'is_active')::boolean IS DISTINCT FROM true
        OR (c->>'blocks_operational_actions')::boolean IS DISTINCT FROM
          (c->>'status_value' = 'Thanh lý nội bộ')
        OR (c->>'is_liquidation')::boolean IS DISTINCT FROM
          (c->>'status_value' = 'Thanh lý nội bộ')) THEN
    RAISE EXCEPTION 'consumer catalog flags changed';
  END IF;
  v_result := public.equipment_status_distribution(p_q => NULL::text, p_don_vi => v_tenant);
  IF (v_result #>> '{status_counts,Thanh lý nội bộ}')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'zero-count liquidation distribution missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment_status_distribution(v_tenant, NULL::text, NULL::text)
    WHERE tinh_trang = 'Thanh lý nội bộ' AND so_luong = 0) THEN
    RAISE EXCEPTION 'legacy tabular zero-count liquidation missing';
  END IF;

  SELECT id INTO v_terminal FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'CAT-TERMINAL-' || v_suffix, 'ten_thiet_bi', 'A terminal',
    'tinh_trang_hien_tai', 'Hoạt động', 'khoa_phong_quan_ly', 'Catalog department'));
  SELECT id INTO v_active FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'CAT-ACTIVE-' || v_suffix, 'ten_thiet_bi', 'Z active',
    'tinh_trang_hien_tai', 'Hoạt động', 'khoa_phong_quan_ly', 'Catalog department'));
  SELECT id INTO v_warehouse FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'CAT-WAREHOUSE-' || v_suffix, 'ten_thiet_bi', 'B warehouse active',
    'tinh_trang_hien_tai', 'Hoạt động', 'khoa_phong_quan_ly', 'VT-TBYT- KHO THANH LÍ'));

  -- Pre-existing repair/maintenance/usage history predates terminal transition.
  v_approve := public.repair_request_create(v_terminal, 'gate', 'gate', NULL, 'gate', NULL, NULL);
  v_complete := public.repair_request_create(v_terminal, 'gate', 'gate', NULL, 'gate', NULL, NULL);
  v_delete := public.repair_request_create(v_terminal, 'gate', 'gate', NULL, 'gate', NULL, NULL);
  v_result := public.usage_session_start(v_terminal::bigint);
  v_usage := (v_result->>'id')::bigint;
  PERFORM public.maintenance_tasks_bulk_insert(jsonb_build_array(
    jsonb_build_object('ke_hoach_id', v_plan, 'thiet_bi_id', v_terminal, 'loai_cong_viec', 'kiem_tra'),
    jsonb_build_object('ke_hoach_id', v_plan, 'thiet_bi_id', v_active, 'loai_cong_viec', 'kiem_tra')));
  EXECUTE 'RESET ROLE';
  SELECT id INTO v_terminal_task FROM public.cong_viec_bao_tri
    WHERE ke_hoach_id = v_plan AND thiet_bi_id = v_terminal;
  SELECT id INTO v_task FROM public.cong_viec_bao_tri
    WHERE ke_hoach_id = v_plan AND thiet_bi_id = v_active;
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, tinh_trang_hien_tai, don_vi, is_deleted)
  VALUES ('CAT-UNKNOWN-' || v_suffix, 'Unknown historical', 'Legacy sửa chữa ngoài catalog', v_tenant, false)
  RETURNING id INTO v_unknown;
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, tinh_trang_hien_tai, don_vi, is_deleted)
  VALUES ('CAT-OTHER-' || v_suffix, 'Other tenant', 'Hoạt động', v_other, false),
    ('CAT-DELETED-' || v_suffix, 'Deleted', 'Hoạt động', v_tenant, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.equipment_update(v_terminal, '{"tinh_trang_hien_tai":"Thanh lý nội bộ","ngay_ngung_su_dung":"2026-10-01"}'::jsonb);

  v_result := public.equipment_status_distribution(p_q => NULL::text, p_don_vi => v_tenant);
  IF (v_result->>'total_equipment')::integer <> 4
    OR (v_result #>> '{status_counts,hoat_dong}')::integer <> 2
    OR (v_result #>> '{status_counts,Thanh lý nội bộ}')::integer <> 1
    OR (v_result #>> '{status_counts,khac}')::integer <> 1 THEN
    RAISE EXCEPTION 'distribution counts unknown/liquidation incorrectly: %', v_result;
  END IF;
  IF (SELECT sum(value::integer) FROM jsonb_each_text(v_result->'status_counts')) <> 4 THEN
    RAISE EXCEPTION 'distribution double counts statuses';
  END IF;
  IF v_result->'status_catalog' IS DISTINCT FROM (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order)
    FROM public.equipment_status_catalog_list() c WHERE c.is_active
  ) THEN RAISE EXCEPTION 'distribution metadata lost catalog fields/order'; END IF;
  v_result := public.equipment_filter_buckets(p_don_vi => v_tenant);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'status') s
    WHERE s->>'name' = 'Legacy sửa chữa ngoài catalog' AND (s->>'count')::integer = 1) THEN
    RAISE EXCEPTION 'unknown historical bucket must preserve its selectable raw label';
  END IF;
  v_result := public.equipment_list_enhanced(p_don_vi => v_tenant,
    p_tinh_trang_array => ARRAY['Legacy sửa chữa ngoài catalog']);
  IF (v_result->>'total')::integer <> 1 OR (v_result #>> '{data,0,id}')::integer <> v_unknown THEN
    RAISE EXCEPTION 'historical status bucket cannot be selected in list';
  END IF;
  IF (SELECT sum(so_luong) FROM public.equipment_status_distribution(v_tenant, NULL::text, NULL::text)) <> 4
    OR NOT EXISTS (SELECT 1 FROM public.equipment_status_distribution(v_tenant, NULL::text, NULL::text)
      WHERE tinh_trang = 'Thanh lý nội bộ' AND so_luong = 1) THEN
    RAISE EXCEPTION 'legacy tabular distribution lost its counts/shape';
  END IF;

  FOREACH v_flag IN ARRAY ARRAY[false, true] LOOP
    v_result := public.equipment_list_enhanced(p_sort => 'ten_thiet_bi.asc',
      p_don_vi => v_tenant, p_page_size => 20, p_liquidation_last => v_flag);
    IF (v_result #>> '{data,3,id}')::integer <> v_terminal
      OR (v_result->>'total')::integer <> 4 THEN
      RAISE EXCEPTION 'liquidation must be last independent of department/flag: %', v_result;
    END IF;
    v_result := public.equipment_list_enhanced(p_sort => 'id.asc', p_don_vi => v_tenant,
      p_page => 2, p_page_size => 2, p_liquidation_last => v_flag);
    IF (v_result #>> '{data,1,id}')::integer <> v_terminal THEN
      RAISE EXCEPTION 'pagination changed liquidation rank';
    END IF;
    v_result := public.equipment_list_enhanced(p_sort => 'id.desc', p_don_vi => v_tenant,
      p_khoa_phong => 'Catalog department', p_liquidation_last => v_flag);
    IF (v_result #>> '{data,1,id}')::integer <> v_terminal
      OR (v_result #>> '{data,0,id}')::integer <> v_active THEN
      RAISE EXCEPTION 'single-department liquidation ordering changed';
    END IF;
    v_result := public.equipment_list_enhanced(p_sort => 'id.asc', p_don_vi => v_tenant,
      p_khoa_phong_array => ARRAY['Catalog department', 'VT-TBYT- KHO THANH LÍ'],
      p_page_size => 100, p_liquidation_last => v_flag);
    IF (v_result #>> '{data,2,id}')::integer <> v_terminal THEN
      RAISE EXCEPTION 'multi-department export liquidation ordering changed';
    END IF;
  END LOOP;

  EXECUTE 'RESET ROLE';
  -- Mixed liquidation shares one OR rank and date chronology; department alone never ranks.
  UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Ngưng sử dụng', ngay_ngung_su_dung = '2026-11-01'
    WHERE id = v_warehouse;
  UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Ngưng sử dụng', ngay_ngung_su_dung = '2026-09-01'
    WHERE id = v_active;
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_result := public.equipment_list_enhanced(p_don_vi => v_tenant,
    p_sort => 'ten_thiet_bi.asc', p_liquidation_last => true);
  IF (v_result #>> '{data,2,id}')::integer <> v_terminal
    OR (v_result #>> '{data,3,id}')::integer <> v_warehouse THEN
    RAISE EXCEPTION 'mixed catalog/legacy liquidation does not share date-ordered tail';
  END IF;
  v_result := public.equipment_list_enhanced(p_don_vi => v_tenant,
    p_sort => 'ten_thiet_bi.asc', p_liquidation_last => false);
  IF (v_result #>> '{data,0,id}')::integer <> v_warehouse
    OR (v_result #>> '{data,3,id}')::integer <> v_terminal THEN
    RAISE EXCEPTION 'legacy stopped warehouse lost flag-dependent ranking';
  END IF;
  EXECUTE 'RESET ROLE';
  UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Hoạt động', ngay_ngung_su_dung = NULL
    WHERE id IN (v_warehouse, v_active);
  SELECT jsonb_build_object('repairs', (SELECT count(*) FROM public.yeu_cau_sua_chua WHERE thiet_bi_id = v_terminal),
    'usage', (SELECT count(*) FROM public.nhat_ky_su_dung WHERE thiet_bi_id = v_terminal),
    'tasks', (SELECT count(*) FROM public.cong_viec_bao_tri WHERE ke_hoach_id = v_plan),
    'history', (SELECT count(*) FROM public.lich_su_thiet_bi WHERE thiet_bi_id = v_terminal),
    'zbs', (SELECT count(*) FROM public.zbs_notification_outbox WHERE don_vi_id = v_tenant),
    'push', (SELECT count(*) FROM public.web_push_notification_intents WHERE don_vi_id = v_tenant)) INTO v_before;
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOREACH v_sql IN ARRAY ARRAY[
    format('SELECT public.repair_request_create(%s,''gate'',''gate'',NULL,''gate'',NULL,NULL)', v_terminal),
    format('SELECT public.usage_session_start(%s::bigint)', v_terminal),
    format('SELECT public.maintenance_tasks_bulk_insert(%L::jsonb)', jsonb_build_array(
      jsonb_build_object('ke_hoach_id', v_plan, 'thiet_bi_id', v_active),
      jsonb_build_object('ke_hoach_id', v_plan, 'thiet_bi_id', v_terminal))),
    format('SELECT public.maintenance_task_update(%s,''{"ghi_chu":"blocked"}''::jsonb)', v_terminal_task),
    format('SELECT public.maintenance_task_update(%s,%L::jsonb)', v_task, jsonb_build_object('thiet_bi_id', v_terminal)),
    format('SELECT public.maintenance_task_complete(%s,1)', v_terminal_task),
    format('SELECT public.repair_request_approve(%s,''gate'',NULL,NULL)', v_approve)
  ] LOOP
    BEGIN
      EXECUTE v_sql;
      RAISE EXCEPTION 'terminal action unexpectedly succeeded: %', v_sql;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message <> 'equipment_status_blocks_operational_actions' THEN
        RAISE EXCEPTION 'wrong terminal guard message: %', v_message;
      END IF;
    END;
  END LOOP;
  EXECUTE 'RESET ROLE';
  SELECT jsonb_build_object('repairs', (SELECT count(*) FROM public.yeu_cau_sua_chua WHERE thiet_bi_id = v_terminal),
    'usage', (SELECT count(*) FROM public.nhat_ky_su_dung WHERE thiet_bi_id = v_terminal),
    'tasks', (SELECT count(*) FROM public.cong_viec_bao_tri WHERE ke_hoach_id = v_plan),
    'history', (SELECT count(*) FROM public.lich_su_thiet_bi WHERE thiet_bi_id = v_terminal),
    'zbs', (SELECT count(*) FROM public.zbs_notification_outbox WHERE don_vi_id = v_tenant),
    'push', (SELECT count(*) FROM public.web_push_notification_intents WHERE don_vi_id = v_tenant)) INTO v_after;
  IF v_after IS DISTINCT FROM v_before THEN RAISE EXCEPTION 'blocked RPC produced side effects'; END IF;
  IF (SELECT trang_thai FROM public.yeu_cau_sua_chua WHERE id = v_approve) <> 'Chờ xử lý' THEN
    RAISE EXCEPTION 'blocked approval mutated request';
  END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.repair_request_sync_equipment_status(v_terminal::bigint);
  PERFORM public.repair_request_update(v_approve, 'Historical metadata edit', 'gate', NULL, NULL, NULL);
  PERFORM public.repair_request_complete(v_complete, 'Historical closing', NULL, NULL);
  PERFORM public.repair_request_delete(v_delete);
  v_result := public.usage_session_end(v_usage);
  IF v_result->>'trang_thai' <> 'hoan_thanh' THEN
    RAISE EXCEPTION 'terminal transition blocked existing usage close';
  END IF;
  PERFORM public.equipment_update(v_terminal, '{"ten_thiet_bi":"Edited terminal metadata"}'::jsonb);
  EXECUTE 'RESET ROLE';
  SELECT ngay_ngung_su_dung INTO v_saved_date FROM public.thiet_bi WHERE id = v_terminal;
  IF v_saved_date <> '2026-10-01' OR (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_terminal) <> 'Thanh lý nội bộ' THEN
    RAISE EXCEPTION 'sync/complete/delete/metadata resurrected terminal equipment';
  END IF;
  IF (SELECT trang_thai FROM public.yeu_cau_sua_chua WHERE id = v_complete) <> 'Hoàn thành'
    OR EXISTS (SELECT 1 FROM public.yeu_cau_sua_chua WHERE id = v_delete) THEN
    RAISE EXCEPTION 'historical closing did not retain existing close rights';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'to_qltb',
    'role', 'authenticated', 'user_id', v_user::text, 'don_vi', v_other::text)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.repair_request_complete(v_approve, 'Unauthorized closing', NULL, NULL);
    RAISE EXCEPTION 'cross-tenant close unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.repair_request_delete(v_approve);
    RAISE EXCEPTION 'cross-tenant delete unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'to_qltb',
    'role', 'authenticated', 'user_id', v_user::text, 'don_vi', v_tenant::text)::text, true);
  -- Explicit restore is allowed; operating controls keep their old behavior.
  PERFORM public.equipment_update(v_terminal, '{"tinh_trang_hien_tai":"Hoạt động","ngay_ngung_su_dung":null}'::jsonb);
  PERFORM public.maintenance_task_update(v_task, '{"ghi_chu":"allowed"}'::jsonb);
  PERFORM public.maintenance_task_complete(v_task, 1);
  PERFORM public.maintenance_tasks_delete(ARRAY[v_task]::bigint[]);
  v_repair := public.repair_request_create(v_active, 'control', 'control', NULL, 'gate', NULL, NULL);
  PERFORM public.repair_request_approve(v_repair, 'gate', NULL, NULL);
  PERFORM public.repair_request_complete(v_repair, 'Control closing', NULL, NULL);
  PERFORM public.repair_request_delete(v_repair);
  PERFORM public.usage_session_start(v_active::bigint);
  EXECUTE 'RESET ROLE';
  IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_active) <> 'Hoạt động' THEN
    RAISE EXCEPTION 'non-terminal repair status behavior changed';
  END IF;
  -- No hardcoded seven-label ceiling in reports; inactive history remains counted.
  INSERT INTO public.equipment_status_catalog(status_value, display_order, is_active)
  VALUES ('Gate future status', 100, true), ('Gate retired history', 101, false);
  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, tinh_trang_hien_tai, don_vi, is_deleted, khoa_phong_quan_ly, vi_tri_lap_dat)
  VALUES ('CAT-RETIRED-' || v_suffix, 'Retired catalog history', 'Gate retired history', v_tenant, false, 'Gate historical department', 'Gate room');
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_result := public.equipment_status_distribution(p_q => NULL::text, p_don_vi => v_tenant);
  IF (v_result #>> '{status_counts,Gate future status}')::integer IS DISTINCT FROM 0
    OR (v_result #>> '{status_counts,Gate retired history}')::integer IS DISTINCT FROM 1
    OR (SELECT sum(value::integer) FROM jsonb_each_text(v_result->'status_counts')) <> 5 THEN
    RAISE EXCEPTION 'distribution hardcodes seven statuses or loses inactive history';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'by_department') g
      WHERE g->>'name' = 'Gate historical department'
        AND g->>'Gate retired history' = '1' AND g->>'Gate future status' = '0')
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'by_location') g
      WHERE g->>'name' = 'Gate room'
        AND g->>'Gate retired history' = '1' AND g->>'Gate future status' = '0') THEN
    RAISE EXCEPTION 'department/location distributions hardcode catalog status counts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.equipment_status_distribution(v_tenant, NULL::text, NULL::text)
    WHERE tinh_trang = 'Gate future status' AND so_luong = 0)
    OR NOT EXISTS (SELECT 1 FROM public.equipment_status_distribution(v_tenant, NULL::text, NULL::text)
    WHERE tinh_trang = 'Gate retired history' AND so_luong = 1) THEN
    RAISE EXCEPTION 'legacy distribution loses dynamic catalog zero/history counts';
  END IF;
  v_result := public.equipment_filter_buckets(p_don_vi => v_tenant);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'status_catalog') c
      WHERE c->>'status_value' = 'Gate retired history' AND c->>'is_active' = 'false')
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'status') c
      WHERE c->>'name' = 'Gate retired history' AND c->>'count' = '1') THEN
    RAISE EXCEPTION 'inactive known history metadata/count missing from buckets';
  END IF;
  EXECUTE 'RESET ROLE';
  UPDATE public.equipment_status_catalog SET is_active = false WHERE status_value = 'Hoạt động';
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_result := public.equipment_status_distribution(p_q => NULL::text, p_don_vi => v_tenant,
    p_khoa_phong => 'Gate historical department');
  IF v_result #>> '{status_counts,hoat_dong}' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'inactive legacy status lost wire-compatible zero key';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'regional_leader',
    'role', 'authenticated', 'user_id', v_user::text, 'don_vi', v_tenant::text)::text, true);
  v_result := public.equipment_status_distribution(p_q => NULL::text);
  IF v_result->'status_catalog' IS DISTINCT FROM (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order) FROM public.equipment_status_catalog_list() c
  ) OR (v_result->>'total_equipment')::integer <> 0
    OR v_result #>> '{status_counts,Gate future status}' IS DISTINCT FROM '0' THEN
    RAISE EXCEPTION 'successful regional empty response lacks catalog metadata';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'user',
    'role', 'authenticated', 'user_id', v_user::text, 'don_vi', v_tenant::text)::text, true);
  v_result := public.equipment_filter_buckets();
  IF v_result->'status_catalog' IS DISTINCT FROM (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order) FROM public.equipment_status_catalog_list() c
  ) OR v_result->'department' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'successful missing-department empty buckets lack catalog metadata';
  END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS: equipment catalog consumers real RPC contracts';
END;
$$;

ROLLBACK;
