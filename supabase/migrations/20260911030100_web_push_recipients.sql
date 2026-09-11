-- Web Push Phase 2: durable recipient authorization and atomic tenant configuration.
-- No request creation/enqueue changes; no subscription prerequisite for configuration.
BEGIN;

CREATE FUNCTION public.web_push_subject_can_receive(p_user_id bigint, p_don_vi bigint, p_request_id integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_profile record; v_tenant record; v_equipment record;
BEGIN
  SELECT nv.role,COALESCE(nv.current_don_vi,nv.don_vi) AS scope_id,
    COALESCE(nv.dia_ban_id,dv.dia_ban_id) AS region_id,
    public._normalize_department_scope(nv.khoa_phong) AS department
  INTO v_profile FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv ON dv.id=COALESCE(nv.current_don_vi,nv.don_vi)
  WHERE nv.id=p_user_id;
  IF NOT FOUND OR v_profile.role IS NULL OR v_profile.region_id IS NULL
    OR v_profile.role NOT IN ('global','admin','regional_leader','to_qltb','technician','qltb_khoa','user') THEN RETURN false; END IF;
  SELECT dv.id,dv.active,dv.dia_ban_id INTO v_tenant FROM public.don_vi dv WHERE dv.id=p_don_vi;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_profile.role='regional_leader' THEN
    IF v_tenant.active IS DISTINCT FROM true OR v_tenant.dia_ban_id IS DISTINCT FROM v_profile.region_id THEN RETURN false; END IF;
  ELSIF v_profile.role NOT IN ('global','admin') AND v_profile.scope_id IS DISTINCT FROM p_don_vi THEN RETURN false;
  END IF;
  IF v_profile.role='user' AND COALESCE(v_profile.department,'')='' THEN RETURN false; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT tb.don_vi,public._normalize_department_scope(tb.khoa_phong_quan_ly) AS department
    INTO v_equipment FROM public.yeu_cau_sua_chua yc JOIN public.thiet_bi tb ON tb.id=yc.thiet_bi_id
    WHERE yc.id=p_request_id;
    IF NOT FOUND OR v_equipment.don_vi IS DISTINCT FROM p_don_vi THEN RETURN false; END IF;
    IF v_profile.role='user' AND v_profile.department IS DISTINCT FROM v_equipment.department THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.web_push_subject_can_receive(bigint,bigint,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_subject_can_receive(bigint,bigint,integer) TO service_role;

CREATE FUNCTION public.web_push_config_authorize(p_don_vi bigint)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id bigint; v_role text;
BEGIN
  v_id := public.web_push_session_user_id();
  SELECT nv.role INTO v_role FROM public.nhan_vien nv WHERE nv.id=v_id;
  IF v_role NOT IN ('global','admin','to_qltb') OR NOT public.web_push_subject_can_receive(v_id,p_don_vi) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.web_push_config_authorize(bigint) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.web_push_recipient_config_get(p_don_vi bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_recipients jsonb;
BEGIN
  PERFORM public.web_push_config_authorize(p_don_vi);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id',nv.id::text,'username',nv.username) ORDER BY nv.id),'[]'::jsonb)
  INTO v_recipients FROM public.web_push_recipient_configs cfg JOIN public.nhan_vien nv ON nv.id=cfg.user_id
  WHERE cfg.don_vi_id=p_don_vi;
  RETURN jsonb_build_object('version',1,'don_vi_id',p_don_vi::text,'recipients',v_recipients);
END;
$$;

CREATE FUNCTION public.web_push_recipient_config_set(p_don_vi bigint, p_usernames text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_names text[]; v_ids bigint[]; v_count integer;
BEGIN
  PERFORM public.web_push_config_authorize(p_don_vi);
  IF p_usernames IS NULL OR COALESCE(array_ndims(p_usernames),1)>1
    OR octet_length(p_usernames::text)>8192 OR array_position(p_usernames,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_recipients' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(u))),'{}'::text[]) INTO v_names
    FROM unnest(p_usernames) u WHERE btrim(u)<>'';
  IF cardinality(v_names)>100 THEN RAISE EXCEPTION 'invalid_recipients' USING ERRCODE='22023'; END IF;
  -- Serialize atomic replacement per tenant; subscription presence is deliberately irrelevant.
  PERFORM 1 FROM public.don_vi WHERE id=p_don_vi FOR UPDATE;
  SELECT COALESCE(array_agg(m.id),'{}'::bigint[]),count(*) INTO v_ids,v_count
  FROM (
    SELECT min(nv.id) AS id FROM unnest(v_names) u(name)
    LEFT JOIN public.nhan_vien nv ON lower(nv.username)=u.name
    GROUP BY u.name HAVING count(nv.id)=1 AND octet_length(u.name)<=256
  ) m WHERE public.web_push_subject_can_receive(m.id,p_don_vi);
  IF v_count<>cardinality(v_names) THEN RAISE EXCEPTION 'invalid_recipients' USING ERRCODE='22023'; END IF;
  DELETE FROM public.web_push_recipient_configs WHERE don_vi_id=p_don_vi;
  INSERT INTO public.web_push_recipient_configs(don_vi_id,user_id) SELECT p_don_vi,unnest(v_ids);
  RETURN public.web_push_recipient_config_get(p_don_vi);
END;
$$;

REVOKE ALL ON FUNCTION public.web_push_recipient_config_get(bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_recipient_config_set(bigint,text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_get(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_recipient_config_set(bigint,text[]) TO authenticated;
COMMIT;
