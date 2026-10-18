-- TM-07 scoped workspace, choices, current-slot and prospective time contract.
BEGIN;
CREATE FUNCTION pg_temp.tm07_error(p_sql TEXT,p_state TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded',p_state;
EXCEPTION WHEN OTHERS THEN IF SQLSTATE<>p_state THEN RAISE; END IF;
END $$;
DO $$
DECLARE tenant BIGINT; actor BIGINT; other_actor BIGINT; equipment BIGINT; other_equipment BIGINT;
  profile UUID; shift UUID; result JSONB; page JSONB; reading UUID; first_cursor JSONB;
  before_count BIGINT; actual_time TIMESTAMPTZ:='2026-07-02 23:00+07';
BEGIN
  SELECT id INTO tenant FROM public.don_vi ORDER BY id LIMIT 1;
  SELECT id INTO actor FROM public.nhan_vien ORDER BY id LIMIT 1;
  SELECT id INTO other_actor FROM public.nhan_vien WHERE id<>actor ORDER BY id LIMIT 1;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-'||gen_random_uuid(),'TM07 workspace',tenant,'TM07 Dept','Hoạt động') RETURNING id INTO equipment;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM07-other-'||gen_random_uuid(),'TM07 foreign',tenant,'Other','Hoạt động') RETURNING id INTO other_equipment;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.temperature_monitoring_recording_methods(code,name)
  VALUES('manual','Đọc nhiệt kế và nhập tay') ON CONFLICT(code) DO NOTHING;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled) VALUES(equipment,TRUE),(other_equipment,TRUE);
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,
    recording_method_code,responsible_primary_user_id,change_reason)
  SELECT id,tstzrange('2026-07-01Z',NULL,'[)'),2,8,profile,'manual',other_actor,'TM07 fixture'
  FROM unnest(ARRAY[equipment,other_equipment]) ids(id);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','user','user_id',actor,'don_vi',tenant,'khoa_phong','TM07 Dept')::TEXT,TRUE);
  result:=public.equipment_list_enhanced('TM07','id.asc',1,200,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,TRUE,'all');
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'data') x WHERE (x->>'id')::BIGINT=equipment AND (x->>'temperature_monitoring_enabled')::BOOLEAN)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(result->'data') x WHERE (x->>'id')::BIGINT=other_equipment AND (x->>'temperature_monitoring_enabled')::BOOLEAN) THEN
    RAISE EXCEPTION 'batched Equipment eligibility missing or cross department'; END IF;
  -- This query must work for a non-responsible scoped writer, without staff catalogs.
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-02',equipment,ARRAY['dem']);
  IF jsonb_array_length(page->'items')<>1 OR page->'items'->0->>'status'<>'Chưa ghi'
    OR (page->'items'->0->>'lower_c')::NUMERIC<>2 OR page->'items'->0->>'recording_method_code'<>'manual'
    OR page->>'server_now' IS NULL OR page->'items'->0->>'slot_end' IS NULL THEN
    RAISE EXCEPTION 'workspace must return authoritative eligible slot and policy: %',page;
  END IF;
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_configuration_choices(%s)',equipment),'42501');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_staff_choices(%s)',equipment),'42501');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-02',shift),'22023');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,NULL,NULL)',equipment,'2026-07-02',shift),'22023');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,NULL,%L)',equipment,'2026-07-02',shift,'2026-07-03 06:00+07'),'22023');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,NULL,%L)',equipment,'2026-07-02',shift,'2026-07-02 21:59:59+07'),'22023');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5,NULL,%L)',equipment,CURRENT_DATE+2,shift,clock_timestamp()+INTERVAL '2 days'),'22023');
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,9,NULL,actual_time);
  reading:=(result->'reading'->>'id')::UUID;
  IF result->>'outcome'<>'created' OR (result->'reading'->>'captured_at')::TIMESTAMPTZ<>actual_time
    OR (result->'reading'->>'created_at')::TIMESTAMPTZ<=actual_time THEN RAISE EXCEPTION 'observation/entry timestamps lost'; END IF;
  -- Duplicate fast path retains typed conflict even with omitted historical time.
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,4);
  IF result->>'outcome'<>'conflict' OR result->'reading'->>'id'<>reading::TEXT THEN RAISE EXCEPTION 'duplicate overwrite'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-03',equipment,ARRAY['dem'],'Chờ xác nhận',NULL,1);
  IF (page->>'total')::INT<>1 OR page->'items'->0->>'reading_id'<>reading::TEXT
    OR (page->'items'->0->>'value_c')::NUMERIC<>9 OR page->'items'->0->'deviation'->>'status'<>'Mở' THEN
    RAISE EXCEPTION 'status before pagination or saved projection wrong: %',page;
  END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-04',equipment,ARRAY['dem'],NULL,NULL,1,'deviations','Mở');
  IF (page->>'total')::INT<>1 OR page->'items'->0->>'reading_id'<>reading::TEXT THEN
    RAISE EXCEPTION 'deviation filter must precede page limit'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-04',equipment,ARRAY['dem'],NULL,NULL,1,'deviations','Đã đóng');
  IF (page->>'total')::INT<>0 OR page->>'empty_reason'<>'no_matches' THEN
    RAISE EXCEPTION 'lifecycle filter or empty cause missing'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-04',equipment,ARRAY['missing']);
  IF page->>'empty_reason'<>'no_matches' THEN RAISE EXCEPTION 'filter-empty cause missing'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-04',equipment,ARRAY['dem'],NULL,NULL,1);
  first_cursor:=page->'next_cursor';
  IF first_cursor IS NULL OR first_cursor='null'::JSONB THEN RAISE EXCEPTION 'missing next cursor'; END IF;
  result:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-04',equipment,ARRAY['dem'],NULL,first_cursor,1);
  IF result->'items'->0->>'monitoring_date'=page->'items'->0->>'monitoring_date' THEN RAISE EXCEPTION 'duplicate cursor row'; END IF;
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_workspace_list(%L,%L,%s,ARRAY[%L],NULL,%L::JSONB,1)',
    '2026-07-02','2026-07-05',equipment,'dem',first_cursor),'22023');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_workspace_list(%L,%L,%s)',
    '2026-01-01','2026-07-02',equipment),'22023');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','to_qltb','user_id',actor,'don_vi',tenant,'khoa_phong','TM07 Dept')::TEXT,TRUE);
  result:=public.temperature_monitoring_notification_summary('2026-07-02','2026-07-03');
  IF (result->>'pending_review')::INT<>0 OR (result->>'open_deviations')::INT<>1 THEN RAISE EXCEPTION 'self review leaked to inbox'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-03',equipment,NULL,NULL,NULL,50,'review_queue');
  IF (page->>'total')::INT<>0 THEN RAISE EXCEPTION 'self review leaked to queue'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','to_qltb','user_id',other_actor,'don_vi',tenant,'khoa_phong','TM07 Dept')::TEXT,TRUE);
  result:=public.temperature_monitoring_notification_summary('2026-07-02','2026-07-03');
  IF (result->>'pending_review')::INT<>1 OR jsonb_array_length(result->'items')>20 THEN RAISE EXCEPTION 'independent review inbox missing'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-03',equipment,NULL,NULL,NULL,50,'review_queue');
  IF (page->>'total')::INT<>1 THEN RAISE EXCEPTION 'independent review queue missing'; END IF;
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-03',equipment,NULL,NULL,NULL,50,'open_deviations');
  IF (page->>'total')::INT<>1 THEN RAISE EXCEPTION 'open deviation queue missing'; END IF;
  result:=public.temperature_monitoring_configuration_choices(equipment);
  IF result->'methods'->0->>'code'<>'manual' OR result->>'server_now' IS NULL THEN RAISE EXCEPTION 'manual catalog absent'; END IF;
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_staff_choices(%s,%L)',equipment,repeat('x',201)),'22023');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','user','user_id',actor,'don_vi',tenant,'khoa_phong','Other')::TEXT,TRUE);
  page:=public.temperature_monitoring_workspace_list('2026-07-02','2026-07-02',equipment);
  IF jsonb_array_length(page->'items')<>0 THEN RAISE EXCEPTION 'cross department workspace leak'; END IF;
  PERFORM set_config('request.jwt.claims','{}',TRUE);
  PERFORM pg_temp.tm07_error('SELECT public.temperature_monitoring_workspace_list()','42501');
  PERFORM pg_temp.tm07_error(format('SELECT public.temperature_monitoring_configuration_get(%s)',equipment),'42501');
  IF has_function_privilege('authenticated','public._temperature_monitoring_slot_rows(date,date,text[],bigint,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'private slot source callable'; END IF;
END $$;
ROLLBACK;
