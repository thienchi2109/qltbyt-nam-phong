-- Align only to_qltb caller scope with tenant-wide Equipment access; preserve all other checks.
BEGIN;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_measurement_create(
  p_equipment_id BIGINT,
  p_monitoring_date DATE,
  p_shift_id UUID,
  p_value_c NUMERIC DEFAULT NULL,
  p_unable_reason TEXT DEFAULT NULL,
  p_captured_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  claims JSONB;
  role_name TEXT;
  actor BIGINT;
  tenant BIGINT;
  equipment_tenant BIGINT;
  department TEXT;
  equipment_department TEXT;
  reading public.temperature_readings;
  slot RECORD;
  policy RECORD;
  reading_snapshot JSONB;
  saving BOOLEAN := FALSE;
BEGIN
  BEGIN
    claims := COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor := NULLIF(claims->>'user_id','')::BIGINT;
    tenant := NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE = '42501';
  END;
  role_name := lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department := public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user') THEN
    RAISE EXCEPTION 'temperature measurement requires writer role' USING ERRCODE = '42501';
  END IF;
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id=actor) THEN
    RAISE EXCEPTION 'authenticated actor is required' USING ERRCODE = '42501';
  END IF;
  SELECT t.don_vi,public._normalize_department_scope(t.khoa_phong_quan_ly)
  INTO equipment_tenant,equipment_department FROM public.thiet_bi t WHERE id=p_equipment_id;
  IF NOT FOUND OR (role_name NOT IN ('global','admin') AND
    (tenant IS NULL OR equipment_tenant IS DISTINCT FROM tenant OR
      (role_name<>'to_qltb' AND (department IS NULL OR equipment_department IS DISTINCT FROM department)))) THEN
    RAISE EXCEPTION 'equipment is outside authorized scope' USING ERRCODE = '42501';
  END IF;
  PERFORM public._temperature_monitoring_lock_tenant(equipment_tenant);
  PERFORM 1 FROM public.thiet_bi t WHERE id=p_equipment_id AND don_vi IS NOT DISTINCT FROM equipment_tenant
    AND (role_name IN ('global','admin','to_qltb') OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment scope changed; retry' USING ERRCODE = '42501'; END IF;
  SELECT r.id,r.equipment_id,r.monitoring_date,r.shift_id,r.configuration_version_id,r.value_c,r.unable_reason,
    r.lower_c,r.upper_c,r.snapshot,r.source,r.operator_user_id,r.captured_at,r.created_at,r.note,r.status
  INTO reading FROM public.temperature_readings r
  WHERE r.equipment_id=p_equipment_id AND r.monitoring_date=p_monitoring_date AND r.shift_id=p_shift_id;
  IF FOUND THEN
    RETURN public.temperature_monitoring_reading_get(reading.id)||jsonb_build_object('outcome','conflict','next_action','amendment');
  END IF;
  IF p_monitoring_date IS NULL OR NOT isfinite(p_monitoring_date) OR p_shift_id IS NULL OR (p_captured_at IS NOT NULL AND NOT isfinite(p_captured_at))
    OR (p_value_c IS NULL AND NULLIF(btrim(p_unable_reason),'') IS NULL)
    OR (p_value_c IS NOT NULL AND p_unable_reason IS NOT NULL) THEN
    RAISE EXCEPTION 'provide one temperature value or an unable-to-measure reason and valid slot/time' USING ERRCODE = '22023';
  END IF;
  IF p_value_c IS NOT NULL AND (scale(p_value_c)>1 OR p_value_c NOT BETWEEN -200.0 AND 300.0
    OR p_value_c IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC)) THEN
    RAISE EXCEPTION 'temperature must be between -200.0 and 300.0 Celsius with at most one decimal place' USING ERRCODE = '22023';
  END IF;
  SELECT s.equipment_id,s.equipment_code,s.equipment_name,s.monitoring_date,s.shift_id,s.shift_code,s.shift_name,
    s.shift_start_local,s.shift_end_local,s.slot_start,s.slot_end,s.configuration_version_id,s.display_timezone
  INTO slot FROM public.temperature_monitoring_slots_list(p_monitoring_date,p_monitoring_date,
    ARRAY[(SELECT code FROM public.temperature_monitoring_schedule_shifts WHERE id=p_shift_id)],p_equipment_id,NULL,200,FALSE) s
  WHERE s.shift_id=p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot is not eligible for temperature entry' USING ERRCODE = '22023'; END IF;
  IF slot.slot_start>statement_timestamp() OR COALESCE(p_captured_at,statement_timestamp())<slot.slot_start
    OR COALESCE(p_captured_at,statement_timestamp())>=slot.slot_end
    OR COALESCE(p_captured_at,statement_timestamp())>statement_timestamp() THEN
    RAISE EXCEPTION 'actual capture time must be within the started slot and not in the future' USING ERRCODE='22023';
  END IF;
  SELECT v.id,v.lower_c,v.upper_c,v.recording_method_code,v.responsible_primary_user_id,
    v.responsible_substitute_user_ids,v.schedule_profile_id INTO STRICT policy
  FROM public.temperature_monitoring_configuration_versions v WHERE v.id=slot.configuration_version_id;
  IF policy.recording_method_code IS NULL OR policy.responsible_primary_user_id IS NULL THEN
    RAISE EXCEPTION 'slot monitoring configuration is incomplete' USING ERRCODE = '22023';
  END IF;
  reading_snapshot := to_jsonb(slot) || jsonb_build_object(
    'recording_method_code',policy.recording_method_code,'responsible_primary_user_id',policy.responsible_primary_user_id,
    'responsible_substitute_user_ids',policy.responsible_substitute_user_ids,'schedule_profile_id',policy.schedule_profile_id);
  saving := TRUE;
  INSERT INTO public.temperature_readings (equipment_id,monitoring_date,shift_id,configuration_version_id,value_c,unable_reason,
    lower_c,upper_c,snapshot,operator_user_id,captured_at,note)
  VALUES (p_equipment_id,p_monitoring_date,p_shift_id,policy.id,p_value_c,
    CASE WHEN p_value_c IS NULL THEN jsonb_build_object('reason',btrim(p_unable_reason)) END,
    policy.lower_c,policy.upper_c,reading_snapshot,actor,COALESCE(p_captured_at,statement_timestamp()),p_note)
  ON CONFLICT (equipment_id,monitoring_date,shift_id) DO NOTHING
  RETURNING id,equipment_id,monitoring_date,shift_id,configuration_version_id,value_c,unable_reason,
    lower_c,upper_c,snapshot,source,operator_user_id,captured_at,created_at,note,status INTO reading;
  IF NOT FOUND THEN
    SELECT r.id,r.equipment_id,r.monitoring_date,r.shift_id,r.configuration_version_id,r.value_c,r.unable_reason,
      r.lower_c,r.upper_c,r.snapshot,r.source,r.operator_user_id,r.captured_at,r.created_at,r.note,r.status
    INTO STRICT reading FROM public.temperature_readings r
    WHERE r.equipment_id=p_equipment_id AND r.monitoring_date=p_monitoring_date AND r.shift_id=p_shift_id;
    RETURN public.temperature_monitoring_reading_get(reading.id)||jsonb_build_object('outcome','conflict','next_action','amendment');
  END IF;
  INSERT INTO public.temperature_monitoring_reading_events (reading_id,event_type,after_state,actor_user_id)
  VALUES (reading.id,'reading_created',to_jsonb(reading),actor);
  IF reading.status='Bất thường' THEN
    INSERT INTO public.temperature_monitoring_reading_events (reading_id,event_type,after_state,actor_user_id)
    VALUES (reading.id,'deviation_created',jsonb_build_object('reading',to_jsonb(reading),
      'direction',CASE WHEN reading.value_c<reading.lower_c THEN 'below' ELSE 'above' END),actor);
  END IF;
  RETURN public.temperature_monitoring_reading_get(reading.id)||jsonb_build_object('outcome','created');
