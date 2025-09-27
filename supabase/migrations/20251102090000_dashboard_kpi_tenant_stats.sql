-- Dashboard KPI statistics with tenant scoping
BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_repair_request_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := ARRAY[]::BIGINT[];
  v_result JSONB;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total', 0,
        'pending', 0,
        'approved', 0,
        'completed', 0
      );
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE r.trang_thai = 'Chờ xử lý'),
    'approved', COUNT(*) FILTER (WHERE r.trang_thai = 'Đã duyệt'),
    'completed', COUNT(*) FILTER (WHERE r.trang_thai IN ('Hoàn thành', 'Không HT'))
  )
  INTO v_result
  FROM public.yeu_cau_sua_chua r
  JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE (
    v_role = 'global'
    OR (v_role <> 'global' AND tb.don_vi = ANY(v_allowed))
  );

  RETURN COALESCE(v_result, jsonb_build_object(
    'total', 0,
    'pending', 0,
    'approved', 0,
    'completed', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_repair_request_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_snapshot(p_limit INT DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := ARRAY[]::BIGINT[];
  v_limit INT := GREATEST(COALESCE(p_limit, 10), 1);
  v_result JSONB;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total', 0,
        'draft', 0,
        'approved', 0,
        'plans', jsonb_build_array()
      );
    END IF;
  END IF;

  WITH accessible_plans AS (
    SELECT
      kh.id,
      kh.ten_ke_hoach,
      kh.nam,
      kh.khoa_phong,
      kh.loai_cong_viec,
      kh.trang_thai,
      kh.created_at
    FROM public.ke_hoach_bao_tri kh
    WHERE (
      v_role = 'global'
      OR NOT EXISTS (
        SELECT 1
        FROM public.cong_viec_bao_tri cv
        JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
        WHERE cv.ke_hoach_id = kh.id
          AND v_role <> 'global'
          AND tb.don_vi IS NOT NULL
          AND NOT (tb.don_vi = ANY(v_allowed))
      )
    )
  ),
  ordered_plans AS (
    SELECT *
    FROM accessible_plans
    ORDER BY created_at DESC
    LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM accessible_plans),
    'draft', (SELECT COUNT(*) FROM accessible_plans WHERE trang_thai = 'Bản nháp'),
    'approved', (SELECT COUNT(*) FROM accessible_plans WHERE trang_thai = 'Đã duyệt'),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'ten_ke_hoach', p.ten_ke_hoach,
        'nam', p.nam,
        'khoa_phong', p.khoa_phong,
        'loai_cong_viec', p.loai_cong_viec,
        'trang_thai', p.trang_thai,
        'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM ordered_plans p
    ), jsonb_build_array())
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total', 0,
    'draft', 0,
    'approved', 0,
    'plans', jsonb_build_array()
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_maintenance_plan_snapshot(INT) TO authenticated;

COMMIT;
