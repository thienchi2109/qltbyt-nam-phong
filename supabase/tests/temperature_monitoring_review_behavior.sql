-- TM-05 real RPC behavior; all fixtures and injected failures roll back.
BEGIN;
CREATE FUNCTION pg_temp.tm05_expect_error(p_sql TEXT,p_state TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected SQLSTATE %, statement succeeded',p_state;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_state THEN RAISE; END IF;
END;
$$;
CREATE FUNCTION pg_temp.tm05_fail_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_type=current_setting('tm05.fail_event',TRUE) THEN RAISE EXCEPTION 'injected sensitive failure' USING ERRCODE='22023'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm05_injected_failure BEFORE INSERT ON public.temperature_monitoring_reading_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.tm05_fail_event();
DO $$
#variable_conflict use_column
DECLARE
  tenant BIGINT;
  actor BIGINT;
  author BIGINT;
  reviewer BIGINT;
  actors BIGINT[];
  equipment BIGINT;
  shift UUID;
  profile UUID;
  reading_id UUID;
  result JSONB;
  original JSONB;
  state JSONB;
  prior JSONB;
  proposal UUID;
  normal_id UUID;
  unable_id UUID;
  bad TEXT;
  claims JSONB;
  role_name TEXT;
  event_name TEXT;
  n BIGINT;
  page JSONB;
BEGIN
  SELECT id INTO tenant FROM public.don_vi ORDER BY id LIMIT 1;
  SELECT array_agg(id) INTO actors FROM (SELECT id FROM public.nhan_vien ORDER BY id LIMIT 3) x;
  IF array_length(actors,1)<>3 THEN RAISE EXCEPTION 'requires three existing actors'; END IF;
  actor:=actors[1]; author:=actors[2]; reviewer:=actors[3];
  INSERT INTO public.thiet_bi(ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai)
  VALUES ('TM05-'||gen_random_uuid(),'TM05 rollback fixture',tenant,'TM05 Fixture','Hoạt động') RETURNING id INTO equipment;
  SELECT id INTO profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default';
  SELECT id INTO shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=profile AND code='dem';
  INSERT INTO public.temperature_monitoring_recording_methods(code,name) VALUES('tm05-fixture','TM05 method');
  INSERT INTO public.temperature_monitoring_configuration_versions(equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,recording_method_code,responsible_primary_user_id,change_reason)
  VALUES(equipment,tstzrange('2026-07-01Z','2026-07-10Z','[)'),2,8,profile,'tm05-fixture',actor,'TM05 fixture');
  claims:=jsonb_build_object('app_role','to_qltb','user_id',actor,'don_vi',tenant,'khoa_phong','TM05 Fixture');
  PERFORM set_config('request.jwt.claims',claims::TEXT,TRUE);
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-02',shift,9,NULL,'2026-07-02 16:00Z');
  reading_id:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_reading_get(reading_id);
  IF result->>'slot_status'<>'Chờ xác nhận' OR result->>'review_required'<>'true'
    OR result->'effective'->>'value_c'<>'9' OR result->>'effective_status'<>'Bất thường' THEN
    RAISE EXCEPTION 'unreviewed abnormal must queue without changing original value: %',result;
  END IF;
  original:=result->'reading';
  prior:=result-'reading'-'pending_amendment';
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-03',shift,2,NULL,'2026-07-03 16:00Z','original note');
  normal_id:=(result->'reading'->>'id')::UUID;
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-04',shift,NULL,'not measurable','2026-07-04 16:00Z');
  unable_id:=(result->'reading'->>'id')::UUID;

  -- A pending original review may be amended; a rejection restores it exactly.
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',author))::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(reading_id,0,5,NULL,'correct transcription');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  IF result->'effective'->>'value_c'<>'9' THEN RAISE EXCEPTION 'proposal changed effective value'; END IF;
  state:=public.temperature_monitoring_reading_get(reading_id);
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L,%L)',reading_id,state->>'revision','approve_amendment','self',proposal),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',actor,'app_role','global'))::TEXT,TRUE);
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L,%L)',reading_id,state->>'revision','approve_amendment','self original',proposal),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer))::TEXT,TRUE);
  result:=public.temperature_monitoring_reading_review(reading_id,(state->>'revision')::BIGINT,'reject_amendment','not supported',proposal);
  IF (result-'outcome'-'revision'-'reading'-'pending_amendment')<>(prior-'revision') THEN RAISE EXCEPTION 'rejection did not restore pending original: % vs %',result,prior; END IF;
  IF result->'reading'<>original THEN RAISE EXCEPTION 'original mutated'; END IF;
  result:=public.temperature_monitoring_reading_review(reading_id,(result->>'revision')::BIGINT,'confirm','verified original');
  IF result->>'slot_status'<>'Bất thường' OR result->>'review_required'<>'false' THEN RAISE EXCEPTION 'confirmation projection'; END IF;
  result:=public.temperature_monitoring_reading_review(reading_id,(result->>'revision')::BIGINT,'reopen','investigate again');
  prior:=result-'outcome'-'reading'-'pending_amendment';
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',author))::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(reading_id,(result->>'revision')::BIGINT,8,NULL,'new correction');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer))::TEXT,TRUE);
  result:=public.temperature_monitoring_reading_review(reading_id,(result->>'revision')::BIGINT,'reject_amendment','retain reopened original',proposal);
  IF (result-'outcome'-'revision'-'reading'-'pending_amendment')<>(prior-'revision') THEN RAISE EXCEPTION 'rejection lost reopened state'; END IF;

  -- Unable acknowledgment is settled, explicit and still NULL, and can reopen.
  state:=public.temperature_monitoring_reading_get(unable_id);
  result:=public.temperature_monitoring_reading_review(unable_id,(state->>'revision')::BIGINT,'confirm','unable acknowledged');
  IF result->>'slot_status'<>'Đã ghi' OR result->>'is_unable_to_measure'<>'true'
    OR result->'effective'->'value_c'<>'null'::JSONB OR result->'effective'->'unable_reason'->>'reason'<>'not measurable'
    OR result->'is_in_range'<>'null'::JSONB OR result->>'review_required'<>'false' THEN RAISE EXCEPTION 'unable was misclassified: %',result; END IF;
  result:=public.temperature_monitoring_reading_review(unable_id,(result->>'revision')::BIGINT,'reopen','check inability');
  IF result->>'slot_status'<>'Chờ xác nhận' THEN RAISE EXCEPTION 'unable reopen'; END IF;
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L)',unable_id,result->>'revision','reopen','again'),'22023');

  -- First correction to abnormal creates a durable handoff using original policy.
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',author))::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(normal_id,0,8.1,NULL,'correct transcription');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  state:=public.temperature_monitoring_reading_get(normal_id);
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer))::TEXT,TRUE);
  result:=public.temperature_monitoring_reading_review(normal_id,(state->>'revision')::BIGINT,'approve_amendment','checked source',proposal);
  IF result->'effective'->>'value_c'<>'8.1' OR result->>'slot_status'<>'Bất thường'
    OR (result->'effective'->>'author_user_id')::BIGINT<>author OR (result->'reading'->>'operator_user_id')::BIGINT<>actor
    OR result->'reading'->>'note'<>'original note' OR (result->'reading'->>'value_c')::NUMERIC<>2 THEN RAISE EXCEPTION 'approval/provenance failed: %',result; END IF;
  IF (SELECT count(*) FROM public.temperature_monitoring_reading_events WHERE reading_id=normal_id AND event_type='deviation_created')<>1
    OR NOT EXISTS(SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=normal_id AND event_type='deviation_created'
      AND after_state->>'direction'='above' AND (after_state->'reading'->>'value_c')::NUMERIC=8.1 AND (after_state->'reading'->>'upper_c')::NUMERIC=8) THEN RAISE EXCEPTION 'corrected breach handoff'; END IF;
  IF (SELECT status FROM public.temperature_monitoring_slots_list('2026-07-03','2026-07-03',ARRAY['dem'],equipment,NULL,10,FALSE))<>'Bất thường' THEN RAISE EXCEPTION 'saved-slot effective projection'; END IF;
  result:=public.temperature_monitoring_measurement_create(equipment,'2026-07-03',shift,7,NULL,'2026-07-03 16:00Z');
  IF result->>'outcome'<>'conflict' OR result->>'slot_status'<>'Bất thường' OR result->'effective'->>'value_c'<>'8.1' THEN RAISE EXCEPTION 'duplicate effective projection'; END IF;
  result:=public.temperature_monitoring_reading_review(normal_id,(state->>'revision')::BIGINT,'reject_amendment','stale',proposal);
  IF result->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'stale decision not conflict'; END IF;
  state:=public.temperature_monitoring_reading_get(normal_id);
  result:=public.temperature_monitoring_reading_review(normal_id,(state->>'revision')::BIGINT,'approve_amendment','wrong proposal',gen_random_uuid());
  IF result->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'wrong target not conflict'; END IF;

  -- Every immutable proposal rejects invalid values and trust-boundary inputs.
  FOREACH bad IN ARRAY ARRAY['NaN','Infinity','-Infinity','2.01','-200.1','300.1'] LOOP
    PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,%L::NUMERIC,NULL,%L)',normal_id,state->>'revision',bad,'invalid'),'22023');
  END LOOP;
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,5,NULL,%L)',normal_id,state->>'revision',' '),'22023');
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,5,NULL,%L)',normal_id,state->>'revision',E'\t\n'),'22023');
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,5,%L,%L)',normal_id,state->>'revision','both','invalid'),'22023');
  FOREACH role_name IN ARRAY ARRAY['regional_leader','unknown',''] LOOP
    PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer,'app_role',role_name))::TEXT,TRUE);
    PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,5,NULL,%L)',normal_id,state->>'revision','denied'),'42501');
  END LOOP;
  FOREACH bad IN ARRAY ARRAY['','invalid','999999999999999999999999'] LOOP
    PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',bad))::TEXT,TRUE);
    PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_get(%L)',normal_id),'42501');
  END LOOP;
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer,'don_vi',tenant+999999))::TEXT,TRUE);
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_get(%L)',normal_id),'42501');
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,0,%L,%L)',normal_id,'confirm','stale unauthorized'),'42501');
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_history(%s,%L,%L)',equipment,'2026-07-01','2026-07-10'),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer,'app_role','user','khoa_phong','elsewhere'))::TEXT,TRUE);
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_get(%L)',normal_id),'42501');
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer))::TEXT,TRUE);

  -- Atomic insertion failures for every mutation category, including second event.
  FOREACH event_name IN ARRAY ARRAY['amendment_created','reading_reopened'] LOOP
    state:=public.temperature_monitoring_reading_get(normal_id);
    SELECT count(*) INTO n FROM public.temperature_reading_amendments WHERE reading_id=normal_id;
    PERFORM set_config('tm05.fail_event',event_name,TRUE);
    IF event_name='amendment_created' THEN
      PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_amendment_create(%L,%s,5,NULL,%L)',normal_id,state->>'revision','injected'),'P0001');
    ELSE
      PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L)',normal_id,state->>'revision','reopen','injected'),'P0001');
    END IF;
    IF public.temperature_monitoring_reading_get(normal_id)<>state OR (SELECT count(*) FROM public.temperature_reading_amendments WHERE reading_id=normal_id)<>n THEN RAISE EXCEPTION 'partial % residue',event_name; END IF;
    PERFORM set_config('tm05.fail_event','',TRUE);
  END LOOP;
  state:=public.temperature_monitoring_reading_get(unable_id);
  PERFORM set_config('tm05.fail_event','reading_confirmed',TRUE);
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L)',unable_id,state->>'revision','confirm','injected'),'P0001');
  IF public.temperature_monitoring_reading_get(unable_id)<>state THEN RAISE EXCEPTION 'partial confirmation'; END IF;
  PERFORM set_config('tm05.fail_event','',TRUE);
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',author))::TEXT,TRUE);
  result:=public.temperature_monitoring_amendment_create(unable_id,(state->>'revision')::BIGINT,1.9,NULL,'recover observed value');
  proposal:=(result->'pending_amendment'->>'id')::UUID;
  state:=public.temperature_monitoring_reading_get(unable_id);
  PERFORM set_config('request.jwt.claims',(claims||jsonb_build_object('user_id',reviewer))::TEXT,TRUE);
  FOREACH event_name IN ARRAY ARRAY['amendment_approved','amendment_rejected','deviation_created'] LOOP
    PERFORM set_config('tm05.fail_event',event_name,TRUE);
    PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_review(%L,%s,%L,%L,%L)',unable_id,state->>'revision',CASE WHEN event_name='amendment_rejected' THEN 'reject_amendment' ELSE 'approve_amendment' END,'injected',proposal),'P0001');
    IF public.temperature_monitoring_reading_get(unable_id)<>state OR EXISTS(SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=unable_id AND event_type='deviation_created') THEN RAISE EXCEPTION 'partial %',event_name; END IF;
    PERFORM set_config('tm05.fail_event','',TRUE);
  END LOOP;

  -- Dedicated bounded domain history, explicit ACL and append-only protection.
  page:=public.temperature_monitoring_reading_history(equipment,'2026-07-01','2026-07-10',NULL,1);
  IF jsonb_array_length(page->'events')<>1 OR page->>'next_cursor' IS NULL THEN RAISE EXCEPTION 'history first page'; END IF;
  result:=public.temperature_monitoring_reading_history(equipment,'2026-07-01','2026-07-10',page->>'next_cursor',100);
  IF jsonb_array_length(result->'events')<5 OR result->'events'->0->>'id'=page->'events'->0->>'id' THEN RAISE EXCEPTION 'history continuation'; END IF;
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_history(%s,%L,%L)',equipment,'2026-01-01','2026-07-10'),'22023');
  PERFORM pg_temp.tm05_expect_error(format('SELECT public.temperature_monitoring_reading_history(%s,%L,%L,%L,10)',equipment,'2026-07-01','2026-07-09',page->>'next_cursor'),'22023');
  PERFORM pg_temp.tm05_expect_error(format('UPDATE public.temperature_reading_amendments SET reason=%L WHERE id=%L','tamper',proposal),'55000');
  PERFORM pg_temp.tm05_expect_error(format('DELETE FROM public.temperature_reading_amendments WHERE id=%L',proposal),'55000');
  PERFORM pg_temp.tm05_expect_error(format('UPDATE public.temperature_monitoring_reading_events SET reason=%L WHERE reading_id=%L','tamper',normal_id),'55000');
  IF has_table_privilege('authenticated','public.temperature_reading_amendments','INSERT') OR has_table_privilege('authenticated','public.temperature_reading_amendments','SELECT') THEN RAISE EXCEPTION 'proposal client access'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.temperature_reading_amendments'::REGCLASS) THEN RAISE EXCEPTION 'proposal RLS disabled'; END IF;
  SET LOCAL ROLE authenticated;
  result:=public.temperature_monitoring_reading_get(normal_id);
  IF result->'effective'->>'value_c'<>'8.1' THEN RAISE EXCEPTION 'authenticated RPC failed'; END IF;
  PERFORM pg_temp.tm05_expect_error('SELECT id FROM public.temperature_reading_amendments','42501');
  RESET ROLE;
END;
$$;
ROLLBACK;
