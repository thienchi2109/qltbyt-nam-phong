-- P5C: shared authoritative baseline import validator/normalizer.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_import_validate(
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target JSONB;
  v_next_criterion_number BIGINT;
  v_metadata JSONB;
  v_existing_criterion_codes TEXT[] := ARRAY[]::TEXT[];
  v_normalized_rows JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_row JSONB;
  v_row_number INTEGER;
  v_key_count INTEGER;
  v_row_type TEXT;
  v_group_order INTEGER;
  v_group_name TEXT;
  v_criterion_order INTEGER;
  v_criterion_code TEXT;
  v_criterion_title TEXT;
  v_requirement_text TEXT;
  v_expected_group_order INTEGER := 1;
  v_expected_criterion_order INTEGER := 1;
  v_current_group_order INTEGER;
  v_seen_criterion_codes TEXT[] := ARRAY[]::TEXT[];
  v_new_criterion_count BIGINT := 0;
  v_allocated_criterion_number BIGINT;
  v_error_count_before INTEGER;
BEGIN
  v_target := public._technical_configuration_baseline_import_validate_metadata(
    p_baseline_version_id,
    p_template_metadata,
    p_expected_revision
  );
  v_metadata := v_target->'metadata';
  v_next_criterion_number := (v_target->>'next_criterion_number')::BIGINT;
  SELECT COALESCE(array_agg(c.criterion_code), ARRAY[]::TEXT[])
  INTO v_existing_criterion_codes
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'validation_error'
      USING ERRCODE = 'PT422', DETAIL = 'canonical rows must be an array';
  END IF;

  FOR v_row, v_row_number IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY
  LOOP
    v_error_count_before := jsonb_array_length(v_errors);
    v_group_order := NULL;
    v_group_name := NULL;
    v_criterion_order := NULL;
    v_criterion_code := NULL;
    v_criterion_title := NULL;
    v_requirement_text := NULL;

    IF jsonb_typeof(v_row) <> 'object' THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number,
        'code', 'invalid_row_shape',
        'message', 'canonical row must be an object'
      ));
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_key_count FROM jsonb_object_keys(v_row);
    IF v_key_count <> 7
       OR NOT v_row ?& ARRAY[
         'row_type',
         'group_order',
         'group_name',
         'criterion_order',
         'criterion_code',
         'criterion_title',
         'requirement_text'
       ] THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row_number,
        'code', 'invalid_row_shape',
        'message', 'canonical row has unsupported or missing fields'
      ));
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_row->'row_type') = 'string' THEN
      v_row_type := btrim(v_row->>'row_type');
    ELSE
      v_row_type := NULL;
    END IF;

    IF jsonb_typeof(v_row->'group_order') = 'number'
       AND v_row->>'group_order' ~ '^[0-9]+$' THEN
      BEGIN
        v_group_order := (v_row->>'group_order')::INTEGER;
      EXCEPTION
        WHEN numeric_value_out_of_range THEN
          v_group_order := NULL;
      END;
    END IF;

    IF v_row_type = 'GROUP' THEN
      IF jsonb_typeof(v_row->'group_name') = 'string' THEN
        v_group_name := btrim(
          replace(replace(v_row->>'group_name', E'\r\n', E'\n'), E'\r', E'\n'),
          E' \t\n\r\f\v' || U&'\200B\2060'
        );
      END IF;

      IF v_group_order IS NULL
         OR v_group_order <= 0
         OR v_group_order <> v_expected_group_order THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_group_order',
          'column', 'group_order',
          'message', 'group_order must be positive, unique, and contiguous'
        ));
      END IF;
      IF COALESCE(v_group_name, '') = '' THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'required_text',
          'column', 'group_name',
          'message', 'group_name is required'
        ));
      END IF;
      IF v_row->'criterion_order' <> 'null'::JSONB
         OR v_row->'criterion_code' <> 'null'::JSONB
         OR v_row->'criterion_title' <> 'null'::JSONB
         OR v_row->'requirement_text' <> 'null'::JSONB THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_row_shape',
          'message', 'GROUP rows cannot contain criterion fields'
        ));
      END IF;

      IF v_group_order IS NOT NULL AND v_group_order > 0 THEN
        v_current_group_order := v_group_order;
      ELSE
        v_current_group_order := NULL;
      END IF;
      v_expected_group_order := v_expected_group_order + 1;
      v_expected_criterion_order := 1;

      IF jsonb_array_length(v_errors) = v_error_count_before THEN
        v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
          'row_type', 'GROUP',
          'group_order', v_group_order,
          'group_name', v_group_name,
          'criterion_order', NULL,
          'criterion_code', NULL,
          'criterion_title', NULL,
          'requirement_text', NULL
        ));
      END IF;
      CONTINUE;
    END IF;

    IF v_row_type = 'CRITERION' THEN
      IF jsonb_typeof(v_row->'criterion_order') = 'number'
         AND v_row->>'criterion_order' ~ '^[0-9]+$' THEN
        BEGIN
          v_criterion_order := (v_row->>'criterion_order')::INTEGER;
        EXCEPTION
          WHEN numeric_value_out_of_range THEN
            v_criterion_order := NULL;
        END;
      END IF;
      IF v_row->'criterion_code' <> 'null'::JSONB
         AND jsonb_typeof(v_row->'criterion_code') = 'string' THEN
        v_criterion_code := NULLIF(btrim(v_row->>'criterion_code'), '');
      ELSIF v_row->'criterion_code' <> 'null'::JSONB THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_row_shape',
          'column', 'criterion_code',
          'message', 'criterion_code must be a string or null'
        ));
      END IF;
      IF v_row->'criterion_title' = 'null'::JSONB THEN
        v_criterion_title := NULL;
      ELSIF jsonb_typeof(v_row->'criterion_title') = 'string' THEN
        v_criterion_title := NULLIF(btrim(
          replace(replace(v_row->>'criterion_title', E'\r\n', E'\n'), E'\r', E'\n'),
          E' \t\n\r\f\v' || U&'\200B\2060'
        ), '');
      ELSE
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_row_shape',
          'column', 'criterion_title',
          'message', 'criterion_title must be a string or null'
        ));
      END IF;
      IF jsonb_typeof(v_row->'requirement_text') = 'string' THEN
        v_requirement_text := btrim(
          replace(replace(v_row->>'requirement_text', E'\r\n', E'\n'), E'\r', E'\n'),
          E' \t\n\r\f\v' || U&'\200B\2060'
        );
      END IF;

      IF v_current_group_order IS NULL
         OR v_group_order IS DISTINCT FROM v_current_group_order THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_group_order',
          'column', 'group_order',
          'message', 'CRITERION row must belong to the preceding GROUP'
        ));
      END IF;
      IF v_criterion_order IS NULL
         OR v_criterion_order <= 0
         OR v_criterion_order <> v_expected_criterion_order THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_criterion_order',
          'column', 'criterion_order',
          'message', 'criterion_order must be positive, unique, and contiguous'
        ));
      END IF;
      IF v_row->'group_name' <> 'null'::JSONB THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'invalid_row_shape',
          'column', 'group_name',
          'message', 'CRITERION rows cannot repeat group_name'
        ));
      END IF;
      IF COALESCE(v_requirement_text, '') = '' THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'required_text',
          'column', 'requirement_text',
          'message', 'requirement_text is required'
        ));
      END IF;

      IF v_criterion_code IS NOT NULL THEN
        IF v_criterion_code !~ '^TC-[0-9]{4,}$' THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'code', 'invalid_criterion_code',
            'column', 'criterion_code',
            'message', 'criterion_code must match TC-0001 or be null'
          ));
        ELSIF v_criterion_code = ANY(v_seen_criterion_codes) THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'code', 'duplicate_criterion_code',
            'column', 'criterion_code',
            'message', 'criterion_code is duplicated'
          ));
        ELSIF NOT (v_criterion_code = ANY(v_existing_criterion_codes)) THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'code', 'changed_criterion_code',
            'column', 'criterion_code',
            'message', 'criterion_code does not belong to the target version'
          ));
        END IF;
        v_seen_criterion_codes := array_append(v_seen_criterion_codes, v_criterion_code);
      ELSIF jsonb_array_length(v_errors) = v_error_count_before THEN
        v_allocated_criterion_number := v_next_criterion_number + v_new_criterion_count;
        v_criterion_code := 'TC-' || lpad(
          v_allocated_criterion_number::TEXT,
          GREATEST(4, length(v_allocated_criterion_number::TEXT)),
          '0'
        );
        IF v_criterion_code = ANY(v_existing_criterion_codes) THEN
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'code', 'duplicate_criterion_code',
            'column', 'criterion_code',
            'message', 'allocated criterion_code already exists'
          ));
        ELSE
          v_new_criterion_count := v_new_criterion_count + 1;
          v_seen_criterion_codes := array_append(v_seen_criterion_codes, v_criterion_code);
        END IF;
      END IF;

      v_expected_criterion_order := v_expected_criterion_order + 1;
      IF jsonb_array_length(v_errors) = v_error_count_before THEN
        v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
          'row_type', 'CRITERION',
          'group_order', v_group_order,
          'group_name', NULL,
          'criterion_order', v_criterion_order,
          'criterion_code', v_criterion_code,
          'criterion_title', v_criterion_title,
          'requirement_text', v_requirement_text
        ));
      END IF;
      CONTINUE;
    END IF;

    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'row', v_row_number,
      'code', 'invalid_row_type',
      'column', 'row_type',
      'message', 'row_type must be GROUP or CRITERION'
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'metadata', v_metadata,
    'rows', v_normalized_rows,
    'row_errors', v_errors,
    'new_criterion_count', v_new_criterion_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_validate(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_baseline_import_validate(UUID, JSONB, JSONB, BIGINT) TO service_role;

COMMIT;
