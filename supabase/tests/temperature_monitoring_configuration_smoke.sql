-- TM-02 focused contract checks. Executed by the Oracle/static SQL harness.
BEGIN;

DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_name TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'temperature_monitoring_configurations',
    'temperature_monitoring_configuration_versions',
    'temperature_monitoring_configuration_audit',
    'temperature_monitoring_schedule_profiles',
    'temperature_monitoring_recording_methods'
  ] LOOP
    IF to_regclass('public.' || v_name) IS NULL THEN
      v_missing := array_append(v_missing, v_name);
    END IF;
  END LOOP;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'TM-02 tables missing: %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.temperature_monitoring_configuration_versions'::regclass
      AND contype = 'x' AND conname = 'temperature_monitoring_versions_no_overlap'
  ) THEN
    RAISE EXCEPTION 'effective-dated overlap guard missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.temperature_monitoring_configuration_audit'::regclass
      AND tgname = 'temperature_monitoring_configuration_audit_immutable_trg'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'append-only audit trigger missing';
  END IF;

  IF has_table_privilege('anon', 'public.temperature_monitoring_configuration_versions', 'SELECT') THEN
    RAISE EXCEPTION 'anonymous role can read configuration versions';
  END IF;

  IF to_regprocedure('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)') IS NULL
     OR to_regprocedure('public.temperature_monitoring_configuration_get(bigint)') IS NULL
     OR to_regprocedure('public.temperature_monitoring_configuration_history(bigint)') IS NULL THEN
    RAISE EXCEPTION 'TM-02 RPC seam missing';
  END IF;
END;
$$;

ROLLBACK;
