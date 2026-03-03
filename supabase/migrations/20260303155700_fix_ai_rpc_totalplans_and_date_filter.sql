-- Fix two correctness issues in AI assistant RPCs:
--
-- 1. ai_maintenance_plan_lookup: totalPlans used COUNT(*) which counts
--    task rows, not distinct plans. Fixed to COUNT(DISTINCT plan_id).
--
-- 2. ai_maintenance_summary: date range filter included plans with NULL
--    ngay_phe_duyet (unapproved drafts) even when an explicit date range
--    was specified. Fixed to exclude NULL-dated plans when a date bound
--    is active.

BEGIN;

-- Fix 1: ai_maintenance_plan_lookup totalPlans overcount
CREATE OR REPLACE FUNCTION public.ai_maintenance_plan_lookup(
  thiet_bi_id BIGINT,
  p_nam INTEGER DEFAULT NULL,
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
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF thiet_bi_id IS NULL OR thiet_bi_id <= 0 THEN
    RAISE EXCEPTION 'thiet_bi_id is required' USING ERRCODE = '22023';
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

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'equipment', NULL,
        'plans', '[]'::JSONB,
        'totalPlans', 0,
        'yearFilter', p_nam
      );
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

  RETURN (
    WITH rows AS (
      SELECT
        kh.id AS plan_id,
        kh.ten_ke_hoach,
        kh.nam,
        kh.loai_cong_viec,
        kh.trang_thai AS plan_trang_thai,
        kh.ngay_phe_duyet,
        cv.id AS task_id,
        cv.don_vi_thuc_hien,
        cv.diem_hieu_chuan,
        cv.thang_1, cv.thang_2, cv.thang_3,
        cv.thang_4, cv.thang_5, cv.thang_6,
        cv.thang_7, cv.thang_8, cv.thang_9,
        cv.thang_10, cv.thang_11, cv.thang_12,
        cv.thang_1_hoan_thanh, cv.thang_2_hoan_thanh, cv.thang_3_hoan_thanh,
        cv.thang_4_hoan_thanh, cv.thang_5_hoan_thanh, cv.thang_6_hoan_thanh,
        cv.thang_7_hoan_thanh, cv.thang_8_hoan_thanh, cv.thang_9_hoan_thanh,
        cv.thang_10_hoan_thanh, cv.thang_11_hoan_thanh, cv.thang_12_hoan_thanh,
        cv.ghi_chu,
        tb.id AS equipment_id,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model,
        tb.don_vi
      FROM public.cong_viec_bao_tri cv
      JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
      JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE cv.thiet_bi_id = ai_maintenance_plan_lookup.thiet_bi_id
        AND (ai_maintenance_plan_lookup.p_nam IS NULL OR kh.nam = ai_maintenance_plan_lookup.p_nam)
        AND tb.is_deleted = FALSE
        AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    )
    SELECT jsonb_build_object(
      'equipment',
      (
        SELECT jsonb_build_object(
          'id', equipment_id,
          'ma_thiet_bi', ma_thiet_bi,
          'ten_thiet_bi', ten_thiet_bi,
          'model', model,
          'don_vi', don_vi
        )
        FROM rows
        LIMIT 1
      ),
      'plans',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'plan_id', plan_id,
              'ten_ke_hoach', ten_ke_hoach,
              'nam', nam,
              'loai_cong_viec', loai_cong_viec,
              'plan_trang_thai', plan_trang_thai,
              'ngay_phe_duyet', ngay_phe_duyet,
              'task_id', task_id,
              'don_vi_thuc_hien', don_vi_thuc_hien,
              'diem_hieu_chuan', diem_hieu_chuan,
              'thang_1', thang_1, 'thang_2', thang_2, 'thang_3', thang_3,
              'thang_4', thang_4, 'thang_5', thang_5, 'thang_6', thang_6,
              'thang_7', thang_7, 'thang_8', thang_8, 'thang_9', thang_9,
              'thang_10', thang_10, 'thang_11', thang_11, 'thang_12', thang_12,
              'thang_1_hoan_thanh', thang_1_hoan_thanh, 'thang_2_hoan_thanh', thang_2_hoan_thanh, 'thang_3_hoan_thanh', thang_3_hoan_thanh,
              'thang_4_hoan_thanh', thang_4_hoan_thanh, 'thang_5_hoan_thanh', thang_5_hoan_thanh, 'thang_6_hoan_thanh', thang_6_hoan_thanh,
              'thang_7_hoan_thanh', thang_7_hoan_thanh, 'thang_8_hoan_thanh', thang_8_hoan_thanh, 'thang_9_hoan_thanh', thang_9_hoan_thanh,
              'thang_10_hoan_thanh', thang_10_hoan_thanh, 'thang_11_hoan_thanh', thang_11_hoan_thanh, 'thang_12_hoan_thanh', thang_12_hoan_thanh,
              'ghi_chu', ghi_chu
            )
            ORDER BY nam DESC, loai_cong_viec, plan_id, task_id
          )
          FROM rows
        ),
        '[]'::JSONB
      ),
      'totalPlans', COALESCE((SELECT COUNT(DISTINCT plan_id)::BIGINT FROM rows), 0),
      'yearFilter', p_nam
    )
  );
