-- P9B1: option-owned URL documents and exact-baseline criterion citations.
BEGIN;

ALTER TABLE public.technical_configuration_comparison_sets
  ADD CONSTRAINT technical_configuration_comparison_sets_id_option_version_key
  UNIQUE (id, option_id, baseline_version_id);

CREATE TABLE public.technical_configuration_option_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (id, option_id),
  CHECK (btrim(name) <> ''),
  FOREIGN KEY (option_id)
    REFERENCES public.technical_configuration_options (id)
    ON DELETE CASCADE
);

CREATE TABLE public.technical_configuration_option_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL,
  baseline_version_id UUID NOT NULL,
  comparison_set_id UUID NOT NULL,
  option_document_id UUID NOT NULL,
  criterion_id UUID NOT NULL,
  page_section TEXT,
  excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (option_document_id, comparison_set_id, criterion_id),
  FOREIGN KEY (option_document_id, option_id)
    REFERENCES public.technical_configuration_option_documents (id, option_id)
    ON DELETE CASCADE,
  FOREIGN KEY (comparison_set_id, option_id, baseline_version_id)
    REFERENCES public.technical_configuration_comparison_sets (
      id, option_id, baseline_version_id
    )
    ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)
    ON DELETE CASCADE
);

CREATE INDEX technical_configuration_option_documents_option_idx
  ON public.technical_configuration_option_documents (option_id);
CREATE INDEX technical_configuration_option_citations_document_option_idx
  ON public.technical_configuration_option_citations (option_document_id, option_id);
CREATE INDEX technical_configuration_option_citations_set_option_version_idx
  ON public.technical_configuration_option_citations (
    comparison_set_id, option_id, baseline_version_id
  );
CREATE INDEX technical_configuration_option_citations_criterion_version_idx
  ON public.technical_configuration_option_citations (criterion_id, baseline_version_id);

ALTER TABLE public.technical_configuration_option_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_option_citations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.technical_configuration_option_documents
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_option_citations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.technical_configuration_option_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.technical_configuration_option_citations TO service_role;

