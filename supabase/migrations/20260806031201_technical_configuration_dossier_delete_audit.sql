-- Purpose: add fail-closed audit evidence to the dormant P15A dossier hard-delete.
-- Rollback (forward-only): restore technical_configuration_dossiers_delete from
-- 20260805143425_technical_configuration_dossier_delete.sql.
BEGIN;

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
  v_dossier RECORD;
  v_audit_ok BOOLEAN;
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

  SELECT
    d.id,
    d.device_type_name,
    d.name,
    d.description,
    d.revision
  INTO v_dossier
  FROM public.technical_configuration_dossiers d
  WHERE d.id = p_id;

  v_audit_ok := public.audit_log(
    'technical_configuration_dossier_delete',
    'technical_configuration_dossier',
    NULL::BIGINT,
    v_dossier.name,
    jsonb_build_object(
      'dossier_id', v_dossier.id,
      'device_type_name', v_dossier.device_type_name,
      'name', v_dossier.name,
      'description', v_dossier.description,
      'revision', v_dossier.revision,
      'delete_kind', 'hard'
    )
  );
  IF v_audit_ok IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'audit_log_failed' USING ERRCODE = 'PT500';
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
  'Hard-deletes an active never-locked technical configuration dossier aggregate after fail-closed audit logging.';

COMMIT;
