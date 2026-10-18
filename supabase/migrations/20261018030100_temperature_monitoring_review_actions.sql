-- TM-05: locked, revision-bound amendments and review decisions.
CREATE FUNCTION public.temperature_monitoring_amendment_create(
  p_reading_id UUID,p_expected_revision BIGINT,p_value_c NUMERIC DEFAULT NULL,
  p_unable_reason TEXT DEFAULT NULL,p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  context RECORD;
  before_state JSONB;
  after_state JSONB;
  proposal UUID;
  saving BOOLEAN:=FALSE;
BEGIN
  SELECT * INTO context FROM public._temperature_monitoring_review_context(p_reading_id);
  p_reason:=regexp_replace(p_reason,'^[[:space:]]+|[[:space:]]+$','','g');
  p_unable_reason:=regexp_replace(p_unable_reason,'^[[:space:]]+|[[:space:]]+$','','g');
  IF p_expected_revision IS NULL OR p_expected_revision<0 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000
    OR (p_value_c IS NULL AND (p_unable_reason IS NULL OR length(btrim(p_unable_reason)) NOT BETWEEN 1 AND 2000))
    OR (p_value_c IS NOT NULL AND (p_unable_reason IS NOT NULL OR scale(p_value_c)>1
      OR p_value_c NOT BETWEEN -200.0 AND 300.0 OR p_value_c IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC))) THEN
    RAISE EXCEPTION 'invalid amendment value or reason' USING ERRCODE='22023';
  END IF;
  IF (context.state->>'revision')::BIGINT<>p_expected_revision OR context.state->>'pending_amendment_id' IS NOT NULL THEN
    RETURN context.state||jsonb_build_object('outcome','conflict');
  END IF;
  before_state:=context.state-'reading'-'revision'-'pending_amendment';
  saving:=TRUE;
  INSERT INTO public.temperature_reading_amendments(reading_id,value_c,unable_reason,reason,author_user_id,prior_state)
  VALUES(p_reading_id,p_value_c,CASE WHEN p_value_c IS NULL THEN jsonb_build_object('reason',btrim(p_unable_reason)) END,
    btrim(p_reason),context.actor_id,before_state) RETURNING id INTO proposal;
  after_state:=before_state||jsonb_build_object('slot_status','Chờ xác nhận','review_required',TRUE,
    'review_state','pending_amendment','pending_amendment_id',proposal);
  INSERT INTO public.temperature_monitoring_reading_events(reading_id,event_type,after_state,actor_user_id,amendment_id,reason,before_state)
  VALUES(p_reading_id,'amendment_created',after_state,context.actor_id,proposal,btrim(p_reason),before_state);
  RETURN public.temperature_monitoring_reading_get(p_reading_id)||jsonb_build_object('outcome','created');
EXCEPTION WHEN OTHERS THEN
  IF saving THEN RAISE EXCEPTION 'temperature amendment could not be saved' USING ERRCODE='P0001'; END IF;
  RAISE;
END;
$$;

