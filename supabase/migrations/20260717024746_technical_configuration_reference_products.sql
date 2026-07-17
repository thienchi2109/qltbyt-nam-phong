BEGIN;
ALTER TABLE public.technical_configuration_baseline_criteria
  ADD CONSTRAINT technical_configuration_baseline_criteria_id_version_key
  UNIQUE (id, baseline_version_id);
CREATE TABLE public.technical_configuration_reference_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL,
  model TEXT,
  manufacturer TEXT,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (id, baseline_version_id),
  CHECK (
    (model IS NULL OR btrim(model) <> '')
    AND (manufacturer IS NULL OR btrim(manufacturer) <> '')
    AND (description IS NULL OR btrim(description) <> '')
    AND (notes IS NULL OR btrim(notes) <> '')
    AND (model IS NOT NULL OR manufacturer IS NOT NULL OR description IS NOT NULL)
  ),
  FOREIGN KEY (baseline_version_id)
    REFERENCES public.technical_configuration_baseline_versions (id)
    ON DELETE CASCADE
);
CREATE TABLE public.technical_configuration_reference_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_version_id UUID NOT NULL,
  reference_product_id UUID NOT NULL,
  criterion_id UUID NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (reference_product_id, criterion_id),
  FOREIGN KEY (reference_product_id, baseline_version_id)
    REFERENCES public.technical_configuration_reference_products (id, baseline_version_id)
    ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, baseline_version_id)
    REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)
    ON DELETE CASCADE
);
CREATE INDEX technical_configuration_reference_products_version_idx
  ON public.technical_configuration_reference_products
  (baseline_version_id, created_at, id);
CREATE INDEX technical_configuration_reference_responses_version_idx
  ON public.technical_configuration_reference_responses
  (baseline_version_id, reference_product_id, criterion_id);
CREATE INDEX technical_configuration_reference_responses_criterion_idx
  ON public.technical_configuration_reference_responses
  (criterion_id, reference_product_id);
ALTER TABLE public.technical_configuration_reference_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_configuration_reference_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY technical_configuration_reference_products_no_client_access
  ON public.technical_configuration_reference_products
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY technical_configuration_reference_responses_no_client_access
  ON public.technical_configuration_reference_responses
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.technical_configuration_reference_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.technical_configuration_reference_responses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_reference_products TO service_role;
GRANT ALL ON TABLE public.technical_configuration_reference_responses TO service_role;
CREATE OR REPLACE FUNCTION public._technical_configuration_reference_response_payload(
  p_response_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'baseline_version_id', r.baseline_version_id,
    'reference_product_id', r.reference_product_id, 'criterion_id', r.criterion_id,
    'response_text', r.response_text, 'created_at', r.created_at,
    'created_by', r.created_by, 'updated_at', r.updated_at, 'updated_by', r.updated_by,
    'revision', p_revision
  )
  FROM public.technical_configuration_reference_responses r
  WHERE r.id = p_response_id;
