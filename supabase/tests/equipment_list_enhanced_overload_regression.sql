-- Purpose: ensure the canonical 19-parameter implementation and the
-- frontend 13-parameter compatibility adapter are both present, with no
-- legacy p_fields overload.

DO $$
DECLARE
  v_overload_count integer;
  v_legacy_count integer;
  v_canonical_count integer;
  v_compatibility_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_overload_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced';

  IF v_overload_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 equipment_list_enhanced overloads, got %', v_overload_count;
  END IF;

  SELECT COUNT(*)
  INTO v_legacy_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_fields text%';

  IF v_legacy_count <> 0 THEN
    RAISE EXCEPTION 'Legacy p_fields overload still exists';
  END IF;

  SELECT COUNT(*)
  INTO v_canonical_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_q text, p_sort text, p_page integer, p_page_size integer, p_don_vi bigint, p_khoa_phong text, p_khoa_phong_array text[], p_nguoi_su_dung text, p_nguoi_su_dung_array text[], p_vi_tri_lap_dat text, p_vi_tri_lap_dat_array text, p_tinh_trang text, p_tinh_trang_array text, p_phan_loai text, p_phan_loai_array text, p_nguon_kinh_phi text, p_nguon_kinh_phi_array text, p_liquidation_last boolean, p_equipment_dataset text';

  IF v_canonical_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one canonical 19-parameter overload, got %', v_canonical_count;
  END IF;

  SELECT COUNT(*)
  INTO v_compatibility_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_q text, p_don_vi bigint, p_khoa_phong_array text[], p_nguoi_su_dung_array text[], p_vi_tri_lap_dat_array text[], p_tinh_trang_array text[], p_phan_loai_array text[], p_nguon_kinh_phi_array text[], p_equipment_dataset text, p_sort text, p_page integer, p_page_size integer, p_liquidation_last boolean';

  IF v_compatibility_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one 13-parameter frontend compatibility overload, got %', v_compatibility_count;
  END IF;
END $$;
