-- P8A3: exact-baseline option comparison sets and response persistence.
BEGIN;

ALTER TABLE public.technical_configuration_options
  ADD CONSTRAINT technical_configuration_options_id_dossier_id_key
  UNIQUE (id, dossier_id);

CREATE TABLE public.technical_configuration_comparison_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL,
  option_id UUID NOT NULL,
  baseline_version_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (option_id, baseline_version_id),
  UNIQUE (id, baseline_version_id),
  FOREIGN KEY (option_id, dossier_id)
    REFERENCES public.technical_configuration_options (id, dossier_id)
    ON DELETE CASCADE,
  FOREIGN KEY (baseline_version_id, dossier_id)
    REFERENCES public.technical_configuration_baseline_versions (id, dossier_id)
    ON DELETE CASCADE
);

CREATE TABLE public.technical_configuration_option_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_set_id UUID NOT NULL,
  baseline_version_id UUID NOT NULL,
  criterion_id UUID NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  supplementary_information TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (comparison_set_id, criterion_id),
  FOREIGN KEY (comparison_set_id, baseline_version_id)
    REFERENCES public.technical_configuration_comparison_sets (id, baseline_version_id)
    ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)
    ON DELETE CASCADE
);

CREATE INDEX technical_configuration_comparison_sets_option_dossier_idx
  ON public.technical_configuration_comparison_sets (option_id, dossier_id);
CREATE INDEX technical_configuration_comparison_sets_version_dossier_idx
  ON public.technical_configuration_comparison_sets (baseline_version_id, dossier_id);
CREATE INDEX technical_configuration_option_responses_set_version_idx
  ON public.technical_configuration_option_responses (comparison_set_id, baseline_version_id);
CREATE INDEX technical_configuration_option_responses_criterion_version_idx
  ON public.technical_configuration_option_responses (criterion_id, baseline_version_id);

ALTER TABLE public.technical_configuration_comparison_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_option_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_comparison_sets_no_client_access
  ON public.technical_configuration_comparison_sets
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY technical_configuration_option_responses_no_client_access
  ON public.technical_configuration_option_responses
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_comparison_sets
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_option_responses
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_comparison_sets TO service_role;
GRANT ALL ON TABLE public.technical_configuration_option_responses TO service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_comparison_set_get_or_create(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_option_dossier_id UUID;
  v_version_dossier_id UUID;
  v_comparison_set_id UUID;
  v_revision BIGINT;
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

  SELECT cs.id
  INTO v_comparison_set_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.option_id = p_option_id
    AND cs.baseline_version_id = p_baseline_version_id;

  IF v_comparison_set_id IS NOT NULL THEN
    SELECT d.revision
    INTO v_revision
    FROM public.technical_configuration_dossiers d
    WHERE d.id = v_option_dossier_id
    FOR SHARE;
  ELSE
    v_user_id := public._technical_configuration_require_editable_dossier(
      v_option_dossier_id,
      p_expected_revision
    );

    SELECT cs.id
    INTO v_comparison_set_id
    FROM public.technical_configuration_comparison_sets cs
    WHERE cs.option_id = p_option_id
      AND cs.baseline_version_id = p_baseline_version_id;

    IF v_comparison_set_id IS NULL THEN
      INSERT INTO public.technical_configuration_comparison_sets (
        dossier_id,
        option_id,
        baseline_version_id,
        created_by,
        updated_by
      )
      VALUES (
        v_option_dossier_id,
        p_option_id,
        p_baseline_version_id,
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_comparison_set_id;

      UPDATE public.technical_configuration_dossiers
      SET revision = revision + 1,
          updated_at = now(),
          updated_by = v_user_id
      WHERE id = v_option_dossier_id
      RETURNING revision INTO v_revision;
    ELSE
      SELECT d.revision
      INTO v_revision
      FROM public.technical_configuration_dossiers d
      WHERE d.id = v_option_dossier_id;
    END IF;
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
    'revision', v_revision,
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
            'revision', v_revision
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
  WHERE cs.id = v_comparison_set_id;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_response_upsert(
  p_comparison_set_id UUID,
  p_criterion_id UUID,
  p_response_text TEXT,
  p_supplementary_information TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_baseline_version_id UUID;
  v_criterion_version_id UUID;
  v_response_id UUID;
  v_revision BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT cs.dossier_id, cs.baseline_version_id
  INTO v_dossier_id, v_baseline_version_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = p_comparison_set_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT c.baseline_version_id
  INTO v_criterion_version_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_baseline_version_id IS DISTINCT FROM v_criterion_version_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id,
    p_expected_revision
  );

  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id,
    baseline_version_id,
    criterion_id,
    response_text,
    supplementary_information,
    created_by,
    updated_by
  )
  VALUES (
    p_comparison_set_id,
    v_baseline_version_id,
    p_criterion_id,
    COALESCE(p_response_text, ''),
    COALESCE(p_supplementary_information, ''),
    v_user_id,
    v_user_id
  )
  ON CONFLICT (comparison_set_id, criterion_id) DO UPDATE
  SET response_text = EXCLUDED.response_text,
      supplementary_information = EXCLUDED.supplementary_information,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_response_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  SELECT jsonb_build_object(
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
    'revision', v_revision
  )
  INTO v_data
  FROM public.technical_configuration_option_responses r
  WHERE r.id = v_response_id;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_comparison_set_get_or_create(
  UUID, UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_response_upsert(
  UUID, UUID, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_comparison_set_get_or_create(
  UUID, UUID, BIGINT
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_response_upsert(
  UUID, UUID, TEXT, TEXT, BIGINT
) TO authenticated, service_role;

COMMIT;
