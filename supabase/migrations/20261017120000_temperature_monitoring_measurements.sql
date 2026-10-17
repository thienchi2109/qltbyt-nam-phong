-- TM-04: immutable manual readings, atomic business events and recoverable duplicates.
CREATE TABLE public.temperature_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id BIGINT NOT NULL REFERENCES public.thiet_bi(id),
  monitoring_date DATE NOT NULL,
  shift_id UUID NOT NULL REFERENCES public.temperature_monitoring_schedule_shifts(id),
  configuration_version_id UUID NOT NULL REFERENCES public.temperature_monitoring_configuration_versions(id),
  value_c NUMERIC,
  unable_reason JSONB,
  lower_c NUMERIC NOT NULL,
  upper_c NUMERIC NOT NULL,
  snapshot JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source = 'manual'),
  operator_user_id BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  captured_at TIMESTAMPTZ NOT NULL CHECK (isfinite(captured_at)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  status TEXT GENERATED ALWAYS AS (
    CASE WHEN value_c IS NULL THEN 'Chờ xác nhận'
         WHEN value_c BETWEEN lower_c AND upper_c THEN 'Đã ghi' ELSE 'Bất thường' END
  ) STORED,
  CONSTRAINT temperature_readings_slot_unique UNIQUE (equipment_id, monitoring_date, shift_id),
  CONSTRAINT temperature_readings_value_valid CHECK (
    (value_c IS NOT NULL AND unable_reason IS NULL AND scale(value_c) <= 1 AND value_c BETWEEN -200.0 AND 300.0
      AND value_c NOT IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC))
    OR (value_c IS NULL AND unable_reason IS NOT NULL AND jsonb_typeof(unable_reason) = 'object'
      AND COALESCE(jsonb_typeof(unable_reason->'reason') = 'string' AND length(btrim(unable_reason->>'reason')) > 0,FALSE))
  ),
  CONSTRAINT temperature_readings_limits_valid CHECK (lower_c < upper_c
    AND lower_c NOT IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC)
    AND upper_c NOT IN ('NaN'::NUMERIC,'Infinity'::NUMERIC,'-Infinity'::NUMERIC))
);
-- Approved physical input bounds are independent of each device's captured operating thresholds.
CREATE INDEX temperature_readings_date_slot_idx ON public.temperature_readings (monitoring_date,equipment_id,shift_id);

CREATE TABLE public.temperature_monitoring_reading_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.temperature_readings(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('reading_created','deviation_created')),
  after_state JSONB NOT NULL,
  actor_user_id BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reading_id,event_type)
);

CREATE FUNCTION public.temperature_monitoring_reading_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'temperature readings and events are append-only; use amendment' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_reading_immutable() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER temperature_readings_immutable BEFORE UPDATE OR DELETE ON public.temperature_readings
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_reading_immutable();
CREATE TRIGGER temperature_monitoring_reading_events_immutable BEFORE UPDATE OR DELETE ON public.temperature_monitoring_reading_events
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_reading_immutable();
ALTER TABLE public.temperature_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperature_monitoring_reading_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.temperature_readings,public.temperature_monitoring_reading_events FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public._temperature_monitoring_lock_tenant(p_don_vi BIGINT)
RETURNS VOID LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF p_don_vi IS NULL THEN RAISE EXCEPTION 'equipment tenant is required' USING ERRCODE = '22023'; END IF;
  -- ponytail: serialize manual TM writes per tenant; narrow keys if measured contention warrants it.
  PERFORM pg_advisory_xact_lock(hashtextextended('temperature-monitoring:' || p_don_vi::TEXT,0));
END;
$$;
REVOKE ALL ON FUNCTION public._temperature_monitoring_lock_tenant(BIGINT) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.temperature_monitoring_policy_write_lock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE tenant BIGINT; locked_tenant BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'temperature_monitoring_configuration_versions' THEN
    SELECT don_vi INTO tenant FROM public.thiet_bi WHERE id=NEW.equipment_id;
  ELSE
    IF TG_OP = 'UPDATE' AND (OLD.don_vi,OLD.schedule_profile_id,OLD.shift_id) IS DISTINCT FROM (NEW.don_vi,NEW.schedule_profile_id,NEW.shift_id) THEN
      RAISE EXCEPTION 'shift override identity is immutable' USING ERRCODE = '22023';
    END IF;
    tenant := NEW.don_vi;
  END IF;
  PERFORM public._temperature_monitoring_lock_tenant(tenant);
  -- Recheck after acquiring the shared lock: TM-02 checks before its version INSERT.
  IF TG_TABLE_NAME = 'temperature_monitoring_configuration_versions' THEN
    SELECT don_vi INTO locked_tenant FROM public.thiet_bi WHERE id=NEW.equipment_id FOR SHARE;
    IF locked_tenant IS DISTINCT FROM tenant THEN
      RAISE EXCEPTION 'equipment scope changed; retry' USING ERRCODE = '22023';
    END IF;
    IF lower(NEW.effective_period) < now() AND EXISTS (
      SELECT 1 FROM public.temperature_readings WHERE equipment_id=NEW.equipment_id AND captured_at >= lower(NEW.effective_period)
    ) THEN
      RAISE EXCEPTION 'effective start cannot precede existing readings' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_policy_write_lock() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER temperature_monitoring_version_write_lock BEFORE INSERT ON public.temperature_monitoring_configuration_versions
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_policy_write_lock();
CREATE TRIGGER temperature_monitoring_override_write_lock BEFORE INSERT OR UPDATE ON public.temperature_monitoring_schedule_shift_overrides
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_policy_write_lock();

