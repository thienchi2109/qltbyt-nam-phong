-- TM-06 cases are materialized from the first immutable breach event, not current policy.
BEGIN;
CREATE TABLE public.temperature_monitoring_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL UNIQUE REFERENCES public.temperature_readings(id),
  triggering_event_id UUID NOT NULL UNIQUE REFERENCES public.temperature_monitoring_reading_events(id),
  equipment_id BIGINT NOT NULL REFERENCES public.thiet_bi(id),
  monitoring_date DATE NOT NULL,
  triggering_snapshot JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Nhẹ' CHECK (severity IN ('Nhẹ','Nghiêm trọng','Khẩn cấp')),
  status TEXT NOT NULL DEFAULT 'Mở' CHECK (status IN ('Mở','Đang xử lý','Chờ xác minh','Đã đóng','Đã hủy')),
  immediate_action TEXT CHECK (length(immediate_action)<=2000 AND immediate_action ~ '[^[:space:]]'),
  owner_user_id BIGINT REFERENCES public.nhan_vien(id),
  due_at TIMESTAMPTZ CHECK (isfinite(due_at)),
  cause TEXT CHECK (length(cause)<=2000 AND cause ~ '[^[:space:]]'),
  evidence TEXT CHECK (length(evidence)<=2000 AND evidence ~ '[^[:space:]]'),
  verification_result TEXT CHECK (length(verification_result)<=2000 AND verification_result ~ '[^[:space:]]'),
  repair_request_id INTEGER REFERENCES public.yeu_cau_sua_chua(id),
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision>=0),
  created_by BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (status<>'Đã đóng' OR (immediate_action IS NOT NULL AND verification_result IS NOT NULL))
);
CREATE INDEX temperature_deviations_date_idx ON public.temperature_monitoring_deviations(monitoring_date,id);
CREATE INDEX temperature_deviations_equipment_date_idx ON public.temperature_monitoring_deviations(equipment_id,monitoring_date,id);
CREATE INDEX temperature_deviations_repair_idx ON public.temperature_monitoring_deviations(repair_request_id) WHERE repair_request_id IS NOT NULL;
CREATE TABLE public.temperature_monitoring_deviation_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deviation_id UUID NOT NULL REFERENCES public.temperature_monitoring_deviations(id),
  action TEXT NOT NULL CHECK (action IN ('opened','update_action','assign','severity','start','submit_verification','close','cancel','link_repair')),
  request_id UUID,
  request_payload JSONB,
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT,
  actor_user_id BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(deviation_id,request_id),
  CHECK (action='opened' OR (request_id IS NOT NULL AND request_payload IS NOT NULL AND before_state IS NOT NULL))
);
CREATE TRIGGER temperature_deviation_events_immutable BEFORE UPDATE OR DELETE ON public.temperature_monitoring_deviation_events
FOR EACH ROW EXECUTE FUNCTION public.temperature_monitoring_reading_immutable();
ALTER TABLE public.temperature_monitoring_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temperature_monitoring_deviation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.temperature_monitoring_deviations,public.temperature_monitoring_deviation_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.temperature_monitoring_deviation_events_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public._temperature_monitoring_deviation_owner(p_owner BIGINT,p_equipment BIGINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.nhan_vien n JOIN public.thiet_bi t ON t.id=p_equipment
    WHERE n.id=p_owner AND COALESCE(n.is_active,TRUE) AND COALESCE(n.current_don_vi,n.don_vi)=t.don_vi
    AND public._normalize_department_scope(n.khoa_phong)=public._normalize_department_scope(t.khoa_phong_quan_ly));
$$;

CREATE FUNCTION public._temperature_monitoring_deviation_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'deviations cannot be deleted' USING ERRCODE='55000'; END IF;
  IF (NEW.id,NEW.reading_id,NEW.triggering_event_id,NEW.equipment_id,NEW.monitoring_date,NEW.triggering_snapshot,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.reading_id,OLD.triggering_event_id,OLD.equipment_id,OLD.monitoring_date,OLD.triggering_snapshot,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'triggering deviation snapshot is immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER temperature_deviation_guard BEFORE UPDATE OR DELETE ON public.temperature_monitoring_deviations
FOR EACH ROW EXECUTE FUNCTION public._temperature_monitoring_deviation_guard();

CREATE FUNCTION public._temperature_monitoring_materialize_deviation(p_event public.temperature_monitoring_reading_events)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  reading public.temperature_readings;
  owner_id BIGINT;
  deviation public.temperature_monitoring_deviations;
BEGIN
  IF p_event.event_type<>'deviation_created' THEN RETURN; END IF;
  SELECT r.* INTO STRICT reading FROM public.temperature_readings r WHERE id=p_event.reading_id;
  SELECT v.responsible_primary_user_id INTO owner_id FROM public.temperature_monitoring_configuration_versions v
  WHERE v.id=reading.configuration_version_id;
  IF NOT public._temperature_monitoring_deviation_owner(owner_id,reading.equipment_id) THEN owner_id:=NULL; END IF;
  INSERT INTO public.temperature_monitoring_deviations(reading_id,triggering_event_id,equipment_id,monitoring_date,
    triggering_snapshot,owner_user_id,created_by,created_at,updated_at)
  VALUES(reading.id,p_event.id,reading.equipment_id,reading.monitoring_date,p_event.after_state,owner_id,
    p_event.actor_user_id,p_event.created_at,p_event.created_at)
  ON CONFLICT(reading_id) DO NOTHING RETURNING * INTO deviation;
  IF FOUND THEN
    INSERT INTO public.temperature_monitoring_deviation_events(deviation_id,action,after_state,actor_user_id,created_at)
    VALUES(deviation.id,'opened',to_jsonb(deviation),p_event.actor_user_id,p_event.created_at);
  END IF;
END;
$$;
CREATE FUNCTION public._temperature_monitoring_breach_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public._temperature_monitoring_materialize_deviation(NEW);
  RETURN NEW;
END;
$$;
CREATE TRIGGER temperature_monitoring_breach_insert AFTER INSERT ON public.temperature_monitoring_reading_events
FOR EACH ROW WHEN (NEW.event_type='deviation_created') EXECUTE FUNCTION public._temperature_monitoring_breach_insert();
DO $$
DECLARE event public.temperature_monitoring_reading_events;
BEGIN
  FOR event IN SELECT * FROM public.temperature_monitoring_reading_events WHERE event_type='deviation_created' LOOP
    PERFORM public._temperature_monitoring_materialize_deviation(event);
  END LOOP;
END;
$$;

-- Status and repair lifecycle stay independent; only linked equipment identity is fixed.
CREATE FUNCTION public._temperature_monitoring_repair_link_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.thiet_bi_id IS DISTINCT FROM OLD.thiet_bi_id AND EXISTS(
    SELECT 1 FROM public.temperature_monitoring_deviations WHERE repair_request_id=OLD.id) THEN
    RAISE EXCEPTION 'linked repair equipment cannot change; unlink explicitly first' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER temperature_monitoring_repair_link_guard BEFORE UPDATE OF thiet_bi_id ON public.yeu_cau_sua_chua
FOR EACH ROW EXECUTE FUNCTION public._temperature_monitoring_repair_link_guard();
REVOKE ALL ON FUNCTION public._temperature_monitoring_deviation_owner(BIGINT,BIGINT),
  public._temperature_monitoring_deviation_guard(),public._temperature_monitoring_materialize_deviation(public.temperature_monitoring_reading_events),
  public._temperature_monitoring_breach_insert(),public._temperature_monitoring_repair_link_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
