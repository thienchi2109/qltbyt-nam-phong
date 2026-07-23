-- P8A4: nullable side-effect-free read for one option and exact baseline version.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_comparison_set_get(
  p_option_id UUID,
  p_baseline_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_option_dossier_id UUID;
  v_version_dossier_id UUID;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id
  INTO v_option_dossier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT v.dossier_id
  INTO v_version_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_option_dossier_id IS DISTINCT FROM v_version_dossier_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT jsonb_build_object(
    'id', cs.id,
    'dossier_id', cs.dossier_id,
    'option_id', cs.option_id,
    'baseline_version_id', cs.baseline_version_id,
    'created_at', cs.created_at,
    'created_by', cs.created_by,
    'updated_at', cs.updated_at,
    'updated_by', cs.updated_by,
    'revision', d.revision,
    'responses', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'comparison_set_id', r.comparison_set_id,
            'baseline_version_id', r.baseline_version_id,
            'criterion_id', r.criterion_id,
            'response_text', r.response_text,
            'supplementary_information', r.supplementary_information,
            'created_at', r.created_at,
            'created_by', r.created_by,
            'updated_at', r.updated_at,
            'updated_by', r.updated_by,
            'revision', d.revision
          )
          ORDER BY bg.sort_order, bc.sort_order, bc.id
        )
        FROM public.technical_configuration_option_responses r
        JOIN public.technical_configuration_baseline_criteria bc
          ON bc.id = r.criterion_id
         AND bc.baseline_version_id = r.baseline_version_id
        JOIN public.technical_configuration_baseline_groups bg
          ON bg.id = bc.group_id
         AND bg.baseline_version_id = bc.baseline_version_id
        WHERE r.comparison_set_id = cs.id
      ),
      '[]'::JSONB
    )
  )
  INTO v_data
  FROM public.technical_configuration_comparison_sets cs
  JOIN public.technical_configuration_dossiers d
    ON d.id = cs.dossier_id
  WHERE cs.option_id = p_option_id
    AND cs.baseline_version_id = p_baseline_version_id;

  IF v_data IS NULL THEN
    RETURN jsonb_build_object('data', NULL);
  END IF;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_comparison_set_get(
  UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_comparison_set_get(
  UUID, UUID
) TO authenticated, service_role;

COMMIT;
