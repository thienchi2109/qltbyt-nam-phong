-- TM-07: rich scoped workspace, status filters before keyset pagination.
BEGIN;
CREATE FUNCTION public.temperature_monitoring_workspace_list(
  p_from_date DATE DEFAULT CURRENT_DATE-29,p_to_date DATE DEFAULT CURRENT_DATE,
  p_equipment_id BIGINT DEFAULT NULL,p_shift_codes TEXT[] DEFAULT NULL,p_status TEXT DEFAULT NULL,
  p_cursor JSONB DEFAULT NULL,p_limit INTEGER DEFAULT 50,
  p_kind TEXT DEFAULT 'readings',p_deviation_status TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result JSONB; filter_key JSONB; cursor_date DATE; cursor_equipment BIGINT; cursor_shift UUID;
  claims JSONB:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
BEGIN
  IF p_status='current' THEN p_from_date:=CURRENT_DATE-1; p_to_date:=CURRENT_DATE+1; END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR (p_status IS NOT NULL AND p_status NOT IN ('Chưa ghi','Đã ghi','Chờ xác nhận','Bất thường','current'))
    OR p_kind IS NULL OR p_kind NOT IN ('readings','deviations','review_queue','open_deviations')
    OR (p_deviation_status IS NOT NULL AND (p_kind NOT IN ('deviations','open_deviations') OR p_deviation_status NOT IN ('Mở','Đang xử lý','Chờ xác minh','Đã đóng','Đã hủy')))
    OR cardinality(p_shift_codes)>50 THEN RAISE EXCEPTION 'invalid workspace filter or limit' USING ERRCODE='22023'; END IF;
  filter_key:=jsonb_build_object('from',p_from_date,'to',p_to_date,'equipment',p_equipment_id,'shifts',p_shift_codes,'status',p_status,'kind',p_kind,'deviation_status',p_deviation_status);
  IF p_cursor IS NOT NULL THEN
    BEGIN
      IF length(p_cursor::TEXT)>4096 OR jsonb_typeof(p_cursor)<>'object' OR p_cursor->'filter' IS DISTINCT FROM filter_key
        OR NOT(p_cursor ?& ARRAY['date','equipment','shift']) THEN RAISE EXCEPTION 'cursor filter mismatch'; END IF;
      cursor_date:=(p_cursor->>'date')::DATE; cursor_equipment:=(p_cursor->>'equipment')::BIGINT; cursor_shift:=(p_cursor->>'shift')::UUID;
      IF cursor_date IS NULL OR cursor_equipment IS NULL OR cursor_shift IS NULL THEN RAISE EXCEPTION 'incomplete cursor'; END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid workspace cursor' USING ERRCODE='22023'; END;
  END IF;
  WITH slots AS MATERIALIZED (
    SELECT s.* FROM public._temperature_monitoring_slot_rows(p_from_date,p_to_date,NULL,p_equipment_id,FALSE) s
  ), latest AS (
    SELECT DISTINCT ON(e.reading_id) e.reading_id,e.after_state,e.event_sequence
    FROM slots s JOIN public.temperature_readings r USING(equipment_id,monitoring_date,shift_id)
    JOIN public.temperature_monitoring_reading_events e ON e.reading_id=r.id
    WHERE e.event_type NOT IN ('reading_created','deviation_created') ORDER BY e.reading_id,e.event_sequence DESC
  ), enriched AS (
    SELECT s.*,r.id AS reading_id,r.operator_user_id,r.captured_at,r.created_at,r.note,
      COALESCE(r.lower_c,v.lower_c) AS lower_c,COALESCE(r.upper_c,v.upper_c) AS upper_c,
      COALESCE(r.snapshot->>'recording_method_code',v.recording_method_code) AS recording_method_code,m.name AS recording_method_name,
      COALESCE(l.event_sequence,0) AS revision,
      CASE WHEN r.id IS NOT NULL THEN COALESCE(l.after_state,public._temperature_monitoring_initial_state(r)) END AS state,
      CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'status',d.status,'severity',d.severity,'revision',d.revision) END AS deviation,
      a.author_user_id AS proposal_author_user_id
    FROM slots s LEFT JOIN public.temperature_readings r USING(equipment_id,monitoring_date,shift_id)
    LEFT JOIN public.temperature_monitoring_configuration_versions v ON v.id=s.configuration_version_id
    LEFT JOIN latest l ON l.reading_id=r.id
    LEFT JOIN public.temperature_monitoring_recording_methods m ON m.code=COALESCE(r.snapshot->>'recording_method_code',v.recording_method_code)
    LEFT JOIN public.temperature_monitoring_deviations d ON d.reading_id=r.id
    LEFT JOIN public.temperature_reading_amendments a ON a.id=(l.after_state->>'pending_amendment_id')::UUID
    WHERE (p_shift_codes IS NULL OR s.shift_code=ANY(p_shift_codes)) AND (p_status IS NULL OR s.status=p_status OR (p_status='current' AND s.slot_start<=statement_timestamp() AND statement_timestamp()<s.slot_end))
      AND (p_kind NOT IN ('deviations','open_deviations') OR d.id IS NOT NULL) AND (p_deviation_status IS NULL OR d.status=p_deviation_status)
      AND (p_kind<>'open_deviations' OR d.status NOT IN ('Đã đóng','Đã hủy'))
      AND (p_kind<>'review_queue' OR (lower(COALESCE(NULLIF(claims->>'app_role',''),claims->>'role')) IN ('global','admin','to_qltb')
        AND COALESCE((l.after_state->>'review_required')::BOOLEAN,r.status<>'Đã ghi') AND r.operator_user_id<>(claims->>'user_id')::BIGINT
        AND COALESCE((l.after_state->'effective'->>'author_user_id')::BIGINT,r.operator_user_id)<>(claims->>'user_id')::BIGINT
        AND (a.author_user_id IS NULL OR a.author_user_id<>(claims->>'user_id')::BIGINT)))
  ), page AS (
    SELECT e.* FROM enriched e WHERE cursor_date IS NULL OR (e.monitoring_date,e.equipment_id,e.shift_id)>(cursor_date,cursor_equipment,cursor_shift)
    ORDER BY e.monitoring_date,e.equipment_id,e.shift_id LIMIT p_limit+1
  ), visible AS (SELECT * FROM page ORDER BY monitoring_date,equipment_id,shift_id LIMIT p_limit)
  SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(to_jsonb(x)||jsonb_build_object('value_c',x.state->'effective'->'value_c','unable_reason',x.state->'effective'->'unable_reason') ORDER BY x.monitoring_date,x.equipment_id,x.shift_id) FROM visible x),'[]'::JSONB),
    'shift_choices',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.code) FROM (SELECT DISTINCT shift_code AS code,shift_name AS name FROM slots) c),'[]'::JSONB),'total',(SELECT count(*) FROM enriched),'from_date',p_from_date,'to_date',p_to_date,'server_now',statement_timestamp(),
    'empty_reason',CASE WHEN EXISTS(SELECT 1 FROM enriched) THEN NULL
      WHEN EXISTS(SELECT 1 FROM slots) THEN CASE WHEN p_status='current' THEN 'no_eligible_slots'
        WHEN p_kind IN ('review_queue','open_deviations') OR (p_kind='deviations' AND (p_deviation_status IS NULL OR p_deviation_status IN ('Mở','Đang xử lý','Chờ xác minh'))) OR p_status='Chờ xác nhận' THEN 'no_pending_work' ELSE 'no_matches' END
      WHEN EXISTS(SELECT 1 FROM public.temperature_monitoring_configuration_versions v JOIN public.thiet_bi t ON t.id=v.equipment_id
        WHERE v.monitoring_enabled AND NOT COALESCE(t.is_deleted,FALSE) AND (p_equipment_id IS NULL OR t.id=p_equipment_id)
          AND (lower(COALESCE(NULLIF(claims->>'app_role',''),claims->>'role')) IN ('global','admin') OR
            (t.don_vi=(claims->>'don_vi')::BIGINT AND public._normalize_department_scope(t.khoa_phong_quan_ly)=public._normalize_department_scope(claims->>'khoa_phong'))))
      THEN 'no_eligible_slots' ELSE 'no_monitored_equipment' END,
    'next_cursor',CASE WHEN (SELECT count(*) FROM page)>p_limit THEN (SELECT jsonb_build_object('date',x.monitoring_date,'equipment',x.equipment_id,'shift',x.shift_id,'filter',filter_key) FROM visible x ORDER BY x.monitoring_date DESC,x.equipment_id DESC,x.shift_id DESC LIMIT 1) END)
  INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_workspace_list(DATE,DATE,BIGINT,TEXT[],TEXT,JSONB,INTEGER,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_workspace_list(DATE,DATE,BIGINT,TEXT[],TEXT,JSONB,INTEGER,TEXT,TEXT) TO authenticated;
COMMIT;
