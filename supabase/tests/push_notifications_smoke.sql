-- supabase/tests/push_notifications_smoke.sql
-- Purpose: Smoke tests to ensure push notification plumbing is configured and callable.
-- How to run (psql): \i supabase/tests/push_notifications_smoke.sql
-- Tests:
-- 1) internal_settings rows are readable case-insensitively (secret + supabase_url).
-- 2) trigger function definition includes case-insensitive lookups and internal secret header.

-- 1) internal_settings rows resolve with lowercase/uppercase keys
DO $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  SELECT value::text INTO v_secret FROM public.internal_settings WHERE lower(key) = 'internal_function_secret' LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'Missing internal_function_secret in public.internal_settings';
  END IF;

  SELECT value::text INTO v_url FROM public.internal_settings WHERE lower(key) = 'supabase_url' LIMIT 1;
  IF v_url IS NULL OR v_url = '' THEN
    RAISE EXCEPTION 'Missing supabase_url in public.internal_settings';
  END IF;

  RAISE NOTICE 'OK: internal_function_secret and supabase_url found in internal_settings';
END $$;

-- 2) Function definition sanity: case-insensitive lookups and secret header
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.handle_new_repair_request_notification'::regproc);
BEGIN
  IF position('lower(key) = ''internal_function_secret''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Function does not use case-insensitive internal_function_secret lookup';
  END IF;
  IF position('lower(key) = ''supabase_url''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Function does not use case-insensitive supabase_url lookup';
  END IF;
  IF position('x-internal-secret' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Function does not send x-internal-secret header in pg_net call';
  END IF;
  RAISE NOTICE 'OK: handle_new_repair_request_notification definition includes case-insensitive lookups and internal header';
END $$;
