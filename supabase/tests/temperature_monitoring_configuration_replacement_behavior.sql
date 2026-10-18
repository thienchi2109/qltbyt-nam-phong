-- TM-07 replacement contract; run only on disposable databases until registered by the gate owner.
BEGIN;

CREATE FUNCTION pg_temp.tm07_replacement_expect_error(p_sql TEXT,p_state TEXT,p_message TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded: %',p_state,p_sql;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_state OR (p_message IS NOT NULL AND position(p_message IN SQLERRM)=0) THEN RAISE; END IF;
END $$;

DO $$
DECLARE
  tenant BIGINT;
  actor BIGINT;
  department TEXT;
  equipment BIGINT;
  initial_equipment BIGINT;
  initial_shift_equipment BIGINT;
  disabled_equipment BIGINT;
  profile UUID;
  initial_alt_profile UUID;
  inactive_profile UUID;
  shift UUID;
  predecessor UUID;
  successor UUID;
  disabled_predecessor UUID;
  inactive_method TEXT;
  effective_from TIMESTAMPTZ;
  next_effective_from TIMESTAMPTZ;
  initial_effective_from TIMESTAMPTZ;
  initial_shift_effective_from TIMESTAMPTZ;
  disabled_effective_from TIMESTAMPTZ;
  server_now TIMESTAMPTZ:=statement_timestamp();
  out_of_scope_staff BIGINT;
  claims JSONB;
  choices JSONB;
  has_deferrable_exclusion BOOLEAN;
  version_count_before BIGINT;
  audit_count_before BIGINT;
  configuration_before JSONB;
  predecessor_before JSONB;
BEGIN
  SELECT n.id,n.don_vi,NULLIF(btrim(n.khoa_phong),'')
    INTO actor,tenant,department
  FROM public.nhan_vien n
  WHERE COALESCE(n.is_active,TRUE) AND n.don_vi IS NOT NULL
    AND (n.current_don_vi IS NULL OR n.current_don_vi=n.don_vi)
    AND NULLIF(btrim(n.khoa_phong),'') IS NOT NULL
  ORDER BY n.id LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'TM-07 replacement test needs an active scoped staff fixture'; END IF;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-REPLACE-'||gen_random_uuid(),'TM07 replacement fixture',tenant,department,'Hoạt động') RETURNING id INTO equipment;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled)
  VALUES(equipment,TRUE);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,monitoring_enabled,
    lower_c,upper_c,schedule_profile_id,display_timezone,responsible_primary_user_id,recording_method_code,change_reason,created_by)
  VALUES(equipment,tstzrange(clock_timestamp()-INTERVAL '2 days',NULL,'[)'),TRUE,2,8,profile,'Asia/Ho_Chi_Minh',
    actor,'manual','TM07 original policy',actor) RETURNING id INTO predecessor;
  SELECT MIN(((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')) INTO effective_from
  FROM generate_series(((server_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE)::TIMESTAMP,
       (((server_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') AS d(day)
  JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id=profile AND s.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
    ON o.schedule_profile_id=s.schedule_profile_id AND o.don_vi=tenant AND o.shift_id=s.id AND o.is_active
  WHERE ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')>server_now+INTERVAL '1 minute';
  IF effective_from IS NULL THEN RAISE EXCEPTION 'TM-07 replacement test could not find a future schedule boundary'; END IF;
  claims:=jsonb_build_object('app_role','to_qltb','user_id',actor,'don_vi',tenant,'khoa_phong','  '||department||'  ');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);

  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-INITIAL-'||gen_random_uuid(),'TM07 initial fixture',tenant,department,'Hoạt động')
  RETURNING id INTO initial_equipment;
  SELECT MIN(d.day AT TIME ZONE 'Asia/Ho_Chi_Minh') INTO initial_effective_from
  FROM generate_series(((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE::TIMESTAMP,
       ((((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') AS d(day)
  WHERE (d.day AT TIME ZONE 'Asia/Ho_Chi_Minh')>server_now+INTERVAL '1 minute';
  IF initial_effective_from IS NULL THEN RAISE EXCEPTION 'TM-07 could not find an initial date boundary'; END IF;
  INSERT INTO public.temperature_monitoring_schedule_profiles(code,name,is_active)
  VALUES('tm07-alt-'||gen_random_uuid(),'TM07 alternate profile',TRUE) RETURNING id INTO initial_alt_profile;
  INSERT INTO public.temperature_monitoring_schedule_shifts(
    schedule_profile_id,code,name,start_local,end_local,sort_order,is_active
  ) VALUES(initial_alt_profile,'tm07-alt','TM07 alternate',TIME '08:00',TIME '20:00',1,TRUE);
  SELECT MIN(((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    INTO initial_shift_effective_from
  FROM generate_series(((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE::TIMESTAMP,
       ((((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') AS d(day)
  JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id=initial_alt_profile AND s.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
    ON o.schedule_profile_id=s.schedule_profile_id AND o.don_vi=tenant AND o.shift_id=s.id AND o.is_active
  WHERE ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')>server_now+INTERVAL '1 minute';
  IF initial_shift_effective_from IS NULL THEN RAISE EXCEPTION 'TM-07 could not find an initial selected-profile shift boundary'; END IF;
  choices:=public.temperature_monitoring_configuration_choices(initial_equipment);
  IF (choices->>'suggested_effective_from')::TIMESTAMPTZ IS DISTINCT FROM initial_effective_from THEN
    RAISE EXCEPTION 'unconfigured equipment must suggest its next local-date boundary; expected %, got %',initial_effective_from,choices->>'suggested_effective_from';
  END IF;
  PERFORM public.temperature_monitoring_configuration_upsert(initial_equipment,TRUE,initial_effective_from,NULL,2,8,initial_alt_profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 initial enable');
  IF (SELECT count(*) FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=initial_equipment
      AND monitoring_enabled AND schedule_profile_id=initial_alt_profile AND lower(effective_period)=initial_effective_from)<>1 THEN
    RAISE EXCEPTION 'initial enable must accept the local date boundary without a predecessor';
  END IF;

  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-INITIAL-SHIFT-'||gen_random_uuid(),'TM07 initial shift fixture',tenant,department,'Hoạt động')
  RETURNING id INTO initial_shift_equipment;
  PERFORM public.temperature_monitoring_configuration_upsert(initial_shift_equipment,TRUE,initial_shift_effective_from,NULL,2,8,initial_alt_profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 initial selected shift boundary');
  IF (SELECT count(*) FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=initial_shift_equipment
      AND monitoring_enabled AND schedule_profile_id=initial_alt_profile AND lower(effective_period)=initial_shift_effective_from)<>1 THEN
    RAISE EXCEPTION 'initial enable must accept the selected profile shift boundary without a predecessor';
  END IF;

  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-DISABLED-'||gen_random_uuid(),'TM07 disabled fixture',tenant,department,'Hoạt động')
  RETURNING id INTO disabled_equipment;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled)
  VALUES(disabled_equipment,FALSE);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,monitoring_enabled,
    lower_c,upper_c,schedule_profile_id,display_timezone,responsible_primary_user_id,recording_method_code,change_reason,created_by)
  VALUES(disabled_equipment,tstzrange(server_now-INTERVAL '10 days',server_now-INTERVAL '2 days','[)'),TRUE,2,8,profile,
    'Asia/Ho_Chi_Minh',actor,'manual','TM07 prior enabled policy',actor);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,monitoring_enabled,change_reason,created_by)
  VALUES(disabled_equipment,tstzrange(server_now-INTERVAL '2 days',NULL,'[)'),FALSE,'TM07 open disabled policy',actor)
  RETURNING id INTO disabled_predecessor;
  SELECT MIN(((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    INTO disabled_effective_from
  FROM generate_series(((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE::TIMESTAMP,
       ((((server_now+INTERVAL '1 minute') AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') AS d(day)
  JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id=profile AND s.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
    ON o.schedule_profile_id=s.schedule_profile_id AND o.don_vi=tenant AND o.shift_id=s.id AND o.is_active
  WHERE ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')>server_now+INTERVAL '1 minute';
  choices:=public.temperature_monitoring_configuration_choices(disabled_equipment);
  IF (choices->>'suggested_effective_from')::TIMESTAMPTZ IS DISTINCT FROM disabled_effective_from THEN
    RAISE EXCEPTION 're-enabling after an open disabled version must reuse its last enabled profile boundary';
  END IF;
  PERFORM public.temperature_monitoring_configuration_upsert(disabled_equipment,TRUE,disabled_effective_from,NULL,2,8,profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 re-enable after disabled version');
  IF (SELECT upper(effective_period) FROM public.temperature_monitoring_configuration_versions WHERE id=disabled_predecessor)
      IS DISTINCT FROM disabled_effective_from THEN
    RAISE EXCEPTION 're-enable must audibly close the open disabled predecessor';
  END IF;

  INSERT INTO public.temperature_monitoring_schedule_profiles(code,name,is_active)
  VALUES('tm07-inactive-'||gen_random_uuid(),'TM07 inactive profile',FALSE) RETURNING id INTO inactive_profile;
  INSERT INTO public.temperature_monitoring_schedule_shifts(
    schedule_profile_id,code,name,start_local,end_local,sort_order,is_active
  )
  SELECT inactive_profile,code,name,start_local,end_local,sort_order,TRUE
  FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND is_active;
  INSERT INTO public.temperature_monitoring_recording_methods(code,name,is_active)
  VALUES('tm07-inactive-'||gen_random_uuid(),'TM07 inactive method',FALSE) RETURNING code INTO inactive_method;

  PERFORM public.temperature_monitoring_configuration_upsert(equipment,TRUE,effective_from,NULL,3,7,profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 future replacement');
  SELECT condeferrable INTO has_deferrable_exclusion FROM pg_constraint
  WHERE conrelid='public.temperature_monitoring_configuration_versions'::regclass
    AND conname='temperature_monitoring_versions_no_overlap' AND contype='x';
  IF has_deferrable_exclusion IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'configuration version exclusion constraint must remain deferrable';
  END IF;
  SELECT id INTO successor FROM public.temperature_monitoring_configuration_versions
    WHERE equipment_id=equipment AND id<>predecessor ORDER BY lower(effective_period) DESC LIMIT 1;
  IF successor IS NULL THEN RAISE EXCEPTION 'configuration replacement did not create a successor'; END IF;
  IF (SELECT upper(effective_period) FROM public.temperature_monitoring_configuration_versions WHERE id=predecessor) IS DISTINCT FROM effective_from
    OR upper_inf((SELECT effective_period FROM public.temperature_monitoring_configuration_versions WHERE id=predecessor)) THEN
    RAISE EXCEPTION 'open predecessor must close exactly at the successor start';
  END IF;
  IF (SELECT count(*) FROM public.temperature_monitoring_configuration_audit WHERE version_id=successor AND equipment_id=equipment
      AND actor_user_id=actor AND reason='TM07 future replacement')<>1 THEN
    RAISE EXCEPTION 'replacement and trusted audit must commit together';
  END IF;
  IF (SELECT count(*) FROM public.temperature_monitoring_configuration_audit
      WHERE version_id=predecessor AND equipment_id=equipment AND event_type='version_closed'
        AND actor_user_id=actor AND reason='TM07 future replacement'
        AND after_state->>'successor_version_id'=successor::TEXT
        AND (after_state->>'effective_to')::TIMESTAMPTZ=effective_from)<>1 THEN
    RAISE EXCEPTION 'predecessor closure must have trusted audit evidence';
  END IF;
  SELECT MIN(((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')) INTO next_effective_from
  FROM generate_series((effective_from AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE::TIMESTAMP,
       (((effective_from AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE+14)::TIMESTAMP),INTERVAL '1 day') AS d(day)
  JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id=profile AND s.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
    ON o.schedule_profile_id=s.schedule_profile_id AND o.don_vi=tenant AND o.shift_id=s.id AND o.is_active
  WHERE ((d.day+COALESCE(o.start_local,s.start_local)) AT TIME ZONE 'Asia/Ho_Chi_Minh')>effective_from+INTERVAL '1 minute';
  IF next_effective_from IS NULL THEN RAISE EXCEPTION 'TM-07 replacement test could not find a second future schedule boundary'; END IF;
  IF public.temperature_monitoring_configuration_choices(equipment)->>'suggested_effective_from' IS NOT NULL THEN
    RAISE EXCEPTION 'an existing future version must block another scheduled configuration';
  END IF;

  CREATE FUNCTION pg_temp.tm07_reject_successor_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
    IF NEW.event_type='version' AND NEW.reason='TM07 forced audit failure' THEN
      RAISE EXCEPTION 'TM07 forced audit failure' USING ERRCODE='P0001';
    END IF;
    RETURN NEW;
  END $fn$;
  CREATE TRIGGER tm07_reject_successor_audit BEFORE INSERT ON public.temperature_monitoring_configuration_audit
    FOR EACH ROW EXECUTE FUNCTION pg_temp.tm07_reject_successor_audit();
  SELECT count(*) INTO version_count_before FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=equipment;
  SELECT count(*) INTO audit_count_before FROM public.temperature_monitoring_configuration_audit WHERE equipment_id=equipment;
  SELECT to_jsonb(c) INTO configuration_before FROM public.temperature_monitoring_configurations c WHERE equipment_id=equipment;
  SELECT to_jsonb(v) INTO predecessor_before FROM public.temperature_monitoring_configuration_versions v WHERE id=successor;
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,3,7,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,next_effective_from::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 forced audit failure'),
    'P0001','TM07 forced audit failure');
  DROP TRIGGER tm07_reject_successor_audit ON public.temperature_monitoring_configuration_audit;
  IF (SELECT count(*) FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=equipment)<>version_count_before
    OR (SELECT count(*) FROM public.temperature_monitoring_configuration_audit WHERE equipment_id=equipment)<>audit_count_before
    OR (SELECT to_jsonb(c) FROM public.temperature_monitoring_configurations c WHERE equipment_id=equipment)
      IS DISTINCT FROM configuration_before
    OR (SELECT to_jsonb(v) FROM public.temperature_monitoring_configuration_versions v WHERE id=successor)
      IS DISTINCT FROM predecessor_before
    OR NOT EXISTS(SELECT 1 FROM public.temperature_monitoring_configuration_versions WHERE id=successor AND upper_inf(effective_period)) THEN
    RAISE EXCEPTION 'audit failure must roll back successor, predecessor closure, and configuration state atomically';
  END IF;
  SELECT n.id INTO out_of_scope_staff FROM public.nhan_vien n
  WHERE COALESCE(n.is_active,TRUE) AND n.id<>actor
    AND (COALESCE(n.current_don_vi,n.don_vi) IS DISTINCT FROM tenant
      OR public._normalize_department_scope(n.khoa_phong) IS DISTINCT FROM public._normalize_department_scope(department))
  ORDER BY n.id LIMIT 1;
  IF out_of_scope_staff IS NULL THEN RAISE EXCEPTION 'TM-07 replacement test needs an active cross-scope staff fixture'; END IF;

  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,3,7,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,(clock_timestamp()-INTERVAL '1 second')::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 retroactive start'),
    '22023','future');
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,3,7,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,(effective_from+INTERVAL '1 minute')::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 mid-slot start'),
    '22023','schedule');
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,3,7,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,next_effective_from::TEXT,inactive_profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[], 'manual','TM07 inactive profile'),
    '22023','active schedule profile');
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,3,7,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,next_effective_from::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[], inactive_method,'TM07 inactive method'),
    '22023','active recording method');

  PERFORM set_config('temperature_monitoring.allow_version_update','true',TRUE);
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('UPDATE public.temperature_monitoring_configuration_versions SET effective_period=tstzrange(lower(effective_period),%L::timestamptz,''[)'') WHERE id=%L::uuid',
      (effective_from+INTERVAL '1 day')::TEXT,successor),
    '55000','immutable');
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('UPDATE public.temperature_monitoring_configuration_versions SET monitoring_enabled=FALSE WHERE id=%L::uuid',predecessor),
    '55000','immutable');
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('DELETE FROM public.temperature_monitoring_configuration_versions WHERE id=%L::uuid',predecessor),
    '55000','immutable');

  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,4,6,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,effective_from::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 duplicate scheduled successor'),
    '22023','successor');

  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','global','user_id',actor)::TEXT,TRUE);
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,4,6,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,next_effective_from::TEXT,profile,'Asia/Ho_Chi_Minh',out_of_scope_staff,'{}'::BIGINT[],'manual','TM07 cross-scope responsible staff'),
    '42501','outside equipment scope');

  UPDATE public.nhan_vien SET is_active=FALSE WHERE id=actor;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','global','user_id',actor)::TEXT,TRUE);
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('SELECT public.temperature_monitoring_configuration_upsert(%s,TRUE,%L::timestamptz,NULL,4,6,%L::uuid,%L,%s,%L::bigint[],%L,%L)',
      equipment,next_effective_from::TEXT,profile,'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 inactive actor'),
    '42501','must be active');
  UPDATE public.nhan_vien SET is_active=TRUE WHERE id=actor;

  SET CONSTRAINTS temperature_monitoring_versions_no_overlap DEFERRED;
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  PERFORM public.temperature_monitoring_configuration_upsert(equipment,TRUE,next_effective_from,NULL,4,6,profile,
    'Asia/Ho_Chi_Minh',actor,'{}'::BIGINT[],'manual','TM07 second future replacement');
  SET CONSTRAINTS temperature_monitoring_versions_no_overlap IMMEDIATE;
  PERFORM pg_temp.tm07_replacement_expect_error(
    format('INSERT INTO public.temperature_monitoring_configuration_versions(
      equipment_id,effective_period,monitoring_enabled,lower_c,upper_c,schedule_profile_id,display_timezone,
      responsible_primary_user_id,responsible_substitute_user_ids,recording_method_code,change_reason,created_by)
      SELECT equipment_id,effective_period,monitoring_enabled,lower_c,upper_c,schedule_profile_id,display_timezone,
        responsible_primary_user_id,responsible_substitute_user_ids,recording_method_code,%L,created_by
      FROM public.temperature_monitoring_configuration_versions WHERE id=%L::uuid',
      'TM07 deferred constraint must already be checked',successor),
    '23P01','temperature_monitoring_versions_no_overlap');
END $$;

ROLLBACK;
