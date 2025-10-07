-- Define membership count = number of users with current_don_vi = tenant id (single source of truth)
-- Perf index already added earlier; keep for safety
CREATE INDEX IF NOT EXISTS idx_nhan_vien_current_don_vi ON public.nhan_vien (current_don_vi);

-- don_vi_list with current-only counting
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
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  IF v_role = 'admin' THEN v_role := 'global'; END IF;
  IF v_role <> 'global' THEN
    RETURN; -- empty set for non-global
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
    'WITH membership_counts AS (
       SELECT current_don_vi AS don_vi, COUNT(*)::int AS used_count
       FROM public.nhan_vien
       WHERE current_don_vi IS NOT NULL
       GROUP BY current_don_vi
     )
     SELECT d.id, d.code, d.name, d.active, d.membership_quota, d.logo_url, COALESCE(mc.used_count,0) AS used_count
     FROM public.don_vi d
     LEFT JOIN membership_counts mc ON mc.don_vi = d.id
     WHERE ($1 IS NULL OR $1 = '''' OR d.name ILIKE ''%''||$1||''%'' OR d.code ILIKE ''%''||$1||''%'')
     ' || format(' ORDER BY %I ', v_order_by) || 'LIMIT $2 OFFSET $3';

  RETURN QUERY EXECUTE v_sql USING p_q, p_page_size, v_offset;
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_list(text, text, integer, integer) TO authenticated;

-- don_vi_get with current-only counting
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
  WITH membership_counts AS (
    SELECT current_don_vi AS don_vi, COUNT(*)::int AS used_count
    FROM public.nhan_vien
    WHERE current_don_vi IS NOT NULL
    GROUP BY current_don_vi
  )
  SELECT d.id, d.code, d.name, d.active, d.membership_quota, d.logo_url, COALESCE(mc.used_count,0) AS used_count
  FROM public.don_vi d
  LEFT JOIN membership_counts mc ON mc.don_vi = d.id
  WHERE d.id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.don_vi_get(bigint) TO authenticated;
