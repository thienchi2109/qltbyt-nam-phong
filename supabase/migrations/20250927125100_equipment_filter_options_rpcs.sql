-- Equipment filter options RPCs for tenant-aware filtering
-- Provides complete filter option lists for equipment page multi-select filters
-- Date: 2025-09-27

-- Helper function for JWT claims (ensure it exists)
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- Users list for equipment filtering (tenant-aware)
CREATE OR REPLACE FUNCTION public.equipment_users_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('name', user_info.name, 'count', user_info.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND nguoi_dang_truc_tiep_quan_ly IS NOT NULL
      AND TRIM(nguoi_dang_truc_tiep_quan_ly) != ''
    GROUP BY nguoi_dang_truc_tiep_quan_ly
    ORDER BY count DESC
  ) user_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_users_list_for_tenant(BIGINT) TO authenticated;

-- Locations list for equipment filtering (tenant-aware)
CREATE OR REPLACE FUNCTION public.equipment_locations_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('name', location_info.name, 'count', location_info.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND vi_tri_lap_dat IS NOT NULL
      AND TRIM(vi_tri_lap_dat) != ''
    GROUP BY vi_tri_lap_dat
    ORDER BY count DESC
  ) location_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT) TO authenticated;

-- Classifications list for equipment filtering (tenant-aware)
CREATE OR REPLACE FUNCTION public.equipment_classifications_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('name', classification_info.name, 'count', classification_info.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND phan_loai_theo_nd98 IS NOT NULL
      AND TRIM(phan_loai_theo_nd98) != ''
    GROUP BY phan_loai_theo_nd98
    ORDER BY 
      CASE TRIM(UPPER(phan_loai_theo_nd98))
        WHEN 'A' THEN 1
        WHEN 'LOẠI A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'LOẠI B' THEN 2
        WHEN 'C' THEN 3
        WHEN 'LOẠI C' THEN 3
        WHEN 'D' THEN 4
        WHEN 'LOẠI D' THEN 4
        ELSE 5
      END,
      count DESC
  ) classification_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT) TO authenticated;

-- Statuses list for equipment filtering (tenant-aware)
CREATE OR REPLACE FUNCTION public.equipment_statuses_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('name', status_info.name, 'count', status_info.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND tinh_trang_hien_tai IS NOT NULL
      AND TRIM(tinh_trang_hien_tai) != ''
    GROUP BY tinh_trang_hien_tai
    ORDER BY 
      CASE TRIM(tinh_trang_hien_tai)
        WHEN 'Hoạt động' THEN 1
        WHEN 'Chờ bảo trì' THEN 2
        WHEN 'Chờ hiệu chuẩn/kiểm định' THEN 3
        WHEN 'Chờ sửa chữa' THEN 4
        WHEN 'Ngưng sử dụng' THEN 5
        WHEN 'Chưa có nhu cầu sử dụng' THEN 6
        ELSE 7
      END,
      count DESC
  ) status_info;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT) TO authenticated;