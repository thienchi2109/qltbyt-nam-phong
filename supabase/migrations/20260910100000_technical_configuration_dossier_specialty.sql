-- Chunk 1: optional metadata, preserving all legacy RPC signatures and behavior.
BEGIN;

CREATE OR REPLACE FUNCTION public._technical_configuration_normalize_specialty(p_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT NULLIF(btrim(regexp_replace(normalize(p_value, NFC), '[[:space:]]+', ' ', 'g')), '');
$$;
REVOKE ALL ON FUNCTION public._technical_configuration_normalize_specialty(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.technical_configuration_dossiers
  ADD COLUMN specialty TEXT
  CONSTRAINT technical_configuration_dossiers_specialty_check CHECK (
    specialty IS NULL OR (
      char_length(specialty) BETWEEN 1 AND 200
      AND specialty IS NOT DISTINCT FROM NULLIF(
        btrim(regexp_replace(normalize(specialty, NFC), '[[:space:]]+', ' ', 'g')), ''
      )
    )
  );

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
    'specialty', specialty,
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
    'specialty', specialty,
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

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_create(
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT,
  p_specialty TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_specialty TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  v_specialty := public._technical_configuration_normalize_specialty(p_specialty);
  IF char_length(v_specialty) > 200 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  -- Delegate authorization, locking and the single revision increment to the legacy RPC.
  v_result := public.technical_configuration_dossiers_create(p_device_type_name, p_name, p_description, p_expected_revision);
  UPDATE public.technical_configuration_dossiers
  SET specialty = v_specialty
  WHERE id = (v_result#>>'{data,id}')::UUID;
  RETURN jsonb_set(v_result, '{data,specialty}', COALESCE(to_jsonb(v_specialty), 'null'::JSONB));
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_update(
  p_id UUID,
  p_device_type_name TEXT,
  p_name TEXT,
  p_description TEXT,
  p_expected_revision BIGINT,
  p_specialty TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_specialty TEXT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();
  v_specialty := public._technical_configuration_normalize_specialty(p_specialty);
  IF char_length(v_specialty) > 200 THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  -- Delegate authorization, locking and the single revision increment to the legacy RPC.
  v_result := public.technical_configuration_dossiers_update(p_id, p_device_type_name, p_name, p_description, p_expected_revision);
  UPDATE public.technical_configuration_dossiers
  SET specialty = v_specialty
  WHERE id = (v_result#>>'{data,id}')::UUID;
  RETURN jsonb_set(v_result, '{data,specialty}', COALESCE(to_jsonb(v_specialty), 'null'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_create(TEXT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_create(TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_update(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_update(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;

COMMIT;
