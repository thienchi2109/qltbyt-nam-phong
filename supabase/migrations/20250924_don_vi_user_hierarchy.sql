-- 20250924_don_vi_user_hierarchy.sql
-- Introduce RPC to expose tenant-user hierarchy for admin UI (global only)

CREATE OR REPLACE FUNCTION public.don_vi_user_hierarchy(
  p_q text DEFAULT NULL,
  p_only_active boolean DEFAULT false
)
RETURNS TABLE (
  tenant_id bigint,
  tenant_code text,
  tenant_name text,
  tenant_active boolean,
  membership_quota integer,
  logo_url text,
  used_count integer,
  users jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_query text := NULLIF(btrim(coalesce(p_q, '')), '');
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), ''));
  IF v_role <> 'global' THEN
    RAISE EXCEPTION 'Forbidden' USING HINT = 'global_only';
  END IF;

  RETURN QUERY
  SELECT
    d.id AS tenant_id,
    d.code AS tenant_code,
    d.name AS tenant_name,
    d.active AS tenant_active,
    d.membership_quota,
    d.logo_url,
    COALESCE(u.used_count, 0) AS used_count,
    COALESCE(user_list.users, '[]'::jsonb) AS users
  FROM public.don_vi d
  LEFT JOIN (
    SELECT current_don_vi AS don_vi, COUNT(*)::int AS used_count
    FROM public.nhan_vien
    WHERE current_don_vi IS NOT NULL
    GROUP BY current_don_vi
  ) u ON u.don_vi = d.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', nv.id,
        'username', nv.username,
        'full_name', nv.full_name,
        'role', lower(nv.role),
        'khoa_phong', nv.khoa_phong,
        'current_don_vi', nv.current_don_vi,
        'created_at', nv.created_at
      ) ORDER BY lower(nv.role), nv.full_name
    ) AS users
    FROM public.nhan_vien nv
    WHERE nv.current_don_vi = d.id
  ) user_list ON TRUE
  WHERE
    (NOT p_only_active OR COALESCE(d.active, TRUE) = TRUE)
    AND (
      v_query IS NULL
      OR d.name ILIKE '%' || v_query || '%'
      OR d.code ILIKE '%' || v_query || '%'
      OR EXISTS (
        SELECT 1
        FROM public.nhan_vien nv2
        WHERE nv2.current_don_vi = d.id
          AND (
            nv2.full_name ILIKE '%' || v_query || '%'
            OR nv2.username ILIKE '%' || v_query || '%'
          )
      )
    )
  ORDER BY d.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.don_vi_user_hierarchy(text, boolean) TO authenticated;
