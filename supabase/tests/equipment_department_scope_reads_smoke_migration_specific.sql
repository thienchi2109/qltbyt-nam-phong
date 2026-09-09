-- Chunk 4e staged business companion.
BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_allowed_id bigint;
  v_blocked_id bigint;
  v_other_tenant_id bigint;
  v_payload jsonb;
  v_count integer;
  v_name text;
  v_rec public.thiet_bi;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
  v_names text[];
  v_proconfig text[];
  v_dash_baseline text;
BEGIN
  IF public._normalize_department_scope('Ngoại Lồng Ngực')
     IS DISTINCT FROM public._normalize_department_scope('Ngoại Lồng Ngực') THEN
    RAISE EXCEPTION '_normalize_department_scope should match decomposed and precomposed Vietnamese text';
  END IF;

  IF public._normalize_department_scope('Ngoại CT-Bỏng')
     IS DISTINCT FROM public._normalize_department_scope('Ngoại Chấn Thương-Bỏng') THEN
    RAISE EXCEPTION '_normalize_department_scope should match scoped CT alias to Chấn Thương';
  END IF;

  v_dash_baseline := public._normalize_department_scope('aa-bb');
  IF v_dash_baseline IS DISTINCT FROM public._normalize_department_scope('aa- bb')
     OR v_dash_baseline IS DISTINCT FROM public._normalize_department_scope('aa -bb')
     OR v_dash_baseline IS DISTINCT FROM public._normalize_department_scope('aa - bb') THEN
    RAISE EXCEPTION '_normalize_department_scope should treat dash spacing variants equally';
  END IF;

  RAISE NOTICE 'OK: equipment department scope read smoke checks passed';
END $$;

ROLLBACK;
