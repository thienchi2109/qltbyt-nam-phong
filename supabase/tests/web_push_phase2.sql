BEGIN;

CREATE FUNCTION pg_temp.web_push_expect_error(p_sql text,p_state text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE=p_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %: %',p_state,SQLSTATE,SQLERRM;
  END;
  RAISE EXCEPTION 'Expected %, statement succeeded',p_state;
END;
$$;

INSERT INTO public.dia_ban(id,ma_dia_ban,ten_dia_ban) VALUES (2147000001,'webpush-test','Web Push test');
INSERT INTO public.don_vi(id,name,dia_ban_id) VALUES
  (2147000001,'Web Push A',2147000001),(2147000002,'Web Push B',2147000001);
INSERT INTO public.nhan_vien(id,username,password,role,don_vi,dia_ban_id,khoa_phong) VALUES
  (2147000001,'webpush-admin','unused','admin',2147000001,2147000001,NULL),
  (2147000002,'webpush-user','unused','user',2147000001,2147000001,'CT'),
  (2147000003,'webpush-other','unused','to_qltb',2147000002,2147000001,NULL);
INSERT INTO public.thiet_bi(id,ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly)
  VALUES (2147000001,'WEBPUSH-TEST','Test',2147000001,'Chấn thương');
INSERT INTO public.yeu_cau_sua_chua(id,thiet_bi_id,mo_ta_su_co)
  VALUES (2147000001,2147000001,'Test');

DO $$
DECLARE r jsonb; v_role text; v_expected boolean; v_read jsonb; v_profile record;
BEGIN
  PERFORM set_config('request.jwt.claims','{"app_role":"admin","user_id":"2147000001"}',true);
  ASSERT public.web_push_subject_can_receive(2147000002,2147000001), 'config permits no subscription';
  ASSERT public.web_push_subject_can_receive(2147000002,2147000001,2147000001), 'normalized department';
  r := public.web_push_recipient_config_set(2147000001,ARRAY[' WebPush-USER ','webpush-user','']);
  ASSERT jsonb_array_length(r->'recipients')=1, 'trim lowercase dedupe';
  PERFORM pg_temp.web_push_expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['webpush-user','missing-user'])$q$,'22023');
  ASSERT jsonb_array_length(public.web_push_recipient_config_get(2147000001)->'recipients')=1, 'invalid list atomic';
  PERFORM pg_temp.web_push_expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['webpush-other'])$q$,'22023');
  UPDATE public.nhan_vien SET role='global' WHERE id=2147000001;
  PERFORM set_config('request.jwt.claims','{"app_role":"global","user_id":"2147000001"}',true);
  ASSERT public.web_push_recipient_config_get(2147000001)=r, 'admin/global parity';
  PERFORM set_config('request.jwt.claims','{"app_role":"to_qltb","user_id":"2147000003","don_vi":"2147000001"}',true);
  PERFORM pg_temp.web_push_expect_error('SELECT public.web_push_recipient_config_get(2147000001)','42501');
  UPDATE public.nhan_vien SET current_don_vi=2147000001 WHERE id=2147000003;
  ASSERT public.web_push_subject_can_receive(2147000003,2147000001), 'manager uses current tenant';
  ASSERT NOT public.web_push_subject_can_receive(2147000003,2147000002), 'old tenant denied';

  FOREACH v_role IN ARRAY ARRAY['admin','global','regional_leader','to_qltb','technician','qltb_khoa','user'] LOOP
    UPDATE public.nhan_vien SET role=v_role,current_don_vi=NULL,khoa_phong='CT' WHERE id=2147000002;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role',v_role,'user_id','2147000002')::text,true);
    SELECT * INTO v_profile FROM public.get_session_authorization_profile_for_jwt(2147000002);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('app_role',CASE WHEN v_role='admin' THEN 'global' ELSE v_role END,
      'user_id','2147000002','don_vi',COALESCE(v_profile.current_don_vi,v_profile.don_vi)::text,
      'dia_ban',v_profile.dia_ban_id::text,'khoa_phong',COALESCE(v_profile.khoa_phong,''))::text,true);
    v_expected := public.web_push_subject_can_receive(2147000002,2147000001,2147000001);
    v_read := public.repair_request_get(2147000001);
    ASSERT v_expected AND v_read IS NOT NULL, 'fresh durable-profile repair read parity: '||v_role;
  END LOOP;
  UPDATE public.nhan_vien SET khoa_phong='Other' WHERE id=2147000002;
  ASSERT public.web_push_subject_can_receive(2147000002,2147000001), 'different department still configurable';
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001,2147000001), 'request department denied';
  PERFORM set_config('request.jwt.claims','{"app_role":"user","user_id":"2147000002","don_vi":"2147000001","dia_ban":"2147000001","khoa_phong":"Other"}',true);
  PERFORM pg_temp.web_push_expect_error('SELECT public.repair_request_get(2147000001)','42501');
  UPDATE public.nhan_vien SET khoa_phong=NULL WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'lost department ignores stale JWT';
  UPDATE public.nhan_vien SET khoa_phong=E' \t\n ' WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'whitespace department denied';
  UPDATE public.nhan_vien SET role='technician',current_don_vi=2147000002 WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'nonmanager refresh uses current tenant';
  ASSERT public.web_push_subject_can_receive(2147000002,2147000002), 'nonuser empty department allowed';
  UPDATE public.nhan_vien SET role='regional_leader',current_don_vi=NULL WHERE id=2147000002;
  UPDATE public.don_vi SET active=false WHERE id=2147000001;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'regional inactive denied';
  ASSERT public.web_push_subject_can_receive(2147000001,2147000001), 'global inactive tenant read bypass';
  UPDATE public.don_vi SET active=true WHERE id=2147000001;
  UPDATE public.nhan_vien SET role='global',dia_ban_id=NULL,don_vi=NULL WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'missing region denies fresh session even global';
  UPDATE public.nhan_vien SET role='chuyen_gia' WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'expert repair capability denied';
  UPDATE public.nhan_vien SET role='unsupported-webpush-role' WHERE id=2147000002;
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001), 'unsupported durable role denied';
  PERFORM set_config('request.jwt.claims','{"app_role":"global","role":"service_role"}',true);
  ASSERT NOT public.web_push_subject_can_receive(2147000002,2147000001,2147000001), 'worker cannot grant subject authority';
  ASSERT NOT public.web_push_subject_can_receive(2147000099,2147000001), 'deleted/missing subject';
  ASSERT NOT public.web_push_subject_can_receive(2147000001,2147000001,2147000099), 'missing request';
  UPDATE public.nhan_vien SET role='user',khoa_phong='CT',don_vi=2147000001,dia_ban_id=2147000001 WHERE id=2147000002;
  PERFORM set_config('request.jwt.claims','{"app_role":"global","user_id":"2147000001"}',true);
  ASSERT jsonb_array_length(public.web_push_recipient_config_set(2147000001,'{}')->'recipients')=0, 'empty clears';
  DELETE FROM public.nhan_vien WHERE id=2147000003;
  ASSERT NOT public.web_push_subject_can_receive(2147000003,2147000001), 'deleted subject denied';
  RAISE NOTICE 'PASS: recipient atomic config, tenant tampering, durable authorization/read parity';
