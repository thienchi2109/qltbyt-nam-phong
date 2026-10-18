-- TM-07: bounded dated inbox with independent-review exclusions and full scoped counts.
BEGIN;
CREATE FUNCTION public.temperature_monitoring_notification_summary(p_from_date DATE DEFAULT CURRENT_DATE-29,p_to_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor BIGINT; role_name TEXT; result JSONB;
BEGIN
  BEGIN
    actor:=NULLIF(current_setting('request.jwt.claims',TRUE)::JSONB->>'user_id','')::BIGINT;
    role_name:=lower(COALESCE(current_setting('request.jwt.claims',TRUE)::JSONB->>'app_role',current_setting('request.jwt.claims',TRUE)::JSONB->>'role'));
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501'; END;
  WITH slots AS MATERIALIZED (
    SELECT s.* FROM public._temperature_monitoring_slot_rows(p_from_date,p_to_date,NULL,NULL,FALSE) s
  ), latest AS (
    SELECT DISTINCT ON(e.reading_id) e.reading_id,e.after_state FROM slots s
    JOIN public.temperature_readings r USING(equipment_id,monitoring_date,shift_id)
    JOIN public.temperature_monitoring_reading_events e ON e.reading_id=r.id
    WHERE e.event_type NOT IN ('reading_created','deviation_created') ORDER BY e.reading_id,e.event_sequence DESC
  ), pending AS (
    SELECT s.equipment_id,s.equipment_name,s.monitoring_date,r.id AS reading_id,'review'::TEXT AS kind
    FROM slots s JOIN public.temperature_readings r USING(equipment_id,monitoring_date,shift_id)
    LEFT JOIN latest l ON l.reading_id=r.id
    LEFT JOIN public.temperature_reading_amendments a ON a.id=(l.after_state->>'pending_amendment_id')::UUID
    WHERE role_name IN ('global','admin','to_qltb') AND r.operator_user_id<>actor
      AND COALESCE((l.after_state->'effective'->>'author_user_id')::BIGINT,r.operator_user_id)<>actor
      AND (a.author_user_id IS NULL OR a.author_user_id<>actor)
      AND COALESCE((l.after_state->>'review_required')::BOOLEAN,r.status<>'Đã ghi')
  ), deviations AS (
    SELECT s.equipment_id,s.equipment_name,s.monitoring_date,d.reading_id,'deviation'::TEXT AS kind
    FROM slots s JOIN public.temperature_monitoring_deviations d USING(equipment_id,monitoring_date)
    JOIN public.temperature_readings r ON r.id=d.reading_id AND r.shift_id=s.shift_id
    WHERE d.status NOT IN ('Đã đóng','Đã hủy')
  ), inbox AS (
    SELECT * FROM pending UNION ALL SELECT * FROM deviations
  ), limited AS (SELECT * FROM inbox ORDER BY monitoring_date,equipment_id,reading_id,kind LIMIT 20)
  SELECT jsonb_build_object('pending_review',(SELECT count(*) FROM pending),'open_deviations',(SELECT count(*) FROM deviations),
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.monitoring_date,i.equipment_id,i.reading_id,i.kind) FROM limited i),'[]'),
    'from_date',p_from_date,'to_date',p_to_date) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_notification_summary(DATE,DATE) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_notification_summary(DATE,DATE) TO authenticated;
COMMIT;