$$;
CREATE OR REPLACE FUNCTION public._technical_configuration_reference_product_payload(
  p_reference_product_id UUID,
  p_revision BIGINT
)
RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'baseline_version_id', p.baseline_version_id,
    'model', p.model, 'manufacturer', p.manufacturer,
    'description', p.description, 'notes', p.notes,
    'created_at', p.created_at, 'created_by', p.created_by,
    'updated_at', p.updated_at, 'updated_by', p.updated_by,
    'revision', p_revision,
    'responses', COALESCE((
      SELECT jsonb_agg(
        public._technical_configuration_reference_response_payload(r.id, p_revision)
        ORDER BY c.sort_order, c.id
      )
      FROM public.technical_configuration_reference_responses r
      JOIN public.technical_configuration_baseline_criteria c
        ON c.id = r.criterion_id
       AND c.baseline_version_id = r.baseline_version_id
      WHERE r.reference_product_id = p.id
    ), '[]'::JSONB)
  )
  FROM public.technical_configuration_reference_products p
  WHERE p.id = p_reference_product_id;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_products_list(
  p_baseline_version_id UUID,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_revision BIGINT;
  v_total BIGINT;
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  IF p_page IS NULL OR p_page < 1
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  SELECT v.revision INTO v_revision
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT count(*) INTO v_total
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = p_baseline_version_id;
  SELECT COALESCE(
    jsonb_agg(
      public._technical_configuration_reference_product_payload(page.id, v_revision)
      ORDER BY page.created_at, page.id
    ),
    '[]'::JSONB
  )
  INTO v_data
  FROM (
    SELECT p.id, p.created_at
    FROM public.technical_configuration_reference_products p
    WHERE p.baseline_version_id = p_baseline_version_id
    ORDER BY p.created_at, p.id
    LIMIT p_page_size
    OFFSET (p_page - 1) * p_page_size
  ) page;
  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_product_create(
  p_baseline_version_id UUID,
  p_model TEXT,
  p_manufacturer TEXT,
  p_description TEXT,
  p_notes TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_product_id UUID;
  v_revision BIGINT;
  v_model TEXT := NULLIF(btrim(p_model), '');
  v_manufacturer TEXT := NULLIF(btrim(p_manufacturer), '');
  v_description TEXT := NULLIF(btrim(p_description), '');
  v_notes TEXT := NULLIF(btrim(p_notes), '');
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  IF v_model IS NULL AND v_manufacturer IS NULL AND v_description IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  INSERT INTO public.technical_configuration_reference_products (
    baseline_version_id, model, manufacturer, description, notes, created_by, updated_by
  )
  VALUES (
    p_baseline_version_id, v_model, v_manufacturer, v_description, v_notes,
    v_user_id, v_user_id
  )
  RETURNING id INTO v_product_id;
  v_revision := public._technical_configuration_baseline_bump_revision(
    p_baseline_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_reference_product_payload(v_product_id, v_revision)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_product_update(
  p_reference_product_id UUID,
  p_model TEXT,
  p_manufacturer TEXT,
  p_description TEXT,
  p_notes TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
  v_model TEXT := NULLIF(btrim(p_model), '');
  v_manufacturer TEXT := NULLIF(btrim(p_manufacturer), '');
  v_description TEXT := NULLIF(btrim(p_description), '');
  v_notes TEXT := NULLIF(btrim(p_notes), '');
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT p.baseline_version_id INTO v_version_id
  FROM public.technical_configuration_reference_products p
  WHERE p.id = p_reference_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  IF v_model IS NULL AND v_manufacturer IS NULL AND v_description IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  UPDATE public.technical_configuration_reference_products
  SET model = v_model,
      manufacturer = v_manufacturer,
      description = v_description,
      notes = v_notes,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_reference_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_reference_product_payload(
      p_reference_product_id,
      v_revision
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_product_delete(
  p_reference_product_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT; v_version_id UUID; v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT p.baseline_version_id INTO v_version_id
  FROM public.technical_configuration_reference_products p
  WHERE p.id = p_reference_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  DELETE FROM public.technical_configuration_reference_products
  WHERE id = p_reference_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'; END IF;
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    jsonb_build_object('id', p_reference_product_id, 'revision', v_revision)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_reference_response_upsert(
  p_reference_product_id UUID,
  p_criterion_id UUID,
  p_response_text TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_product_version_id UUID;
  v_criterion_version_id UUID;
  v_response_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  SELECT p.baseline_version_id INTO v_product_version_id
  FROM public.technical_configuration_reference_products p
  WHERE p.id = p_reference_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT c.baseline_version_id INTO v_criterion_version_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.id = p_criterion_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_product_version_id IS DISTINCT FROM v_criterion_version_id THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_product_version_id,
    p_expected_revision
  );
  INSERT INTO public.technical_configuration_reference_responses (
    baseline_version_id,
    reference_product_id,
    criterion_id,
    response_text,
    created_by,
    updated_by
  )
  VALUES (
    v_product_version_id,
    p_reference_product_id,
    p_criterion_id,
    COALESCE(p_response_text, ''),
    v_user_id,
    v_user_id
  )
  ON CONFLICT (reference_product_id, criterion_id) DO UPDATE
  SET response_text = EXCLUDED.response_text,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_response_id;
  v_revision := public._technical_configuration_baseline_bump_revision(
    v_product_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_reference_response_payload(v_response_id, v_revision)
  );
END;
$$;
ALTER FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT)
  RENAME TO _technical_configuration_baseline_copy_p4;
REVOKE ALL ON FUNCTION public._technical_configuration_baseline_copy_p4(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy(
  p_source_baseline_version_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_response JSONB;
  v_new_version_id UUID;
  v_user_id BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();
  v_response := public._technical_configuration_baseline_copy_p4(
    p_source_baseline_version_id,
    p_expected_revision
  );
  v_new_version_id := (v_response->'data'->>'id')::UUID;
  CREATE TEMP TABLE technical_configuration_reference_product_copy_map (
    source_reference_product_id UUID PRIMARY KEY,
    target_reference_product_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  INSERT INTO pg_temp.technical_configuration_reference_product_copy_map (
    source_reference_product_id, target_reference_product_id
  )
  SELECT p.id, gen_random_uuid()
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = p_source_baseline_version_id;
  INSERT INTO public.technical_configuration_reference_products (
    id, baseline_version_id, model, manufacturer, description, notes,
    created_by, updated_by
  )
  SELECT
    m.target_reference_product_id, v_new_version_id, p.model, p.manufacturer,
    p.description, p.notes, v_user_id, v_user_id
  FROM pg_temp.technical_configuration_reference_product_copy_map m
  JOIN public.technical_configuration_reference_products p
    ON p.id = m.source_reference_product_id;
  INSERT INTO public.technical_configuration_reference_responses (
    id, baseline_version_id, reference_product_id, criterion_id,
    response_text, created_by, updated_by
  )
  SELECT
    gen_random_uuid(), v_new_version_id, m.target_reference_product_id,
    copied_criterion.id, r.response_text, v_user_id, v_user_id
  FROM public.technical_configuration_reference_responses r
  JOIN pg_temp.technical_configuration_reference_product_copy_map m
    ON m.source_reference_product_id = r.reference_product_id
  JOIN public.technical_configuration_baseline_criteria copied_criterion
    ON copied_criterion.baseline_version_id = v_new_version_id
   AND copied_criterion.source_criterion_id = r.criterion_id
  WHERE r.baseline_version_id = p_source_baseline_version_id;
  RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_reference_response_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._technical_configuration_reference_product_payload(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_products_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_products_list(UUID, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_product_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_product_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_product_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_product_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_product_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_product_delete(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_reference_response_upsert(UUID, UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_response_upsert(UUID, UUID, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) TO authenticated;
COMMIT;
