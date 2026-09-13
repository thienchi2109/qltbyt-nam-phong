BEGIN;

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_state text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected %, got %: %', p_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Expected %, statement succeeded', p_state;
END;
$$;

INSERT INTO public.dia_ban(id,ma_dia_ban,ten_dia_ban)
VALUES (2147000001,'webpush45','Web Push 4.5');
INSERT INTO public.don_vi(id,name,dia_ban_id) VALUES
  (2147000001,'A',2147000001),(2147000002,'B',2147000001);
INSERT INTO public.nhan_vien(id,username,password,role,don_vi,dia_ban_id) VALUES
  (2147000001,'wp45-admin','unused','admin',2147000001,2147000001),
  (2147000002,'wp45-global','unused','global',2147000002,2147000001),
  (2147000003,'wp45-manager-a','unused','to_qltb',2147000001,2147000001),
  (2147000004,'wp45-manager-b','unused','to_qltb',2147000002,2147000001),
  (2147000005,'wp45-user','unused','user',2147000001,2147000001);

DO $$
DECLARE r jsonb; before_config jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims','{"app_role":"admin","user_id":"2147000001"}',true);
  r := public.web_push_recipient_candidates(2147000001,'wp45-',1,NULL);
  ASSERT jsonb_array_length(r->'candidates')=1;
  ASSERT r->'candidates'->0->>'username'='wp45-manager-a', 'only same-unit managers';
  ASSERT r->'next_cursor'='null'::jsonb;
  ASSERT jsonb_array_length(public.web_push_recipient_candidates(2147000001,'%',50,NULL)->'candidates')=0, 'literal wildcard search';
  r := public.web_push_recipient_config_set(2147000001,ARRAY[' WP45-MANAGER-A ','wp45-manager-a'],'add');
  ASSERT jsonb_array_length(r->'recipients')=2, 'normal plus explicit admin self';
  before_config := r;
  PERFORM pg_temp.expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['wp45-user'],'remove')$q$,'22023');
  ASSERT public.web_push_recipient_config_get(2147000001)=before_config, 'self action and normals atomic';
  PERFORM pg_temp.expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['wp45-manager-b'])$q$,'22023');
  PERFORM pg_temp.expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['wp45-global'])$q$,'22023');

  PERFORM set_config('request.jwt.claims','{"app_role":"global","user_id":"2147000002"}',true);
  r := public.web_push_recipient_config_set(2147000001,'{}','add');
  ASSERT jsonb_array_length(r->'recipients')=2, 'other admin entry survives empty normal save';
  ASSERT r->'recipients'->0->>'editable'='false', 'other self entry read-only';
  PERFORM public.web_push_recipient_config_set(2147000001,'{}','remove');
  ASSERT (SELECT protected_by_user_id=2147000001 FROM public.web_push_recipient_configs WHERE don_vi_id=2147000001 AND user_id=2147000001);

  PERFORM set_config('request.jwt.claims','{"app_role":"to_qltb","user_id":"2147000003","don_vi":"2147000002"}',true);
  PERFORM pg_temp.expect_error('SELECT public.web_push_recipient_candidates(2147000002)','42501');
  PERFORM pg_temp.expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,'{}','add')$q$,'42501');
  r := public.web_push_recipient_config_set(2147000001,ARRAY['wp45-manager-a']);
  ASSERT jsonb_array_length(r->'recipients')=2, 'legacy overload preserves protected entries';
  UPDATE public.nhan_vien SET current_don_vi=2147000002 WHERE id=2147000003;
  PERFORM pg_temp.expect_error('SELECT public.web_push_recipient_config_get(2147000001)','42501');
  PERFORM set_config('request.jwt.claims','{"app_role":"admin","user_id":"2147000001"}',true);
  r := public.web_push_recipient_config_get(2147000001);
  ASSERT r->'recipients'->1->>'status'='ineligible', 'stale selection remains visible';
  PERFORM pg_temp.expect_error($q$SELECT public.web_push_recipient_config_set(2147000001,ARRAY['wp45-manager-a'])$q$,'22023');
  ASSERT public.web_push_recipient_config_get(2147000001)=r, 'invalid retained normal rejected without deletion';
  PERFORM public.web_push_recipient_config_set(2147000001,'{}','none');
  ASSERT jsonb_array_length(public.web_push_recipient_config_get(2147000001)->'recipients')=1;

  UPDATE public.nhan_vien SET role='to_qltb' WHERE id=2147000001;
  PERFORM set_config('request.jwt.claims','{"app_role":"global","user_id":"2147000002"}',true);
  r := public.web_push_recipient_config_set(2147000001,ARRAY['wp45-admin']);
  ASSERT r->'recipients'->0->>'protected'='true', 'role change must not overwrite provenance';
  ASSERT r->'recipients'->0->>'status'='ineligible', 'protected former admin never implicitly becomes normal';
  ASSERT NOT public.web_push_recipient_is_eligible(2147000001,2147000001,2147000001);
  UPDATE public.nhan_vien SET role='admin' WHERE id=2147000001;
  PERFORM set_config('request.jwt.claims','{"app_role":"admin","user_id":"2147000001"}',true);
  PERFORM public.web_push_recipient_config_set(2147000001,'{}','remove');
  ASSERT jsonb_array_length(public.web_push_recipient_config_get(2147000001)->'recipients')=0;
  ASSERT NOT has_function_privilege('anon','public.web_push_recipient_candidates(bigint,text,integer,bigint)','EXECUTE');
  ASSERT NOT has_table_privilege('authenticated','public.web_push_recipient_configs','INSERT,UPDATE,DELETE,SELECT');
  RAISE NOTICE 'PASS: Phase45 scope, protected ownership, stale selections and atomic saves';
END;
$$;
ROLLBACK;
