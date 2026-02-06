-- Fix: column tinh_trang does not exist in thiet_bi table
-- The correct column name is tinh_trang_hien_tai
-- Fixes error: "column tb.tinh_trang does not exist"

BEGIN;

-- Fix dinh_muc_thiet_bi_unassigned function
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned(
  p_don_vi BIGINT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
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
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_search_pattern TEXT;
  v_total BIGINT;
  v_allowed_facilities BIGINT[];
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant (use provided p_don_vi)
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate p_don_vi against allowed facilities
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- Other roles: force to their own tenant
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- If still no tenant specified, return empty
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Sanitize limit and offset
  IF p_limit IS NULL OR p_limit < 1 THEN
    p_limit := 50;
  END IF;
  IF p_limit > 500 THEN
    p_limit := 500;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Prepare search pattern
  v_search_pattern := '%' || COALESCE(LOWER(TRIM(p_search)), '') || '%';

  -- Get total count first
  SELECT COUNT(*) INTO v_total
  FROM public.thiet_bi tb
  WHERE tb.don_vi = p_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND (
      p_search IS NULL
      OR p_search = ''
      OR LOWER(COALESCE(tb.ten_thiet_bi, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.ma_thiet_bi, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.model, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.serial, '')) LIKE v_search_pattern
    );

  -- Return equipment with total count
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
      p_search IS NULL
      OR p_search = ''
      OR LOWER(COALESCE(tb.ten_thiet_bi, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.ma_thiet_bi, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.model, '')) LIKE v_search_pattern
      OR LOWER(COALESCE(tb.serial, '')) LIKE v_search_pattern
    )
  ORDER BY tb.ten_thiet_bi, tb.ma_thiet_bi
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Fix dinh_muc_thiet_bi_by_nhom function
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_by_nhom(
  p_nhom_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  ma_thiet_bi TEXT,
  ten_thiet_bi TEXT,
  model TEXT,
  serial TEXT,
  hang_san_xuat TEXT,
  khoa_phong_quan_ly TEXT,
  tinh_trang TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_category_don_vi BIGINT;
  v_allowed_facilities BIGINT[];
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant (use provided p_don_vi)
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate p_don_vi against allowed facilities
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- Other roles: force to their own tenant
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- Validate required parameter
  IF p_nhom_id IS NULL THEN
    RAISE EXCEPTION 'Category ID (p_nhom_id) is required.';
  END IF;

  -- Verify category exists and check tenant ownership
  SELECT don_vi_id INTO v_category_don_vi
  FROM public.nhom_thiet_bi
  WHERE id = p_nhom_id;

  IF v_category_don_vi IS NULL THEN
    -- Category not found, return empty
    RETURN;
  END IF;

  -- Enforce tenant ownership if p_don_vi is specified
  IF p_don_vi IS NOT NULL AND v_category_don_vi != p_don_vi THEN
    -- Category belongs to different tenant, return empty
    RETURN;
  END IF;

  -- Return equipment linked to the category
  -- Use category's tenant for equipment filter
  RETURN QUERY
  SELECT
    tb.id,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.serial,
    tb.hang_san_xuat,
    tb.khoa_phong_quan_ly,
    tb.tinh_trang_hien_tai AS tinh_trang
  FROM public.thiet_bi tb
  WHERE tb.nhom_thiet_bi_id = p_nhom_id
    AND tb.don_vi = v_category_don_vi
  ORDER BY tb.ten_thiet_bi, tb.ma_thiet_bi;
END;
$$;

COMMIT;
