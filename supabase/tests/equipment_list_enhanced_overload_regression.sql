-- Purpose: ensure equipment_list_enhanced has only the 17-parameter signature (no legacy p_fields overload).

DO $$
DECLARE
  v_overload_count integer;
  v_legacy_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_overload_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced';

  IF v_overload_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 equipment_list_enhanced overload, got %', v_overload_count;
  END IF;

  SELECT COUNT(*)
  INTO v_legacy_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'equipment_list_enhanced'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%p_fields text%';

  IF v_legacy_count <> 0 THEN
    RAISE EXCEPTION 'Legacy p_fields overload still exists';
  END IF;
END $$;
