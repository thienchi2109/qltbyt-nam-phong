-- TM-09: one-calendar-year recorded history; independent of interactive slot generation.
BEGIN;
CREATE FUNCTION public.temperature_monitoring_export_page(
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
    OR (role_name NOT IN ('global','admin') AND (tenant IS NULL OR department IS NULL)) THEN
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
      AND (role_name IN ('global','admin') OR (t.don_vi=tenant AND public._normalize_department_scope(t.khoa_phong_quan_ly)=department))
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
REVOKE ALL ON FUNCTION public.temperature_monitoring_export_page(DATE,DATE,BIGINT,TEXT[],TEXT,TEXT,JSONB,INTEGER,TIMESTAMPTZ,UUID[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_export_page(DATE,DATE,BIGINT,TEXT[],TEXT,TEXT,JSONB,INTEGER,TIMESTAMPTZ,UUID[]) TO authenticated;
COMMIT;
