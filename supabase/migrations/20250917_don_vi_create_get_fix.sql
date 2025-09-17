-- Align don_vi_create and don_vi_get with role fallback and qualified refs

-- don_vi_get: role fallback (admin->global)
CREATE OR REPLACE FUNCTION public.don_vi_get(
  p_id bigint
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
DECLARE v_role text;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  RETURN QUERY
  SELECT d.id, d.code, d.name, d.active, d.membership_quota, d.logo_url, COALESCE(m.used_count,0) AS used_count
  FROM public.don_vi d
  LEFT JOIN (
    SELECT don_vi, COUNT(*)::int AS used_count
    FROM public.user_don_vi_memberships
    GROUP BY don_vi
  ) m ON m.don_vi = d.id
  WHERE d.id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_get(bigint) TO authenticated;

-- don_vi_create: role fallback, uniqueness check, qualified return via get
CREATE OR REPLACE FUNCTION public.don_vi_create(
  p_code text,
  p_name text,
  p_active boolean DEFAULT true,
  p_membership_quota integer DEFAULT NULL,
  p_logo_url text DEFAULT NULL
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
DECLARE v_role text; v_new_id bigint;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  IF p_code IS NOT NULL AND EXISTS(SELECT 1 FROM public.don_vi dv WHERE dv.code = p_code) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  INSERT INTO public.don_vi(code, name, active, membership_quota, logo_url)
  VALUES (p_code, btrim(p_name), coalesce(p_active,true), p_membership_quota, p_logo_url)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(v_new_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_create(text, text, boolean, integer, text) TO authenticated;
