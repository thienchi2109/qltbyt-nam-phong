-- Real catalog/create/update contract; execute only in disposable gate clones.
-- Supplementary TypeScript mocks do not establish this SQL contract.
BEGIN;

DO $$
DECLARE
  v_expected text[] := ARRAY[
    'Hoạt động', 'Chờ sửa chữa', 'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định', 'Ngưng sử dụng',
    'Chưa có nhu cầu sử dụng', 'Thanh lý nội bộ'
  ];
  v_labels text[];
  v_tenant bigint;
  v_user_id bigint;
  v_equipment public.thiet_bi;
  v_status text;
  v_index integer := 0;
  v_message text;
  v_other_tenant bigint;
  v_case record;
  v_import jsonb;
  v_saved_date text;
  v_suffix text := txid_current()::text;
  v_today text := to_char(transaction_timestamp()
    AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Equipment status catalog gate ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES ('status_catalog_' || v_suffix, 'smoke-password',
    'Equipment status catalog gate', 'to_qltb', v_tenant, v_tenant)
  RETURNING id INTO v_user_id;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Other catalog gate ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;
  UPDATE public.nhan_vien SET khoa_phong = 'Catalog department' WHERE id = v_user_id;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'to_qltb', 'role', 'authenticated',
    'user_id', v_user_id::text, 'sub', v_user_id::text,
    'don_vi', v_tenant::text
  )::text, true);

  -- Claims alone do not prove grants/RLS: exercise the actual Data API role.
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'fixture did not enter authenticated role';
  END IF;

  SELECT array_agg(c.status_value ORDER BY c.ordinality)
  INTO v_labels
  FROM public.equipment_status_catalog_list() WITH ORDINALITY c;
  IF v_labels IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'catalog must return exactly seven labels in order: %', v_labels;
  END IF;

  IF (SELECT count(DISTINCT display_order)
      FROM public.equipment_status_catalog_list()) <> 7
    OR EXISTS (
      SELECT 1 FROM (
        SELECT display_order,
          lag(display_order) OVER (ORDER BY ordinality) AS previous_order
        FROM public.equipment_status_catalog_list() WITH ORDINALITY
      ) ordered WHERE display_order <= previous_order
    ) THEN
    RAISE EXCEPTION 'catalog display_order must be unique and ascending';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.equipment_status_catalog_list()
    WHERE is_active IS DISTINCT FROM true
      OR is_terminal IS DISTINCT FROM (status_value IN ('Ngưng sử dụng', 'Thanh lý nội bộ'))
      OR requires_end_date IS DISTINCT FROM (status_value = 'Thanh lý nội bộ')
      OR blocks_operational_actions IS DISTINCT FROM (status_value = 'Thanh lý nội bộ')
      OR is_liquidation IS DISTINCT FROM (status_value = 'Thanh lý nội bộ')
      OR (requires_end_date AND NOT is_terminal)
  ) THEN
    RAISE EXCEPTION 'catalog flags changed: terminal alone must not require a date or block all actions';
  END IF;

  -- Each active stored label must pass the real create and update admission paths.
  FOREACH v_status IN ARRAY v_expected LOOP
    v_index := v_index + 1;
    SELECT * INTO v_equipment
    FROM public.equipment_create(jsonb_build_object(
      'ma_thiet_bi', 'STATUS-CATALOG-' || v_suffix || '-' || v_index,
      'ten_thiet_bi', 'Equipment status catalog gate',
      'tinh_trang_hien_tai', v_status
    ));
    IF v_equipment.tinh_trang_hien_tai IS DISTINCT FROM v_status
      OR v_equipment.don_vi IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'create did not persist tenant/status: %', v_status;
    END IF;
    IF v_status = 'Thanh lý nội bộ'
      AND v_equipment.ngay_ngung_su_dung IS DISTINCT FROM v_today THEN
      RAISE EXCEPTION 'liquidation create must autofill the Vietnam calendar date';
    END IF;
    IF v_status = 'Ngưng sử dụng' AND v_equipment.ngay_ngung_su_dung IS NOT NULL THEN
      RAISE EXCEPTION 'Ngưng sử dụng must retain optional server end date';
    END IF;

    PERFORM public.equipment_update(v_equipment.id,
      '{"tinh_trang_hien_tai":"Hoạt động","ngay_ngung_su_dung":null}'::jsonb);
    PERFORM public.equipment_update(v_equipment.id,
      jsonb_build_object('tinh_trang_hien_tai', v_status));
    IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_equipment.id)
      IS DISTINCT FROM v_status THEN
      RAISE EXCEPTION 'update did not persist status: %', v_status;
    END IF;
  END LOOP;

  -- Catch only the existing invalid-parameter state; sentinel errors cannot be swallowed.
  BEGIN
    PERFORM public.equipment_create(jsonb_build_object(
      'ma_thiet_bi', 'STATUS-UNKNOWN-' || v_suffix,
      'ten_thiet_bi', 'Invalid status gate', 'tinh_trang_hien_tai', 'UNKNOWN-GATE'
    ));
    RAISE EXCEPTION 'unknown create status was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE 'Invalid status: UNKNOWN-GATE. Must be one of: %' THEN
      RAISE EXCEPTION 'unexpected create invalid-status message: %', v_message;
    END IF;
  END;

  BEGIN
    PERFORM public.equipment_update(v_equipment.id,
      '{"tinh_trang_hien_tai":"UNKNOWN-GATE"}'::jsonb);
    RAISE EXCEPTION 'unknown update status was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message NOT LIKE 'Invalid status: UNKNOWN-GATE. Must be one of: %' THEN
      RAISE EXCEPTION 'unexpected update invalid-status message: %', v_message;
    END IF;
  END;
  IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_equipment.id)
    IS DISTINCT FROM 'Thanh lý nội bộ' THEN
    RAISE EXCEPTION 'rejected update changed the stored status';
  END IF;

  SELECT * INTO v_equipment
  FROM public.equipment_create(jsonb_build_object(
    'ma_thiet_bi', 'STATUS-NULL-' || v_suffix,
    'ten_thiet_bi', 'Nullable status gate', 'tinh_trang_hien_tai', NULL
  ));
  IF v_equipment.tinh_trang_hien_tai IS NOT NULL THEN
    RAISE EXCEPTION 'create must retain the nullable status contract';
  END IF;
  PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":"Hoạt động"}'::jsonb);
  PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":null}'::jsonb);
  IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_equipment.id) IS NOT NULL THEN
    RAISE EXCEPTION 'update must retain the nullable status contract';
  END IF;

  -- Create blank/null dates only autofill the new requires_end_date status.
  FOR v_case IN SELECT value FROM (VALUES (NULL::text), (' '), ('2026-01-02')) d(value) LOOP
    v_index := v_index + 1;
    SELECT * INTO v_equipment FROM public.equipment_create(jsonb_build_object(
      'ma_thiet_bi', 'STATUS-DATE-' || v_suffix || '-' || v_index,
      'ten_thiet_bi', 'Date catalog gate', 'tinh_trang_hien_tai', 'Thanh lý nội bộ',
      'ngay_ngung_su_dung', v_case.value
    ));
    IF v_equipment.ngay_ngung_su_dung IS DISTINCT FROM COALESCE(NULLIF(TRIM(v_case.value), ''), v_today) THEN
      RAISE EXCEPTION 'create must prefer explicit date and autofill absent date';
    END IF;
  END LOOP;

  -- Explicit entry with an omitted/blank/null key autofills; supplied dates win.
  FOR v_case IN SELECT patch FROM (VALUES
    ('{}'::jsonb), ('{"ngay_ngung_su_dung":" "}'::jsonb),
    ('{"ngay_ngung_su_dung":null}'::jsonb), ('{"ngay_ngung_su_dung":"2026-01-02"}'::jsonb)
  ) d(patch) LOOP
    PERFORM public.equipment_update(v_equipment.id,
      '{"tinh_trang_hien_tai":"Hoạt động","ngay_ngung_su_dung":null}'::jsonb);
    PERFORM public.equipment_update(v_equipment.id,
      v_case.patch || '{"tinh_trang_hien_tai":"Thanh lý nội bộ"}'::jsonb);
    SELECT ngay_ngung_su_dung INTO v_saved_date FROM public.thiet_bi WHERE id = v_equipment.id;
    IF v_saved_date IS DISTINCT FROM COALESCE(NULLIF(TRIM(v_case.patch->>'ngay_ngung_su_dung'), ''), v_today) THEN
      RAISE EXCEPTION 'explicit transition did not persist the effective date';
    END IF;
  END LOOP;
  PERFORM public.equipment_update(v_equipment.id,
    '{"tinh_trang_hien_tai":"Ngưng sử dụng","ngay_ngung_su_dung":"2026-01-02"}'::jsonb);
  PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":"Thanh lý nội bộ"}'::jsonb);
  IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id) <> '2026-01-02' THEN
    RAISE EXCEPTION 'entry must retain a valid existing date';
  END IF;

  -- Unknown writes, invalid ISO/calendar dates, chronology and terminal clearing fail.
  FOR v_case IN SELECT patch FROM (VALUES
    ('{"ngay_ngung_su_dung":null}'::jsonb),
    ('{"ngay_ngung_su_dung":" "}'::jsonb),
    ('{"tinh_trang_hien_tai":"Hoạt động"}'::jsonb),
    ('{"tinh_trang_hien_tai":null}'::jsonb),
    ('{"ngay_ngung_su_dung":"2026-2-03"}'::jsonb),
    ('{"ngay_ngung_su_dung":"2026-02-30"}'::jsonb),
    ('{"ngay_ngung_su_dung":"2026-13-01"}'::jsonb),
    ('{"ngay_ngung_su_dung":"2026-01-01","ngay_dua_vao_su_dung":"2026-01-02"}'::jsonb)
  ) d(patch) LOOP
    BEGIN
      PERFORM public.equipment_update(v_equipment.id, v_case.patch);
      RAISE EXCEPTION 'invalid date/transition was accepted: %', v_case.patch;
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
  END LOOP;
  FOR v_case IN SELECT value FROM (VALUES ('2026-2-03'), ('2026-02-30'), ('2026-13-01')) d(value) LOOP
    BEGIN
      PERFORM public.equipment_create(jsonb_build_object(
        'ma_thiet_bi', 'INVALID-DATE-' || v_suffix, 'ten_thiet_bi', 'Invalid date gate',
        'tinh_trang_hien_tai', 'Thanh lý nội bộ', 'ngay_ngung_su_dung', v_case.value
      ));
      RAISE EXCEPTION 'invalid create date was accepted: %', v_case.value;
    EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
    END;
  END LOOP;

  SELECT public.equipment_bulk_import(jsonb_build_array(
    jsonb_build_object('ma_thiet_bi', 'IMPORT-UNKNOWN-' || v_suffix,
      'ten_thiet_bi', 'Unknown import', 'tinh_trang_hien_tai', 'UNKNOWN-GATE'),
    jsonb_build_object('ma_thiet_bi', 'IMPORT-VALID-' || v_suffix,
      'ten_thiet_bi', 'Valid import', 'tinh_trang_hien_tai', 'Thanh lý nội bộ')
  )) INTO v_import;
  IF (v_import->>'inserted')::integer IS DISTINCT FROM 1 OR (v_import->>'failed')::integer IS DISTINCT FROM 1
    OR v_import->'details'->0->>'error' NOT LIKE 'Invalid status: UNKNOWN-GATE. Must be one of: %' THEN
    RAISE EXCEPTION 'bulk import must retain per-row catalog validation: %', v_import;
  END IF;

  -- Privileged setup only: simulate inactive/historical fixtures inside rollback.
  FOR v_case IN SELECT value FROM (VALUES (''::text), ('   ')) d(value) LOOP
    EXECUTE 'RESET ROLE';
    UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Thanh lý nội bộ',
      ngay_ngung_su_dung = v_case.value WHERE id = v_equipment.id;
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"required historical blank metadata"}'::jsonb);
    IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id)
      IS DISTINCT FROM v_case.value THEN
      RAISE EXCEPTION 'metadata-only required terminal blank date must stay raw';
    END IF;
    EXECUTE 'RESET ROLE';
    UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Ngưng sử dụng',
      ngay_ngung_su_dung = v_case.value WHERE id = v_equipment.id;
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"historical blank metadata"}'::jsonb);
    PERFORM public.equipment_update(v_equipment.id,
      '{"tinh_trang_hien_tai":"Ngưng sử dụng","ghi_chu":"historical blank metadata"}'::jsonb);
    IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id)
      IS DISTINCT FROM v_case.value THEN
      RAISE EXCEPTION 'metadata-only historical blank date must stay raw, not normalized or backfilled';
    END IF;
    PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":"Thanh lý nội bộ"}'::jsonb);
    IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id)
      IS DISTINCT FROM v_today THEN
      RAISE EXCEPTION 'explicit entry must autofill an existing blank date using the Vietnam date';
    END IF;
  END LOOP;
  EXECUTE 'RESET ROLE';
  UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'Thanh lý nội bộ', ngay_ngung_su_dung = NULL
    WHERE id = v_equipment.id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"historical metadata only"}'::jsonb);
  IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id) IS NOT NULL THEN
    RAISE EXCEPTION 'metadata-only update must never backfill historical terminal date';
  END IF;
  EXECUTE 'RESET ROLE';
  UPDATE public.equipment_status_catalog SET is_active = false WHERE status_value = 'Thanh lý nội bộ';
  UPDATE public.thiet_bi SET ngay_ngung_su_dung = '2026-01-02' WHERE id = v_equipment.id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"inactive metadata only"}'::jsonb);
  PERFORM public.equipment_update(v_equipment.id,
    '{"tinh_trang_hien_tai":"Thanh lý nội bộ","ghi_chu":"inactive current status metadata"}'::jsonb);
  IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_equipment.id)
    IS DISTINCT FROM 'Thanh lý nội bộ' THEN
    RAISE EXCEPTION 'same known inactive status must remain editable without transition';
  END IF;
  IF (SELECT ngay_ngung_su_dung FROM public.thiet_bi WHERE id = v_equipment.id) <> '2026-01-02'
    OR NOT EXISTS (SELECT 1 FROM public.equipment_status_catalog_list()
      WHERE status_value = 'Thanh lý nội bộ' AND NOT is_active) THEN
    RAISE EXCEPTION 'inactive known status/date and read catalog row must be preserved';
  END IF;
  BEGIN
    PERFORM public.equipment_create(jsonb_build_object(
      'ma_thiet_bi', 'INACTIVE-' || v_suffix, 'ten_thiet_bi', 'Inactive create',
      'tinh_trang_hien_tai', 'Thanh lý nội bộ'
    ));
    RAISE EXCEPTION 'inactive create accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  PERFORM public.equipment_update(v_equipment.id,
    '{"tinh_trang_hien_tai":"Hoạt động","ngay_ngung_su_dung":null}'::jsonb);
  BEGIN
    PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":"Thanh lý nội bộ"}'::jsonb);
    RAISE EXCEPTION 'inactive entry accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  UPDATE public.thiet_bi SET tinh_trang_hien_tai = 'UNKNOWN-HISTORICAL' WHERE id = v_equipment.id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"unknown historical metadata"}'::jsonb);
  IF (SELECT tinh_trang_hien_tai FROM public.thiet_bi WHERE id = v_equipment.id) <> 'UNKNOWN-HISTORICAL' THEN
    RAISE EXCEPTION 'unknown historical status must be preserved without rewrite';
  END IF;
  BEGIN
    PERFORM public.equipment_update(v_equipment.id, '{"tinh_trang_hien_tai":"UNKNOWN-HISTORICAL"}'::jsonb);
    RAISE EXCEPTION 'explicit unknown historical value accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Preserve the existing tenant and department guards using the actual role.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'to_qltb',
    'user_id', v_user_id::text, 'don_vi', v_other_tenant::text)::text, true);
  BEGIN
    PERFORM public.equipment_update(v_equipment.id, '{"ghi_chu":"cross tenant"}'::jsonb);
    RAISE EXCEPTION 'cross-tenant write accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Access denied for update' THEN RAISE EXCEPTION 'wrong tenant guard: %', v_message; END IF;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role', 'technician',
    'user_id', v_user_id::text, 'don_vi', v_tenant::text)::text, true);
  BEGIN
    PERFORM public.equipment_create(jsonb_build_object('ma_thiet_bi', 'DEPT-' || v_suffix,
      'ten_thiet_bi', 'Denied department', 'khoa_phong_quan_ly', 'Other department'));
    RAISE EXCEPTION 'technician cross-department create accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'Technician department mismatch' THEN RAISE EXCEPTION 'wrong department guard: %', v_message; END IF;
  END;
  BEGIN
    PERFORM public.equipment_update(v_equipment.id, '{"khoa_phong_quan_ly":"Other department"}'::jsonb);
    RAISE EXCEPTION 'technician cross-department update accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.equipment_update(v_equipment.id, '{"khoa_phong_quan_ly":"Catalog department"}'::jsonb);
  EXECUTE 'RESET ROLE';
