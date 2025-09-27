-- Align allowed_don_vi_for_session with new JWT claim naming (app_role, dia_ban)
-- Resolves anonymous role mismatch causing RPC 400 errors after AUTH-1 rollout
-- ROLLBACK: Reapply definition from 20250927_regional_leader_schema_foundation.sql if reverting behavior

BEGIN;

CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session()
RETURNS BIGINT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_claims JSON := NULLIF(current_setting('request.jwt.claims', true), '')::json;
  v_user_role TEXT;
  v_user_don_vi BIGINT;
  v_user_dia_ban BIGINT;
  v_allowed_don_vi BIGINT[];
BEGIN
  IF v_claims IS NULL THEN
    RAISE EXCEPTION 'JWT claims missing for session';
  END IF;

  v_user_role := lower(COALESCE(v_claims->>'app_role', v_claims->>'role', ''));
  v_user_don_vi := NULLIF(COALESCE(v_claims->>'don_vi', ''), '')::BIGINT;
  v_user_dia_ban := NULLIF(COALESCE(v_claims->>'dia_ban', ''), '')::BIGINT;

  IF v_user_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT context';
  END IF;

  IF v_user_role = 'admin' THEN
    v_user_role := 'global';
  END IF;

  CASE v_user_role
    WHEN 'global' THEN
      SELECT array_agg(id)
      INTO v_allowed_don_vi
      FROM public.don_vi
      WHERE active = TRUE;

    WHEN 'regional_leader' THEN
      IF v_user_dia_ban IS NULL THEN
        RAISE EXCEPTION 'Regional leader must have dia_ban assigned';
      END IF;

      SELECT array_agg(id)
      INTO v_allowed_don_vi
      FROM public.don_vi
      WHERE dia_ban_id = v_user_dia_ban
        AND active = TRUE;

    WHEN 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
      IF v_user_don_vi IS NULL THEN
        RAISE EXCEPTION 'User must have don_vi assigned for role %', v_user_role;
      END IF;
      v_allowed_don_vi := ARRAY[v_user_don_vi];

    ELSE
      RAISE EXCEPTION 'Unknown role: %', v_user_role;
  END CASE;

  RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session()
IS 'Returns array of don_vi IDs the session user can access based on JWT role/app_role and dia_ban claims.';

COMMIT;