CREATE OR REPLACE FUNCTION public._technical_configuration_option_document_payload(
  p_option_document_id UUID,
  p_baseline_version_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', d.id,
    'option_id', d.option_id,
    'name', d.name,
    'url', d.url,
    'created_by', d.created_by,
    'created_at', d.created_at,
    'updated_at', d.updated_at,
    'affected_citation_count', (
      SELECT count(*)
      FROM public.technical_configuration_option_citations linked
      WHERE linked.option_document_id = d.id
    ),
    'citations', CASE
      WHEN p_baseline_version_id IS NULL THEN '[]'::JSONB
      ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id,
          'criterion_id', c.criterion_id,
          'page_section', c.page_section,
          'excerpt', c.excerpt
        ) ORDER BY c.created_at, c.id)
        FROM public.technical_configuration_option_citations c
        WHERE c.option_document_id = d.id
          AND c.option_id = d.option_id
          AND c.baseline_version_id = p_baseline_version_id
      ), '[]'::JSONB)
    END
  )
  FROM public.technical_configuration_option_documents d
  WHERE d.id = p_option_document_id;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_option_document_payload(
  UUID, UUID
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._technical_configuration_option_document_payload(
  UUID, UUID
) TO service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_documents_list(
  p_option_id UUID,
  p_baseline_version_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page INTEGER := COALESCE(p_page, 1);
  v_page_size INTEGER := COALESCE(p_page_size, 50);
  v_option_dossier_id UUID;
  v_version_dossier_id UUID;
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF v_page < 1 OR v_page_size < 1 OR v_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

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

  WITH documents AS (
    SELECT d.*
    FROM public.technical_configuration_option_documents d
    WHERE d.option_id = p_option_id
  ),
  paged AS (
    SELECT d.*
    FROM documents d
    ORDER BY d.created_at, d.id
    LIMIT v_page_size
    OFFSET ((v_page - 1)::BIGINT * v_page_size)
  ),
  citation_counts AS (
    SELECT c.option_document_id, count(*) AS affected_citation_count
    FROM paged p
    JOIN public.technical_configuration_option_citations c
      ON c.option_document_id = p.id
    GROUP BY c.option_document_id
  ),
  exact_citations AS (
    SELECT
      c.option_document_id,
      jsonb_agg(jsonb_build_object(
        'id', c.id,
        'criterion_id', c.criterion_id,
        'page_section', c.page_section,
        'excerpt', c.excerpt
      ) ORDER BY c.created_at, c.id) AS citations
    FROM public.technical_configuration_option_citations c
    JOIN public.technical_configuration_comparison_sets comparison_set
      ON comparison_set.id = c.comparison_set_id
     AND comparison_set.option_id = p_option_id
     AND comparison_set.baseline_version_id = p_baseline_version_id
    GROUP BY c.option_document_id
  )
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'option_id', d.option_id,
      'name', d.name,
      'url', d.url,
      'created_by', d.created_by,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'affected_citation_count', COALESCE(counts.affected_citation_count, 0),
      'citations', COALESCE(exact.citations, '[]'::JSONB)
    ) ORDER BY d.created_at, d.id), '[]'::JSONB),
    'total', (SELECT count(*) FROM documents),
    'page', v_page,
    'page_size', v_page_size
  )
  INTO v_result
  FROM paged d
  LEFT JOIN citation_counts counts ON counts.option_document_id = d.id
  LEFT JOIN exact_citations exact ON exact.option_document_id = d.id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_document_create(
  p_option_id UUID,
  p_name TEXT,
  p_url TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_user_id BIGINT;
  v_document_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id, p_expected_revision
  );
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);

  INSERT INTO public.technical_configuration_option_documents (
    option_id, name, url, created_by, updated_by
  )
  VALUES (p_option_id, btrim(p_name), p_url, v_user_id, v_user_id)
  RETURNING id INTO v_document_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_option_document_payload(v_document_id, NULL)
      || jsonb_build_object('revision', v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_document_update(
  p_option_document_id UUID,
  p_name TEXT,
  p_url TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_user_id BIGINT;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_option_documents d
  JOIN public.technical_configuration_options o ON o.id = d.option_id
  WHERE d.id = p_option_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id, p_expected_revision
  );
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);

  UPDATE public.technical_configuration_option_documents
  SET name = btrim(p_name), url = p_url, updated_at = now(), updated_by = v_user_id
  WHERE id = p_option_document_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_option_document_payload(p_option_document_id, NULL)
      || jsonb_build_object('revision', v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_document_delete(
  p_option_document_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_user_id BIGINT;
  v_revision BIGINT;
  v_affected_citation_count BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_option_documents d
  JOIN public.technical_configuration_options o ON o.id = d.option_id
  WHERE d.id = p_option_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id, p_expected_revision
  );
  SELECT count(*) INTO v_affected_citation_count
  FROM public.technical_configuration_option_citations
  WHERE option_document_id = p_option_document_id;

  DELETE FROM public.technical_configuration_option_documents
  WHERE id = p_option_document_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_option_document_id,
    'revision', v_revision,
    'affected_citation_count', v_affected_citation_count
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_citation_upsert(
  p_option_document_id UUID,
  p_comparison_set_id UUID,
  p_criterion_id UUID,
  p_page_section TEXT,
  p_excerpt TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_option_id UUID;
  v_dossier_id UUID;
  v_set_option_id UUID;
  v_set_dossier_id UUID;
  v_baseline_version_id UUID;
  v_criterion_version_id UUID;
  v_user_id BIGINT;
  v_citation_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT d.option_id, o.dossier_id
  INTO v_option_id, v_dossier_id
  FROM public.technical_configuration_option_documents d
  JOIN public.technical_configuration_options o ON o.id = d.option_id
  WHERE d.id = p_option_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT cs.option_id, cs.dossier_id, cs.baseline_version_id
  INTO v_set_option_id, v_set_dossier_id, v_baseline_version_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = p_comparison_set_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_option_id IS DISTINCT FROM v_set_option_id
     OR v_dossier_id IS DISTINCT FROM v_set_dossier_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT c.baseline_version_id INTO v_criterion_version_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_baseline_version_id IS DISTINCT FROM v_criterion_version_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id, p_expected_revision
  );
  INSERT INTO public.technical_configuration_option_citations (
    option_id, baseline_version_id, comparison_set_id, option_document_id,
    criterion_id, page_section, excerpt, created_by, updated_by
  )
  VALUES (
    v_option_id, v_baseline_version_id, p_comparison_set_id, p_option_document_id,
    p_criterion_id, p_page_section, p_excerpt, v_user_id, v_user_id
  )
  ON CONFLICT (option_document_id, comparison_set_id, criterion_id) DO UPDATE
  SET page_section = EXCLUDED.page_section,
      excerpt = EXCLUDED.excerpt,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_citation_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object('data', (
    SELECT jsonb_build_object(
      'id', c.id,
      'criterion_id', c.criterion_id,
      'page_section', c.page_section,
      'excerpt', c.excerpt,
      'revision', v_revision
    )
    FROM public.technical_configuration_option_citations c
    WHERE c.id = v_citation_id
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_citation_delete(
  p_option_citation_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id UUID;
  v_user_id BIGINT;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id INTO v_dossier_id
  FROM public.technical_configuration_option_citations c
  JOIN public.technical_configuration_option_documents d
    ON d.id = c.option_document_id
  JOIN public.technical_configuration_options o ON o.id = d.option_id
  WHERE c.id = p_option_citation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id, p_expected_revision
  );
  DELETE FROM public.technical_configuration_option_citations
  WHERE id = p_option_citation_id;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1, updated_at = now(), updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_option_citation_id,
    'revision', v_revision
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_option_documents_list(
  UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_document_create(
  UUID, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_document_update(
  UUID, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_document_delete(
  UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_citation_upsert(
  UUID, UUID, UUID, TEXT, TEXT, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_option_citation_delete(
  UUID, BIGINT
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.technical_configuration_option_documents_list(
  UUID, UUID, INTEGER, INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_document_create(
  UUID, TEXT, TEXT, BIGINT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_document_update(
  UUID, TEXT, TEXT, BIGINT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_document_delete(
  UUID, BIGINT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_citation_upsert(
  UUID, UUID, UUID, TEXT, TEXT, BIGINT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_citation_delete(
  UUID, BIGINT
) TO authenticated;

COMMIT;
