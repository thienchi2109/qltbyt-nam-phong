CREATE OR REPLACE FUNCTION public.get_session_profile_for_jwt(p_user_id bigint)
RETURNS TABLE (
  password_changed_at timestamptz,
  current_don_vi bigint,
  don_vi bigint,
  khoa_phong text,
  full_name text,
  dia_ban_id bigint,
  ma_dia_ban text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb;
  v_claim_user_id bigint;
  v_claim_user_id_text text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden session profile access' USING errcode = '42501';
  END IF;

  v_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_claim_user_id_text := NULLIF(v_claims->>'user_id', '');

  IF v_claim_user_id_text IS NULL OR v_claim_user_id_text !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Forbidden session profile access' USING errcode = '42501';
  END IF;

  v_claim_user_id := v_claim_user_id_text::bigint;

  IF v_claim_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden session profile access' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    nv.password_changed_at::timestamptz,
    nv.current_don_vi::bigint,
    nv.don_vi::bigint,
    nv.khoa_phong::text,
    nv.full_name::text,
    COALESCE(nv.dia_ban_id, dv.dia_ban_id)::bigint AS dia_ban_id,
    db.ma_dia_ban::text
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv
    ON dv.id = COALESCE(nv.current_don_vi, nv.don_vi)
  LEFT JOIN public.dia_ban db
    ON db.id = COALESCE(nv.dia_ban_id, dv.dia_ban_id)
  WHERE nv.id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_profile_for_jwt(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_session_profile_for_jwt(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_session_profile_for_jwt(bigint) TO authenticated, service_role;
