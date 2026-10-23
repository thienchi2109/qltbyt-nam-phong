-- Match Equipment: to_qltb manages its tenant; other non-global roles retain department scope.
BEGIN;

CREATE OR REPLACE FUNCTION public._temperature_monitoring_assert_scope(p_equipment_id BIGINT,p_lock BOOLEAN DEFAULT FALSE)
RETURNS TABLE(actor_id BIGINT,role_name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  claims JSONB;
  tenant BIGINT;
  department TEXT;
  equipment_tenant BIGINT;
  equipment_department TEXT;
BEGIN
  BEGIN
    claims:=COALESCE(NULLIF(current_setting('request.jwt.claims',TRUE),''),'{}')::JSONB;
    actor_id:=NULLIF(claims->>'user_id','')::BIGINT;
    tenant:=NULLIF(claims->>'don_vi','')::BIGINT;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'invalid authentication scope' USING ERRCODE='42501';
  END;
  role_name:=lower(COALESCE(NULLIF(claims->>'app_role',''),NULLIF(claims->>'role','')));
  department:=public._normalize_department_scope(claims->>'khoa_phong');
  IF role_name IS NULL OR role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user','regional_leader')
    OR actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.nhan_vien WHERE id=actor_id)
    OR (p_lock AND role_name NOT IN ('global','admin','to_qltb','technician','qltb_khoa','user')) THEN
    RAISE EXCEPTION 'authenticated temperature capability required' USING ERRCODE='42501';
  END IF;
  SELECT t.don_vi,public._normalize_department_scope(t.khoa_phong_quan_ly)
  INTO equipment_tenant,equipment_department FROM public.thiet_bi t WHERE id=p_equipment_id;
  IF NOT FOUND OR (role_name NOT IN ('global','admin') AND
    (tenant IS NULL OR equipment_tenant IS DISTINCT FROM tenant OR
      (role_name<>'to_qltb' AND (department IS NULL OR equipment_department IS DISTINCT FROM department)))) THEN
    RAISE EXCEPTION 'equipment is outside authorized scope' USING ERRCODE='42501';
  END IF;
  IF p_lock THEN
    PERFORM public._temperature_monitoring_lock_tenant(equipment_tenant);
  END IF;
  PERFORM 1 FROM public.thiet_bi t WHERE id=p_equipment_id AND t.don_vi IS NOT DISTINCT FROM equipment_tenant
    AND (role_name IN ('global','admin','to_qltb') OR public._normalize_department_scope(t.khoa_phong_quan_ly)=department) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'equipment scope changed; retry' USING ERRCODE='42501'; END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._temperature_monitoring_assert_scope(BIGINT,BOOLEAN) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.temperature_monitoring_configuration_history(p_equipment_id BIGINT)
RETURNS SETOF public.temperature_monitoring_configuration_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public._temperature_monitoring_assert_scope(p_equipment_id);
  RETURN QUERY SELECT v.* FROM public.temperature_monitoring_configuration_versions v WHERE v.equipment_id=p_equipment_id ORDER BY lower(v.effective_period);
END;
$$;

COMMIT;
