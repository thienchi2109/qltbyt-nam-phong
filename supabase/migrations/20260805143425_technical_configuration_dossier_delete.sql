-- Purpose: add the dormant dossier hard-delete contract and additive can_delete field.
-- Rollback (forward-only): restore technical_configuration_dossiers_list from
-- 20260712112500_technical_configuration_dossier_foundation.sql, then
-- DROP FUNCTION public.technical_configuration_dossiers_delete(UUID, BIGINT).
BEGIN;

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

  WITH dossier_page AS MATERIALIZED (
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
  ),
  locked_dossiers AS (
    SELECT DISTINCT v.dossier_id
    FROM public.technical_configuration_baseline_versions v
    JOIN dossier_page page
      ON page.id = v.dossier_id
    WHERE v.status = 'locked'
  ),
  paged AS (
    SELECT
      page.*,
      (
        page.archived_at IS NULL
        AND locked.dossier_id IS NULL
      ) AS can_delete
    FROM dossier_page page
    LEFT JOIN locked_dossiers locked
      ON locked.dossier_id = page.id
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
            'updated_by', p.updated_by,
            'can_delete', p.can_delete
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

CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_delete(
  p_id UUID,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_id UUID;
BEGIN
  PERFORM public._technical_configuration_require_editable_dossier(
    p_id,
    p_expected_revision
  );

  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.dossier_id = p_id
      AND v.status = 'locked'
  ) THEN
    RAISE EXCEPTION 'locked_dossier' USING ERRCODE = 'PT409';
  END IF;

  DELETE FROM public.technical_configuration_dossiers d
  WHERE d.id = p_id
  RETURNING d.id INTO v_deleted_id;

  RETURN jsonb_build_object(
    'data',
    jsonb_build_object(
      'id',
      v_deleted_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.technical_configuration_dossiers_delete(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_dossiers_delete(UUID, BIGINT)
  TO authenticated;

COMMENT ON FUNCTION public.technical_configuration_dossiers_delete(UUID, BIGINT) IS
  'Hard-deletes an active never-locked technical configuration dossier aggregate.';

COMMIT;
