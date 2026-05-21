-- Supersede the live MCP-applied AI quota functions after PR review fixes.
-- The earlier live migrations were applied before the review hardening changes.

ALTER TABLE public.ai_quota_reservations
  ALTER COLUMN tokens_in TYPE BIGINT USING tokens_in::BIGINT,
  ALTER COLUMN tokens_out TYPE BIGINT USING tokens_out::BIGINT;

DROP FUNCTION IF EXISTS public.ai_quota_finalize(UUID, TEXT, INTEGER, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION public.ai_quota_reserve(
  p_user_id TEXT,
  p_tenant_id INTEGER,
  p_rate_window_ms INTEGER,
  p_rate_max INTEGER,
  p_user_daily_max INTEGER,
  p_tenant_daily_max INTEGER,
  p_global_daily_max INTEGER,
  p_ttl_ms INTEGER,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  allowed BOOLEAN,
  reservation_id UUID,
  reason TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims_text TEXT := current_setting('request.jwt.claims', true);
  v_claims JSONB;
  v_claim_user_id TEXT;
  v_role TEXT;
  v_now TIMESTAMPTZ := now();
  v_window_id TEXT;
  v_window_expires_at TIMESTAMPTZ;
  v_counter_refs JSONB;
  v_reservation_id UUID := gen_random_uuid();
  v_rate_count INTEGER;
  v_counter RECORD;
  v_expired RECORD;
  v_ref RECORD;
  v_limit INTEGER;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'Missing user id' USING ERRCODE = '22023';
  END IF;

  IF p_rate_window_ms IS NULL OR p_rate_window_ms <= 0
     OR p_rate_max IS NULL OR p_rate_max < 0
     OR p_user_daily_max IS NULL OR p_user_daily_max < 0
     OR p_tenant_daily_max IS NULL OR p_tenant_daily_max < 0
     OR p_global_daily_max IS NULL OR p_global_daily_max < 0
     OR p_ttl_ms IS NULL OR p_ttl_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid AI quota limit parameter' USING ERRCODE = '22023';
  END IF;

  IF v_claims_text IS NULL OR btrim(v_claims_text) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_claims := v_claims_text::jsonb;
  v_claim_user_id := NULLIF(v_claims->>'user_id', '');
  v_role := NULLIF(v_claims->>'app_role', '');

  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_claim_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  v_window_id := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_window_expires_at := (
    date_trunc('day', v_now AT TIME ZONE 'UTC') + interval '1 day'
  ) AT TIME ZONE 'UTC';

  v_counter_refs := jsonb_build_array(jsonb_build_object(
    'scope', 'user_daily',
    'key', p_user_id,
    'window_id', v_window_id
  ));

  IF p_tenant_id IS NOT NULL THEN
    v_counter_refs := v_counter_refs || jsonb_build_array(jsonb_build_object(
      'scope', 'tenant_daily',
      'key', p_tenant_id::text,
      'window_id', v_window_id
    ));
  END IF;

  v_counter_refs := v_counter_refs || jsonb_build_array(jsonb_build_object(
    'scope', 'global_daily',
    'key', 'global',
    'window_id', v_window_id
  ));

  -- Preserve global lock order: reservations first, then counters.
  FOR v_expired IN
    SELECT *
    FROM public.ai_quota_reservations
    WHERE status = 'reserved'
      AND expires_at < v_now
      AND (
        counter_refs @> jsonb_build_array(jsonb_build_object('scope', 'user_daily', 'key', p_user_id))
        OR (p_tenant_id IS NOT NULL AND counter_refs @> jsonb_build_array(jsonb_build_object('scope', 'tenant_daily', 'key', p_tenant_id::text)))
        OR counter_refs @> jsonb_build_array(jsonb_build_object('scope', 'global_daily', 'key', 'global'))
      )
    ORDER BY id
    FOR UPDATE
  LOOP
    FOR v_ref IN
      SELECT ref->>'scope' AS scope, ref->>'key' AS key, ref->>'window_id' AS window_id
      FROM jsonb_array_elements(v_expired.counter_refs) AS ref
      ORDER BY ref->>'scope', ref->>'key', ref->>'window_id'
    LOOP
      UPDATE public.ai_quota_counters
      SET reserved = GREATEST(reserved - 1, 0),
          updated_at = v_now
      WHERE scope = v_ref.scope
        AND key = v_ref.key
        AND window_id = v_ref.window_id;
    END LOOP;

    UPDATE public.ai_quota_reservations
    SET status = 'expired'
    WHERE id = v_expired.id;
  END LOOP;

  DELETE FROM public.ai_rate_events
  WHERE user_id = p_user_id
    AND ts < v_now - (p_rate_window_ms * interval '1 millisecond');

  WITH refs AS (
    SELECT r.scope, r.key, r.window_id
    FROM jsonb_to_recordset(v_counter_refs) AS r(scope TEXT, key TEXT, window_id TEXT)
    ORDER BY r.scope, r.key, r.window_id
  )
  INSERT INTO public.ai_quota_counters(scope, key, window_id, expires_at, updated_at)
  SELECT refs.scope, refs.key, refs.window_id, v_window_expires_at, v_now
  FROM refs
  ON CONFLICT (scope, key, window_id) DO UPDATE
  SET expires_at = GREATEST(public.ai_quota_counters.expires_at, EXCLUDED.expires_at),
      updated_at = v_now;

  -- Lock the per-user daily counter before checking the sliding rate window.
  -- This serializes reservations for the same user without a separate lock table.
  PERFORM 1
  FROM public.ai_quota_counters c
  WHERE c.scope = 'user_daily'
    AND c.key = p_user_id
    AND c.window_id = v_window_id
  FOR UPDATE;

  SELECT count(*)::integer
  INTO v_rate_count
  FROM public.ai_rate_events
  WHERE user_id = p_user_id
    AND ts >= v_now - (p_rate_window_ms * interval '1 millisecond');

  IF v_rate_count >= p_rate_max THEN
    allowed := false;
    reservation_id := NULL;
    reason := 'rate_limit';
    message := 'AI rate limit exceeded';
    RETURN NEXT;
    RETURN;
  END IF;

  FOR v_counter IN
    SELECT c.*
    FROM public.ai_quota_counters c
    JOIN jsonb_to_recordset(v_counter_refs) AS r(scope TEXT, key TEXT, window_id TEXT)
      ON r.scope = c.scope
     AND r.key = c.key
     AND r.window_id = c.window_id
    ORDER BY c.scope, c.key, c.window_id
    FOR UPDATE OF c
  LOOP
    v_limit := CASE v_counter.scope
      WHEN 'user_daily' THEN p_user_daily_max
      WHEN 'tenant_daily' THEN p_tenant_daily_max
      WHEN 'global_daily' THEN p_global_daily_max
      ELSE 0
    END;

    IF v_counter.count + v_counter.reserved >= v_limit THEN
      allowed := false;
      reservation_id := NULL;
      reason := CASE v_counter.scope
        WHEN 'user_daily' THEN 'user_quota'
        WHEN 'tenant_daily' THEN 'tenant_quota'
        WHEN 'global_daily' THEN 'global_quota'
        ELSE 'quota'
      END;
      message := 'AI daily quota exceeded';
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  FOR v_ref IN
    SELECT ref->>'scope' AS scope, ref->>'key' AS key, ref->>'window_id' AS window_id
    FROM jsonb_array_elements(v_counter_refs) AS ref
    ORDER BY ref->>'scope', ref->>'key', ref->>'window_id'
  LOOP
    UPDATE public.ai_quota_counters
    SET reserved = reserved + 1,
        updated_at = v_now
    WHERE scope = v_ref.scope
      AND key = v_ref.key
      AND window_id = v_ref.window_id;
  END LOOP;

  INSERT INTO public.ai_rate_events(reservation_id, user_id, ts)
  VALUES (v_reservation_id, p_user_id, v_now);

  INSERT INTO public.ai_quota_reservations(
    id,
    user_id,
    tenant_id,
    reserved_at,
    expires_at,
    status,
    counter_refs
  )
  VALUES (
    v_reservation_id,
    p_user_id,
    p_tenant_id,
    v_now,
    v_now + (p_ttl_ms * interval '1 millisecond'),
    'reserved',
    v_counter_refs
  );

  allowed := true;
  reservation_id := v_reservation_id;
  reason := NULL;
  message := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_quota_finalize(
  p_reservation_id UUID,
  p_status TEXT,
  p_tokens_in BIGINT,
  p_tokens_out BIGINT,
  p_cost_usd NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims_text TEXT := current_setting('request.jwt.claims', true);
  v_claims JSONB;
  v_claim_user_id TEXT;
  v_role TEXT;
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_ref RECORD;
  v_tokens_in BIGINT := GREATEST(COALESCE(p_tokens_in, 0), 0);
  v_tokens_out BIGINT := GREATEST(COALESCE(p_tokens_out, 0), 0);
  v_cost_usd NUMERIC(12,6) := GREATEST(COALESCE(p_cost_usd, 0), 0);
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_status NOT IN ('success', 'error_with_usage', 'error_no_usage') THEN
    RAISE EXCEPTION 'Invalid AI quota finalize status' USING ERRCODE = '22023';
  END IF;

  IF v_claims_text IS NULL OR btrim(v_claims_text) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_claims := v_claims_text::jsonb;
  v_claim_user_id := NULLIF(v_claims->>'user_id', '');
  v_role := NULLIF(v_claims->>'app_role', '');

  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.status <> 'reserved' THEN
    RETURN;
  END IF;

  IF v_reservation.user_id IS DISTINCT FROM v_claim_user_id THEN
    RAISE EXCEPTION 'reservation user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  FOR v_ref IN
    SELECT ref->>'scope' AS scope, ref->>'key' AS key, ref->>'window_id' AS window_id
    FROM jsonb_array_elements(v_reservation.counter_refs) AS ref
    ORDER BY ref->>'scope', ref->>'key', ref->>'window_id'
  LOOP
    UPDATE public.ai_quota_counters
    SET reserved = GREATEST(reserved - 1, 0),
        count = count + CASE WHEN p_status IN ('success', 'error_with_usage') THEN 1 ELSE 0 END,
        tokens_in = tokens_in + CASE WHEN p_status IN ('success', 'error_with_usage') THEN v_tokens_in ELSE 0 END,
        tokens_out = tokens_out + CASE WHEN p_status IN ('success', 'error_with_usage') THEN v_tokens_out ELSE 0 END,
        cost_usd = cost_usd + CASE WHEN p_status IN ('success', 'error_with_usage') THEN v_cost_usd ELSE 0 END,
        updated_at = v_now
    WHERE scope = v_ref.scope
      AND key = v_ref.key
      AND window_id = v_ref.window_id;
  END LOOP;

  IF p_status = 'error_no_usage' THEN
    DELETE FROM public.ai_rate_events
    WHERE reservation_id = p_reservation_id;
  END IF;

  UPDATE public.ai_quota_reservations
  SET status = p_status,
      tokens_in = v_tokens_in,
      tokens_out = v_tokens_out,
      cost_usd = v_cost_usd
  WHERE id = p_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_quota_release_expired(
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims_text TEXT := current_setting('request.jwt.claims', true);
  v_claims JSONB;
  v_role TEXT;
  v_now TIMESTAMPTZ := now();
  v_expired RECORD;
  v_ref RECORD;
  v_released INTEGER := 0;
BEGIN
  IF v_claims_text IS NULL OR btrim(v_claims_text) = '' THEN
    RAISE EXCEPTION 'Missing JWT claims' USING ERRCODE = '42501';
  END IF;

  v_claims := v_claims_text::jsonb;
  v_role := COALESCE(NULLIF(v_claims->>'app_role', ''), NULLIF(v_claims->>'role', ''));

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('global', 'service_role') THEN
    RAISE EXCEPTION 'Insufficient privileges to release AI quota reservations' USING ERRCODE = '42501';
  END IF;

  FOR v_expired IN
    SELECT *
    FROM public.ai_quota_reservations
    WHERE status = 'reserved'
      AND expires_at < v_now
    ORDER BY id
    FOR UPDATE
  LOOP
    FOR v_ref IN
      SELECT ref->>'scope' AS scope, ref->>'key' AS key, ref->>'window_id' AS window_id
      FROM jsonb_array_elements(v_expired.counter_refs) AS ref
      ORDER BY ref->>'scope', ref->>'key', ref->>'window_id'
    LOOP
      UPDATE public.ai_quota_counters
      SET reserved = GREATEST(reserved - 1, 0),
          updated_at = v_now
      WHERE scope = v_ref.scope
        AND key = v_ref.key
        AND window_id = v_ref.window_id;
    END LOOP;

    UPDATE public.ai_quota_reservations
    SET status = 'expired'
    WHERE id = v_expired.id;

    v_released := v_released + 1;
  END LOOP;

  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_quota_reserve(
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_quota_finalize(UUID, TEXT, BIGINT, BIGINT, NUMERIC)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_quota_release_expired(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ai_quota_reserve(
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  INTEGER,
  TIMESTAMPTZ
)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_quota_finalize(UUID, TEXT, BIGINT, BIGINT, NUMERIC)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_quota_release_expired(TIMESTAMPTZ)
  TO service_role;
