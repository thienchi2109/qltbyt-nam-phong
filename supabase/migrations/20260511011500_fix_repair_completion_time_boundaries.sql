-- Issue #441 follow-up: fix repair completion-time completion-date scoping and exact-boundary buckets.
-- Apply with Supabase MCP apply_migration only.
--
-- Forward-only follow-up to 20260510160000_add_repair_completion_time_charts.sql.
-- Do not edit the already-applied migration; this redefines the RPC with the
-- corrected completion-time CTEs.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(
  p_date_from date,
  p_date_to date,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_is_global boolean := false;
  v_allowed bigint[];
  v_effective bigint[];
  v_result jsonb;
  v_from_year integer := extract(year from p_date_from)::integer;
  v_to_year integer := extract(year from p_date_to)::integer;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := nullif(public._get_jwt_claim('user_id'), '');
  v_is_global := v_role IN ('global', 'admin');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'summary', jsonb_build_object(
          'totalRepairs', 0,
          'repairCompletionRate', 0,
          'totalMaintenancePlanned', 0,
          'maintenanceCompletionRate', 0,
          'totalRepairCost', 0,
          'averageCompletedRepairCost', 0,
          'costRecordedCount', 0,
          'costMissingCount', 0
        ),
        'charts', jsonb_build_object(
          'repairStatusDistribution', '[]'::jsonb,
          'maintenancePlanVsActual', '[]'::jsonb,
          'repairFrequencyByMonth', '[]'::jsonb,
          'repairCostByMonth', '[]'::jsonb,
          'repairCostByFacility', '[]'::jsonb,
          'repairCompletionTime', jsonb_build_object(
            'stats', jsonb_build_object(
              'totalCompleted', 0,
              'medianMinutes', 0,
              'averageMinutes', 0,
              'p90Minutes', 0,
              'onTimeCount', 0,
              'onTimePercent', 0,
              'thresholdDays', 14
            ),
            'distribution', jsonb_build_array(
              jsonb_build_object('bucketKey', '0-1d', 'label', '0-1 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '1-3d', 'label', '1-3 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '3-7d', 'label', '3-7 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '7-14d', 'label', '7-14 ngày', 'count', 0, 'isOverThreshold', false),
              jsonb_build_object('bucketKey', '14-30d', 'label', '14-30 ngày', 'count', 0, 'isOverThreshold', true),
              jsonb_build_object('bucketKey', '30d+', 'label', '>30 ngày', 'count', 0, 'isOverThreshold', true)
            )
          ),
          'repairCompletionTimeByMonth', '[]'::jsonb,
          'repairUsageCostCorrelation', jsonb_build_object(
            'period', jsonb_build_object(
              'points', '[]'::jsonb,
              'dataQuality', jsonb_build_object(
                'equipmentWithUsage', 0,
                'equipmentWithRepairCost', 0,
                'equipmentWithBoth', 0
              )
            ),
            'cumulative', jsonb_build_object(
              'points', '[]'::jsonb,
              'dataQuality', jsonb_build_object(
                'equipmentWithUsage', 0,
                'equipmentWithRepairCost', 0,
                'equipmentWithBoth', 0
              )
            )
          )
        ),
        'topEquipmentRepairs', '[]'::jsonb,
        'topEquipmentRepairCosts', '[]'::jsonb
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  WITH scoped_equipment AS (
    SELECT
      tb.id AS equipment_id,
      coalesce(nullif(trim(tb.ten_thiet_bi), ''), tb.ma_thiet_bi, 'Không xác định') AS equipment_name,
      tb.ma_thiet_bi AS equipment_code,
      tb.don_vi AS facility_id
    FROM public.thiet_bi tb
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  ),
  repair_data_raw AS (
    SELECT
      yc.id,
      yc.trang_thai,
      yc.mo_ta_su_co,
      yc.ngay_yeu_cau,
      yc.ngay_duyet,
      yc.ngay_hoan_thanh,
      yc.chi_phi_sua_chua,
      se.equipment_id,
      se.equipment_name,
      se.equipment_code,
      se.facility_id,
      coalesce(dv.name, 'Không xác định') AS facility_name,
      coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AS reference_timestamp,
      (
        lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
        OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
      ) AS is_completed
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN scoped_equipment se ON yc.thiet_bi_id = se.equipment_id
    LEFT JOIN public.don_vi dv ON dv.id = se.facility_id
  ),
  repair_data AS (
    SELECT
      id,
      trang_thai,
      mo_ta_su_co,
      ngay_yeu_cau,
      ngay_duyet,
      ngay_hoan_thanh,
      chi_phi_sua_chua,
      equipment_id,
      equipment_name,
      equipment_code,
      facility_id,
      facility_name,
      reference_timestamp,
      is_completed
    FROM repair_data_raw
    WHERE reference_timestamp IS NOT NULL
      AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
  ),
  cumulative_repair_data AS (
    SELECT
      id,
      trang_thai,
      mo_ta_su_co,
      ngay_yeu_cau,
      ngay_duyet,
      ngay_hoan_thanh,
      chi_phi_sua_chua,
      equipment_id,
      equipment_name,
      equipment_code,
      facility_id,
      facility_name,
      reference_timestamp,
      is_completed
    FROM repair_data_raw
    WHERE reference_timestamp IS NOT NULL
      AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
  ),
  repair_summary AS (
    SELECT
      count(*) AS total_repairs,
      count(*) FILTER (WHERE is_completed) AS completed,
      count(*) FILTER (WHERE lower(coalesce(trang_thai, '')) LIKE '%không ht%') AS not_completed,
      count(*) FILTER (
        WHERE lower(coalesce(trang_thai, '')) LIKE '%đã duyệt%'
           OR lower(coalesce(trang_thai, '')) LIKE '%da duyet%'
      ) AS approved,
      count(*) FILTER (
        WHERE lower(coalesce(trang_thai, '')) LIKE '%chờ%'
           OR lower(coalesce(trang_thai, '')) LIKE '%cho%'
      ) AS pending,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL) AS cost_missing_count
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
      cv.thang_1,
      cv.thang_1_hoan_thanh,
      cv.thang_2,
      cv.thang_2_hoan_thanh,
      cv.thang_3,
      cv.thang_3_hoan_thanh,
      cv.thang_4,
      cv.thang_4_hoan_thanh,
      cv.thang_5,
      cv.thang_5_hoan_thanh,
      cv.thang_6,
      cv.thang_6_hoan_thanh,
      cv.thang_7,
      cv.thang_7_hoan_thanh,
      cv.thang_8,
      cv.thang_8_hoan_thanh,
      cv.thang_9,
      cv.thang_9_hoan_thanh,
      cv.thang_10,
      cv.thang_10_hoan_thanh,
      cv.thang_11,
      cv.thang_11_hoan_thanh,
      cv.thang_12,
      cv.thang_12_hoan_thanh
    FROM public.ke_hoach_bao_tri kh
    LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
    WHERE (v_effective IS NULL OR kh.don_vi = ANY(v_effective))
      AND kh.nam BETWEEN v_from_year AND v_to_year
      AND kh.trang_thai = 'Đã duyệt'
  ),
  maintenance_summary AS (
    SELECT
      loai_cong_viec,
      (
        CASE WHEN thang_1 THEN 1 ELSE 0 END + CASE WHEN thang_2 THEN 1 ELSE 0 END +
        CASE WHEN thang_3 THEN 1 ELSE 0 END + CASE WHEN thang_4 THEN 1 ELSE 0 END +
        CASE WHEN thang_5 THEN 1 ELSE 0 END + CASE WHEN thang_6 THEN 1 ELSE 0 END +
        CASE WHEN thang_7 THEN 1 ELSE 0 END + CASE WHEN thang_8 THEN 1 ELSE 0 END +
        CASE WHEN thang_9 THEN 1 ELSE 0 END + CASE WHEN thang_10 THEN 1 ELSE 0 END +
        CASE WHEN thang_11 THEN 1 ELSE 0 END + CASE WHEN thang_12 THEN 1 ELSE 0 END
      ) AS planned,
      (
        CASE WHEN thang_1_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_2_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_3_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_4_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_5_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_6_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_7_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_8_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_9_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_10_hoan_thanh THEN 1 ELSE 0 END +
        CASE WHEN thang_11_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_12_hoan_thanh THEN 1 ELSE 0 END
      ) AS actual
    FROM maintenance_data
    WHERE loai_cong_viec IN ('Bảo trì', 'Hiệu chuẩn', 'Kiểm định')
  ),
  maintenance_aggregated AS (
    SELECT
      loai_cong_viec,
      sum(planned) AS total_planned,
      sum(actual) AS total_actual
    FROM maintenance_summary
    GROUP BY loai_cong_viec
  ),
  repair_frequency AS (
    SELECT
      to_char(date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      count(*)::integer AS total,
      count(*) FILTER (WHERE is_completed)::integer AS completed
    FROM repair_data
    GROUP BY date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  repair_cost_by_month AS (
    SELECT
      to_char(date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY date_trunc('month', reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  repair_cost_by_facility AS (
    SELECT
      facility_id,
      facility_name,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY facility_id, facility_name
  ),
  repair_completion_rows AS (
    SELECT
      id,
      ngay_hoan_thanh,
      extract(epoch from (ngay_hoan_thanh - ngay_yeu_cau)) / 60.0 AS completion_minutes
    FROM repair_data_raw
    WHERE is_completed
      AND ngay_hoan_thanh IS NOT NULL
      AND ngay_yeu_cau IS NOT NULL
      AND ngay_hoan_thanh >= ngay_yeu_cau
      AND (ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
  ),
  repair_completion_stats AS (
    SELECT
      count(*)::integer AS total_completed,
      round(coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY completion_minutes), 0)::numeric, 1) AS median_minutes,
      round(coalesce(avg(completion_minutes), 0)::numeric, 1) AS average_minutes,
      round(coalesce(percentile_cont(0.9) WITHIN GROUP (ORDER BY completion_minutes), 0)::numeric, 1) AS p90_minutes,
      count(*) FILTER (WHERE completion_minutes <= 14 * 24 * 60)::integer AS on_time_count,
      CASE
        WHEN count(*) > 0 THEN round((count(*) FILTER (WHERE completion_minutes <= 14 * 24 * 60)::numeric / count(*)::numeric) * 100, 1)
        ELSE 0
      END AS on_time_percent
    FROM repair_completion_rows
  ),
  repair_completion_bucket_template AS (
    SELECT *
    FROM (
      VALUES
        (1, '0-1d', '0-1 ngày', 0::numeric, 1::numeric * 24 * 60, false),
        (2, '1-3d', '1-3 ngày', 1::numeric * 24 * 60, 3::numeric * 24 * 60, false),
        (3, '3-7d', '3-7 ngày', 3::numeric * 24 * 60, 7::numeric * 24 * 60, false),
        (4, '7-14d', '7-14 ngày', 7::numeric * 24 * 60, 14::numeric * 24 * 60, false),
        (5, '14-30d', '14-30 ngày', 14::numeric * 24 * 60, 30::numeric * 24 * 60, true),
        (6, '30d+', '>30 ngày', 30::numeric * 24 * 60, NULL::numeric, true)
    ) AS bucket(sort_order, bucket_key, bucket_label, min_minutes, max_minutes, is_over_threshold)
  ),
  repair_completion_distribution AS (
    SELECT
      bt.sort_order,
      bt.bucket_key,
      bt.bucket_label,
      bt.is_over_threshold,
      count(rcr.id)::integer AS bucket_count
    FROM repair_completion_bucket_template bt
    LEFT JOIN repair_completion_rows rcr
      ON (
        (bt.max_minutes IS NULL AND rcr.completion_minutes > bt.min_minutes)
        OR (bt.sort_order = 1 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes < bt.max_minutes)
        OR (bt.sort_order BETWEEN 2 AND 3 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes < bt.max_minutes)
        OR (bt.sort_order = 4 AND rcr.completion_minutes >= bt.min_minutes AND rcr.completion_minutes <= bt.max_minutes)
        OR (bt.sort_order = 5 AND rcr.completion_minutes > bt.min_minutes AND rcr.completion_minutes <= bt.max_minutes)
      )
    GROUP BY bt.sort_order, bt.bucket_key, bt.bucket_label, bt.is_over_threshold
  ),
  repair_completion_by_month AS (
    SELECT
      to_char(date_trunc('month', ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM') AS period,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY completion_minutes))::numeric, 1) AS median_minutes,
      round((percentile_cont(0.9) WITHIN GROUP (ORDER BY completion_minutes))::numeric, 1) AS p90_minutes,
      round(avg(completion_minutes)::numeric, 1) AS average_minutes,
      count(*)::integer AS completed_count
    FROM repair_completion_rows
    GROUP BY date_trunc('month', ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ),
  equipment_repairs AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      count(*)::integer AS total_requests,
      max(reference_timestamp) AS latest_event_at,
      max(ngay_hoan_thanh) AS latest_completed_at,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  equipment_latest_status AS (
    SELECT DISTINCT ON (equipment_id)
      equipment_id,
      coalesce(trang_thai, 'Không xác định') AS latest_status,
      coalesce(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) AS status_timestamp
    FROM repair_data
    ORDER BY equipment_id, coalesce(ngay_hoan_thanh, ngay_duyet, ngay_yeu_cau, reference_timestamp) DESC
  ),
  top_equipment AS (
    SELECT
      er.equipment_id,
      er.equipment_name,
      er.equipment_code,
      er.total_requests,
      er.total_repair_cost,
      er.average_completed_repair_cost,
      er.cost_recorded_count,
      er.cost_missing_count,
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
  usage_data_raw AS (
    SELECT
      se.equipment_id,
      se.equipment_name,
      se.equipment_code,
      nk.thoi_gian_bat_dau,
      nk.thoi_gian_ket_thuc,
      extract(epoch from (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600.0 AS usage_hours
    FROM scoped_equipment se
    INNER JOIN public.nhat_ky_su_dung nk
      ON nk.thiet_bi_id = se.equipment_id
    WHERE nk.thoi_gian_ket_thuc IS NOT NULL
      AND nk.thoi_gian_ket_thuc > nk.thoi_gian_bat_dau
  ),
  period_usage_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      sum(usage_hours) AS total_usage_hours
    FROM usage_data_raw
    WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
      AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  cumulative_usage_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      sum(usage_hours) AS total_usage_hours
    FROM usage_data_raw
    WHERE (thoi_gian_bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
      AND (thoi_gian_ket_thuc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= p_date_to
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  period_repair_costs_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
    FROM repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  cumulative_repair_costs_by_equipment AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed)::integer AS completed_repair_requests,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count
    FROM cumulative_repair_data
    GROUP BY equipment_id, equipment_name, equipment_code
  ),
  top_equipment_repair_costs AS (
    SELECT
      equipment_id,
      equipment_name,
      equipment_code,
      total_repair_cost,
      average_completed_repair_cost,
      completed_repair_requests,
      cost_recorded_count
    FROM period_repair_costs_by_equipment
    WHERE cost_recorded_count > 0
    ORDER BY total_repair_cost DESC, equipment_name
    LIMIT 10
  ),
  period_correlation_points AS (
    SELECT
      pu.equipment_id,
      pu.equipment_name,
      pu.equipment_code,
      pu.total_usage_hours,
      pr.total_repair_cost,
      pr.completed_repair_requests,
      pr.cost_recorded_count
    FROM period_usage_by_equipment pu
    INNER JOIN period_repair_costs_by_equipment pr ON pr.equipment_id = pu.equipment_id
    WHERE pu.total_usage_hours > 0
      AND pr.cost_recorded_count > 0
  ),
  cumulative_correlation_points AS (
    SELECT
      cu.equipment_id,
      cu.equipment_name,
      cu.equipment_code,
      cu.total_usage_hours,
      cr.total_repair_cost,
      cr.completed_repair_requests,
      cr.cost_recorded_count
    FROM cumulative_usage_by_equipment cu
    INNER JOIN cumulative_repair_costs_by_equipment cr ON cr.equipment_id = cu.equipment_id
    WHERE cu.total_usage_hours > 0
      AND cr.cost_recorded_count > 0
  ),
  period_correlation_data_quality AS (
    SELECT
      (SELECT count(*)::integer FROM period_usage_by_equipment WHERE total_usage_hours > 0) AS equipment_with_usage,
      (SELECT count(*)::integer FROM period_repair_costs_by_equipment WHERE cost_recorded_count > 0) AS equipment_with_repair_cost,
      (SELECT count(*)::integer FROM period_correlation_points) AS equipment_with_both
  ),
  cumulative_correlation_data_quality AS (
    SELECT
      (SELECT count(*)::integer FROM cumulative_usage_by_equipment WHERE total_usage_hours > 0) AS equipment_with_usage,
      (SELECT count(*)::integer FROM cumulative_repair_costs_by_equipment WHERE cost_recorded_count > 0) AS equipment_with_repair_cost,
      (SELECT count(*)::integer FROM cumulative_correlation_points) AS equipment_with_both
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'totalRepairs', coalesce(rs.total_repairs, 0),
        'repairCompletionRate',
          CASE
            WHEN coalesce(rs.total_repairs, 0) > 0
              THEN (coalesce(rs.completed, 0)::numeric / rs.total_repairs * 100)
            ELSE 0
          END,
        'totalMaintenancePlanned', coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0),
        'maintenanceCompletionRate',
          CASE
            WHEN coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0) > 0 THEN
              (
                coalesce((SELECT sum(ma.total_actual) FROM maintenance_aggregated ma), 0)::numeric /
                (SELECT sum(ma.total_planned) FROM maintenance_aggregated ma) * 100
              )
            ELSE 0
          END,
        'totalRepairCost', coalesce(rs.total_repair_cost, 0),
        'averageCompletedRepairCost', coalesce(rs.average_completed_repair_cost, 0),
        'costRecordedCount', coalesce(rs.cost_recorded_count, 0),
        'costMissingCount', coalesce(rs.cost_missing_count, 0)
      )
      FROM repair_summary rs
    ),
    'charts', jsonb_build_object(
      'repairStatusDistribution', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', status_name,
              'value', status_count,
              'color', status_color
            )
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT 'Hoàn thành' AS status_name, completed AS status_count, 'hsl(var(--chart-1))' AS status_color
          FROM repair_summary
          WHERE completed > 0
          UNION ALL
          SELECT 'Không HT', not_completed, 'hsl(var(--chart-5))'
          FROM repair_summary
          WHERE not_completed > 0
          UNION ALL
          SELECT 'Đã duyệt', approved, 'hsl(var(--chart-2))'
          FROM repair_summary
          WHERE approved > 0
          UNION ALL
          SELECT 'Chờ xử lý', pending, 'hsl(var(--chart-3))'
          FROM repair_summary
          WHERE pending > 0
        ) statuses
      ),
      'maintenancePlanVsActual', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'name', loai_cong_viec,
              'planned', total_planned,
              'actual', total_actual
            )
            ORDER BY loai_cong_viec
          ),
          '[]'::jsonb
        )
        FROM maintenance_aggregated
      ),
      'repairFrequencyByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', period,
              'total', total,
              'completed', completed
            )
            ORDER BY period
          ),
          '[]'::jsonb
        )
        FROM repair_frequency
      ),
      'repairCostByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', period,
              'totalCost', total_cost,
              'averageCost', coalesce(average_cost, 0),
              'costRecordedCount', cost_recorded_count,
              'costMissingCount', cost_missing_count
            )
            ORDER BY period
          ),
          '[]'::jsonb
        )
        FROM repair_cost_by_month
      ),
      'repairCostByFacility', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'facilityId', facility_id,
              'facilityName', facility_name,
              'totalCost', total_cost,
              'averageCost', coalesce(average_cost, 0),
              'costRecordedCount', cost_recorded_count,
              'costMissingCount', cost_missing_count
            )
            ORDER BY facility_name
          ),
          '[]'::jsonb
        )
        FROM repair_cost_by_facility
      ),
      'repairCompletionTime', jsonb_build_object(
        'stats', (
          SELECT jsonb_build_object(
            'totalCompleted', coalesce(rcs.total_completed, 0),
            'medianMinutes', coalesce(rcs.median_minutes, 0),
            'averageMinutes', coalesce(rcs.average_minutes, 0),
            'p90Minutes', coalesce(rcs.p90_minutes, 0),
            'onTimeCount', coalesce(rcs.on_time_count, 0),
            'onTimePercent', coalesce(rcs.on_time_percent, 0),
            'thresholdDays', 14
          )
          FROM repair_completion_stats rcs
        ),
        'distribution', (
          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'bucketKey', rcd.bucket_key,
                'label', rcd.bucket_label,
                'count', rcd.bucket_count,
                'isOverThreshold', rcd.is_over_threshold
              )
              ORDER BY rcd.sort_order
            ),
            '[]'::jsonb
          )
          FROM repair_completion_distribution rcd
        )
      ),
      'repairCompletionTimeByMonth', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'period', rcbm.period,
              'medianMinutes', rcbm.median_minutes,
              'p90Minutes', rcbm.p90_minutes,
              'averageMinutes', rcbm.average_minutes,
              'completedCount', rcbm.completed_count
            )
            ORDER BY rcbm.period
          ),
          '[]'::jsonb
        )
        FROM repair_completion_by_month rcbm
      ),
      'repairUsageCostCorrelation', jsonb_build_object(
        'period', jsonb_build_object(
          'points', (
            SELECT coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'equipmentId', pcp.equipment_id,
                  'equipmentName', pcp.equipment_name,
                  'equipmentCode', pcp.equipment_code,
                  'totalUsageHours', pcp.total_usage_hours,
                  'totalRepairCost', pcp.total_repair_cost,
                  'completedRepairRequests', pcp.completed_repair_requests,
                  'costRecordedCount', pcp.cost_recorded_count
                )
                ORDER BY pcp.total_repair_cost DESC, pcp.equipment_name
              ),
              '[]'::jsonb
            )
            FROM period_correlation_points pcp
          ),
          'dataQuality', (
            SELECT jsonb_build_object(
              'equipmentWithUsage', coalesce(pcq.equipment_with_usage, 0),
              'equipmentWithRepairCost', coalesce(pcq.equipment_with_repair_cost, 0),
              'equipmentWithBoth', coalesce(pcq.equipment_with_both, 0)
            )
            FROM period_correlation_data_quality pcq
          )
        ),
        'cumulative', jsonb_build_object(
          'points', (
            SELECT coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'equipmentId', ccp.equipment_id,
                  'equipmentName', ccp.equipment_name,
                  'equipmentCode', ccp.equipment_code,
                  'totalUsageHours', ccp.total_usage_hours,
                  'totalRepairCost', ccp.total_repair_cost,
                  'completedRepairRequests', ccp.completed_repair_requests,
                  'costRecordedCount', ccp.cost_recorded_count
                )
                ORDER BY ccp.total_repair_cost DESC, ccp.equipment_name
              ),
              '[]'::jsonb
            )
            FROM cumulative_correlation_points ccp
          ),
          'dataQuality', (
            SELECT jsonb_build_object(
              'equipmentWithUsage', coalesce(ccq.equipment_with_usage, 0),
              'equipmentWithRepairCost', coalesce(ccq.equipment_with_repair_cost, 0),
              'equipmentWithBoth', coalesce(ccq.equipment_with_both, 0)
            )
            FROM cumulative_correlation_data_quality ccq
          )
        )
      )
    ),
    'topEquipmentRepairs', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'equipmentId', te.equipment_id,
            'equipmentName', te.equipment_name,
            'totalRequests', te.total_requests,
            'latestStatus', coalesce(te.latest_status, 'Không xác định'),
            'latestCompletedDate', te.latest_completed_date,
            'totalRepairCost', te.total_repair_cost,
            'averageCompletedRepairCost', coalesce(te.average_completed_repair_cost, 0),
            'costRecordedCount', te.cost_recorded_count,
            'costMissingCount', te.cost_missing_count
          )
          ORDER BY te.total_requests DESC, te.equipment_name
        ),
        '[]'::jsonb
      )
      FROM top_equipment te
    ),
    'topEquipmentRepairCosts', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'equipmentId', terc.equipment_id,
            'equipmentName', terc.equipment_name,
            'equipmentCode', terc.equipment_code,
            'totalRepairCost', terc.total_repair_cost,
            'averageCompletedRepairCost', coalesce(terc.average_completed_repair_cost, 0),
            'completedRepairRequests', terc.completed_repair_requests,
            'costRecordedCount', terc.cost_recorded_count
          )
          ORDER BY terc.total_repair_cost DESC, terc.equipment_name
        ),
        '[]'::jsonb
      )
      FROM top_equipment_repair_costs terc
    )
  ) INTO v_result;

  RETURN coalesce(
    v_result,
    jsonb_build_object(
      'summary', jsonb_build_object(
        'totalRepairs', 0,
        'repairCompletionRate', 0,
        'totalMaintenancePlanned', 0,
        'maintenanceCompletionRate', 0,
        'totalRepairCost', 0,
        'averageCompletedRepairCost', 0,
        'costRecordedCount', 0,
        'costMissingCount', 0
      ),
      'charts', jsonb_build_object(
        'repairStatusDistribution', '[]'::jsonb,
        'maintenancePlanVsActual', '[]'::jsonb,
        'repairFrequencyByMonth', '[]'::jsonb,
        'repairCostByMonth', '[]'::jsonb,
        'repairCostByFacility', '[]'::jsonb,
        'repairCompletionTime', jsonb_build_object(
          'stats', jsonb_build_object(
            'totalCompleted', 0,
            'medianMinutes', 0,
            'averageMinutes', 0,
            'p90Minutes', 0,
            'onTimeCount', 0,
            'onTimePercent', 0,
            'thresholdDays', 14
          ),
          'distribution', jsonb_build_array(
            jsonb_build_object('bucketKey', '0-1d', 'label', '0-1 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '1-3d', 'label', '1-3 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '3-7d', 'label', '3-7 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '7-14d', 'label', '7-14 ngày', 'count', 0, 'isOverThreshold', false),
            jsonb_build_object('bucketKey', '14-30d', 'label', '14-30 ngày', 'count', 0, 'isOverThreshold', true),
            jsonb_build_object('bucketKey', '30d+', 'label', '>30 ngày', 'count', 0, 'isOverThreshold', true)
          )
        ),
        'repairCompletionTimeByMonth', '[]'::jsonb,
        'repairUsageCostCorrelation', jsonb_build_object(
          'period', jsonb_build_object(
            'points', '[]'::jsonb,
            'dataQuality', jsonb_build_object(
              'equipmentWithUsage', 0,
              'equipmentWithRepairCost', 0,
              'equipmentWithBoth', 0
            )
          ),
          'cumulative', jsonb_build_object(
            'points', '[]'::jsonb,
            'dataQuality', jsonb_build_object(
              'equipmentWithUsage', 0,
              'equipmentWithRepairCost', 0,
              'equipmentWithBoth', 0
            )
          )
        )
      ),
      'topEquipmentRepairs', '[]'::jsonb,
      'topEquipmentRepairCosts', '[]'::jsonb
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) FROM PUBLIC;

COMMENT ON FUNCTION public.get_maintenance_report_data(date, date, bigint)
IS 'Returns maintenance report data with tenant-aware aggregation, repair cost visualizations, repair completion-time distribution, top equipment rankings, and usage-cost correlation datasets.';

COMMIT;
