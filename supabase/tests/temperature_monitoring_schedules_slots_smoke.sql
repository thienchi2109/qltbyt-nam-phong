-- TM-03 focused contract checks. Executed by the Oracle/static SQL harness.
BEGIN;

DO $$
DECLARE
  v_def TEXT;
BEGIN
  IF to_regclass('public.temperature_monitoring_schedule_shifts') IS NULL
     OR to_regclass('public.temperature_monitoring_schedule_shift_overrides') IS NULL THEN
    RAISE EXCEPTION 'TM-03 shift tables missing';
  END IF;
  IF (SELECT count(*) FROM public.temperature_monitoring_schedule_shifts s
      JOIN public.temperature_monitoring_schedule_profiles p ON p.id=s.schedule_profile_id
      WHERE p.code='default' AND s.code IN ('sang','chieu','toi','dem')) <> 4 THEN
    RAISE EXCEPTION 'default Sáng/Chiều/Tối/Đêm catalog missing';
  END IF;
  IF to_regprocedure('public.temperature_monitoring_slots_list(date,date,text[],bigint,text,integer,boolean)') IS NULL THEN
    RAISE EXCEPTION 'TM-03 slot projection RPC missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.temperature_monitoring_slots_list(date,date,text[],bigint,text,integer,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.temperature_monitoring_slots_list(date,date,text[],bigint,text,integer,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'TM-03 RPC grants are not fail-closed';
  END IF;
  v_def := pg_get_functiondef('public.temperature_monitoring_slots_list(date,date,text[],bigint,text,integer,boolean)'::regprocedure);
  IF position('monitoring date range cannot exceed 90 days' IN v_def) = 0
     OR position('invalid cursor' IN v_def) = 0
     OR position('Chưa ghi' IN v_def) = 0
     OR position('Asia/Ho_Chi_Minh' IN v_def) = 0
     OR position('Hoạt động' IN v_def) = 0
     OR position('effective_period' IN v_def) = 0 THEN
    RAISE EXCEPTION 'TM-03 projection guards missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.temperature_monitoring_schedule_shifts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.temperature_monitoring_schedule_shift_overrides', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated role can bypass TM-03 RPC boundary';
  END IF;
END;
$$;

ROLLBACK;
