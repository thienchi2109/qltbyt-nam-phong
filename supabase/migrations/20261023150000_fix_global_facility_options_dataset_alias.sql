-- Repair the global dataset branch without changing RPC scope, signature, or ACL.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_facilities_with_equipment_count(p_equipment_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  IF lower(btrim(coalesce(p_equipment_dataset, ''))) NOT IN ('all', 'regular', 'placed') THEN RAISE EXCEPTION 'Invalid equipment dataset: %', p_equipment_dataset USING ERRCODE = '22023'; END IF;
    BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dv.id,
        'name', dv.name,
        'code', dv.code,
        'equipment_count', COALESCE(tb_count.cnt, 0)
      )
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    LEFT JOIN (
      SELECT don_vi, COUNT(*) as cnt
      FROM public.thiet_bi tb
      WHERE is_deleted = false AND (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'all' OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'placed' AND btrim(coalesce(tb.nguon_kinh_phi, '')) = 'Mượn') OR (lower(btrim(coalesce(p_equipment_dataset, ''))) = 'regular' AND btrim(coalesce(tb.nguon_kinh_phi, '')) <> 'Mượn'))
      GROUP BY don_vi
    ) tb_count ON tb_count.don_vi = dv.id;

    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;

  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'name', dv.name,
      'code', dv.code,
      'equipment_count', COALESCE(tb_count.cnt, 0)
    )
    ORDER BY dv.name
  )
  INTO v_result
  FROM public.don_vi dv
  LEFT JOIN (
    SELECT don_vi, COUNT(*) as cnt
    FROM public.thiet_bi
    WHERE don_vi = ANY(v_allowed_don_vi)
      AND is_deleted = false
    GROUP BY don_vi
  ) tb_count ON tb_count.don_vi = dv.id
  WHERE dv.id = ANY(v_allowed_don_vi);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

COMMIT;
