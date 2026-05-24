-- Issue #544 follow-up: clear expired block state when a throttle bucket window resets.
-- The first live migration left blocked_until unchanged after an expired block
-- unless the first new failure immediately crossed the threshold again.

BEGIN;

CREATE OR REPLACE FUNCTION public._auth_login_throttle_record_bucket(
  p_bucket_type text,
  p_username_hash text,
  p_ip_address inet,
  p_threshold integer,
  p_window interval,
  p_block_duration interval
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.auth_login_attempt_throttle%ROWTYPE;
  v_reset_window boolean;
  v_failed_count integer;
BEGIN
  IF p_ip_address IS NULL
     OR p_threshold <= 0
     OR p_bucket_type NOT IN ('username_ip', 'ip')
     OR (p_bucket_type = 'username_ip' AND p_username_hash IS NULL)
     OR (p_bucket_type = 'ip' AND p_username_hash IS NOT NULL) THEN
    RETURN TRUE;
  END IF;

  LOOP
    SELECT *
    INTO v_row
    FROM public.auth_login_attempt_throttle
    WHERE bucket_type = p_bucket_type
      AND ip_address = p_ip_address
      AND (
        (p_bucket_type = 'ip' AND username_hash IS NULL)
        OR (p_bucket_type = 'username_ip' AND username_hash = p_username_hash)
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO public.auth_login_attempt_throttle (
          bucket_type,
          username_hash,
          ip_address,
          failed_count,
          window_started_at,
          last_failed_at,
          blocked_until,
          updated_at
        )
        VALUES (
          p_bucket_type,
          p_username_hash,
          p_ip_address,
          1,
          v_now,
          v_now,
          CASE WHEN p_threshold <= 1 THEN v_now + p_block_duration ELSE NULL END,
          v_now
        );
        RETURN TRUE;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    ELSE
      v_reset_window :=
        v_row.window_started_at <= v_now - p_window
        OR (v_row.blocked_until IS NOT NULL AND v_row.blocked_until <= v_now);
      v_failed_count := CASE WHEN v_reset_window THEN 1 ELSE v_row.failed_count + 1 END;

      UPDATE public.auth_login_attempt_throttle
      SET failed_count = v_failed_count,
          window_started_at = CASE WHEN v_reset_window THEN v_now ELSE window_started_at END,
          last_failed_at = v_now,
          blocked_until = CASE
            WHEN v_failed_count >= p_threshold THEN v_now + p_block_duration
            WHEN v_reset_window THEN NULL
            ELSE blocked_until
          END,
          updated_at = v_now
      WHERE id = v_row.id;

      RETURN TRUE;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._auth_login_throttle_record_bucket(
  text, text, inet, integer, interval, interval
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._auth_login_throttle_record_bucket(
  text, text, inet, integer, interval, interval
) FROM anon;
REVOKE ALL ON FUNCTION public._auth_login_throttle_record_bucket(
  text, text, inet, integer, interval, interval
) FROM authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
