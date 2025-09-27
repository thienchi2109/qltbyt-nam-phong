-- Phase 4: RPC-1 Read scope enforcement for regional leader rollout
-- Ensures read RPCs honor allowed_don_vi_for_session and blocks regional leader writes
-- Migration Date: 2025-09-27 15:30 UTC

BEGIN;

-- ============================================================================
-- Helper: shared routine for resolving effective tenant filters
-- ============================================================================
-- No separate helper is introduced to keep existing RPC signatures stable.
-- Each RPC now consumes public.allowed_don_vi_for_session() directly.

-- ============================================================================
-- equipment_list (legacy list RPC)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sql TEXT;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL; -- All tenants (already constrained by role)
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN; -- No accessible tenants
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

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  v_sql := 'SELECT * FROM public.thiet_bi WHERE 1=1';
  IF v_effective IS NOT NULL THEN
    v_sql := v_sql || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) <> '' THEN
    v_sql := v_sql || format(' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || p_q || '%', '%' || p_q || '%');
  END IF;

  v_sql := v_sql || format(' ORDER BY %I %s OFFSET %s LIMIT %s', v_sort_col, v_sort_dir, v_offset, GREATEST(p_page_size, 1));

  RETURN QUERY EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;

-- ============================================================================
-- equipment_get
-- ============================================================================
CREATE OR REPLACE FUNCTION public.equipment_get(p_id BIGINT)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  IF v_role = 'global' THEN
    SELECT * INTO rec FROM public.thiet_bi WHERE id = p_id;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND don_vi = ANY(v_allowed);
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_get(BIGINT) TO authenticated;

-- ============================================================================
-- equipment_update (block regional_leader writes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  IF v_role IN ('regional_leader','user') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    PERFORM 1 FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for update' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'technician' AND v_khoa_phong_new IS NOT NULL THEN
    PERFORM 1 FROM public.nhan_vien nv WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT AND nv.khoa_phong = v_khoa_phong_new;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.thiet_bi tb SET
    ten_thiet_bi = COALESCE(p_patch->>'ten_thiet_bi', tb.ten_thiet_bi),
    ma_thiet_bi = COALESCE(p_patch->>'ma_thiet_bi', tb.ma_thiet_bi),
    khoa_phong_quan_ly = COALESCE(p_patch->>'khoa_phong_quan_ly', tb.khoa_phong_quan_ly)
  WHERE tb.id = p_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_update(BIGINT, JSONB) TO authenticated;

-- ============================================================================
-- equipment_delete (block regional_leader writes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.equipment_delete(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  cnt INT;
BEGIN
  IF v_role IN ('regional_leader','technician','user') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    SELECT COUNT(*) INTO cnt FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF cnt = 0 THEN
      RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.thiet_bi WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_delete(BIGINT) TO authenticated;

-- ============================================================================
-- equipment_list_enhanced (JSON response)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_tinh_trang TEXT DEFAULT NULL,
  p_phan_loai TEXT DEFAULT NULL,
  p_fields TEXT DEFAULT 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'data', '[]'::jsonb,
        'total', 0,
        'page', p_page,
        'pageSize', p_page_size
      );
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
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', p_page,
      'pageSize', p_page_size
    );
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  IF v_effective IS NOT NULL THEN
    v_where := v_where || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) <> '' THEN
    v_where := v_where || format(' AND khoa_phong_quan_ly = %L', p_khoa_phong);
  END IF;

  IF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) <> '' THEN
    v_where := v_where || format(' AND tinh_trang_hien_tai = %L', p_tinh_trang);
  END IF;

  IF p_phan_loai IS NOT NULL AND trim(p_phan_loai) <> '' THEN
    v_where := v_where || format(' AND phan_loai_theo_nd98 = %L', p_phan_loai);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) <> '' THEN
    v_where := v_where || format(
      ' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || p_q || '%', '%' || p_q || '%'
    );
  END IF;

  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb)
     FROM (
       SELECT to_jsonb(tb.*) as t
       FROM public.thiet_bi tb
       WHERE %s
       ORDER BY %I %s
       OFFSET %s LIMIT %s
     ) sub',
    v_where,
    v_sort_col,
    v_sort_dir,
    v_offset,
    v_limit
  ) INTO v_data;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- equipment_count_enhanced
-- ============================================================================
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
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_cnt BIGINT;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
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
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_cnt
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;

-- ============================================================================
-- departments_list_for_tenant
-- ============================================================================
CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- transfer_request_list_enhanced
-- ============================================================================
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
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_offset INT;
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
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
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

-- ============================================================================
-- usage_analytics_overview
-- ============================================================================
CREATE OR REPLACE FUNCTION public.usage_analytics_overview(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  result JSONB;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total_sessions', 0,
        'active_sessions', 0,
        'total_usage_time', 0
      );
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
    RETURN jsonb_build_object(
      'total_sessions', 0,
      'active_sessions', 0,
      'total_usage_time', 0
    );
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
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective));

  RETURN COALESCE(result, jsonb_build_object(
    'total_sessions', 0,
    'active_sessions', 0,
    'total_usage_time', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_analytics_overview(BIGINT) TO authenticated;

-- ============================================================================
-- usage_analytics_daily
-- ============================================================================
CREATE OR REPLACE FUNCTION public.usage_analytics_daily(
  p_days INT DEFAULT 30,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND nk.thoi_gian_bat_dau >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY date_trunc('day', nk.thoi_gian_bat_dau)
    ORDER BY date DESC
  ) row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usage_analytics_daily(INT, BIGINT) TO authenticated;

-- ============================================================================
-- maintenance_stats_enhanced
-- ============================================================================
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
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  result JSONB;
  v_from DATE := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '1 year');
  v_to DATE := COALESCE(p_date_to, CURRENT_DATE);
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'repair_summary', jsonb_build_object('total_requests',0,'completed',0,'pending',0,'in_progress',0),
        'maintenance_summary', jsonb_build_object('total_plans',0,'total_tasks',0,'completed_tasks',0)
      );
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
    RETURN jsonb_build_object(
      'repair_summary', jsonb_build_object('total_requests',0,'completed',0,'pending',0,'in_progress',0),
      'maintenance_summary', jsonb_build_object('total_plans',0,'total_tasks',0,'completed_tasks',0)
    );
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
      WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
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
      WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND kh.created_at::date BETWEEN v_from AND v_to
    )
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object(
    'repair_summary', jsonb_build_object('total_requests',0,'completed',0,'pending',0,'in_progress',0),
    'maintenance_summary', jsonb_build_object('total_plans',0,'total_tasks',0,'completed_tasks',0)
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_stats_enhanced(DATE, DATE, BIGINT) TO authenticated;

COMMIT;
