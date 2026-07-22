-- P8A1: dossier-scoped supplier persistence and RPC contracts.

CREATE OR REPLACE FUNCTION public._technical_configuration_normalize_supplier_name(
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT lower(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')));
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_normalize_supplier_name(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._technical_configuration_normalize_supplier_name(TEXT)
  TO service_role;

CREATE TABLE public.technical_configuration_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (
    public._technical_configuration_normalize_supplier_name(name)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL,
  UNIQUE (id, dossier_id),
  UNIQUE (dossier_id, normalized_name),
  CHECK (
    name <> ''
    AND name = btrim(regexp_replace(name, '[[:space:]]+', ' ', 'g'))
  ),
  FOREIGN KEY (dossier_id)
    REFERENCES public.technical_configuration_dossiers (id)
    ON DELETE CASCADE
);

ALTER TABLE public.technical_configuration_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_suppliers_no_client_access
  ON public.technical_configuration_suppliers
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_suppliers
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_suppliers TO service_role;

CREATE OR REPLACE FUNCTION public.technical_configuration_suppliers_list(
  p_dossier_id UUID,
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
     OR p_page < 1
     OR p_page_size IS NULL
     OR p_page_size < 1
     OR p_page_size > 100 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  WITH dossier AS (
    SELECT d.revision
    FROM public.technical_configuration_dossiers d
    WHERE d.id = p_dossier_id
  ),
  supplier_page AS (
    SELECT
      s.id,
      s.dossier_id,
      s.name,
      s.normalized_name,
      s.created_at,
      s.created_by,
      s.updated_at,
      s.updated_by
    FROM public.technical_configuration_suppliers s
    WHERE s.dossier_id = p_dossier_id
    ORDER BY s.normalized_name, s.id
    LIMIT p_page_size
    OFFSET (p_page::BIGINT - 1) * p_page_size::BIGINT
  ),
  supplier_summary AS (
    SELECT count(*) AS total
    FROM public.technical_configuration_suppliers s
    WHERE s.dossier_id = p_dossier_id
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', page.id,
            'dossier_id', page.dossier_id,
            'name', page.name,
            'normalized_name', page.normalized_name,
            'created_at', page.created_at,
            'created_by', page.created_by,
            'updated_at', page.updated_at,
            'updated_by', page.updated_by,
            'revision', d.revision
          )
          ORDER BY page.normalized_name, page.id
        )
        FROM supplier_page page
      ),
      '[]'::JSONB
    ),
    'revision', d.revision,
    'total', summary.total,
    'page', p_page,
    'page_size', p_page_size
  )
  INTO v_result
  FROM dossier d
  CROSS JOIN supplier_summary summary;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_supplier_create(
  p_dossier_id UUID,
  p_name TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_revision BIGINT;
  v_data JSONB;
  v_name TEXT := NULLIF(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')), '');
BEGIN
  v_user_id := public._technical_configuration_require_editable_dossier(
    p_dossier_id,
    p_expected_revision
  );

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  BEGIN
    INSERT INTO public.technical_configuration_suppliers (
      dossier_id,
      name,
      created_by,
      updated_by
    )
    VALUES (
      p_dossier_id,
      v_name,
      v_user_id,
      v_user_id
    )
    RETURNING jsonb_build_object(
      'id', id,
      'dossier_id', dossier_id,
      'name', name,
      'normalized_name', normalized_name,
      'created_at', created_at,
      'created_by', created_by,
      'updated_at', updated_at,
      'updated_by', updated_by
    )
    INTO v_data;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_supplier' USING ERRCODE = 'PT409';
  END;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_dossier_id
  RETURNING revision INTO v_revision;

  v_data := v_data || jsonb_build_object('revision', v_revision);

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_supplier_update(
  p_supplier_id UUID,
  p_name TEXT,
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
  v_revision BIGINT;
  v_data JSONB;
  v_name TEXT := NULLIF(btrim(regexp_replace(p_name, '[[:space:]]+', ' ', 'g')), '');
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

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  BEGIN
    UPDATE public.technical_configuration_suppliers
    SET name = v_name,
        updated_at = now(),
        updated_by = v_user_id
    WHERE id = p_supplier_id
      AND dossier_id = v_dossier_id
    RETURNING jsonb_build_object(
      'id', id,
      'dossier_id', dossier_id,
      'name', name,
      'normalized_name', normalized_name,
      'created_at', created_at,
      'created_by', created_by,
      'updated_at', updated_at,
      'updated_by', updated_by
    )
    INTO v_data;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_supplier' USING ERRCODE = 'PT409';
  END;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_revision;

  v_data := v_data || jsonb_build_object('revision', v_revision);

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_supplier_delete(
  p_supplier_id UUID,
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
  v_deleted_id UUID;
  v_revision BIGINT;
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

  DELETE FROM public.technical_configuration_suppliers
  WHERE id = p_supplier_id
    AND dossier_id = v_dossier_id
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
    jsonb_build_object(
      'id', v_deleted_id,
      'revision', v_revision
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_suppliers_list(UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_supplier_create(UUID, TEXT, BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_supplier_update(UUID, TEXT, BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.technical_configuration_supplier_delete(UUID, BIGINT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.technical_configuration_suppliers_list(UUID, INTEGER, INTEGER)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_supplier_create(UUID, TEXT, BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_supplier_update(UUID, TEXT, BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_supplier_delete(UUID, BIGINT)
  TO authenticated, service_role;
