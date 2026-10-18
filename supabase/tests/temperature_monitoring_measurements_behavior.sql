-- TM-04 runtime contracts; fixtures and injected audit failures are rolled back.
BEGIN;

CREATE FUNCTION pg_temp.tm04_expect_error(p_sql TEXT, p_state TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded: %', p_state, p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE <> p_state THEN RAISE; END IF;
END;
$$;

DO $$
DECLARE
  tenant BIGINT;
  actor BIGINT;
  equipment BIGINT;
  profile UUID;
  shift UUID;
  version UUID;
  result JSONB;
  original JSONB;
  slot RECORD;
  cursor_value TEXT;
  role_name TEXT;
  bad_value TEXT;
  claims JSONB;
BEGIN
  SELECT id INTO tenant FROM public.don_vi ORDER BY id LIMIT 1;
  SELECT id INTO actor FROM public.nhan_vien ORDER BY id LIMIT 1;
  IF tenant IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'TM04 requires tenant and actor fixtures'; END IF;
  INSERT INTO public.thiet_bi (ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES ('TM04-'||gen_random_uuid(),'TM04 rollback fixture',tenant,'TM04 Fixture','Hoạt động')
  RETURNING id INTO equipment;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES ('tm04-fixture','TM04 manual method') ON CONFLICT DO NOTHING;
  INSERT INTO public.temperature_monitoring_configuration_versions
    (equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
  VALUES (equipment,tstzrange('2026-07-01 00:00Z','2026-07-08 17:00Z','[)'),2,8,profile,'tm04-fixture',actor,'TM04 fixture')
  RETURNING id INTO version;
  INSERT INTO public.temperature_monitoring_configuration_versions
    (equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
  VALUES (equipment,tstzrange('2026-07-08 17:00Z','2026-07-10 00:00Z','[)'),5,7,profile,'tm04-fixture',actor,'TM04 mid-shift change');
  claims := jsonb_build_object('app_role','to_qltb','user_id',actor,'don_vi',tenant,'khoa_phong',' TM04 Fixture ');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);

  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,2,NULL,'2026-07-03 00:00Z','lower edge');
  IF result->>'outcome' <> 'created' OR result->>'slot_status' <> 'Đã ghi' THEN RAISE EXCEPTION 'inclusive lower edge: %',result; END IF;
  original := result->'reading';
  IF original->>'source' <> 'manual' OR (original->>'operator_user_id')::BIGINT <> actor
    OR original->>'note' <> 'lower edge' OR (original->>'captured_at')::TIMESTAMPTZ <> '2026-07-03 00:00Z'
    OR (original->>'configuration_version_id')::UUID <> version
    OR (original->>'lower_c')::NUMERIC <> 2 OR (original->>'upper_c')::NUMERIC <> 8
    OR original->'snapshot'->>'display_timezone' <> 'Asia/Ho_Chi_Minh'
    OR original->'snapshot'->>'recording_method_code' <> 'tm04-fixture'
    OR (original->'snapshot'->>'slot_end')::TIMESTAMPTZ <= (original->'snapshot'->>'slot_start')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'trusted snapshot/observation fields missing: %',original;
  END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,9,NULL,'2026-07-03 00:01Z');
  IF result->>'outcome' <> 'conflict' OR result->'reading' <> original OR result->>'next_action' <> 'amendment' THEN
    RAISE EXCEPTION 'duplicate did not preserve canonical reading: %',result;
  END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-03',shift,8);
  IF result->>'slot_status' <> 'Đã ghi' THEN RAISE EXCEPTION 'inclusive upper edge failed'; END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-04',shift,8.1);
  IF result->>'slot_status' <> 'Chờ xác nhận' OR (SELECT count(*) FROM public.temperature_monitoring_reading_events WHERE reading_id=(result->'reading'->>'id')::UUID AND event_type='deviation_created') <> 1 THEN
    RAISE EXCEPTION 'breach event missing: %',result;
  END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-05',shift,NULL,'Thiết bị đang vệ sinh');
  IF result->>'slot_status' <> 'Chờ xác nhận' OR result->'reading'->'unable_reason'->>'reason' <> 'Thiết bị đang vệ sinh' THEN
    RAISE EXCEPTION 'unable-to-measure reason failed: %',result;
  END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-07',shift,1.9);
  IF result->>'slot_status' <> 'Chờ xác nhận' OR NOT EXISTS (
    SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=(result->'reading'->>'id')::UUID
      AND event_type='deviation_created' AND after_state->>'direction'='below'
  ) THEN RAISE EXCEPTION 'lower threshold breach event failed'; END IF;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-08',shift,2,NULL,'2026-07-09 00:00Z');
  IF result->>'slot_status' <> 'Đã ghi' OR (result->'reading'->>'configuration_version_id')::UUID <> version THEN
    RAISE EXCEPTION 'capture time incorrectly selected mid-shift policy: %',result;
  END IF;
  BEGIN
    result := public.temperature_monitoring_measurement_create(equipment,'2026-07-06',shift,-200.0);
    IF result->>'slot_status' <> 'Chờ xác nhận' OR (result->'reading'->>'value_c')::NUMERIC <> -200.0
      OR NOT EXISTS (SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=(result->'reading'->>'id')::UUID AND event_type='deviation_created') THEN
      RAISE EXCEPTION 'physical lower endpoint did not persist with device-threshold breach: %',result;
    END IF;
    result := public.temperature_monitoring_measurement_create(equipment,'2026-07-09',shift,300.0);
    IF result->>'slot_status' <> 'Chờ xác nhận' OR (result->'reading'->>'value_c')::NUMERIC <> 300.0
      OR NOT EXISTS (SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=(result->'reading'->>'id')::UUID AND event_type='deviation_created') THEN
      RAISE EXCEPTION 'physical upper endpoint did not persist with device-threshold breach: %',result;
    END IF;
    RAISE EXCEPTION 'rollback endpoint fixtures' USING ERRCODE='PT499';
  EXCEPTION WHEN SQLSTATE 'PT499' THEN NULL;
  END;
  FOREACH bad_value IN ARRAY ARRAY['NaN','Infinity','-Infinity','2.01','-200.1','300.1'] LOOP
    PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,%L::numeric)',equipment,'2026-07-06',shift,bad_value),'22023');
    PERFORM pg_temp.tm04_expect_error(format('INSERT INTO public.temperature_readings(equipment_id,monitoring_date,shift_id,configuration_version_id,value_c,lower_c,upper_c,snapshot,operator_user_id,captured_at) SELECT equipment_id,monitoring_date+30,shift_id,configuration_version_id,%L::numeric,lower_c,upper_c,snapshot,operator_user_id,captured_at FROM public.temperature_readings WHERE id=%L',bad_value,original->>'id'),'23514');
  END LOOP;
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L)',equipment,'2026-07-06',shift),'22023');
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,NULL,%L)',equipment,'2026-07-06',shift,'  '),'22023');
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,%L)',equipment,'2026-07-06',shift,'reason'),'22023');
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,NULL,%L)',equipment,'2026-07-06',shift,'infinity'),'22023');
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-11',shift),'22023');

  FOREACH role_name IN ARRAY ARRAY['regional_leader','unknown',''] LOOP
    PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role',role_name))::TEXT,TRUE);
    PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  END LOOP;
  PERFORM set_config('request.jwt.claims','{}',TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  FOREACH role_name IN ARRAY ARRAY['technician','qltb_khoa','user','global','admin'] LOOP
    PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role',role_name))::TEXT,TRUE);
    result := public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,5);
    IF result->>'outcome' <> 'conflict' THEN RAISE EXCEPTION 'approved writer role failed: %',role_name; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('don_vi',tenant+999999))::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('khoa_phong','other'))::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',(claims-'user_id')::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id','invalid'))::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',-999999))::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',(claims-'don_vi')::TEXT,TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims','invalid-json',TRUE);
  PERFORM pg_temp.tm04_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'42501');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);

  FOREACH role_name IN ARRAY ARRAY['to_qltb','global','admin'] LOOP
    FOREACH bad_value IN ARRAY ARRAY[NULL,'','invalid','999999999999999999999999999'] LOOP
      PERFORM set_config('request.jwt.claims',((claims-'user_id')||jsonb_build_object('app_role',role_name)
        || CASE WHEN bad_value IS NULL THEN '{}'::JSONB ELSE jsonb_build_object('user_id',bad_value) END)::TEXT,TRUE);
      PERFORM pg_temp.tm04_expect_error(format('SELECT status FROM public.temperature_monitoring_slots_list(%L,%L,NULL,%s,NULL,20,FALSE)','2026-07-02','2026-07-02',equipment),'42501');
      PERFORM pg_temp.tm04_expect_error(format('SELECT status FROM public.temperature_monitoring_slots_list(%L,%L,NULL,%s,NULL,20,FALSE)','2026-07-06','2026-07-06',equipment),'42501');
    END LOOP;
  END LOOP;
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);

  UPDATE public.thiet_bi SET tinh_trang_hien_tai='Ngưng sử dụng' WHERE id=equipment;
  UPDATE public.temperature_monitoring_schedule_profiles SET is_active=FALSE WHERE id=profile;
  PERFORM public.temperature_monitoring_schedule_shift_override_upsert(profile,tenant,shift,NULL,'23:00','07:00');
  SELECT * INTO slot FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',ARRAY['dem'],equipment,NULL,1,FALSE);
  IF slot.status <> 'Đã ghi' OR slot.configuration_version_id <> version OR slot.slot_start <> (original->'snapshot'->>'slot_start')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'historical reading disappeared or snapshot changed: %',slot;
  END IF;
  SELECT next_cursor INTO cursor_value FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-08',ARRAY['dem'],equipment,NULL,1,FALSE);
  IF (SELECT count(*) FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-08',ARRAY['dem'],equipment,cursor_value,200,FALSE)) <> 5
    OR EXISTS (SELECT 1 FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-08',ARRAY['sang'],equipment,NULL,200,FALSE)) THEN
    RAISE EXCEPTION 'saved-slot cursor/selected-shift filtering regressed';
  END IF;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('don_vi',tenant+999999))::TEXT,TRUE);
  IF EXISTS (SELECT 1 FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-08',NULL,equipment,NULL,200,FALSE)) THEN
    RAISE EXCEPTION 'saved slot leaked across tenant';
  END IF;
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,5);
  IF result->>'outcome' <> 'conflict' THEN RAISE EXCEPTION 'authorized historical conflict failed'; END IF;
  IF (SELECT count(*) FROM public.temperature_readings WHERE equipment_id=equipment) <> 6
    OR (SELECT count(*) FROM public.temperature_monitoring_reading_events e JOIN public.temperature_readings r ON r.id=e.reading_id WHERE r.equipment_id=equipment) <> 8 THEN
    RAISE EXCEPTION 'duplicate/invalid input left extra readings/events';
  END IF;
  PERFORM pg_temp.tm04_expect_error(format('UPDATE public.temperature_readings SET note=%L WHERE id=%L','overwrite',original->>'id'),'55000');
  PERFORM pg_temp.tm04_expect_error(format('DELETE FROM public.temperature_readings WHERE id=%L',original->>'id'),'55000');
  PERFORM pg_temp.tm04_expect_error(format('DELETE FROM public.temperature_monitoring_reading_events WHERE reading_id=%L',original->>'id'),'55000');
  IF has_table_privilege('authenticated','public.temperature_readings','INSERT') OR has_table_privilege('authenticated','public.temperature_monitoring_reading_events','INSERT') THEN
    RAISE EXCEPTION 'client has direct table write privilege';
  END IF;
  IF has_function_privilege('authenticated','public._temperature_monitoring_lock_tenant(bigint)','EXECUTE')
    OR has_function_privilege('authenticated','public.temperature_monitoring_reading_immutable()','EXECUTE')
    OR has_function_privilege('authenticated','public.temperature_monitoring_policy_write_lock()','EXECUTE') THEN
    RAISE EXCEPTION 'private trigger/lock helper is executable by client';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.temperature_readings'::REGCLASS,'public.temperature_monitoring_reading_events'::REGCLASS) AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'reading/event RLS is disabled';
  END IF;
  SET LOCAL ROLE authenticated;
  result := public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,5);
  IF result->>'outcome' <> 'conflict' THEN RAISE EXCEPTION 'authenticated RPC execution failed'; END IF;
  PERFORM pg_temp.tm04_expect_error('SELECT id FROM public.temperature_readings LIMIT 1','42501');
  PERFORM pg_temp.tm04_expect_error('INSERT INTO public.temperature_monitoring_reading_events DEFAULT VALUES','42501');
  RESET ROLE;
  PERFORM pg_temp.tm04_expect_error(format('INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,monitoring_enabled,change_reason) VALUES (%s,tstzrange(%L,%L),FALSE,%L)',equipment,'2026-06-01Z','2026-06-02Z','backdated fixture'),'22023');
  UPDATE public.thiet_bi SET tinh_trang_hien_tai='Hoạt động' WHERE id=equipment;
  UPDATE public.temperature_monitoring_schedule_profiles SET is_active=TRUE WHERE id=profile;
  PERFORM set_config('tm04.equipment',equipment::TEXT,TRUE);
  PERFORM set_config('tm04.shift',shift::TEXT,TRUE);
END;
$$;

CREATE FUNCTION pg_temp.tm04_fail_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type='deviation_created' THEN
    RAISE EXCEPTION 'injected sensitive audit failure' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm04_injected_audit_failure BEFORE INSERT ON public.temperature_monitoring_reading_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.tm04_fail_audit();
DO $$
DECLARE result JSONB;
BEGIN
  BEGIN
    result := public.temperature_monitoring_measurement_create(current_setting('tm04.equipment')::BIGINT,'2026-07-06',current_setting('tm04.shift')::UUID,9);
    RAISE EXCEPTION 'audit failure unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'temperature measurement could not be saved' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.temperature_readings WHERE equipment_id=current_setting('tm04.equipment')::BIGINT AND monitoring_date='2026-07-06') THEN
    RAISE EXCEPTION 'audit failure left reading residue';
  END IF;
  IF (SELECT count(*) FROM public.temperature_monitoring_reading_events e JOIN public.temperature_readings r ON r.id=e.reading_id WHERE r.equipment_id=current_setting('tm04.equipment')::BIGINT) <> 8 THEN
    RAISE EXCEPTION 'second audit insertion failure left first event residue';
  END IF;
END;
$$;

ROLLBACK;
