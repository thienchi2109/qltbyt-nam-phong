-- OpenSpec add-technical-configuration-expert-role, Phase 12:
-- protect expert account scope and provide the only atomic reassignment path.

BEGIN;

CREATE OR REPLACE FUNCTION public.user_membership_add(
  p_user_id INTEGER,
  p_don_vi BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_app_role TEXT;
  v_claim_user_id BIGINT;
  v_req_don_vi BIGINT;
  v_target_role TEXT;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_app_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_claim_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_app_role IS NULL OR v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_req_don_vi := NULLIF(v_claims->>'don_vi', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing user or tenant id' USING ERRCODE = '22023';
  END IF;

  IF v_app_role IS DISTINCT FROM 'global'
    AND (v_req_don_vi IS NULL OR v_req_don_vi IS DISTINCT FROM p_don_vi)
  THEN
    RAISE EXCEPTION 'Khong co quyen them thanh vien ngoai don vi hien tai'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(nv.role)
  INTO v_target_role
  FROM public.nhan_vien nv
  WHERE nv.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id USING ERRCODE = '22023';
  END IF;

  IF v_target_role = 'chuyen_gia' THEN
    RAISE EXCEPTION 'Expert scope requires user_reassign_expert_scope'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
  VALUES (p_user_id, p_don_vi)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_membership_remove(
  p_user_id INTEGER,
  p_don_vi BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_app_role TEXT;
  v_claim_user_id BIGINT;
  v_req_don_vi BIGINT;
  v_target_role TEXT;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_app_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_claim_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_app_role IS NULL OR v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_req_don_vi := NULLIF(v_claims->>'don_vi', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing user or tenant id' USING ERRCODE = '22023';
  END IF;

  IF v_app_role IS DISTINCT FROM 'global'
    AND (v_req_don_vi IS NULL OR v_req_don_vi IS DISTINCT FROM p_don_vi)
  THEN
    RAISE EXCEPTION 'Khong co quyen xoa thanh vien ngoai don vi hien tai'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(nv.role)
  INTO v_target_role
  FROM public.nhan_vien nv
  WHERE nv.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id USING ERRCODE = '22023';
  END IF;

  IF v_target_role = 'chuyen_gia' THEN
    RAISE EXCEPTION 'Expert scope requires user_reassign_expert_scope'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_don_vi_memberships
  WHERE user_id = p_user_id
    AND don_vi = p_don_vi;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_set_current_don_vi(
  p_user_id INTEGER,
  p_don_vi BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_app_role TEXT;
  v_claim_user_id BIGINT;
  v_target_role TEXT;
  v_has_membership BOOLEAN;
  v_is_global BOOLEAN;
  v_tenant_active BOOLEAN;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_app_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_claim_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_app_role IS NULL OR v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  v_is_global := v_app_role IN ('admin', 'global');

  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing user or tenant id' USING ERRCODE = '22023';
  END IF;

  SELECT LOWER(nv.role)
  INTO v_target_role
  FROM public.nhan_vien nv
  WHERE nv.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id USING ERRCODE = '22023';
  END IF;

  IF v_target_role = 'chuyen_gia' THEN
    RAISE EXCEPTION 'Expert scope requires user_reassign_expert_scope'
      USING ERRCODE = '42501';
  END IF;

  IF v_claim_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user claim mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(dv.active, true)
  INTO v_tenant_active
  FROM public.don_vi dv
  WHERE dv.id = p_don_vi;

  IF v_tenant_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Invalid or inactive tenant' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_global THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_don_vi_memberships udvm
      WHERE udvm.user_id = p_user_id
        AND udvm.don_vi = p_don_vi
    )
    INTO v_has_membership;

    IF v_has_membership IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Nguoi dung khong thuoc don vi nay' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.nhan_vien
  SET current_don_vi = p_don_vi
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_reassign_expert_scope(
  p_user_id BIGINT,
  p_don_vi BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims JSONB;
  v_app_role TEXT;
  v_claim_user_id BIGINT;
  v_caller_role TEXT;
  v_target_role TEXT;
  v_dia_ban_id BIGINT;
  v_invariant_valid BOOLEAN;
BEGIN
  BEGIN
    v_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::JSONB;
    v_app_role := LOWER(NULLIF(v_claims->>'app_role', ''));
    v_claim_user_id := NULLIF(v_claims->>'user_id', '')::BIGINT;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END;

  IF v_app_role IS NULL OR v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing user or tenant id' USING ERRCODE = '22023';
  END IF;

  SELECT LOWER(nv.role)
  INTO v_caller_role
  FROM public.nhan_vien nv
  WHERE nv.id = v_claim_user_id;

  IF v_app_role NOT IN ('admin', 'global')
    OR v_caller_role IS NULL
    OR v_caller_role NOT IN ('admin', 'global')
  THEN
    RAISE EXCEPTION 'Access denied: Admin or Global privileges required'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(nv.role)
  INTO v_target_role
  FROM public.nhan_vien nv
  WHERE nv.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id USING ERRCODE = '22023';
  END IF;

  IF v_target_role <> 'chuyen_gia' THEN
    RAISE EXCEPTION 'Target user is not an expert' USING ERRCODE = '22023';
  END IF;

  SELECT dv.dia_ban_id
  INTO v_dia_ban_id
  FROM public.don_vi dv
  JOIN public.dia_ban db
    ON db.id = dv.dia_ban_id
  WHERE dv.id = p_don_vi
    AND COALESCE(dv.active, true);

  IF NOT FOUND OR v_dia_ban_id IS NULL THEN
    RAISE EXCEPTION 'Invalid expert destination' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi, role_override)
  VALUES (p_user_id, p_don_vi, NULL)
  ON CONFLICT (user_id, don_vi)
  DO UPDATE SET role_override = NULL;

  UPDATE public.nhan_vien
  SET don_vi = p_don_vi,
      current_don_vi = p_don_vi,
      dia_ban_id = v_dia_ban_id
  WHERE id = p_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.nhan_vien nv
    JOIN public.user_don_vi_memberships udvm
      ON udvm.user_id = nv.id
     AND udvm.don_vi = p_don_vi
    JOIN public.don_vi dv
      ON dv.id = p_don_vi
    JOIN public.dia_ban db
      ON db.id = dv.dia_ban_id
    WHERE nv.id = p_user_id
      AND LOWER(nv.role) = 'chuyen_gia'
      AND nv.don_vi = p_don_vi
      AND nv.current_don_vi = p_don_vi
      AND nv.dia_ban_id = dv.dia_ban_id
      AND udvm.role_override IS NULL
  )
  INTO v_invariant_valid;

  IF v_invariant_valid IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expert scope invariant could not be established'
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.user_don_vi_memberships
  WHERE user_id = p_user_id
    AND don_vi <> p_don_vi;

  IF EXISTS (
    SELECT 1
    FROM public.user_don_vi_memberships udvm
    WHERE udvm.user_id = p_user_id
      AND (
        udvm.don_vi <> p_don_vi
        OR udvm.role_override IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Obsolete expert assignment state remains'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.user_membership_add(INTEGER, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_membership_add(INTEGER, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_membership_add(INTEGER, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_membership_add(INTEGER, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.user_membership_remove(INTEGER, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_membership_remove(INTEGER, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_membership_remove(INTEGER, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_membership_remove(INTEGER, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.user_reassign_expert_scope(BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_reassign_expert_scope(BIGINT, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_reassign_expert_scope(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_reassign_expert_scope(BIGINT, BIGINT) TO service_role;

COMMIT;
