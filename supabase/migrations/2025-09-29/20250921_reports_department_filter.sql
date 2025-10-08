-- Phase 2.1: Server-side department filtering for Reports (Inventory)
-- Adds a dedicated equipment_list_for_reports RPC with p_khoa_phong and tenant filtering
-- Updates transfer_request_list_enhanced to support department filter too

BEGIN;

-- Helper (idempotent)
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- Dedicated list for Reports: supports tenant and department filter; returns rows for client composition
CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10000,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT;
BEGIN
  -- Debug removed

  -- Resolve effective tenant
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- force tenant for non-global
  END IF;

  -- Debug removed

  -- Whitelist sorting
  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi') THEN
    v_sort_col := 'id';
  END IF;
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE ( $1::bigint IS NULL OR don_vi = $1 )
       AND ( $2::text IS NULL OR khoa_phong_quan_ly = $2 )
       AND ( $3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5 )
     ORDER BY %I %s OFFSET $4 LIMIT $6',
     v_sort_col, v_sort_dir
  ) USING v_effective_donvi, p_khoa_phong, p_q, v_offset, ('%' || p_q || '%'), p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) TO authenticated;

-- Recreate transfer_request_list_enhanced with optional department filter
DROP FUNCTION IF EXISTS public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE);

CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_offset INT;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL means all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- force tenant for non-global
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
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
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

GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) TO authenticated;

-- Update equipment_count_enhanced to support department filtering too
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
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_cnt BIGINT;
BEGIN
  -- For global users, use explicit p_don_vi if provided, otherwise no tenant filter
  -- For non-global users, always use their JWT don_vi
  IF lower(v_role) = 'global' THEN
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

COMMIT;



