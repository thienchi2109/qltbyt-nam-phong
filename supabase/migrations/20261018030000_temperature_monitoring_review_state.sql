-- TM-05: immutable proposals and indexed append-only confirmation state.
CREATE TABLE public.temperature_reading_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.temperature_readings(id),
  value_c NUMERIC,
  unable_reason JSONB,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000 AND reason !~ '^[[:space:]]*$'),
  author_user_id BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  prior_state JSONB NOT NULL,
  CHECK ((value_c IS NOT NULL AND unable_reason IS NULL AND scale(value_c)<=1
    AND value_c BETWEEN -200.0 AND 300.0 AND value_c NOT IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC))
    OR (value_c IS NULL AND unable_reason IS NOT NULL AND jsonb_typeof(unable_reason)='object'
      AND COALESCE(jsonb_typeof(unable_reason->'reason')='string'
        AND length(unable_reason->>'reason') BETWEEN 1 AND 2000 AND unable_reason->>'reason' !~ '^[[:space:]]*$',FALSE)))
);
CREATE INDEX temperature_reading_amendments_reading_idx ON public.temperature_reading_amendments(reading_id);
CREATE TRIGGER temperature_reading_amendments_immutable BEFORE UPDATE OR DELETE ON public.temperature_reading_amendments
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_reading_immutable();
ALTER TABLE public.temperature_reading_amendments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temperature_reading_amendments FROM PUBLIC,anon,authenticated;

ALTER TABLE public.temperature_monitoring_reading_events
  DROP CONSTRAINT temperature_monitoring_reading_events_event_type_check,
  DROP CONSTRAINT temperature_monitoring_reading_events_reading_id_event_type_key,
  ADD COLUMN event_sequence BIGINT GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN amendment_id UUID REFERENCES public.temperature_reading_amendments(id),
  ADD COLUMN reason TEXT CHECK (length(reason) BETWEEN 1 AND 2000 AND reason !~ '^[[:space:]]*$'),
  ADD COLUMN before_state JSONB,
  ADD CONSTRAINT temperature_monitoring_reading_events_review_metadata_check CHECK
    (event_type IN ('reading_created','deviation_created') OR (reason IS NOT NULL AND before_state IS NOT NULL
      AND (event_type IN ('reading_confirmed','reading_reopened') OR amendment_id IS NOT NULL))),
  ADD CONSTRAINT temperature_monitoring_reading_events_type_check CHECK (event_type IN
    ('reading_created','deviation_created','amendment_created','amendment_approved','amendment_rejected','reading_confirmed','reading_reopened'));
CREATE UNIQUE INDEX temperature_monitoring_reading_events_creation_unique
ON public.temperature_monitoring_reading_events(reading_id,event_type) WHERE event_type IN ('reading_created','deviation_created');
CREATE UNIQUE INDEX temperature_monitoring_reading_events_sequence_unique ON public.temperature_monitoring_reading_events(event_sequence);
CREATE UNIQUE INDEX temperature_monitoring_reading_events_proposal_unique ON public.temperature_monitoring_reading_events(amendment_id)
WHERE event_type='amendment_created';
CREATE UNIQUE INDEX temperature_monitoring_reading_events_decision_unique ON public.temperature_monitoring_reading_events(amendment_id)
WHERE event_type IN ('amendment_approved','amendment_rejected');
CREATE INDEX temperature_monitoring_reading_events_latest_idx ON public.temperature_monitoring_reading_events(reading_id,event_sequence DESC)
WHERE event_type NOT IN ('reading_created','deviation_created');
CREATE INDEX temperature_readings_equipment_date_idx ON public.temperature_readings(equipment_id,monitoring_date,id);

