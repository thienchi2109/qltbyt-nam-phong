-- Fix Remaining RPC Functions for Regional Leader Role
-- Updates departments_list_for_tenant and other RPC functions to support regional_leader
-- Migration Date: 2025-10-04 06:45 UTC

BEGIN;

-- ============================================================================
-- FIX: Update departments_list_for_tenant to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('name', dept.name, 'count', dept.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    GROUP BY khoa_phong_quan_ly
    ORDER BY count DESC
  ) dept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.departments_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.departments_list_for_tenant(BIGINT)
IS 'Returns department list for tenant with equipment counts. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- FIX: Update usage_log_list to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(nk) || jsonb_build_object('thiet_bi', to_jsonb(tb)) || jsonb_build_object('nguoi_su_dung', to_jsonb(u))
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  LEFT JOIN public.nhan_vien u ON nk.nguoi_su_dung_id = u.id
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_status IS NULL OR nk.trang_thai = p_status)
    AND (p_date_from IS NULL OR nk.thoi_gian_bat_dau::date >= p_date_from)
    AND (p_date_to IS NULL OR nk.thoi_gian_bat_dau::date <= p_date_to)
    AND (
      p_q IS NULL OR p_q = '' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR 
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_log_list(TEXT, TEXT, INT, INT, DATE, DATE, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.usage_log_list(TEXT, TEXT, INT, INT, DATE, DATE, BIGINT)
IS 'Returns usage log entries with filtering. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- FIX: Update equipment_users_list_for_tenant to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_users_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('id', nv.id, 'username', nv.username, 'full_name', nv.full_name, 'role', nv.role)
  FROM public.nhan_vien nv
  WHERE nv.active = TRUE
    AND (v_effective IS NULL OR nv.don_vi = ANY(v_effective))
    AND nv.role IN ('technician', 'user')
  ORDER BY nv.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_users_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_users_list_for_tenant(BIGINT)
IS 'Returns list of users for tenant equipment management. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- FIX: Update equipment_locations_list_for_tenant to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_locations_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('location', COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT)
IS 'Returns location list for tenant equipment. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- FIX: Update equipment_classifications_list_for_tenant to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_classifications_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('classification', COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT)
IS 'Returns classification list for tenant equipment. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- FIX: Update equipment_statuses_list_for_tenant to support regional_leader
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_statuses_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('status', COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT)
IS 'Returns status list for tenant equipment. FIXED: Now supports regional_leader role.';

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.thiet_bi;
ANALYZE public.nhan_vien;
ANALYZE public.nhat_ky_su_dung;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test regional leader access to departments_list_for_tenant
SELECT * FROM public.departments_list_for_tenant(NULL);

-- Test regional leader access to usage_log_list
SELECT * FROM public.usage_log_list(NULL, NULL, 1, 10, NULL, NULL, NULL);

-- Test regional leader access to equipment_users_list_for_tenant
SELECT * FROM public.equipment_users_list_for_tenant(NULL);

-- Test regional leader access to equipment_locations_list_for_tenant
SELECT * FROM public.equipment_locations_list_for_tenant(NULL);

-- Test regional leader access to equipment_classifications_list_for_tenant
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);

-- Test regional leader access to equipment_statuses_list_for_tenant
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);
*/