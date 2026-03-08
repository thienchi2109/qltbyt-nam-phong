-- Migration: add batch link RPC for suggested mapping save
-- Purpose: race-safe write-path that saves multiple 1-category→many-devices
--   groups in one transaction. Used exclusively by the suggested mapping flow.
-- Security: SECURITY DEFINER + JWT guards + tenant isolation per REVIEW.md
-- Roles: global, admin, to_qltb only; regional_leader explicitly rejected

BEGIN;

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link_batch(
  p_mappings JSONB,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';

  v_mapping JSONB;
  v_nhom_id BIGINT;
  v_group_device_ids BIGINT[];
  v_category_don_vi BIGINT;

  v_valid_ids BIGINT[];
  v_group_affected INT;
  v_group_skipped_assigned INT;
  v_group_skipped_not_found INT;

  v_total_affected INT := 0;
  v_total_skipped_assigned INT := 0;
  v_total_skipped_not_found INT := 0;
  v_groups_detail JSONB := '[]'::JSONB;

  v_duplicate_ids BIGINT[];
BEGIN
  -- ================================================================
  -- 1. JWT claim guards (all three mandatory per REVIEW.md)
  -- ================================================================
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  -- ================================================================
  -- 2. Role enforcement: write roles only
  -- ================================================================
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Insufficient permissions: regional_leader cannot save mappings'
      USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb role.'
      USING errcode = '42501';
  END IF;

  -- ================================================================
  -- 3. Tenant isolation
  -- ================================================================
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID (p_don_vi) is required.' USING errcode = '42501';
  END IF;

  -- ================================================================
  -- 4. Validate payload shape
  -- ================================================================
  IF p_mappings IS NULL OR jsonb_typeof(p_mappings) != 'array'
     OR jsonb_array_length(p_mappings) = 0 THEN
    RAISE EXCEPTION 'p_mappings must be a non-empty JSON array.';
  END IF;

  -- ================================================================
  -- 5. Validate no duplicate device_id across groups
  -- ================================================================
  SELECT ARRAY_AGG(did) INTO v_duplicate_ids
  FROM (
    SELECT (elem.val)::TEXT::BIGINT AS did
    FROM jsonb_array_elements(p_mappings) AS m,
         LATERAL jsonb_array_elements(m->'thiet_bi_ids') AS elem(val)
    GROUP BY (elem.val)::TEXT
    HAVING COUNT(*) > 1
  ) dups(did);

  IF v_duplicate_ids IS NOT NULL AND array_length(v_duplicate_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Duplicate device_id(s) found across groups: %', v_duplicate_ids;
  END IF;

  -- ================================================================
  -- 6. Process each mapping group
  -- ================================================================
  FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_mappings)
  LOOP
    v_nhom_id := (v_mapping->>'nhom_id')::BIGINT;

    -- Parse thiet_bi_ids from JSONB array to BIGINT[]
    SELECT ARRAY_AGG(val::TEXT::BIGINT)
    INTO v_group_device_ids
    FROM jsonb_array_elements(v_mapping->'thiet_bi_ids') AS val;

    IF v_nhom_id IS NULL THEN
      RAISE EXCEPTION 'Each mapping must have a nhom_id.';
    END IF;

    IF v_group_device_ids IS NULL OR array_length(v_group_device_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'Each mapping must have a non-empty thiet_bi_ids array.';
    END IF;

    -- 6a. Verify category belongs to same tenant
    SELECT don_vi_id INTO v_category_don_vi
    FROM public.nhom_thiet_bi
    WHERE id = v_nhom_id;

    IF v_category_don_vi IS NULL THEN
      RAISE EXCEPTION 'Category not found (ID: %).', v_nhom_id;
    END IF;

    IF v_category_don_vi != p_don_vi THEN
      RAISE EXCEPTION 'Category (ID: %) belongs to different tenant.', v_nhom_id;
    END IF;

    -- 6b. Lock and select only still-unassigned devices in this tenant
    SELECT ARRAY_AGG(tb.id) INTO v_valid_ids
    FROM public.thiet_bi tb
    WHERE tb.id = ANY(v_group_device_ids)
      AND tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NULL
    FOR UPDATE SKIP LOCKED;

    v_group_affected := COALESCE(array_length(v_valid_ids, 1), 0);

    -- Classify all requested IDs that were NOT selected for update.
    -- This counts rows existing in tenant with nhom_thiet_bi_id set,
    -- which covers both truly-assigned and locked-but-unassigned rows
    -- (locked rows are invisible to FOR UPDATE SKIP LOCKED but visible
    -- to this plain SELECT). The remainder is genuinely not found.
    SELECT COUNT(*)::INT INTO v_group_skipped_assigned
    FROM public.thiet_bi tb
    WHERE tb.id = ANY(v_group_device_ids)
      AND tb.don_vi = p_don_vi
      AND (
        tb.nhom_thiet_bi_id IS NOT NULL
        OR NOT (tb.id = ANY(COALESCE(v_valid_ids, '{}'::BIGINT[])))
      );

    -- Remainder = IDs not found in this tenant at all
    v_group_skipped_not_found := array_length(v_group_device_ids, 1)
      - v_group_affected
      - v_group_skipped_assigned;

    -- 6c. Update valid devices
    IF v_group_affected > 0 THEN
      UPDATE public.thiet_bi
      SET nhom_thiet_bi_id = v_nhom_id
      WHERE id = ANY(v_valid_ids);

      -- 6d. Audit log per group
      INSERT INTO public.thiet_bi_nhom_audit_log (
        don_vi_id, thiet_bi_ids, nhom_thiet_bi_id,
        action, performed_by, performed_at, metadata
      ) VALUES (
        p_don_vi, v_valid_ids, v_nhom_id,
        'link_batch', NULLIF(v_user_id, '')::BIGINT, NOW(),
        jsonb_build_object(
          'source', 'suggested_mapping',
          'requested_ids', to_jsonb(v_group_device_ids),
          'linked_ids', to_jsonb(v_valid_ids)
        )
      );
    END IF;

    -- Accumulate totals
    v_total_affected := v_total_affected + v_group_affected;
    v_total_skipped_assigned := v_total_skipped_assigned + v_group_skipped_assigned;
    v_total_skipped_not_found := v_total_skipped_not_found + v_group_skipped_not_found;

    v_groups_detail := v_groups_detail || jsonb_build_object(
      'nhom_id', v_nhom_id,
      'affected', v_group_affected,
      'skipped', (array_length(v_group_device_ids, 1) - v_group_affected)
    );
  END LOOP;

  -- ================================================================
  -- 7. Return summary
  -- ================================================================
  RETURN jsonb_build_object(
    'affected_count', v_total_affected,
    'skipped_already_assigned', v_total_skipped_assigned,
    'skipped_not_found', v_total_skipped_not_found,
    'groups', v_groups_detail
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_link_batch(JSONB, BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_link_batch(JSONB, BIGINT) FROM PUBLIC;

COMMIT;
