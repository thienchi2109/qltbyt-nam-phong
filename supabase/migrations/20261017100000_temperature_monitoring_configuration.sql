-- TM-02: per-equipment temperature monitoring configuration and immutable policy versions.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_schedule_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_recording_methods (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_configurations (
  equipment_id BIGINT PRIMARY KEY REFERENCES public.thiet_bi(id),
  monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id BIGINT NOT NULL REFERENCES public.thiet_bi(id),
  effective_period TSTZRANGE NOT NULL,
  lower_c NUMERIC(6,1) NOT NULL,
  upper_c NUMERIC(6,1) NOT NULL,
  schedule_profile_id UUID REFERENCES public.temperature_monitoring_schedule_profiles(id),
  display_timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  responsible_primary_user_id BIGINT REFERENCES public.nhan_vien(id),
  responsible_substitute_user_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  recording_method_code TEXT REFERENCES public.temperature_monitoring_recording_methods(code),
  change_reason TEXT NOT NULL,
  created_by BIGINT REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT temperature_monitoring_versions_period_valid CHECK (NOT isempty(effective_period)),
  CONSTRAINT temperature_monitoring_versions_limits_order CHECK (lower_c < upper_c),
  CONSTRAINT temperature_monitoring_versions_limits_finite CHECK (lower_c NOT IN ('Infinity'::NUMERIC, '-Infinity'::NUMERIC) AND upper_c NOT IN ('Infinity'::NUMERIC, '-Infinity'::NUMERIC)),
  CONSTRAINT temperature_monitoring_versions_timezone_nonempty CHECK (btrim(display_timezone) <> ''),
  CONSTRAINT temperature_monitoring_versions_reason_nonempty CHECK (btrim(change_reason) <> '')
);

ALTER TABLE public.temperature_monitoring_configuration_versions
  DROP CONSTRAINT IF EXISTS temperature_monitoring_versions_no_overlap;
ALTER TABLE public.temperature_monitoring_configuration_versions
  ADD CONSTRAINT temperature_monitoring_versions_no_overlap
  EXCLUDE USING GIST (equipment_id WITH =, effective_period WITH &&);

CREATE TABLE IF NOT EXISTS public.temperature_monitoring_configuration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id BIGINT NOT NULL REFERENCES public.thiet_bi(id),
  version_id UUID REFERENCES public.temperature_monitoring_configuration_versions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('create','version','enable','disable')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
  actor_user_id BIGINT REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'temperature_monitoring_configuration_audit is append-only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS temperature_monitoring_configuration_audit_immutable_trg
  ON public.temperature_monitoring_configuration_audit;
CREATE TRIGGER temperature_monitoring_configuration_audit_immutable_trg
  BEFORE UPDATE OR DELETE ON public.temperature_monitoring_configuration_audit
  FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_configuration_audit_immutable();

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_upsert(
  p_equipment_id BIGINT,
  p_monitoring_enabled BOOLEAN,
  p_effective_from TIMESTAMPTZ DEFAULT NULL,
  p_effective_to TIMESTAMPTZ DEFAULT NULL,
  p_lower_c NUMERIC DEFAULT NULL,
  p_upper_c NUMERIC DEFAULT NULL,
  p_schedule_profile_id UUID DEFAULT NULL,
  p_display_timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  p_responsible_primary_user_id BIGINT DEFAULT NULL,
  p_responsible_substitute_user_ids BIGINT[] DEFAULT '{}'::BIGINT[],
  p_recording_method_code TEXT DEFAULT NULL,
  p_change_reason TEXT DEFAULT NULL
) RETURNS public.temperature_monitoring_configurations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_user_id BIGINT := NULLIF(v_claims->>'user_id','')::BIGINT;
  v_don_vi BIGINT := NULLIF(v_claims->>'don_vi','')::BIGINT;
  v_equipment_don_vi BIGINT;
  v_cfg public.temperature_monitoring_configurations;
  v_period TSTZRANGE;
  v_after JSONB;
  v_has_existing BOOLEAN;
BEGIN
  IF v_role NOT IN ('to_qltb','manager','global','admin') THEN
    RAISE EXCEPTION 'temperature monitoring configuration requires equipment manager role' USING ERRCODE = '42501';
  END IF;
  SELECT don_vi INTO v_equipment_don_vi FROM public.thiet_bi WHERE id = p_equipment_id AND COALESCE(is_deleted,FALSE) = FALSE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment not found' USING ERRCODE = 'P0002'; END IF;
  IF v_role NOT IN ('global','admin') AND (v_don_vi IS NULL OR v_equipment_don_vi IS DISTINCT FROM v_don_vi) THEN
    RAISE EXCEPTION 'equipment is outside tenant scope' USING ERRCODE = '42501';
  END IF;
  IF p_change_reason IS NULL OR btrim(p_change_reason) = '' THEN
    RAISE EXCEPTION 'change reason is required' USING ERRCODE = '22023';
  END IF;
  IF p_monitoring_enabled AND (p_lower_c IS NULL OR p_upper_c IS NULL OR p_schedule_profile_id IS NULL OR p_responsible_primary_user_id IS NULL OR p_recording_method_code IS NULL) THEN
    RAISE EXCEPTION 'monitoring configuration is incomplete' USING ERRCODE = '22023';
  END IF;
  IF p_responsible_primary_user_id IS NOT NULL AND v_role NOT IN ('global','admin') AND NOT EXISTS (SELECT 1 FROM public.nhan_vien n WHERE n.id = p_responsible_primary_user_id AND n.don_vi = v_don_vi) THEN
    RAISE EXCEPTION 'responsible user is outside tenant scope' USING ERRCODE = '42501';
  END IF;
  IF p_effective_from IS NOT NULL THEN
    v_period := tstzrange(p_effective_from, p_effective_to, '[)');
    IF p_effective_from < now() THEN
      IF to_regclass('public.temperature_monitoring_slots') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.temperature_monitoring_slots WHERE equipment_id = $1 AND slot_start >= $2)' INTO v_has_existing USING p_equipment_id, p_effective_from;
        IF v_has_existing THEN RAISE EXCEPTION 'effective start cannot precede existing slots' USING ERRCODE = '22023'; END IF;
      END IF;
      IF to_regclass('public.temperature_readings') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.temperature_readings WHERE equipment_id = $1 AND captured_at >= $2)' INTO v_has_existing USING p_equipment_id, p_effective_from;
        IF v_has_existing THEN RAISE EXCEPTION 'effective start cannot precede existing readings' USING ERRCODE = '22023'; END IF;
      END IF;
    END IF;
    INSERT INTO public.temperature_monitoring_configuration_versions (equipment_id,effective_period,lower_c,upper_c,schedule_profile_id,display_timezone,responsible_primary_user_id,responsible_substitute_user_ids,recording_method_code,change_reason,created_by)
    VALUES (p_equipment_id,v_period,p_lower_c,p_upper_c,p_schedule_profile_id,COALESCE(NULLIF(btrim(p_display_timezone),''),'Asia/Ho_Chi_Minh'),p_responsible_primary_user_id,COALESCE(p_responsible_substitute_user_ids,'{}'),p_recording_method_code,p_change_reason,v_user_id)
    RETURNING jsonb_build_object('version_id',id,'effective_period',effective_period,'lower_c',lower_c,'upper_c',upper_c,'schedule_profile_id',schedule_profile_id,'display_timezone',display_timezone,'responsible_primary_user_id',responsible_primary_user_id,'recording_method_code',recording_method_code) INTO v_after;
  ELSE
    v_after := '{}'::jsonb;
  END IF;
  INSERT INTO public.temperature_monitoring_configurations (equipment_id,monitoring_enabled) VALUES (p_equipment_id,p_monitoring_enabled)
  ON CONFLICT (equipment_id) DO UPDATE SET monitoring_enabled = EXCLUDED.monitoring_enabled, updated_at = now()
  RETURNING * INTO v_cfg;
  INSERT INTO public.temperature_monitoring_configuration_audit (equipment_id,version_id,event_type,after_state,reason,actor_user_id)
  VALUES (p_equipment_id,(v_after->>'version_id')::UUID,CASE WHEN p_monitoring_enabled THEN CASE WHEN v_after='{}'::jsonb THEN 'enable' ELSE 'version' END ELSE 'disable' END,v_after,p_change_reason,v_user_id);
  RETURN v_cfg;
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_get(p_equipment_id BIGINT)
RETURNS TABLE (equipment_id BIGINT, monitoring_enabled BOOLEAN, version_id UUID, effective_period TSTZRANGE, lower_c NUMERIC, upper_c NUMERIC, schedule_profile_id UUID, display_timezone TEXT, responsible_primary_user_id BIGINT, responsible_substitute_user_ids BIGINT[], recording_method_code TEXT, configuration_complete BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_don_vi BIGINT := NULLIF(v_claims->>'don_vi','')::BIGINT;
  v_equipment_don_vi BIGINT;
BEGIN
  SELECT t.don_vi INTO v_equipment_don_vi FROM public.thiet_bi t WHERE t.id = p_equipment_id;
  IF NOT FOUND OR (v_role NOT IN ('global','admin') AND (v_don_vi IS NULL OR v_equipment_don_vi IS DISTINCT FROM v_don_vi)) THEN
    RAISE EXCEPTION 'equipment is outside tenant scope' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.equipment_id,c.monitoring_enabled,v.id,v.effective_period,v.lower_c,v.upper_c,v.schedule_profile_id,v.display_timezone,v.responsible_primary_user_id,v.responsible_substitute_user_ids,v.recording_method_code,
    (v.responsible_primary_user_id IS NOT NULL AND v.recording_method_code IS NOT NULL AND v.schedule_profile_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.temperature_monitoring_schedule_profiles s WHERE s.id=v.schedule_profile_id AND s.is_active) AND EXISTS (SELECT 1 FROM public.temperature_monitoring_recording_methods m WHERE m.code=v.recording_method_code AND m.is_active))
  FROM public.temperature_monitoring_configurations c
  LEFT JOIN LATERAL (SELECT * FROM public.temperature_monitoring_configuration_versions x WHERE x.equipment_id=c.equipment_id AND x.effective_period @> now() ORDER BY lower(x.effective_period) DESC LIMIT 1) v ON TRUE
  WHERE c.equipment_id=p_equipment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_history(p_equipment_id BIGINT)
