-- P6A server activation after every production hierarchy reader is compatible.
BEGIN;

CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_apply_v2(
  p_baseline_version_id UUID,
  p_template_metadata JSONB,
  p_rows JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public._technical_configuration_baseline_import_apply_v2(
    p_baseline_version_id,
    p_template_metadata,
    p_rows,
    p_expected_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public._technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_import_apply_v2(UUID, JSONB, JSONB, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_create(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_update(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroup_delete(UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_subgroups_reorder(UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_create(UUID, UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_move(UUID, UUID, UUID, BIGINT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.technical_configuration_baseline_hierarchy_criteria_reorder(UUID, UUID, UUID[], BIGINT) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_subgroup_create(UUID, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_subgroup_update(UUID, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_subgroup_delete(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_subgroups_reorder(UUID, UUID[], BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_create(UUID, UUID, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_hierarchy_criterion_move(UUID, UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technical_configuration_baseline_hierarchy_criteria_reorder(UUID, UUID, UUID[], BIGINT) TO authenticated;

COMMIT;
