-- Issue #742, Phase P1: technical configuration dossier foundation.
-- Backend-only additive scope: one dossier root, five guarded RPCs and no live UI.

BEGIN;

CREATE TABLE public.technical_configuration_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type_name TEXT NOT NULL CHECK (btrim(device_type_name) <> ''),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_at TIMESTAMPTZ,
  archived_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL
);

CREATE INDEX technical_configuration_dossiers_active_list_idx
  ON public.technical_configuration_dossiers (updated_at DESC, id)
  WHERE archived_at IS NULL;

CREATE INDEX technical_configuration_dossiers_all_list_idx
  ON public.technical_configuration_dossiers (updated_at DESC, id);

ALTER TABLE public.technical_configuration_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY technical_configuration_dossiers_no_client_access
  ON public.technical_configuration_dossiers
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.technical_configuration_dossiers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.technical_configuration_dossiers TO service_role;

CREATE OR REPLACE FUNCTION public._technical_configuration_require_global_user()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_role IS NULL
     OR v_user_id IS NULL
     OR NOT (v_role IN ('global', 'admin'))
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

CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_dossier(
  p_dossier_id UUID,
  p_expected_revision BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_revision BIGINT;
  v_archived_at TIMESTAMPTZ;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();

  SELECT
    d.revision,
    d.archived_at
  INTO
    v_revision,
    v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_dossier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;

  IF v_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_include_archived BOOLEAN DEFAULT false
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

  WITH paged AS (
    SELECT
      d.id,
      d.device_type_name,
      d.name,
      d.description,
      d.revision,
      d.archived_at,
      d.archived_by,
      d.created_at,
      d.created_by,
      d.updated_at,
      d.updated_by
    FROM public.technical_configuration_dossiers d
    WHERE p_include_archived OR d.archived_at IS NULL
    ORDER BY d.updated_at DESC, d.id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'device_type_name', p.device_type_name,
            'name', p.name,
            'description', p.description,
            'revision', p.revision,
            'archived_at', p.archived_at,
            'archived_by', p.archived_by,
            'created_at', p.created_at,
            'created_by', p.created_by,
            'updated_at', p.updated_at,
            'updated_by', p.updated_by
          )
          ORDER BY p.updated_at DESC, p.id
        )
        FROM paged p
      ),
      '[]'::JSONB
    ),
    'total',
    (
      SELECT count(*)
      FROM public.technical_configuration_dossiers d
      WHERE p_include_archived OR d.archived_at IS NULL
    ),
    'page',
    p_page,
    'page_size',
    p_page_size
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_get(
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data JSONB;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT jsonb_build_object(
    'id', d.id,
    'device_type_name', d.device_type_name,
    'name', d.name,
    'description', d.description,
    'revision', d.revision,
    'archived_at', d.archived_at,
    'archived_by', d.archived_by,
    'created_at', d.created_at,
    'created_by', d.created_by,
    'updated_at', d.updated_at,
    'updated_by', d.updated_by
  )
  INTO v_data
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_create(
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_data JSONB;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();

  IF p_expected_revision IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;

  IF p_device_type_name IS NULL
     OR btrim(p_device_type_name) = ''
     OR p_name IS NULL
     OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name,
    name,
    description,
    revision,
    created_by,
    updated_by
  )
  VALUES (
    btrim(p_device_type_name),
    btrim(p_name),
    NULLIF(btrim(p_description), ''),
    1,
    v_user_id,
    v_user_id
  )
  RETURNING jsonb_build_object(
    'id', id,
    'device_type_name', device_type_name,
    'name', name,
    'description', description,
    'revision', revision,
    'archived_at', archived_at,
    'archived_by', archived_by,
    'created_at', created_at,
    'created_by', created_by,
    'updated_at', updated_at,
    'updated_by', updated_by
  )
  INTO v_data;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_update(
  p_id UUID,
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_data JSONB;
BEGIN
  v_user_id := public._technical_configuration_require_editable_dossier(
    p_id,
    p_expected_revision
  );

  IF p_device_type_name IS NULL
     OR btrim(p_device_type_name) = ''
     OR p_name IS NULL
     OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  UPDATE public.technical_configuration_dossiers
  SET device_type_name = btrim(p_device_type_name),
      name = btrim(p_name),
      description = NULLIF(btrim(p_description), ''),
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_id
  RETURNING jsonb_build_object(
    'id', id,
    'device_type_name', device_type_name,
    'name', name,
    'description', description,
    'revision', revision,
    'archived_at', archived_at,
    'archived_by', archived_by,
    'created_at', created_at,
    'created_by', created_by,
    'updated_at', updated_at,
    'updated_by', updated_by
  )
  INTO v_data;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_archive(
  p_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_data JSONB;
BEGIN
  v_user_id := public._technical_configuration_require_editable_dossier(
    p_id,
    p_expected_revision
  );

  UPDATE public.technical_configuration_dossiers
  SET archived_at = now(),
      archived_by = v_user_id,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_id
  RETURNING jsonb_build_object(
    'id', id,
    'device_type_name', device_type_name,
    'name', name,
    'description', description,
    'revision', revision,
    'archived_at', archived_at,
    'archived_by', archived_by,
    'created_at', created_at,
    'created_by', created_by,
    'updated_at', updated_at,
    'updated_by', updated_by
  )
  INTO v_data;

  RETURN jsonb_build_object('data', v_data);
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_require_global_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._technical_configuration_require_editable_dossier(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_get(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_get(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_create(TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_create(TEXT, TEXT, TEXT, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_update(UUID, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_update(UUID, TEXT, TEXT, TEXT, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_archive(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_archive(UUID, BIGINT) TO authenticated;

COMMENT ON TABLE public.technical_configuration_dossiers IS
  'Independent technical configuration dossier and single configuration lineage root.';

COMMENT ON FUNCTION public._technical_configuration_require_editable_dossier(UUID, BIGINT) IS
  'Common row-locking archive and revision guard for dossier and descendant mutations.';

COMMIT;
