BEGIN; CREATE TABLE public.technical_configuration_baseline_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by BIGINT NOT NULL,
  UNIQUE (id, baseline_version_id),
  CHECK (btrim(name) <> ''),
  FOREIGN KEY (baseline_version_id)
    REFERENCES public.technical_configuration_baseline_versions (id) ON DELETE CASCADE
);
CREATE TABLE public.technical_configuration_baseline_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL, baseline_document_id UUID NOT NULL,
  criterion_id UUID NOT NULL, page_section TEXT, excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by BIGINT NOT NULL,
  UNIQUE (baseline_document_id, criterion_id),
  FOREIGN KEY (baseline_document_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_documents (id, baseline_version_id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id) ON DELETE CASCADE
);
CREATE TABLE public.technical_configuration_reference_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL, reference_product_id UUID NOT NULL,
  name TEXT NOT NULL, url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by BIGINT NOT NULL,
  UNIQUE (id, baseline_version_id),
  CHECK (btrim(name) <> ''),
  FOREIGN KEY (reference_product_id, baseline_version_id)
    REFERENCES public.technical_configuration_reference_products (id, baseline_version_id) ON DELETE CASCADE
);
CREATE TABLE public.technical_configuration_reference_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL, reference_document_id UUID NOT NULL,
  criterion_id UUID NOT NULL, page_section TEXT, excerpt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by BIGINT NOT NULL,
  UNIQUE (reference_document_id, criterion_id),
  FOREIGN KEY (reference_document_id, baseline_version_id)
    REFERENCES public.technical_configuration_reference_documents (id, baseline_version_id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id) ON DELETE CASCADE
);
CREATE INDEX technical_configuration_baseline_documents_version_idx
  ON public.technical_configuration_baseline_documents (baseline_version_id, created_at, id);
CREATE INDEX technical_configuration_baseline_citations_document_idx
  ON public.technical_configuration_baseline_citations (baseline_document_id, created_at, id);
CREATE INDEX technical_configuration_baseline_citations_criterion_idx
  ON public.technical_configuration_baseline_citations (criterion_id, baseline_document_id);
CREATE INDEX technical_configuration_reference_documents_version_idx
  ON public.technical_configuration_reference_documents (baseline_version_id, created_at, id);
CREATE INDEX technical_configuration_reference_documents_product_idx
  ON public.technical_configuration_reference_documents (reference_product_id, created_at, id);
CREATE INDEX technical_configuration_reference_citations_document_idx
  ON public.technical_configuration_reference_citations (reference_document_id, created_at, id);
CREATE INDEX technical_configuration_reference_citations_criterion_idx
  ON public.technical_configuration_reference_citations (criterion_id, reference_document_id);
ALTER TABLE public.technical_configuration_baseline_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_baseline_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_reference_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_reference_citations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.technical_configuration_baseline_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_baseline_citations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_reference_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_reference_citations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technical_configuration_baseline_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technical_configuration_baseline_citations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technical_configuration_reference_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technical_configuration_reference_citations TO service_role;
CREATE OR REPLACE FUNCTION public._technical_configuration_validate_document_url(p_url TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF p_url IS NULL OR p_url !~* '^https?:\/\/' OR p_url ~* '^https?://$'
     OR p_url ~ '[[:space:]]' OR p_url ~ '[[:cntrl:]]'
     OR position(E'\\' IN p_url) > 0 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public._technical_configuration_document_payload(
  p_owner_type TEXT, p_document_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  IF p_owner_type = 'baseline' THEN
    SELECT jsonb_build_object(
      'id', d.id, 'owner_type', 'baseline', 'owner_id', d.baseline_version_id,
      'name', d.name, 'url', d.url, 'created_by', d.created_by,
      'created_at', d.created_at, 'updated_at', d.updated_at, 'citations',
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'criterion_id', c.criterion_id,
        'page_section', c.page_section, 'excerpt', c.excerpt
      ) ORDER BY c.created_at, c.id)
      FROM public.technical_configuration_baseline_citations c
      WHERE c.baseline_document_id = d.id), '[]'::JSONB)
    ) INTO v_payload FROM public.technical_configuration_baseline_documents d
    WHERE d.id = p_document_id;
  ELSE
    SELECT jsonb_build_object(
      'id', d.id, 'owner_type', 'reference_product', 'owner_id', d.reference_product_id,
      'name', d.name, 'url', d.url, 'created_by', d.created_by,
      'created_at', d.created_at, 'updated_at', d.updated_at, 'citations',
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'criterion_id', c.criterion_id,
        'page_section', c.page_section, 'excerpt', c.excerpt
      ) ORDER BY c.created_at, c.id)
      FROM public.technical_configuration_reference_citations c
      WHERE c.reference_document_id = d.id), '[]'::JSONB)
    ) INTO v_payload FROM public.technical_configuration_reference_documents d
    WHERE d.id = p_document_id;
  END IF;
  RETURN v_payload;
