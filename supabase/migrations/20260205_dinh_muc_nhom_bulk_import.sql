-- Migration: Bulk Import for Equipment Categories (nhom_thiet_bi)
-- Date: 2026-02-05
-- Purpose: RPC function for importing multiple equipment categories from Excel
-- Security: Enforces tenant isolation per CLAUDE.md security template
-- Features:
--   - Topological sort for parent-before-child processing
--   - Cycle detection via recursive CTE
--   - Parent resolution by ma_nhom (within batch and existing)
--   - Per-item error recovery (one failure doesn't abort all)
--   - Advisory lock to prevent concurrent imports

-- ============================================================================
-- FUNCTION: dinh_muc_nhom_bulk_import
-- ============================================================================
-- Bulk import equipment categories for a tenant.
-- Processes items in topological order (parents before children).
-- Security: Only global, admin, to_qltb roles
-- Tenant isolation: Enforced via JWT claims

CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_bulk_import(
  p_items JSONB,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_len INT;
  v_idx INT;
  v_inserted INT := 0;
  v_failed INT := 0;
  v_details JSONB := '[]'::jsonb;
  v_item JSONB;
  v_original_idx INT;
  v_ma_nhom TEXT;
  v_ten_nhom TEXT;
  v_parent_ma_nhom TEXT;
  v_phan_loai TEXT;
  v_don_vi_tinh TEXT;
  v_thu_tu_hien_thi INT;
  v_mo_ta TEXT;
  v_parent_id BIGINT;
  v_new_id BIGINT;
  v_err TEXT;
  v_sorted_items JSONB;
  v_batch_lookup JSONB := '{}'::jsonb;  -- ma_nhom -> id mapping for batch inserts
BEGIN
  -- ========================================================================
  -- SECURITY: Permission check
  -- ========================================================================
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := lower(COALESCE(public._get_jwt_claim('role'), ''));
  END IF;

  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role';
  END IF;

  -- ========================================================================
  -- SECURITY: Tenant isolation
  -- ========================================================================
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    -- SECURITY: Non-global users MUST have a valid tenant claim
    IF v_claim_donvi IS NULL THEN
      RAISE EXCEPTION 'Access denied: tenant claim (don_vi) is required for non-global users';
    END IF;
    v_effective_donvi := v_claim_donvi;  -- Force user's tenant
  END IF;

  IF v_effective_donvi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (p_don_vi) is required';
  END IF;

  -- ========================================================================
  -- INPUT VALIDATION
  -- ========================================================================
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  v_len := jsonb_array_length(p_items);
  IF v_len = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'inserted', 0,
      'failed', 0,
      'total', 0,
      'details', '[]'::jsonb
    );
  END IF;

  -- ========================================================================
  -- ADVISORY LOCK: Prevent concurrent imports for same tenant
  -- ========================================================================
  PERFORM pg_advisory_xact_lock(hashtext('nhom_thiet_bi_import_' || v_effective_donvi::text));

  -- ========================================================================
  -- VALIDATION: Check for duplicate ma_nhom within batch
  -- ========================================================================
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY item->>'ma_nhom'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate category codes (ma_nhom) found within import batch';
  END IF;

  -- ========================================================================
  -- VALIDATION: Check for duplicates against existing categories
  -- ========================================================================
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    INNER JOIN public.nhom_thiet_bi n
      ON n.ma_nhom = item->>'ma_nhom'
      AND n.don_vi_id = v_effective_donvi
  ) THEN
    -- Get the conflicting codes for error message
    DECLARE
      v_conflicts TEXT;
    BEGIN
      SELECT string_agg(item->>'ma_nhom', ', ')
      INTO v_conflicts
      FROM jsonb_array_elements(p_items) AS item
      INNER JOIN public.nhom_thiet_bi n
        ON n.ma_nhom = item->>'ma_nhom'
        AND n.don_vi_id = v_effective_donvi;

      RAISE EXCEPTION 'Category codes already exist: %', v_conflicts;
    END;
  END IF;

  -- ========================================================================
  -- CYCLE DETECTION: Check for cycles in parent references within batch
  -- ========================================================================
  -- Build adjacency list and detect cycles using recursive CTE
  WITH batch_items AS (
    SELECT
      item->>'ma_nhom' AS ma_nhom,
      item->>'parent_ma_nhom' AS parent_ma_nhom
    FROM jsonb_array_elements(p_items) AS item
    WHERE item->>'parent_ma_nhom' IS NOT NULL
      AND item->>'parent_ma_nhom' <> ''
  ),
  RECURSIVE cycle_check AS (
    -- Base: start from each item
    SELECT
      ma_nhom AS start_node,
      ma_nhom AS current_node,
      ARRAY[ma_nhom] AS path,
      false AS is_cycle
    FROM batch_items

    UNION ALL

    -- Recursive: follow parent links
    SELECT
      cc.start_node,
      bi.parent_ma_nhom,
      cc.path || bi.parent_ma_nhom,
      bi.parent_ma_nhom = ANY(cc.path) AS is_cycle
    FROM cycle_check cc
    INNER JOIN batch_items bi ON bi.ma_nhom = cc.current_node
    WHERE NOT cc.is_cycle
      AND array_length(cc.path, 1) < v_len + 1  -- Prevent infinite recursion
  )
  SELECT 1 INTO v_idx FROM cycle_check WHERE is_cycle LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Cycle detected in parent references within batch';
  END IF;

  -- ========================================================================
  -- TOPOLOGICAL SORT: Process parents before children
  -- ========================================================================
  -- Sort by depth of ma_nhom code (number of dots + 1) as proxy for hierarchy
  -- Also preserve original index for error reporting
  WITH indexed_items AS (
    SELECT
      item,
      ordinality - 1 AS original_idx,
      -- Depth based on ma_nhom structure (count dots)
      array_length(string_to_array(item->>'ma_nhom', '.'), 1) AS depth,
      -- If parent_ma_nhom references existing DB category, depth = 0
      -- If parent_ma_nhom references batch item, need to process parent first
      CASE
        WHEN item->>'parent_ma_nhom' IS NULL OR item->>'parent_ma_nhom' = '' THEN 0
        WHEN EXISTS (
          SELECT 1 FROM public.nhom_thiet_bi n
          WHERE n.ma_nhom = item->>'parent_ma_nhom'
            AND n.don_vi_id = v_effective_donvi
        ) THEN 0  -- Parent exists in DB, can process early
        ELSE 1  -- Parent is in batch, need topological order
      END AS needs_batch_parent
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item
  )
  SELECT jsonb_agg(
    jsonb_set(item, '{_original_idx}', to_jsonb(original_idx))
    ORDER BY needs_batch_parent, depth, original_idx
  )
  INTO v_sorted_items
  FROM indexed_items;

  -- ========================================================================
  -- PROCESS EACH ITEM (in topological order)
  -- ========================================================================
  FOR v_idx IN 0 .. jsonb_array_length(v_sorted_items) - 1 LOOP
    v_item := v_sorted_items->v_idx;
    v_original_idx := (v_item->>'_original_idx')::INT;
    v_ma_nhom := NULLIF(TRIM(v_item->>'ma_nhom'), '');
    v_ten_nhom := NULLIF(TRIM(v_item->>'ten_nhom'), '');
    v_parent_ma_nhom := NULLIF(TRIM(v_item->>'parent_ma_nhom'), '');
    v_phan_loai := NULLIF(TRIM(v_item->>'phan_loai'), '');
    v_don_vi_tinh := NULLIF(TRIM(v_item->>'don_vi_tinh'), '');
    v_thu_tu_hien_thi := NULLIF(v_item->>'thu_tu_hien_thi', '')::INT;
    v_mo_ta := NULLIF(TRIM(v_item->>'mo_ta'), '');

    BEGIN
      -- Validate required fields
      IF v_ma_nhom IS NULL THEN
        RAISE EXCEPTION 'Category code (ma_nhom) is required';
      END IF;

      IF v_ten_nhom IS NULL THEN
        RAISE EXCEPTION 'Category name (ten_nhom) is required';
      END IF;

      -- Validate phan_loai
      IF v_phan_loai IS NOT NULL AND v_phan_loai NOT IN ('A', 'B') THEN
        RAISE EXCEPTION 'Classification (phan_loai) must be A or B, got: %', v_phan_loai;
      END IF;

      -- Resolve parent_id from parent_ma_nhom
      v_parent_id := NULL;
      IF v_parent_ma_nhom IS NOT NULL THEN
        -- First check batch lookup (items inserted earlier in this batch)
        IF v_batch_lookup ? v_parent_ma_nhom THEN
          v_parent_id := (v_batch_lookup->>v_parent_ma_nhom)::BIGINT;
        ELSE
          -- Check existing categories in database
          SELECT id INTO v_parent_id
          FROM public.nhom_thiet_bi
          WHERE ma_nhom = v_parent_ma_nhom
            AND don_vi_id = v_effective_donvi;

          IF v_parent_id IS NULL THEN
            RAISE EXCEPTION 'Parent category not found: %', v_parent_ma_nhom;
          END IF;
        END IF;
      END IF;

      -- Insert the category
      INSERT INTO public.nhom_thiet_bi (
        don_vi_id,
        parent_id,
        ma_nhom,
        ten_nhom,
        phan_loai,
        don_vi_tinh,
        thu_tu_hien_thi,
        mo_ta,
        created_by,
        updated_by
      ) VALUES (
        v_effective_donvi,
        v_parent_id,
        v_ma_nhom,
        v_ten_nhom,
        COALESCE(v_phan_loai, 'B'),
        COALESCE(v_don_vi_tinh, 'Cái'),
        COALESCE(v_thu_tu_hien_thi, 0),
        v_mo_ta,
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_new_id;

      -- Add to batch lookup for subsequent items
      v_batch_lookup := v_batch_lookup || jsonb_build_object(v_ma_nhom, v_new_id);

      -- Record success
      v_inserted := v_inserted + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_original_idx,
        'success', true,
        'ma_nhom', v_ma_nhom,
        'id', v_new_id
      ));

    EXCEPTION WHEN OTHERS THEN
      -- Record failure
      v_failed := v_failed + 1;
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'index', v_original_idx,
        'success', false,
        'ma_nhom', COALESCE(v_ma_nhom, '(unknown)'),
        'error', COALESCE(v_err, SQLERRM)
      ));
    END;
  END LOOP;

  -- ========================================================================
  -- RETURN RESULT
  -- ========================================================================
  -- Sort details by original index for consistent output
  SELECT jsonb_agg(detail ORDER BY (detail->>'index')::int)
  INTO v_details
  FROM jsonb_array_elements(v_details) AS detail;

  RETURN jsonb_build_object(
    'success', v_failed = 0,
    'inserted', v_inserted,
    'failed', v_failed,
    'total', v_len,
    'details', COALESCE(v_details, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_bulk_import(JSONB, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_nhom_bulk_import(JSONB, BIGINT) IS
'Bulk import equipment categories from Excel.
Input: p_items = [{ma_nhom, ten_nhom, parent_ma_nhom?, phan_loai?, don_vi_tinh?, thu_tu_hien_thi?, mo_ta?}]
Features:
  - Topological sort: parents processed before children
  - Cycle detection: prevents circular parent references
  - Parent resolution: looks up parent_ma_nhom in DB and within batch
  - Per-item error recovery: one failure does not abort others
  - Advisory lock: prevents concurrent imports
Validates:
  - ma_nhom and ten_nhom required
  - phan_loai must be NULL, A, or B (per TT 08/2019)
  - No duplicate ma_nhom within batch or existing categories
  - parent_ma_nhom must exist (in DB or earlier in batch)
Returns:
  {success, inserted, failed, total, details: [{index, success, ma_nhom, id?, error?}]}
Roles: global, admin, to_qltb only.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Rollback procedure:
/*
DROP FUNCTION IF EXISTS public.dinh_muc_nhom_bulk_import(JSONB, BIGINT);
*/
