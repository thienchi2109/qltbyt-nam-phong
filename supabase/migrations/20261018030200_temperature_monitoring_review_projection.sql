-- TM-05: project latest effective/review state in one scoped set-based query.
CREATE OR REPLACE FUNCTION public.temperature_monitoring_slots_list(
  p_from_date DATE DEFAULT (CURRENT_DATE - 29),
  p_to_date DATE DEFAULT CURRENT_DATE,
  p_shift_codes TEXT[] DEFAULT NULL,
  p_equipment_id BIGINT DEFAULT NULL,
  p_cursor TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_include_unconfigured BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  equipment_id BIGINT,
  equipment_code TEXT,
  equipment_name TEXT,
  monitoring_date DATE,
  shift_id UUID,
  shift_code TEXT,
  shift_name TEXT,
  shift_start_local TIME,
  shift_end_local TIME,
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  configuration_version_id UUID,
  display_timezone TEXT,
  status TEXT,
  next_cursor TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id BIGINT;
  v_don_vi BIGINT;
  v_khoa_phong TEXT;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_cursor_date DATE;
  v_cursor_equipment BIGINT;
  v_cursor_shift TEXT;
  v_cursor_parts TEXT[];
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    v_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
    v_don_vi := NULLIF(v_claims->>'don_vi', '')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE = '42501';
  END;
  v_role := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_khoa_phong := public._normalize_department_scope(v_claims->>'khoa_phong');
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'missing user_id claim' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_khoa_phong IS NULL) THEN
    RAISE EXCEPTION 'tenant and department claims are required' USING ERRCODE = '42501';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'invalid monitoring date range' USING ERRCODE = '22023';
  END IF;
  IF p_to_date - p_from_date > 89 THEN
    RAISE EXCEPTION 'monitoring date range cannot exceed 90 days' USING ERRCODE = '22023';
  END IF;
  IF p_include_unconfigured AND v_role NOT IN ('global', 'admin') THEN
    RAISE EXCEPTION 'unconfigured equipment filter requires administrator role' USING ERRCODE = '42501';
  END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      v_cursor_parts := string_to_array(convert_from(decode(p_cursor, 'base64'), 'UTF8'), '|');
      IF cardinality(v_cursor_parts) <> 3 THEN RAISE EXCEPTION 'invalid cursor'; END IF;
      v_cursor_date := v_cursor_parts[1]::DATE;
      v_cursor_equipment := v_cursor_parts[2]::BIGINT;
      v_cursor_shift := v_cursor_parts[3];
      IF v_cursor_shift <> '00000000-0000-0000-0000-000000000000' THEN
        PERFORM v_cursor_shift::UUID;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid cursor' USING ERRCODE = '22023';
    END;
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT gs::DATE AS monitoring_date
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') gs
  ),
  effective AS (
    SELECT DISTINCT ON (v.equipment_id, d.monitoring_date, s.id)
      t.id AS equipment_id,
      t.ma_thiet_bi AS equipment_code,
      t.ten_thiet_bi AS equipment_name,
      d.monitoring_date,
      s.id AS shift_id,
      s.code AS shift_code,
      COALESCE(so.name, s.name) AS shift_name,
      COALESCE(so.start_local, s.start_local) AS shift_start_local,
      COALESCE(so.end_local, s.end_local) AS shift_end_local,
      v.id AS configuration_version_id,
      COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh') AS display_timezone,
      ((d.monitoring_date + COALESCE(so.start_local, s.start_local)) AT TIME ZONE COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh')) AS slot_start,
      ((d.monitoring_date + COALESCE(so.end_local, s.end_local) + CASE WHEN COALESCE(so.end_local, s.end_local) <= COALESCE(so.start_local, s.start_local) THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END) AT TIME ZONE COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh')) AS slot_end
    FROM dates d
    JOIN public.thiet_bi t ON COALESCE(t.is_deleted, FALSE) = FALSE
      AND (p_equipment_id IS NULL OR t.id = p_equipment_id)
      AND (v_role IN ('global', 'admin') OR (t.don_vi = v_don_vi AND public._normalize_department_scope(t.khoa_phong_quan_ly) = v_khoa_phong))
      AND COALESCE(NULLIF(btrim(t.tinh_trang_hien_tai), ''), '') = 'Hoạt động'
      AND (NULLIF(btrim(t.ngay_dua_vao_su_dung), '') IS NULL OR (ai_readonly.try_parse_iso_date(t.ngay_dua_vao_su_dung) IS NOT NULL AND ai_readonly.try_parse_iso_date(t.ngay_dua_vao_su_dung) <= d.monitoring_date))
      AND (NULLIF(btrim(t.ngay_ngung_su_dung), '') IS NULL OR (ai_readonly.try_parse_iso_date(t.ngay_ngung_su_dung) IS NOT NULL AND ai_readonly.try_parse_iso_date(t.ngay_ngung_su_dung) > d.monitoring_date))
    JOIN public.temperature_monitoring_configuration_versions v ON v.equipment_id = t.id
      AND v.monitoring_enabled
    JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id = v.schedule_profile_id
      AND s.is_active
      AND (p_shift_codes IS NULL OR s.code = ANY(p_shift_codes))
    JOIN public.temperature_monitoring_schedule_profiles sp ON sp.id = s.schedule_profile_id
      AND sp.is_active
    LEFT JOIN public.temperature_monitoring_schedule_shift_overrides so ON so.schedule_profile_id = s.schedule_profile_id
      AND so.shift_id = s.id AND so.don_vi = t.don_vi AND so.is_active
    WHERE (p_include_unconfigured OR v.monitoring_enabled)
      AND (v.effective_period @> (((d.monitoring_date + COALESCE(so.start_local, s.start_local)) AT TIME ZONE COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh'))))
    ORDER BY v.equipment_id, d.monitoring_date, s.id, lower(v.effective_period) DESC
  ),
  configured_on_date AS (
    SELECT DISTINCT v.equipment_id, d.monitoring_date
    FROM dates d
    JOIN public.temperature_monitoring_configuration_versions v
      ON v.monitoring_enabled
    JOIN public.thiet_bi ct ON ct.id = v.equipment_id
    JOIN public.temperature_monitoring_schedule_shifts cs
      ON cs.schedule_profile_id = v.schedule_profile_id AND cs.is_active
    JOIN public.temperature_monitoring_schedule_profiles csp
      ON csp.id = cs.schedule_profile_id AND csp.is_active
    LEFT JOIN public.temperature_monitoring_schedule_shift_overrides cso
      ON cso.schedule_profile_id = cs.schedule_profile_id
     AND cso.shift_id = cs.id
     AND cso.don_vi = ct.don_vi
     AND cso.is_active
    WHERE v.effective_period @> ((d.monitoring_date + COALESCE(cso.start_local, cs.start_local)) AT TIME ZONE COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh'))
  ),
  unconfigured AS (
    SELECT t.id AS equipment_id, t.ma_thiet_bi AS equipment_code, t.ten_thiet_bi AS equipment_name,
           d.monitoring_date, NULL::UUID AS shift_id, NULL::TEXT AS shift_code,
           NULL::TEXT AS shift_name, NULL::TIME AS shift_start_local, NULL::TIME AS shift_end_local,
           NULL::UUID AS configuration_version_id, 'Asia/Ho_Chi_Minh'::TEXT AS display_timezone,
           NULL::TIMESTAMPTZ AS slot_start, NULL::TIMESTAMPTZ AS slot_end,
           'Chưa cấu hình'::TEXT AS status
    FROM dates d
    JOIN public.thiet_bi t ON COALESCE(t.is_deleted, FALSE) = FALSE
      AND (p_equipment_id IS NULL OR t.id = p_equipment_id)
      AND (v_role IN ('global', 'admin') OR (t.don_vi = v_don_vi AND public._normalize_department_scope(t.khoa_phong_quan_ly) = v_khoa_phong))
      AND COALESCE(NULLIF(btrim(t.tinh_trang_hien_tai), ''), '') = 'Hoạt động'
      AND (NULLIF(btrim(t.ngay_dua_vao_su_dung), '') IS NULL OR (ai_readonly.try_parse_iso_date(t.ngay_dua_vao_su_dung) IS NOT NULL AND ai_readonly.try_parse_iso_date(t.ngay_dua_vao_su_dung) <= d.monitoring_date))
      AND (NULLIF(btrim(t.ngay_ngung_su_dung), '') IS NULL OR (ai_readonly.try_parse_iso_date(t.ngay_ngung_su_dung) IS NOT NULL AND ai_readonly.try_parse_iso_date(t.ngay_ngung_su_dung) > d.monitoring_date))
      AND p_include_unconfigured
      AND p_shift_codes IS NULL
      AND NOT EXISTS (SELECT 1 FROM configured_on_date c WHERE c.equipment_id = t.id AND c.monitoring_date = d.monitoring_date)
  ),
  scoped_readings AS MATERIALIZED (
    SELECT r.* FROM public.temperature_readings r JOIN public.thiet_bi t ON t.id=r.equipment_id
    WHERE r.monitoring_date BETWEEN p_from_date AND p_to_date
      AND (p_equipment_id IS NULL OR r.equipment_id=p_equipment_id)
      AND (p_shift_codes IS NULL OR r.snapshot->>'shift_code'=ANY(p_shift_codes))
      AND (v_role IN ('global','admin') OR (t.don_vi=v_don_vi AND public._normalize_department_scope(t.khoa_phong_quan_ly)=v_khoa_phong))
  ),
  latest_state AS (
    SELECT DISTINCT ON (e.reading_id) e.reading_id,e.after_state
    FROM scoped_readings r JOIN public.temperature_monitoring_reading_events e ON e.reading_id=r.id
    WHERE e.event_type NOT IN ('reading_created','deviation_created')
    ORDER BY e.reading_id,e.event_sequence DESC
  ),
  saved AS (
    SELECT r.equipment_id, t.ma_thiet_bi AS equipment_code, t.ten_thiet_bi AS equipment_name,
           r.monitoring_date, r.shift_id, r.snapshot->>'shift_code' AS shift_code,
           r.snapshot->>'shift_name' AS shift_name,
           (r.snapshot->>'shift_start_local')::TIME AS shift_start_local,
           (r.snapshot->>'shift_end_local')::TIME AS shift_end_local,
           r.configuration_version_id, r.snapshot->>'display_timezone' AS display_timezone,
           (r.snapshot->>'slot_start')::TIMESTAMPTZ AS slot_start,
           (r.snapshot->>'slot_end')::TIMESTAMPTZ AS slot_end,
           COALESCE(ls.after_state->>'slot_status',CASE WHEN r.status='Đã ghi' THEN 'Đã ghi' ELSE 'Chờ xác nhận' END) AS status
    FROM scoped_readings r
    LEFT JOIN latest_state ls ON ls.reading_id=r.id
    JOIN public.thiet_bi t ON t.id=r.equipment_id
      AND (v_role IN ('global','admin') OR (t.don_vi=v_don_vi AND public._normalize_department_scope(t.khoa_phong_quan_ly)=v_khoa_phong))
    WHERE r.monitoring_date BETWEEN p_from_date AND p_to_date
      AND (p_equipment_id IS NULL OR r.equipment_id=p_equipment_id)
      AND (p_shift_codes IS NULL OR r.snapshot->>'shift_code'=ANY(p_shift_codes))
  ),
  projected AS (
    SELECT e.equipment_id, e.equipment_code, e.equipment_name, e.monitoring_date,
           e.shift_id, e.shift_code, e.shift_name, e.shift_start_local, e.shift_end_local,
           e.configuration_version_id, e.display_timezone, e.slot_start, e.slot_end,
           'Chưa ghi'::TEXT AS status
    FROM effective e
    WHERE NOT EXISTS (SELECT 1 FROM public.temperature_readings r WHERE r.equipment_id=e.equipment_id AND r.monitoring_date=e.monitoring_date AND r.shift_id=e.shift_id)
    UNION ALL
    SELECT r.equipment_id,r.equipment_code,r.equipment_name,r.monitoring_date,
           r.shift_id,r.shift_code,r.shift_name,r.shift_start_local,r.shift_end_local,
           r.configuration_version_id,r.display_timezone,r.slot_start,r.slot_end,r.status
    FROM saved r
    UNION ALL
    SELECT u.equipment_id, u.equipment_code, u.equipment_name, u.monitoring_date,
           u.shift_id, u.shift_code, u.shift_name, u.shift_start_local, u.shift_end_local,
           u.configuration_version_id, u.display_timezone, u.slot_start, u.slot_end, u.status
    FROM unconfigured u
    WHERE NOT EXISTS (SELECT 1 FROM saved r WHERE r.equipment_id=u.equipment_id AND r.monitoring_date=u.monitoring_date)
  )
  SELECT e.equipment_id, e.equipment_code, e.equipment_name, e.monitoring_date, e.shift_id,
         e.shift_code, e.shift_name, e.shift_start_local, e.shift_end_local, e.slot_start,
         e.slot_end, e.configuration_version_id, e.display_timezone, e.status,
         encode(convert_to((e.monitoring_date::TEXT || '|' || e.equipment_id::TEXT || '|' || COALESCE(e.shift_id::TEXT, '00000000-0000-0000-0000-000000000000')), 'UTF8'), 'base64')
  FROM projected e
  WHERE v_cursor_date IS NULL OR (e.monitoring_date, e.equipment_id, COALESCE(e.shift_id::TEXT, '00000000-0000-0000-0000-000000000000')) > (v_cursor_date, v_cursor_equipment, v_cursor_shift)
  ORDER BY e.monitoring_date, e.equipment_id, COALESCE(e.shift_id::TEXT, '00000000-0000-0000-0000-000000000000')
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.temperature_monitoring_slots_list(DATE, DATE, TEXT[], BIGINT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_slots_list(DATE, DATE, TEXT[], BIGINT, TEXT, INTEGER, BOOLEAN) TO authenticated;
-- TM-05: preserve original payload while returning current review/effective state.
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
