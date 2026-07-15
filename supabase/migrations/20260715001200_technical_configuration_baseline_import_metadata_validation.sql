-- P5C: target-bound workbook metadata validation for baseline import.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_import_validate_metadata(
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_revision BIGINT;
  v_next_criterion_number BIGINT;
  v_key_count INTEGER;
BEGIN
  SELECT v.dossier_id, v.revision, v.next_criterion_number
  INTO v_dossier_id, v_revision, v_next_criterion_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF p_template_metadata IS NULL
     OR jsonb_typeof(p_template_metadata) <> 'object' THEN
    RAISE EXCEPTION 'template_mismatch'
      USING ERRCODE = 'PT422', DETAIL = 'template metadata must be an object';
  END IF;
  SELECT count(*) INTO v_key_count FROM jsonb_object_keys(p_template_metadata);
  IF v_key_count <> 6
     OR NOT p_template_metadata ?& ARRAY[
       'template_kind',
       'template_version',
       'dossier_id',
       'baseline_version_id',
       'baseline_revision',
       'generated_at'
     ]
     OR jsonb_typeof(p_template_metadata->'template_kind') <> 'string'
     OR jsonb_typeof(p_template_metadata->'template_version') <> 'number'
     OR jsonb_typeof(p_template_metadata->'dossier_id') <> 'string'
     OR jsonb_typeof(p_template_metadata->'baseline_version_id') <> 'string'
     OR jsonb_typeof(p_template_metadata->'baseline_revision') <> 'number'
     OR jsonb_typeof(p_template_metadata->'generated_at') <> 'string' THEN
    RAISE EXCEPTION 'template_mismatch'
      USING ERRCODE = 'PT422', DETAIL = 'template metadata has an invalid shape';
  END IF;

  BEGIN
    PERFORM (p_template_metadata->>'generated_at')::TIMESTAMPTZ;
    IF p_template_metadata->>'template_kind' <> 'technical_configuration_baseline'
       OR p_template_metadata->>'template_version' <> '1'
       OR (p_template_metadata->>'dossier_id')::UUID IS DISTINCT FROM v_dossier_id
       OR (p_template_metadata->>'baseline_version_id')::UUID
         IS DISTINCT FROM p_baseline_version_id
       OR (p_template_metadata->>'baseline_revision')::BIGINT
         IS DISTINCT FROM p_expected_revision
       OR v_revision IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION 'template_mismatch'
        USING ERRCODE = 'PT422', DETAIL = 'template metadata does not match the target';
    END IF;
  EXCEPTION
    WHEN invalid_text_representation
      OR invalid_datetime_format
      OR datetime_field_overflow
      OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'template_mismatch'
        USING ERRCODE = 'PT422', DETAIL = 'template metadata contains invalid values';
  END;

  RETURN jsonb_build_object(
    'metadata', jsonb_build_object(
      'template_kind', 'technical_configuration_baseline',
      'template_version', 1,
      'dossier_id', v_dossier_id,
      'baseline_version_id', p_baseline_version_id,
      'baseline_revision', v_revision,
      'generated_at', p_template_metadata->>'generated_at'
    ),
    'next_criterion_number', v_next_criterion_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_validate_metadata(UUID, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_baseline_import_validate_metadata(UUID, JSONB, BIGINT) TO service_role;

COMMIT;
