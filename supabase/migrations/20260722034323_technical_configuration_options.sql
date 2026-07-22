-- P8A2: dossier-scoped supplier option identity and RPC contracts.

CREATE TABLE public.technical_configuration_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  model TEXT,
  manufacturer TEXT,
  option_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  CHECK (model IS NOT NULL OR option_name IS NOT NULL),
  CHECK (
    (model IS NULL OR (
      model <> ''
      AND model = btrim(regexp_replace(model, '[[:space:]]+', ' ', 'g'))
    ))
    AND (manufacturer IS NULL OR (
      manufacturer <> ''
      AND manufacturer = btrim(regexp_replace(manufacturer, '[[:space:]]+', ' ', 'g'))
    ))
    AND (option_name IS NULL OR (
      option_name <> ''
      AND option_name = btrim(regexp_replace(option_name, '[[:space:]]+', ' ', 'g'))
    ))
    AND (
      notes IS NULL
      OR notes = regexp_replace(notes, '^[[:space:]]+|[[:space:]]+$', '', 'g')
    )
  ),
  FOREIGN KEY (supplier_id, dossier_id)
    REFERENCES public.technical_configuration_suppliers (id, dossier_id)
    ON DELETE CASCADE
);

CREATE INDEX technical_configuration_options_dossier_supplier_idx
  ON public.technical_configuration_options (dossier_id, supplier_id);

