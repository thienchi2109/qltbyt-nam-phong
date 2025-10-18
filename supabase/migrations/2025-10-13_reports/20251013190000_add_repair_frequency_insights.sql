-- Enhance maintenance report RPC with repair frequency and top equipment insights
-- Adds equipment-level aggregation and recent repair history while preserving tenant isolation
-- Migration Date: 2025-10-13 19:00 UTC

BEGIN;

CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(
  p_date_from DATE,
  p_date_to DATE,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_result JSONB;
BEGIN
  -- 1. Resolve role and allowed facilities from JWT
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  -- 2. Determine effective facilities based on role and optional parameter
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL; -- Access to all facilities
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'summary', jsonb_build_object(
          'totalRepairs', 0,
          'repairCompletionRate', 0,
          'totalMaintenancePlanned', 0,
          'maintenanceCompletionRate', 0
        ),
        'charts', jsonb_build_object(
          'repairStatusDistribution', '[]'::jsonb,
          'maintenancePlanVsActual', '[]'::jsonb,
          'repairFrequencyByMonth', '[]'::jsonb
        ),
        'topEquipmentRepairs', '[]'::jsonb,
        'recentRepairHistory', '[]'::jsonb
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  -- 3. Aggregate repair and maintenance data with tenant scoping
  WITH repair_data_raw AS (
    SELECT 
      yc.id,
      yc.trang_thai,
      yc.mo_ta_su_co,
      yc.ngay_yeu_cau,
      yc.ngay_duyet,
      yc.ngay_hoan_thanh,
      tb.id AS equipment_id,
      COALESCE(NULLIF(trim(tb.ten_thiet_bi), ''), tb.ma_thiet_bi, 'Không xác định') AS equipment_name,
      tb.don_vi,
      COALESCE(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh, clock_timestamp()) AS reference_timestamp
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  ),
  repair_data AS (
    SELECT *
    FROM repair_data_raw
    WHERE reference_timestamp::date BETWEEN p_date_from AND p_date_to
  ),
  repair_summary AS (
    SELECT 
      COUNT(*) AS total_repairs,
      COUNT(*) FILTER (WHERE lower(COALESCE(trang_thai, '')) LIKE '%hoàn thành%' OR lower(COALESCE(trang_thai, '')) LIKE '%hoan thanh%') AS completed,
      COUNT(*) FILTER (WHERE lower(COALESCE(trang_thai, '')) LIKE '%không ht%') AS not_completed,
      COUNT(*) FILTER (WHERE lower(COALESCE(trang_thai, '')) LIKE '%đã duyệt%' OR lower(COALESCE(trang_thai, '')) LIKE '%da duyet%') AS approved,
      COUNT(*) FILTER (WHERE lower(COALESCE(trang_thai, '')) LIKE '%chờ%' OR lower(COALESCE(trang_thai, '')) LIKE '%cho%') AS pending
    FROM repair_data
  ),
  maintenance_data AS (
    SELECT 
      kh.id AS plan_id,
      kh.nam,
      kh.trang_thai,
      kh.don_vi,
      cv.id AS task_id,
      cv.loai_cong_viec,
      cv.thang_1, cv.thang_1_hoan_thanh,
      cv.thang_2, cv.thang_2_hoan_thanh,
      cv.thang_3, cv.thang_3_hoan_thanh,
      cv.thang_4, cv.thang_4_hoan_thanh,
      cv.thang_5, cv.thang_5_hoan_thanh,
      cv.thang_6, cv.thang_6_hoan_thanh,
      cv.thang_7, cv.thang_7_hoan_thanh,
      cv.thang_8, cv.thang_8_hoan_thanh,
      cv.thang_9, cv.thang_9_hoan_thanh,
      cv.thang_10, cv.thang_10_hoan_thanh,
      cv.thang_11, cv.thang_11_hoan_thanh,
      cv.thang_12, cv.thang_12_hoan_thanh
    FROM public.ke_hoach_bao_tri kh
    LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
    WHERE (v_effective IS NULL OR kh.don_vi = ANY(v_effective))
      AND kh.nam = EXTRACT(YEAR FROM p_date_from)
      AND kh.trang_thai = 'Đã duyệt'
  ),
  maintenance_summary AS (
    SELECT 
      loai_cong_viec,
      (CASE WHEN thang_1 THEN 1 ELSE 0 END +
       CASE WHEN thang_2 THEN 1 ELSE 0 END +
       CASE WHEN thang_3 THEN 1 ELSE 0 END +
       CASE WHEN thang_4 THEN 1 ELSE 0 END +
       CASE WHEN thang_5 THEN 1 ELSE 0 END +
       CASE WHEN thang_6 THEN 1 ELSE 0 END +
       CASE WHEN thang_7 THEN 1 ELSE 0 END +
       CASE WHEN thang_8 THEN 1 ELSE 0 END +
       CASE WHEN thang_9 THEN 1 ELSE 0 END +
       CASE WHEN thang_10 THEN 1 ELSE 0 END +
       CASE WHEN thang_11 THEN 1 ELSE 0 END +
       CASE WHEN thang_12 THEN 1 ELSE 0 END) AS planned,
      (CASE WHEN thang_1_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_2_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_3_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_4_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_5_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_6_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_7_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_8_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_9_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_10_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_11_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_12_hoan_thanh THEN 1 ELSE 0 END) AS actual
    FROM maintenance_data
    WHERE loai_cong_viec IN ('Bảo trì', 'Hiệu chuẩn', 'Kiểm định')
  ),
  maintenance_aggregated AS (
    SELECT 
      loai_cong_viec,
      SUM(planned) AS total_planned,
      SUM(actual) AS total_actual
    FROM maintenance_summary
    GROUP BY loai_cong_viec
  ),
  repair_frequency AS (
    SELECT 
      to_char(date_trunc('month', reference_timestamp), 'YYYY-MM') AS period,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (
        WHERE lower(COALESCE(trang_thai, '')) LIKE '%hoàn thành%'
           OR lower(COALESCE(trang_thai, '')) LIKE '%hoan thanh%'
      )::INT AS completed
    FROM repair_data
    GROUP BY date_trunc('month', reference_timestamp)
  ),
  equipment_repairs AS (
    SELECT 
      equipment_id,
      equipment_name,
      COUNT(*)::INT AS total_requests,
      MAX(reference_timestamp) AS latest_event_at,
      MAX(ngay_hoan_thanh) AS latest_completed_at
    FROM repair_data
    GROUP BY equipment_id, equipment_name
  ),
  equipment_latest_status AS (
    SELECT DISTINCT ON (equipment_id)
      equipment_id,
      COALESCE(trang_thai, 'Không xác định') AS latest_status,
      COALESCE(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) AS status_timestamp
    FROM repair_data
    ORDER BY equipment_id, COALESCE(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) DESC
  ),
  top_equipment AS (
    SELECT 
      er.equipment_id,
      er.equipment_name,
      er.total_requests,
      els.latest_status,
      CASE
        WHEN er.latest_completed_at IS NOT NULL THEN to_char(er.latest_completed_at, 'YYYY-MM-DD"T"HH24:MI:SS')
        ELSE NULL
      END AS latest_completed_date
    FROM equipment_repairs er
    LEFT JOIN equipment_latest_status els ON els.equipment_id = er.equipment_id
    ORDER BY er.total_requests DESC, er.equipment_name
    LIMIT 10
  ),
  recent_repairs AS (
    SELECT
      rd.id,
      rd.equipment_name,
      COALESCE(NULLIF(trim(rd.mo_ta_su_co), ''), 'Không có mô tả') AS issue,
      COALESCE(rd.trang_thai, 'Không xác định') AS status,
      to_char(reference_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS') AS requested_date,
      CASE
        WHEN rd.ngay_hoan_thanh IS NOT NULL THEN to_char(rd.ngay_hoan_thanh, 'YYYY-MM-DD"T"HH24:MI:SS')
        ELSE NULL
      END AS completed_date
    FROM repair_data rd
    ORDER BY reference_timestamp DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'totalRepairs', COALESCE(rs.total_repairs, 0),
        'repairCompletionRate', CASE WHEN COALESCE(rs.total_repairs, 0) > 0 THEN (COALESCE(rs.completed, 0)::numeric / rs.total_repairs * 100) ELSE 0 END,
        'totalMaintenancePlanned', COALESCE((SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma), 0),
        'maintenanceCompletionRate',
          CASE 
            WHEN COALESCE((SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma), 0) > 0 THEN
              (COALESCE((SELECT SUM(ma.total_actual) FROM maintenance_aggregated ma), 0)::numeric /
               (SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma) * 100)
            ELSE 0
          END
      )
      FROM repair_summary rs
    ),
    'charts', jsonb_build_object(
      'repairStatusDistribution', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', status_name,
            'value', status_count,
            'color', status_color
          )
        ), '[]'::jsonb)
        FROM (
          SELECT 'Hoàn thành' AS status_name, completed AS status_count, 'hsl(var(--chart-1))' AS status_color FROM repair_summary WHERE completed > 0
          UNION ALL
          SELECT 'Không HT', not_completed, 'hsl(var(--chart-5))' FROM repair_summary WHERE not_completed > 0
          UNION ALL
          SELECT 'Đã duyệt', approved, 'hsl(var(--chart-2))' FROM repair_summary WHERE approved > 0
          UNION ALL
          SELECT 'Chờ xử lý', pending, 'hsl(var(--chart-3))' FROM repair_summary WHERE pending > 0
        ) statuses
      ),
      'maintenancePlanVsActual', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', loai_cong_viec,
            'planned', total_planned,
            'actual', total_actual
          ) ORDER BY loai_cong_viec
        ), '[]'::jsonb)
        FROM maintenance_aggregated
      ),
      'repairFrequencyByMonth', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'period', period,
            'total', total,
            'completed', completed
          ) ORDER BY period
        ), '[]'::jsonb)
        FROM repair_frequency
      )
    ),
    'topEquipmentRepairs', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'equipmentId', te.equipment_id,
          'equipmentName', te.equipment_name,
          'totalRequests', te.total_requests,
          'latestStatus', COALESCE(te.latest_status, 'Không xác định'),
          'latestCompletedDate', te.latest_completed_date
        ) ORDER BY te.total_requests DESC, te.equipment_name
      ), '[]'::jsonb)
      FROM top_equipment te
    ),
    'recentRepairHistory', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'equipmentName', rr.equipment_name,
          'issue', rr.issue,
          'status', rr.status,
          'requestedDate', rr.requested_date,
          'completedDate', rr.completed_date
        ) ORDER BY rr.requested_date DESC, rr.id DESC
      ), '[]'::jsonb)
      FROM recent_repairs rr
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'summary', jsonb_build_object(
      'totalRepairs', 0,
      'repairCompletionRate', 0,
      'totalMaintenancePlanned', 0,
      'maintenanceCompletionRate', 0
    ),
    'charts', jsonb_build_object(
      'repairStatusDistribution', '[]'::jsonb,
      'maintenancePlanVsActual', '[]'::jsonb,
      'repairFrequencyByMonth', '[]'::jsonb
    ),
    'topEquipmentRepairs', '[]'::jsonb,
    'recentRepairHistory', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT)
IS 'Returns maintenance report data with tenant-aware aggregation, including top equipment repairs and recent history.';

COMMIT;
