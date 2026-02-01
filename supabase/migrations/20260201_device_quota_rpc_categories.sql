-- Migration: Device Quota RPC Functions - Equipment Categories
-- Date: 2026-02-01
-- Purpose:
--   CRUD operations for equipment categories (nhom_thiet_bi) with tenant isolation.
--   Supports hierarchical structure with parent-child relationships.
--   Equipment count tracking for quota management.
--
-- Functions:
--   - dinh_muc_nhom_list: List categories with hierarchy and equipment counts
--   - dinh_muc_nhom_get: Get single category by ID
--   - dinh_muc_nhom_upsert: Create or update category
--   - dinh_muc_nhom_delete: Delete category with dependency checks
--
-- Security: All functions use JWT claims for tenant isolation per CLAUDE.md

BEGIN;

-- ============================================================================
-- FUNCTION: dinh_muc_nhom_list
-- ============================================================================
-- Lists equipment categories in hierarchical order using recursive CTE.
-- Includes equipment count for each category.
-- All authenticated users can read (tenant isolation applied).
--
-- Parameters:
--   p_don_vi: Tenant ID filter (overridden for non-global users)
--
-- Returns: Table with category details, hierarchy level, and equipment count

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

  -- Recursive CTE for hierarchical category listing
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
      1 AS level
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
      ct.level + 1
    FROM public.nhom_thiet_bi n
    INNER JOIN category_tree ct ON n.parent_id = ct.id
    WHERE n.don_vi_id = p_don_vi
  ),
  -- Count equipment linked to each category
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
  ORDER BY ct.level, ct.thu_tu_hien_thi, ct.ma_nhom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_list IS
  'List equipment categories with hierarchical structure and equipment counts.
   Returns categories ordered by level, display order, and code.';


