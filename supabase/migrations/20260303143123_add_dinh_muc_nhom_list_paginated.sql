-- Migration: Add paginated + searchable version of dinh_muc_nhom_list
-- Date: 2026-03-04
-- Purpose:
--   Provides server-side pagination at the root-category level.
--   Each page returns N root categories WITH all their descendants,
--   so parent-child groups are never split across pages.
--   Also supports text search across ma_nhom, ten_nhom, mo_ta.
--
-- The original dinh_muc_nhom_list remains untouched (used by mapping page).

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list_paginated(
  p_don_vi    BIGINT  DEFAULT NULL,
  p_page      INT     DEFAULT 1,
  p_page_size INT     DEFAULT 20,
  p_search    TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id                BIGINT,
  parent_id         BIGINT,
  ma_nhom           TEXT,
  ten_nhom          TEXT,
  phan_loai         TEXT,
  don_vi_tinh       TEXT,
  thu_tu_hien_thi   INT,
  mo_ta             TEXT,
  tu_khoa           TEXT[],
  level             INT,
  so_luong_hien_co  BIGINT,
  total_root_count  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
  v_search TEXT;
  v_offset INT;
BEGIN
  -- Fallback for older tokens
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation
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

  -- Sanitize pagination params
  p_page      := GREATEST(1, COALESCE(p_page, 1));
  p_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 20)));
  v_offset    := (p_page - 1) * p_page_size;

  -- Normalize search term (trim + lowercase, NULL if blank)
  v_search := NULLIF(TRIM(p_search), '');
  IF v_search IS NOT NULL THEN
    v_search := '%' || lower(v_search) || '%';
  END IF;

  RETURN QUERY
  WITH
  -- Step 1: Build the FULL tree (all categories for this tenant)
  full_tree AS (
    SELECT
      n.id,
      n.parent_id,
      n.ma_nhom,
      n.ten_nhom,
      n.phan_loai,
      n.don_vi_tinh,
      n.thu_tu_hien_thi,
      n.mo_ta,
      n.tu_khoa
    FROM public.nhom_thiet_bi n
    WHERE n.don_vi_id = p_don_vi
  ),

  -- Step 2: When searching, find matching leaf/node IDs
  -- then walk UP to find all ancestor root IDs
  matching_ids AS (
    SELECT ft.id
    FROM full_tree ft
    WHERE v_search IS NOT NULL
      AND (
        lower(ft.ma_nhom) LIKE v_search
        OR lower(ft.ten_nhom) LIKE v_search
        OR lower(COALESCE(ft.mo_ta, '')) LIKE v_search
      )
  ),

  -- Walk up from matches to find their root ancestors
  -- (handles arbitrary depth)
  ancestors AS (
    SELECT ft.id, ft.parent_id
    FROM full_tree ft
    WHERE ft.id IN (SELECT mi.id FROM matching_ids mi)

    UNION

    SELECT ft.id, ft.parent_id
    FROM full_tree ft
    INNER JOIN ancestors a ON a.parent_id = ft.id
  ),

  -- Root IDs that either match themselves or have matching descendants
  matching_root_ids AS (
    SELECT a.id
    FROM ancestors a
    WHERE a.parent_id IS NULL
  ),

  -- Step 3: Determine which root categories to include
  -- When no search: all roots. When searching: only roots with matches.
  eligible_roots AS (
    SELECT
      ft.id,
      ft.ma_nhom,
      ft.thu_tu_hien_thi,
      -- Sort key for consistent ordering
      lpad(COALESCE(ft.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || ft.ma_nhom AS sort_key
    FROM full_tree ft
    WHERE ft.parent_id IS NULL
      AND (v_search IS NULL OR ft.id IN (SELECT mr.id FROM matching_root_ids mr))
  ),

  -- Count total eligible roots (for pagination UI)
  root_count AS (
    SELECT COUNT(*)::BIGINT AS cnt FROM eligible_roots
  ),

  -- Step 4: Paginate roots
  paged_roots AS (
    SELECT er.id
    FROM eligible_roots er
    ORDER BY er.sort_key
    LIMIT p_page_size OFFSET v_offset
  ),

  -- Step 5: Recursive CTE from paged roots to get full subtrees
  category_tree AS (
    SELECT
      ft.id,
      ft.parent_id,
      ft.ma_nhom,
      ft.ten_nhom,
      ft.phan_loai,
      ft.don_vi_tinh,
      ft.thu_tu_hien_thi,
      ft.mo_ta,
      ft.tu_khoa,
      1 AS level,
      ARRAY[lpad(COALESCE(ft.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || ft.ma_nhom] AS sort_path
    FROM full_tree ft
    WHERE ft.id IN (SELECT pr.id FROM paged_roots pr)

    UNION ALL

    SELECT
      ft.id,
      ft.parent_id,
      ft.ma_nhom,
      ft.ten_nhom,
      ft.phan_loai,
      ft.don_vi_tinh,
      ft.thu_tu_hien_thi,
      ft.mo_ta,
      ft.tu_khoa,
      ct.level + 1,
      ct.sort_path || (lpad(COALESCE(ft.thu_tu_hien_thi, 0)::text, 10, '0') || ':' || ft.ma_nhom)
    FROM full_tree ft
    INNER JOIN category_tree ct ON ft.parent_id = ct.id
  ),

  -- Equipment counts
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
    COALESCE(ec.cnt, 0) AS so_luong_hien_co,
    rc.cnt AS total_root_count
  FROM category_tree ct
  LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = ct.id
  CROSS JOIN root_count rc
  ORDER BY ct.sort_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list_paginated(BIGINT, INT, INT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_list_paginated IS
  'Paginated + searchable equipment category listing.
   Paginates at root-category level; each page includes all descendants.
   Search filters by ma_nhom, ten_nhom, mo_ta (case-insensitive).
   Returns total_root_count for pagination UI.';