EXCEPTION
  WHEN OTHERS THEN
    IF NOT saving AND SQLSTATE IN ('42501','22023') THEN RAISE; END IF;
    -- This exception block rolls back the reading and both events before returning a safe error.
    RAISE EXCEPTION 'temperature measurement could not be saved' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_export_page(
  p_from_date DATE, p_to_date DATE, p_equipment_id BIGINT DEFAULT NULL,
  p_shift_codes TEXT[] DEFAULT NULL, p_status TEXT DEFAULT NULL,
  p_dataset TEXT DEFAULT 'readings', p_cursor JSONB DEFAULT NULL, p_limit INTEGER DEFAULT 25,
  p_started_at TIMESTAMPTZ DEFAULT statement_timestamp(), p_reading_ids UUID[] DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB; actor BIGINT; tenant BIGINT; department TEXT; role_name TEXT;
  filter_key JSONB; last_key TEXT; items JSONB; next_cursor JSONB;
BEGIN
  BEGIN
    claims:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor:=NULLIF(claims->>'user_id','')::BIGINT;
    tenant:=NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501';
  END;
  role_name:=lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department:=public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader')
    OR actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=actor)
    OR (role_name NOT IN ('global','admin') AND (tenant IS NULL OR (role_name<>'to_qltb' AND department IS NULL))) THEN
    RAISE EXCEPTION 'authenticated temperature capability required' USING ERRCODE='42501';
  END IF;
  IF p_equipment_id IS NOT NULL THEN PERFORM public._temperature_monitoring_assert_scope(p_equipment_id); END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR NOT isfinite(p_from_date) OR NOT isfinite(p_to_date)
    OR p_from_date>p_to_date OR EXTRACT(YEAR FROM p_from_date) NOT BETWEEN 1 AND 9999
    OR EXTRACT(YEAR FROM p_from_date)<>EXTRACT(YEAR FROM p_to_date)
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
    OR p_started_at IS NULL OR NOT isfinite(p_started_at) OR p_started_at>clock_timestamp()
    OR p_dataset IS NULL OR p_dataset NOT IN ('readings','amendments','reading_events','deviations','deviation_events')
    OR (p_status IS NOT NULL AND p_status NOT IN ('Đã ghi','Chờ xác nhận','Bất thường'))
    OR cardinality(p_shift_codes)>50 OR array_position(p_shift_codes,NULL) IS NOT NULL
    OR EXISTS(SELECT 1 FROM unnest(p_shift_codes) s WHERE length(s)>100 OR btrim(s)='')
    OR (p_dataset='readings' AND p_reading_ids IS NOT NULL)
    OR (p_dataset<>'readings' AND (p_reading_ids IS NULL OR cardinality(p_reading_ids) NOT BETWEEN 1 AND 25 OR array_position(p_reading_ids,NULL) IS NOT NULL)) THEN
    RAISE EXCEPTION 'invalid export filter, year, dataset or limit' USING ERRCODE='22023';
  END IF;
  filter_key:=jsonb_build_object('from',p_from_date,'to',p_to_date,'equipment',p_equipment_id,
    'shifts',p_shift_codes,'status',p_status,'dataset',p_dataset,'started',p_started_at,'reading_ids',p_reading_ids);
  IF p_cursor IS NOT NULL THEN
    IF jsonb_typeof(p_cursor)<>'object' OR length(p_cursor::TEXT)>8192 OR p_cursor->'filter' IS DISTINCT FROM filter_key
      OR jsonb_typeof(p_cursor->'key') IS DISTINCT FROM 'string' OR length(p_cursor->>'key') NOT BETWEEN 1 AND 64 THEN
      RAISE EXCEPTION 'invalid export cursor' USING ERRCODE='22023';
    END IF;
    last_key:=p_cursor->>'key';
    BEGIN
      IF p_dataset='deviation_events' THEN PERFORM last_key::BIGINT;
      ELSE PERFORM last_key::UUID; END IF;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid export cursor key' USING ERRCODE='22023';
    END;
  END IF;
  WITH scoped AS NOT MATERIALIZED (
    SELECT r.id,r.equipment_id,r.monitoring_date,r.shift_id,r.configuration_version_id,r.value_c,r.unable_reason,
      r.lower_c,r.upper_c,r.snapshot,r.source,r.operator_user_id,r.captured_at,r.created_at,r.note,
      t.ma_thiet_bi AS equipment_code,t.ten_thiet_bi AS equipment_name,
      COALESCE(e.after_state,public._temperature_monitoring_initial_state(r)) AS state,COALESCE(e.event_sequence,0) AS revision
    FROM public.temperature_readings r JOIN public.thiet_bi t ON t.id=r.equipment_id
    LEFT JOIN LATERAL (
      SELECT ev.after_state,ev.event_sequence FROM public.temperature_monitoring_reading_events ev
      WHERE ev.reading_id=r.id AND ev.event_type NOT IN ('reading_created','deviation_created')
      ORDER BY ev.event_sequence DESC LIMIT 1
    ) e ON TRUE
    WHERE r.monitoring_date BETWEEN p_from_date AND p_to_date AND r.created_at<=p_started_at
      AND (p_equipment_id IS NULL OR r.equipment_id=p_equipment_id)
      AND (p_shift_codes IS NULL OR r.snapshot->>'shift_code'=ANY(p_shift_codes))
      AND (p_reading_ids IS NULL OR r.id=ANY(p_reading_ids))
      AND (p_dataset<>'readings' OR last_key IS NULL OR r.id>CASE WHEN p_dataset='readings' THEN last_key::UUID END)
      AND (role_name IN ('global','admin') OR (t.don_vi=tenant AND (role_name='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department)))
  ), selected AS NOT MATERIALIZED (
    -- Membership replay intentionally preserves the selected ids, rather than re-filtering current status.
    SELECT s.id,s.equipment_id,s.monitoring_date,s.shift_id,s.configuration_version_id,s.value_c,s.unable_reason,
      s.lower_c,s.upper_c,s.snapshot,s.source,s.operator_user_id,s.captured_at,s.created_at,s.note,
      s.equipment_code,s.equipment_name,s.state,s.revision
    FROM scoped s WHERE p_reading_ids IS NOT NULL OR p_status IS NULL OR s.state->>'slot_status'=p_status
  ), source_rows AS (
    (SELECT s.id::TEXT AS key,jsonb_build_object('id',s.id,'equipment_id',s.equipment_id,
      'equipment_code',s.equipment_code,'equipment_name',s.equipment_name,'monitoring_date',s.monitoring_date,
      'shift_id',s.shift_id,'configuration_version_id',s.configuration_version_id,'snapshot',s.snapshot,
      'original_value_c',s.value_c,'original_unable_reason',s.unable_reason,'lower_c',s.lower_c,'upper_c',s.upper_c,
      'source',s.source,'operator_user_id',s.operator_user_id,'captured_at',s.captured_at,'created_at',s.created_at,'note',s.note,
      'effective_value_c',s.state->'effective'->'value_c','effective_unable_reason',s.state->'effective'->'unable_reason',
      'effective_author_user_id',s.state->'effective'->'author_user_id','state',s.state,'revision',s.revision) AS payload
    FROM selected s WHERE p_dataset='readings' ORDER BY s.id LIMIT p_limit+1)
    UNION ALL
    (SELECT a.id::TEXT,jsonb_build_object('id',a.id,'reading_id',a.reading_id,'value_c',a.value_c,'unable_reason',a.unable_reason,
      'reason',a.reason,'author_user_id',a.author_user_id,'created_at',a.created_at,
      'outcome',COALESCE(decision.event_type,'pending'),'decision_actor_user_id',decision.actor_user_id,
      'decision_reason',decision.reason,'decision_at',decision.created_at)
    FROM selected s JOIN public.temperature_reading_amendments a ON a.reading_id=s.id
    LEFT JOIN LATERAL (
      SELECT ev.event_type,ev.actor_user_id,ev.reason,ev.created_at FROM public.temperature_monitoring_reading_events ev
      WHERE ev.amendment_id=a.id AND ev.event_type IN ('amendment_approved','amendment_rejected') LIMIT 1
    ) decision ON TRUE WHERE p_dataset='amendments' AND a.created_at<=p_started_at
      AND (last_key IS NULL OR a.id>CASE WHEN p_dataset='amendments' THEN last_key::UUID END)
    ORDER BY a.id LIMIT p_limit+1)
    UNION ALL
    (SELECT e.id::TEXT,jsonb_build_object('id',e.id,'event_sequence',e.event_sequence,'reading_id',e.reading_id,
      'event_type',e.event_type,'amendment_id',e.amendment_id,'actor_user_id',e.actor_user_id,'created_at',e.created_at,
      'reason',e.reason,'before_state',e.before_state,'after_state',e.after_state)
    FROM selected s JOIN public.temperature_monitoring_reading_events e ON e.reading_id=s.id
    WHERE p_dataset='reading_events' AND e.created_at<=p_started_at
      AND (last_key IS NULL OR e.id>CASE WHEN p_dataset='reading_events' THEN last_key::UUID END)
    ORDER BY e.id LIMIT p_limit+1)
    UNION ALL
    (SELECT d.id::TEXT,jsonb_build_object('id',d.id,'reading_id',d.reading_id,'triggering_event_id',d.triggering_event_id,
      'equipment_id',d.equipment_id,'monitoring_date',d.monitoring_date,'triggering_snapshot',d.triggering_snapshot,
      'severity',d.severity,'status',d.status,'immediate_action',d.immediate_action,'owner_user_id',d.owner_user_id,
      'due_at',d.due_at,'cause',d.cause,'evidence',d.evidence,'verification_result',d.verification_result,
      'verified_by',verification.actor_user_id,'verified_at',verification.created_at,'repair_request_id',d.repair_request_id,
      'created_by',d.created_by,'created_at',d.created_at,'updated_at',d.updated_at,'revision',d.revision)
    FROM selected s JOIN public.temperature_monitoring_deviations d ON d.reading_id=s.id
    LEFT JOIN LATERAL (
      SELECT ev.actor_user_id,ev.created_at FROM public.temperature_monitoring_deviation_events ev
      WHERE ev.deviation_id=d.id AND ev.action='close' ORDER BY ev.id DESC LIMIT 1
    ) verification ON TRUE
    WHERE p_dataset='deviations' AND d.created_at<=p_started_at
      AND (last_key IS NULL OR d.id>CASE WHEN p_dataset='deviations' THEN last_key::UUID END)
    ORDER BY d.id LIMIT p_limit+1)
    UNION ALL
    (SELECT lpad(e.id::TEXT,20,'0'),jsonb_build_object('id',e.id,'deviation_id',e.deviation_id,'reading_id',s.id,
      'action',e.action,'actor_user_id',e.actor_user_id,'created_at',e.created_at,'reason',e.reason,
      'before_state',e.before_state,'after_state',e.after_state)
    FROM selected s JOIN public.temperature_monitoring_deviations d ON d.reading_id=s.id
    JOIN public.temperature_monitoring_deviation_events e ON e.deviation_id=d.id
    WHERE p_dataset='deviation_events' AND e.created_at<=p_started_at
      AND (last_key IS NULL OR e.id>CASE WHEN p_dataset='deviation_events' THEN last_key::BIGINT END)
    ORDER BY e.id LIMIT p_limit+1)
  ), page AS (
    SELECT key,payload FROM source_rows WHERE last_key IS NULL OR key>last_key ORDER BY key LIMIT p_limit+1
  ), visible AS (
    SELECT key,payload FROM page ORDER BY key LIMIT p_limit
  ) SELECT COALESCE((SELECT jsonb_agg(payload ORDER BY key) FROM visible),'[]'::JSONB),
    CASE WHEN (SELECT count(*) FROM page)>p_limit THEN
      (SELECT jsonb_build_object('key',key,'filter',filter_key) FROM visible ORDER BY key DESC LIMIT 1) END
  INTO items,next_cursor;
  RETURN jsonb_build_object('items',items,'next_cursor',next_cursor,'page_read_at',statement_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_deviations_list(
  p_date_from DATE DEFAULT NULL,p_date_to DATE DEFAULT NULL,p_equipment_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,p_severity TEXT DEFAULT NULL,p_owner_user_id BIGINT DEFAULT NULL,
  p_repair_request_id INTEGER DEFAULT NULL,p_limit INTEGER DEFAULT 50,p_cursor JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB;
  actor BIGINT;
  tenant BIGINT;
  role_name TEXT;
  department TEXT;
  cursor_date DATE;
  cursor_id UUID;
  items JSONB;
  total BIGINT;
  open_count BIGINT;
  next_cursor JSONB;
BEGIN
  BEGIN
    claims:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor:=NULLIF(claims->>'user_id','')::BIGINT;
    tenant:=NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501';
  END;
  role_name:=lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department:=public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader')
    OR actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=actor)
    OR (role_name NOT IN ('global','admin') AND (tenant IS NULL OR (role_name<>'to_qltb' AND department IS NULL))) THEN
    RAISE EXCEPTION 'authenticated temperature scope required' USING ERRCODE='42501';
  END IF;
  p_date_to:=COALESCE(p_date_to,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE);
  p_date_from:=COALESCE(p_date_from,p_date_to-29);
  IF NOT isfinite(p_date_from) OR NOT isfinite(p_date_to) OR p_date_to<p_date_from OR p_date_to-p_date_from>89
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_status IS NOT NULL AND p_status NOT IN ('Mở','Đang xử lý','Chờ xác minh','Đã đóng','Đã hủy'))
    OR (p_severity IS NOT NULL AND p_severity NOT IN ('Nhẹ','Nghiêm trọng','Khẩn cấp')) THEN
    RAISE EXCEPTION 'valid range up to 90 days, filters and page limit required' USING ERRCODE='22023';
  END IF;
  IF p_equipment_id IS NOT NULL THEN PERFORM public._temperature_monitoring_assert_scope(p_equipment_id); END IF;
  IF p_repair_request_id IS NOT NULL THEN PERFORM public.repair_request_get(p_repair_request_id); END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      IF jsonb_typeof(p_cursor)<>'object' OR p_cursor-ARRAY['monitoring_date','id']<>'{}'::JSONB THEN
        RAISE EXCEPTION 'invalid cursor';
      END IF;
      cursor_date:=(p_cursor->>'monitoring_date')::DATE; cursor_id:=(p_cursor->>'id')::UUID;
      IF cursor_date IS NULL OR cursor_id IS NULL OR NOT isfinite(cursor_date) OR cursor_date NOT BETWEEN p_date_from AND p_date_to THEN
        RAISE EXCEPTION 'invalid cursor';
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid cursor' USING ERRCODE='22023'; END;
  END IF;
  WITH scoped AS MATERIALIZED (
    SELECT d.* FROM public.temperature_monitoring_deviations d JOIN public.thiet_bi t ON t.id=d.equipment_id
    WHERE d.monitoring_date BETWEEN p_date_from AND p_date_to
      AND (role_name IN ('global','admin') OR (t.don_vi=tenant AND (role_name='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department)))
      AND (p_equipment_id IS NULL OR d.equipment_id=p_equipment_id) AND (p_status IS NULL OR d.status=p_status)
      AND (p_severity IS NULL OR d.severity=p_severity) AND (p_owner_user_id IS NULL OR d.owner_user_id=p_owner_user_id)
      AND (p_repair_request_id IS NULL OR d.repair_request_id=p_repair_request_id)
  ), page AS (
    SELECT s.* FROM scoped s WHERE p_cursor IS NULL OR (s.monitoring_date,s.id)<(cursor_date,cursor_id)
    ORDER BY s.monitoring_date DESC,s.id DESC LIMIT p_limit+1
  ) SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.monitoring_date DESC,page.id DESC),'[]'::JSONB),
    (SELECT count(*) FROM scoped),(SELECT count(*) FROM scoped WHERE status NOT IN ('Đã đóng','Đã hủy'))
    INTO items,total,open_count FROM page;
  IF jsonb_array_length(items)>p_limit THEN
    SELECT jsonb_agg(value ORDER BY ordinality) INTO items FROM jsonb_array_elements(items) WITH ORDINALITY WHERE ordinality<=p_limit;
    next_cursor:=jsonb_build_object('monitoring_date',items->(p_limit-1)->'monitoring_date','id',items->(p_limit-1)->'id');
  END IF;
  RETURN jsonb_build_object('items',items,'total',total,'open_count',open_count,'next_cursor',next_cursor,
    'date_from',p_date_from,'date_to',p_date_to,'max_range_days',90);
END;
$$;

COMMIT;
