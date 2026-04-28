-- Issue #338 PR-3a follow-up: reassert equipment_list_enhanced contract.
--
-- This supersedes already-live migration version 20260427231232 after review
-- found two contract gaps in that historical version:
-- - payload used wildcard row serialization, silently expanding with future thiet_bi columns
-- - SECURITY DEFINER grants were not explicitly restricted to authenticated
--
-- Do NOT apply this migration before PR review approval. When approved, apply
-- it via Supabase MCP apply_migration and then run the smoke SQL in
-- supabase/tests/equipment_list_enhanced_active_repair_smoke.sql.
--
-- Rollback: re-apply the previous function body from
-- supabase/migrations/20260427231232_extend_equipment_list_enhanced_active_repair.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text,
  p_khoa_phong_array text[] DEFAULT NULL::text[],
  p_nguoi_su_dung text DEFAULT NULL::text,
  p_nguoi_su_dung_array text[] DEFAULT NULL::text[],
  p_vi_tri_lap_dat text DEFAULT NULL::text,
  p_vi_tri_lap_dat_array text[] DEFAULT NULL::text[],
  p_tinh_trang text DEFAULT NULL::text,
  p_tinh_trang_array text[] DEFAULT NULL::text[],
  p_phan_loai text DEFAULT NULL::text,
  p_phan_loai_array text[] DEFAULT NULL::text[],
  p_nguon_kinh_phi text DEFAULT NULL::text,
  p_nguon_kinh_phi_array text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_user_id TEXT := NULL;
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_department_scope TEXT;
  v_sort_col TEXT := 'id';
  v_sort_dir TEXT := 'ASC';
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1 AND is_deleted = false';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_jwt_claims JSONB;
  v_sanitized_q TEXT;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->>'app_role',
    v_jwt_claims ->>'role',
    ''
  );
  v_user_id := NULLIF(v_jwt_claims ->>'user_id', '');
  v_claim_donvi := NULLIF(v_jwt_claims ->>'don_vi', '')::BIGINT;

  IF lower(v_role) = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->>'khoa_phong');
  END IF;

  IF p_sort IS NOT NULL AND p_sort != '' THEN
    v_sort_col := split_part(p_sort, '.', 1);
    v_sort_dir := UPPER(COALESCE(NULLIF(split_part(p_sort, '.', 2), ''), 'ASC'));
    IF v_sort_dir NOT IN ('ASC', 'DESC') THEN
      v_sort_dir := 'ASC';
    END IF;
    IF v_sort_col NOT IN (
      'id', 'ma_thiet_bi', 'ten_thiet_bi', 'model', 'serial',
      'khoa_phong_quan_ly', 'tinh_trang_hien_tai', 'vi_tri_lap_dat',
      'nguoi_dang_truc_tiep_quan_ly', 'phan_loai_theo_nd98', 'nguon_kinh_phi', 'don_vi',
      'gia_goc', 'ngay_nhap', 'ngay_dua_vao_su_dung', 'ngay_bt_tiep_theo',
      'so_luu_hanh'
    ) THEN
      v_sort_col := 'id';
    END IF;
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) IN ('global', 'admin') THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective_donvi := p_don_vi;
    ELSE
      v_effective_donvi := NULL;
    END IF;
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      IF p_don_vi IS NOT NULL THEN
        IF p_don_vi = ANY(v_allowed_don_vi) THEN
          v_effective_donvi := p_don_vi;
        ELSE
          RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'Access denied for tenant');
        END IF;
      ELSE
        v_effective_donvi := NULL;
      END IF;
    ELSE
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'No tenant access');
    END IF;
  END IF;

  IF lower(v_role) = 'user' AND v_department_scope IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin') AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_where := v_where || ' AND public._normalize_department_scope(khoa_phong_quan_ly) = '
      || quote_literal(v_department_scope);
  END IF;

  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    v_where := v_where || ' AND khoa_phong_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    v_where := v_where || ' AND khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
  END IF;

  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ' || quote_literal(p_tinh_trang);
  END IF;

  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_nguon_kinh_phi_array IS NOT NULL AND array_length(p_nguon_kinh_phi_array, 1) > 0 THEN
    IF 'Chưa có' = ANY(p_nguon_kinh_phi_array) THEN
      DECLARE v_non_empty_sources TEXT[];
      BEGIN
        SELECT ARRAY(SELECT x FROM unnest(p_nguon_kinh_phi_array) AS x WHERE x != 'Chưa có') INTO v_non_empty_sources;
        IF v_non_empty_sources IS NOT NULL AND array_length(v_non_empty_sources, 1) > 0 THEN
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''' OR TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
            array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(v_non_empty_sources) AS x), ',') || ']))';
        ELSE
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
        END IF;
      END;
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
        array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguon_kinh_phi_array) AS x), ',') || '])';
    END IF;
  ELSIF p_nguon_kinh_phi IS NOT NULL AND trim(p_nguon_kinh_phi) != '' THEN
    IF p_nguon_kinh_phi = 'Chưa có' THEN
      v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ' || quote_literal(p_nguon_kinh_phi);
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_sanitized_q IS NOT NULL THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || v_sanitized_q || '%') || ')';
  END IF;

  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT (jsonb_build_object(
         ''ma_thiet_bi'', tb.ma_thiet_bi,
         ''ten_thiet_bi'', tb.ten_thiet_bi,
         ''model'', tb.model,
         ''serial'', tb.serial,
         ''cau_hinh_thiet_bi'', tb.cau_hinh_thiet_bi,
         ''phu_kien_kem_theo'', tb.phu_kien_kem_theo,
         ''hang_san_xuat'', tb.hang_san_xuat,
         ''noi_san_xuat'', tb.noi_san_xuat,
         ''nam_san_xuat'', tb.nam_san_xuat,
         ''ngay_nhap'', tb.ngay_nhap,
         ''ngay_dua_vao_su_dung'', tb.ngay_dua_vao_su_dung,
         ''nguon_kinh_phi'', tb.nguon_kinh_phi,
         ''gia_goc'', tb.gia_goc,
         ''nam_tinh_hao_mon'', tb.nam_tinh_hao_mon,
         ''ty_le_hao_mon'', tb.ty_le_hao_mon,
         ''han_bao_hanh'', tb.han_bao_hanh,
         ''vi_tri_lap_dat'', tb.vi_tri_lap_dat,
         ''nguoi_dang_truc_tiep_quan_ly'', tb.nguoi_dang_truc_tiep_quan_ly,
         ''khoa_phong_quan_ly'', tb.khoa_phong_quan_ly,
         ''tinh_trang_hien_tai'', tb.tinh_trang_hien_tai,
         ''ghi_chu'', tb.ghi_chu,
         ''chu_ky_bt_dinh_ky'', tb.chu_ky_bt_dinh_ky,
         ''ngay_bt_tiep_theo'', tb.ngay_bt_tiep_theo,
         ''chu_ky_hc_dinh_ky'', tb.chu_ky_hc_dinh_ky,
         ''ngay_hc_tiep_theo'', tb.ngay_hc_tiep_theo,
         ''chu_ky_kd_dinh_ky'', tb.chu_ky_kd_dinh_ky,
         ''ngay_kd_tiep_theo'', tb.ngay_kd_tiep_theo,
         ''phan_loai_theo_nd98'', tb.phan_loai_theo_nd98,
         ''id'', tb.id,
         ''created_at'', tb.created_at,
         ''don_vi'', tb.don_vi,
         ''nguon_nhap'', tb.nguon_nhap,
         ''so_luu_hanh'', tb.so_luu_hanh,
         ''nhom_thiet_bi_id'', tb.nhom_thiet_bi_id,
         ''is_deleted'', tb.is_deleted,
         ''ngay_ngung_su_dung'', tb.ngay_ngung_su_dung,
         ''google_drive_folder_url'', dv.google_drive_folder_url,
         ''don_vi_name'', dv.name,
         ''active_repair_request_id'', ar.active_id
       )) AS t
       FROM public.thiet_bi tb
       LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
       LEFT JOIN LATERAL (
         SELECT r.id AS active_id
         FROM public.yeu_cau_sua_chua r
         WHERE r.thiet_bi_id = tb.id
           AND r.trang_thai IN (''Chờ xử lý'', ''Đã duyệt'')
         ORDER BY r.ngay_yeu_cau DESC, r.id DESC
         LIMIT 1
       ) ar ON TRUE
       WHERE %s
       ORDER BY tb.%I %s
       OFFSET %s LIMIT %s
     ) sub',
    v_where, v_sort_col, v_sort_dir, v_offset, v_limit
  ) INTO v_data;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text,
  text,
  integer,
  integer,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text,
  text,
  integer,
  integer,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) TO authenticated;

COMMIT;
