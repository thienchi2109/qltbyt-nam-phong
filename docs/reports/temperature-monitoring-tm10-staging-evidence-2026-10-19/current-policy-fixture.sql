-- Disposable-only fixture: make today's slot eligible without editing the UI-created future policy.
BEGIN;
DO $$
BEGIN
  IF current_database()<>'tm10_staging_20261019_a834aafee'
    OR NOT EXISTS(SELECT 1 FROM public.thiet_bi WHERE id=9679 AND ma_thiet_bi='TM10-STAGING-20261019')
    OR (SELECT count(*) FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=9679)<>1
    OR EXISTS(SELECT 1 FROM public.temperature_readings WHERE equipment_id=9679)
  THEN RAISE EXCEPTION 'fixture target/state mismatch'; END IF;
END $$;
WITH fixture AS (
  INSERT INTO public.temperature_monitoring_configuration_versions(
    equipment_id,effective_period,monitoring_enabled,lower_c,upper_c,schedule_profile_id,
    display_timezone,responsible_primary_user_id,responsible_substitute_user_ids,
    recording_method_code,change_reason,created_by
  )
  SELECT equipment_id,tstzrange(((now() AT TIME ZONE display_timezone)::date-1)::timestamp AT TIME ZONE display_timezone,lower(effective_period),'[)'),
    TRUE,lower_c,upper_c,schedule_profile_id,display_timezone,responsible_primary_user_id,
    responsible_substitute_user_ids,recording_method_code,
    'TM10 disposable historical fixture for same-day browser measurement; UI initial activation remains tomorrow',created_by
  FROM public.temperature_monitoring_configuration_versions
  WHERE equipment_id=9679 AND lower(effective_period)>now()
  RETURNING *
)
INSERT INTO public.temperature_monitoring_configuration_audit(equipment_id,version_id,event_type,before_state,after_state,reason,actor_user_id)
SELECT equipment_id,id,'enable',NULL,to_jsonb(fixture),change_reason,created_by FROM fixture;
UPDATE public.temperature_monitoring_configurations SET monitoring_enabled=TRUE,updated_at=now() WHERE equipment_id=9679;
COMMIT;
SELECT 'DISPOSABLE FIXTURE ONLY',count(*) FROM public.temperature_monitoring_configuration_versions WHERE equipment_id=9679;