-- ============================================================================
-- FUNCTION: dinh_muc_nhom_get
-- ============================================================================
-- Get a single equipment category by ID with equipment count.
-- Verifies tenant ownership before returning data.
--
-- Parameters:
--   p_id: Category ID to retrieve
--   p_don_vi: Tenant ID (overridden for non-global users)
--
-- Returns: Single category row or null if not found/unauthorized

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_get(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  don_vi_id BIGINT,
  parent_id BIGINT,
  ma_nhom TEXT,
  ten_nhom TEXT,
  phan_loai TEXT,
  don_vi_tinh TEXT,
  thu_tu_hien_thi INT,
  mo_ta TEXT,
  tu_khoa TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by BIGINT,
  updated_by BIGINT,
  so_luong_hien_co BIGINT
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
  -- Fallback for older tokens
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

  -- Verify category belongs to the specified tenant
  SELECT n.don_vi_id INTO v_category_don_vi
  FROM public.nhom_thiet_bi n
  WHERE n.id = p_id;

  IF v_category_don_vi IS NULL THEN
    -- Category not found
    RETURN;
  END IF;

  -- Enforce tenant ownership
  IF p_don_vi IS NOT NULL AND v_category_don_vi != p_don_vi THEN
    -- Category belongs to different tenant
    RETURN;
  END IF;

  -- Return category with equipment count
  RETURN QUERY
  SELECT
    n.id,
    n.don_vi_id,
    n.parent_id,
    n.ma_nhom,
    n.ten_nhom,
    n.phan_loai,
    n.don_vi_tinh,
    n.thu_tu_hien_thi,
    n.mo_ta,
    n.tu_khoa,
    n.created_at,
    n.updated_at,
    n.created_by,
    n.updated_by,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM public.thiet_bi tb
      WHERE tb.nhom_thiet_bi_id = n.id
    ), 0) AS so_luong_hien_co
  FROM public.nhom_thiet_bi n
  WHERE n.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_get(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_get IS
  'Get single equipment category by ID with equipment count.
   Returns null if category not found or user lacks tenant access.';


-- ============================================================================
-- FUNCTION: dinh_muc_nhom_upsert
-- ============================================================================
-- Create or update an equipment category.
-- If p_id is NULL: INSERT new category
-- If p_id is provided: UPDATE existing category
--
-- Roles: global, admin, to_qltb only
--
-- Parameters:
--   p_id: Category ID (NULL for insert, value for update)
--   p_don_vi: Tenant ID (overridden for non-global/admin users)
--   p_parent_id: Parent category ID for hierarchy
--   p_ma_nhom: Category code (unique within tenant)
--   p_ten_nhom: Category name
--   p_phan_loai: Classification (A/B)
--   p_don_vi_tinh: Unit of measure
--   p_thu_tu_hien_thi: Display order
--   p_mo_ta: Description
--   p_tu_khoa: Keywords array for AI matching
--
-- Returns: ID of created/updated category

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_upsert(
  p_id BIGINT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_parent_id BIGINT DEFAULT NULL,
  p_ma_nhom TEXT DEFAULT NULL,
  p_ten_nhom TEXT DEFAULT NULL,
  p_phan_loai TEXT DEFAULT NULL,
  p_don_vi_tinh TEXT DEFAULT NULL,
  p_thu_tu_hien_thi INT DEFAULT NULL,
  p_mo_ta TEXT DEFAULT NULL,
  p_tu_khoa TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_category_don_vi BIGINT;
  v_result_id BIGINT;
BEGIN
  -- Fallback for older tokens
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- 1. Permission check: only global, admin, to_qltb can write
  IF v_role IS NULL OR v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role.';
  END IF;

  -- 2. Tenant isolation: non-global/admin users must use their own tenant
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- Validate tenant ID is provided
  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (p_don_vi) is required.';
  END IF;

  -- Validate required fields for insert
  IF p_id IS NULL THEN
    IF p_ma_nhom IS NULL OR TRIM(p_ma_nhom) = '' THEN
      RAISE EXCEPTION 'Category code (p_ma_nhom) is required.';
    END IF;
    IF p_ten_nhom IS NULL OR TRIM(p_ten_nhom) = '' THEN
      RAISE EXCEPTION 'Category name (p_ten_nhom) is required.';
    END IF;
  END IF;

  -- Validate phan_loai if provided
  IF p_phan_loai IS NOT NULL AND p_phan_loai NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Classification (p_phan_loai) must be A or B.';
  END IF;

  -- Validate parent category belongs to same tenant
  IF p_parent_id IS NOT NULL THEN
    SELECT don_vi_id INTO v_category_don_vi
    FROM public.nhom_thiet_bi
    WHERE id = p_parent_id;

    IF v_category_don_vi IS NULL THEN
      RAISE EXCEPTION 'Parent category not found.';
    END IF;

    IF v_category_don_vi != p_don_vi THEN
      RAISE EXCEPTION 'Parent category must belong to the same tenant.';
    END IF;
  END IF;

  -- 3. Business logic: INSERT or UPDATE
  IF p_id IS NULL THEN
    -- INSERT new category
    INSERT INTO public.nhom_thiet_bi (
      don_vi_id,
      parent_id,
      ma_nhom,
      ten_nhom,
      phan_loai,
      don_vi_tinh,
      thu_tu_hien_thi,
      mo_ta,
      tu_khoa,
      created_by,
      updated_by
    ) VALUES (
      p_don_vi,
      p_parent_id,
      TRIM(p_ma_nhom),
      TRIM(p_ten_nhom),
      COALESCE(p_phan_loai, 'B'),
      COALESCE(p_don_vi_tinh, 'Cai'),
      COALESCE(p_thu_tu_hien_thi, 0),
      p_mo_ta,
      p_tu_khoa,
      NULLIF(v_user_id, '')::BIGINT,
      NULLIF(v_user_id, '')::BIGINT
    )
    RETURNING id INTO v_result_id;

  ELSE
    -- UPDATE existing category
    -- First verify category belongs to this tenant
    SELECT don_vi_id INTO v_category_don_vi
    FROM public.nhom_thiet_bi
    WHERE id = p_id;

    IF v_category_don_vi IS NULL THEN
      RAISE EXCEPTION 'Category not found.';
    END IF;

    IF v_category_don_vi != p_don_vi THEN
      RAISE EXCEPTION 'Category belongs to different tenant.';
    END IF;

    -- Prevent circular parent reference
    IF p_parent_id IS NOT NULL AND p_parent_id = p_id THEN
      RAISE EXCEPTION 'Category cannot be its own parent.';
    END IF;

    -- Update category
    UPDATE public.nhom_thiet_bi
    SET
      parent_id = COALESCE(p_parent_id, parent_id),
      ma_nhom = COALESCE(NULLIF(TRIM(p_ma_nhom), ''), ma_nhom),
      ten_nhom = COALESCE(NULLIF(TRIM(p_ten_nhom), ''), ten_nhom),
      phan_loai = COALESCE(p_phan_loai, phan_loai),
      don_vi_tinh = COALESCE(p_don_vi_tinh, don_vi_tinh),
      thu_tu_hien_thi = COALESCE(p_thu_tu_hien_thi, thu_tu_hien_thi),
      mo_ta = COALESCE(p_mo_ta, mo_ta),
      tu_khoa = COALESCE(p_tu_khoa, tu_khoa),
      updated_at = NOW(),
      updated_by = NULLIF(v_user_id, '')::BIGINT
    WHERE id = p_id
    RETURNING id INTO v_result_id;
  END IF;

  RETURN v_result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_upsert(
  BIGINT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT[]
) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_upsert IS
  'Create or update equipment category.
   Pass NULL for p_id to create new, or provide p_id to update existing.
   Enforces tenant isolation and role permissions.';


-- ============================================================================
-- FUNCTION: dinh_muc_nhom_delete
-- ============================================================================
-- Delete an equipment category with dependency checks.
-- Prevents deletion if:
--   - Equipment is linked to the category (nhom_thiet_bi_id = p_id)
--   - Child categories exist (parent_id = p_id)
--
-- Roles: global, admin, to_qltb only
--
-- Parameters:
--   p_id: Category ID to delete
--   p_don_vi: Tenant ID (overridden for non-global/admin users)
--
-- Returns: TRUE if deleted, raises exception otherwise

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_delete(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_category_don_vi BIGINT;
  v_equipment_count BIGINT;
  v_child_count BIGINT;
  v_quota_count BIGINT;
BEGIN
  -- Fallback for older tokens
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- 1. Permission check: only global, admin, to_qltb can delete
  IF v_role IS NULL OR v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role.';
  END IF;

  -- 2. Tenant isolation: non-global/admin users must use their own tenant
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- Validate category ID
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Category ID (p_id) is required.';
  END IF;

  -- Verify category exists and get its tenant
  SELECT don_vi_id INTO v_category_don_vi
  FROM public.nhom_thiet_bi
  WHERE id = p_id;

  IF v_category_don_vi IS NULL THEN
    RAISE EXCEPTION 'Category not found.';
  END IF;

  -- Enforce tenant ownership
  IF p_don_vi IS NOT NULL AND v_category_don_vi != p_don_vi THEN
    RAISE EXCEPTION 'Category belongs to different tenant.';
  END IF;

  -- 3. Check for linked equipment
  SELECT COUNT(*) INTO v_equipment_count
  FROM public.thiet_bi
  WHERE nhom_thiet_bi_id = p_id;

  IF v_equipment_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % equipment item(s) are linked. Unlink equipment first.', v_equipment_count;
  END IF;

  -- 4. Check for child categories
  SELECT COUNT(*) INTO v_child_count
  FROM public.nhom_thiet_bi
  WHERE parent_id = p_id;

  IF v_child_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % child categorie(s) exist. Delete or reassign children first.', v_child_count;
  END IF;

  -- 5. Check for quota line items referencing this category
  SELECT COUNT(*) INTO v_quota_count
  FROM public.chi_tiet_dinh_muc
  WHERE nhom_thiet_bi_id = p_id;

  IF v_quota_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete category: % quota line item(s) reference this category. Remove from quotas first.', v_quota_count;
  END IF;

  -- 6. Delete the category
  DELETE FROM public.nhom_thiet_bi
  WHERE id = p_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_delete(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_delete IS
  'Delete equipment category with dependency checks.
   Prevents deletion if equipment, child categories, or quota items exist.
   Returns TRUE on success, raises exception on failure.';

COMMIT;
