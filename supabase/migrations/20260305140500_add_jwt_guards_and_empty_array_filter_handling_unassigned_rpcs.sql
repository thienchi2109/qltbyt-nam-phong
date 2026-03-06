-- Add mandatory JWT claim guards and empty-array filter handling
-- for unassigned equipment RPCs already deployed in production.

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned(
  p_don_vi BIGINT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_khoa_phong_array TEXT[] DEFAULT NULL,
  p_nguoi_su_dung_array TEXT[] DEFAULT NULL,
  p_vi_tri_lap_dat_array TEXT[] DEFAULT NULL,
  p_nguon_kinh_phi_array TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  ma_thiet_bi TEXT,
  ten_thiet_bi TEXT,
  model TEXT,
  serial TEXT,
  hang_san_xuat TEXT,
  khoa_phong_quan_ly TEXT,
  tinh_trang TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_sanitized_search TEXT;
  v_total BIGINT;
  v_allowed_facilities BIGINT[];
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 50;
  END IF;
  IF p_limit > 500 THEN
    p_limit := 500;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  v_sanitized_search := public._sanitize_ilike_pattern(LOWER(TRIM(p_search)));

  SELECT COUNT(*) INTO v_total
  FROM public.thiet_bi tb
  WHERE tb.don_vi = p_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND (
      v_sanitized_search IS NULL
      OR LOWER(COALESCE(tb.ten_thiet_bi, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.ma_thiet_bi, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.model, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.serial, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.so_luu_hanh, '')) LIKE '%' || v_sanitized_search || '%'
    )
    AND (p_khoa_phong_array IS NULL OR cardinality(p_khoa_phong_array) = 0 OR tb.khoa_phong_quan_ly = ANY(p_khoa_phong_array))
    AND (p_nguoi_su_dung_array IS NULL OR cardinality(p_nguoi_su_dung_array) = 0 OR tb.nguoi_dang_truc_tiep_quan_ly = ANY(p_nguoi_su_dung_array))
    AND (p_vi_tri_lap_dat_array IS NULL OR cardinality(p_vi_tri_lap_dat_array) = 0 OR tb.vi_tri_lap_dat = ANY(p_vi_tri_lap_dat_array))
    AND (p_nguon_kinh_phi_array IS NULL OR cardinality(p_nguon_kinh_phi_array) = 0 OR tb.nguon_kinh_phi = ANY(p_nguon_kinh_phi_array));

  RETURN QUERY
  SELECT
    tb.id,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.serial,
    tb.hang_san_xuat,
    tb.khoa_phong_quan_ly,
    tb.tinh_trang_hien_tai AS tinh_trang,
    v_total AS total_count
  FROM public.thiet_bi tb
  WHERE tb.don_vi = p_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND (
      v_sanitized_search IS NULL
      OR LOWER(COALESCE(tb.ten_thiet_bi, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.ma_thiet_bi, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.model, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.serial, '')) LIKE '%' || v_sanitized_search || '%'
      OR LOWER(COALESCE(tb.so_luu_hanh, '')) LIKE '%' || v_sanitized_search || '%'
    )
    AND (p_khoa_phong_array IS NULL OR cardinality(p_khoa_phong_array) = 0 OR tb.khoa_phong_quan_ly = ANY(p_khoa_phong_array))
    AND (p_nguoi_su_dung_array IS NULL OR cardinality(p_nguoi_su_dung_array) = 0 OR tb.nguoi_dang_truc_tiep_quan_ly = ANY(p_nguoi_su_dung_array))
    AND (p_vi_tri_lap_dat_array IS NULL OR cardinality(p_vi_tri_lap_dat_array) = 0 OR tb.vi_tri_lap_dat = ANY(p_vi_tri_lap_dat_array))
    AND (p_nguon_kinh_phi_array IS NULL OR cardinality(p_nguon_kinh_phi_array) = 0 OR tb.nguon_kinh_phi = ANY(p_nguon_kinh_phi_array))
  ORDER BY tb.ten_thiet_bi, tb.ma_thiet_bi
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned_filter_options(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_allowed_facilities BIGINT[];
  v_result JSONB;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    v_result := '{"departments":[],"users":[],"locations":[],"fundingSources":[]}'::JSONB;
    RETURN v_result;
  END IF;

  SELECT jsonb_build_object(
    'departments', COALESCE((
      SELECT jsonb_agg(DISTINCT tb.khoa_phong_quan_ly ORDER BY tb.khoa_phong_quan_ly)
      FROM public.thiet_bi tb
      WHERE tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
        AND tb.khoa_phong_quan_ly IS NOT NULL
        AND tb.khoa_phong_quan_ly != ''
    ), '[]'::JSONB),
    'users', COALESCE((
      SELECT jsonb_agg(DISTINCT tb.nguoi_dang_truc_tiep_quan_ly ORDER BY tb.nguoi_dang_truc_tiep_quan_ly)
      FROM public.thiet_bi tb
      WHERE tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
        AND tb.nguoi_dang_truc_tiep_quan_ly IS NOT NULL
        AND tb.nguoi_dang_truc_tiep_quan_ly != ''
    ), '[]'::JSONB),
    'locations', COALESCE((
      SELECT jsonb_agg(DISTINCT tb.vi_tri_lap_dat ORDER BY tb.vi_tri_lap_dat)
      FROM public.thiet_bi tb
      WHERE tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
        AND tb.vi_tri_lap_dat IS NOT NULL
        AND tb.vi_tri_lap_dat != ''
    ), '[]'::JSONB),
    'fundingSources', COALESCE((
      SELECT jsonb_agg(DISTINCT tb.nguon_kinh_phi ORDER BY tb.nguon_kinh_phi)
      FROM public.thiet_bi tb
      WHERE tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
        AND tb.nguon_kinh_phi IS NOT NULL
        AND tb.nguon_kinh_phi != ''
    ), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned(
  BIGINT, TEXT, INT, INT, TEXT[], TEXT[], TEXT[], TEXT[]
) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned(
  BIGINT, TEXT, INT, INT, TEXT[], TEXT[], TEXT[], TEXT[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_filter_options(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_filter_options(BIGINT) FROM PUBLIC;

COMMIT;
