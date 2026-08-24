-- OpenSpec add-technical-configuration-expert-role, Phase 11:
-- add one canonical module guard while preserving every existing role decision.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_require_authorized_user()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_role TEXT;
  v_user_id BIGINT;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_role := lower(
      COALESCE(
        NULLIF(v_claims->>'app_role', ''),
        NULLIF(v_claims->>'role', '')
      )
    );
    v_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL
     OR v_user_id IS NULL
     OR NOT (v_role IN ('global', 'admin', 'chuyen_gia'))
     OR NOT EXISTS (
       SELECT 1
       FROM public.nhan_vien nv
       WHERE nv.id = v_user_id
     ) THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._technical_configuration_require_authorized_user()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._technical_configuration_require_authorized_user()
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._technical_configuration_require_authorized_user()
  TO service_role;

CREATE OR REPLACE FUNCTION public._technical_configuration_require_global_user()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public._technical_configuration_require_authorized_user();
END;
$$;

REVOKE EXECUTE ON FUNCTION public._technical_configuration_require_global_user()
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._technical_configuration_require_global_user()
  FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_import_validate_metadata_v2(
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_revision BIGINT;
  v_next_criterion_number BIGINT;
  v_status TEXT;
  v_archived_at TIMESTAMPTZ;
  v_key_count INTEGER;
BEGIN
  PERFORM public._technical_configuration_require_authorized_user();

  SELECT
    v.dossier_id,
    v.revision,
    v.next_criterion_number,
    v.status,
    d.archived_at
  INTO
    v_dossier_id,
    v_revision,
    v_next_criterion_number,
    v_status,
    v_archived_at
  FROM public.technical_configuration_baseline_versions v
  JOIN public.technical_configuration_dossiers d ON d.id = v.dossier_id
  WHERE v.id = p_baseline_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'locked_version' USING ERRCODE = 'PT409';
  END IF;
  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
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
       OR p_template_metadata->>'template_version' <> '2'
       OR (p_template_metadata->>'dossier_id')::UUID IS DISTINCT FROM v_dossier_id
       OR (p_template_metadata->>'baseline_version_id')::UUID
         IS DISTINCT FROM p_baseline_version_id
       OR (p_template_metadata->>'baseline_revision')::BIGINT
         IS DISTINCT FROM p_expected_revision THEN
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
      'template_version', 2,
      'dossier_id', v_dossier_id,
      'baseline_version_id', p_baseline_version_id,
      'baseline_revision', v_revision,
      'generated_at', p_template_metadata->>'generated_at'
    ),
    'next_criterion_number', v_next_criterion_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_validate_metadata_v2(
  UUID,
  JSONB,
  BIGINT
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public._technical_configuration_require_authorized_user() IS
  'Canonical Technical Configurations guard for global, admin, and chuyen_gia sessions.';
COMMENT ON FUNCTION public._technical_configuration_require_global_user() IS
  'Compatibility wrapper for the canonical Technical Configurations authorization guard.';

COMMIT;
