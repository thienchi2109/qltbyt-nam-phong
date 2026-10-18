-- TM-07: bounded manager-only configuration/staff choices, exact temperature scope.
BEGIN;
INSERT INTO public.temperature_monitoring_recording_methods(code,name)
VALUES('manual','Đọc nhiệt kế và nhập tay') ON CONFLICT(code) DO NOTHING;
CREATE FUNCTION public.temperature_monitoring_configuration_choices(p_equipment_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor RECORD;
BEGIN
  SELECT * INTO actor FROM public._temperature_monitoring_assert_scope(p_equipment_id);
  IF actor.role_name NOT IN ('global','admin','to_qltb') THEN RAISE EXCEPTION 'configuration manager required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('methods',(SELECT COALESCE(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name) ORDER BY m.code),'[]') FROM public.temperature_monitoring_recording_methods m WHERE m.is_active),
    'profiles',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'code',p.code) ORDER BY p.code),'[]') FROM public.temperature_monitoring_schedule_profiles p WHERE p.is_active),
    'shifts',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',s.id,'schedule_profile_id',s.schedule_profile_id,'code',s.code,'name',s.name,'start_local',s.start_local,'end_local',s.end_local) ORDER BY s.sort_order,s.id),'[]') FROM public.temperature_monitoring_schedule_shifts s WHERE s.is_active),
    'configuration',(SELECT to_jsonb(c) FROM public.temperature_monitoring_configuration_get(p_equipment_id) c LIMIT 1),'server_now',statement_timestamp());
END;
$$;
CREATE FUNCTION public.temperature_monitoring_staff_choices(p_equipment_id BIGINT,p_query TEXT DEFAULT NULL,p_cursor BIGINT DEFAULT NULL,p_limit INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor RECORD; result JSONB;
BEGIN
  SELECT * INTO actor FROM public._temperature_monitoring_assert_scope(p_equipment_id);
  IF actor.role_name NOT IN ('global','admin','to_qltb') THEN RAISE EXCEPTION 'configuration manager required' USING ERRCODE='42501'; END IF;
  IF length(p_query)>200 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_cursor<0 THEN
    RAISE EXCEPTION 'invalid staff search or limit' USING ERRCODE='22023'; END IF;
  WITH candidates AS (
    SELECT n.id,n.full_name FROM public.nhan_vien n JOIN public.thiet_bi t ON t.id=p_equipment_id
    WHERE COALESCE(n.is_active,TRUE) AND COALESCE(n.current_don_vi,n.don_vi)=t.don_vi
      AND public._normalize_department_scope(n.khoa_phong)=public._normalize_department_scope(t.khoa_phong_quan_ly)
      AND (p_query IS NULL OR strpos(lower(n.full_name),lower(btrim(p_query)))>0) AND (p_cursor IS NULL OR n.id>p_cursor)
    ORDER BY n.id LIMIT p_limit+1
  ), visible AS (SELECT * FROM candidates ORDER BY id LIMIT p_limit)
  SELECT jsonb_build_object('items',COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM visible v),'[]'),
    'next_cursor',CASE WHEN (SELECT count(*) FROM candidates)>p_limit THEN (SELECT max(id) FROM visible) END) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_configuration_choices(BIGINT),public.temperature_monitoring_staff_choices(BIGINT,TEXT,BIGINT,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_configuration_choices(BIGINT),public.temperature_monitoring_staff_choices(BIGINT,TEXT,BIGINT,INTEGER) TO authenticated;
CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_get(p_equipment_id BIGINT)
RETURNS TABLE (equipment_id BIGINT, monitoring_enabled BOOLEAN, version_id UUID, effective_period TSTZRANGE, lower_c NUMERIC, upper_c NUMERIC, schedule_profile_id UUID, display_timezone TEXT, responsible_primary_user_id BIGINT, responsible_substitute_user_ids BIGINT[], recording_method_code TEXT, configuration_complete BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public._temperature_monitoring_assert_scope(p_equipment_id);
  RETURN QUERY SELECT c.equipment_id,COALESCE(v.monitoring_enabled,c.monitoring_enabled),v.id,v.effective_period,v.lower_c,v.upper_c,v.schedule_profile_id,v.display_timezone,v.responsible_primary_user_id,v.responsible_substitute_user_ids,v.recording_method_code,
    (COALESCE(v.monitoring_enabled,c.monitoring_enabled) AND v.responsible_primary_user_id IS NOT NULL AND v.recording_method_code IS NOT NULL AND v.schedule_profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.temperature_monitoring_schedule_profiles s WHERE s.id=v.schedule_profile_id AND s.is_active) AND EXISTS (SELECT 1 FROM public.temperature_monitoring_recording_methods m WHERE m.code=v.recording_method_code AND m.is_active))
  FROM public.temperature_monitoring_configurations c
  LEFT JOIN LATERAL (SELECT * FROM public.temperature_monitoring_configuration_versions x WHERE x.equipment_id=c.equipment_id AND x.effective_period @> now() ORDER BY lower(x.effective_period) DESC LIMIT 1) v ON TRUE
  WHERE c.equipment_id=p_equipment_id;
END;
$$;

COMMIT;
