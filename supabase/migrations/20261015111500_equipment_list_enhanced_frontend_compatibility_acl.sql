-- Keep the frontend compatibility adapter private to authenticated callers.
REVOKE EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text, bigint, text[], text[], text[], text[], text[], text[], text,
  text, integer, integer, boolean
) FROM anon;

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  text, bigint, text[], text[], text[], text[], text[], text[], text,
  text, integer, integer, boolean
) TO authenticated, service_role;
