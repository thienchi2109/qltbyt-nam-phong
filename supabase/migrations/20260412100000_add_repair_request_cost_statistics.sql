-- Issue #237: add optional repair-request cost capture and statistics.
-- Prepared for review only; do not apply automatically from the agent session.
-- Rollback note: this forward-only migration replaces several RPC bodies. If rollback
-- is required, restore those bodies from their previous migrations and drop the
-- repair-cost constraint/column only before any production cost data exists.

BEGIN;

ALTER TABLE public.yeu_cau_sua_chua
  ADD COLUMN IF NOT EXISTS chi_phi_sua_chua numeric(14,2) NULL;

ALTER TABLE public.yeu_cau_sua_chua
  ALTER COLUMN chi_phi_sua_chua DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'yeu_cau_sua_chua'
      AND con.conname = 'yeu_cau_sua_chua_chi_phi_sua_chua_non_negative'
  ) THEN
    ALTER TABLE public.yeu_cau_sua_chua
      ADD CONSTRAINT yeu_cau_sua_chua_chi_phi_sua_chua_non_negative
      CHECK (chi_phi_sua_chua IS NULL OR chi_phi_sua_chua >= 0);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.repair_request_complete(integer, text, text);

CREATE OR REPLACE FUNCTION public.repair_request_complete(
  p_id integer,
  p_completion text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_chi_phi_sua_chua numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_thiet_bi_id bigint;
  v_tb_don_vi bigint;
  v_locked_status text;
  v_locked_completed_at timestamptz;
  v_status text;
  v_result text;
  v_reason text;
  v_cost numeric(14,2);
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  SELECT ycss.thiet_bi_id, ycss.trang_thai, ycss.ngay_hoan_thanh, tb.don_vi
  INTO v_thiet_bi_id, v_locked_status, v_locked_completed_at, v_tb_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss, tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_locked_completed_at IS NOT NULL OR v_locked_status IN ('Hoàn thành', 'Không HT') THEN
    RAISE EXCEPTION 'Không thể hoàn thành lại yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  IF p_chi_phi_sua_chua IS NOT NULL AND p_chi_phi_sua_chua < 0 THEN
    RAISE EXCEPTION 'Chi phí sửa chữa không được âm' USING errcode = '22023';
  END IF;

  IF p_completion IS NOT NULL AND trim(p_completion) <> '' THEN
    v_status := 'Hoàn thành';
    v_result := p_completion;
    v_reason := NULL;
    v_cost := p_chi_phi_sua_chua;
  ELSE
    v_status := 'Không HT';
    v_result := NULL;
    v_reason := p_reason;
    v_cost := NULL;
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = v_result,
      ly_do_khong_hoan_thanh = v_reason,
      chi_phi_sua_chua = v_cost
  WHERE id = p_id;

  IF v_status = 'Hoàn thành' THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = 'Hoạt động'
    WHERE id = v_thiet_bi_id
      AND is_deleted = false;
  END IF;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object(
      'ket_qua', coalesce(v_result, v_reason),
      'trang_thai', v_status,
      'chi_phi_sua_chua', v_cost
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_complete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_status,
      'ket_qua_sua_chua', v_result,
      'ly_do_khong_hoan_thanh', v_reason,
      'chi_phi_sua_chua', v_cost
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_complete(integer, text, text, numeric) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_statuses text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := nullif(public._get_jwt_claim('user_id'), '');
  v_is_global boolean := false;
  v_effective_donvi bigint := NULL;
  v_allowed bigint[] := NULL;
  v_limit integer := greatest(coalesce(p_page_size, 50), 1);
  v_offset integer := greatest((coalesce(p_page, 1) - 1) * v_limit, 0);
  v_page integer := (v_offset / v_limit)::integer + 1;
  v_total bigint := 0;
  v_data jsonb := '[]'::jsonb;
  v_statuses text[] := NULL;
  v_sanitized_q text := NULL;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) IS NOT NULL THEN
    v_statuses := p_statuses;
  ELSIF p_status IS NOT NULL AND p_status <> '' THEN
    v_statuses := ARRAY[p_status];
  END IF;

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', v_page, 'pageSize', v_limit);
    END IF;
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', v_page, 'pageSize', v_limit);
      END IF;
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.yeu_cau_sua_chua r
  LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE (
    (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (v_statuses IS NULL OR r.trang_thai = ANY(v_statuses))
  AND (
    v_sanitized_q IS NULL OR
    r.mo_ta_su_co ILIKE '%' || v_sanitized_q || '%' OR
    r.hang_muc_sua_chua ILIKE '%' || v_sanitized_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
  )
  AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  SELECT coalesce(jsonb_agg(row_data ORDER BY ngay_yeu_cau DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT
      jsonb_build_object(
        'id', r.id,
        'thiet_bi_id', r.thiet_bi_id,
        'ngay_yeu_cau', r.ngay_yeu_cau,
        'trang_thai', r.trang_thai,
        'mo_ta_su_co', r.mo_ta_su_co,
        'hang_muc_sua_chua', r.hang_muc_sua_chua,
        'ngay_mong_muon_hoan_thanh', r.ngay_mong_muon_hoan_thanh,
        'nguoi_yeu_cau', r.nguoi_yeu_cau,
        'ngay_duyet', r.ngay_duyet,
        'ngay_hoan_thanh', r.ngay_hoan_thanh,
        'nguoi_duyet', r.nguoi_duyet,
        'nguoi_xac_nhan', r.nguoi_xac_nhan,
        'don_vi_thuc_hien', r.don_vi_thuc_hien,
        'ten_don_vi_thue', r.ten_don_vi_thue,
        'ket_qua_sua_chua', r.ket_qua_sua_chua,
        'ly_do_khong_hoan_thanh', r.ly_do_khong_hoan_thanh,
        'chi_phi_sua_chua', r.chi_phi_sua_chua,
        'equipment_is_deleted', tb.is_deleted,
        'thiet_bi', jsonb_build_object(
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', tb.don_vi,
          'is_deleted', tb.is_deleted
        )
      ) AS row_data,
      r.ngay_yeu_cau
    FROM public.yeu_cau_sua_chua r
    LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
      (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (v_statuses IS NULL OR r.trang_thai = ANY(v_statuses))
    AND (
      v_sanitized_q IS NULL OR
      r.mo_ta_su_co ILIKE '%' || v_sanitized_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || v_sanitized_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
    )
    AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subq;

  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', v_page, 'pageSize', v_limit);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_list(text, text, integer, integer, bigint, date, date, text[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_list(text, text, integer, integer, bigint, date, date, text[]) FROM PUBLIC;

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
          'repairCostByFacility', '[]'::jsonb
        ),
        'topEquipmentRepairs', '[]'::jsonb,
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

  WITH repair_data_raw AS (
    SELECT
      yc.id,
      yc.trang_thai,
      yc.mo_ta_su_co,
      yc.ngay_yeu_cau,
      yc.ngay_duyet,
      yc.ngay_hoan_thanh,
      yc.chi_phi_sua_chua,
      tb.id AS equipment_id,
      coalesce(nullif(trim(tb.ten_thiet_bi), ''), tb.ma_thiet_bi, 'Không xác định') AS equipment_name,
      tb.don_vi AS facility_id,
      coalesce(dv.name, 'Không xác định') AS facility_name,
      coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AS reference_timestamp,
      (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%' OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%') AS is_completed
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
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
      facility_id,
      facility_name,
      reference_timestamp,
      is_completed
    FROM repair_data_raw
    WHERE reference_timestamp IS NOT NULL
      AND (reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN p_date_from AND p_date_to
  ),
  repair_summary AS (
    SELECT
      count(*) AS total_repairs,
      count(*) FILTER (WHERE is_completed) AS completed,
      count(*) FILTER (WHERE lower(coalesce(trang_thai, '')) LIKE '%không ht%') AS not_completed,
      count(*) FILTER (WHERE lower(coalesce(trang_thai, '')) LIKE '%đã duyệt%' OR lower(coalesce(trang_thai, '')) LIKE '%da duyet%') AS approved,
      count(*) FILTER (WHERE lower(coalesce(trang_thai, '')) LIKE '%chờ%' OR lower(coalesce(trang_thai, '')) LIKE '%cho%') AS pending,
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
      AND kh.nam BETWEEN v_from_year AND v_to_year
      AND kh.trang_thai = 'Đã duyệt'
  ),
  maintenance_summary AS (
    SELECT
      loai_cong_viec,
      (CASE WHEN thang_1 THEN 1 ELSE 0 END + CASE WHEN thang_2 THEN 1 ELSE 0 END +
       CASE WHEN thang_3 THEN 1 ELSE 0 END + CASE WHEN thang_4 THEN 1 ELSE 0 END +
       CASE WHEN thang_5 THEN 1 ELSE 0 END + CASE WHEN thang_6 THEN 1 ELSE 0 END +
       CASE WHEN thang_7 THEN 1 ELSE 0 END + CASE WHEN thang_8 THEN 1 ELSE 0 END +
       CASE WHEN thang_9 THEN 1 ELSE 0 END + CASE WHEN thang_10 THEN 1 ELSE 0 END +
       CASE WHEN thang_11 THEN 1 ELSE 0 END + CASE WHEN thang_12 THEN 1 ELSE 0 END) AS planned,
      (CASE WHEN thang_1_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_2_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_3_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_4_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_5_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_6_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_7_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_8_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_9_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_10_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_11_hoan_thanh THEN 1 ELSE 0 END + CASE WHEN thang_12_hoan_thanh THEN 1 ELSE 0 END) AS actual
    FROM maintenance_data
    WHERE loai_cong_viec IN ('Bảo trì', 'Hiệu chuẩn', 'Kiểm định')
  ),
  maintenance_aggregated AS (
    SELECT loai_cong_viec, sum(planned) AS total_planned, sum(actual) AS total_actual
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
      count(*)::integer AS total_requests,
      max(reference_timestamp) AS latest_event_at,
      max(ngay_hoan_thanh) AS latest_completed_at,
      coalesce(sum(chi_phi_sua_chua) FILTER (WHERE is_completed), 0) AS total_repair_cost,
      avg(chi_phi_sua_chua) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL) AS average_completed_repair_cost,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NOT NULL)::integer AS cost_recorded_count,
      count(*) FILTER (WHERE is_completed AND chi_phi_sua_chua IS NULL)::integer AS cost_missing_count
    FROM repair_data
    GROUP BY equipment_id, equipment_name
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
      er.total_requests,
      er.total_repair_cost,
      er.average_completed_repair_cost,
      er.cost_recorded_count,
      er.cost_missing_count,
      els.latest_status,
      CASE WHEN er.latest_completed_at IS NOT NULL THEN to_char(er.latest_completed_at, 'YYYY-MM-DD"T"HH24:MI:SS') ELSE NULL END AS latest_completed_date
    FROM equipment_repairs er
    LEFT JOIN equipment_latest_status els ON els.equipment_id = er.equipment_id
    ORDER BY er.total_requests DESC, er.equipment_name
    LIMIT 10
  ),
  recent_repairs AS (
    SELECT
      rd.id,
      rd.equipment_name,
      coalesce(nullif(trim(rd.mo_ta_su_co), ''), 'Không có mô tả') AS issue,
      coalesce(rd.trang_thai, 'Không xác định') AS status,
      rd.chi_phi_sua_chua,
      to_char(reference_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS') AS requested_date,
      CASE WHEN rd.ngay_hoan_thanh IS NOT NULL THEN to_char(rd.ngay_hoan_thanh AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS') ELSE NULL END AS completed_date
    FROM repair_data rd
    ORDER BY reference_timestamp DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'totalRepairs', coalesce(rs.total_repairs, 0),
        'repairCompletionRate', CASE WHEN coalesce(rs.total_repairs, 0) > 0 THEN (coalesce(rs.completed, 0)::numeric / rs.total_repairs * 100) ELSE 0 END,
        'totalMaintenancePlanned', coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0),
        'maintenanceCompletionRate',
          CASE
            WHEN coalesce((SELECT sum(ma.total_planned) FROM maintenance_aggregated ma), 0) > 0 THEN
              (coalesce((SELECT sum(ma.total_actual) FROM maintenance_aggregated ma), 0)::numeric /
               (SELECT sum(ma.total_planned) FROM maintenance_aggregated ma) * 100)
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
        SELECT coalesce(jsonb_agg(jsonb_build_object('name', status_name, 'value', status_count, 'color', status_color)), '[]'::jsonb)
        FROM (
          SELECT 'Hoàn thành' AS status_name, completed AS status_count, 'hsl(var(--chart-1))' AS status_color FROM repair_summary WHERE completed > 0
          UNION ALL SELECT 'Không HT', not_completed, 'hsl(var(--chart-5))' FROM repair_summary WHERE not_completed > 0
          UNION ALL SELECT 'Đã duyệt', approved, 'hsl(var(--chart-2))' FROM repair_summary WHERE approved > 0
          UNION ALL SELECT 'Chờ xử lý', pending, 'hsl(var(--chart-3))' FROM repair_summary WHERE pending > 0
        ) statuses
      ),
      'maintenancePlanVsActual', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('name', loai_cong_viec, 'planned', total_planned, 'actual', total_actual) ORDER BY loai_cong_viec), '[]'::jsonb)
        FROM maintenance_aggregated
      ),
      'repairFrequencyByMonth', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('period', period, 'total', total, 'completed', completed) ORDER BY period), '[]'::jsonb)
        FROM repair_frequency
      ),
      'repairCostByMonth', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('period', period, 'totalCost', total_cost, 'averageCost', coalesce(average_cost, 0), 'costRecordedCount', cost_recorded_count, 'costMissingCount', cost_missing_count) ORDER BY period), '[]'::jsonb)
        FROM repair_cost_by_month
      ),
      'repairCostByFacility', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('facilityId', facility_id, 'facilityName', facility_name, 'totalCost', total_cost, 'averageCost', coalesce(average_cost, 0), 'costRecordedCount', cost_recorded_count, 'costMissingCount', cost_missing_count) ORDER BY facility_name), '[]'::jsonb)
        FROM repair_cost_by_facility
      )
    ),
    'topEquipmentRepairs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'equipmentId', te.equipment_id,
        'equipmentName', te.equipment_name,
        'totalRequests', te.total_requests,
        'latestStatus', coalesce(te.latest_status, 'Không xác định'),
        'latestCompletedDate', te.latest_completed_date,
        'totalRepairCost', te.total_repair_cost,
        'averageCompletedRepairCost', coalesce(te.average_completed_repair_cost, 0),
        'costRecordedCount', te.cost_recorded_count,
        'costMissingCount', te.cost_missing_count
      ) ORDER BY te.total_requests DESC, te.equipment_name), '[]'::jsonb)
      FROM top_equipment te
    ),
    'recentRepairHistory', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'equipmentName', rr.equipment_name,
        'issue', rr.issue,
        'status', rr.status,
        'repairCost', rr.chi_phi_sua_chua,
        'requestedDate', rr.requested_date,
        'completedDate', rr.completed_date
      ) ORDER BY rr.requested_date DESC, rr.id DESC), '[]'::jsonb)
      FROM recent_repairs rr
    )
  ) INTO v_result;

  RETURN coalesce(v_result, jsonb_build_object(
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
      'repairCostByFacility', '[]'::jsonb
    ),
    'topEquipmentRepairs', '[]'::jsonb,
    'recentRepairHistory', '[]'::jsonb
  ));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_report_data(date, date, bigint) FROM PUBLIC;

