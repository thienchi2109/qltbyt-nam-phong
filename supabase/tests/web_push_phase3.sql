BEGIN;

INSERT INTO public.dia_ban(id,ma_dia_ban,ten_dia_ban) VALUES (2146000001,'webpush-p3','Web Push Phase 3');
INSERT INTO public.don_vi(id,name,dia_ban_id) VALUES
  (2146000001,'Push P3 A',2146000001),(2146000002,'Push P3 B',2146000001);
INSERT INTO public.nhan_vien(id,username,password,role,don_vi,dia_ban_id,khoa_phong) VALUES
  (2146000001,'webpush-p3-admin','unused','admin',2146000002,2146000001,NULL),
  (2146000002,'webpush-p3-user','unused','user',2146000001,2146000001,'CT'),
  (2146000003,'webpush-p3-other','unused','to_qltb',2146000002,2146000001,NULL),
  (2146000004,'webpush-p3-later','unused','to_qltb',2146000001,2146000001,NULL);
INSERT INTO public.thiet_bi(id,ma_thiet_bi,ten_thiet_bi,don_vi,khoa_phong_quan_ly,tinh_trang_hien_tai,is_deleted) VALUES
  (2146000001,'WEBPUSH-P3','Máy siêu âm',2146000001,'Chấn thương','Hoạt động',false),
  (2146000002,'WEBPUSH-P3-ROLLBACK','Rollback',2146000001,'Chấn thương','Hoạt động',false);
INSERT INTO public.web_push_recipient_configs(don_vi_id,user_id) VALUES
  (2146000001,2146000002),(2146000002,2146000001),(2146000002,2146000003);
INSERT INTO public.zbs_recipient_configs(don_vi_id,event_type,recipient_phone,active) VALUES
  (2146000001,'repair_request_created','84912345678',true),
  (2146000002,'repair_request_created','84912345679',true);