END;
$$;
CREATE OR REPLACE FUNCTION public._technical_configuration_citation_payload(
  p_owner_type TEXT, p_citation_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  IF p_owner_type = 'baseline' THEN
    SELECT jsonb_build_object('id', id, 'criterion_id', criterion_id,
      'page_section', page_section, 'excerpt', excerpt)
    INTO v_payload FROM public.technical_configuration_baseline_citations
    WHERE id = p_citation_id;
  ELSE
    SELECT jsonb_build_object('id', id, 'criterion_id', criterion_id,
      'page_section', page_section, 'excerpt', excerpt)
    INTO v_payload FROM public.technical_configuration_reference_citations
    WHERE id = p_citation_id;
  END IF;
  RETURN v_payload;
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_documents_list(
  p_baseline_version_id UUID, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_page INTEGER := COALESCE(p_page, 1); v_page_size INTEGER := COALESCE(p_page_size, 50);
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF NOT EXISTS (SELECT 1 FROM public.technical_configuration_baseline_versions
                 WHERE id = p_baseline_version_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_page < 1 OR v_page_size < 1 OR v_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  WITH documents AS (
    SELECT id, 'baseline'::TEXT owner_type, baseline_version_id owner_id,
      name, url, created_by, created_at, updated_at
    FROM public.technical_configuration_baseline_documents
    WHERE baseline_version_id = p_baseline_version_id
    UNION ALL
    SELECT id, 'reference_product', reference_product_id, name, url,
      created_by, created_at, updated_at
    FROM public.technical_configuration_reference_documents
    WHERE baseline_version_id = p_baseline_version_id
  ), paged AS (
    SELECT * FROM documents ORDER BY created_at, id
    LIMIT v_page_size OFFSET ((v_page - 1)::BIGINT * v_page_size)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'owner_type', d.owner_type, 'owner_id', d.owner_id,
      'name', d.name, 'url', d.url, 'created_by', d.created_by,
      'created_at', d.created_at, 'updated_at', d.updated_at, 'citations',
      CASE d.owner_type WHEN 'baseline' THEN
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'criterion_id', c.criterion_id,
          'page_section', c.page_section, 'excerpt', c.excerpt
        ) ORDER BY c.created_at, c.id)
        FROM public.technical_configuration_baseline_citations c
        WHERE c.baseline_document_id = d.id AND c.baseline_version_id = p_baseline_version_id), '[]'::JSONB)
      ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'criterion_id', c.criterion_id,
          'page_section', c.page_section, 'excerpt', c.excerpt
        ) ORDER BY c.created_at, c.id)
        FROM public.technical_configuration_reference_citations c
        WHERE c.reference_document_id = d.id AND c.baseline_version_id = p_baseline_version_id), '[]'::JSONB)
      END
    ) ORDER BY d.created_at, d.id) FROM paged d), '[]'::JSONB),
    'total', (SELECT count(*) FROM documents), 'page', v_page, 'page_size', v_page_size
  ) INTO v_result;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_document_create(
  p_baseline_version_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_id UUID; v_revision BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(p_baseline_version_id, p_expected_revision);
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'; END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);
  INSERT INTO public.technical_configuration_baseline_documents
    (baseline_version_id, name, url, created_by, updated_by)
  VALUES (p_baseline_version_id, btrim(p_name), p_url, v_user_id, v_user_id) RETURNING id INTO v_id;
  v_revision := public._technical_configuration_baseline_bump_revision(p_baseline_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_document_payload('baseline', v_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_document_update(
  p_baseline_document_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_baseline_documents WHERE id = p_baseline_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'; END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);
  UPDATE public.technical_configuration_baseline_documents
  SET name = btrim(p_name), url = p_url, updated_at = now(), updated_by = v_user_id WHERE id = p_baseline_document_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_document_payload('baseline', p_baseline_document_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_document_delete(
  p_baseline_document_id UUID, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT; v_links INTEGER;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_baseline_documents WHERE id = p_baseline_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  SELECT count(*) INTO v_links FROM public.technical_configuration_baseline_citations WHERE baseline_document_id = p_baseline_document_id;
  DELETE FROM public.technical_configuration_baseline_documents WHERE id = p_baseline_document_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_baseline_document_id, 'affected_link_count', v_links, 'revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_citation_upsert(
  p_baseline_document_id UUID, p_criterion_id UUID, p_page_section TEXT, p_excerpt TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_baseline_documents WHERE id = p_baseline_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  IF NOT EXISTS (SELECT 1 FROM public.technical_configuration_baseline_criteria
                 WHERE id = p_criterion_id AND baseline_version_id = v_version_id) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  INSERT INTO public.technical_configuration_baseline_citations
    (baseline_version_id, baseline_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  VALUES (v_version_id, p_baseline_document_id, p_criterion_id, p_page_section, p_excerpt, v_user_id, v_user_id)
  ON CONFLICT (baseline_document_id, criterion_id) DO UPDATE
  SET page_section = EXCLUDED.page_section, excerpt = EXCLUDED.excerpt,
      updated_at = now(), updated_by = EXCLUDED.updated_by RETURNING id INTO v_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_citation_payload('baseline', v_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_citation_delete(
  p_baseline_citation_id UUID, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_baseline_citations WHERE id = p_baseline_citation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  DELETE FROM public.technical_configuration_baseline_citations WHERE id = p_baseline_citation_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data', jsonb_build_object('id', p_baseline_citation_id, 'revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_document_create(
  p_reference_product_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_reference_products WHERE id = p_reference_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'; END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);
  INSERT INTO public.technical_configuration_reference_documents
    (baseline_version_id, reference_product_id, name, url, created_by, updated_by)
  VALUES (v_version_id, p_reference_product_id, btrim(p_name), p_url, v_user_id, v_user_id) RETURNING id INTO v_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_document_payload('reference', v_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_document_update(
  p_reference_document_id UUID, p_name TEXT, p_url TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_reference_documents WHERE id = p_reference_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'; END IF;
  PERFORM public._technical_configuration_validate_document_url(p_url);
  UPDATE public.technical_configuration_reference_documents
  SET name = btrim(p_name), url = p_url, updated_at = now(), updated_by = v_user_id WHERE id = p_reference_document_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_document_payload('reference', p_reference_document_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_document_delete(
  p_reference_document_id UUID, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT; v_links INTEGER;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_reference_documents WHERE id = p_reference_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  SELECT count(*) INTO v_links FROM public.technical_configuration_reference_citations WHERE reference_document_id = p_reference_document_id;
  DELETE FROM public.technical_configuration_reference_documents WHERE id = p_reference_document_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_reference_document_id, 'affected_link_count', v_links, 'revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_citation_upsert(
  p_reference_document_id UUID, p_criterion_id UUID, p_page_section TEXT, p_excerpt TEXT, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_reference_documents WHERE id = p_reference_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  IF NOT EXISTS (SELECT 1 FROM public.technical_configuration_baseline_criteria
                 WHERE id = p_criterion_id AND baseline_version_id = v_version_id) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  INSERT INTO public.technical_configuration_reference_citations
    (baseline_version_id, reference_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  VALUES (v_version_id, p_reference_document_id, p_criterion_id, p_page_section, p_excerpt, v_user_id, v_user_id)
  ON CONFLICT (reference_document_id, criterion_id) DO UPDATE
  SET page_section = EXCLUDED.page_section, excerpt = EXCLUDED.excerpt,
      updated_at = now(), updated_by = EXCLUDED.updated_by RETURNING id INTO v_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data',
    public._technical_configuration_citation_payload('reference', v_id) || jsonb_build_object('revision', v_revision));
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_citation_delete(
  p_reference_citation_id UUID, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  SELECT baseline_version_id INTO v_version_id FROM public.technical_configuration_reference_citations WHERE id = p_reference_citation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(v_version_id, p_expected_revision);
  DELETE FROM public.technical_configuration_reference_citations WHERE id = p_reference_citation_id;
  v_revision := public._technical_configuration_baseline_bump_revision(v_version_id, v_user_id);
  RETURN jsonb_build_object('data', jsonb_build_object('id', p_reference_citation_id, 'revision', v_revision));
END;
$$;
ALTER FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT)
  RENAME TO _technical_configuration_baseline_copy_p7a1;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p7a1(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy(
  p_source_baseline_version_id UUID, p_expected_revision BIGINT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_response JSONB; v_new_version_id UUID; v_user_id BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();
  v_response := public._technical_configuration_baseline_copy_p7a1(
    p_source_baseline_version_id, p_expected_revision);
  v_new_version_id := (v_response->'data'->>'id')::UUID;
  CREATE TEMP TABLE technical_configuration_baseline_document_copy_map (
    source_document_id UUID PRIMARY KEY, target_document_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_baseline_document_copy_map
  SELECT id, gen_random_uuid() FROM public.technical_configuration_baseline_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_baseline_documents
    (id, baseline_version_id, name, url, created_by, updated_by)
  SELECT m.target_document_id, v_new_version_id, d.name, d.url, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_baseline_document_copy_map m
  JOIN public.technical_configuration_baseline_documents d ON d.id = m.source_document_id;
  INSERT INTO public.technical_configuration_baseline_citations
    (baseline_version_id, baseline_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  SELECT v_new_version_id, m.target_document_id, target_criterion.id,
    c.page_section, c.excerpt, v_user_id, v_user_id
  FROM public.technical_configuration_baseline_citations c
  JOIN pg_temp.technical_configuration_baseline_document_copy_map m ON m.source_document_id = c.baseline_document_id
  JOIN public.technical_configuration_baseline_criteria target_criterion
    ON target_criterion.baseline_version_id = v_new_version_id
   AND target_criterion.source_criterion_id = c.criterion_id;
  CREATE TEMP TABLE technical_configuration_reference_document_copy_map (
    source_document_id UUID PRIMARY KEY, target_document_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_reference_document_copy_map
  SELECT id, gen_random_uuid() FROM public.technical_configuration_reference_documents
  WHERE baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_documents
    (id, baseline_version_id, reference_product_id, name, url, created_by, updated_by)
  SELECT m.target_document_id, v_new_version_id, product_map.target_reference_product_id,
    d.name, d.url, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_reference_document_copy_map m
  JOIN public.technical_configuration_reference_documents d ON d.id = m.source_document_id
  JOIN pg_temp.technical_configuration_reference_product_copy_map product_map
    ON product_map.source_reference_product_id = d.reference_product_id;
  INSERT INTO public.technical_configuration_reference_citations
    (baseline_version_id, reference_document_id, criterion_id, page_section, excerpt, created_by, updated_by)
  SELECT v_new_version_id, m.target_document_id, target_criterion.id,
    c.page_section, c.excerpt, v_user_id, v_user_id
  FROM public.technical_configuration_reference_citations c
  JOIN pg_temp.technical_configuration_reference_document_copy_map m ON m.source_document_id = c.reference_document_id
  JOIN public.technical_configuration_baseline_criteria target_criterion
    ON target_criterion.baseline_version_id = v_new_version_id
   AND target_criterion.source_criterion_id = c.criterion_id;
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_validate_document_url(TEXT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public._technical_configuration_validate_document_url(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public._technical_configuration_document_payload(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role; REVOKE ALL ON FUNCTION public._technical_configuration_citation_payload(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_documents_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_documents_list(UUID, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_document_create(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_document_create(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_document_update(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_document_update(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_document_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_document_delete(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_citation_upsert(UUID, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_citation_upsert(UUID, UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_citation_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_citation_delete(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_document_create(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_document_create(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_document_update(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_document_update(UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_document_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_document_delete(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_citation_upsert(UUID, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_citation_upsert(UUID, UUID, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_citation_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_citation_delete(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role; GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) TO authenticated;
COMMIT;
