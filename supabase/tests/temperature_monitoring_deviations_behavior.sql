-- TM-06 RPC regression; isolated fixtures and all changes roll back.
BEGIN;
CREATE FUNCTION pg_temp.tm06_expect_error(p_sql TEXT,p_state TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded',p_state;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_state THEN RAISE; END IF;
END;
$$;
CREATE FUNCTION pg_temp.tm06_action(p_id UUID,p_revision BIGINT,p_action TEXT,p_fields JSONB DEFAULT '{}'::JSONB,p_request UUID DEFAULT gen_random_uuid())
RETURNS JSONB LANGUAGE sql AS $$
  SELECT public.temperature_monitoring_deviation_update(p_id,p_revision,p_request,p_action,
    p_fields->>'immediate_action',p_fields->>'cause',p_fields->>'evidence',(p_fields->>'owner_user_id')::BIGINT,
    (p_fields->>'due_at')::TIMESTAMPTZ,p_fields->>'severity',p_fields->>'verification_result',
    (p_fields->>'repair_request_id')::INTEGER,p_fields->>'reason');
$$;
CREATE FUNCTION pg_temp.tm06_fail_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('tm06.fail_event',TRUE)='yes' THEN RAISE EXCEPTION 'injected audit failure' USING ERRCODE='22023'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm06_injected_failure BEFORE INSERT ON public.temperature_monitoring_deviation_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.tm06_fail_event();
DO $$
#variable_conflict use_column
<<tm06>>
DECLARE
  tenant BIGINT;
  actor BIGINT;
  equipment BIGINT;
  shift UUID;
  profile UUID;
  result JSONB;
  claims JSONB;
  reading_id UUID;
  normal_id UUID;
  case_id UUID;
  second_case UUID;
  request_id UUID:=gen_random_uuid();
  original JSONB;
  prior JSONB;
  revision BIGINT;
  reviewer BIGINT;
  author BIGINT;
  proposal UUID;
  repair_id INTEGER;
  other_repair INTEGER;
  other_equipment BIGINT;
  owner_id BIGINT;
  page JSONB;
  bad_action TEXT;
  n BIGINT;
BEGIN
  SELECT id INTO tenant FROM public.don_vi ORDER BY id LIMIT 1;
  SELECT id INTO actor FROM public.nhan_vien ORDER BY id LIMIT 1;
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM06-'||gen_random_uuid(),'TM06 rollback fixture',tenant,'TM06 Fixture','Hoạt động') RETURNING id INTO equipment;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES('tm06-fixture','TM06 method');
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
  VALUES(equipment,tstzrange('2026-07-01Z','2026-07-10Z','[)'),2,8,profile,'tm06-fixture',actor,'TM06 fixture');
  SELECT id INTO author FROM public.nhan_vien WHERE id<>actor ORDER BY id LIMIT 1;
  SELECT id INTO reviewer FROM public.nhan_vien WHERE id NOT IN (actor,author) ORDER BY id LIMIT 1;
  INSERT INTO public.nhan_vien(username,password,full_name,role,khoa_phong,don_vi,is_active)
  VALUES('tm06-owner-'||gen_random_uuid(),'fixture','TM06 owner','user','TM06 Fixture',tenant,TRUE) RETURNING id INTO owner_id;
  claims:=jsonb_build_object('app_role','user','user_id',actor,'don_vi',tenant,'khoa_phong','TM06 Fixture');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,9,NULL,'2026-07-02 16:00Z');
  IF result->>'outcome'<>'created' THEN RAISE EXCEPTION 'scoped user must record a temperature: %',result; END IF;
  reading_id:=(result->'reading'->>'id')::UUID;
  original:=result->'reading';
  result:=public.temperature_monitoring_deviation_get(NULL,reading_id);
  case_id:=(result->'deviation'->>'id')::UUID;
  IF case_id IS NULL OR result->'deviation'->>'severity'<>'Nhẹ' OR result->'deviation'->>'status'<>'Mở'
    OR result->'deviation'->'triggering_snapshot'->'reading'<>original THEN RAISE EXCEPTION 'breach case/snapshot invalid: %',result; END IF;
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,9,NULL,'2026-07-02 16:00Z');
  IF result->>'outcome'<>'conflict' OR (SELECT count(*) FROM public.temperature_monitoring_deviations d WHERE d.reading_id=tm06.reading_id)<>1 THEN
    RAISE EXCEPTION 'retry duplicated breach';
  END IF;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('khoa_phong','Other'))::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-03',shift),'42501');
  PERFORM pg_temp.tm06_expect_error(format('SELECT public.temperature_monitoring_deviation_get(%L)',case_id),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('don_vi',tenant+999999))::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT public.temperature_monitoring_measurement_create(%s,%L,%L,5)',equipment,'2026-07-03',shift),'42501');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  FOREACH bad_action IN ARRAY ARRAY['assign','severity','close','cancel','link_repair'] LOOP
    PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,0,%L)',case_id,bad_action),'42501');
  END LOOP;
  PERFORM pg_temp.tm06_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,0,%L,%L)',reading_id,'confirm','user cannot confirm'),'42501');
  result:=pg_temp.tm06_action(case_id,0,'update_action','{"immediate_action":"Move contents","cause":"Door left open","evidence":"Incident log 1"}',request_id);
  IF result->'deviation'->>'revision'<>'1' THEN RAISE EXCEPTION 'action did not advance revision'; END IF;
  result:=pg_temp.tm06_action(case_id,0,'update_action','{"immediate_action":"Move contents","cause":"Door left open","evidence":"Incident log 1"}',request_id);
  IF result->>'replayed'<>'true' OR (SELECT count(*) FROM public.temperature_monitoring_deviation_events e WHERE e.deviation_id=case_id AND e.request_id=tm06.request_id)<>1 THEN
    RAISE EXCEPTION 'idempotent action duplicated event';
  END IF;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,0,%L,%L,%L)',case_id,'update_action','{"cause":"different"}',request_id),'22023');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('khoa_phong','Other'))::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,0,%L,%L,%L)',case_id,'update_action','{"immediate_action":"Move contents","cause":"Door left open","evidence":"Incident log 1"}',request_id),'42501');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=pg_temp.tm06_action(case_id,0,'start');
  IF result->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'stale revision was accepted'; END IF;
  result:=pg_temp.tm06_action(case_id,1,'start');
  result:=pg_temp.tm06_action(case_id,2,'submit_verification');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role','admin'))::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,3,%L)',case_id,'close'),'22023');
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,3,%L,%L)',case_id,'close','{"verification_result":"  "}'),'22023');
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,3,%L,%L)',case_id,'close',jsonb_build_object('verification_result',E'\t\n')),'22023');
  PERFORM set_config('tm06.fail_event','yes',TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,3,%L,%L)',case_id,'close','{"verification_result":"Recovered"}'),'22023');
  PERFORM set_config('tm06.fail_event','no',TRUE);
  result:=public.temperature_monitoring_deviation_get(case_id);
  IF result->'deviation'->>'revision'<>'3' OR result->'deviation'->>'status'<>'Chờ xác minh' THEN RAISE EXCEPTION 'audit failure leaked update'; END IF;
  result:=pg_temp.tm06_action(case_id,3,'close','{"verification_result":"Recovered"}');
  IF result->'deviation'->>'status'<>'Đã đóng' OR result->'reading_state'->>'slot_status'<>'Chờ xác nhận' THEN
    RAISE EXCEPTION 'self verification failed or case closing altered reading';
  END IF;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,4,%L)',case_id,'start'),'55000');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(reading_id,0,7,NULL,'transcription correction');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  revision:=(result->>'revision')::BIGINT;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role','to_qltb','user_id',reviewer))::TEXT,TRUE);
  result:=public.temperature_monitoring_reading_review(reading_id,revision,'approve_amendment','checked correction',proposal);
  result:=public.temperature_monitoring_deviation_get(case_id);
  IF result->'reading_state'->>'slot_status'<>'Đã ghi' OR result->'deviation'->'triggering_snapshot'->'reading'<>original
    OR result->'deviation'->>'status'<>'Đã đóng' THEN RAISE EXCEPTION 'approved correction changed breach snapshot/lifecycle'; END IF;
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-03',shift,5,NULL,'2026-07-03 16:00Z');
  normal_id:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_deviation_get(NULL,normal_id);
  IF result->'deviation'<>'null'::JSONB THEN RAISE EXCEPTION 'in range created case'; END IF;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',author))::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(normal_id,0,10,NULL,'new breach');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  revision:=(result->>'revision')::BIGINT;
  PERFORM pg_temp.tm06_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L,%L)',normal_id,revision,'approve_amendment','cannot approve',proposal),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer,'app_role','to_qltb'))::TEXT,TRUE);
  result:=public.temperature_monitoring_reading_review(normal_id,revision,'approve_amendment','confirmed amendment',proposal);
  result:=public.temperature_monitoring_deviation_get(NULL,normal_id);
  second_case:=(result->'deviation'->>'id')::UUID;
  prior:=result->'deviation'->'triggering_snapshot';
  IF second_case IS NULL OR prior->'reading'->>'value_c'<>'10' OR prior->>'amendment_id'<>proposal::TEXT
    OR prior->'reading'->>'lower_c'<>'2.0' THEN RAISE EXCEPTION 'amendment breach snapshot invalid: %',prior; END IF;
  result:=pg_temp.tm06_action(second_case,0,'assign',jsonb_build_object('owner_user_id',owner_id,'due_at','2026-07-05T12:00:00Z'));
  UPDATE public.nhan_vien SET is_active=FALSE WHERE id=owner_id;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,1,%L,%L)',second_case,'assign',jsonb_build_object('owner_user_id',owner_id)),'42501');
  UPDATE public.nhan_vien SET is_active=TRUE,khoa_phong='Other' WHERE id=owner_id;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,1,%L,%L)',second_case,'assign',jsonb_build_object('owner_user_id',owner_id)),'42501');
  UPDATE public.nhan_vien SET khoa_phong='TM06 Fixture' WHERE id=owner_id;
  SELECT id INTO n FROM public.don_vi WHERE id<>tenant ORDER BY id LIMIT 1;
  IF n IS NULL THEN RAISE EXCEPTION 'requires two tenant fixtures'; END IF;
  UPDATE public.nhan_vien SET current_don_vi=n WHERE id=owner_id;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,1,%L,%L)',second_case,'assign',jsonb_build_object('owner_user_id',owner_id)),'42501');
  UPDATE public.nhan_vien SET current_don_vi=NULL WHERE id=owner_id;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,1,%L)',second_case,'assign'),'22023');
  request_id:=gen_random_uuid();
  result:=pg_temp.tm06_action(second_case,1,'severity','{"severity":"Khẩn cấp","reason":"Risk assessed manually"}',request_id);
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,1,%L,%L,%L)',second_case,'severity','{"severity":"Khẩn cấp","reason":"Risk assessed manually"}',request_id),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('app_role','to_qltb','user_id',reviewer))::TEXT,TRUE);
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,2,%L,%L)',second_case,'severity','{"severity":"Nhẹ"}'),'22023');
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES('TM06-OTHER-'||gen_random_uuid(),'TM06 other',tenant,'TM06 Fixture','Hoạt động') RETURNING id INTO other_equipment;
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id,mo_ta_su_co,hang_muc_sua_chua,nguoi_yeu_cau,trang_thai)
  VALUES(equipment,'TM06 fixture','Inspection','TM06','Chờ xử lý') RETURNING id INTO repair_id;
  INSERT INTO public.yeu_cau_sua_chua(thiet_bi_id,mo_ta_su_co,hang_muc_sua_chua,nguoi_yeu_cau,trang_thai)
  VALUES(other_equipment,'TM06 fixture','Inspection','TM06','Chờ xử lý') RETURNING id INTO other_repair;
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,2,%L,%L)',second_case,'link_repair',jsonb_build_object('repair_request_id',other_repair)),'22023');
  result:=pg_temp.tm06_action(second_case,2,'link_repair',jsonb_build_object('repair_request_id',repair_id));
  PERFORM pg_temp.tm06_expect_error(format('UPDATE public.yeu_cau_sua_chua SET thiet_bi_id=%s WHERE id=%s',other_equipment,repair_id),'23514');
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-04',shift,11,NULL,'2026-07-04 16:00Z');
  result:=public.temperature_monitoring_deviation_get(NULL,(result->'reading'->>'id')::UUID);
  -- Immediate action is independently mandatory, even when a result is supplied.
  prior:=result->'deviation';
  result:=pg_temp.tm06_action((prior->>'id')::UUID,0,'start');
  result:=pg_temp.tm06_action((prior->>'id')::UUID,1,'submit_verification');
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,2,%L,%L)',prior->>'id','close','{"verification_result":"Recovered"}'),'22023');
  result:=pg_temp.tm06_action((prior->>'id')::UUID,2,'update_action','{"immediate_action":"Quarantine"}');
  result:=pg_temp.tm06_action((prior->>'id')::UUID,3,'link_repair',jsonb_build_object('repair_request_id',repair_id));
  page:=public.temperature_monitoring_deviations_list('2026-07-01','2026-07-10',NULL,NULL,NULL,NULL,repair_id,1);
  IF page->>'total'<>'2' OR jsonb_array_length(page->'items')<>1 OR page->'next_cursor'='null'::JSONB THEN RAISE EXCEPTION 'reverse link/cursor failed'; END IF;
  page:=public.temperature_monitoring_deviations_list('2026-07-01','2026-07-10',NULL,NULL,NULL,NULL,repair_id,1,page->'next_cursor');
  IF jsonb_array_length(page->'items')<>1 OR page->'next_cursor'<>'null'::JSONB THEN RAISE EXCEPTION 'second page failed'; END IF;
  result:=pg_temp.tm06_action(second_case,3,'link_repair');
  PERFORM pg_temp.tm06_expect_error(format('SELECT pg_temp.tm06_action(%L,4,%L)',second_case,'cancel'),'22023');
  result:=pg_temp.tm06_action(second_case,4,'cancel','{"reason":"Corrected and reviewed"}');
  IF result->'deviation'->'triggering_snapshot'->'reading'->>'value_c'<>'10' THEN RAISE EXCEPTION 'case action altered trigger'; END IF;
  IF (SELECT trang_thai FROM public.yeu_cau_sua_chua WHERE id=repair_id)<>'Chờ xử lý' THEN RAISE EXCEPTION 'deviation mutated repair lifecycle'; END IF;
  PERFORM pg_temp.tm06_expect_error(format('UPDATE public.temperature_monitoring_deviations SET triggering_snapshot=%L WHERE id=%L','{}',case_id),'55000');
  PERFORM pg_temp.tm06_expect_error(format('DELETE FROM public.temperature_monitoring_deviation_events WHERE deviation_id=%L',case_id),'55000');
  page:=public.temperature_monitoring_deviations_list('2026-07-01','2026-07-10',equipment);
  IF page->>'total'<>'3' OR page->>'open_count'<>'1' THEN RAISE EXCEPTION 'scoped counts differ: %',page; END IF;
  PERFORM pg_temp.tm06_expect_error('SELECT public.temperature_monitoring_deviations_list(''2026-01-01'',''2026-12-31'')','22023');
  PERFORM pg_temp.tm06_expect_error('SELECT public.temperature_monitoring_deviations_list(''2026-07-01'',''2026-07-10'',p_cursor:=''{}'')','22023');
  result:=public.temperature_monitoring_deviation_history(case_id,1);
  IF jsonb_array_length(result->'items')<>1 OR result->>'next_before_id' IS NULL THEN RAISE EXCEPTION 'history pagination failed'; END IF;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('khoa_phong','Other'))::TEXT,TRUE);
  page:=public.temperature_monitoring_deviations_list('2026-07-01','2026-07-10');
  IF page->>'total'<>'0' THEN RAISE EXCEPTION 'cross department list leaked'; END IF;
  FOREACH bad_action IN ARRAY ARRAY['SELECT * FROM public.temperature_monitoring_deviations','SELECT * FROM public.temperature_monitoring_deviation_events',
    'UPDATE public.temperature_monitoring_deviations SET severity=''Nhẹ''','DELETE FROM public.temperature_monitoring_deviations',
    'INSERT INTO public.temperature_monitoring_deviations(id) VALUES(gen_random_uuid())','SELECT public._temperature_monitoring_deviation_owner(NULL,NULL)'] LOOP
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM pg_temp.tm06_expect_error(bad_action,'42501');
    EXECUTE 'RESET ROLE';
  END LOOP;
END;
$$;
ROLLBACK;
