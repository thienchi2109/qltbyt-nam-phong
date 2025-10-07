-- Harden don_vi_update: role fallback, qualify columns to avoid OUT param ambiguity, stricter code uniqueness
CREATE OR REPLACE FUNCTION public.don_vi_update(
  p_id bigint,
  p_code text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_active boolean DEFAULT NULL,
  p_membership_quota integer DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_set_membership_quota boolean DEFAULT false,
  p_set_logo_url boolean DEFAULT false
)
RETURNS TABLE (
  id bigint,
  code text,
  name text,
  active boolean,
  membership_quota integer,
  logo_url text,
  used_count integer
) LANGUAGE plpgsql AS $$
DECLARE 
  v_role text; 
  v_existing public.don_vi%ROWTYPE;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  SELECT d.* INTO v_existing FROM public.don_vi d WHERE d.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn vị không tồn tại' USING HINT = 'not_found';
  END IF;

  IF p_code IS NOT NULL AND p_code <> v_existing.code AND EXISTS(SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code AND dv.id <> p_id) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  UPDATE public.don_vi AS dv SET
    code = COALESCE(p_code, dv.code),
    name = COALESCE(NULLIF(btrim(p_name),''), dv.name),
    active = COALESCE(p_active, dv.active),
    membership_quota = CASE WHEN p_set_membership_quota THEN p_membership_quota ELSE dv.membership_quota END,
    logo_url = CASE WHEN p_set_logo_url THEN p_logo_url ELSE dv.logo_url END
  WHERE dv.id = p_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_update(bigint, text, text, boolean, integer, text, boolean, boolean) TO authenticated;
