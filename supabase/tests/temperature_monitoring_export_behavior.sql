-- TM-09: full calendar-year export, fixed membership and scoped history.
BEGIN;
CREATE FUNCTION pg_temp.tm09_error(p_sql TEXT,p_state TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded',p_state;
EXCEPTION WHEN OTHERS THEN IF SQLSTATE<>p_state THEN RAISE; END IF;
END $$;
DO $$
DECLARE tenant BIGINT; actor BIGINT; reviewer BIGINT; equipment BIGINT; foreign_equipment BIGINT;
  profile UUID; shift UUID; reading UUID; unable UUID; amended UUID; proposal UUID;
  result JSONB; page JSONB; cursor JSONB; watermark TIMESTAMPTZ; ids UUID[]; role_name TEXT; revision BIGINT;
BEGIN
  SELECT id INTO tenant FROM public.don_vi ORDER BY id LIMIT 1;
  SELECT id INTO actor FROM public.nhan_vien ORDER BY id LIMIT 1;
  SELECT id INTO reviewer FROM public.nhan_vien WHERE id<>actor ORDER BY id LIMIT 1;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM09-'||gen_random_uuid(),'TM09 history',tenant,'TM09 Dept','Hoạt động') RETURNING id INTO equipment;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM09-other-'||gen_random_uuid(),'TM09 foreign',tenant,'Foreign','Hoạt động') RETURNING id INTO foreign_equipment;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.temperature_monitoring_recording_methods(code,name)
  VALUES('manual','Đọc nhiệt kế và nhập tay') ON CONFLICT(code) DO NOTHING;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled) VALUES(equipment,TRUE),(foreign_equipment,TRUE);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,
    recording_method_code,responsible_primary_user_id,change_reason)
  SELECT id,tstzrange('2024-01-01Z',NULL,'[)'),2,8,profile,'manual',reviewer,'TM09 fixture'
  FROM unnest(ARRAY[equipment,foreign_equipment]) ids(id);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','user','user_id',actor,'don_vi',tenant,'khoa_phong','TM09 Dept')::TEXT,TRUE);
  result:=public.temperature_monitoring_measurement_create(equipment,'2024-01-02',shift,5,NULL,'2024-01-02 23:00+07','original note');
  reading:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_measurement_create(equipment,'2024-06-02',shift,NULL,'thermometer unavailable','2024-06-02 23:00+07');
  unable:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_measurement_create(equipment,'2024-12-02',shift,9,NULL,'2024-12-02 23:00+07');
  amended:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_amendment_create(amended,0,4,NULL,'corrected source');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  revision:=(result->>'revision')::BIGINT;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','to_qltb','user_id',reviewer,'don_vi',tenant,'khoa_phong','TM09 Dept')::TEXT,TRUE);
  PERFORM public.temperature_monitoring_reading_review(amended,revision,'approve_amendment','reviewed source',proposal);
  PERFORM public.temperature_monitoring_reading_review(unable,0,'confirm','unable reviewed');
  watermark:=clock_timestamp();
  -- Full leap-year (>90 days) with real-record pages and no generated missing slots.
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'readings',NULL,1,watermark);
  IF jsonb_array_length(page->'items')<>1 OR page->'next_cursor' IS NULL OR page->>'page_read_at' IS NULL THEN
    RAISE EXCEPTION 'calendar-year first page or metadata missing: %',page; END IF;
  cursor:=page->'next_cursor'; ids:=ARRAY[(page->'items'->0->>'id')::UUID];
  WHILE cursor IS NOT NULL AND cursor<>'null'::JSONB LOOP
    page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'readings',cursor,1,watermark);
    IF (page->'items'->0->>'id')::UUID=ANY(ids) THEN RAISE EXCEPTION 'duplicate cursor record'; END IF;
    ids:=ids||(page->'items'->0->>'id')::UUID; cursor:=page->'next_cursor';
  END LOOP;
  IF cardinality(ids)<>3 THEN RAISE EXCEPTION 'missing or generated rows: %',ids; END IF;
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'readings',NULL,25,watermark);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE (x->>'id')::UUID=reading
    AND (x->>'original_value_c')::NUMERIC=5 AND (x->>'effective_value_c')::NUMERIC=5 AND (x->>'lower_c')::NUMERIC=2)
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE (x->>'id')::UUID=amended
    AND (x->>'original_value_c')::NUMERIC=9 AND (x->>'effective_value_c')::NUMERIC=4)
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE (x->>'id')::UUID=unable
    AND x->'effective_value_c'='null'::JSONB AND x->'state'->>'slot_status'='Đã ghi'
    AND (x->'state'->>'confirmed_by')::BIGINT=reviewer) THEN
    RAISE EXCEPTION 'original, effective, initial-state or confirmed unable projection wrong: %',page; END IF;
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'amendments',NULL,25,watermark,ids);
  IF page->'items'->0->>'reason'<>'corrected source' OR page->'items'->0->>'outcome'<>'amendment_approved'
    OR (page->'items'->0->>'decision_actor_user_id')::BIGINT<>reviewer
    OR page->'items'->0->>'decision_reason'<>'reviewed source' THEN RAISE EXCEPTION 'amendment actor/reason lost: %',page; END IF;
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'deviations',NULL,25,watermark,ids);
  IF jsonb_array_length(page->'items')<>1 OR (page->'items'->0->>'reading_id')::UUID<>amended
    OR page->'items'->0->'triggering_snapshot' IS NULL THEN RAISE EXCEPTION 'amended breach deviation lost'; END IF;
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'deviation_events',NULL,25,watermark,ids);
  IF page->'items'->0->>'action'<>'opened' OR (page->'items'->0->>'actor_user_id')::BIGINT<>actor THEN RAISE EXCEPTION 'deviation actor lost'; END IF;
  -- Department-scoped readers retain the restriction; to_qltb manages the entire tenant.
  FOREACH role_name IN ARRAY ARRAY['user','technician','qltb_khoa','to_qltb','regional_leader','admin','global'] LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role',role_name,'user_id',actor,'don_vi',tenant,'khoa_phong','TM09 Dept')::TEXT,TRUE);
    page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment);
    IF jsonb_array_length(page->'items')<>3 THEN RAISE EXCEPTION 'authorized role excluded: %',role_name; END IF;
    IF role_name NOT IN ('admin','global','to_qltb') THEN
      PERFORM pg_temp.tm09_error(format('SELECT public.temperature_monitoring_export_page(%L,%L,%s)','2024-01-01','2024-12-31',foreign_equipment),'42501');
    END IF;
  END LOOP;
  PERFORM pg_temp.tm09_error($q$SELECT public.temperature_monitoring_export_page('2024-12-31','2025-01-01')$q$,'22023');
  PERFORM pg_temp.tm09_error($q$SELECT public.temperature_monitoring_export_page('2024-01-01','2024-12-31',p_status=>'Chưa ghi')$q$,'22023');
  PERFORM pg_temp.tm09_error($q$SELECT public.temperature_monitoring_export_page('2024-01-01','2024-12-31',p_limit=>26)$q$,'22023');
  PERFORM pg_temp.tm09_error($q$SELECT public.temperature_monitoring_export_page('2024-01-01','2024-12-31',p_cursor=>'{}')$q$,'22023');
  -- Exercise the actual maximum page size followed by a nonempty final page.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','user','user_id',actor,'don_vi',tenant,'khoa_phong','TM09 Dept')::TEXT,TRUE);
  FOR revision IN 1..30 LOOP
    PERFORM public.temperature_monitoring_measurement_create(equipment,'2024-02-01'::DATE+revision::INT,shift,5,NULL,
      (('2024-02-01'::DATE+revision::INT)::TEXT||' 23:00+07')::TIMESTAMPTZ);
  END LOOP;
  watermark:=clock_timestamp();
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'readings',NULL,25,watermark);
  IF jsonb_array_length(page->'items')<>25 THEN RAISE EXCEPTION '25-row page missing'; END IF;
  SELECT array_agg((x->>'id')::UUID) INTO ids FROM jsonb_array_elements(page->'items') x;
  page:=public.temperature_monitoring_export_page('2024-01-01','2024-12-31',equipment,NULL,NULL,'readings',page->'next_cursor',25,watermark);
  IF jsonb_array_length(page->'items')<>8 OR page->'next_cursor'<>'null'::JSONB
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'items') x WHERE (x->>'id')::UUID=ANY(ids)) THEN
    RAISE EXCEPTION 'later page truncated, duplicated or not exhausted: %',page; END IF;
  PERFORM set_config('request.jwt.claims','{"app_role":"global"}',TRUE);
  PERFORM pg_temp.tm09_error($q$SELECT public.temperature_monitoring_export_page('2024-01-01','2024-12-31')$q$,'42501');
END $$;
ROLLBACK;
