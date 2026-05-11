-- Keep department filter options independent from the selected department.

CREATE OR REPLACE FUNCTION public.unused_equipment_report_for_reports(
  p_don_vi bigint DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_khoa_phong text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort text DEFAULT 'ten_thiet_bi.asc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_claim_don_vi bigint;
  v_allowed bigint[];
  v_effective_don_vi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_order_sql text;
  v_limit integer;
  v_offset integer;
  v_sanitized_q text;
  v_pattern text;
  v_summary jsonb;
  v_top_device_groups jsonb;
  v_departments jsonb;
  v_department_options jsonb;
  v_items jsonb;
  v_total_count integer;
BEGIN
  v_role := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id := nullif(public._get_jwt_claim('user_id'), '');
  v_claim_don_vi := nullif(public._get_jwt_claim('don_vi'), '')::bigint;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING errcode = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Facility selection is required' USING errcode = '42501';
    END IF;
    v_effective_don_vi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF p_don_vi IS NULL THEN
      RAISE EXCEPTION 'Facility selection is required' USING errcode = '42501';
    END IF;

    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL OR NOT p_don_vi = ANY(v_allowed) THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;

    v_effective_don_vi := p_don_vi;
  ELSE
    IF v_claim_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING errcode = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi <> v_claim_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING errcode = '42501';
    END IF;

    v_effective_don_vi := v_claim_don_vi;
  END IF;

  v_sort_col := lower(split_part(coalesce(p_sort, 'ten_thiet_bi.asc'), '.', 1));
  v_sort_dir := CASE lower(split_part(coalesce(p_sort, 'ten_thiet_bi.asc'), '.', 2))
    WHEN 'desc' THEN 'DESC'
    ELSE 'ASC'
  END;

  IF v_sort_col NOT IN ('id', 'ma_thiet_bi', 'ten_thiet_bi', 'khoa_phong_quan_ly', 'ngay_nhap', 'gia_goc', 'created_at') THEN
    v_sort_col := 'ten_thiet_bi';
  END IF;

  v_order_sql := format('%I %s, id ASC', v_sort_col, v_sort_dir);
  v_limit := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 100);
  v_offset := GREATEST(coalesce(p_page, 1) - 1, 0) * v_limit;
  v_sanitized_q := public._sanitize_ilike_pattern(lower(trim(coalesce(p_q, ''))));
  v_pattern := CASE WHEN v_sanitized_q IS NULL THEN NULL ELSE '%' || v_sanitized_q || '%' END;

  WITH base_filtered AS MATERIALIZED (
    SELECT
      tb.id,
      tb.ma_thiet_bi,
      tb.ten_thiet_bi,
      tb.model,
      tb.serial,
      tb.khoa_phong_quan_ly,
      tb.ngay_nhap,
      tb.created_at,
      tb.gia_goc,
      tb.don_vi
    FROM public.thiet_bi tb
    WHERE coalesce(tb.is_deleted, false) = false
      AND tb.don_vi = v_effective_don_vi
      AND tb.tinh_trang_hien_tai = 'Chưa có nhu cầu sử dụng'
      AND (
        v_pattern IS NULL
        OR lower(coalesce(tb.ten_thiet_bi, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.ma_thiet_bi, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.model, '')) ILIKE v_pattern ESCAPE '\'
        OR lower(coalesce(tb.serial, '')) ILIKE v_pattern ESCAPE '\'
      )
  ),
  filtered AS MATERIALIZED (
    SELECT *
    FROM base_filtered
    WHERE p_khoa_phong IS NULL
      OR p_khoa_phong = ''
      OR (p_khoa_phong = 'Không xác định' AND nullif(trim(khoa_phong_quan_ly), '') IS NULL)
      OR khoa_phong_quan_ly = p_khoa_phong
  ),
  summary_data AS (
    SELECT
      count(*)::int AS total_count,
      count(DISTINCT nullif(trim(ten_thiet_bi), ''))::int AS device_type_count,
      count(DISTINCT nullif(trim(khoa_phong_quan_ly), ''))::int AS department_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
  ),
  top_device_groups AS (
    SELECT
      coalesce(nullif(trim(ten_thiet_bi), ''), 'Không xác định') AS device_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
    GROUP BY coalesce(nullif(trim(ten_thiet_bi), ''), 'Không xác định')
    ORDER BY equipment_count DESC, device_name ASC
    LIMIT 10
  ),
  top_departments AS (
    SELECT
      coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định') AS department_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM filtered
    GROUP BY coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định')
    ORDER BY equipment_count DESC, department_name ASC
    LIMIT 10
  ),
  department_options AS (
    SELECT
      coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định') AS department_name,
      count(*)::int AS equipment_count,
      coalesce(sum(gia_goc), 0)::numeric AS total_original_value
    FROM base_filtered
    GROUP BY coalesce(nullif(trim(khoa_phong_quan_ly), ''), 'Không xác định')
    ORDER BY department_name ASC
  )
  SELECT
    jsonb_build_object(
      'totalCount', s.total_count,
      'deviceTypeCount', s.device_type_count,
      'departmentCount', s.department_count,
      'totalOriginalValue', s.total_original_value
    ),
    s.total_count,
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'deviceName', device_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY equipment_count DESC, device_name ASC
        )
        FROM top_device_groups
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'departmentName', department_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY equipment_count DESC, department_name ASC
        )
        FROM top_departments
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'departmentName', department_name,
            'equipmentCount', equipment_count,
            'totalOriginalValue', total_original_value
          )
          ORDER BY department_name ASC
        )
        FROM department_options
      ),
      '[]'::jsonb
    )
  INTO v_summary, v_total_count, v_top_device_groups, v_departments, v_department_options
  FROM summary_data s;

  EXECUTE format(
    $sql$
      WITH filtered AS (
        SELECT
          tb.id,
          tb.ma_thiet_bi,
          tb.ten_thiet_bi,
          tb.model,
          tb.serial,
          tb.khoa_phong_quan_ly,
          tb.ngay_nhap,
          tb.created_at,
          tb.gia_goc,
          tb.don_vi
        FROM public.thiet_bi tb
        WHERE coalesce(tb.is_deleted, false) = false
          AND tb.don_vi = $1
          AND tb.tinh_trang_hien_tai = 'Chưa có nhu cầu sử dụng'
          AND (
            $2::text IS NULL
            OR $2 = ''
            OR ($2 = 'Không xác định' AND nullif(trim(tb.khoa_phong_quan_ly), '') IS NULL)
            OR tb.khoa_phong_quan_ly = $2
          )
          AND (
            $3::text IS NULL
            OR lower(coalesce(tb.ten_thiet_bi, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.ma_thiet_bi, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.model, '')) ILIKE $3 ESCAPE '\'
            OR lower(coalesce(tb.serial, '')) ILIKE $3 ESCAPE '\'
          )
      ),
      paged AS (
        SELECT *
        FROM filtered
        ORDER BY %s
        OFFSET $4 LIMIT $5
      )
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'maThietBi', ma_thiet_bi,
            'tenThietBi', ten_thiet_bi,
            'model', model,
            'serial', serial,
            'khoaPhongQuanLy', khoa_phong_quan_ly,
            'ngayNhap', ngay_nhap,
            'createdAt', created_at,
            'giaGoc', gia_goc,
            'donVi', don_vi
          )
        ),
        '[]'::jsonb
      )
      FROM paged
    $sql$,
    v_order_sql
  )
  INTO v_items
  USING v_effective_don_vi, p_khoa_phong, v_pattern, v_offset, v_limit;

  RETURN jsonb_build_object(
    'summary', coalesce(v_summary, jsonb_build_object(
      'totalCount', 0,
      'deviceTypeCount', 0,
      'departmentCount', 0,
      'totalOriginalValue', 0
    )),
    'topDeviceGroups', coalesce(v_top_device_groups, '[]'::jsonb),
    'departments', coalesce(v_departments, '[]'::jsonb),
    'departmentOptions', coalesce(v_department_options, '[]'::jsonb),
    'items', coalesce(v_items, '[]'::jsonb),
    'totalCount', coalesce(v_total_count, 0),
    'page', GREATEST(coalesce(p_page, 1), 1),
    'pageSize', v_limit
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.unused_equipment_report_for_reports(
  bigint,
  text,
  text,
  integer,
  integer,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unused_equipment_report_for_reports(
  bigint,
  text,
  text,
  integer,
  integer,
  text
) TO authenticated;
