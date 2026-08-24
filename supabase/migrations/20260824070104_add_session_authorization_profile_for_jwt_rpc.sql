-- OpenSpec add-technical-configuration-expert-role Phase 9:
-- add an authoritative session authorization profile without changing the
-- deployed get_session_profile_for_jwt(bigint) return shape.
--
-- Do not apply this migration to live before the exact landed commit passes
-- static and Oracle baseline-forward gates and receives explicit approval.
--
-- Rollback: ship a new forward-only migration that drops
-- public.get_session_authorization_profile_for_jwt(bigint). The existing
-- application remains on get_session_profile_for_jwt(bigint) until Phase 10.

BEGIN;

CREATE FUNCTION public.get_session_authorization_profile_for_jwt(p_user_id bigint)
RETURNS TABLE (
  password_changed_at timestamptz,
  current_don_vi bigint,
  don_vi bigint,
  khoa_phong text,
  full_name text,
  dia_ban_id bigint,
  ma_dia_ban text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim_app_role text;
  v_claim_user_id bigint;
  v_claim_user_id_text text;
  v_profile record;
  v_supported_roles CONSTANT text[] := ARRAY[
    'global',
    'admin',
    'chuyen_gia',
    'regional_leader',
    'to_qltb',
    'technician',
    'qltb_khoa',
    'user'
  ];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END IF;

  BEGIN
    v_claim_app_role := NULLIF(
      (current_setting('request.jwt.claims', true)::jsonb)->>'app_role',
      ''
    );
    v_claim_user_id_text := NULLIF(
      (current_setting('request.jwt.claims', true)::jsonb)->>'user_id',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END;

  IF v_claim_app_role IS NULL OR v_claim_app_role = '' THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END IF;

  IF v_claim_user_id_text IS NULL THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END IF;

  IF NOT (v_claim_app_role = ANY(v_supported_roles))
    OR v_claim_user_id_text !~ '^[0-9]+$'
  THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END IF;

  BEGIN
    v_claim_user_id := v_claim_user_id_text::bigint;
  EXCEPTION WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END;

  IF v_claim_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden session authorization profile access'
      USING errcode = '42501';
  END IF;

  SELECT
    nv.password_changed_at::timestamptz,
    nv.current_don_vi::bigint,
    nv.don_vi::bigint,
    nv.khoa_phong::text,
    nv.full_name::text,
    COALESCE(nv.dia_ban_id, dv.dia_ban_id)::bigint AS dia_ban_id,
    db.ma_dia_ban::text,
    nv.role::text
  INTO v_profile
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv
    ON dv.id = COALESCE(nv.current_don_vi, nv.don_vi)
  LEFT JOIN public.dia_ban db
    ON db.id = COALESCE(nv.dia_ban_id, dv.dia_ban_id)
  WHERE nv.id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_profile.role IS NULL OR NOT (v_profile.role = ANY(v_supported_roles)) THEN
    RAISE EXCEPTION 'Unsupported session authorization profile'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v_profile.password_changed_at,
    v_profile.current_don_vi,
    v_profile.don_vi,
    v_profile.khoa_phong,
    v_profile.full_name,
    v_profile.dia_ban_id,
    v_profile.ma_dia_ban,
    v_profile.role;
END;
$$;

REVOKE EXECUTE
ON FUNCTION public.get_session_authorization_profile_for_jwt(bigint)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.get_session_authorization_profile_for_jwt(bigint)
FROM anon;

REVOKE EXECUTE
ON FUNCTION public.get_session_authorization_profile_for_jwt(bigint)
FROM authenticated;

REVOKE EXECUTE
ON FUNCTION public.get_session_authorization_profile_for_jwt(bigint)
FROM service_role;

GRANT EXECUTE
ON FUNCTION public.get_session_authorization_profile_for_jwt(bigint)
TO authenticated, service_role;

COMMIT;
