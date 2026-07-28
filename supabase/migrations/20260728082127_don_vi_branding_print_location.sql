-- Expose the tenant's curated dia_ban label as printable location.
-- This migration performs no normalization or data write.

DROP FUNCTION IF EXISTS public.don_vi_branding_get(bigint);

CREATE FUNCTION public.don_vi_branding_get(p_id bigint DEFAULT NULL)
RETURNS TABLE (
  id bigint,
  name text,
  logo_url text,
  print_location text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
  v_role_fallback text;
  v_claim_don_vi bigint;
  v_effective_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role')::text, ''));
  v_role_fallback := lower(coalesce(public._get_jwt_claim('role')::text, ''));
  IF v_role = '' THEN
    v_role := v_role_fallback;
  END IF;

  v_claim_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;

  -- The RPC proxy normalizes admin to global before signing the JWT.
  IF v_role = 'global' THEN
    v_effective_id := COALESCE(p_id, v_claim_don_vi);
  ELSE
    v_effective_id := v_claim_don_vi;
    IF v_effective_id IS NULL THEN
      RAISE EXCEPTION 'Thiếu thông tin đơn vị trong phiên đăng nhập'
        USING HINT = 'missing_don_vi_claim';
    END IF;
    IF p_id IS NOT NULL AND p_id <> v_effective_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING HINT = 'tenant_mismatch';
    END IF;
  END IF;

  IF v_effective_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.logo_url,
    db.ten_dia_ban AS print_location
  FROM public.don_vi d
  LEFT JOIN public.dia_ban db ON db.id = d.dia_ban_id
  WHERE d.id = v_effective_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_branding_get(bigint) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.don_vi_branding_get(bigint)
  TO anon, authenticated, service_role;
