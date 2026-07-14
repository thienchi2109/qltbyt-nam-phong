-- OpenSpec Phase P4: baseline versioning, irreversible locking, history, and copy.
BEGIN;
ALTER TABLE public.technical_configuration_baseline_versions
  ADD COLUMN source_baseline_version_id UUID,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by BIGINT;
ALTER TABLE public.technical_configuration_baseline_versions
  ADD CONSTRAINT technical_configuration_baseline_versions_id_dossier_key
    UNIQUE (id, dossier_id),
  ADD CONSTRAINT technical_configuration_baseline_versions_source_fkey
    FOREIGN KEY (source_baseline_version_id, dossier_id)
    REFERENCES public.technical_configuration_baseline_versions (id, dossier_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT technical_configuration_baseline_versions_source_not_self_check
    CHECK (source_baseline_version_id IS NULL OR source_baseline_version_id <> id),
  ADD CONSTRAINT technical_configuration_baseline_versions_lock_state_check
    CHECK (
      (
        status = 'draft'
        AND locked_at IS NULL
        AND locked_by IS NULL
      )
      OR
      (
        status = 'locked'
        AND locked_at IS NOT NULL
        AND locked_by IS NOT NULL
      )
    );
CREATE INDEX technical_configuration_baseline_versions_source_idx
  ON public.technical_configuration_baseline_versions (source_baseline_version_id)
  WHERE source_baseline_version_id IS NOT NULL;
-- Issue #746: P4 starts populating source_criterion_id during baseline copy.
CREATE INDEX technical_configuration_baseline_criteria_source_idx
  ON public.technical_configuration_baseline_criteria (source_criterion_id)
  WHERE source_criterion_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public._technical_configuration_baseline_snapshot(p_baseline_version_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH criteria_by_group AS (
    SELECT
      c.group_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'baseline_version_id', c.baseline_version_id,
          'group_id', c.group_id,
          'criterion_code', c.criterion_code,
          'title', c.title,
          'requirement_text', c.requirement_text,
          'sort_order', c.sort_order,
          'source_criterion_id', c.source_criterion_id,
          'created_at', c.created_at,
          'created_by', c.created_by,
          'updated_at', c.updated_at,
          'updated_by', c.updated_by
        )
        ORDER BY c.sort_order, c.id
      ) AS criteria
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_baseline_version_id
    GROUP BY c.group_id
  ),
  groups_by_version AS (
    SELECT
      g.baseline_version_id,
      jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'baseline_version_id', g.baseline_version_id,
          'name', g.name,
          'sort_order', g.sort_order,
          'created_at', g.created_at,
          'created_by', g.created_by,
          'updated_at', g.updated_at,
          'updated_by', g.updated_by,
          'criteria', COALESCE(cbg.criteria, '[]'::JSONB)
        )
        ORDER BY g.sort_order, g.id
      ) AS groups
    FROM public.technical_configuration_baseline_groups g
    LEFT JOIN criteria_by_group cbg ON cbg.group_id = g.id
    WHERE g.baseline_version_id = p_baseline_version_id
    GROUP BY g.baseline_version_id
  )
  SELECT jsonb_build_object(
    'id', v.id,
    'dossier_id', v.dossier_id,
    'version_number', v.version_number,
    'status', v.status,
    'source_baseline_version_id', v.source_baseline_version_id,
    'next_criterion_number', v.next_criterion_number,
    'revision', v.revision,
    'locked_at', v.locked_at,
    'locked_by', v.locked_by,
    'created_at', v.created_at,
    'created_by', v.created_by,
    'updated_at', v.updated_at,
    'updated_by', v.updated_by,
    'groups', COALESCE(gbv.groups, '[]'::JSONB)
  )
  FROM public.technical_configuration_baseline_versions v
  LEFT JOIN groups_by_version gbv ON gbv.baseline_version_id = v.id
  WHERE v.id = p_baseline_version_id;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_draft_create(
  p_dossier_id UUID, p_expected_revision BIGINT)
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
  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_version_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.dossier_id = p_dossier_id;
  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id,
    version_number,
    created_by,
    updated_by
  )
  VALUES (p_dossier_id, v_version_number, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;
  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id,
    name,
    sort_order,
    created_by,
    updated_by
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
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_versions_list(
  p_dossier_id UUID, p_page INTEGER DEFAULT 1, p_page_size INTEGER DEFAULT 20)
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
     OR NOT (p_page_size BETWEEN 1 AND 100) THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  PERFORM 1
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_dossier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  WITH paged AS (
    SELECT v.id, v.version_number
    FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = p_dossier_id
    ORDER BY v.version_number DESC, v.id
    LIMIT p_page_size
    OFFSET (p_page - 1)::BIGINT * p_page_size
  )
  SELECT jsonb_build_object(
    'data',
    COALESCE(
      (
        SELECT jsonb_agg(
          public._technical_configuration_baseline_snapshot(p.id)
          ORDER BY p.version_number DESC, p.id
        )
        FROM paged p
      ),
      '[]'::JSONB
    ),
    'total',
    (
      SELECT count(*)
      FROM public.technical_configuration_baseline_versions v
      WHERE v.dossier_id = p_dossier_id
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
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_lock(
  p_baseline_version_id UUID, p_expected_revision BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_group_count BIGINT;
  v_criterion_count BIGINT;
  v_distinct_code_count BIGINT;
BEGIN
  v_user_id := public._technical_configuration_require_editable_baseline_version(
    p_baseline_version_id,
    p_expected_revision
  );
  SELECT COUNT(*)
  INTO v_group_count
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = p_baseline_version_id;
  SELECT
    COUNT(*),
    COUNT(DISTINCT c.criterion_code)
  INTO
    v_criterion_count,
    v_distinct_code_count
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = p_baseline_version_id
    AND btrim(c.requirement_text) <> '';
  -- P5 must extend this function when persisted import-error state exists.
  IF v_group_count < 1
     OR v_criterion_count < 1
     OR v_distinct_code_count <> v_criterion_count THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  UPDATE public.technical_configuration_baseline_versions
  SET status = 'locked',
      locked_at = now(),
      locked_by = v_user_id,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_baseline_version_id;
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(p_baseline_version_id)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy(
  p_source_baseline_version_id UUID, p_expected_revision BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_archived_at TIMESTAMPTZ;
  v_source_status TEXT;
  v_source_revision BIGINT;
  v_next_criterion_number BIGINT;
  v_version_number BIGINT;
  v_new_version_id UUID;
  v_new_group_id UUID;
  v_dossier_revision BIGINT;
  v_source_group RECORD;
BEGIN
  v_user_id := public._technical_configuration_require_global_user();
  SELECT v.dossier_id
  INTO v_dossier_id
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT d.archived_at
  INTO v_archived_at
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT
    v.status,
    v.revision,
    v.next_criterion_number
  INTO
    v_source_status,
    v_source_revision,
    v_next_criterion_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = p_source_baseline_version_id
    AND v.dossier_id = v_dossier_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409';
  END IF;
  IF v_source_status <> 'locked' THEN
    RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422';
  END IF;
  IF v_source_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = v_dossier_id
      AND v.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'draft_already_exists' USING ERRCODE = 'PT409';
  END IF;
  SELECT COALESCE(MAX(v.version_number), 0) + 1
  INTO v_version_number
  FROM public.technical_configuration_baseline_versions v
  WHERE v.dossier_id = v_dossier_id;
  v_new_version_id := gen_random_uuid();
  INSERT INTO public.technical_configuration_baseline_versions (
    id,
    dossier_id,
    version_number,
    status,
    source_baseline_version_id,
    next_criterion_number,
    revision,
    created_by,
    updated_by
  )
  VALUES (
    v_new_version_id,
    v_dossier_id,
    v_version_number,
    'draft',
    p_source_baseline_version_id,
    v_next_criterion_number,
    1,
    v_user_id,
    v_user_id
  );
  FOR v_source_group IN
    SELECT g.id, g.name, g.sort_order
    FROM public.technical_configuration_baseline_groups g
    WHERE g.baseline_version_id = p_source_baseline_version_id
    ORDER BY g.sort_order, g.id
  LOOP
    v_new_group_id := gen_random_uuid();
    INSERT INTO public.technical_configuration_baseline_groups (
      id,
      baseline_version_id,
      name,
      sort_order,
      created_by,
      updated_by
    )
    VALUES (
      v_new_group_id,
      v_new_version_id,
      v_source_group.name,
      v_source_group.sort_order,
      v_user_id,
      v_user_id
    );
    INSERT INTO public.technical_configuration_baseline_criteria (
      id,
      baseline_version_id,
      group_id,
      criterion_code,
      title,
      requirement_text,
      sort_order,
      source_criterion_id,
      created_by,
      updated_by
    )
    SELECT
      gen_random_uuid(),
      v_new_version_id,
      v_new_group_id,
      c.criterion_code,
      c.title,
      c.requirement_text,
      c.sort_order,
      c.id,
      v_user_id,
      v_user_id
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.baseline_version_id = p_source_baseline_version_id
      AND c.group_id = v_source_group.id
    ORDER BY c.sort_order, c.id;
  END LOOP;
  -- P7A/P7B extend this RPC after adding their baseline-owned leaf tables.
  UPDATE public.technical_configuration_dossiers
  SET revision = revision + 1,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = v_dossier_id
  RETURNING revision INTO v_dossier_revision;
  RETURN jsonb_build_object(
    'data',
    public._technical_configuration_baseline_snapshot(v_new_version_id)
      || jsonb_build_object('dossier_revision', v_dossier_revision)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_lock(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_lock(UUID, BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_copy(UUID, BIGINT) TO authenticated;
COMMIT;
