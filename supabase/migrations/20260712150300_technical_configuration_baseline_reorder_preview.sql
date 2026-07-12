-- Issue #744, Phase P2: criterion reorder and bulk-preview RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_criteria_reorder(
  p_group_id UUID,
  p_criterion_ids UUID[],
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_version_id UUID;
  v_existing_count BIGINT;
  v_input_count BIGINT;
  v_distinct_count BIGINT;
  v_matching_count BIGINT;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_groups
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  IF p_criterion_ids IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id;
  SELECT COUNT(*), COUNT(DISTINCT item_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(p_criterion_ids) AS input(item_id);
  SELECT COUNT(*) INTO v_matching_count
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id AND id = ANY(p_criterion_ids);

  IF cardinality(p_criterion_ids) <> v_existing_count
     OR v_input_count <> v_distinct_count
     OR v_matching_count <> v_existing_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED;
  UPDATE public.technical_configuration_baseline_criteria c
  SET sort_order = input.new_order::INTEGER,
      updated_at = now(),
      updated_by = v_user_id
  FROM unnest(p_criterion_ids) WITH ORDINALITY AS input(id, new_order)
  WHERE c.id = input.id;

  UPDATE public.technical_configuration_baseline_versions
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_version_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_version_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_bulk_preview(
  p_group_id UUID,
  p_items JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version_id UUID;
  v_next_number BIGINT;
  v_next_order INTEGER;
  v_data JSONB;
  v_errors JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_groups
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  PERFORM public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT next_criterion_number INTO v_next_number
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM public.technical_configuration_baseline_criteria
  WHERE group_id = p_group_id;

  WITH items AS (
    SELECT value, ordinality
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  ),
  normalized AS (
    SELECT
      value,
      ordinality,
      value->>'title' AS title,
      value->>'requirement_text' AS requirement_text,
      jsonb_typeof(value) = 'object' AS is_object,
      NOT EXISTS (
        SELECT 1
        FROM jsonb_object_keys(
          CASE WHEN jsonb_typeof(value) = 'object' THEN value ELSE '{}'::JSONB END
        ) AS item_key(key)
        WHERE key NOT IN ('title', 'requirement_text')
      ) AS has_only_supported_fields,
      COALESCE(
        jsonb_typeof(value->'requirement_text') = 'string'
          AND btrim(value->>'requirement_text') <> '',
        FALSE
      ) AS has_valid_requirement,
      NOT (value ? 'title')
        OR value->'title' = 'null'::JSONB
        OR jsonb_typeof(value->'title') = 'string' AS has_valid_title
    FROM items
  ),
  validated AS (
    SELECT
      *,
      is_object
        AND has_only_supported_fields
        AND has_valid_requirement
        AND has_valid_title AS is_valid,
      CASE
        WHEN NOT is_object THEN 'item must be an object'
        WHEN NOT has_only_supported_fields THEN 'unsupported field'
        WHEN NOT has_valid_requirement THEN 'requirement_text must be a non-empty string'
        WHEN NOT has_valid_title THEN 'title must be a string or null'
      END AS error_message
    FROM normalized
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'criterion_code', 'TC-' || lpad((v_next_number + ordinality - 1)::TEXT, 4, '0'),
      'title', NULLIF(btrim(title), ''),
      'requirement_text', btrim(requirement_text),
      'sort_order', v_next_order + ordinality - 1
    ) ORDER BY ordinality) FILTER (WHERE is_valid), '[]'::JSONB),
    COALESCE(jsonb_agg(jsonb_build_object(
      'row', ordinality,
      'code', 'validation_error',
      'message', error_message
    ) ORDER BY ordinality) FILTER (WHERE NOT is_valid), '[]'::JSONB)
  INTO v_data, v_errors
  FROM validated;

  RETURN jsonb_build_object('data', v_data, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_criteria_reorder(UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_criteria_reorder(UUID, UUID[], BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_bulk_preview(UUID, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_bulk_preview(UUID, JSONB, BIGINT) TO authenticated;

COMMIT;
