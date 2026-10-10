-- Preserve legacy tabular signature with catalog zero counts.
BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(p_don_vi bigint DEFAULT NULL::bigint, p_khoa_phong text DEFAULT NULL::text, p_vi_tri text DEFAULT NULL::text)
 RETURNS TABLE(tinh_trang text, so_luong bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      RETURN;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT tb.id, NULLIF(TRIM(tb.tinh_trang_hien_tai), '') AS status_value
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
  ), counts AS (
    SELECT f.status_value, COUNT(*)::bigint AS total FROM filtered f GROUP BY f.status_value
  )
  SELECT c.status_value, COALESCE(counts.total, 0)::bigint
  FROM public.equipment_status_catalog c
  LEFT JOIN counts ON counts.status_value = c.status_value
  WHERE c.is_active OR COALESCE(counts.total, 0) > 0
  UNION ALL
  SELECT 'khac'::text, COUNT(*)::bigint
  FROM filtered f
  WHERE NOT EXISTS (SELECT 1 FROM public.equipment_status_catalog c WHERE c.status_value = f.status_value)
  HAVING COUNT(*) > 0;
END;
$function$;
COMMIT;
