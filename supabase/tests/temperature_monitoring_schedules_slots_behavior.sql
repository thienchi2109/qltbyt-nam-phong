-- TM-03 executable fixture checks. The runner must execute this file in one transaction.
-- All fixture rows are rolled back; no live or restored-baseline data is mutated.
BEGIN;

DO $$
DECLARE
  v_don_vi BIGINT;
  v_equipment BIGINT;
  v_profile UUID;
  v_shift UUID;
  v_dept TEXT := 'TM03 Fixture';
  v_rows RECORD;
  v_cursor TEXT;
  v_count INTEGER;
BEGIN
  SELECT id INTO v_don_vi FROM public.don_vi ORDER BY id LIMIT 1;
  IF v_don_vi IS NULL THEN RAISE EXCEPTION 'TM-03 fixture requires one don_vi row'; END IF;

  INSERT INTO public.thiet_bi (ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, tinh_trang_hien_tai, ngay_dua_vao_su_dung, ngay_ngung_su_dung)
  VALUES ('TM03-FIXTURE-' || substr(gen_random_uuid()::text, 1, 8), 'TM03 fixture', v_don_vi, v_dept, 'Hoạt động', '2026-01-01', NULL)
  RETURNING id INTO v_equipment;
  SELECT id INTO v_profile FROM public.temperature_monitoring_schedule_profiles WHERE code='default' AND is_active;
  SELECT id INTO v_shift FROM public.temperature_monitoring_schedule_shifts WHERE schedule_profile_id=v_profile AND code='dem' AND is_active;
  IF v_profile IS NULL OR v_shift IS NULL THEN RAISE EXCEPTION 'TM-03 default overnight shift fixture missing'; END IF;

  INSERT INTO public.temperature_monitoring_configuration_versions
    (equipment_id, effective_period, monitoring_enabled, lower_c, upper_c, schedule_profile_id, display_timezone, change_reason)
  VALUES (v_equipment, tstzrange('2026-07-01 15:00+00', '2026-07-03 15:00+00', '[)'), TRUE, 2, 8, v_profile, 'Asia/Ho_Chi_Minh', 'TM03 fixture');

  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role','to_qltb','don_vi',v_don_vi,'khoa_phong',v_dept)::text, true);
  SELECT * INTO v_rows FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',ARRAY['dem'],v_equipment,NULL,20,false) LIMIT 1;
  IF v_rows.shift_code <> 'dem' OR v_rows.status <> 'Chưa ghi' OR (v_rows.slot_start AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <> '2026-07-02' OR (v_rows.slot_end AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <> '2026-07-03' THEN
    RAISE EXCEPTION 'overnight/effective slot projection failed: %', v_rows;
  END IF;

  PERFORM public.temperature_monitoring_schedule_shift_override_upsert(v_profile, v_don_vi, v_shift, NULL, '23:00', '07:00', TRUE);
  SELECT * INTO v_rows FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',ARRAY['dem'],v_equipment,NULL,20,false) LIMIT 1;
  IF v_rows.shift_start_local <> '23:00'::time OR (v_rows.slot_end AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <> '2026-07-03' THEN
    RAISE EXCEPTION 'tenant shift override projection failed: %', v_rows;
  END IF;

  SELECT count(*) INTO v_count FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',ARRAY['sang'],v_equipment,NULL,20,false);
  IF v_count = 0 OR EXISTS (
    SELECT 1
    FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',ARRAY['sang'],v_equipment,NULL,20,false)
    WHERE shift_code <> 'sang'
  ) THEN RAISE EXCEPTION 'shift filter leaked non-selected shift'; END IF;

  SELECT next_cursor INTO v_cursor FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',NULL,v_equipment,NULL,1,false) LIMIT 1;
  IF v_cursor IS NULL THEN RAISE EXCEPTION 'cursor was not returned'; END IF;
  SELECT count(*) INTO v_count FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',NULL,v_equipment,v_cursor,20,false);
  IF v_count < 1 THEN RAISE EXCEPTION 'cursor did not advance to remaining shifts'; END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role','to_qltb','don_vi',v_don_vi + 999999,'khoa_phong',v_dept)::text, true);
  SELECT count(*) INTO v_count FROM public.temperature_monitoring_slots_list('2026-07-02','2026-07-02',NULL,v_equipment,NULL,20,false);
  IF v_count <> 0 THEN RAISE EXCEPTION 'tenant scope leaked fixture equipment'; END IF;
END;
$$;

ROLLBACK;
