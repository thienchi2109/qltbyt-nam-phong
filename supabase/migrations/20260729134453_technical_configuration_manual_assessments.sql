-- P11B: dormant manual-assessment persistence and guarded database contracts.
BEGIN;

CREATE TABLE public.technical_configuration_manual_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_set_id UUID NOT NULL,
  baseline_version_id UUID NOT NULL,
  criterion_id UUID NOT NULL,
  technical_axis TEXT,
  evidence_axis TEXT,
  notes TEXT NOT NULL DEFAULT '',
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (comparison_set_id, criterion_id),
  CHECK (
    technical_axis IS NULL
    OR technical_axis IN (
      'exceeds',
      'meets',
      'fails',
      'unclear',
      'not_applicable'
    )
  ),
  CHECK (
    evidence_axis IS NULL
    OR evidence_axis IN (
      'complete',
      'partial',
      'missing',
      'not_required'
    )
  ),
  CHECK (revision > 0),
  FOREIGN KEY (comparison_set_id, baseline_version_id)
    REFERENCES public.technical_configuration_comparison_sets (id, baseline_version_id)
    ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)
    ON DELETE CASCADE
);

CREATE INDEX technical_configuration_manual_assessments_set_version_idx
  ON public.technical_configuration_manual_assessments (comparison_set_id, baseline_version_id);
CREATE INDEX technical_configuration_manual_assessments_criterion_version_idx
  ON public.technical_configuration_manual_assessments (criterion_id, baseline_version_id);

ALTER TABLE public.technical_configuration_manual_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_manual_assessments_no_client_access
  ON public.technical_configuration_manual_assessments
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_manual_assessments
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_manual_assessments TO service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_assessments_list(
  p_comparison_set_id UUID,
  p_page INTEGER,
  p_page_size INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_baseline_version_id UUID;
  v_total BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_comparison_set_id IS NULL
     OR p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT cs.baseline_version_id
  INTO v_baseline_version_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = p_comparison_set_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH ordered_assessments AS MATERIALIZED (
    SELECT
      jsonb_build_object(
        'id', a.id,
        'comparison_set_id', a.comparison_set_id,
        'baseline_version_id', a.baseline_version_id,
        'criterion_id', a.criterion_id,
        'technical_axis', a.technical_axis,
        'evidence_axis', a.evidence_axis,
        'notes', a.notes,
        'revision', a.revision,
        'created_by', a.created_by,
        'created_at', a.created_at,
        'updated_by', a.updated_by,
        'updated_at', a.updated_at
      ) AS item,
      bg.sort_order AS group_order,
      bc.sort_order AS criterion_order,
      bc.id AS criterion_id
    FROM public.technical_configuration_manual_assessments a
    JOIN public.technical_configuration_baseline_criteria bc
      ON bc.id = a.criterion_id
     AND bc.baseline_version_id = a.baseline_version_id
    JOIN public.technical_configuration_baseline_groups bg
      ON bg.id = bc.group_id
     AND bg.baseline_version_id = bc.baseline_version_id
    WHERE a.comparison_set_id = p_comparison_set_id
      AND a.baseline_version_id = v_baseline_version_id
    ORDER BY bg.sort_order, bc.sort_order, bc.id
  ),
  paged_assessments AS (
    SELECT *
    FROM ordered_assessments
    ORDER BY group_order, criterion_order, criterion_id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT
    (SELECT count(*) FROM ordered_assessments),
    COALESCE(
      jsonb_agg(
        paged.item
        ORDER BY paged.group_order, paged.criterion_order, paged.criterion_id
      ),
      '[]'::JSONB
    )
  INTO v_total, v_data
  FROM paged_assessments paged;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_assessment_upsert(
  p_comparison_set_id UUID,
  p_criterion_id UUID,
  p_technical_axis TEXT,
  p_evidence_axis TEXT,
  p_notes TEXT,
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
  v_archived_at TIMESTAMPTZ;
  v_assessment_id UUID;
  v_current_revision BIGINT;
  v_data JSONB;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();

  IF p_comparison_set_id IS NULL
     OR p_criterion_id IS NULL
     OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  IF p_technical_axis IS NOT NULL
     AND p_technical_axis NOT IN (
       'exceeds',
       'meets',
       'fails',
       'unclear',
       'not_applicable'
     ) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  IF p_evidence_axis IS NOT NULL
     AND p_evidence_axis NOT IN (
       'complete',
       'partial',
       'missing',
       'not_required'
     ) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT cs.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = p_comparison_set_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT d.archived_at
  INTO v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;

  SELECT cs.baseline_version_id
  INTO v_baseline_version_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = p_comparison_set_id
    AND cs.dossier_id = v_dossier_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT c.baseline_version_id
  INTO v_criterion_version_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_baseline_version_id IS DISTINCT FROM v_criterion_version_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT a.id, a.revision
  INTO v_assessment_id, v_current_revision
  FROM public.technical_configuration_manual_assessments a
  WHERE a.comparison_set_id = p_comparison_set_id
    AND a.criterion_id = p_criterion_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_current_revision IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
    END IF;

    UPDATE public.technical_configuration_manual_assessments AS a
    SET technical_axis = p_technical_axis,
        evidence_axis = p_evidence_axis,
        notes = COALESCE(p_notes, ''),
        revision = a.revision + 1,
        updated_at = now(),
        updated_by = v_user_id
    WHERE a.id = v_assessment_id;
  ELSE
    IF p_expected_revision = 0 THEN
      INSERT INTO public.technical_configuration_manual_assessments (
        comparison_set_id,
        baseline_version_id,
        criterion_id,
        technical_axis,
        evidence_axis,
        notes,
        created_by,
        updated_by
      )
      VALUES (
        p_comparison_set_id,
        v_baseline_version_id,
        p_criterion_id,
        p_technical_axis,
        p_evidence_axis,
        COALESCE(p_notes, ''),
        v_user_id,
        v_user_id
      )
      ON CONFLICT (comparison_set_id, criterion_id) DO NOTHING
      RETURNING id INTO v_assessment_id;

      IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
      END IF;
    ELSE
      RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'id', a.id,
    'comparison_set_id', a.comparison_set_id,
    'baseline_version_id', a.baseline_version_id,
    'criterion_id', a.criterion_id,
    'technical_axis', a.technical_axis,
    'evidence_axis', a.evidence_axis,
    'notes', a.notes,
    'revision', a.revision,
    'created_by', a.created_by,
    'created_at', a.created_at,
    'updated_by', a.updated_by,
    'updated_at', a.updated_at
  )
  INTO v_data
  FROM public.technical_configuration_manual_assessments a
  WHERE a.id = v_assessment_id;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_assessments_list(
  UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_assessment_upsert(
  UUID, UUID, TEXT, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_assessments_list(
  UUID, INTEGER, INTEGER
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_assessment_upsert(
  UUID, UUID, TEXT, TEXT, TEXT, BIGINT
) TO authenticated, service_role;

COMMIT;
