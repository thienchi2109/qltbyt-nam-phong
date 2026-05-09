-- Issue #405: keep tenant switching working after direct nhan_vien table
-- privileges are revoked from client/Data API roles.

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
  v_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_app_role TEXT := LOWER(NULLIF(COALESCE(v_claims->>'app_role', v_claims->>'role'), ''));
  v_claim_user_id BIGINT := NULLIF(v_claims->>'user_id', '')::BIGINT;
  v_has_membership BOOLEAN;
  v_tenant_active BOOLEAN;
BEGIN
  IF v_app_role = 'admin' THEN
    v_app_role := 'global';
  END IF;

  IF v_app_role IS NULL OR v_app_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_claim_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing user or tenant id' USING ERRCODE = '22023';
  END IF;

  IF v_claim_user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'user claim mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_app_role = 'global' THEN
    SELECT COALESCE(dv.active, TRUE)
    INTO v_tenant_active
    FROM public.don_vi dv
    WHERE dv.id = p_don_vi;

    IF v_tenant_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Invalid or inactive tenant' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_don_vi_memberships udvm
      WHERE udvm.user_id = p_user_id
        AND udvm.don_vi = p_don_vi
    )
    INTO v_has_membership;

    IF v_has_membership IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Người dùng không thuộc đơn vị này' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.nhan_vien
  SET current_don_vi = p_don_vi
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found with ID: %', p_user_id USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_set_current_don_vi(INTEGER, BIGINT) TO service_role;