DO $$
DECLARE v_id integer; v_enabled_id integer; v_i integer; v_payload jsonb; v_intent uuid;
BEGIN
  PERFORM set_config('request.jwt.claims','{"app_role":"admin","user_id":"2146000001","don_vi":"2146000002","web_push_enqueue_enabled":true}',true);
  PERFORM set_config('app.web_push_enqueue_enabled','true',true);
  ASSERT NOT (SELECT enqueue_enabled FROM public.web_push_runtime_controls WHERE singleton), 'enqueue lands disabled';
  v_id := public.repair_request_create(2146000001,'Default off','Scope',NULL,'Requester',NULL,NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'claims/GUC cannot enable enqueue';
  ASSERT (SELECT count(*)=1 FROM public.zbs_notification_outbox WHERE source_id=v_id AND source_type='repair_request'), 'disabled push preserves ZBS';
  UPDATE public.web_push_runtime_controls SET enqueue_enabled=true WHERE singleton;
  v_enabled_id := public.repair_request_create(2146000001,'Mất nguồn','Scope',NULL,'Requester',NULL,NULL);
  ASSERT (SELECT count(*)=1 FROM public.web_push_notification_intents WHERE request_id=v_enabled_id), 'enabled create must enqueue recipient without subscription';
  SELECT id,payload INTO STRICT v_intent,v_payload FROM public.web_push_notification_intents WHERE request_id=v_enabled_id;
  ASSERT v_payload=jsonb_build_object('version',1,'notification_id',v_intent::text,'title','Máy siêu âm','body',E'Chấn thương\nMất nguồn',
    'url','/repair-requests?action=view&requestId='||v_enabled_id,'tag','repair-request:'||v_enabled_id), 'exact content and navigation snapshot';
  ASSERT (SELECT recipient_user_id=2146000002 AND don_vi_id=2146000001 AND status='pending'
    AND deadline=created_at+interval '24 hours' AND materialized_at IS NULL
    FROM public.web_push_notification_intents WHERE id=v_intent), 'equipment tenant, durable recipient, pending 24h intent';
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_subscriptions WHERE user_id=2146000002), 'fixture recipient has no subscription';
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_deliveries WHERE intent_id=v_intent), 'enqueue does not dispatch/materialize';
  ASSERT (SELECT count(*)=1 FROM public.zbs_notification_outbox WHERE source_id=v_enabled_id AND don_vi_id=2146000001
    AND recipient_phone='84912345678' AND template_data->>'issue_description'='Mất nguồn'), 'ZBS coexists with original snapshot';
  INSERT INTO public.web_push_notification_intents(event_type,request_id,recipient_user_id,don_vi_id,payload)
    SELECT event_type,request_id,recipient_user_id,don_vi_id,payload FROM public.web_push_notification_intents WHERE id=v_intent
    ON CONFLICT(event_type,request_id,recipient_user_id) DO NOTHING;
  ASSERT (SELECT count(*)=1 FROM public.web_push_notification_intents WHERE request_id=v_enabled_id), 'logical uniqueness';
  UPDATE public.thiet_bi SET ten_thiet_bi='Changed' WHERE id=2146000001;
  INSERT INTO public.web_push_recipient_configs(don_vi_id,user_id) VALUES (2146000001,2146000004);
  ASSERT (SELECT count(*)=1 AND bool_and(payload=v_payload) FROM public.web_push_notification_intents WHERE request_id=v_enabled_id), 'no recipient backfill or snapshot rewrite';
  -- The create API has no priority argument: all valid creates enqueue, including empty issue text.
  FOR v_i IN 1..3 LOOP
    v_id := public.repair_request_create(2146000001,CASE v_i WHEN 1 THEN '' WHEN 2 THEN 'Routine' ELSE 'Urgent' END,NULL,NULL,'Requester',NULL,NULL);
    ASSERT (SELECT count(*)=2 FROM public.web_push_notification_intents WHERE request_id=v_id), 'every valid create enqueues all authorized configured recipients';
  END LOOP;
  DELETE FROM public.web_push_recipient_configs WHERE don_vi_id=2146000001;
  v_id := public.repair_request_create(2146000001,'No config',NULL,NULL,'Requester',NULL,NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'no recipients means no cross-tenant fallback';
  ASSERT (SELECT count(*)=1 FROM public.zbs_notification_outbox WHERE source_id=v_id), 'empty push config preserves ZBS';
  INSERT INTO public.web_push_recipient_configs(don_vi_id,user_id) VALUES (2146000001,2146000002),(2146000001,2146000003);
  UPDATE public.nhan_vien SET khoa_phong='Other' WHERE id=2146000002;
  v_id := public.repair_request_create(2146000001,'Denied subjects',NULL,NULL,'Requester',NULL,NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'request-specific department and current tenant authorization';
  UPDATE public.nhan_vien SET khoa_phong='CT' WHERE id=2146000002;
  UPDATE public.web_push_runtime_controls SET enqueue_enabled=false WHERE singleton;
  v_id := public.repair_request_create(2146000001,'Disabled again',NULL,NULL,'Requester',NULL,NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'control stops new intents';
  ASSERT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE id=v_intent), 'disable retains prior intent';
  ASSERT (SELECT count(*)=1 FROM public.zbs_notification_outbox WHERE source_id=v_id), 'control toggle does not disable ZBS';
  UPDATE public.web_push_runtime_controls SET enqueue_enabled=true WHERE singleton;
  UPDATE public.zbs_recipient_configs SET active=false WHERE don_vi_id=2146000001;
  v_id := public.repair_request_create(2146000001,'Only push',NULL,NULL,'Requester',NULL,NULL);
  ASSERT (SELECT count(*)=1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'push does not depend on ZBS config';
  ASSERT NOT EXISTS (SELECT 1 FROM public.zbs_notification_outbox WHERE source_id=v_id), 'inactive ZBS stays inactive';
  UPDATE public.zbs_recipient_configs SET active=true WHERE don_vi_id=2146000001;
  RAISE NOTICE 'PASS: default-off, tenant/subject, no-subscription, snapshot, dedupe and ZBS coexistence';
END;
$$;

CREATE FUNCTION pg_temp.web_push_fail_enqueue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payload->>'body' LIKE '%P3 injected failure' THEN
    ASSERT EXISTS (SELECT 1 FROM public.zbs_notification_outbox WHERE source_id=NEW.request_id), 'ZBS inserted before push failure';
    ASSERT EXISTS (SELECT 1 FROM public.lich_su_thiet_bi WHERE yeu_cau_id=NEW.request_id), 'history inserted before push failure';
    ASSERT EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_type='repair_request' AND entity_id=NEW.request_id), 'audit inserted before push failure';
    ASSERT (SELECT tinh_trang_hien_tai='Chờ sửa chữa' FROM public.thiet_bi WHERE id=2146000002), 'equipment updated before push failure';
    RAISE EXCEPTION 'injected enqueue storage failure' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER web_push_phase3_fault BEFORE INSERT ON public.web_push_notification_intents
  FOR EACH ROW EXECUTE FUNCTION pg_temp.web_push_fail_enqueue();

DO $$
DECLARE v_failed boolean:=false; v_id integer; v_before_audit bigint; v_before_zbs bigint; v_before_push bigint;
BEGIN
  SELECT count(*) INTO v_before_audit FROM public.audit_logs WHERE admin_user_id=2146000001;
  SELECT count(*) INTO v_before_zbs FROM public.zbs_notification_outbox WHERE don_vi_id=2146000001;
  SELECT count(*) INTO v_before_push FROM public.web_push_notification_intents WHERE don_vi_id=2146000001;
  BEGIN
    PERFORM public.repair_request_create(2146000002,'P3 injected failure',NULL,NULL,'Requester',NULL,NULL);
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM<>'injected enqueue storage failure' THEN RAISE; END IF;
    v_failed:=true;
  END;
  ASSERT v_failed, 'enqueue DB failure propagates';
  ASSERT NOT EXISTS (SELECT 1 FROM public.yeu_cau_sua_chua WHERE thiet_bi_id=2146000002), 'DB failure rolls back request';
  ASSERT NOT EXISTS (SELECT 1 FROM public.lich_su_thiet_bi WHERE thiet_bi_id=2146000002), 'DB failure rolls back history';
  ASSERT (SELECT tinh_trang_hien_tai='Hoạt động' FROM public.thiet_bi WHERE id=2146000002), 'DB failure rolls back equipment';
  ASSERT (SELECT count(*)=v_before_audit FROM public.audit_logs WHERE admin_user_id=2146000001), 'DB failure rolls back audit';
  ASSERT (SELECT count(*)=v_before_zbs FROM public.zbs_notification_outbox WHERE don_vi_id=2146000001), 'DB failure rolls back ZBS';
  ASSERT (SELECT count(*)=v_before_push FROM public.web_push_notification_intents WHERE don_vi_id=2146000001), 'DB failure rolls back push';
  BEGIN
    v_id := public.repair_request_create(2146000002,'Caller rollback',NULL,NULL,'Requester',NULL,NULL);
    ASSERT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'push exists before caller rollback';
    ASSERT EXISTS (SELECT 1 FROM public.zbs_notification_outbox WHERE source_id=v_id), 'ZBS exists before caller rollback';
    RAISE EXCEPTION 'rollback caller' USING ERRCODE='40001';
  EXCEPTION WHEN serialization_failure THEN
    IF SQLERRM<>'rollback caller' THEN RAISE; END IF;
  END;
  ASSERT NOT EXISTS (SELECT 1 FROM public.yeu_cau_sua_chua WHERE id=v_id), 'caller rollback removes request';
  ASSERT NOT EXISTS (SELECT 1 FROM public.web_push_notification_intents WHERE request_id=v_id), 'caller rollback removes push';
  ASSERT NOT EXISTS (SELECT 1 FROM public.zbs_notification_outbox WHERE source_id=v_id), 'caller rollback removes ZBS';
  RAISE NOTICE 'PASS: DB enqueue failure and caller rollback undo request, equipment, audit, history and both outboxes';
END;
$$;
DROP TRIGGER web_push_phase3_fault ON public.web_push_notification_intents;

DO $$
DECLARE v_id integer; v_payload jsonb; v_text text;
BEGIN
  UPDATE public.nhan_vien SET role='to_qltb' WHERE id=2146000002;
  UPDATE public.thiet_bi SET khoa_phong_quan_ly=NULL WHERE id=2146000001;
  v_id := public.repair_request_create(2146000001,'Issue',NULL,NULL,'Requester',NULL,NULL);
  SELECT payload INTO STRICT v_payload FROM public.web_push_notification_intents WHERE request_id=v_id;
  ASSERT v_payload->>'body'=E'Chưa có thông tin\nIssue', 'null department placeholder';
  v_payload := public.web_push_payload_v1(gen_random_uuid(),v_id,NULL,NULL,NULL);
  ASSERT v_payload->>'title'='Chưa có thông tin' AND v_payload->>'body'=E'Chưa có thông tin\nChưa có thông tin', 'null formatter fields use placeholders';
  UPDATE public.thiet_bi SET ten_thiet_bi=repeat('😀',100),khoa_phong_quan_ly=repeat('😀',100) WHERE id=2146000001;
  FOREACH v_text IN ARRAY ARRAY[repeat('😀',5000),repeat(E'\001"\\\n',2000)] LOOP
    v_id := public.repair_request_create(2146000001,v_text,NULL,NULL,'Requester',NULL,NULL);
    SELECT payload INTO STRICT v_payload FROM public.web_push_notification_intents WHERE request_id=v_id;
    ASSERT octet_length(v_payload::text)<=3072, 'serialized payload bound includes escaping';
    ASSERT octet_length(v_payload->>'title')<=256 AND right(v_payload->>'title',1)='…', 'Unicode title cap and ellipsis';
    ASSERT octet_length(split_part(v_payload->>'body',E'\n',1))<=256, 'department byte cap';
    ASSERT octet_length(substr(v_payload->>'body',strpos(v_payload->>'body',E'\n')+1))<=1800, 'issue byte cap';
    ASSERT right(v_payload->>'body',1)='…', 'truncated issue signals ellipsis';
    ASSERT v_payload->>'url'='/repair-requests?action=view&requestId='||v_id, 'payload clipping preserves URL';
  END LOOP;
  ASSERT NOT has_table_privilege('authenticated','public.web_push_runtime_controls','SELECT,INSERT,UPDATE,DELETE'), 'browser cannot read/write controls';
  ASSERT NOT has_table_privilege('anon','public.web_push_runtime_controls','SELECT,INSERT,UPDATE,DELETE'), 'anon cannot read/write controls';
  ASSERT NOT has_table_privilege('service_role','public.web_push_runtime_controls','INSERT,UPDATE,DELETE'), 'control changes require database operator';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid='public.web_push_runtime_controls'::regclass), 'controls RLS enabled';
  RAISE NOTICE 'PASS: payload Unicode/escaping/null bounds and protected controls';
END;
$$;

ROLLBACK;