-- Private temperature-only scope check. Mutations preserve TM-04 lock order.
CREATE FUNCTION public._temperature_monitoring_assert_scope(p_equipment_id BIGINT,p_lock BOOLEAN DEFAULT FALSE)
RETURNS TABLE(actor_id BIGINT,role_name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB;
  tenant BIGINT;
  department TEXT;
  equipment_tenant BIGINT;
  equipment_department TEXT;
BEGIN
  BEGIN
    claims:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor_id:=NULLIF(claims->>'user_id','')::BIGINT;
    tenant:=NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501';
  END;
  role_name:=lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department:=public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader')
    OR actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=actor_id)
    OR (p_lock AND role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa')) THEN
    RAISE EXCEPTION 'authenticated temperature capability required' USING ERRCODE='42501';
  END IF;
  SELECT t.don_vi,public._normalize_department_scope(t.khoa_phong_quan_ly)
  INTO equipment_tenant,equipment_department FROM public.thiet_bi t WHERE id=p_equipment_id;
  IF NOT FOUND OR (role_name NOT IN ('global','admin') AND
    (tenant IS NULL OR department IS NULL OR equipment_tenant IS DISTINCT FROM tenant OR equipment_department IS DISTINCT FROM department)) THEN
    RAISE EXCEPTION 'equipment is outside authorized scope' USING ERRCODE='42501';
  END IF;
  IF p_lock THEN
    PERFORM public._temperature_monitoring_lock_tenant(equipment_tenant);
  END IF;
  PERFORM 1 FROM public.thiet_bi t WHERE id=p_equipment_id AND t.don_vi IS NOT DISTINCT FROM equipment_tenant
    AND (role_name IN ('global','admin') OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment scope changed; retry' USING ERRCODE='42501'; END IF;
  RETURN NEXT;
END;
$$;

-- Complete state snapshots avoid replaying event history on every read.
CREATE FUNCTION public._temperature_monitoring_initial_state(p_reading public.temperature_readings)
RETURNS JSONB LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('effective',jsonb_build_object('value_c',p_reading.value_c,'unable_reason',p_reading.unable_reason,
    'author_user_id',p_reading.operator_user_id),'effective_status',CASE WHEN p_reading.value_c IS NULL THEN 'Đã ghi' ELSE p_reading.status END,
    'slot_status',CASE WHEN p_reading.status='Đã ghi' THEN 'Đã ghi' ELSE 'Chờ xác nhận' END,
    'is_unable_to_measure',p_reading.value_c IS NULL,'is_in_range',p_reading.value_c BETWEEN p_reading.lower_c AND p_reading.upper_c,
    'review_required',p_reading.status<>'Đã ghi','review_state',CASE WHEN p_reading.status='Đã ghi' THEN 'confirmed' ELSE 'pending' END,
    'pending_amendment_id',NULL,'confirmed_by',NULL,'confirmed_at',NULL);
$$;

CREATE FUNCTION public.temperature_monitoring_reading_get(p_reading_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  reading public.temperature_readings;
  state JSONB;
  revision BIGINT;
  proposal JSONB;
BEGIN
  SELECT r.* INTO reading FROM public.temperature_readings r WHERE id=p_reading_id;
  PERFORM public._temperature_monitoring_assert_scope(reading.equipment_id);
  SELECT e.after_state,e.event_sequence INTO state,revision FROM public.temperature_monitoring_reading_events e
  WHERE e.reading_id=p_reading_id AND e.event_type NOT IN ('reading_created','deviation_created')
  ORDER BY e.event_sequence DESC LIMIT 1;
  state:=COALESCE(state,public._temperature_monitoring_initial_state(reading));
  IF state->>'pending_amendment_id' IS NOT NULL THEN
    SELECT jsonb_build_object('id',a.id,'value_c',a.value_c,'unable_reason',a.unable_reason,'reason',a.reason,
      'author_user_id',a.author_user_id,'created_at',a.created_at) INTO proposal
    FROM public.temperature_reading_amendments a WHERE id=(state->>'pending_amendment_id')::UUID;
  END IF;
  RETURN state||jsonb_build_object('reading',to_jsonb(reading),'revision',COALESCE(revision,0),'pending_amendment',proposal);
END;
$$;

CREATE FUNCTION public._temperature_monitoring_review_context(p_reading_id UUID)
RETURNS TABLE(actor_id BIGINT,role_name TEXT,state JSONB) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE equipment BIGINT;
BEGIN
  SELECT equipment_id INTO equipment FROM public.temperature_readings WHERE id=p_reading_id;
  SELECT s.actor_id,s.role_name INTO actor_id,role_name FROM public._temperature_monitoring_assert_scope(equipment,TRUE) s;
  PERFORM 1 FROM public.temperature_readings WHERE id=p_reading_id FOR UPDATE;
  state:=public.temperature_monitoring_reading_get(p_reading_id);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public._temperature_monitoring_assert_scope(BIGINT,BOOLEAN),
  public._temperature_monitoring_initial_state(public.temperature_readings),public._temperature_monitoring_review_context(UUID)
FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.temperature_monitoring_reading_get(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_reading_get(UUID) TO authenticated;