RETURNS SETOF public.temperature_monitoring_configuration_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT := lower(COALESCE(NULLIF(v_claims->>'app_role',''), NULLIF(v_claims->>'role','')));
  v_don_vi BIGINT := NULLIF(v_claims->>'don_vi','')::BIGINT;
BEGIN
  IF v_role NOT IN ('global','admin') AND NOT EXISTS (SELECT 1 FROM public.thiet_bi t WHERE t.id=p_equipment_id AND t.don_vi=v_don_vi) THEN
    RAISE EXCEPTION 'equipment is outside tenant scope' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT v.* FROM public.temperature_monitoring_configuration_versions v WHERE v.equipment_id=p_equipment_id ORDER BY lower(v.effective_period);
END;
$$;

REVOKE ALL ON FUNCTION public.temperature_monitoring_configuration_upsert(BIGINT,BOOLEAN,TIMESTAMPTZ,TIMESTAMPTZ,NUMERIC,NUMERIC,UUID,TEXT,BIGINT,BIGINT[],TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_configuration_upsert(BIGINT,BOOLEAN,TIMESTAMPTZ,TIMESTAMPTZ,NUMERIC,NUMERIC,UUID,TEXT,BIGINT,BIGINT[],TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.temperature_monitoring_configuration_get(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_configuration_get(BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.temperature_monitoring_configuration_history(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_configuration_history(BIGINT) TO authenticated;

