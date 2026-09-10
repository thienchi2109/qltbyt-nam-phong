-- Disposable databases only. All fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.specialty_expect_error(p_sql TEXT, p_state TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_state TEXT;
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF v_state = p_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %', p_state, v_state;
  END;
  RAISE EXCEPTION 'Expected %, statement succeeded', p_state;
END;
$$;
DO $$
DECLARE
  v_user BIGINT;
  v_id UUID;
  v_result JSONB;
  v_label TEXT := 'Specialty-' || gen_random_uuid()::TEXT;
  v_role TEXT;
  v_signature TEXT;
BEGIN
  SELECT id INTO v_user FROM public.nhan_vien ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Fixture requires a nhan_vien row'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('app_role','global','role','authenticated','user_id',v_user::TEXT)::TEXT,true);
  v_result := public.technical_configuration_dossiers_create('Gate', v_label, NULL, 0);
  ASSERT v_result->'data' ? 'specialty', 'legacy create returns nullable specialty';
  ASSERT v_result#>'{data,specialty}' = 'null'::JSONB, 'no automatic classification';
  v_id := (v_result#>>'{data,id}')::UUID;
  v_result := public.technical_configuration_dossiers_update(v_id, 'Gate', v_label, NULL, 1, E'  Mắt\t  ngoại  ');
  ASSERT v_result#>>'{data,specialty}' = 'Mắt ngoại', 'whitespace normalized, accents retained';
  ASSERT v_result#>>'{data,revision}' = '2', 'one revision increment';
  v_result := public.technical_configuration_dossiers_update(v_id, 'Gate', v_label, 'legacy edit', 2);
  ASSERT v_result#>>'{data,specialty}' = 'Mắt ngoại', 'old client preserves specialty';
  ASSERT public.technical_configuration_dossiers_get(v_id)#>>'{data,specialty}' = 'Mắt ngoại';
  v_result := public.technical_configuration_dossiers_list(1,100,false,v_label);
  ASSERT v_result#>>'{data,0,specialty}' = 'Mắt ngoại';
  ASSERT v_result#>>'{data,0,can_delete}' = 'true';
  PERFORM pg_temp.specialty_expect_error(format('SELECT public.technical_configuration_dossiers_update(%L::uuid,''Gate'',%L,NULL,1,''Wrong'')',v_id,v_label),'PT409');
  PERFORM pg_temp.specialty_expect_error(format('SELECT public.technical_configuration_dossiers_update(%L::uuid,''Gate'',%L,NULL,3,%L)',v_id,v_label,repeat('x',201)),'PT422');
  ASSERT public.technical_configuration_dossiers_get(v_id)#>>'{data,revision}' = '3', 'failed edit rolls back';
  v_result := public.technical_configuration_dossiers_update(v_id,'Gate',v_label,NULL,3,E' \t ');
  ASSERT v_result#>'{data,specialty}' = 'null'::JSONB, 'blank clears';
  v_result := public.technical_configuration_dossiers_update(v_id,'Gate',v_label,NULL,4,NULL);
  ASSERT v_result#>'{data,specialty}' = 'null'::JSONB, 'explicit null clears';
  v_result := public.technical_configuration_dossiers_create('Gate',v_label,NULL,0,v_label);
  ASSERT v_result#>>'{data,specialty}' = v_label;
  v_result := public.technical_configuration_dossiers_update(
    p_id => (v_result#>>'{data,id}')::UUID, p_device_type_name => 'Gate',
    p_name => v_label, p_description => NULL, p_expected_revision => 1,
    p_specialty => v_label
  );
  ASSERT v_result#>>'{data,revision}' = '2', 'named arguments resolve new overload';
  PERFORM public.technical_configuration_dossiers_create('Gate',v_label,NULL,0,upper(v_label));
  v_result := public.technical_configuration_dossiers_specialties(1,100,v_label);
  ASSERT v_result->>'total' = '1', 'case variants form one group';
  ASSERT lower(v_result#>>'{data,0}') = lower(v_label);
  PERFORM public.technical_configuration_dossiers_create('Gate',v_label,NULL,0,v_label || ' Mắt');
  PERFORM public.technical_configuration_dossiers_create('Gate',v_label,NULL,0,v_label || ' Mat');
  v_result := public.technical_configuration_dossiers_specialties(1,1,v_label);
  ASSERT v_result->>'total' = '3', 'accents distinct and total precedes pagination';
  ASSERT jsonb_array_length(v_result->'data') = 1;
  ASSERT public.technical_configuration_dossiers_specialties(2,1,v_label)->'data' IS DISTINCT FROM v_result->'data';
  PERFORM pg_temp.specialty_expect_error('SELECT public.technical_configuration_dossiers_specialties(0,20,NULL)','PT422');
  PERFORM pg_temp.specialty_expect_error('SELECT public.technical_configuration_dossiers_specialties(1,101,NULL)','PT422');
  PERFORM public.technical_configuration_dossiers_archive(v_id,5);
  PERFORM pg_temp.specialty_expect_error(format('SELECT public.technical_configuration_dossiers_update(%L::uuid,''Gate'',%L,NULL,6,NULL)',v_id,v_label),'PT409');
  FOREACH v_role IN ARRAY ARRAY['admin','chuyen_gia'] LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role',v_role,'user_id',v_user::TEXT)::TEXT,true);
    v_result := public.technical_configuration_dossiers_create('Gate',v_label,NULL,0,'Mắt');
    ASSERT v_result#>>'{data,specialty}' = 'Mắt';
  END LOOP;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role','user','user_id',v_user::TEXT)::TEXT,true);
  PERFORM pg_temp.specialty_expect_error('SELECT public.technical_configuration_dossiers_specialties(1,20,NULL)','42501');
  PERFORM pg_temp.specialty_expect_error('SELECT public.technical_configuration_dossiers_create(''Gate'',''Denied'',NULL,0,''Mắt'')','42501');
  FOREACH v_signature IN ARRAY ARRAY[
    'public.technical_configuration_dossiers_create(text,text,text,bigint)',
    'public.technical_configuration_dossiers_update(uuid,text,text,text,bigint)',
    'public.technical_configuration_dossiers_get(uuid)',
    'public.technical_configuration_dossiers_list(integer,integer,boolean,text)',
    'public.technical_configuration_dossiers_create(text,text,text,bigint,text)',
    'public.technical_configuration_dossiers_update(uuid,text,text,text,bigint,text)',
    'public.technical_configuration_dossiers_specialties(integer,integer,text)'
  ] LOOP
    ASSERT has_function_privilege('authenticated',v_signature,'EXECUTE');
    ASSERT NOT has_function_privilege('anon',v_signature,'EXECUTE');
    ASSERT NOT has_function_privilege('service_role',v_signature,'EXECUTE');
    ASSERT NOT EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=v_signature::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE');
  END LOOP;
  RAISE NOTICE 'PASS: specialty compatibility, editing, pagination, validation, authorization';
END;
$$;
DO $$
DECLARE v_user BIGINT;
BEGIN
  SELECT id INTO v_user FROM public.nhan_vien ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'app_role', 'global', 'role', 'authenticated', 'user_id', v_user::TEXT
  )::TEXT, true);
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_result JSONB;
BEGIN
  v_result := public.technical_configuration_dossiers_create(
    p_device_type_name => 'Gate', p_name => 'Specialty real-role check',
    p_description => NULL, p_expected_revision => 0, p_specialty => 'Mắt'
  );
  ASSERT v_result#>>'{data,specialty}' = 'Mắt', 'authenticated can call new signature';
  PERFORM public.technical_configuration_dossiers_specialties(1, 20, 'Mắt');
END;
$$;
RESET ROLE;
ROLLBACK;
