-- Fetch full equipment details by an array of IDs.
-- Used by the MappingPreviewDialog to hydrate cross-page selections.
BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_by_ids(
  p_thiet_bi_ids BIGINT[],
  p_don_vi       BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id               BIGINT,
  ma_thiet_bi      TEXT,
  ten_thiet_bi     TEXT,
  model            TEXT,
  serial           TEXT,
  hang_san_xuat    TEXT,
  khoa_phong_quan_ly TEXT,
  tinh_trang       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role  TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- JWT claim guards (all three mandatory per REVIEW.md)
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant
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
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
    END IF;
  END IF;

  -- Guard: require explicit tenant even for global/admin
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Validate required parameter
  IF p_thiet_bi_ids IS NULL OR array_length(p_thiet_bi_ids, 1) IS NULL THEN
    RETURN; -- Empty input → empty result
  END IF;

  -- Return equipment by IDs, filtered by tenant
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
  WHERE tb.id = ANY(p_thiet_bi_ids)
    AND (p_don_vi IS NULL OR tb.don_vi = p_don_vi)
  ORDER BY tb.ten_thiet_bi, tb.ma_thiet_bi;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_by_ids(BIGINT[], BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_by_ids(BIGINT[], BIGINT) FROM PUBLIC;

COMMIT;
