-- Bounded, scoped deviation queries expose inbox/history and independent repair links.
BEGIN;
CREATE INDEX temperature_deviation_events_history_idx ON public.temperature_monitoring_deviation_events(deviation_id,id);

CREATE FUNCTION public.temperature_monitoring_deviation_get(p_deviation_id UUID DEFAULT NULL,p_reading_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE deviation public.temperature_monitoring_deviations; reading JSONB; repair JSONB;
BEGIN
  IF (p_deviation_id IS NULL)=(p_reading_id IS NULL) THEN RAISE EXCEPTION 'provide case or reading id' USING ERRCODE='22023'; END IF;
  IF p_reading_id IS NOT NULL THEN
    reading:=public.temperature_monitoring_reading_get(p_reading_id);
  END IF;
  SELECT d.* INTO deviation FROM public.temperature_monitoring_deviations d
  WHERE (p_deviation_id IS NOT NULL AND d.id=p_deviation_id) OR (p_reading_id IS NOT NULL AND d.reading_id=p_reading_id);
  IF NOT FOUND AND reading IS NOT NULL THEN RETURN jsonb_build_object('deviation',NULL,'reading_state',reading); END IF;
  PERFORM public._temperature_monitoring_assert_scope(deviation.equipment_id);
  reading:=COALESCE(reading,public.temperature_monitoring_reading_get(deviation.reading_id));
  IF deviation.repair_request_id IS NOT NULL THEN repair:=public.repair_request_get(deviation.repair_request_id); END IF;
  RETURN jsonb_build_object('deviation',to_jsonb(deviation),'reading_state',reading,'repair_request',repair);
END;
$$;

CREATE FUNCTION public.temperature_monitoring_deviations_list(
  p_date_from DATE DEFAULT NULL,p_date_to DATE DEFAULT NULL,p_equipment_id BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,p_severity TEXT DEFAULT NULL,p_owner_user_id BIGINT DEFAULT NULL,
  p_repair_request_id INTEGER DEFAULT NULL,p_limit INTEGER DEFAULT 50,p_cursor JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB;
  actor BIGINT;
  tenant BIGINT;
  role_name TEXT;
  department TEXT;
  cursor_date DATE;
  cursor_id UUID;
  items JSONB;
  total BIGINT;
  open_count BIGINT;
  next_cursor JSONB;
BEGIN
  BEGIN
    claims:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor:=NULLIF(claims->>'user_id','')::BIGINT;
    tenant:=NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501';
  END;
  role_name:=lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department:=public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader')
    OR actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=actor)
    OR (role_name NOT IN ('global','admin') AND (tenant IS NULL OR department IS NULL)) THEN
    RAISE EXCEPTION 'authenticated temperature scope required' USING ERRCODE='42501';
  END IF;
  p_date_to:=COALESCE(p_date_to,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE);
  p_date_from:=COALESCE(p_date_from,p_date_to-29);
  IF NOT isfinite(p_date_from) OR NOT isfinite(p_date_to) OR p_date_to<p_date_from OR p_date_to-p_date_from>89
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
    OR (p_status IS NOT NULL AND p_status NOT IN ('Mở','Đang xử lý','Chờ xác minh','Đã đóng','Đã hủy'))
    OR (p_severity IS NOT NULL AND p_severity NOT IN ('Nhẹ','Nghiêm trọng','Khẩn cấp')) THEN
    RAISE EXCEPTION 'valid range up to 90 days, filters and page limit required' USING ERRCODE='22023';
  END IF;
  IF p_equipment_id IS NOT NULL THEN PERFORM public._temperature_monitoring_assert_scope(p_equipment_id); END IF;
  IF p_repair_request_id IS NOT NULL THEN PERFORM public.repair_request_get(p_repair_request_id); END IF;
  IF p_cursor IS NOT NULL THEN
    BEGIN
      IF jsonb_typeof(p_cursor)<>'object' OR p_cursor-ARRAY['monitoring_date','id']<>'{}'::JSONB THEN
        RAISE EXCEPTION 'invalid cursor';
      END IF;
      cursor_date:=(p_cursor->>'monitoring_date')::DATE; cursor_id:=(p_cursor->>'id')::UUID;
      IF cursor_date IS NULL OR cursor_id IS NULL OR NOT isfinite(cursor_date) OR cursor_date NOT BETWEEN p_date_from AND p_date_to THEN
        RAISE EXCEPTION 'invalid cursor';
      END IF;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'invalid cursor' USING ERRCODE='22023'; END;
  END IF;
  WITH scoped AS MATERIALIZED (
    SELECT d.* FROM public.temperature_monitoring_deviations d JOIN public.thiet_bi t ON t.id=d.equipment_id
    WHERE d.monitoring_date BETWEEN p_date_from AND p_date_to
      AND (role_name IN ('global','admin') OR (t.don_vi=tenant AND public._normalize_department_scope(t.khoa_phong_quan_ly)=department))
      AND (p_equipment_id IS NULL OR d.equipment_id=p_equipment_id) AND (p_status IS NULL OR d.status=p_status)
      AND (p_severity IS NULL OR d.severity=p_severity) AND (p_owner_user_id IS NULL OR d.owner_user_id=p_owner_user_id)
      AND (p_repair_request_id IS NULL OR d.repair_request_id=p_repair_request_id)
  ), page AS (
    SELECT s.* FROM scoped s WHERE p_cursor IS NULL OR (s.monitoring_date,s.id)<(cursor_date,cursor_id)
    ORDER BY s.monitoring_date DESC,s.id DESC LIMIT p_limit+1
  ) SELECT COALESCE(jsonb_agg(to_jsonb(page) ORDER BY page.monitoring_date DESC,page.id DESC),'[]'::JSONB),
    (SELECT count(*) FROM scoped),(SELECT count(*) FROM scoped WHERE status NOT IN ('Đã đóng','Đã hủy'))
    INTO items,total,open_count FROM page;
  IF jsonb_array_length(items)>p_limit THEN
    SELECT jsonb_agg(value ORDER BY ordinality) INTO items FROM jsonb_array_elements(items) WITH ORDINALITY WHERE ordinality<=p_limit;
    next_cursor:=jsonb_build_object('monitoring_date',items->(p_limit-1)->'monitoring_date','id',items->(p_limit-1)->'id');
  END IF;
  RETURN jsonb_build_object('items',items,'total',total,'open_count',open_count,'next_cursor',next_cursor,
    'date_from',p_date_from,'date_to',p_date_to,'max_range_days',90);
END;
$$;

CREATE FUNCTION public.temperature_monitoring_deviation_history(p_deviation_id UUID,p_limit INTEGER DEFAULT 50,p_before_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE items JSONB; next_id BIGINT;
BEGIN
  PERFORM public.temperature_monitoring_deviation_get(p_deviation_id);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_before_id<=0 THEN
    RAISE EXCEPTION 'valid history limit and cursor required' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.id DESC),'[]'::JSONB) INTO items FROM (
    SELECT id,deviation_id,action,before_state,after_state,reason,actor_user_id,created_at
    FROM public.temperature_monitoring_deviation_events
    WHERE deviation_id=p_deviation_id AND (p_before_id IS NULL OR id<p_before_id) ORDER BY id DESC LIMIT p_limit+1) e;
  IF jsonb_array_length(items)>p_limit THEN
    SELECT jsonb_agg(value ORDER BY ordinality) INTO items FROM jsonb_array_elements(items) WITH ORDINALITY WHERE ordinality<=p_limit;
    next_id:=(items->(p_limit-1)->>'id')::BIGINT;
  END IF;
  RETURN jsonb_build_object('items',items,'next_before_id',next_id);
END;
$$;
REVOKE ALL ON FUNCTION public.temperature_monitoring_deviation_get(UUID,UUID),
  public.temperature_monitoring_deviations_list(DATE,DATE,BIGINT,TEXT,TEXT,BIGINT,INTEGER,INTEGER,JSONB),
  public.temperature_monitoring_deviation_history(UUID,INTEGER,BIGINT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.temperature_monitoring_deviation_get(UUID,UUID),
  public.temperature_monitoring_deviations_list(DATE,DATE,BIGINT,TEXT,TEXT,BIGINT,INTEGER,INTEGER,JSONB),
  public.temperature_monitoring_deviation_history(UUID,INTEGER,BIGINT) TO authenticated;
COMMIT;
