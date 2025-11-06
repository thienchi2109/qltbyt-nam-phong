BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_departments_list()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role text := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_allowed bigint[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT DISTINCT trim(both from tb.khoa_phong_quan_ly)
    FROM public.thiet_bi tb
    WHERE tb.khoa_phong_quan_ly IS NOT NULL
      AND length(trim(tb.khoa_phong_quan_ly)) > 0
    ORDER BY 1;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();

    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT trim(both from tb.khoa_phong_quan_ly)
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_allowed)
      AND tb.khoa_phong_quan_ly IS NOT NULL
      AND length(trim(tb.khoa_phong_quan_ly)) > 0
    ORDER BY 1;
  END IF;
END;
$function$;

COMMIT;
