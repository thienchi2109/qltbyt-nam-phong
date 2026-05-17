-- Migration: Add quota fields to dinh_muc_nhom_list
-- Issue #500: category tab progress needs active quota denominator.

DROP FUNCTION IF EXISTS public.dinh_muc_nhom_list(BIGINT);

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  parent_id BIGINT,
  ma_nhom TEXT,
  ten_nhom TEXT,
  phan_loai TEXT,
  don_vi_tinh TEXT,
  thu_tu_hien_thi INT,
  mo_ta TEXT,
  tu_khoa TEXT[],
  level INT,
  so_luong_hien_co BIGINT,
  so_luong_toi_da INT,
  so_luong_toi_thieu INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::JSONB,
    '{}'::JSONB
  );
  v_role TEXT := COALESCE(NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', ''));
  v_user_id TEXT := NULLIF(v_claims->>'user_id', '');
  v_don_vi TEXT := v_claims->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
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
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    SELECT
      n.id,
      n.parent_id,
      n.ma_nhom,
      n.ten_nhom,
      n.phan_loai,
      n.don_vi_tinh,
      n.thu_tu_hien_thi,
      n.mo_ta,
      n.tu_khoa,
      1 AS level,
      ARRAY[lpad(COALESCE(n.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || n.ma_nhom] AS sort_path
    FROM public.nhom_thiet_bi n
    WHERE n.don_vi_id = p_don_vi
      AND n.parent_id IS NULL

    UNION ALL

    SELECT
      n.id,
      n.parent_id,
      n.ma_nhom,
      n.ten_nhom,
      n.phan_loai,
      n.don_vi_tinh,
      n.thu_tu_hien_thi,
      n.mo_ta,
      n.tu_khoa,
      ct.level + 1,
      ct.sort_path || (lpad(COALESCE(n.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || n.ma_nhom)
    FROM public.nhom_thiet_bi n
    INNER JOIN category_tree ct ON n.parent_id = ct.id
    WHERE n.don_vi_id = p_don_vi
  ),
  equipment_counts AS (
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  ),
  active_quotas AS (
    SELECT
      cd.nhom_thiet_bi_id,
      cd.so_luong_toi_da,
      cd.so_luong_toi_thieu
    FROM public.chi_tiet_dinh_muc cd
    INNER JOIN public.quyet_dinh_dinh_muc qd ON qd.id = cd.quyet_dinh_id
    WHERE qd.don_vi_id = p_don_vi
      AND qd.trang_thai = 'active'
  )
  SELECT
    ct.id,
    ct.parent_id,
    ct.ma_nhom,
    ct.ten_nhom,
    ct.phan_loai,
    ct.don_vi_tinh,
    ct.thu_tu_hien_thi,
    ct.mo_ta,
    ct.tu_khoa,
    ct.level,
    COALESCE(ec.cnt, 0) AS so_luong_hien_co,
    aq.so_luong_toi_da,
    aq.so_luong_toi_thieu
  FROM category_tree ct
  LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = ct.id
  LEFT JOIN active_quotas aq ON aq.nhom_thiet_bi_id = ct.id
  ORDER BY ct.sort_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_list(BIGINT) IS
  'List device quota categories with hierarchy, equipment counts, and active quota min/max fields.';