END;
$$;

DO $$
DECLARE s jsonb; r jsonb; v_id uuid; v_revision bigint; v_key text; v_i integer; v_has_rollout_controls boolean;
BEGIN
  -- Public P-256 generator point, not a credential.
  v_key := translate(rtrim(replace(encode(decode(
    '046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5','hex'),'base64'),E'\n',''),'='),'+/','-_');
  s := jsonb_build_object('endpoint','https://push.example.test/test','keys',jsonb_build_object('p256dh',v_key,'auth','AAAAAAAAAAAAAAAAAAAAAA'));
  PERFORM set_config('request.jwt.claims','{"app_role":"user","user_id":"2147000002"}',true);
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='web_push_runtime_controls'
      AND column_name='registration_enabled'
  ) INTO v_has_rollout_controls;
  IF v_has_rollout_controls THEN
    EXECUTE 'UPDATE public.web_push_runtime_controls
      SET registration_enabled=true, registration_canary_don_vi_ids=ARRAY[2147000001]::bigint[],
          vapid_key_version=$1, vapid_public_key=$2, vapid_fingerprint=$3
      WHERE singleton'
      USING 'test-v1', v_key, 'sha256:'||repeat('0',64);
  END IF;
  r := public.web_push_subscription_register(s,'test-v1'); v_id := (r->>'subscription_id')::uuid; v_revision := (r->>'revision')::bigint;
  ASSERT public.web_push_subscription_register(s,'test-v1')=r, 'same registration idempotent';
  PERFORM set_config('request.jwt.claims','{"app_role":"global","user_id":"2147000001"}',true);
  PERFORM pg_temp.web_push_expect_error(format('SELECT public.web_push_subscription_register(%L::jsonb,%L)',s,'test-v1'),'40001');
  PERFORM public.web_push_subscription_revoke(v_id,v_revision);
  ASSERT (SELECT revoked_at IS NULL FROM public.web_push_subscriptions WHERE id=v_id), 'foreign revoke has no effect';
  PERFORM set_config('request.jwt.claims','{"app_role":"user","user_id":"2147000002"}',true);
  IF v_has_rollout_controls THEN
    EXECUTE 'UPDATE public.web_push_runtime_controls
      SET vapid_key_version=$1, vapid_public_key=$2, vapid_fingerprint=$3
      WHERE singleton'
      USING 'test-v2', v_key, 'sha256:'||repeat('0',64);
  END IF;
  r := public.web_push_subscription_register(s,'test-v2');
  ASSERT (r->>'revision')::bigint=v_revision+1, 'key version bumps revision';
  PERFORM pg_temp.web_push_expect_error(format('SELECT public.web_push_subscription_revoke(%L,%s)',v_id,v_revision),'40001');
  ASSERT public.web_push_subscription_revoke(v_id,v_revision+1)=public.web_push_subscription_revoke(v_id,v_revision+1), 'revoke idempotent';
  ASSERT (public.web_push_subscription_register(s,'test-v2')->>'revision')::bigint=v_revision+2, 're-enable fenced';
  UPDATE public.nhan_vien SET password_changed_at=clock_timestamp()+interval '1 second' WHERE id=2147000002;
  ASSERT (public.web_push_subscription_register(s,'test-v2')->>'revision')::bigint=v_revision+3, 'epoch change fenced';
  PERFORM pg_temp.web_push_expect_error(format('SELECT public.web_push_subscription_register(%L::jsonb,%L)',s||'{"user_id":"2147000001"}'::jsonb,'test-v2'),'22023');
  ASSERT NOT public.web_push_subscription_keys_valid(repeat('A',87),'AAAAAAAAAAAAAAAAAAAAAA'), 'invalid curve point';
  PERFORM pg_temp.web_push_expect_error(format('SELECT public.web_push_subscription_register(%L::jsonb,%L)',jsonb_set(s,'{endpoint}','"http://example.test"'),'test-v2'),'22023');
  FOR v_i IN 2..10 LOOP
    PERFORM public.web_push_subscription_register(jsonb_set(s,'{endpoint}',to_jsonb('https://push.example.test/test-'||v_i)),'test-v2');
  END LOOP;
  PERFORM pg_temp.web_push_expect_error(format('SELECT public.web_push_subscription_register(%L::jsonb,%L)',jsonb_set(s,'{endpoint}','"https://push.example.test/eleventh"'),'test-v2'),'22023');
  RAISE NOTICE 'PASS: duplicate endpoint/account switch, revision, epoch, revoke and validation';
