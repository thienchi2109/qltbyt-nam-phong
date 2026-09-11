-- Web Push Phase 2: session-owned registration, revision fencing and revocation.
-- Backend controls, DNS safety at send time and dispatch belong to later phases.
BEGIN;

CREATE FUNCTION public.web_push_session_user_id()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
DECLARE c jsonb; v_id bigint; v_role text;
BEGIN
  c := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  IF c->>'user_id' IS NULL OR c->>'user_id' !~ '^[1-9][0-9]*$'
    OR (c->>'role' IS NOT NULL AND c->>'role'<>'authenticated') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  v_id := (c->>'user_id')::bigint; v_role := c->>'app_role';
  IF v_id IS NULL OR v_role IS NULL OR v_role NOT IN ('global','admin','chuyen_gia','regional_leader','to_qltb','technician','qltb_khoa','user') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_session_authorization_profile_for_jwt(v_id) p WHERE p.dia_ban_id IS NOT NULL) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN v_id;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION public.web_push_session_user_id() FROM PUBLIC, anon, authenticated, service_role;

-- Validate uncompressed P-256 points using exact numeric arithmetic, without an extension.
CREATE FUNCTION public.web_push_subscription_keys_valid(p_p256dh text, p_auth text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_point bytea;
  v_auth bytea;
  v_x numeric := 0;
  v_y numeric := 0;
  v_prime constant numeric := 115792089210356248762697446949407573530086143415290314195533631308867097853951;
  v_b constant numeric := 41058363725152142129326129780047268409114441015993725554835256314039467401291;
  v_i integer;
BEGIN
  IF p_p256dh IS NULL OR p_auth IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{87}$'
    OR p_auth !~ '^[A-Za-z0-9_-]{22}$' THEN RETURN false; END IF;
  v_point := decode(translate(p_p256dh, '-_', '+/') || '=', 'base64');
  v_auth := decode(translate(p_auth, '-_', '+/') || '==', 'base64');
  IF octet_length(v_point) <> 65 OR get_byte(v_point, 0) <> 4 OR octet_length(v_auth) <> 16
    OR translate(rtrim(replace(encode(v_point, 'base64'), E'\n', ''), '='), '+/', '-_') <> p_p256dh
    OR translate(rtrim(encode(v_auth, 'base64'), '='), '+/', '-_') <> p_auth THEN RETURN false; END IF;
  FOR v_i IN 1..32 LOOP
    v_x := v_x * 256 + get_byte(v_point, v_i);
    v_y := v_y * 256 + get_byte(v_point, v_i + 32);
  END LOOP;
  RETURN v_x < v_prime AND v_y < v_prime
    AND mod(v_y*v_y - v_x*v_x*v_x + 3*v_x - v_b, v_prime) = 0;
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.web_push_subscription_keys_valid(text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.web_push_subscription_register(p_subscription jsonb, p_vapid_key_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id bigint;
  v_epoch timestamptz;
  v_endpoint text;
  v_row public.web_push_subscriptions%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  v_user_id := public.web_push_session_user_id();
  IF p_subscription IS NULL OR jsonb_typeof(p_subscription) <> 'object'
    OR p_subscription - ARRAY['endpoint','keys'] <> '{}'::jsonb
    OR jsonb_typeof(p_subscription->'endpoint') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_subscription->'keys') IS DISTINCT FROM 'object'
    OR (p_subscription->'keys') - ARRAY['p256dh','auth'] <> '{}'::jsonb
    OR jsonb_typeof(p_subscription#>'{keys,p256dh}') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_subscription#>'{keys,auth}') IS DISTINCT FROM 'string'
    OR p_vapid_key_version IS NULL OR p_vapid_key_version !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    OR octet_length(p_subscription::text) > 16384 THEN
    RAISE EXCEPTION 'invalid_subscription' USING ERRCODE = '22023';
  END IF;
  v_endpoint := p_subscription->>'endpoint';
  IF octet_length(v_endpoint) > 2048
    OR v_endpoint !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:443)?(/[^[:space:]#]*)?$'
    OR v_endpoint ~ '[[:cntrl:]\\]'
    OR NOT public.web_push_subscription_keys_valid(p_subscription#>>'{keys,p256dh}', p_subscription#>>'{keys,auth}') THEN
    RAISE EXCEPTION 'invalid_subscription' USING ERRCODE = '22023';
  END IF;
  -- Serialize a user's registrations for the ten-active limit and password epoch snapshot.
  SELECT nv.password_changed_at INTO v_epoch FROM public.nhan_vien nv WHERE nv.id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT s.* INTO v_row FROM public.web_push_subscriptions s WHERE s.endpoint = v_endpoint FOR UPDATE;
  IF FOUND THEN
    IF v_row.user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'subscription_conflict' USING ERRCODE = '40001';
    END IF;
    IF v_row.revoked_at IS NULL AND v_row.p256dh = p_subscription#>>'{keys,p256dh}'
      AND v_row.auth = p_subscription#>>'{keys,auth}' AND v_row.vapid_key_version = p_vapid_key_version
      AND v_row.authorization_epoch IS NOT DISTINCT FROM v_epoch THEN
      RETURN jsonb_build_object('version',1,'subscription_id',v_row.id,'revision',v_row.revision::text);
    END IF;
  END IF;
  IF (v_row.id IS NULL OR v_row.revoked_at IS NOT NULL) AND (
    SELECT count(*) FROM public.web_push_subscriptions s WHERE s.user_id = v_user_id AND s.revoked_at IS NULL
  ) >= 10 THEN RAISE EXCEPTION 'subscription_limit' USING ERRCODE = '22023'; END IF;
  IF v_row.id IS NULL THEN
    BEGIN
      INSERT INTO public.web_push_subscriptions(user_id,endpoint,p256dh,auth,vapid_key_version,authorization_epoch)
      VALUES(v_user_id,v_endpoint,p_subscription#>>'{keys,p256dh}',p_subscription#>>'{keys,auth}',p_vapid_key_version,v_epoch)
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'subscription_conflict' USING ERRCODE = '40001';
    END;
  ELSE
    UPDATE public.web_push_notification_deliveries SET status='cancelled',terminal_at=v_now,
      result=jsonb_build_object('reason','subscription_revision_changed')
    WHERE subscription_id=v_row.id AND subscription_revision=v_row.revision AND status IN ('pending','retry','leased');
    UPDATE public.web_push_subscriptions SET p256dh=p_subscription#>>'{keys,p256dh}',auth=p_subscription#>>'{keys,auth}',
      vapid_key_version=p_vapid_key_version,authorization_epoch=v_epoch,revision=revision+1,revoked_at=NULL,updated_at=v_now
    WHERE id=v_row.id RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('version',1,'subscription_id',v_row.id,'revision',v_row.revision::text);
END;
$$;

CREATE FUNCTION public.web_push_subscription_revoke(p_subscription_id uuid, p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id bigint;
  v_row public.web_push_subscriptions%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  v_user_id := public.web_push_session_user_id();
  IF p_subscription_id IS NULL OR p_revision IS NULL OR p_revision < 1 THEN
    RAISE EXCEPTION 'invalid_subscription' USING ERRCODE = '22023';
  END IF;
  SELECT s.* INTO v_row FROM public.web_push_subscriptions s WHERE s.id=p_subscription_id FOR UPDATE;
  -- Absent and foreign IDs have the same response; foreign owners cannot be changed.
  IF NOT FOUND OR v_row.user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('version',1,'revoked',true);
  END IF;
  IF v_row.revision <> p_revision THEN
    RAISE EXCEPTION 'subscription_conflict' USING ERRCODE = '40001';
  END IF;
  IF v_row.revoked_at IS NULL THEN
    UPDATE public.web_push_subscriptions SET revoked_at=v_now,updated_at=v_now WHERE id=v_row.id;
    UPDATE public.web_push_notification_deliveries SET status='cancelled',terminal_at=v_now,
      result=jsonb_build_object('reason','subscription_revoked')
    WHERE subscription_id=v_row.id AND subscription_revision=v_row.revision AND status IN ('pending','retry','leased');
  END IF;
  RETURN jsonb_build_object('version',1,'revoked',true);
END;
$$;

REVOKE ALL ON FUNCTION public.web_push_subscription_register(jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.web_push_subscription_revoke(uuid,bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.web_push_subscription_register(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_subscription_revoke(uuid,bigint) TO authenticated;
COMMIT;
