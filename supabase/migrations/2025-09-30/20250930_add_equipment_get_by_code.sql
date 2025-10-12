-- Add equipment_get_by_code RPC for exact QR lookups with tenant enforcement
BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_get_by_code(
  p_ma_thiet_bi TEXT
) RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF p_ma_thiet_bi IS NULL OR trim(p_ma_thiet_bi) = '' THEN
    RAISE EXCEPTION 'ma_thiet_bi_required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'global' THEN
    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
    LIMIT 1;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
      AND don_vi = ANY(v_allowed)
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_get_by_code(TEXT) TO authenticated;

COMMIT;
