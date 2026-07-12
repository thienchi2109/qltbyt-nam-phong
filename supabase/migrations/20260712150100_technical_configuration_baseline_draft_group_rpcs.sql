-- Issue #744, Phase P2: baseline draft and group mutation RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_draft_create(
  p_dossier_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_dossier_revision BIGINT;
  v_version_id UUID;
  v_version_number BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_editable_dossier(
    p_dossier_id,
    p_expected_revision
  );

  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions
    WHERE dossier_id = p_dossier_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'draft_already_exists' USING ERRCODE = 'PT409';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM public.technical_configuration_baseline_versions
  WHERE dossier_id = p_dossier_id;

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, created_by, updated_by
  )
  VALUES (p_dossier_id, v_version_number, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;

  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES
    (v_version_id, 'Yêu cầu chung', 1, v_user_id, v_user_id),
    (v_version_id, 'Yêu cầu cấu hình cung cấp', 2, v_user_id, v_user_id),
    (v_version_id, 'Yêu cầu kỹ thuật', 3, v_user_id, v_user_id),
    (v_version_id, 'Yêu cầu khác', 4, v_user_id, v_user_id);

  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_dossier_id
  RETURNING revision INTO v_dossier_revision;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_version_id)
      || jsonb_build_object('dossier_revision', v_dossier_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_draft_get(
  p_dossier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version_id UUID;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT id INTO v_version_id
  FROM public.technical_configuration_baseline_versions
  WHERE dossier_id = p_dossier_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_version_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_group_create(
  p_baseline_version_id UUID,
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
  v_group_id UUID;
  v_revision BIGINT;
  v_sort_order INTEGER;
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_order
  FROM public.technical_configuration_baseline_groups
  WHERE baseline_version_id = p_baseline_version_id;

  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (p_baseline_version_id, btrim(p_name), v_sort_order, v_user_id, v_user_id)
  RETURNING id INTO v_group_id;

  v_revision := public._technical_configuration_baseline_bump_revision(
    p_baseline_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_group_payload(v_group_id, v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_group_update(
  p_group_id UUID,
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
  v_version_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_groups
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;

  UPDATE public.technical_configuration_baseline_groups
  SET name = btrim(p_name), updated_at = now(), updated_by = v_user_id
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_group_payload(p_group_id, v_revision)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_group_delete(
  p_group_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_version_id UUID;
  v_revision BIGINT;
BEGIN
  PERFORM public._technical_configuration_require_global_user();

  SELECT baseline_version_id INTO v_version_id
  FROM public.technical_configuration_baseline_groups
  WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  v_user_id := public._technical_configuration_require_editable_baseline_version(
    v_version_id,
    p_expected_revision
  );
  DELETE FROM public.technical_configuration_baseline_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY sort_order, id)::INTEGER AS new_order
    FROM public.technical_configuration_baseline_groups
    WHERE baseline_version_id = v_version_id
  )
  UPDATE public.technical_configuration_baseline_groups g
  SET sort_order = ordered.new_order, updated_at = now(), updated_by = v_user_id
  FROM ordered
  WHERE g.id = ordered.id AND g.sort_order <> ordered.new_order;

  v_revision := public._technical_configuration_baseline_bump_revision(
    v_version_id,
    v_user_id
  );
  RETURN jsonb_build_object('data', jsonb_build_object(
    'id', p_group_id,
    'revision', v_revision
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_draft_create(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_draft_create(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_draft_get(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_draft_get(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_group_create(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_group_create(UUID, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_group_update(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_group_update(UUID, TEXT, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_group_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_group_delete(UUID, BIGINT) TO authenticated;

COMMIT;
