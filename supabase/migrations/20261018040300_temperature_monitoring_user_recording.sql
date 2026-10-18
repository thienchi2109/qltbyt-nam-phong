-- Approved scoped user recording/proposal capability; review authority is unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public._temperature_monitoring_assert_scope(p_equipment_id BIGINT,p_lock BOOLEAN DEFAULT FALSE)
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
    OR (p_lock AND role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user')) THEN
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


CREATE OR REPLACE FUNCTION public.temperature_monitoring_measurement_create(
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
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user') THEN
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
    RETURN public.temperature_monitoring_reading_get(reading.id)||jsonb_build_object('outcome','conflict','next_action','amendment');
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
REVOKE ALL ON FUNCTION public.temperature_monitoring_measurement_create(BIGINT,DATE,UUID,NUMERIC,TEXT,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_measurement_create(BIGINT,DATE,UUID,NUMERIC,TEXT,TIMESTAMPTZ,TEXT) TO authenticated;
COMMIT;
