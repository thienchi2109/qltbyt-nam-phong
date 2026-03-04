-- Migration: Enforce server-side circular parent detection in dinh_muc_nhom_upsert
-- Date: 2026-03-04
-- Purpose:
--   1) Protect hierarchy integrity even when client-side checks are bypassed.
--   2) Prevent setting a category's parent to any of its descendants.

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
  -- Note: p_parent_id = 0 is a sentinel meaning "set to root (NULL)"
  IF p_parent_id IS NOT NULL AND p_parent_id > 0 THEN
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
    -- Note: p_parent_id = 0 is a sentinel meaning "create at root (NULL)"
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
      CASE WHEN p_parent_id IS NULL OR p_parent_id <= 0 THEN NULL ELSE p_parent_id END,
      TRIM(p_ma_nhom),
      TRIM(p_ten_nhom),
      COALESCE(p_phan_loai, 'B'),
      COALESCE(p_don_vi_tinh, 'Cái'),
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
    -- Note: p_parent_id = 0 is a sentinel meaning "set to root (NULL)"
    IF p_parent_id IS NOT NULL AND p_parent_id > 0 THEN
      IF p_parent_id = p_id THEN
        RAISE EXCEPTION 'Category cannot be its own parent.';
      END IF;

      IF EXISTS (
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id
          FROM public.nhom_thiet_bi
          WHERE id = p_parent_id
            AND don_vi_id = p_don_vi

          UNION ALL

          SELECT n.id, n.parent_id
          FROM public.nhom_thiet_bi n
          JOIN ancestors a ON n.id = a.parent_id
          WHERE n.don_vi_id = p_don_vi
        )
        SELECT 1
        FROM ancestors
        WHERE id = p_id
      ) THEN
        RAISE EXCEPTION 'Circular parent reference is not allowed.';
      END IF;
    END IF;

    -- Update category
    -- Note: p_parent_id = 0 means "set to root (NULL)", NULL means "keep existing"
    UPDATE public.nhom_thiet_bi
    SET
      parent_id = CASE
        WHEN p_parent_id = 0 THEN NULL           -- Sentinel: move to root
        WHEN p_parent_id IS NULL THEN parent_id  -- Not provided: keep existing
        ELSE p_parent_id                          -- Provided: set new parent
      END,
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
   For p_parent_id: NULL = keep existing, 0 = move to root, >0 = set new parent.
   Enforces tenant isolation, role permissions, and circular-parent prevention.';
