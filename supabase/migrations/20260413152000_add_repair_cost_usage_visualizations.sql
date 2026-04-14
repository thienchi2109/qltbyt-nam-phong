-- Issue #256: add repair cost usage visualizations to the maintenance report RPC.
-- Prepared for review only; do not apply automatically from the agent session.
--
-- Rollback: restore the previous get_maintenance_report_data definition from
-- supabase/migrations/20260412100000_add_repair_request_cost_statistics.sql
-- if the new visualization payload needs to be removed.

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
        'topEquipmentRepairCosts', '[]'::jsonb,
        'recentRepairHistory', '[]'::jsonb
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
  ),
  recent_repairs AS (
    SELECT
      rd.id,
      rd.equipment_name,
      coalesce(nullif(trim(rd.mo_ta_su_co), ''), 'Không có mô tả') AS issue,
      coalesce(rd.trang_thai, 'Không xác định') AS status,
      rd.chi_phi_sua_chua,
      to_char(reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS') AS requested_date,
      CASE
        WHEN rd.ngay_hoan_thanh IS NOT NULL THEN to_char(rd.ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS')
        ELSE NULL
      END AS completed_date
    FROM repair_data rd
    ORDER BY reference_timestamp DESC
    LIMIT 20
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
    ),
    'recentRepairHistory', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', rr.id,
            'equipmentName', rr.equipment_name,
            'issue', rr.issue,
            'status', rr.status,
            'repairCost', rr.chi_phi_sua_chua,
            'requestedDate', rr.requested_date,
            'completedDate', rr.completed_date
          )
          ORDER BY rr.requested_date DESC, rr.id DESC
        ),
        '[]'::jsonb
      )
      FROM recent_repairs rr
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
      'topEquipmentRepairCosts', '[]'::jsonb,
      'recentRepairHistory', '[]'::jsonb
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) FROM PUBLIC;

COMMENT ON FUNCTION public.get_maintenance_report_data(date, date, bigint)
IS 'Returns maintenance report data with tenant-aware aggregation, repair cost visualizations, top equipment rankings, recent history, and usage-cost correlation datasets.';

COMMIT;
