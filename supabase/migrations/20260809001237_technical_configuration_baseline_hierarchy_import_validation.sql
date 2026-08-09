-- P2A authoritative validator/normalizer for raw hierarchical import rows.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_import_validate_v2(
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target JSONB;
  v_metadata JSONB;
  v_next_criterion_number BIGINT;
  v_current_groups JSONB;
  v_current_subgroups JSONB;
  v_current_criteria JSONB;
  v_normalized_rows JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_counts JSONB;
  v_effects JSONB;
  v_row JSONB;
  v_existing JSONB;
  v_ordinality INTEGER;
  v_key_count INTEGER;
  v_physical_row INTEGER;
  v_error_count_before INTEGER;
  v_stt TEXT;
  v_content TEXT;
  v_group_id_text TEXT;
  v_subgroup_id_text TEXT;
  v_criterion_id_text TEXT;
  v_criterion_code TEXT;
  v_group_id UUID;
  v_subgroup_id UUID;
  v_criterion_id UUID;
  v_row_type TEXT;
  v_group_order INTEGER := 0;
  v_subgroup_order INTEGER := 0;
  v_criterion_order INTEGER := 0;
  v_target_group_id UUID;
  v_target_subgroup_id UUID;
  v_seen_group_ids UUID[] := ARRAY[]::UUID[];
  v_seen_subgroup_ids UUID[] := ARRAY[]::UUID[];
  v_seen_criterion_ids UUID[] := ARRAY[]::UUID[];
  v_new_criterion_count BIGINT := 0;
  v_existing_title TEXT;
  v_original_group_id UUID;
  v_original_subgroup_id UUID;
  v_original_order INTEGER;
BEGIN
  v_target := public._technical_configuration_baseline_import_validate_metadata_v2(
    p_baseline_version_id,
    p_template_metadata,
    p_expected_revision
  );
  v_metadata := v_target->'metadata';
  v_next_criterion_number := (v_target->>'next_criterion_number')::BIGINT;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'validation_error'
      USING ERRCODE = 'PT422', DETAIL = 'hierarchical rows must be an array';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'sort_order', g.sort_order
  )), '[]'::JSONB)
  INTO v_current_groups
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_baseline_version_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sg.id, 'group_id', sg.group_id, 'name', sg.name, 'sort_order', sg.sort_order
  )), '[]'::JSONB)
  INTO v_current_subgroups
  FROM public.technical_configuration_baseline_subgroups sg
  WHERE sg.baseline_version_id = p_baseline_version_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'group_id', c.group_id, 'subgroup_id', c.subgroup_id,
    'criterion_code', c.criterion_code, 'existing_title', c.title,
    'requirement_text', c.requirement_text, 'sort_order', c.sort_order
  )), '[]'::JSONB)
  INTO v_current_criteria
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id;

  FOR v_row, v_ordinality IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY
  LOOP
    v_error_count_before := jsonb_array_length(v_errors);
    v_physical_row := v_ordinality + 1;
    v_stt := NULL; v_content := NULL; v_group_id_text := NULL;
    v_subgroup_id_text := NULL; v_criterion_id_text := NULL;
    v_criterion_code := NULL; v_group_id := NULL; v_subgroup_id := NULL;
    v_criterion_id := NULL; v_existing := NULL; v_existing_title := NULL;
    v_original_group_id := NULL; v_original_subgroup_id := NULL;
    v_original_order := NULL;

    IF jsonb_typeof(v_row) <> 'object' THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'invalid_row_shape',
        'message', 'hierarchical row must be an object'
      ));
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_key_count FROM jsonb_object_keys(v_row);
    IF v_key_count <> 7
       OR NOT v_row ?& ARRAY[
         'row', 'stt', 'content', 'group_id', 'subgroup_id',
         'criterion_id', 'criterion_code'
       ]
       OR jsonb_typeof(v_row->'row') <> 'number'
       OR jsonb_typeof(v_row->'stt') NOT IN ('string', 'number', 'null')
       OR jsonb_typeof(v_row->'content') NOT IN ('string', 'null')
       OR jsonb_typeof(v_row->'group_id') NOT IN ('string', 'null')
       OR jsonb_typeof(v_row->'subgroup_id') NOT IN ('string', 'null')
       OR jsonb_typeof(v_row->'criterion_id') NOT IN ('string', 'null')
       OR jsonb_typeof(v_row->'criterion_code') NOT IN ('string', 'null') THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'invalid_row_shape',
        'message', 'hierarchical row has an invalid shape'
      ));
      CONTINUE;
    END IF;

    BEGIN
      IF (v_row->>'row') !~ '^[0-9]+$' OR (v_row->>'row')::INTEGER < 2 THEN
        RAISE EXCEPTION 'invalid physical row';
      END IF;
      v_physical_row := (v_row->>'row')::INTEGER;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_physical_row, 'code', 'invalid_row_shape', 'column', 'row',
          'message', 'row must be a physical worksheet row number'
        ));
        CONTINUE;
    END;

    v_stt := NULLIF(btrim(v_row->>'stt'), '');
    v_content := NULLIF(btrim(v_row->>'content'), '');
    v_group_id_text := NULLIF(btrim(v_row->>'group_id'), '');
    v_subgroup_id_text := NULLIF(btrim(v_row->>'subgroup_id'), '');
    v_criterion_id_text := NULLIF(btrim(v_row->>'criterion_id'), '');
    v_criterion_code := NULLIF(btrim(v_row->>'criterion_code'), '');

    IF v_stt IS NULL AND v_content IS NULL AND v_group_id_text IS NULL
       AND v_subgroup_id_text IS NULL AND v_criterion_id_text IS NULL
       AND v_criterion_code IS NULL THEN
      CONTINUE;
    END IF;

    IF v_stt IS NULL THEN
      v_row_type := 'CRITERION';
    ELSIF upper(v_stt) ~ '^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$' THEN
      v_row_type := 'GROUP';
    ELSIF v_stt ~ '^[1-9][0-9]*$' THEN
      v_row_type := 'SUBGROUP';
    ELSE
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'unsupported_marker', 'column', 'stt',
        'message', 'STT must be a Roman numeral, positive integer, or blank'
      ));
      CONTINUE;
    END IF;

    IF v_content IS NULL THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'empty_content', 'column', 'content',
        'message', 'content is required for every meaningful row'
      ));
      CONTINUE;
    END IF;

    IF v_row_type = 'GROUP' THEN
      IF v_subgroup_id_text IS NOT NULL OR v_criterion_id_text IS NOT NULL
         OR v_criterion_code IS NOT NULL THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_physical_row, 'code', 'wrong_identity_kind',
          'message', 'group rows may carry only group_id'
        ));
      END IF;
      IF v_group_id_text IS NOT NULL THEN
        BEGIN
          v_group_id := v_group_id_text::UUID;
          SELECT value INTO v_existing
          FROM jsonb_array_elements(v_current_groups)
          WHERE value->>'id' = v_group_id::TEXT;
          IF v_existing IS NULL THEN RAISE EXCEPTION 'foreign'; END IF;
          IF v_group_id = ANY(v_seen_group_ids) THEN
            v_errors := v_errors || jsonb_build_array(jsonb_build_object(
              'row', v_physical_row, 'code', 'duplicate_identity', 'column', 'group_id',
              'message', 'group_id appears more than once'
            ));
          END IF;
        EXCEPTION WHEN invalid_text_representation OR raise_exception THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_physical_row, 'code', 'foreign_identity', 'column', 'group_id',
            'message', 'group_id does not belong to the target baseline'
          ));
        END;
      END IF;
      IF jsonb_array_length(v_errors) > v_error_count_before THEN CONTINUE; END IF;
      v_group_order := v_group_order + 1;
      v_subgroup_order := 0; v_criterion_order := 0;
      v_target_group_id := v_group_id; v_target_subgroup_id := NULL;
      IF v_group_id IS NOT NULL THEN
        v_seen_group_ids := array_append(v_seen_group_ids, v_group_id);
      END IF;
      v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'row_type', 'GROUP',
        'group_id', v_group_id, 'group_name', v_content,
        'original_group_order', (v_existing->>'sort_order')::INTEGER,
        'target_group_order', v_group_order,
        'identity_fallback', v_group_id IS NULL
      ));
      CONTINUE;
    END IF;

    IF v_target_group_id IS NULL AND v_group_order = 0 THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row,
        'code', CASE WHEN v_row_type = 'SUBGROUP'
          THEN 'subgroup_without_section' ELSE 'content_before_section' END,
        'message', 'meaningful content must follow a main section'
      ));
      CONTINUE;
    END IF;

    IF v_row_type = 'SUBGROUP' THEN
      IF v_group_id_text IS NOT NULL OR v_criterion_id_text IS NOT NULL
         OR v_criterion_code IS NOT NULL THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_physical_row, 'code', 'wrong_identity_kind',
          'message', 'subgroup rows may carry only subgroup_id'
        ));
      END IF;
      IF v_subgroup_id_text IS NOT NULL THEN
        BEGIN
          v_subgroup_id := v_subgroup_id_text::UUID;
          SELECT value INTO v_existing
          FROM jsonb_array_elements(v_current_subgroups)
          WHERE value->>'id' = v_subgroup_id::TEXT;
          IF v_existing IS NULL THEN RAISE EXCEPTION 'foreign'; END IF;
          IF v_subgroup_id = ANY(v_seen_subgroup_ids) THEN
            v_errors := v_errors || jsonb_build_array(jsonb_build_object(
              'row', v_physical_row, 'code', 'duplicate_identity',
              'column', 'subgroup_id', 'message', 'subgroup_id appears more than once'
            ));
          END IF;
        EXCEPTION WHEN invalid_text_representation OR raise_exception THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_physical_row, 'code', 'foreign_identity', 'column', 'subgroup_id',
            'message', 'subgroup_id does not belong to the target baseline'
          ));
        END;
      END IF;
      IF jsonb_array_length(v_errors) > v_error_count_before THEN CONTINUE; END IF;
      v_subgroup_order := v_subgroup_order + 1;
      v_target_subgroup_id := v_subgroup_id;
      IF v_subgroup_id IS NOT NULL THEN
        v_seen_subgroup_ids := array_append(v_seen_subgroup_ids, v_subgroup_id);
      END IF;
      v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'row_type', 'SUBGROUP',
        'subgroup_id', v_subgroup_id, 'subgroup_name', v_content,
        'original_group_id', v_existing->>'group_id',
        'original_subgroup_order', (v_existing->>'sort_order')::INTEGER,
        'target_group_id', v_target_group_id,
        'target_group_order', v_group_order,
        'target_subgroup_order', v_subgroup_order,
        'identity_fallback', v_subgroup_id IS NULL
      ));
      CONTINUE;
    END IF;

    IF v_group_id_text IS NOT NULL OR v_subgroup_id_text IS NOT NULL THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'wrong_identity_kind',
        'message', 'criterion rows may carry only criterion_id and criterion_code'
      ));
    END IF;
    IF (v_criterion_id_text IS NULL) <> (v_criterion_code IS NULL) THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_physical_row, 'code', 'partial_identity',
        'message', 'criterion_id and criterion_code must be both present or both absent'
      ));
    ELSIF v_criterion_id_text IS NOT NULL THEN
      BEGIN
        v_criterion_id := v_criterion_id_text::UUID;
        SELECT value INTO v_existing
        FROM jsonb_array_elements(v_current_criteria)
        WHERE value->>'id' = v_criterion_id::TEXT;
        IF v_existing IS NULL THEN RAISE EXCEPTION 'foreign'; END IF;
        IF v_existing->>'criterion_code' <> v_criterion_code THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_physical_row, 'code', 'changed_criterion_code',
            'column', 'criterion_code', 'message', 'criterion_code does not match identity'
          ));
        END IF;
        IF v_criterion_id = ANY(v_seen_criterion_ids) THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_physical_row, 'code', 'duplicate_identity', 'column', 'criterion_id',
            'message', 'criterion_id appears more than once'
          ));
        END IF;
      EXCEPTION WHEN invalid_text_representation OR raise_exception THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_physical_row, 'code', 'foreign_identity', 'column', 'criterion_id',
          'message', 'criterion_id does not belong to the target baseline'
        ));
      END;
    END IF;
    IF jsonb_array_length(v_errors) > v_error_count_before THEN CONTINUE; END IF;

    v_criterion_order := v_criterion_order + 1;
    IF v_criterion_id IS NULL THEN
      v_criterion_code := 'TC-' || lpad(
        (v_next_criterion_number + v_new_criterion_count)::TEXT,
        GREATEST(4, length((v_next_criterion_number + v_new_criterion_count)::TEXT)),
        '0'
      );
      v_new_criterion_count := v_new_criterion_count + 1;
    ELSE
      v_seen_criterion_ids := array_append(v_seen_criterion_ids, v_criterion_id);
      v_existing_title := v_existing->>'existing_title';
      v_original_group_id := (v_existing->>'group_id')::UUID;
      v_original_subgroup_id := NULLIF(v_existing->>'subgroup_id', '')::UUID;
      v_original_order := (v_existing->>'sort_order')::INTEGER;
    END IF;
    v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
      'row', v_physical_row, 'row_type', 'CRITERION',
      'criterion_id', v_criterion_id, 'criterion_code', v_criterion_code,
      'existing_title', v_existing_title, 'requirement_text', v_content,
      'original_group_id', v_original_group_id,
      'original_subgroup_id', v_original_subgroup_id,
      'original_criterion_order', v_original_order,
      'target_group_id', v_target_group_id,
      'target_subgroup_id', v_target_subgroup_id,
      'target_group_order', v_group_order,
      'target_subgroup_order', NULLIF(v_subgroup_order, 0),
      'target_criterion_order', v_criterion_order,
      'identity_fallback', v_criterion_id IS NULL
    ));
  END LOOP;

  WITH rows AS (
    SELECT value AS row FROM jsonb_array_elements(v_normalized_rows)
  )
  SELECT jsonb_build_object(
    'groups', count(*) FILTER (WHERE row->>'row_type' = 'GROUP'),
    'subgroups', count(*) FILTER (WHERE row->>'row_type' = 'SUBGROUP'),
    'criteria', count(*) FILTER (WHERE row->>'row_type' = 'CRITERION')
  ) INTO v_counts
  FROM rows;

  IF jsonb_array_length(v_errors) = 0 THEN
    WITH
    rows AS (SELECT value AS row FROM jsonb_array_elements(v_normalized_rows)),
    groups AS (SELECT row FROM rows WHERE row->>'row_type' = 'GROUP'),
    subgroups AS (SELECT row FROM rows WHERE row->>'row_type' = 'SUBGROUP'),
    criteria AS (SELECT row FROM rows WHERE row->>'row_type' = 'CRITERION')
    SELECT jsonb_build_object(
    'groups', jsonb_build_object(
      'create', (SELECT count(*) FROM groups WHERE row->>'group_id' IS NULL),
      'update', (SELECT count(*) FROM groups WHERE row->>'group_id' IS NOT NULL
        AND row->>'group_name' IS DISTINCT FROM (
          SELECT value->>'name' FROM jsonb_array_elements(v_current_groups)
          WHERE value->>'id' = groups.row->>'group_id')),
      'move', (SELECT count(*) FROM groups WHERE row->>'group_id' IS NOT NULL
        AND (row->>'original_group_order')::INTEGER
          IS DISTINCT FROM (row->>'target_group_order')::INTEGER),
      'delete', (SELECT count(*) FROM jsonb_array_elements(v_current_groups) current_row
        WHERE NOT EXISTS (SELECT 1 FROM groups
          WHERE groups.row->>'group_id' = current_row->>'id'))
    ),
    'subgroups', jsonb_build_object(
      'create', (SELECT count(*) FROM subgroups WHERE row->>'subgroup_id' IS NULL),
      'update', (SELECT count(*) FROM subgroups WHERE row->>'subgroup_id' IS NOT NULL
        AND row->>'subgroup_name' IS DISTINCT FROM (
          SELECT value->>'name' FROM jsonb_array_elements(v_current_subgroups)
          WHERE value->>'id' = subgroups.row->>'subgroup_id')),
      'move', (SELECT count(*) FROM subgroups WHERE row->>'subgroup_id' IS NOT NULL
        AND ((row->>'original_group_id')::UUID
          IS DISTINCT FROM NULLIF(row->>'target_group_id', '')::UUID
          OR (row->>'original_subgroup_order')::INTEGER
          IS DISTINCT FROM (row->>'target_subgroup_order')::INTEGER)),
      'delete', (SELECT count(*) FROM jsonb_array_elements(v_current_subgroups) current_row
        WHERE NOT EXISTS (SELECT 1 FROM subgroups
          WHERE subgroups.row->>'subgroup_id' = current_row->>'id'))
    ),
    'criteria', jsonb_build_object(
      'create', (SELECT count(*) FROM criteria WHERE row->>'criterion_id' IS NULL),
      'update', (SELECT count(*) FROM criteria WHERE row->>'criterion_id' IS NOT NULL
        AND row->>'requirement_text' IS DISTINCT FROM (
          SELECT value->>'requirement_text' FROM jsonb_array_elements(v_current_criteria)
          WHERE value->>'id' = criteria.row->>'criterion_id')),
      'move', (SELECT count(*) FROM criteria WHERE row->>'criterion_id' IS NOT NULL
        AND ((row->>'original_group_id')::UUID
          IS DISTINCT FROM NULLIF(row->>'target_group_id', '')::UUID
          OR NULLIF(row->>'original_subgroup_id', '')::UUID
          IS DISTINCT FROM NULLIF(row->>'target_subgroup_id', '')::UUID
          OR (row->>'original_criterion_order')::INTEGER
          IS DISTINCT FROM (row->>'target_criterion_order')::INTEGER)),
      'delete', (SELECT count(*) FROM jsonb_array_elements(v_current_criteria) current_row
        WHERE NOT EXISTS (SELECT 1 FROM criteria
          WHERE criteria.row->>'criterion_id' = current_row->>'id'))
    )
    ) INTO v_effects;
  END IF;

  RETURN jsonb_build_object(
    'metadata', v_metadata,
    'normalized_rows', v_normalized_rows,
    'row_errors', v_errors,
    'counts', v_counts,
    'effects', v_effects
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_validate_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
