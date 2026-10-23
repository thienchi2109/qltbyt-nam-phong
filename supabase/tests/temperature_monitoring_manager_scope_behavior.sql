-- Equipment managers operate within their tenant, independently of their department claim.
BEGIN;

CREATE FUNCTION pg_temp.tm_manager_expect_denied(p_sql TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected permission denial, statement succeeded: %',p_sql;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

DO $$
DECLARE
  actor BIGINT;
  tenant BIGINT;
  department TEXT;
  other_tenant BIGINT;
  equipment BIGINT;
  foreign_equipment BIGINT;
  configured_equipment BIGINT;
  profile UUID;
  current_slot RECORD;
  monitoring_date DATE;
  result JSONB;
  choices JSONB;
  claims JSONB;
  saved public.temperature_monitoring_configurations;
BEGIN
  SELECT n.id,n.don_vi,n.khoa_phong INTO actor,tenant,department
  FROM public.nhan_vien n
  WHERE COALESCE(n.is_active,TRUE) AND n.don_vi IS NOT NULL
    AND (n.current_don_vi IS NULL OR n.current_don_vi=n.don_vi)
    AND public._normalize_department_scope(n.khoa_phong) IS NOT NULL
  ORDER BY n.id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'manager scope test needs active tenant staff'; END IF;
  SELECT d.id INTO other_tenant FROM public.don_vi d WHERE d.id<>tenant ORDER BY d.id LIMIT 1;
  IF other_tenant IS NULL THEN RAISE EXCEPTION 'manager scope test needs a second tenant'; END IF;
  SELECT p.id INTO profile FROM public.temperature_monitoring_schedule_profiles p WHERE p.code='default';

  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM-MANAGER-'||gen_random_uuid(),'TM manager scope fixture',tenant,department,'Hoạt động')
  RETURNING id INTO equipment;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM-MANAGER-FOREIGN-'||gen_random_uuid(),'TM manager foreign fixture',other_tenant,department,'Hoạt động')
  RETURNING id INTO foreign_equipment;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM-MANAGER-ACTIVE-'||gen_random_uuid(),'TM manager active fixture',tenant,department,'Hoạt động')
  RETURNING id INTO configured_equipment;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled)
  VALUES(configured_equipment,TRUE),(foreign_equipment,TRUE);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,monitoring_enabled,
    lower_c,upper_c,schedule_profile_id,display_timezone,responsible_primary_user_id,recording_method_code,change_reason,created_by)
  SELECT fixture_id,tstzrange(statement_timestamp()-INTERVAL '2 days',NULL,'[)'),TRUE,
    2,8,profile,'Asia/Ho_Chi_Minh',actor,'manual','Manager scope current policy fixture',actor
  FROM unnest(ARRAY[configured_equipment,foreign_equipment]) AS fixtures(fixture_id);

  claims:=jsonb_build_object('app_role','to_qltb','user_id',actor,'don_vi',tenant,
    'khoa_phong','TM unrelated department '||gen_random_uuid());
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  choices:=public.temperature_monitoring_configuration_choices(equipment);
  IF choices->>'suggested_effective_from' IS NULL THEN
    RAISE EXCEPTION 'same-tenant manager must load configuration choices across departments';
  END IF;
  PERFORM public.temperature_monitoring_staff_choices(equipment,NULL,NULL,25);
  SELECT * INTO saved FROM public.temperature_monitoring_configuration_upsert(
    equipment,TRUE,(choices->>'suggested_effective_from')::TIMESTAMPTZ,NULL,2,8,profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','Tenant manager cross-department enable');
  IF saved.equipment_id IS DISTINCT FROM equipment OR NOT EXISTS(
    SELECT 1 FROM public.temperature_monitoring_configuration_versions v
    WHERE v.equipment_id=equipment AND v.monitoring_enabled AND v.created_by=actor
  ) THEN RAISE EXCEPTION 'same-tenant manager must save configuration across departments'; END IF;

  PERFORM public.temperature_monitoring_configuration_history(equipment);
  SELECT s.* INTO current_slot FROM public.temperature_monitoring_slots_list(
    CURRENT_DATE-1,CURRENT_DATE+1,NULL,configured_equipment,NULL,200,FALSE) s
  WHERE s.slot_start<=statement_timestamp() AND s.slot_end>statement_timestamp();
  IF current_slot.shift_id IS NULL THEN
    RAISE EXCEPTION 'same-tenant manager must see current slots across departments';
  END IF;
  monitoring_date:=current_slot.monitoring_date;
  result:=public.temperature_monitoring_measurement_create(configured_equipment,monitoring_date,
    current_slot.shift_id,9.2,NULL,statement_timestamp(),'Manager cross-department reading');
  IF result->>'outcome'<>'created' THEN
    RAISE EXCEPTION 'same-tenant manager must record a measurement across departments';
  END IF;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role','global'))::TEXT,TRUE);
  result:=public.temperature_monitoring_measurement_create(foreign_equipment,monitoring_date,
    current_slot.shift_id,9.2,NULL,statement_timestamp(),'Foreign tenant fixture reading');
  IF result->>'outcome'<>'created' THEN RAISE EXCEPTION 'foreign fixture reading missing'; END IF;
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=public.temperature_monitoring_workspace_list(monitoring_date,monitoring_date,configured_equipment);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') item WHERE item->>'reading_id' IS NOT NULL) THEN
    RAISE EXCEPTION 'same-tenant manager workspace must include saved reading';
  END IF;
  result:=public.temperature_monitoring_export_page(monitoring_date,monitoring_date,configured_equipment);
  IF jsonb_array_length(result->'items')<>1 THEN
    RAISE EXCEPTION 'same-tenant manager export must include saved reading';
  END IF;
  result:=public.temperature_monitoring_deviations_list(monitoring_date,monitoring_date,configured_equipment);
  IF jsonb_array_length(result->'items')<>1 THEN
    RAISE EXCEPTION 'same-tenant manager must see deviation created across departments';
  END IF;

  -- Exercise each duplicated tenant predicate without an equipment filter.
  IF EXISTS(SELECT 1 FROM public.temperature_monitoring_slots_list(monitoring_date,monitoring_date) s
    WHERE s.equipment_id=foreign_equipment) THEN RAISE EXCEPTION 'slots leaked foreign tenant'; END IF;
  result:=public.temperature_monitoring_workspace_list(monitoring_date,monitoring_date);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') item
    WHERE (item->>'equipment_id')::BIGINT=foreign_equipment) THEN RAISE EXCEPTION 'workspace leaked foreign tenant'; END IF;
  result:=public.temperature_monitoring_export_page(monitoring_date,monitoring_date);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') item
    WHERE (item->>'equipment_id')::BIGINT=foreign_equipment) THEN RAISE EXCEPTION 'export leaked foreign tenant'; END IF;
  result:=public.temperature_monitoring_deviations_list(monitoring_date,monitoring_date);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(result->'items') item
    WHERE (item->>'equipment_id')::BIGINT=foreign_equipment) THEN RAISE EXCEPTION 'deviations leaked foreign tenant'; END IF;

  PERFORM pg_temp.tm_manager_expect_denied(format(
    'SELECT public.temperature_monitoring_configuration_choices(%s)',foreign_equipment));
  PERFORM pg_temp.tm_manager_expect_denied(format(
    'SELECT * FROM public._temperature_monitoring_assert_scope(%s,TRUE)',foreign_equipment));

  -- Managers need a tenant claim, but do not need a department claim.
  PERFORM set_config('request.jwt.claims',(claims-'khoa_phong')::TEXT,TRUE);
  PERFORM public.temperature_monitoring_configuration_choices(equipment);
  PERFORM public.temperature_monitoring_slots_list(monitoring_date,monitoring_date,NULL,configured_equipment);
  PERFORM public.temperature_monitoring_export_page(monitoring_date,monitoring_date,configured_equipment);
  PERFORM public.temperature_monitoring_deviations_list(monitoring_date,monitoring_date,configured_equipment);
  PERFORM set_config('request.jwt.claims',(claims-'don_vi')::TEXT,TRUE);
  PERFORM pg_temp.tm_manager_expect_denied(format(
    'SELECT public.temperature_monitoring_configuration_choices(%s)',equipment));

  PERFORM set_config('request.jwt.claims',(claims-'app_role'-'role')::TEXT,TRUE);
  PERFORM pg_temp.tm_manager_expect_denied(format(
    'SELECT * FROM public.temperature_monitoring_configuration_history(%s)',equipment));
  PERFORM set_config('request.jwt.claims',(claims-'user_id')::TEXT,TRUE);
  PERFORM pg_temp.tm_manager_expect_denied(format(
    'SELECT * FROM public.temperature_monitoring_configuration_history(%s)',equipment));

  -- Preserve the department restriction for every other existing non-global role.
  FOR claims IN SELECT jsonb_build_object('app_role',role_name,'user_id',actor,'don_vi',tenant,
      'khoa_phong','TM unrelated department')
    FROM unnest(ARRAY['user','qltb_khoa','technician','regional_leader']) AS roles(role_name)
  LOOP
    PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
    PERFORM pg_temp.tm_manager_expect_denied(format(
      'SELECT * FROM public.temperature_monitoring_configuration_get(%s)',equipment));
    PERFORM set_config('request.jwt.claims',jsonb_set(claims,'{khoa_phong}',to_jsonb(department))::TEXT,TRUE);
    PERFORM public.temperature_monitoring_configuration_get(equipment);
  END LOOP;
  RAISE NOTICE 'PASS: manager tenant scope, configuration save, cross-tenant denial and department roles';
END $$;

ROLLBACK;
