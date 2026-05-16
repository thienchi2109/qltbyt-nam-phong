-- Fix assigned-equipment lookup for Device Quota categories.
--
-- Root cause:
-- - dinh_muc_thiet_bi_by_nhom RETURNS TABLE exposes an output column named id.
-- - The previous function used an unqualified WHERE id = p_nhom_id inside
--   PL/pgSQL, making id ambiguous between the output column and nhom_thiet_bi.id.

BEGIN;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_category_don_vi BIGINT;
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

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi
        USING errcode = '42501';
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing facility claim' USING errcode = '42501';
    END IF;
  END IF;

  IF p_nhom_id IS NULL THEN
    RAISE EXCEPTION 'Category ID (p_nhom_id) is required.';
  END IF;

  SELECT ntb.don_vi_id
  INTO v_category_don_vi
  FROM public.nhom_thiet_bi ntb
  WHERE ntb.id = p_nhom_id;

  IF v_category_don_vi IS NULL THEN
    RETURN;
  END IF;

  IF p_don_vi IS NOT NULL AND v_category_don_vi != p_don_vi THEN
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_by_nhom(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_thiet_bi_by_nhom IS
  'List equipment assigned to a Device Quota category, scoped by tenant access.';

COMMIT;