END;
$function$;

-- Fix 2: ai_maintenance_summary date range NULL bypass
CREATE OR REPLACE FUNCTION public.ai_maintenance_summary(
  "fromDate" TEXT DEFAULT NULL,
  "toDate" TEXT DEFAULT NULL,
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
  v_from_date DATE := NULL;
  v_to_date DATE := NULL;
BEGIN
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

  IF NULLIF(BTRIM("fromDate"), '') IS NOT NULL THEN
    v_from_date := NULLIF(BTRIM("fromDate"), '')::DATE;
  END IF;
  IF NULLIF(BTRIM("toDate"), '') IS NOT NULL THEN
    v_to_date := NULLIF(BTRIM("toDate"), '')::DATE;
  END IF;
  IF v_from_date IS NOT NULL AND v_to_date IS NOT NULL AND v_from_date > v_to_date THEN
    RAISE EXCEPTION 'fromDate must be before or equal to toDate' USING ERRCODE = '22007';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'totalTasks', 0,
        'totalPlans', 0,
        'statusCounts', '{}'::JSONB,
        'taskTypeCounts', '{}'::JSONB,
        'recentTasks', '[]'::JSONB,
        'fromDate', v_from_date,
        'toDate', v_to_date
      );
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

  RETURN (
    WITH filtered AS (
      SELECT
        cv.id AS task_id,
        cv.loai_cong_viec,
        cv.don_vi_thuc_hien,
        cv.updated_at AS task_updated_at,
        kh.id AS plan_id,
        kh.ten_ke_hoach,
        kh.nam,
        kh.trang_thai AS plan_status,
        kh.ngay_phe_duyet,
        tb.id AS equipment_id,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model
      FROM public.cong_viec_bao_tri cv
      JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE (v_effective IS NULL OR COALESCE(tb.don_vi, kh.don_vi) = ANY(v_effective))
        AND (
          v_from_date IS NULL
          OR (kh.ngay_phe_duyet IS NOT NULL AND kh.ngay_phe_duyet::DATE >= v_from_date)
        )
        AND (
          v_to_date IS NULL
          OR (kh.ngay_phe_duyet IS NOT NULL AND kh.ngay_phe_duyet::DATE <= v_to_date)
        )
    ),
    status_counts AS (
      SELECT
        COALESCE(NULLIF(BTRIM(plan_status), ''), 'Khong xac dinh') AS k,
        COUNT(DISTINCT plan_id)::BIGINT AS c
      FROM filtered
      GROUP BY 1
    ),
    task_type_counts AS (
      SELECT
        COALESCE(NULLIF(BTRIM(loai_cong_viec), ''), 'khac') AS k,
        COUNT(*)::BIGINT AS c
      FROM filtered
      GROUP BY 1
    ),
    recent AS (
      SELECT *
      FROM filtered
      ORDER BY COALESCE(task_updated_at, ngay_phe_duyet) DESC NULLS LAST, task_id DESC
      LIMIT 20
    )
    SELECT jsonb_build_object(
      'totalTasks', COALESCE((SELECT COUNT(*)::BIGINT FROM filtered), 0),
      'totalPlans', COALESCE((SELECT COUNT(DISTINCT plan_id)::BIGINT FROM filtered), 0),
      'statusCounts', COALESCE((SELECT jsonb_object_agg(k, c) FROM status_counts), '{}'::JSONB),
      'taskTypeCounts', COALESCE((SELECT jsonb_object_agg(k, c) FROM task_type_counts), '{}'::JSONB),
      'recentTasks',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'task_id', task_id,
              'loai_cong_viec', loai_cong_viec,
              'don_vi_thuc_hien', don_vi_thuc_hien,
              'plan_id', plan_id,
              'ten_ke_hoach', ten_ke_hoach,
              'nam', nam,
              'plan_status', plan_status,
              'ngay_phe_duyet', ngay_phe_duyet,
              'equipment_id', equipment_id,
              'ma_thiet_bi', ma_thiet_bi,
              'ten_thiet_bi', ten_thiet_bi,
              'model', model
            )
            ORDER BY COALESCE(task_updated_at, ngay_phe_duyet) DESC NULLS LAST, task_id DESC
          )
          FROM recent
        ),
        '[]'::JSONB
      ),
      'fromDate', v_from_date,
      'toDate', v_to_date
    )
  );
END;
$function$;

COMMIT;
