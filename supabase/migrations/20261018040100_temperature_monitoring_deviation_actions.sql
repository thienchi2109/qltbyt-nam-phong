-- Revision and request identity protect case changes without coupling reading review.
CREATE FUNCTION public.temperature_monitoring_deviation_update(
  p_deviation_id UUID,p_expected_revision BIGINT,p_request_id UUID,p_action TEXT,
  p_immediate_action TEXT DEFAULT NULL,p_cause TEXT DEFAULT NULL,p_evidence TEXT DEFAULT NULL,
  p_owner_user_id BIGINT DEFAULT NULL,p_due_at TIMESTAMPTZ DEFAULT NULL,p_severity TEXT DEFAULT NULL,
  p_verification_result TEXT DEFAULT NULL,p_repair_request_id INTEGER DEFAULT NULL,p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  deviation public.temperature_monitoring_deviations;
  prior JSONB;
  payload JSONB;
  replay public.temperature_monitoring_deviation_events;
  actor BIGINT;
  role_name TEXT;
  allowed TEXT[];
  manager BOOLEAN;
  repair JSONB;
  supplied TEXT;
BEGIN
  SELECT d.* INTO deviation FROM public.temperature_monitoring_deviations d WHERE id=p_deviation_id;
  SELECT s.actor_id,s.role_name INTO actor,role_name FROM public._temperature_monitoring_assert_scope(deviation.equipment_id,TRUE) s;
  manager:=role_name IN ('global','admin','to_qltb');
  IF p_action IS NULL OR p_action NOT IN ('update_action','assign','severity','start','submit_verification','close','cancel','link_repair')
    OR p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN
    RAISE EXCEPTION 'valid action, request id and expected revision required' USING ERRCODE='22023';
  END IF;
  IF p_action IN ('assign','severity','close','cancel','link_repair') AND NOT manager THEN
    RAISE EXCEPTION 'deviation manager capability required' USING ERRCODE='42501';
  END IF;
  FOREACH supplied IN ARRAY ARRAY[p_immediate_action,p_cause,p_evidence,p_severity,p_verification_result,p_reason] LOOP
    IF supplied IS NOT NULL AND (length(supplied)>2000 OR supplied !~ '[^[:space:]]') THEN
      RAISE EXCEPTION 'nonblank text of at most 2000 characters required' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF p_due_at IS NOT NULL AND NOT isfinite(p_due_at) THEN RAISE EXCEPTION 'finite due date required' USING ERRCODE='22023'; END IF;
  payload:=jsonb_strip_nulls(jsonb_build_object('immediate_action',p_immediate_action,'cause',p_cause,'evidence',p_evidence,
    'owner_user_id',p_owner_user_id,'due_at',p_due_at,'severity',p_severity,'verification_result',p_verification_result,
    'repair_request_id',p_repair_request_id,'reason',p_reason));
  allowed:=CASE p_action WHEN 'update_action' THEN ARRAY['immediate_action','cause','evidence','reason']
    WHEN 'assign' THEN ARRAY['owner_user_id','due_at','reason'] WHEN 'severity' THEN ARRAY['severity','reason']
    WHEN 'close' THEN ARRAY['verification_result','reason'] WHEN 'link_repair' THEN ARRAY['repair_request_id','reason']
    ELSE ARRAY['reason'] END;
  IF payload-allowed<>'{}'::JSONB THEN RAISE EXCEPTION 'unsupported fields for action' USING ERRCODE='22023'; END IF;
  payload:=payload||jsonb_build_object('action',p_action,'expected_revision',p_expected_revision);
  -- Equipment was locked before repair, and repair is locked before the case.
  IF p_action='link_repair' AND p_repair_request_id IS NOT NULL THEN
    PERFORM 1 FROM public.yeu_cau_sua_chua WHERE id=p_repair_request_id FOR UPDATE;
    repair:=public.repair_request_get(p_repair_request_id);
    IF (repair->>'thiet_bi_id')::BIGINT IS DISTINCT FROM deviation.equipment_id THEN
      RAISE EXCEPTION 'repair must belong to the same equipment' USING ERRCODE='22023';
    END IF;
  END IF;
  SELECT d.* INTO deviation FROM public.temperature_monitoring_deviations d WHERE id=p_deviation_id FOR UPDATE;
  SELECT e.* INTO replay FROM public.temperature_monitoring_deviation_events e
  WHERE e.deviation_id=p_deviation_id AND e.request_id=p_request_id;
  IF FOUND THEN
    IF replay.actor_user_id<>actor OR replay.request_payload<>payload THEN
      RAISE EXCEPTION 'request id reused with different input or actor' USING ERRCODE='22023';
    END IF;
    RETURN public.temperature_monitoring_deviation_get(p_deviation_id)||jsonb_build_object('outcome','updated','replayed',TRUE);
  END IF;
  IF deviation.revision<>p_expected_revision THEN
    RETURN public.temperature_monitoring_deviation_get(p_deviation_id)||jsonb_build_object('outcome','conflict');
  END IF;
  IF deviation.status IN ('Đã đóng','Đã hủy') THEN RAISE EXCEPTION 'deviation is terminal' USING ERRCODE='55000'; END IF;
  prior:=to_jsonb(deviation);
  CASE p_action
    WHEN 'update_action' THEN
      deviation.immediate_action:=COALESCE(btrim(p_immediate_action),deviation.immediate_action);
      deviation.cause:=COALESCE(btrim(p_cause),deviation.cause);
      deviation.evidence:=COALESCE(btrim(p_evidence),deviation.evidence);
    WHEN 'assign' THEN
      IF p_owner_user_id IS NOT NULL AND NOT public._temperature_monitoring_deviation_owner(p_owner_user_id,deviation.equipment_id) THEN
        RAISE EXCEPTION 'active owner in equipment tenant and department required' USING ERRCODE='42501';
      END IF;
      IF deviation.owner_user_id IS NOT NULL AND deviation.owner_user_id IS DISTINCT FROM p_owner_user_id AND p_reason IS NULL THEN
        RAISE EXCEPTION 'reassignment reason required' USING ERRCODE='22023';
      END IF;
      deviation.owner_user_id:=p_owner_user_id; deviation.due_at:=p_due_at;
    WHEN 'severity' THEN
      IF p_severity IS NULL OR p_severity NOT IN ('Nhẹ','Nghiêm trọng','Khẩn cấp') OR p_reason IS NULL THEN
        RAISE EXCEPTION 'catalog severity and change reason required' USING ERRCODE='22023';
      END IF;
      deviation.severity:=p_severity;
    WHEN 'start' THEN
      IF deviation.status<>'Mở' THEN RAISE EXCEPTION 'only open cases can start' USING ERRCODE='55000'; END IF;
      deviation.status:='Đang xử lý';
    WHEN 'submit_verification' THEN
      IF deviation.status<>'Đang xử lý' THEN RAISE EXCEPTION 'only in-progress cases await verification' USING ERRCODE='55000'; END IF;
      deviation.status:='Chờ xác minh';
    WHEN 'close' THEN
      IF deviation.status<>'Chờ xác minh' THEN RAISE EXCEPTION 'case must await verification before closure' USING ERRCODE='55000'; END IF;
      deviation.verification_result:=COALESCE(btrim(p_verification_result),deviation.verification_result);
      IF deviation.immediate_action IS NULL OR deviation.verification_result IS NULL THEN
        RAISE EXCEPTION 'immediate action and verification result required to close' USING ERRCODE='22023';
      END IF;
      deviation.status:='Đã đóng';
    WHEN 'cancel' THEN
      IF deviation.status NOT IN ('Mở','Đang xử lý') OR p_reason IS NULL THEN
        RAISE EXCEPTION 'cancellation requires open/in-progress case and reason' USING ERRCODE='22023';
      END IF;
      deviation.status:='Đã hủy';
    WHEN 'link_repair' THEN deviation.repair_request_id:=p_repair_request_id;
  END CASE;
  UPDATE public.temperature_monitoring_deviations SET immediate_action=deviation.immediate_action,cause=deviation.cause,
    evidence=deviation.evidence,owner_user_id=deviation.owner_user_id,due_at=deviation.due_at,severity=deviation.severity,
    verification_result=deviation.verification_result,status=deviation.status,repair_request_id=deviation.repair_request_id,
    revision=deviation.revision+1,updated_at=clock_timestamp() WHERE id=p_deviation_id RETURNING * INTO deviation;
  INSERT INTO public.temperature_monitoring_deviation_events(deviation_id,action,request_id,request_payload,
    before_state,after_state,reason,actor_user_id)
  VALUES(p_deviation_id,p_action,p_request_id,payload,prior,to_jsonb(deviation),btrim(p_reason),actor);
  RETURN public.temperature_monitoring_deviation_get(p_deviation_id)||jsonb_build_object('outcome','updated','replayed',FALSE);
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_deviation_update(UUID,BIGINT,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,TEXT,TEXT,INTEGER,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_deviation_update(UUID,BIGINT,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TIMESTAMPTZ,TEXT,TEXT,INTEGER,TEXT) TO authenticated;