END;
$$;

DO $$
DECLARE v_sub uuid; v_intent uuid; v_delivery uuid; v_identity uuid; v_table text;
BEGIN
  SELECT id INTO v_sub FROM public.web_push_subscriptions WHERE user_id=2147000002 AND endpoint='https://push.example.test/test';
  INSERT INTO public.web_push_notification_intents(event_type,request_id,recipient_user_id,don_vi_id,payload,
    created_at,deadline,status,terminal_at)
  VALUES('repair_request_created',2147000001,2147000002,2147000001,'{}',now()-interval '10 days',now()-interval '9 days','completed',now()-interval '8 days') RETURNING id INTO v_intent;
  INSERT INTO public.web_push_notification_deliveries(intent_id,subscription_identity,subscription_id,subscription_revision,vapid_key_version,
    created_at,deadline,status,terminal_at,result)
  VALUES(v_intent,v_sub,v_sub,4,'test-v2',now()-interval '10 days',now()-interval '9 days','accepted',now()-interval '8 days','{"status":201}') RETURNING id INTO v_delivery;
  PERFORM pg_temp.web_push_expect_error(format('DELETE FROM public.web_push_subscriptions WHERE id=%L',v_sub),'23514');
  UPDATE public.web_push_subscriptions SET revoked_at=now()-interval '8 days' WHERE id=v_sub;
  DELETE FROM public.web_push_subscriptions WHERE id=v_sub;
  ASSERT (SELECT subscription_id IS NULL AND subscription_identity=v_sub AND result='{"status":201}'::jsonb FROM public.web_push_notification_deliveries WHERE id=v_delivery), 'purge preserves identity and history';
  PERFORM pg_temp.web_push_expect_error(format('DELETE FROM public.web_push_notification_intents WHERE id=%L',v_intent),'23503');
  DELETE FROM public.web_push_notification_deliveries WHERE id=v_delivery;
  DELETE FROM public.web_push_notification_intents WHERE id=v_intent;
  FOREACH v_table IN ARRAY ARRAY['web_push_recipient_configs','web_push_subscriptions','web_push_notification_intents','web_push_notification_deliveries','web_push_worker_nonces'] LOOP
    ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||v_table)::regclass), 'RLS enabled';
    ASSERT NOT has_table_privilege('authenticated','public.'||v_table,'SELECT,INSERT,UPDATE,DELETE'), 'no browser direct access';
    ASSERT NOT has_table_privilege('anon','public.'||v_table,'SELECT,INSERT,UPDATE,DELETE'), 'no anon direct access';
  END LOOP;
  ASSERT NOT has_function_privilege('authenticated','public.web_push_subject_can_receive(bigint,bigint,integer)','EXECUTE');
  ASSERT has_function_privilege('service_role','public.web_push_subject_can_receive(bigint,bigint,integer)','EXECUTE');
  DELETE FROM public.nhan_vien WHERE id=2147000002;
  ASSERT NOT EXISTS(SELECT 1 FROM public.web_push_subscriptions WHERE user_id=2147000002), 'owner FK cleared';
  ASSERT NOT EXISTS(SELECT 1 FROM public.web_push_subscriptions WHERE user_id IS NULL AND revoked_at IS NULL), 'deleted owner tombstones revoked';
  RAISE NOTICE 'PASS: retention/FK history, RLS and internal predicate grants';
END;
$$;
ROLLBACK;
