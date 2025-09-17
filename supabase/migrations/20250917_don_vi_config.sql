-- 20250917_don_vi_config.sql
-- Idempotent migration to extend don_vi and add global-only RPCs for tenant configuration

-- 0) Ensure helper to read JWT claims exists
CREATE OR REPLACE FUNCTION public._get_jwt_claim(name text)
RETURNS text
LANGUAGE sql STABLE AS $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>name,
    null
  )
$$;

-- 1) Extend schema (safe, idempotent)
ALTER TABLE public.don_vi
  ADD COLUMN IF NOT EXISTS membership_quota integer,
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 2) Helper: compute used_count via memberships (assumes user_don_vi_memberships exists)
-- No view created to keep it simple; inline aggregation in RPCs

-- 3) RPCs (global-only). We rely on helper _get_jwt_claim(text) present in the database.

-- 3.1) List tenants with search/sort/pagination and used_count
CREATE OR REPLACE FUNCTION public.don_vi_list(
  p_q text DEFAULT NULL,
  p_sort text DEFAULT 'name',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
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
  v_offset integer;
  v_order_by text;
  v_sql text;
BEGIN
  v_role := lower(coalesce(_get_jwt_claim('app_role')::text, ''));
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  v_offset := GREATEST((coalesce(p_page,1) - 1) * coalesce(p_page_size,20), 0);
  v_order_by := CASE lower(coalesce(p_sort,'name'))
    WHEN 'name' THEN 'name'
    WHEN 'code' THEN 'code'
    WHEN 'created_at' THEN 'created_at'
    WHEN 'active' THEN 'active'
    ELSE 'name'
  END;

  v_sql :=
    'SELECT d.id, d.code, d.name, d.active, d.membership_quota, d.logo_url, COALESCE(m.used_count,0) AS used_count\n'
    ||'FROM public.don_vi d\n'
    ||'LEFT JOIN (SELECT don_vi, COUNT(*)::int AS used_count FROM public.user_don_vi_memberships GROUP BY don_vi) m ON m.don_vi = d.id\n'
    ||'WHERE ($1 IS NULL OR $1 = '''' OR d.name ILIKE ''%''||$1||''%'' OR d.code ILIKE ''%''||$1||''%'')\n'
    ||format(' ORDER BY %I ', v_order_by)
    ||'LIMIT $2 OFFSET $3';

  RETURN QUERY EXECUTE v_sql USING p_q, p_page_size, v_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_list(text, text, integer, integer) TO authenticated;

-- 3.2) Get single tenant with used_count
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
  v_role := lower(coalesce(_get_jwt_claim('app_role')::text, ''));
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

-- 3.3) Create tenant
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
  v_role := lower(coalesce(_get_jwt_claim('app_role')::text, ''));
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên đơn vị không được trống' USING HINT = 'validation_error';
  END IF;
  IF p_code IS NOT NULL AND EXISTS(SELECT 1 FROM public.don_vi WHERE code = p_code) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  INSERT INTO public.don_vi(code, name, active, membership_quota, logo_url)
  VALUES (p_code, btrim(p_name), coalesce(p_active,true), p_membership_quota, p_logo_url)
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(v_new_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_create(text, text, boolean, integer, text) TO authenticated;

-- 3.4) Update tenant (supports explicit NULL for quota/logo via flags)
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
DECLARE v_role text; v_existing record;
BEGIN
  v_role := lower(coalesce(_get_jwt_claim('app_role')::text, ''));
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  SELECT * INTO v_existing FROM public.don_vi WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Đơn vị không tồn tại' USING HINT = 'not_found';
  END IF;

  IF p_code IS NOT NULL AND p_code <> v_existing.code AND EXISTS(SELECT 1 FROM public.don_vi WHERE code = p_code) THEN
    RAISE EXCEPTION 'Mã đơn vị đã tồn tại' USING HINT = 'code_unique';
  END IF;

  UPDATE public.don_vi d SET
    code = COALESCE(p_code, d.code),
    name = COALESCE(NULLIF(btrim(p_name),''), d.name),
    active = COALESCE(p_active, d.active),
    membership_quota = CASE WHEN p_set_membership_quota THEN p_membership_quota ELSE d.membership_quota END,
    logo_url = CASE WHEN p_set_logo_url THEN p_logo_url ELSE d.logo_url END
  WHERE d.id = p_id;

  RETURN QUERY SELECT * FROM public.don_vi_get(p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_update(bigint, text, text, boolean, integer, text, boolean, boolean) TO authenticated;

-- 3.5) Toggle active
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
  v_role := lower(coalesce(_get_jwt_claim('app_role')::text, ''));
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  UPDATE public.don_vi SET active = COALESCE(p_active, active) WHERE id = p_id;
  RETURN QUERY SELECT * FROM public.don_vi_get(p_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_set_active(bigint, boolean) TO authenticated;
