-- Fix ambiguous "id" reference by qualifying table alias; add role fallback
CREATE OR REPLACE FUNCTION public.don_vi_set_active(
  p_id bigint,
  p_active boolean
) RETURNS TABLE (
  id bigint,
  code text,
  name text,
  active boolean,
  membership_quota integer,
  logo_url text,
  used_count integer
) LANGUAGE plpgsql AS $$
DECLARE v_role text;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  UPDATE public.don_vi AS dv
  SET active = COALESCE(p_active, dv.active)
  WHERE dv.id = p_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_set_active(bigint, boolean) TO authenticated;
