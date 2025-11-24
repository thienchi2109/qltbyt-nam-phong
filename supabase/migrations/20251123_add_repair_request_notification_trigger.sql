-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to handle new repair request notifications
CREATE OR REPLACE FUNCTION public.handle_new_repair_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions -- Secure search path
AS $$
DECLARE
  v_user_ids uuid[];
  v_supabase_url text;
  v_function_url text;
  v_thiet_bi_name text;
  v_request_id int;
  v_internal_secret text; -- Shared secret for Edge Function auth
BEGIN
  v_request_id := NEW.id;

  -- Prefer reading the secret from public.internal_settings to avoid GUC dependency
  BEGIN
    EXECUTE $SQL$
      SELECT value::text FROM public.internal_settings WHERE lower(key) = 'internal_function_secret' LIMIT 1
    $SQL$
    INTO v_internal_secret;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_internal_secret := NULL;
  END;

  -- Resolve Supabase base URL from settings table first, then fallback to GUC
  BEGIN
    EXECUTE $SQL$
      SELECT value::text FROM public.internal_settings WHERE lower(key) = 'supabase_url' LIMIT 1
    $SQL$
    INTO v_supabase_url;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_supabase_url := NULL;
  END;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE WARNING 'handle_new_repair_request_notification: supabase_url is not configured';
    RETURN NEW;
  END IF;

  -- Normalize URL and construct function endpoint
  v_supabase_url := regexp_replace(v_supabase_url, '/+$', ''); -- strip trailing slash
  v_function_url := v_supabase_url || '/functions/v1/send-push-notification';

  -- Fallback to GUC if table lookup did not return a secret
  IF v_internal_secret IS NULL OR v_internal_secret = '' THEN
    v_internal_secret := current_setting('app.settings.internal_function_secret', true);
  END IF;

  IF v_internal_secret IS NULL OR v_internal_secret = '' THEN
    RAISE WARNING 'handle_new_repair_request_notification: internal function secret is not configured';
    RETURN NEW;
  END IF;

  -- 1. Get Equipment Name
  SELECT ten_thiet_bi INTO v_thiet_bi_name FROM public.thiet_bi WHERE id = NEW.thiet_bi_id;

  -- 2. Find Users to Notify (Global Admins and Technicians/Managers)
  -- Logic: Notify all users with role 'global' or 'to_qltb' (Equipment Management Team)
  SELECT array_agg(id) INTO v_user_ids
  FROM auth.users
  WHERE (raw_app_meta_data->>'role' IN ('global', 'to_qltb') OR raw_user_meta_data->>'role' IN ('global', 'to_qltb'));
  
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- 3. Call Edge Function via pg_net
  -- Note: We don't wait for the response (async)
  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_internal_secret
    ),
    body := jsonb_build_object(
      'userIds', v_user_ids,
      'notificationPayload', jsonb_build_object(
        'title', 'Yêu cầu sửa chữa mới',
        'body', 'Thiết bị ' || coalesce(v_thiet_bi_name, 'Unknown') || ' cần sửa chữa.',
        'data', jsonb_build_object('url', '/repair-requests?id=' || v_request_id)
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Failed to send notification trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_repair_request_created ON public.yeu_cau_sua_chua;
CREATE TRIGGER on_repair_request_created
AFTER INSERT ON public.yeu_cau_sua_chua
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_repair_request_notification();
