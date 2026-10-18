-- TM-07: append a scheduled successor by audibly closing its open predecessor.
BEGIN;

ALTER TABLE public.temperature_monitoring_configuration_audit
  DROP CONSTRAINT temperature_monitoring_configuration_audit_event_type_check;
ALTER TABLE public.temperature_monitoring_configuration_audit
  ADD CONSTRAINT temperature_monitoring_configuration_audit_event_type_check
  CHECK (event_type IN ('create','version','version_closed','enable','disable'));

ALTER TABLE public.temperature_monitoring_configuration_versions
  DROP CONSTRAINT temperature_monitoring_versions_no_overlap;
ALTER TABLE public.temperature_monitoring_configuration_versions
  ADD CONSTRAINT temperature_monitoring_versions_no_overlap
  EXCLUDE USING GIST (equipment_id WITH =, effective_period WITH &&)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_version_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB := COALESCE(NULLIF(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
  actor BIGINT := NULLIF(claims->>'user_id','')::BIGINT;
BEGIN
  IF TG_OP='UPDATE'
    AND to_jsonb(NEW)-'effective_period'=to_jsonb(OLD)-'effective_period'
    AND lower_inf(NEW.effective_period)=lower_inf(OLD.effective_period)
    AND lower(NEW.effective_period) IS NOT DISTINCT FROM lower(OLD.effective_period)
    AND lower_inc(NEW.effective_period)=lower_inc(OLD.effective_period)
    AND upper_inc(NEW.effective_period)=FALSE
    AND NOT upper_inf(NEW.effective_period)
    AND upper(NEW.effective_period)>lower(OLD.effective_period)
    AND upper_inf(OLD.effective_period)
    AND EXISTS (
      SELECT 1
      FROM public.temperature_monitoring_configuration_audit a
      JOIN public.temperature_monitoring_configuration_versions successor
        ON successor.id=(a.after_state->>'successor_version_id')::UUID
      WHERE a.equipment_id=OLD.equipment_id
        AND a.version_id=OLD.id
        AND a.event_type='version_closed'
        AND a.actor_user_id=actor
        AND a.reason=successor.change_reason
        AND a.before_state=to_jsonb(OLD)
        AND a.after_state->'effective_to'=to_jsonb(upper(NEW.effective_period))
        AND a.after_state->'successor_effective_period'=to_jsonb(successor.effective_period)
        AND successor.equipment_id=OLD.equipment_id
        AND successor.created_by=actor
        AND lower(successor.effective_period)=upper(NEW.effective_period)
    ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'temperature monitoring configuration versions are immutable; create a new effective version'
    USING ERRCODE='55000';
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_configuration_version_immutable() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_upsert(
  p_equipment_id BIGINT,
  p_monitoring_enabled BOOLEAN,
  p_effective_from TIMESTAMPTZ DEFAULT NULL,
  p_effective_to TIMESTAMPTZ DEFAULT NULL,
  p_lower_c NUMERIC DEFAULT NULL,
  p_upper_c NUMERIC DEFAULT NULL,
  p_schedule_profile_id UUID DEFAULT NULL,
  p_display_timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  p_responsible_primary_user_id BIGINT DEFAULT NULL,
  p_responsible_substitute_user_ids BIGINT[] DEFAULT '{}'::BIGINT[],
  p_recording_method_code TEXT DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL
) RETURNS public.temperature_monitoring_configurations
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_role TEXT;
  actor BIGINT;
  equipment_tenant BIGINT;
  equipment_department TEXT;
  boundary_profile UUID;
  boundary_timezone TEXT;
  boundary_matches_shift BOOLEAN:=FALSE;
  current_config public.temperature_monitoring_configurations;
  open_predecessor public.temperature_monitoring_configuration_versions;
  new_version public.temperature_monitoring_configuration_versions;
  period TSTZRANGE;
  v_before JSONB;
  after_state JSONB;
  current_enabled BOOLEAN;
  has_existing BOOLEAN;
  is_initial_unconfigured BOOLEAN;
  updated_rows BIGINT;
BEGIN
  SELECT s.actor_id,s.role_name INTO actor,v_role
  FROM public._temperature_monitoring_assert_scope(p_equipment_id,TRUE) s;
  IF v_role NOT IN ('to_qltb','global','admin') THEN
    RAISE EXCEPTION 'temperature monitoring configuration requires equipment manager role' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.nhan_vien n WHERE n.id=actor AND COALESCE(n.is_active,TRUE)) THEN
    RAISE EXCEPTION 'authenticated actor is required and must be active' USING ERRCODE='42501';
  END IF;
  SELECT t.don_vi,public._normalize_department_scope(t.khoa_phong_quan_ly)
    INTO equipment_tenant,equipment_department
  FROM public.thiet_bi t
  WHERE t.id=p_equipment_id AND COALESCE(t.is_deleted,FALSE)=FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment not found' USING ERRCODE='P0002'; END IF;

  IF p_change_reason IS NULL OR btrim(p_change_reason)='' THEN
    RAISE EXCEPTION 'change reason is required' USING ERRCODE='22023';
  END IF;
  IF p_effective_from IS NULL THEN
    RAISE EXCEPTION 'effective start is required for every configuration version' USING ERRCODE='22023';
  END IF;
  IF p_effective_from<=statement_timestamp() THEN
    RAISE EXCEPTION 'effective start must be in the future' USING ERRCODE='22023';
  END IF;
  IF p_monitoring_enabled AND
     (p_lower_c IS NULL OR p_upper_c IS NULL OR p_schedule_profile_id IS NULL OR
      p_responsible_primary_user_id IS NULL OR p_recording_method_code IS NULL) THEN
    RAISE EXCEPTION 'monitoring configuration is incomplete' USING ERRCODE='22023';
  END IF;
  IF p_monitoring_enabled AND NOT EXISTS(
    SELECT 1 FROM public.temperature_monitoring_schedule_profiles p
    WHERE p.id=p_schedule_profile_id AND p.is_active
      AND EXISTS(SELECT 1 FROM public.temperature_monitoring_schedule_shifts s
        WHERE s.schedule_profile_id=p.id AND s.is_active)
  ) THEN
    RAISE EXCEPTION 'an active schedule profile with active shifts is required' USING ERRCODE='22023';
  END IF;
  IF p_monitoring_enabled AND NOT EXISTS(
    SELECT 1 FROM public.temperature_monitoring_recording_methods m
    WHERE m.code=p_recording_method_code AND m.is_active
  ) THEN
    RAISE EXCEPTION 'an active recording method is required' USING ERRCODE='22023';
  END IF;
  IF NOT p_monitoring_enabled AND
     (p_lower_c IS NOT NULL OR p_upper_c IS NOT NULL OR p_schedule_profile_id IS NOT NULL OR
      p_responsible_primary_user_id IS NOT NULL OR cardinality(COALESCE(p_responsible_substitute_user_ids,'{}'))>0 OR
      p_recording_method_code IS NOT NULL) THEN
    RAISE EXCEPTION 'disabled version cannot carry monitoring policy fields' USING ERRCODE='22023';
  END IF;
  IF p_monitoring_enabled AND
     (scale(p_lower_c) > 1 OR scale(p_upper_c) > 1 OR p_lower_c <> round(p_lower_c,1) OR p_upper_c <> round(p_upper_c,1) OR
      p_lower_c IN ('Infinity'::NUMERIC,'-Infinity'::NUMERIC,'NaN'::NUMERIC) OR
      p_upper_c IN ('Infinity'::NUMERIC,'-Infinity'::NUMERIC,'NaN'::NUMERIC)) THEN
    RAISE EXCEPTION 'temperature limits must have exactly one finite decimal place' USING ERRCODE='22023';
  END IF;

  IF p_responsible_primary_user_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.nhan_vien n
    WHERE n.id=p_responsible_primary_user_id AND COALESCE(n.is_active,TRUE)
      AND COALESCE(n.current_don_vi,n.don_vi)=equipment_tenant
      AND public._normalize_department_scope(n.khoa_phong)=public._normalize_department_scope(equipment_department)
  ) THEN
    RAISE EXCEPTION 'responsible user is outside equipment scope' USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM unnest(COALESCE(p_responsible_substitute_user_ids,'{}')) s(user_id)
    WHERE NOT EXISTS(SELECT 1 FROM public.nhan_vien n WHERE n.id=s.user_id)
  ) THEN
    RAISE EXCEPTION 'substitute user does not exist' USING ERRCODE='22023';
  END IF;
  IF EXISTS(
    SELECT 1 FROM unnest(COALESCE(p_responsible_substitute_user_ids,'{}')) s(user_id)
    WHERE NOT EXISTS(
      SELECT 1 FROM public.nhan_vien n
      WHERE n.id=s.user_id AND COALESCE(n.is_active,TRUE)
        AND COALESCE(n.current_don_vi,n.don_vi)=equipment_tenant
        AND public._normalize_department_scope(n.khoa_phong)=public._normalize_department_scope(equipment_department)
    )
  ) THEN
    RAISE EXCEPTION 'substitute user is outside tenant scope' USING ERRCODE='42501';
  END IF;

  SELECT * INTO open_predecessor
  FROM public.temperature_monitoring_configuration_versions v
  WHERE v.equipment_id=p_equipment_id AND upper_inf(v.effective_period)
  ORDER BY lower(v.effective_period) DESC LIMIT 1 FOR UPDATE;
  is_initial_unconfigured:=open_predecessor.id IS NULL AND NOT EXISTS(
    SELECT 1 FROM public.temperature_monitoring_configuration_versions v WHERE v.equipment_id=p_equipment_id
  );
  IF open_predecessor.id IS NOT NULL AND p_effective_from<=lower(open_predecessor.effective_period) THEN
    RAISE EXCEPTION 'effective start must follow the open successor start' USING ERRCODE='22023';
  END IF;
  IF open_predecessor.id IS NOT NULL THEN
    boundary_profile:=open_predecessor.schedule_profile_id;
    boundary_timezone:=COALESCE(NULLIF(btrim(open_predecessor.display_timezone),''),'Asia/Ho_Chi_Minh');
  END IF;
  IF boundary_profile IS NULL THEN
    SELECT v.schedule_profile_id,COALESCE(NULLIF(btrim(v.display_timezone),''),'Asia/Ho_Chi_Minh')
      INTO boundary_profile,boundary_timezone
    FROM public.temperature_monitoring_configuration_versions v
    WHERE v.equipment_id=p_equipment_id AND v.schedule_profile_id IS NOT NULL
    ORDER BY lower(v.effective_period) DESC LIMIT 1;
  END IF;
  IF boundary_profile IS NULL THEN
    boundary_profile:=p_schedule_profile_id;
    boundary_timezone:=COALESCE(NULLIF(btrim(p_display_timezone),''),'Asia/Ho_Chi_Minh');
  END IF;
  IF boundary_profile IS NULL AND is_initial_unconfigured THEN
    SELECT p.id INTO boundary_profile FROM public.temperature_monitoring_schedule_profiles p
    WHERE p.code='default' AND p.is_active
      AND EXISTS(SELECT 1 FROM public.temperature_monitoring_schedule_shifts s WHERE s.schedule_profile_id=p.id AND s.is_active)
    LIMIT 1;
    boundary_timezone:=COALESCE(NULLIF(btrim(p_display_timezone),''),'Asia/Ho_Chi_Minh');
  END IF;
  IF boundary_profile IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.temperature_monitoring_schedule_shifts s
      LEFT JOIN public.temperature_monitoring_schedule_shift_overrides o
        ON o.schedule_profile_id=s.schedule_profile_id AND o.shift_id=s.id
        AND o.don_vi=equipment_tenant AND o.is_active
      WHERE s.schedule_profile_id=boundary_profile AND s.is_active
        AND ((p_effective_from AT TIME ZONE boundary_timezone)::DATE+COALESCE(o.start_local,s.start_local))
          AT TIME ZONE boundary_timezone=p_effective_from
    ) INTO boundary_matches_shift;
  END IF;
  IF (is_initial_unconfigured AND (p_effective_from AT TIME ZONE boundary_timezone)::TIME<>TIME '00:00'
      AND NOT boundary_matches_shift)
    OR (NOT is_initial_unconfigured AND boundary_profile IS NOT NULL AND NOT boundary_matches_shift) THEN
    RAISE EXCEPTION '%',CASE WHEN is_initial_unconfigured
      THEN 'initial effective start must match a local date boundary'
      ELSE 'effective start must match a scheduled shift start' END USING ERRCODE='22023';
  END IF;

  SELECT jsonb_build_object(
    'configuration',to_jsonb(c),
    'version',(SELECT to_jsonb(v) FROM public.temperature_monitoring_configuration_versions v
      WHERE v.equipment_id=c.equipment_id ORDER BY lower(v.effective_period) DESC LIMIT 1)
  ) INTO v_before
  FROM public.temperature_monitoring_configurations c WHERE c.equipment_id=p_equipment_id;

  period:=tstzrange(p_effective_from,p_effective_to,'[)');
  IF p_effective_from<now() THEN
    IF to_regclass('public.temperature_monitoring_slots') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.temperature_monitoring_slots WHERE equipment_id=$1 AND slot_start >= $2)'
        INTO has_existing USING p_equipment_id,p_effective_from;
      IF has_existing THEN RAISE EXCEPTION 'effective start cannot precede existing slots' USING ERRCODE='22023'; END IF;
    END IF;
    IF to_regclass('public.temperature_readings') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.temperature_readings WHERE equipment_id=$1 AND captured_at >= $2)'
        INTO has_existing USING p_equipment_id,p_effective_from;
      IF has_existing THEN RAISE EXCEPTION 'effective start cannot precede existing readings' USING ERRCODE='22023'; END IF;
    END IF;
  END IF;

  SET CONSTRAINTS temperature_monitoring_versions_no_overlap DEFERRED;
  INSERT INTO public.temperature_monitoring_configuration_versions(
    equipment_id,effective_period,monitoring_enabled,lower_c,upper_c,schedule_profile_id,
    display_timezone,responsible_primary_user_id,responsible_substitute_user_ids,
    recording_method_code,change_reason,created_by
  ) VALUES (
    p_equipment_id,period,p_monitoring_enabled,p_lower_c,p_upper_c,p_schedule_profile_id,
    COALESCE(NULLIF(btrim(p_display_timezone),''),'Asia/Ho_Chi_Minh'),p_responsible_primary_user_id,
    COALESCE(p_responsible_substitute_user_ids,'{}'),p_recording_method_code,p_change_reason,actor
  ) RETURNING * INTO new_version;
  after_state:=jsonb_build_object(
    'version_id',new_version.id,'effective_period',new_version.effective_period,
    'monitoring_enabled',new_version.monitoring_enabled,'lower_c',new_version.lower_c,'upper_c',new_version.upper_c,
    'schedule_profile_id',new_version.schedule_profile_id,'display_timezone',new_version.display_timezone,
    'responsible_primary_user_id',new_version.responsible_primary_user_id,'recording_method_code',new_version.recording_method_code
  );

  IF open_predecessor.id IS NOT NULL THEN
    INSERT INTO public.temperature_monitoring_configuration_audit(
      equipment_id,version_id,event_type,before_state,after_state,reason,actor_user_id
    ) VALUES (
      p_equipment_id,open_predecessor.id,'version_closed',to_jsonb(open_predecessor),
      jsonb_build_object('effective_to',p_effective_from,'successor_version_id',new_version.id::TEXT,
        'successor_effective_period',new_version.effective_period),p_change_reason,actor
    );
    UPDATE public.temperature_monitoring_configuration_versions
      SET effective_period=tstzrange(lower(open_predecessor.effective_period),p_effective_from,'[)')
      WHERE id=open_predecessor.id;
    GET DIAGNOSTICS updated_rows=ROW_COUNT;
    IF updated_rows<>1 THEN RAISE EXCEPTION 'open predecessor changed concurrently' USING ERRCODE='40001'; END IF;
  END IF;

  SELECT monitoring_enabled INTO current_enabled
  FROM public.temperature_monitoring_configurations WHERE equipment_id=p_equipment_id;
  INSERT INTO public.temperature_monitoring_configurations(equipment_id,monitoring_enabled)
  VALUES(p_equipment_id,CASE WHEN p_effective_from<=now() THEN p_monitoring_enabled ELSE COALESCE(current_enabled,FALSE) END)
  ON CONFLICT(equipment_id) DO UPDATE
    SET monitoring_enabled=EXCLUDED.monitoring_enabled,updated_at=now()
  RETURNING * INTO current_config;
  INSERT INTO public.temperature_monitoring_configuration_audit(
    equipment_id,version_id,event_type,before_state,after_state,reason,actor_user_id
  ) VALUES (
    p_equipment_id,new_version.id,
      CASE WHEN v_before IS NULL THEN 'create'
      WHEN p_monitoring_enabled AND COALESCE(current_enabled,FALSE)=FALSE THEN 'enable'
      WHEN p_monitoring_enabled THEN 'version' ELSE 'disable' END,
    v_before,after_state,p_change_reason,actor
  );
  SET CONSTRAINTS temperature_monitoring_versions_no_overlap IMMEDIATE;
  RETURN current_config;
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_choices(p_equipment_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  actor RECORD;
  server_now TIMESTAMPTZ:=statement_timestamp();
  suggested_effective_from TIMESTAMPTZ;
BEGIN
  SELECT * INTO actor FROM public._temperature_monitoring_assert_scope(p_equipment_id);
  IF actor.role_name NOT IN ('global','admin','to_qltb') THEN
    RAISE EXCEPTION 'configuration manager required' USING ERRCODE='42501';
  END IF;
  WITH equipment AS (
    SELECT t.id AS equipment_id,t.don_vi
    FROM public.thiet_bi t WHERE t.id=p_equipment_id
  ), open_version AS (
    SELECT v.* FROM public.temperature_monitoring_configuration_versions v
    WHERE v.equipment_id=p_equipment_id AND upper_inf(v.effective_period)
    ORDER BY lower(v.effective_period) DESC LIMIT 1
  ), boundary AS (
    SELECT e.equipment_id,e.don_vi,
      COALESCE(o.schedule_profile_id,h.schedule_profile_id,d.id) AS schedule_profile_id,
      COALESCE(NULLIF(btrim(o.display_timezone),''),NULLIF(btrim(h.display_timezone),''),'Asia/Ho_Chi_Minh') AS display_timezone,
      server_now+INTERVAL '1 minute' AS after_time,
      (o.id IS NOT NULL AND lower(o.effective_period)>server_now) AS has_future_version,
      (o.id IS NULL AND NOT EXISTS(SELECT 1 FROM public.temperature_monitoring_configuration_versions v
        WHERE v.equipment_id=e.equipment_id)) AS is_initial_unconfigured
    FROM equipment e
    LEFT JOIN open_version o ON o.equipment_id=e.equipment_id
    LEFT JOIN LATERAL (
      SELECT v.schedule_profile_id,v.display_timezone
      FROM public.temperature_monitoring_configuration_versions v
      WHERE v.equipment_id=e.equipment_id AND v.schedule_profile_id IS NOT NULL
      ORDER BY lower(v.effective_period) DESC LIMIT 1
    ) h ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.id FROM public.temperature_monitoring_schedule_profiles p
      WHERE p.code='default' AND p.is_active
        AND EXISTS(SELECT 1 FROM public.temperature_monitoring_schedule_shifts s
          WHERE s.schedule_profile_id=p.id AND s.is_active)
      LIMIT 1
    ) d ON o.schedule_profile_id IS NULL AND h.schedule_profile_id IS NULL
  )
  SELECT CASE WHEN b.has_future_version THEN NULL ELSE MIN(
      CASE WHEN b.is_initial_unconfigured THEN d.day AT TIME ZONE b.display_timezone
        ELSE (d.day+COALESCE(so.start_local,s.start_local)) AT TIME ZONE b.display_timezone END
    ) END
    INTO suggested_effective_from
  FROM boundary b
  LEFT JOIN public.temperature_monitoring_schedule_profiles p
    ON p.id=b.schedule_profile_id AND p.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shifts s
    ON s.schedule_profile_id=p.id AND s.is_active
  LEFT JOIN public.temperature_monitoring_schedule_shift_overrides so
    ON so.schedule_profile_id=s.schedule_profile_id AND so.shift_id=s.id
      AND so.don_vi=b.don_vi AND so.is_active
  JOIN LATERAL generate_series(
    (b.after_time AT TIME ZONE b.display_timezone)::DATE::TIMESTAMP,
    (((b.after_time AT TIME ZONE b.display_timezone)::DATE+14)::TIMESTAMP),INTERVAL '1 day'
  ) d(day) ON TRUE
  WHERE (b.is_initial_unconfigured AND (d.day AT TIME ZONE b.display_timezone)>b.after_time)
    OR (NOT b.is_initial_unconfigured AND NOT b.has_future_version
      AND ((d.day+COALESCE(so.start_local,s.start_local)) AT TIME ZONE b.display_timezone)>b.after_time)
  GROUP BY b.has_future_version;

  RETURN jsonb_build_object(
    'methods',(SELECT COALESCE(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name) ORDER BY m.code),'[]')
      FROM public.temperature_monitoring_recording_methods m WHERE m.is_active),
    'profiles',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'code',p.code) ORDER BY p.code),'[]')
      FROM public.temperature_monitoring_schedule_profiles p WHERE p.is_active),
    'shifts',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'schedule_profile_id',s.schedule_profile_id,
      'code',s.code,'name',s.name,'start_local',s.start_local,'end_local',s.end_local) ORDER BY s.sort_order,s.id),'[]')
      FROM public.temperature_monitoring_schedule_shifts s WHERE s.is_active),
    'configuration',(SELECT to_jsonb(c) FROM public.temperature_monitoring_configuration_get(p_equipment_id) c LIMIT 1),
    'server_now',server_now,'suggested_effective_from',suggested_effective_from
  );
END;
$$;

COMMIT;
