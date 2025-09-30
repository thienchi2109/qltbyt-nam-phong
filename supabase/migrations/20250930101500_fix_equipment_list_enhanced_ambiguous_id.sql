-- Fix ambiguous column reference 'id' in equipment_list_enhanced function
-- Issue: Both thiet_bi and don_vi tables have 'id' columns causing ORDER BY ambiguity
-- Solution: Properly qualify all column references with table aliases

CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_khoa_phong_array TEXT[] DEFAULT NULL,
  p_nguoi_su_dung TEXT DEFAULT NULL,
  p_nguoi_su_dung_array TEXT[] DEFAULT NULL,
  p_vi_tri_lap_dat TEXT DEFAULT NULL,
  p_vi_tri_lap_dat_array TEXT[] DEFAULT NULL,
  p_tinh_trang TEXT DEFAULT NULL,
  p_tinh_trang_array TEXT[] DEFAULT NULL,
  p_phan_loai TEXT DEFAULT NULL,
  p_phan_loai_array TEXT[] DEFAULT NULL,
  p_fields TEXT DEFAULT 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_effective_donvi BIGINT := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_fields TEXT := 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98';
  v_qualified_sort_col TEXT;
BEGIN
  -- obtain claims at runtime
  v_role := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  -- Tenant isolation: non-global users are forced to their claim tenant
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi; -- may be NULL => all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- enforced
  END IF;

  -- Validate and split sort
  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial','vi_tri_lap_dat','nguoi_dang_truc_tiep_quan_ly'
  ) THEN
    v_sort_col := 'id';
  END IF;

  -- Fix ambiguous column reference by qualifying with table alias
  -- All sortable columns belong to thiet_bi table (tb)
  v_qualified_sort_col := CASE v_sort_col
    WHEN 'id' THEN 'tb.id'
    WHEN 'ten_thiet_bi' THEN 'tb.ten_thiet_bi'
    WHEN 'ma_thiet_bi' THEN 'tb.ma_thiet_bi'
    WHEN 'khoa_phong_quan_ly' THEN 'tb.khoa_phong_quan_ly'
    WHEN 'don_vi' THEN 'tb.don_vi'
    WHEN 'tinh_trang_hien_tai' THEN 'tb.tinh_trang_hien_tai'
    WHEN 'phan_loai_theo_nd98' THEN 'tb.phan_loai_theo_nd98'
    WHEN 'model' THEN 'tb.model'
    WHEN 'serial' THEN 'tb.serial'
    WHEN 'vi_tri_lap_dat' THEN 'tb.vi_tri_lap_dat'
    WHEN 'nguoi_dang_truc_tiep_quan_ly' THEN 'tb.nguoi_dang_truc_tiep_quan_ly'
    ELSE 'tb.id'
  END;

  -- Build WHERE clause with proper conditions
  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND tb.don_vi = ' || v_effective_donvi;
  END IF;

  -- Handle department filtering: prioritize array over single value
  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    -- Multiple departments: use ANY for efficient IN clause
    v_where := v_where || ' AND tb.khoa_phong_quan_ly = ANY(' || quote_literal(p_khoa_phong_array) || '::text[])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    -- Single department: backward compatibility
    v_where := v_where || ' AND tb.khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
  END IF;

  -- Handle user filtering
  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND tb.nguoi_dang_truc_tiep_quan_ly = ANY(' || quote_literal(p_nguoi_su_dung_array) || '::text[])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND tb.nguoi_dang_truc_tiep_quan_ly = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  -- Handle location filtering  
  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND tb.vi_tri_lap_dat = ANY(' || quote_literal(p_vi_tri_lap_dat_array) || '::text[])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND tb.vi_tri_lap_dat = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  -- Handle status filtering
  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND tb.tinh_trang_hien_tai = ANY(' || quote_literal(p_tinh_trang_array) || '::text[])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND tb.tinh_trang_hien_tai = ' || quote_literal(p_tinh_trang);
  END IF;

  -- Handle classification filtering
  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND tb.phan_loai_theo_nd98 = ANY(' || quote_literal(p_phan_loai_array) || '::text[])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND tb.phan_loai_theo_nd98 = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) != '' THEN
    v_where := v_where || ' AND (tb.ten_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR tb.ma_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') || ')';
  END IF;

  -- Get total count (with qualified table alias)
  EXECUTE format('SELECT count(*) FROM public.thiet_bi tb WHERE %s', v_where) INTO v_total;

  -- Validate fields parameter
  IF p_fields IS NOT NULL AND trim(p_fields) != '' THEN
    v_fields := p_fields;
  END IF;

  -- Get data page (using qualified column name for ORDER BY)
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT (to_jsonb(tb.*) || jsonb_build_object(''google_drive_folder_url'', dv.google_drive_folder_url)) AS t
       FROM public.thiet_bi tb
       LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
       WHERE %s
       ORDER BY %s %s
       OFFSET %s LIMIT %s
     ) sub',
    v_where, v_qualified_sort_col, v_sort_dir, v_offset, v_limit
  ) INTO v_data;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced TO authenticated;

-- Comments
COMMENT ON FUNCTION public.equipment_list_enhanced IS 'Enhanced equipment list function with proper column qualification to avoid ambiguous references';