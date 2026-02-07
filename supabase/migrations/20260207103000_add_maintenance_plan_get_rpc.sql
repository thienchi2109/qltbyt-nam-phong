BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_plan_get(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  IF p_id IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_role := lower(COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  ));

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  SELECT jsonb_build_object(
    'id', kh.id,
    'ten_ke_hoach', kh.ten_ke_hoach,
    'nam', kh.nam,
    'loai_cong_viec', kh.loai_cong_viec,
    'khoa_phong', kh.khoa_phong,
    'nguoi_lap_ke_hoach', kh.nguoi_lap_ke_hoach,
    'trang_thai', kh.trang_thai,
    'ngay_phe_duyet', kh.ngay_phe_duyet,
    'nguoi_duyet', kh.nguoi_duyet,
    'ly_do_khong_duyet', kh.ly_do_khong_duyet,
    'created_at', kh.created_at,
    'don_vi', kh.don_vi,
    'facility_name', dv.name
  )
  INTO v_result
  FROM public.ke_hoach_bao_tri kh
  LEFT JOIN public.don_vi dv ON dv.id = kh.don_vi
  WHERE kh.id = p_id
    AND (
      v_role = 'global'
      OR (
        v_allowed_don_vi IS NOT NULL
        AND array_length(v_allowed_don_vi, 1) IS NOT NULL
        AND kh.don_vi = ANY(v_allowed_don_vi)
      )
    )
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_get(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.maintenance_plan_get IS
'Fetches a single maintenance plan by id with tenant/region access filtering.

Returns the plan payload with facility_name, or NULL if not found or not accessible.';

COMMIT;
