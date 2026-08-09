-- P2A authenticated read-only preview for hierarchical baseline import.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_preview_v2(
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
  v_validation JSONB;
BEGIN
  v_validation := public._technical_configuration_baseline_import_validate_v2(
    p_baseline_version_id,
    p_template_metadata,
    p_rows,
    p_expected_revision
  );

  RETURN jsonb_build_object(
    'data', jsonb_build_object(
      'metadata', v_validation->'metadata',
      'rows', v_validation->'normalized_rows',
      'counts', v_validation->'counts',
      'effects', v_validation->'effects'
    ),
    'errors', v_validation->'row_errors'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_import_preview_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_import_preview_v2(UUID, JSONB, JSONB, BIGINT) TO authenticated;

COMMIT;