CREATE FUNCTION public.temperature_monitoring_reading_review(
  p_reading_id UUID,p_expected_revision BIGINT,p_action TEXT,p_reason TEXT,p_amendment_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  context RECORD;
  before_state JSONB;
  after_state JSONB;
  proposal public.temperature_reading_amendments;
  effective JSONB;
  value_c NUMERIC;
  lower_c NUMERIC;
  upper_c NUMERIC;
  effective_status TEXT;
  event_name TEXT;
  saving BOOLEAN:=FALSE;
BEGIN
  SELECT * INTO context FROM public._temperature_monitoring_review_context(p_reading_id);
  p_reason:=regexp_replace(p_reason,'^[[:space:]]+|[[:space:]]+$','','g');
  IF context.role_name NOT IN ('global','admin','to_qltb') THEN
    RAISE EXCEPTION 'temperature manager role required' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('confirm','approve_amendment','reject_amendment','reopen')
    OR p_expected_revision IS NULL OR p_expected_revision<0
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'invalid review action or reason' USING ERRCODE='22023';
  END IF;
  IF context.actor_id=(context.state->'reading'->>'operator_user_id')::BIGINT THEN
    RAISE EXCEPTION 'reviewer must differ from original operator' USING ERRCODE='42501';
  END IF;
  IF (context.state->>'revision')::BIGINT<>p_expected_revision THEN
    RETURN context.state||jsonb_build_object('outcome','conflict');
  END IF;
  IF p_action IN ('approve_amendment','reject_amendment') THEN
    IF p_amendment_id IS NULL OR p_amendment_id IS DISTINCT FROM (context.state->>'pending_amendment_id')::UUID THEN
      RETURN context.state||jsonb_build_object('outcome','conflict');
    END IF;
    SELECT a.* INTO proposal FROM public.temperature_reading_amendments a WHERE id=p_amendment_id AND reading_id=p_reading_id;
    IF context.actor_id=proposal.author_user_id THEN
      RAISE EXCEPTION 'reviewer must differ from amendment author' USING ERRCODE='42501';
    END IF;
  ELSE
    IF p_amendment_id IS NOT NULL OR context.state->>'pending_amendment_id' IS NOT NULL
      OR (p_action='reopen' AND (context.state->>'review_required')::BOOLEAN)
      OR (p_action='confirm' AND NOT (context.state->>'review_required')::BOOLEAN) THEN
      RAISE EXCEPTION 'review action is not available in current state' USING ERRCODE='22023';
    END IF;
    IF context.actor_id=(context.state->'effective'->>'author_user_id')::BIGINT THEN
      RAISE EXCEPTION 'reviewer must differ from effective author' USING ERRCODE='42501';
    END IF;
  END IF;
  before_state:=context.state-'reading'-'revision'-'pending_amendment';
  after_state:=before_state;
  IF p_action='reject_amendment' THEN
    after_state:=proposal.prior_state;
    event_name:='amendment_rejected';
  ELSIF p_action='reopen' THEN
    after_state:=after_state||jsonb_build_object('slot_status','Chờ xác nhận','review_required',TRUE,'review_state','reopened');
    event_name:='reading_reopened';
  ELSE
    effective:=before_state->'effective';
    IF p_action='approve_amendment' THEN
      effective:=jsonb_build_object('value_c',proposal.value_c,'unable_reason',proposal.unable_reason,'author_user_id',proposal.author_user_id);
    END IF;
    value_c:=(effective->>'value_c')::NUMERIC;
    lower_c:=(context.state->'reading'->>'lower_c')::NUMERIC;
    upper_c:=(context.state->'reading'->>'upper_c')::NUMERIC;
    effective_status:=CASE WHEN value_c IS NULL OR value_c BETWEEN lower_c AND upper_c THEN 'Đã ghi' ELSE 'Bất thường' END;
    after_state:=after_state||jsonb_build_object('effective',effective,'effective_status',effective_status,'slot_status',effective_status,
      'is_unable_to_measure',value_c IS NULL,'is_in_range',value_c BETWEEN lower_c AND upper_c,
      'review_required',FALSE,'review_state','confirmed','pending_amendment_id',NULL,
      'confirmed_by',context.actor_id,'confirmed_at',clock_timestamp());
    event_name:=CASE WHEN p_action='confirm' THEN 'reading_confirmed' ELSE 'amendment_approved' END;
  END IF;
  saving:=TRUE;
  INSERT INTO public.temperature_monitoring_reading_events(reading_id,event_type,after_state,actor_user_id,amendment_id,reason,before_state)
  VALUES(p_reading_id,event_name,after_state,context.actor_id,p_amendment_id,btrim(p_reason),before_state);
  IF p_action='approve_amendment' AND effective_status='Bất thường' THEN
    INSERT INTO public.temperature_monitoring_reading_events(reading_id,event_type,after_state,actor_user_id)
    SELECT p_reading_id,'deviation_created',jsonb_build_object('reading',context.state->'reading'||jsonb_build_object(
      'value_c',value_c,'unable_reason',NULL,'status','Bất thường'),
      'direction',CASE WHEN value_c<lower_c THEN 'below' ELSE 'above' END,'amendment_id',p_amendment_id,
      'effective_author_user_id',proposal.author_user_id),context.actor_id
    WHERE NOT EXISTS(SELECT 1 FROM public.temperature_monitoring_reading_events WHERE reading_id=p_reading_id AND event_type='deviation_created');
  END IF;
  RETURN public.temperature_monitoring_reading_get(p_reading_id)||jsonb_build_object('outcome','updated');
EXCEPTION WHEN OTHERS THEN
  IF saving THEN RAISE EXCEPTION 'temperature review could not be saved' USING ERRCODE='P0001'; END IF;
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_amendment_create(UUID,BIGINT,NUMERIC,TEXT,TEXT),
  public.temperature_monitoring_reading_review(UUID,BIGINT,TEXT,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_amendment_create(UUID,BIGINT,NUMERIC,TEXT,TEXT),
  public.temperature_monitoring_reading_review(UUID,BIGINT,TEXT,TEXT,UUID) TO authenticated;
-- TM-05: tenant-scoped, bounded domain audit history; separate from equipment lifecycle.
CREATE FUNCTION public.temperature_monitoring_reading_history(
  p_equipment_id BIGINT,p_from_date DATE,p_to_date DATE,p_cursor TEXT DEFAULT NULL,p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  cursor_data JSONB;
  cursor_sequence BIGINT;
  items JSONB;
  last_sequence BIGINT;
  has_more BOOLEAN;
BEGIN
  PERFORM public._temperature_monitoring_assert_scope(p_equipment_id);
  IF p_from_date IS NULL OR p_to_date IS NULL OR NOT isfinite(p_from_date) OR NOT isfinite(p_to_date)
    OR p_to_date<p_from_date OR p_to_date-p_from_date>89 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid history range or limit' USING ERRCODE='22023';
  END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      IF length(p_cursor)>1000 THEN RAISE EXCEPTION 'oversized cursor'; END IF;
      cursor_data:=convert_from(decode(p_cursor,'base64'),'UTF8')::JSONB;
      cursor_sequence:=(cursor_data->>'sequence')::BIGINT;
      IF cursor_sequence IS NULL OR cursor_sequence<=0 OR cursor_data->>'equipment' IS DISTINCT FROM p_equipment_id::TEXT
        OR cursor_data->>'from' IS DISTINCT FROM p_from_date::TEXT OR cursor_data->>'to' IS DISTINCT FROM p_to_date::TEXT THEN
        RAISE EXCEPTION 'cursor filter mismatch';
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid history cursor' USING ERRCODE='22023'; END;
  END IF;
  WITH page AS MATERIALIZED (
    SELECT e.id,e.event_sequence,e.reading_id,e.event_type,e.amendment_id,e.reason,e.actor_user_id,e.created_at,
      CASE WHEN e.before_state#>>'{effective,unable_reason,reason}' IS NOT NULL THEN
        jsonb_set(e.before_state,'{effective,unable_reason,reason}',to_jsonb(left(e.before_state#>>'{effective,unable_reason,reason}',2000)))
        ELSE e.before_state END AS before_state,
      CASE WHEN e.event_type IN ('reading_created','deviation_created') THEN
        jsonb_build_object('value_c',COALESCE(e.after_state->'reading',e.after_state)->'value_c','unable_reason',
          CASE WHEN COALESCE(e.after_state->'reading',e.after_state)#>>'{unable_reason,reason}' IS NOT NULL THEN
            jsonb_build_object('reason',left(COALESCE(e.after_state->'reading',e.after_state)#>>'{unable_reason,reason}',2000)) END,
          'lower_c',r.lower_c,'upper_c',r.upper_c,
          'direction',e.after_state->'direction')
      WHEN e.after_state#>>'{effective,unable_reason,reason}' IS NOT NULL THEN
        jsonb_set(e.after_state,'{effective,unable_reason,reason}',to_jsonb(left(e.after_state#>>'{effective,unable_reason,reason}',2000)))
      ELSE e.after_state END AS after_state,
      jsonb_build_object('value_c',r.value_c,'unable_reason',CASE WHEN r.unable_reason IS NOT NULL THEN
        jsonb_build_object('reason',left(r.unable_reason->>'reason',2000)) END,'operator_user_id',r.operator_user_id,
        'captured_at',r.captured_at,'lower_c',r.lower_c,'upper_c',r.upper_c,'configuration_version_id',r.configuration_version_id) AS original
    FROM public.temperature_readings r JOIN public.temperature_monitoring_reading_events e ON e.reading_id=r.id
    WHERE r.equipment_id=p_equipment_id AND r.monitoring_date BETWEEN p_from_date AND p_to_date
      AND (cursor_sequence IS NULL OR e.event_sequence<cursor_sequence)
    ORDER BY e.event_sequence DESC LIMIT p_limit+1
  ), selected AS (
    SELECT * FROM page ORDER BY event_sequence DESC LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.event_sequence DESC),'[]'::JSONB),min(s.event_sequence),
    (SELECT count(*)>p_limit FROM page) INTO items,last_sequence,has_more FROM selected s;
  RETURN jsonb_build_object('events',items,'from_date',p_from_date,'to_date',p_to_date,'next_cursor',
    CASE WHEN has_more THEN encode(convert_to(jsonb_build_object('equipment',p_equipment_id::TEXT,
      'from',p_from_date::TEXT,'to',p_to_date::TEXT,'sequence',last_sequence)::TEXT,'UTF8'),'base64') END);
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_reading_history(BIGINT,DATE,DATE,TEXT,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_reading_history(BIGINT,DATE,DATE,TEXT,INTEGER) TO authenticated;
