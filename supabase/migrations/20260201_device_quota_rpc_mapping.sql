-- Migration: Device Quota RPC Functions - Equipment-to-Category Mapping
-- Date: 2026-02-01
-- Purpose:
--   Bulk operations for linking/unlinking equipment to categories.
--   Supports quota tracking by managing equipment category assignments.
--   Full audit trail for all link/unlink operations.
--
-- Functions:
--   - dinh_muc_thiet_bi_link: Bulk link equipment to a category
--   - dinh_muc_thiet_bi_unlink: Bulk unlink equipment from their categories
--   - dinh_muc_thiet_bi_unassigned: List equipment without category assignment
--   - dinh_muc_thiet_bi_by_nhom: List equipment assigned to a specific category
--
-- Security: All functions use JWT claims for tenant isolation per CLAUDE.md
-- Note: thiet_bi uses 'don_vi' column, nhom_thiet_bi uses 'don_vi_id'

BEGIN;

-- ============================================================================
-- FUNCTION: dinh_muc_thiet_bi_link
-- ============================================================================
-- Bulk link equipment to a category for quota tracking.
-- Updates thiet_bi.nhom_thiet_bi_id for all equipment in the array.
-- Writes audit log entry with action='link'.
--
-- Validation:
--   - Category must exist and belong to the same tenant
--   - All equipment must belong to the same tenant
--   - Equipment must not already be linked to the same category (idempotent)
--
-- Roles: global, admin, to_qltb only
--
-- Parameters:
--   p_thiet_bi_ids: Array of equipment IDs to link
--   p_nhom_id: Category ID to link equipment to
--   p_don_vi: Tenant ID (overridden for non-global/admin users)
--
-- Returns: Count of equipment successfully linked

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link(
  p_thiet_bi_ids BIGINT[],
  p_nhom_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_category_don_vi BIGINT;
  v_affected_count INT := 0;
  v_equipment_ids BIGINT[];
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
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

  -- Validate required parameters
  IF p_thiet_bi_ids IS NULL OR array_length(p_thiet_bi_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Equipment IDs array (p_thiet_bi_ids) cannot be empty.';
  END IF;

  IF p_nhom_id IS NULL THEN
    RAISE EXCEPTION 'Category ID (p_nhom_id) is required.';
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (p_don_vi) is required.';
  END IF;

  -- 3. Verify category exists and belongs to the same tenant
  SELECT don_vi_id INTO v_category_don_vi
  FROM public.nhom_thiet_bi
  WHERE id = p_nhom_id;

  IF v_category_don_vi IS NULL THEN
    RAISE EXCEPTION 'Category not found (ID: %).', p_nhom_id;
  END IF;

  IF v_category_don_vi != p_don_vi THEN
    RAISE EXCEPTION 'Category belongs to different tenant.';
  END IF;

  -- 4. Get valid equipment IDs that belong to this tenant and need updating
  -- Filter out equipment that already has this category assigned (idempotent)
  SELECT ARRAY_AGG(tb.id) INTO v_equipment_ids
  FROM public.thiet_bi tb
  WHERE tb.id = ANY(p_thiet_bi_ids)
    AND tb.don_vi = p_don_vi
    AND (tb.nhom_thiet_bi_id IS DISTINCT FROM p_nhom_id);

  -- If no valid equipment to update, return 0
  IF v_equipment_ids IS NULL OR array_length(v_equipment_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- 5. Update equipment to link to category
  UPDATE public.thiet_bi
  SET nhom_thiet_bi_id = p_nhom_id
  WHERE id = ANY(v_equipment_ids);

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  -- 6. Write audit log entry
  IF v_affected_count > 0 THEN
    INSERT INTO public.thiet_bi_nhom_audit_log (
      don_vi_id,
      thiet_bi_ids,
      nhom_thiet_bi_id,
      action,
      performed_by,
      performed_at,
      metadata
    ) VALUES (
      p_don_vi,
      v_equipment_ids,
      p_nhom_id,
      'link',
      NULLIF(v_user_id, '')::BIGINT,
      NOW(),
      jsonb_build_object(
        'count', v_affected_count,
        'requested_ids', p_thiet_bi_ids,
        'linked_ids', v_equipment_ids
      )
    );
  END IF;

  RETURN v_affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_link(BIGINT[], BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_thiet_bi_link IS
  'Bulk link equipment to a category for quota tracking.
   Validates tenant ownership, updates equipment, and writes audit log.
   Returns count of equipment successfully linked.';


-- ============================================================================
-- FUNCTION: dinh_muc_thiet_bi_unlink
-- ============================================================================
-- Bulk unlink equipment from their current categories.
-- Sets thiet_bi.nhom_thiet_bi_id = NULL for all equipment in the array.
-- Writes audit log entry with action='unlink' (records previous category).
--
-- Roles: global, admin, to_qltb only
--
-- Parameters:
--   p_thiet_bi_ids: Array of equipment IDs to unlink
--   p_don_vi: Tenant ID (overridden for non-global/admin users)
--
-- Returns: Count of equipment successfully unlinked

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unlink(
  p_thiet_bi_ids BIGINT[],
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_affected_count INT := 0;
  v_unlink_data JSONB;
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
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

  -- Validate required parameters
  IF p_thiet_bi_ids IS NULL OR array_length(p_thiet_bi_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Equipment IDs array (p_thiet_bi_ids) cannot be empty.';
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (p_don_vi) is required.';
  END IF;

  -- 3. Collect equipment with their current categories for audit (before unlinking)
  -- Group by previous category to create separate audit entries
  WITH equipment_to_unlink AS (
    SELECT tb.id, tb.nhom_thiet_bi_id
    FROM public.thiet_bi tb
    WHERE tb.id = ANY(p_thiet_bi_ids)
      AND tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
  ),
  grouped_by_category AS (
    SELECT
      nhom_thiet_bi_id,
      ARRAY_AGG(id) AS equipment_ids
    FROM equipment_to_unlink
    GROUP BY nhom_thiet_bi_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'nhom_id', nhom_thiet_bi_id,
      'equipment_ids', equipment_ids
    )
  ) INTO v_unlink_data
  FROM grouped_by_category;

  -- If no equipment to unlink, return 0
  IF v_unlink_data IS NULL THEN
    RETURN 0;
  END IF;

  -- 4. Update equipment to unlink from categories
  UPDATE public.thiet_bi
  SET nhom_thiet_bi_id = NULL
  WHERE id = ANY(p_thiet_bi_ids)
    AND don_vi = p_don_vi
    AND nhom_thiet_bi_id IS NOT NULL;

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  -- 5. Write audit log entries (one per previous category)
  IF v_affected_count > 0 THEN
    INSERT INTO public.thiet_bi_nhom_audit_log (
      don_vi_id,
      thiet_bi_ids,
      nhom_thiet_bi_id,
      action,
      performed_by,
      performed_at,
      metadata
    )
    SELECT
      p_don_vi,
      ARRAY(SELECT jsonb_array_elements_text(item->'equipment_ids')::BIGINT),
      (item->>'nhom_id')::BIGINT,
      'unlink',
      NULLIF(v_user_id, '')::BIGINT,
      NOW(),
      jsonb_build_object(
        'previous_nhom_id', (item->>'nhom_id')::BIGINT,
        'unlink_data', v_unlink_data
      )
    FROM jsonb_array_elements(v_unlink_data) AS item;
  END IF;

  RETURN v_affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_thiet_bi_unlink IS
  'Bulk unlink equipment from their categories.
   Sets nhom_thiet_bi_id to NULL and writes audit log with previous category.
   Returns count of equipment successfully unlinked.';


-- ============================================================================
-- FUNCTION: dinh_muc_thiet_bi_unassigned
-- ============================================================================
-- List equipment NOT assigned to any category (nhom_thiet_bi_id IS NULL).
-- Supports search on ten_thiet_bi, ma_thiet_bi, model, serial.
-- All authenticated users can read (tenant isolation only).
--
-- Parameters:
--   p_don_vi: Tenant ID (overridden for non-global users)
--   p_search: Optional search text for ten_thiet_bi, ma_thiet_bi, model, serial
--   p_limit: Maximum records to return (default 50)
--   p_offset: Number of records to skip (default 0)
--
-- Returns: Table with equipment details

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
    COALESCE(tb.tinh_trang, tb.tinh_trang_hien_tai) AS tinh_trang,
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

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned(BIGINT, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_thiet_bi_unassigned IS
  'List equipment not assigned to any category.
   Supports search on name, code, model, and serial.
   Returns paginated results with total count.';


-- ============================================================================
-- FUNCTION: dinh_muc_thiet_bi_by_nhom
-- ============================================================================
-- List equipment assigned to a specific category.
-- All authenticated users can read (tenant isolation only).
--
-- Parameters:
--   p_nhom_id: Category ID to filter by
--   p_don_vi: Tenant ID (overridden for non-global users)
--
-- Returns: Table with equipment details

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
    COALESCE(tb.tinh_trang, tb.tinh_trang_hien_tai) AS tinh_trang
  FROM public.thiet_bi tb
  WHERE tb.nhom_thiet_bi_id = p_nhom_id
    AND tb.don_vi = v_category_don_vi
  ORDER BY tb.ten_thiet_bi, tb.ma_thiet_bi;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_by_nhom(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_thiet_bi_by_nhom IS
  'List equipment assigned to a specific category.
   Verifies tenant ownership and returns equipment details.
   Returns empty if category not found or tenant mismatch.';

COMMIT;