ALTER TABLE public.technical_configuration_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_options_no_client_access
  ON public.technical_configuration_options
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_options
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_options TO service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_options_list(
  p_dossier_id UUID,
  p_supplier_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  IF p_page IS NULL
     OR p_page_size IS NULL
     OR p_page < 1
     OR p_page_size < 1
     OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  WITH scope AS (
    SELECT d.revision
    FROM public.technical_configuration_dossiers d
    WHERE d.id = p_dossier_id
      AND (
        p_supplier_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.technical_configuration_suppliers supplier_filter
          WHERE supplier_filter.id = p_supplier_id
            AND supplier_filter.dossier_id = d.id
        )
      )
  ),
  option_page AS (
    SELECT
      o.id,
      o.dossier_id,
      o.supplier_id,
      s.name AS supplier_name,
      s.normalized_name AS supplier_normalized_name,
      o.model,
      o.manufacturer,
      o.option_name,
      o.notes,
      s.name || ' · ' || COALESCE(o.model, o.option_name) AS display_label,
      COALESCE(o.model, o.option_name) AS identity_label,
      o.created_at,
      o.created_by,
      o.updated_at,
      o.updated_by
    FROM public.technical_configuration_options o
    JOIN public.technical_configuration_suppliers s
      ON s.id = o.supplier_id
     AND s.dossier_id = o.dossier_id
    CROSS JOIN scope
    WHERE o.dossier_id = p_dossier_id
      AND (p_supplier_id IS NULL OR o.supplier_id = p_supplier_id)
    ORDER BY s.normalized_name, COALESCE(o.model, o.option_name), o.id
    LIMIT p_page_size
    OFFSET (p_page::BIGINT - 1) * p_page_size::BIGINT
  ),
  option_summary AS (
    SELECT count(*) AS total
    FROM public.technical_configuration_options o
    CROSS JOIN scope
    WHERE o.dossier_id = p_dossier_id
      AND (p_supplier_id IS NULL OR o.supplier_id = p_supplier_id)
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'dossier_id', page.dossier_id,
            'supplier_id', page.supplier_id,
            'supplier_name', page.supplier_name,
            'model', page.model,
            'manufacturer', page.manufacturer,
            'option_name', page.option_name,
            'notes', page.notes,
            'display_label', page.display_label,
            'created_at', page.created_at,
            'created_by', page.created_by,
            'updated_at', page.updated_at,
            'updated_by', page.updated_by,
            'revision', d.revision
          )
          ORDER BY page.supplier_normalized_name, page.identity_label, page.id
        )
        FROM option_page page
      ),
      '[]'::JSONB
    ),
    'revision', d.revision,
    'total', summary.total,
    'page', p_page,
    'page_size', p_page_size
  )
  INTO v_result
  FROM scope d
  CROSS JOIN option_summary summary;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_create(
  p_supplier_id UUID,
  p_model TEXT,
  p_manufacturer TEXT,
  p_option_name TEXT,
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
  v_supplier_name TEXT;
  v_revision BIGINT;
  v_data JSONB;
  v_model TEXT := NULLIF(btrim(regexp_replace(p_model, '[[:space:]]+', ' ', 'g')), '');
  v_manufacturer TEXT := NULLIF(btrim(regexp_replace(p_manufacturer, '[[:space:]]+', ' ', 'g')), '');
  v_option_name TEXT := NULLIF(btrim(regexp_replace(p_option_name, '[[:space:]]+', ' ', 'g')), '');
  v_notes TEXT := NULLIF(
    regexp_replace(p_notes, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT s.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_suppliers s
  WHERE s.id = p_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id,
    p_expected_revision
  );

  SELECT s.name
  INTO v_supplier_name
  FROM public.technical_configuration_suppliers s
  WHERE s.id = p_supplier_id
    AND s.dossier_id = v_dossier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_model IS NULL AND v_option_name IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  INSERT INTO public.technical_configuration_options (
    dossier_id, supplier_id, model, manufacturer, option_name, notes,
    created_by, updated_by
  )
  VALUES (
    v_dossier_id, p_supplier_id, v_model, v_manufacturer, v_option_name, v_notes,
    v_user_id, v_user_id
  )
  RETURNING jsonb_build_object(
    'id', id,
    'dossier_id', dossier_id,
    'supplier_id', supplier_id,
    'supplier_name', v_supplier_name,
    'model', model,
    'manufacturer', manufacturer,
    'option_name', option_name,
    'notes', notes,
    'display_label', v_supplier_name || ' · ' || COALESCE(model, option_name),
    'created_at', created_at,
    'created_by', created_by,
    'updated_at', updated_at,
    'updated_by', updated_by
  )
  INTO v_data;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    v_data || jsonb_build_object('revision', v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_update(
  p_option_id UUID,
  p_model TEXT,
  p_manufacturer TEXT,
  p_option_name TEXT,
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
  v_supplier_id UUID;
  v_supplier_name TEXT;
  v_revision BIGINT;
  v_data JSONB;
  v_model TEXT := NULLIF(btrim(regexp_replace(p_model, '[[:space:]]+', ' ', 'g')), '');
  v_manufacturer TEXT := NULLIF(btrim(regexp_replace(p_manufacturer, '[[:space:]]+', ' ', 'g')), '');
  v_option_name TEXT := NULLIF(btrim(regexp_replace(p_option_name, '[[:space:]]+', ' ', 'g')), '');
  v_notes TEXT := NULLIF(
    regexp_replace(p_notes, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id, o.supplier_id
  INTO v_dossier_id, v_supplier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id,
    p_expected_revision
  );

  SELECT s.name
  INTO v_supplier_name
  FROM public.technical_configuration_options o
  JOIN public.technical_configuration_suppliers s
    ON s.id = o.supplier_id
   AND s.dossier_id = o.dossier_id
  WHERE o.id = p_option_id
    AND o.dossier_id = v_dossier_id
    AND o.supplier_id = v_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_model IS NULL AND v_option_name IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  UPDATE public.technical_configuration_options
  SET model = v_model,
      manufacturer = v_manufacturer,
      option_name = v_option_name,
      notes = v_notes,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_option_id
    AND dossier_id = v_dossier_id
    AND supplier_id = v_supplier_id
  RETURNING jsonb_build_object(
    'id', id,
    'dossier_id', dossier_id,
    'supplier_id', supplier_id,
    'supplier_name', v_supplier_name,
    'model', model,
    'manufacturer', manufacturer,
    'option_name', option_name,
    'notes', notes,
    'display_label', v_supplier_name || ' · ' || COALESCE(model, option_name),
    'created_at', created_at,
    'created_by', created_by,
    'updated_at', updated_at,
    'updated_by', updated_by
  )
  INTO v_data;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    v_data || jsonb_build_object('revision', v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_option_delete(
  p_option_id UUID,
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
  v_supplier_id UUID;
  v_deleted_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT o.dossier_id, o.supplier_id
  INTO v_dossier_id, v_supplier_id
  FROM public.technical_configuration_options o
  WHERE o.id = p_option_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_dossier(
    v_dossier_id,
    p_expected_revision
  );

  DELETE FROM public.technical_configuration_options
  WHERE id = p_option_id
    AND dossier_id = v_dossier_id
    AND supplier_id = v_supplier_id
  RETURNING id INTO v_deleted_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'data',
    jsonb_build_object('id', v_deleted_id, 'revision', v_revision)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_options_list(UUID, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_option_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_option_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_option_delete(UUID, BIGINT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.technical_configuration_options_list(UUID, UUID, INTEGER, INTEGER)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_option_delete(UUID, BIGINT)
  TO authenticated, service_role;
