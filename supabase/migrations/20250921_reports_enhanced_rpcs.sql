-- Phase 2: Enhanced RPCs for Reports page tenant filtering
-- Adds explicit p_don_vi parameters to support global users selecting specific tenants
-- Safe, idempotent migration

BEGIN;

-- Drop and recreate helper function to fix parameter name (safe because it's recreated immediately)
DROP FUNCTION IF EXISTS public._get_jwt_claim(TEXT);

CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- Drop legacy 3-arg overload so deployments remain idempotent when adding p_khoa_phong
DROP FUNCTION IF EXISTS public.equipment_count_enhanced(TEXT[], TEXT, BIGINT);
CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(
  p_statuses TEXT[] DEFAULT NULL,
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_cnt BIGINT;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  SELECT COUNT(*) INTO v_cnt
  FROM public.thiet_bi tb
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;

-- Enhanced departments list with explicit tenant parameter
CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(
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
  SELECT jsonb_build_object('name', dept.name, 'count', dept.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    GROUP BY khoa_phong_quan_ly
    ORDER BY count DESC
  ) dept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.departments_list_for_tenant(BIGINT) TO authenticated;

-- Enhanced transfer request list with explicit tenant parameter
CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_offset INT;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT 
      yc.*,
      jsonb_build_object(
        'id', tb.id,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'ten_thiet_bi', tb.ten_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'don_vi', tb.don_vi
      ) as thiet_bi
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_status IS NULL OR yc.trang_thai = p_status)
      AND (p_date_from IS NULL OR yc.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR yc.created_at::date <= p_date_to)
      AND (p_q IS NULL OR (
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR 
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      ))
    ORDER BY yc.created_at DESC
    OFFSET v_offset LIMIT p_page_size
  ) row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE) TO authenticated;

-- Usage analytics overview with tenant filtering
CREATE OR REPLACE FUNCTION public.usage_analytics_overview(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result JSONB;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  SELECT jsonb_build_object(
    'total_sessions', COUNT(*),
    'active_sessions', COUNT(*) FILTER (WHERE nk.trang_thai = 'dang_su_dung'),
    'total_usage_time', COALESCE(SUM(
      CASE 
        WHEN nk.thoi_gian_ket_thuc IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 60
        ELSE 0 
      END
    ), 0)::int
  ) INTO result
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi);

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_analytics_overview(BIGINT) TO authenticated;

-- Daily usage analytics with tenant filtering
CREATE OR REPLACE FUNCTION public.usage_analytics_daily(
  p_days INT DEFAULT 30,
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
  SELECT to_jsonb(row) FROM (
    SELECT 
      date_trunc('day', nk.thoi_gian_bat_dau)::date as date,
      COUNT(*) as session_count,
      COALESCE(SUM(
        CASE 
          WHEN nk.thoi_gian_ket_thuc IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 60
          ELSE 0 
        END
      ), 0)::int as total_usage_time,
      COUNT(DISTINCT nk.nguoi_su_dung_id) as unique_users,
      COUNT(DISTINCT nk.thiet_bi_id) as unique_equipment
    FROM public.nhat_ky_su_dung nk
    LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND nk.thoi_gian_bat_dau >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY date_trunc('day', nk.thoi_gian_bat_dau)
    ORDER BY date DESC
  ) row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_analytics_daily(INT, BIGINT) TO authenticated;

-- Enhanced maintenance statistics with tenant filtering
CREATE OR REPLACE FUNCTION public.maintenance_stats_enhanced(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result JSONB;
  v_from DATE := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '1 year');
  v_to DATE := COALESCE(p_date_to, CURRENT_DATE);
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Always their own tenant
  END IF;

  SELECT jsonb_build_object(
    'repair_summary', (
      SELECT jsonb_build_object(
        'total_requests', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE yc.trang_thai = 'hoan_thanh'),
        'pending', COUNT(*) FILTER (WHERE yc.trang_thai = 'cho_duyet'),
        'in_progress', COUNT(*) FILTER (WHERE yc.trang_thai = 'dang_xu_ly')
      )
      FROM public.yeu_cau_sua_chua yc
      LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
      WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
        AND yc.created_at::date BETWEEN v_from AND v_to
    ),
    'maintenance_summary', (
      SELECT jsonb_build_object(
        'total_plans', COUNT(DISTINCT kh.id),
        'total_tasks', COUNT(cv.id),
        'completed_tasks', COUNT(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh')
      )
      FROM public.ke_hoach_bao_tri kh
      LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON cv.thiet_bi_id = tb.id
      WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
        AND kh.created_at::date BETWEEN v_from AND v_to
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_stats_enhanced(DATE, DATE, BIGINT) TO authenticated;

COMMIT;
