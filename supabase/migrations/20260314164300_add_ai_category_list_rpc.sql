-- ai_category_list: return all equipment categories for a given facility.
-- Used by the AI category-suggestion tool so the model can reason
-- about semantic similarity between a device name and available categories.
--
-- Security: SECURITY DEFINER + pinned search_path, JWT claim guards,
-- tenant isolation.  Read-only (STABLE).

BEGIN;

CREATE OR REPLACE FUNCTION public.ai_category_list(
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id TEXT := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_allowed BIGINT[] := NULL;
  v_effective BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
BEGIN
  -- JWT claim guards
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND NULLIF(BTRIM(p_user_id), '') IS NOT NULL
     AND BTRIM(p_user_id) IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation (same pattern as ai_equipment_lookup)
  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object('data', '[]'::JSONB, 'total', 0);
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_don_vi];
  END IF;

  -- Return categories with parent name for hierarchical context
  RETURN (
    WITH cats AS (
      SELECT
        n.id,
        n.ma_nhom,
        n.ten_nhom,
        n.phan_loai,
        n.mo_ta,
        n.tu_khoa,
        p.ten_nhom AS parent_name,
        COUNT(*) OVER () AS total_count
      FROM public.nhom_thiet_bi n
      LEFT JOIN public.nhom_thiet_bi p ON p.id = n.parent_id
      WHERE (v_effective IS NULL OR n.don_vi_id = ANY(v_effective))
      ORDER BY n.thu_tu_hien_thi ASC NULLS LAST, n.ten_nhom ASC
    )
    SELECT jsonb_build_object(
      'data',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'ma_nhom', ma_nhom,
            'ten_nhom', ten_nhom,
            'phan_loai', phan_loai,
            'mo_ta', mo_ta,
            'tu_khoa', tu_khoa,
            'parent_name', parent_name
          )
        ),
        '[]'::JSONB
      ),
      'total', COALESCE(MAX(total_count), 0)
    )
    FROM cats
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_category_list(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_category_list(BIGINT, TEXT) FROM PUBLIC;

COMMIT;
