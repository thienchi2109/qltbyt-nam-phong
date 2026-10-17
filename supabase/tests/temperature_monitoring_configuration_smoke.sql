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

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.temperature_monitoring_configuration_versions'::regclass
      AND tgname = 'temperature_monitoring_configuration_version_immutable_trg'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'immutable configuration version trigger missing';
  END IF;

  IF has_table_privilege('anon', 'public.temperature_monitoring_configuration_versions', 'SELECT') THEN
    RAISE EXCEPTION 'anonymous role can read configuration versions';
  END IF;

  FOREACH v_name IN ARRAY ARRAY[
    'temperature_monitoring_configurations',
    'temperature_monitoring_configuration_versions',
    'temperature_monitoring_configuration_audit',
    'temperature_monitoring_schedule_profiles',
    'temperature_monitoring_recording_methods'
  ] LOOP
    IF has_table_privilege('authenticated', 'public.' || v_name, 'SELECT')
       OR has_table_privilege('authenticated', 'public.' || v_name, 'INSERT')
       OR has_table_privilege('authenticated', 'public.' || v_name, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || v_name, 'DELETE') THEN
      RAISE EXCEPTION 'authenticated role has direct table privilege on %', v_name;
    END IF;
  END LOOP;

  IF to_regprocedure('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)') IS NULL
     OR to_regprocedure('public.temperature_monitoring_configuration_get(bigint)') IS NULL
     OR to_regprocedure('public.temperature_monitoring_configuration_history(bigint)') IS NULL THEN
    RAISE EXCEPTION 'TM-02 RPC seam missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.temperature_monitoring_configuration_get(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.temperature_monitoring_configuration_get(bigint)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.temperature_monitoring_configuration_history(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.temperature_monitoring_configuration_history(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TM-02 RPC grants are not fail-closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='temperature_monitoring_configuration_versions'
      AND column_name='monitoring_enabled' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'effective enablement snapshot missing';
  END IF;

  IF position('scale(p_lower_c) > 1' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('substitute user is outside tenant scope' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('substitute user does not exist' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('khoa_phong_quan_ly' IN pg_get_functiondef('public.temperature_monitoring_configuration_get(bigint)'::regprocedure)) = 0
     OR position('monitoring configuration is incomplete' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('effective start is required' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('disabled version cannot carry' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('v_role NOT IN (''to_qltb'',''global'',''admin'')' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('authenticated actor is required' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0
     OR position('v_before' IN pg_get_functiondef('public.temperature_monitoring_configuration_upsert(bigint,boolean,timestamptz,timestamptz,numeric,numeric,uuid,text,bigint,bigint[],text,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'TM-02 validation guards missing';
  END IF;
END;
$$;

ROLLBACK;
