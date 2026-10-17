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
  UNIQUE (schedule_profile_id, code)
);

CREATE INDEX IF NOT EXISTS temperature_monitoring_schedule_shifts_profile_order_idx
  ON public.temperature_monitoring_schedule_shifts (schedule_profile_id, sort_order, id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_schedule_shift_overrides (
  schedule_profile_id UUID NOT NULL REFERENCES public.temperature_monitoring_schedule_profiles(id) ON DELETE CASCADE,
  don_vi BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.temperature_monitoring_schedule_shifts(id) ON DELETE CASCADE,
  name TEXT,
  start_local TIME,
  end_local TIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_profile_id, don_vi, shift_id),
  CONSTRAINT temperature_monitoring_shift_override_name_nonempty CHECK (name IS NULL OR btrim(name) <> '')
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
  v_khoa_phong TEXT := NULLIF(btrim(v_claims->>'khoa_phong'),'');
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_cursor_date DATE;
  v_cursor_equipment BIGINT;
  v_cursor_shift UUID;
  v_cursor_parts TEXT[];
BEGIN
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
      v_cursor_shift := v_cursor_parts[3]::UUID;
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
      AND (v_role IN ('global', 'admin') OR (v_don_vi IS NOT NULL AND t.don_vi = v_don_vi AND v_khoa_phong IS NOT NULL AND NULLIF(btrim(t.khoa_phong_quan_ly), '') = v_khoa_phong))
      AND COALESCE(NULLIF(btrim(t.tinh_trang_hien_tai), ''), '') = 'Hoạt động'
      AND (NULLIF(t.ngay_dua_vao_su_dung, '') IS NULL OR NULLIF(t.ngay_dua_vao_su_dung, '')::DATE <= d.monitoring_date)
      AND (NULLIF(t.ngay_ngung_su_dung, '') IS NULL OR NULLIF(t.ngay_ngung_su_dung, '')::DATE > d.monitoring_date)
    JOIN public.temperature_monitoring_configuration_versions v ON v.equipment_id = t.id
      AND v.monitoring_enabled
    JOIN public.temperature_monitoring_schedule_shifts s ON s.schedule_profile_id = v.schedule_profile_id
      AND s.is_active
      AND (p_shift_codes IS NULL OR s.code = ANY(p_shift_codes))
    LEFT JOIN public.temperature_monitoring_schedule_shift_overrides so ON so.schedule_profile_id = s.schedule_profile_id
      AND so.shift_id = s.id AND so.don_vi = t.don_vi AND so.is_active
    WHERE (p_include_unconfigured OR v.monitoring_enabled)
      AND (v.effective_period @> (((d.monitoring_date + COALESCE(so.start_local, s.start_local)) AT TIME ZONE COALESCE(NULLIF(btrim(v.display_timezone), ''), 'Asia/Ho_Chi_Minh'))))
      AND (v_cursor_date IS NULL OR (d.monitoring_date, t.id, s.id) > (v_cursor_date, v_cursor_equipment, v_cursor_shift))
    ORDER BY v.equipment_id, d.monitoring_date, s.id, lower(v.effective_period) DESC
  )
  SELECT e.equipment_id, e.equipment_code, e.equipment_name, e.monitoring_date, e.shift_id,
         e.shift_code, e.shift_name, e.shift_start_local, e.shift_end_local, e.slot_start,
         e.slot_end, e.configuration_version_id, e.display_timezone, 'Chưa ghi'::TEXT,
         encode(convert_to((e.monitoring_date::TEXT || '|' || e.equipment_id::TEXT || '|' || e.shift_id::TEXT), 'UTF8'), 'base64')
  FROM effective e
  ORDER BY e.monitoring_date, e.equipment_id, e.shift_id
  LIMIT v_limit;

  IF p_include_unconfigured THEN
    RETURN QUERY
    SELECT t.id, t.ma_thiet_bi, t.ten_thiet_bi, d.monitoring_date, NULL::UUID,
           NULL::TEXT, NULL::TEXT, NULL::TIME, NULL::TIME, NULL::TIMESTAMPTZ,
           NULL::TIMESTAMPTZ, NULL::UUID, 'Asia/Ho_Chi_Minh'::TEXT, 'Chưa cấu hình'::TEXT, NULL::TEXT
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') d(monitoring_date)
    JOIN public.thiet_bi t ON COALESCE(t.is_deleted, FALSE) = FALSE
      AND (p_equipment_id IS NULL OR t.id = p_equipment_id)
      AND COALESCE(NULLIF(btrim(t.tinh_trang_hien_tai), ''), '') = 'Hoạt động'
      AND NOT EXISTS (
        SELECT 1 FROM public.temperature_monitoring_configuration_versions v
        WHERE v.equipment_id = t.id AND v.monitoring_enabled
          AND v.effective_period @> (d.monitoring_date::DATE::TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')
      )
      AND (v_role IN ('global', 'admin') OR t.don_vi = v_don_vi)
    ORDER BY d.monitoring_date, t.id
    LIMIT v_limit;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.temperature_monitoring_slots_list(DATE, DATE, TEXT[], BIGINT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_slots_list(DATE, DATE, TEXT[], BIGINT, TEXT, INTEGER, BOOLEAN) TO authenticated;
