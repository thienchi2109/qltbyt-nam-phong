-- Migration: Fix dinh_muc_nhom_list sort order
-- Date: 2026-03-03
-- Problem: ORDER BY level, thu_tu_hien_thi, ma_nhom sorts globally,
--   causing children of different parents to interleave when they share
--   the same thu_tu_hien_thi values (e.g., children of I and II both
--   starting from 1).
-- Solution: Add sort_path TEXT[] array that accumulates zero-padded
--   sort keys at each level for proper depth-first tree traversal.

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
  so_luong_hien_co BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Base case: root categories (no parent)
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
      -- Zero-pad thu_tu (10 digits) + ma_nhom for correct text sorting
      ARRAY[lpad(COALESCE(n.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || n.ma_nhom] AS sort_path
    FROM public.nhom_thiet_bi n
    WHERE n.don_vi_id = p_don_vi
      AND n.parent_id IS NULL

    UNION ALL

    -- Recursive case: child categories
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
    COALESCE(ec.cnt, 0) AS so_luong_hien_co
  FROM category_tree ct
  LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = ct.id
  ORDER BY ct.sort_path;
END;
$$;