COMMENT ON FUNCTION public.get_maintenance_report_data(date, date, bigint)
IS 'Returns maintenance report data with tenant-aware aggregation, top equipment repairs, recent history, and repair cost statistics.';

CREATE OR REPLACE FUNCTION public.maintenance_stats_for_reports(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_don_vi bigint DEFAULT NULL,
  p_khoa_phong text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := nullif(public._get_jwt_claim('user_id'), '');
  v_is_global boolean := false;
  v_claim_donvi bigint := nullif(public._get_jwt_claim('don_vi'), '')::bigint;
  v_allowed bigint[];
  v_effective bigint[];
  v_from date := coalesce(p_date_from, current_date - interval '1 year');
  v_to date := coalesce(p_date_to, current_date);
  v_from_year integer := extract(year from v_from)::integer;
  v_to_year integer := extract(year from v_to)::integer;
  result jsonb;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      v_effective := ARRAY[]::bigint[];
    ELSIF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF v_claim_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
    END IF;
    IF p_don_vi IS NOT NULL AND p_don_vi <> v_claim_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;
    v_effective := ARRAY[v_claim_donvi];
  END IF;

  SELECT jsonb_build_object(
    'repair_summary', (
      SELECT jsonb_build_object(
        'total_requests', count(*),
        'completed', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
        ),
        'pending', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%chờ%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%cho%'
        ),
        'in_progress', count(*) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%đã duyệt%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%da duyet%'
        ),
        'total_cost', coalesce(sum(yc.chi_phi_sua_chua) FILTER (
          WHERE lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%'
        ), 0),
        'average_completed_cost', coalesce(avg(yc.chi_phi_sua_chua) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NOT NULL
        ), 0),
        'cost_recorded_count', count(*) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NOT NULL
        ),
        'cost_missing_count', count(*) FILTER (
          WHERE (lower(coalesce(yc.trang_thai, '')) LIKE '%hoàn thành%'
             OR lower(coalesce(yc.trang_thai, '')) LIKE '%hoan thanh%')
            AND yc.chi_phi_sua_chua IS NULL
        )
      )
      FROM public.yeu_cau_sua_chua yc
      LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
      WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) IS NOT NULL
        AND (coalesce(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN v_from AND v_to
    ),
    'maintenance_summary', (
      SELECT jsonb_build_object(
        'total_plans', count(DISTINCT kh.id),
        'total_tasks', count(cv.id),
        'completed_tasks', count(*) FILTER (
          WHERE
            coalesce(cv.thang_1_hoan_thanh,false) OR coalesce(cv.thang_2_hoan_thanh,false) OR
            coalesce(cv.thang_3_hoan_thanh,false) OR coalesce(cv.thang_4_hoan_thanh,false) OR
            coalesce(cv.thang_5_hoan_thanh,false) OR coalesce(cv.thang_6_hoan_thanh,false) OR
            coalesce(cv.thang_7_hoan_thanh,false) OR coalesce(cv.thang_8_hoan_thanh,false) OR
            coalesce(cv.thang_9_hoan_thanh,false) OR coalesce(cv.thang_10_hoan_thanh,false) OR
            coalesce(cv.thang_11_hoan_thanh,false) OR coalesce(cv.thang_12_hoan_thanh,false) OR
            cv.ngay_hoan_thanh_1 IS NOT NULL OR cv.ngay_hoan_thanh_2 IS NOT NULL OR
            cv.ngay_hoan_thanh_3 IS NOT NULL OR cv.ngay_hoan_thanh_4 IS NOT NULL OR
            cv.ngay_hoan_thanh_5 IS NOT NULL OR cv.ngay_hoan_thanh_6 IS NOT NULL OR
            cv.ngay_hoan_thanh_7 IS NOT NULL OR cv.ngay_hoan_thanh_8 IS NOT NULL OR
            cv.ngay_hoan_thanh_9 IS NOT NULL OR cv.ngay_hoan_thanh_10 IS NOT NULL OR
            cv.ngay_hoan_thanh_11 IS NOT NULL OR cv.ngay_hoan_thanh_12 IS NOT NULL
        )
      )
      FROM public.ke_hoach_bao_tri kh
      LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON cv.thiet_bi_id = tb.id
      WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND kh.nam BETWEEN v_from_year AND v_to_year
    )
  ) INTO result;

  RETURN coalesce(result, jsonb_build_object(
    'repair_summary', jsonb_build_object(
      'total_requests', 0,
      'completed', 0,
      'pending', 0,
      'in_progress', 0,
      'total_cost', 0,
      'average_completed_cost', 0,
      'cost_recorded_count', 0,
      'cost_missing_count', 0
    ),
    'maintenance_summary', jsonb_build_object(
      'total_plans', 0,
      'total_tasks', 0,
      'completed_tasks', 0
    )
  ));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.maintenance_stats_for_reports(date, date, bigint, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.maintenance_stats_for_reports(date, date, bigint, text) FROM PUBLIC;

COMMENT ON FUNCTION public.maintenance_stats_for_reports(date, date, bigint, text)
IS 'Returns maintenance and repair summary data with tenant-aware repair cost statistics for reports/export.';

COMMIT;
