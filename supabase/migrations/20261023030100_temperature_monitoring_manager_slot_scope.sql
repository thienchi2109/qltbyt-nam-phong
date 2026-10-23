-- Align only to_qltb caller scope with tenant-wide Equipment access; preserve all other checks.
BEGIN;

CREATE OR REPLACE FUNCTION public._temperature_monitoring_slot_rows(
  p_from_date DATE,p_to_date DATE,p_shift_codes TEXT[],p_equipment_id BIGINT,p_include_unconfigured BOOLEAN
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
  status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_claims JSONB; v_role TEXT; v_user_id BIGINT; v_don_vi BIGINT; v_khoa_phong TEXT;
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
  IF v_role IS NULL OR v_role NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader') THEN
    RAISE EXCEPTION 'missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=v_user_id) THEN
    RAISE EXCEPTION 'missing user_id claim' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR (v_role<>'to_qltb' AND v_khoa_phong IS NULL)) THEN
    RAISE EXCEPTION 'tenant and department claims are required' USING ERRCODE = '42501';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR NOT isfinite(p_from_date) OR NOT isfinite(p_to_date) OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'invalid monitoring date range' USING ERRCODE = '22023';
  END IF;
  IF p_to_date - p_from_date > 89 THEN
    RAISE EXCEPTION 'monitoring date range cannot exceed 90 days' USING ERRCODE = '22023';
  END IF;
  IF p_include_unconfigured AND v_role NOT IN ('global', 'admin') THEN
    RAISE EXCEPTION 'unconfigured equipment filter requires administrator role' USING ERRCODE = '42501';
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
      AND (v_role IN ('global', 'admin') OR (t.don_vi = v_don_vi AND (v_role='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly) = v_khoa_phong)))
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
      AND (p_equipment_id IS NULL OR ct.id=p_equipment_id)
      AND (v_role IN ('global','admin') OR (ct.don_vi=v_don_vi AND (v_role='to_qltb' OR public._normalize_department_scope(ct.khoa_phong_quan_ly)=v_khoa_phong)))
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
      AND (v_role IN ('global', 'admin') OR (t.don_vi = v_don_vi AND (v_role='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly) = v_khoa_phong)))
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
      AND (v_role IN ('global','admin') OR (t.don_vi=v_don_vi AND (v_role='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly)=v_khoa_phong)))
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
      AND (v_role IN ('global','admin') OR (t.don_vi=v_don_vi AND (v_role='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly)=v_khoa_phong)))
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
  SELECT e.equipment_id,e.equipment_code,e.equipment_name,e.monitoring_date,e.shift_id,
    e.shift_code,e.shift_name,e.shift_start_local,e.shift_end_local,e.slot_start,e.slot_end,
    e.configuration_version_id,e.display_timezone,e.status FROM projected e;
END;
$$;

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
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR (v_role<>'to_qltb' AND v_khoa_phong IS NULL)) THEN
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

  RETURN QUERY SELECT e.*,
    encode(convert_to(e.monitoring_date::TEXT||'|'||e.equipment_id::TEXT||'|'||COALESCE(e.shift_id::TEXT,'00000000-0000-0000-0000-000000000000'),'UTF8'),'base64')
  FROM public._temperature_monitoring_slot_rows(p_from_date,p_to_date,p_shift_codes,p_equipment_id,p_include_unconfigured) e
  WHERE v_cursor_date IS NULL OR (e.monitoring_date,e.equipment_id,COALESCE(e.shift_id::TEXT,'00000000-0000-0000-0000-000000000000')) > (v_cursor_date,v_cursor_equipment,v_cursor_shift)
  ORDER BY e.monitoring_date,e.equipment_id,COALESCE(e.shift_id::TEXT,'00000000-0000-0000-0000-000000000000') LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_workspace_list(
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
            (t.don_vi=(claims->>'don_vi')::BIGINT AND (lower(COALESCE(NULLIF(claims->>'app_role',''),claims->>'role'))='to_qltb' OR public._normalize_department_scope(t.khoa_phong_quan_ly)=public._normalize_department_scope(claims->>'khoa_phong')))))
      THEN 'no_eligible_slots' ELSE 'no_monitored_equipment' END,
    'next_cursor',CASE WHEN (SELECT count(*) FROM page)>p_limit THEN (SELECT jsonb_build_object('date',x.monitoring_date,'equipment',x.equipment_id,'shift',x.shift_id,'filter',filter_key) FROM visible x ORDER BY x.monitoring_date DESC,x.equipment_id DESC,x.shift_id DESC LIMIT 1) END)
  INTO result;
  RETURN result;
END;
$$;

COMMIT;
