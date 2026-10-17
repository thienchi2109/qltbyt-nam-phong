-- TM-03: schedule shifts and server-side expected-slot projection.

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_schedule_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_profile_id UUID NOT NULL REFERENCES public.temperature_monitoring_schedule_profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_local TIME NOT NULL,
  end_local TIME NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT temperature_monitoring_schedule_shifts_code_nonempty CHECK (btrim(code) <> ''),
  CONSTRAINT temperature_monitoring_schedule_shifts_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT temperature_monitoring_schedule_shifts_sort_order_nonnegative CHECK (sort_order >= 0),
  UNIQUE (schedule_profile_id, code),
  UNIQUE (schedule_profile_id, id)
);

CREATE INDEX IF NOT EXISTS temperature_monitoring_schedule_shifts_profile_order_idx
  ON public.temperature_monitoring_schedule_shifts (schedule_profile_id, sort_order, id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_schedule_shift_overrides (
  schedule_profile_id UUID NOT NULL REFERENCES public.temperature_monitoring_schedule_profiles(id) ON DELETE CASCADE,
  don_vi BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL,
  name TEXT,
  start_local TIME,
  end_local TIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_profile_id, don_vi, shift_id),
  CONSTRAINT temperature_monitoring_shift_override_name_nonempty CHECK (name IS NULL OR btrim(name) <> ''),
  CONSTRAINT temperature_monitoring_shift_override_shift_fk
    FOREIGN KEY (schedule_profile_id, shift_id)
    REFERENCES public.temperature_monitoring_schedule_shifts(schedule_profile_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS temperature_monitoring_shift_overrides_lookup_idx
  ON public.temperature_monitoring_schedule_shift_overrides (don_vi, schedule_profile_id, shift_id)
  WHERE is_active;

INSERT INTO public.temperature_monitoring_schedule_profiles (code, name, is_active)
VALUES ('default', 'Lịch mặc định', TRUE)
ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

INSERT INTO public.temperature_monitoring_schedule_shifts
  (schedule_profile_id, code, name, start_local, end_local, sort_order)
SELECT p.id, x.code, x.name, x.start_local, x.end_local, x.sort_order
FROM public.temperature_monitoring_schedule_profiles p
CROSS JOIN (VALUES
  ('sang', 'Sáng', '06:00'::time, '12:00'::time, 10),
  ('chieu', 'Chiều', '12:00'::time, '18:00'::time, 20),
  ('toi', 'Tối', '18:00'::time, '22:00'::time, 30),
  ('dem', 'Đêm', '22:00'::time, '06:00'::time, 40)
) AS x(code, name, start_local, end_local, sort_order)
WHERE p.code = 'default'
ON CONFLICT (schedule_profile_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  start_local = EXCLUDED.start_local,
  end_local = EXCLUDED.end_local,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

REVOKE ALL ON TABLE public.temperature_monitoring_schedule_shifts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.temperature_monitoring_schedule_shift_overrides FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_schedule_shift_override_upsert(
  p_schedule_profile_id UUID,
  p_don_vi BIGINT,
  p_shift_id UUID,
  p_name TEXT DEFAULT NULL,
  p_start_local TIME DEFAULT NULL,
  p_end_local TIME DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS public.temperature_monitoring_schedule_shift_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_don_vi BIGINT := NULLIF(v_claims->>'don_vi','')::BIGINT;
  v_row public.temperature_monitoring_schedule_shift_overrides;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'missing role claim' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'temperature monitoring schedule requires equipment manager role' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi IS DISTINCT FROM p_don_vi) THEN
    RAISE EXCEPTION 'schedule override is outside tenant scope' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.temperature_monitoring_schedule_shifts s
    WHERE s.schedule_profile_id = p_schedule_profile_id AND s.id = p_shift_id
  ) THEN
    RAISE EXCEPTION 'schedule shift does not belong to profile' USING ERRCODE = '22023';
  END IF;
  IF (p_start_local IS NULL AND p_end_local IS NOT NULL) OR (p_start_local IS NOT NULL AND p_end_local IS NULL) THEN
    RAISE EXCEPTION 'override start and end must be supplied together' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.temperature_monitoring_schedule_shift_overrides
    (schedule_profile_id, don_vi, shift_id, name, start_local, end_local, is_active)
  VALUES (p_schedule_profile_id, p_don_vi, p_shift_id, NULLIF(btrim(p_name), ''), p_start_local, p_end_local, COALESCE(p_is_active, TRUE))
  ON CONFLICT (schedule_profile_id, don_vi, shift_id) DO UPDATE SET
    name = EXCLUDED.name, start_local = EXCLUDED.start_local, end_local = EXCLUDED.end_local,
    is_active = EXCLUDED.is_active, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.temperature_monitoring_schedule_shift_override_upsert(UUID, BIGINT, UUID, TEXT, TIME, TIME, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_schedule_shift_override_upsert(UUID, BIGINT, UUID, TEXT, TIME, TIME, BOOLEAN) TO authenticated;

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
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_don_vi BIGINT := NULLIF(v_claims->>'don_vi','')::BIGINT;
  v_khoa_phong TEXT := public._normalize_department_scope(v_claims->>'khoa_phong');
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_cursor_date DATE;
  v_cursor_equipment BIGINT;
  v_cursor_shift TEXT;
  v_cursor_parts TEXT[];
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'missing role claim' USING ERRCODE = '42501';
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
  projected AS (
    SELECT e.equipment_id, e.equipment_code, e.equipment_name, e.monitoring_date,
           e.shift_id, e.shift_code, e.shift_name, e.shift_start_local, e.shift_end_local,
           e.configuration_version_id, e.display_timezone, e.slot_start, e.slot_end,
           'Chưa ghi'::TEXT AS status
    FROM effective e
    UNION ALL
    SELECT u.equipment_id, u.equipment_code, u.equipment_name, u.monitoring_date,
           u.shift_id, u.shift_code, u.shift_name, u.shift_start_local, u.shift_end_local,
           u.configuration_version_id, u.display_timezone, u.slot_start, u.slot_end, u.status
    FROM unconfigured u
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