CREATE FUNCTION public.temperature_monitoring_measurement_create(
  p_equipment_id BIGINT,
  p_monitoring_date DATE,
  p_shift_id UUID,
  p_value_c NUMERIC DEFAULT NULL,
  p_unable_reason TEXT DEFAULT NULL,
  p_captured_at TIMESTAMPTZ DEFAULT now(),
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
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa') THEN
    RAISE EXCEPTION 'temperature measurement requires writer role' USING ERRCODE = '42501';
  END IF;
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE id=actor) THEN
    RAISE EXCEPTION 'authenticated actor is required' USING ERRCODE = '42501';
  END IF;
  SELECT t.don_vi,public._normalize_department_scope(t.khoa_phong_quan_ly)
  INTO equipment_tenant,equipment_department FROM public.thiet_bi t WHERE id=p_equipment_id;
  IF NOT FOUND OR (role_name NOT IN ('global','admin') AND
    (tenant IS NULL OR department IS NULL OR equipment_tenant IS DISTINCT FROM tenant OR equipment_department IS DISTINCT FROM department)) THEN
    RAISE EXCEPTION 'equipment is outside authorized scope' USING ERRCODE = '42501';
  END IF;
  PERFORM public._temperature_monitoring_lock_tenant(equipment_tenant);
  PERFORM 1 FROM public.thiet_bi t WHERE id=p_equipment_id AND don_vi IS NOT DISTINCT FROM equipment_tenant
    AND (role_name IN ('global','admin') OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment scope changed; retry' USING ERRCODE = '42501'; END IF;
  SELECT r.id,r.equipment_id,r.monitoring_date,r.shift_id,r.configuration_version_id,r.value_c,r.unable_reason,
    r.lower_c,r.upper_c,r.snapshot,r.source,r.operator_user_id,r.captured_at,r.created_at,r.note,r.status
  INTO reading FROM public.temperature_readings r
  WHERE r.equipment_id=p_equipment_id AND r.monitoring_date=p_monitoring_date AND r.shift_id=p_shift_id;
  IF FOUND THEN
    RETURN jsonb_build_object('outcome','conflict','reading',to_jsonb(reading),'slot_status',reading.status,'next_action','amendment');
  END IF;
  IF p_monitoring_date IS NULL OR NOT isfinite(p_monitoring_date) OR p_shift_id IS NULL OR p_captured_at IS NULL OR NOT isfinite(p_captured_at)
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
    policy.lower_c,policy.upper_c,reading_snapshot,actor,p_captured_at,p_note)
  ON CONFLICT (equipment_id,monitoring_date,shift_id) DO NOTHING
  RETURNING id,equipment_id,monitoring_date,shift_id,configuration_version_id,value_c,unable_reason,
    lower_c,upper_c,snapshot,source,operator_user_id,captured_at,created_at,note,status INTO reading;
  IF NOT FOUND THEN
    SELECT r.id,r.equipment_id,r.monitoring_date,r.shift_id,r.configuration_version_id,r.value_c,r.unable_reason,
      r.lower_c,r.upper_c,r.snapshot,r.source,r.operator_user_id,r.captured_at,r.created_at,r.note,r.status
    INTO STRICT reading FROM public.temperature_readings r
    WHERE r.equipment_id=p_equipment_id AND r.monitoring_date=p_monitoring_date AND r.shift_id=p_shift_id;
    RETURN jsonb_build_object('outcome','conflict','reading',to_jsonb(reading),'slot_status',reading.status,'next_action','amendment');
  END IF;
  INSERT INTO public.temperature_monitoring_reading_events (reading_id,event_type,after_state,actor_user_id)
  VALUES (reading.id,'reading_created',to_jsonb(reading),actor);
  IF reading.status='Bất thường' THEN
    INSERT INTO public.temperature_monitoring_reading_events (reading_id,event_type,after_state,actor_user_id)
    VALUES (reading.id,'deviation_created',jsonb_build_object('reading',to_jsonb(reading),
      'direction',CASE WHEN reading.value_c<reading.lower_c THEN 'below' ELSE 'above' END),actor);
  END IF;
  RETURN jsonb_build_object('outcome','created','reading',to_jsonb(reading),'slot_status',reading.status);
EXCEPTION
  WHEN OTHERS THEN
    IF NOT saving AND SQLSTATE IN ('42501','22023') THEN RAISE; END IF;
    -- This exception block rolls back the reading and both events before returning a safe error.
    RAISE EXCEPTION 'temperature measurement could not be saved' USING ERRCODE = 'P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_measurement_create(BIGINT,DATE,UUID,NUMERIC,TEXT,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_measurement_create(BIGINT,DATE,UUID,NUMERIC,TEXT,TIMESTAMPTZ,TEXT) TO authenticated;
