-- Replace the unsafe unlink overload with an expected-category contract.
DO $$
BEGIN
  IF to_regprocedure(
    'public.dinh_muc_thiet_bi_unlink(bigint[],bigint)'
  ) IS NOT NULL THEN
    EXECUTE
      'REVOKE ALL ON FUNCTION public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT);

CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unlink(
  p_thiet_bi_ids BIGINT[],
  p_nhom_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '');
  v_affected_count INT := 0;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions for category unlink'
      USING errcode = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'to_qltb' THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required' USING errcode = '42501';
  END IF;

  IF p_thiet_bi_ids IS NULL OR array_length(p_thiet_bi_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'p_thiet_bi_ids cannot be empty'
      USING errcode = '22023';
  END IF;

  IF p_nhom_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.nhom_thiet_bi AS category
    WHERE category.id = p_nhom_id
      AND category.don_vi_id = p_don_vi
  ) THEN
    RAISE EXCEPTION 'Category is outside the tenant scope'
      USING errcode = '42501';
  END IF;

  WITH affected_equipment AS (
    UPDATE public.thiet_bi
    SET nhom_thiet_bi_id = NULL
    WHERE id = ANY(p_thiet_bi_ids)
      AND don_vi = p_don_vi
      AND nhom_thiet_bi_id = p_nhom_id
    RETURNING id
  ),
  inserted_audit AS (
    INSERT INTO public.thiet_bi_nhom_audit_log (
      don_vi_id,
      thiet_bi_ids,
      nhom_thiet_bi_id,
      action,
      performed_by,
      performed_at,
      metadata
    )
    SELECT
      p_don_vi,
      ARRAY_AGG(id),
      p_nhom_id,
      'unlink',
      v_user_id::BIGINT,
      NOW(),
      jsonb_build_object('previous_nhom_id', p_nhom_id)
    FROM affected_equipment
    HAVING COUNT(*) > 0
    RETURNING id
  )
  SELECT COUNT(*)::INT
  INTO v_affected_count
  FROM affected_equipment;

  RETURN v_affected_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dinh_muc_thiet_bi_unlink(
  BIGINT[],
  BIGINT,
  BIGINT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unlink(
  BIGINT[],
  BIGINT,
  BIGINT
) TO authenticated;