END;
$$;

DO $$
DECLARE
  v_role text;
  v_operation text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.equipment_status_catalog'::regclass)
    OR (SELECT count(*) FROM pg_policy
      WHERE polrelid = 'public.equipment_status_catalog'::regclass) <> 1
    OR NOT EXISTS (SELECT 1 FROM pg_policy
      WHERE polrelid = 'public.equipment_status_catalog'::regclass
        AND polcmd = 'r' AND polroles = ARRAY['authenticated'::regrole::oid]) THEN
    RAISE EXCEPTION 'catalog RLS must contain only authenticated SELECT';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(v_role, 'public.equipment_status_catalog', v_operation) THEN
        RAISE EXCEPTION 'catalog privilege leaked: % %', v_role, v_operation;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_table_privilege('authenticated', 'public.equipment_status_catalog', 'SELECT')
    OR NOT has_function_privilege('authenticated', 'public.equipment_status_catalog_list()', 'EXECUTE')
    OR has_table_privilege('anon', 'public.equipment_status_catalog', 'SELECT')
    OR has_function_privilege('anon', 'public.equipment_status_catalog_list()', 'EXECUTE')
    OR has_function_privilege('service_role', 'public.equipment_status_catalog_list()', 'EXECUTE')
    OR EXISTS (SELECT 1 FROM pg_proc
      WHERE oid = 'public.equipment_status_catalog_list()'::regprocedure
        AND (prosecdef OR provolatile <> 's'
          OR NOT proconfig @> ARRAY['search_path=public, pg_temp'])) THEN
    RAISE EXCEPTION 'catalog read RPC ACL/security contract changed';
  END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM status_value FROM public.equipment_status_catalog;
  PERFORM status_value FROM public.equipment_status_catalog_list();
  BEGIN
    INSERT INTO public.equipment_status_catalog(status_value, display_order) VALUES ('Forbidden', 8);
    RAISE EXCEPTION 'authenticated catalog INSERT accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.equipment_status_catalog SET is_active = true;
    RAISE EXCEPTION 'authenticated catalog UPDATE accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.equipment_status_catalog;
    RAISE EXCEPTION 'authenticated catalog DELETE accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM status_value FROM public.equipment_status_catalog_list();
    RAISE EXCEPTION 'anon catalog RPC accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM status_value FROM public.equipment_status_catalog;
    RAISE EXCEPTION 'anon catalog SELECT accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
END;
$$;

ROLLBACK;
