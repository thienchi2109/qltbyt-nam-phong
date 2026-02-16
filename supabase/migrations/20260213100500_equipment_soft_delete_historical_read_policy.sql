-- Migration: Historical read policy for soft-deleted equipment
-- Date: 2026-02-13
-- Scope: Task 5
--
-- Policy matrix:
-- - Active-only surfaces: must filter thiet_bi.is_deleted = false
-- - Historical surfaces: must NOT filter out soft-deleted equipment
--
-- Historical surfaces covered in this migration:
-- - equipment_history_list
-- - repair_request_list
-- - transfer_request_list
-- - transfer_request_list_enhanced
-- - usage_log_list (all overloads)
--
-- Stability requirements:
-- - Preserve historical records when related equipment is soft-deleted
-- - Keep tenant isolation
-- - Expose equipment_is_deleted metadata where payload includes equipment object

BEGIN;

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
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_statuses TEXT[] := NULL;
BEGIN
  v_is_global := v_role IN ('global', 'admin');

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
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
    END IF;
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
      END IF;
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.yeu_cau_sua_chua r
  LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (v_statuses IS NULL OR r.trang_thai = ANY(v_statuses))
  AND (
    p_q IS NULL OR p_q = '' OR
    r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
    r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || p_q || '%'
  )
  AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY ngay_yeu_cau DESC), '[]'::jsonb) INTO v_data
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
      p_q IS NULL OR p_q = '' OR
      r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
    AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subq;

  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q text DEFAULT NULL::text,
  p_statuses text[] DEFAULT NULL::text[],
  p_types text[] DEFAULT NULL::text[],
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_assignee_ids bigint[] DEFAULT NULL::bigint[],
  p_view_mode text DEFAULT 'table'::text,
  p_per_column_limit integer DEFAULT 30,
  p_exclude_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_kanban_result JSONB;
  v_max_array_size INT := 100;
  v_sanitized_q TEXT;
BEGIN
  v_is_global := v_role IN ('global', 'admin');

  IF p_view_mode NOT IN ('table', 'kanban') THEN
    RAISE EXCEPTION 'Invalid view_mode: must be ''table'' or ''kanban''';
  END IF;

  p_per_column_limit := LEAST(GREATEST(COALESCE(p_per_column_limit, 30), 1), 100);

  IF p_types IS NOT NULL AND array_length(p_types, 1) > v_max_array_size THEN
    RAISE EXCEPTION 'p_types array exceeds maximum size of %', v_max_array_size;
  END IF;
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > v_max_array_size THEN
    RAISE EXCEPTION 'p_assignee_ids array exceeds maximum size of %', v_max_array_size;
  END IF;
  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) > v_max_array_size THEN
    RAISE EXCEPTION 'p_statuses array exceeds maximum size of %', v_max_array_size;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      IF p_view_mode = 'kanban' THEN
        RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
      ELSE
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
      END IF;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        IF p_view_mode = 'kanban' THEN
          RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
        ELSE
          RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
        END IF;
      END IF;
    END IF;
  END IF;

  IF p_view_mode = 'kanban' THEN
    WITH active_statuses AS (
      SELECT status FROM (
        SELECT unnest(
          CASE
            WHEN p_exclude_completed THEN ARRAY['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao']::TEXT[]
            ELSE ARRAY['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh']::TEXT[]
          END
        ) AS status
      ) base
      WHERE p_statuses IS NULL OR status = ANY(p_statuses)
    ),
    status_counts AS (
      SELECT
        yclc.trang_thai as status,
        COUNT(*) as total_count
      FROM public.yeu_cau_luan_chuyen yclc
      LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
      WHERE yclc.trang_thai = ANY(SELECT status FROM active_statuses)
        AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
        AND (
          (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
          (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
        )
        AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
        AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
        AND (
          v_sanitized_q IS NULL OR
          yclc.ma_yeu_cau ILIKE '%' || v_sanitized_q || '%' OR
          yclc.ly_do_luan_chuyen ILIKE '%' || v_sanitized_q || '%' OR
          tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
          tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        )
        AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      GROUP BY yclc.trang_thai
    ),
    status_groups AS (
      SELECT
        s.status,
        COALESCE(sc.total_count, 0) as total_count,
        COALESCE(jsonb_agg(lateral_data.row_data ORDER BY lateral_data.created_at DESC) FILTER (WHERE lateral_data.row_data IS NOT NULL), '[]'::jsonb) as tasks
      FROM active_statuses s
      LEFT JOIN status_counts sc ON sc.status = s.status
      LEFT JOIN LATERAL (
        SELECT
          jsonb_build_object(
            'id', yclc.id,
            'ma_yeu_cau', yclc.ma_yeu_cau,
            'thiet_bi_id', yclc.thiet_bi_id,
            'loai_hinh', yclc.loai_hinh,
            'trang_thai', yclc.trang_thai,
            'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
            'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
            'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
            'khoa_phong_nhan', yclc.khoa_phong_nhan,
            'muc_dich', yclc.muc_dich,
            'don_vi_nhan', yclc.don_vi_nhan,
            'dia_chi_don_vi', yclc.dia_chi_don_vi,
            'nguoi_lien_he', yclc.nguoi_lien_he,
            'so_dien_thoai', yclc.so_dien_thoai,
            'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
            'ngay_ban_giao', yclc.ngay_ban_giao,
            'ngay_hoan_tra', yclc.ngay_hoan_tra,
            'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
            'nguoi_duyet_id', yclc.nguoi_duyet_id,
            'ngay_duyet', yclc.ngay_duyet,
            'ghi_chu_duyet', yclc.ghi_chu_duyet,
            'created_at', yclc.created_at,
            'updated_at', yclc.updated_at,
            'created_by', yclc.created_by,
            'updated_by', yclc.updated_by,
            'equipment_is_deleted', tb.is_deleted,
            'thiet_bi', jsonb_build_object(
              'ten_thiet_bi', tb.ten_thiet_bi,
              'ma_thiet_bi', tb.ma_thiet_bi,
              'model', tb.model,
              'serial', tb.serial,
              'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
              'facility_name', dv.name,
              'facility_id', dv.id,
              'is_deleted', tb.is_deleted
            )
          ) AS row_data,
          yclc.created_at
        FROM public.yeu_cau_luan_chuyen yclc
        LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
        LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
        WHERE yclc.trang_thai = s.status
          AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
          AND (
            (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
            (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
          )
          AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
          AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
          AND (
            v_sanitized_q IS NULL OR
            yclc.ma_yeu_cau ILIKE '%' || v_sanitized_q || '%' OR
            yclc.ly_do_luan_chuyen ILIKE '%' || v_sanitized_q || '%' OR
            tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
            tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
          )
          AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
          AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        ORDER BY yclc.created_at DESC
        LIMIT p_per_column_limit
      ) lateral_data ON true
      GROUP BY s.status, sc.total_count
    )
    SELECT jsonb_build_object(
      'columns', COALESCE(jsonb_object_agg(status, jsonb_build_object(
        'tasks', COALESCE(tasks, '[]'::jsonb),
        'total', total_count,
        'hasMore', total_count > p_per_column_limit
      )), '{}'::jsonb),
      'totalCount', (SELECT COALESCE(SUM(total_count), 0) FROM status_groups)
    ) INTO v_kanban_result
    FROM status_groups;

    RETURN v_kanban_result;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.yeu_cau_luan_chuyen yclc
  LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
  AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
  AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
  AND (
    v_sanitized_q IS NULL OR
    yclc.ma_yeu_cau ILIKE '%' || v_sanitized_q || '%' OR
    yclc.ly_do_luan_chuyen ILIKE '%' || v_sanitized_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
  )
  AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT jsonb_build_object(
      'id', yclc.id,
      'ma_yeu_cau', yclc.ma_yeu_cau,
      'thiet_bi_id', yclc.thiet_bi_id,
      'loai_hinh', yclc.loai_hinh,
      'trang_thai', yclc.trang_thai,
      'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
      'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
      'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
      'khoa_phong_nhan', yclc.khoa_phong_nhan,
      'muc_dich', yclc.muc_dich,
      'don_vi_nhan', yclc.don_vi_nhan,
      'dia_chi_don_vi', yclc.dia_chi_don_vi,
      'nguoi_lien_he', yclc.nguoi_lien_he,
      'so_dien_thoai', yclc.so_dien_thoai,
      'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
      'ngay_ban_giao', yclc.ngay_ban_giao,
      'ngay_hoan_tra', yclc.ngay_hoan_tra,
      'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
      'nguoi_duyet_id', yclc.nguoi_duyet_id,
      'ngay_duyet', yclc.ngay_duyet,
      'ghi_chu_duyet', yclc.ghi_chu_duyet,
      'created_at', yclc.created_at,
      'updated_at', yclc.updated_at,
      'created_by', yclc.created_by,
      'updated_by', yclc.updated_by,
      'equipment_is_deleted', tb.is_deleted,
      'thiet_bi', jsonb_build_object(
        'ten_thiet_bi', tb.ten_thiet_bi,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'facility_name', dv.name,
        'facility_id', dv.id,
        'is_deleted', tb.is_deleted
      )
    ) AS row_data,
    yclc.created_at
    FROM public.yeu_cau_luan_chuyen yclc
    LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
      (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (
      v_sanitized_q IS NULL OR
      yclc.ma_yeu_cau ILIKE '%' || v_sanitized_q || '%' OR
      yclc.ly_do_luan_chuyen ILIKE '%' || v_sanitized_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
    )
    AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY yclc.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) subquery;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_offset INT;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global := v_role IN ('global', 'admin');
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT
      yc.*,
      tb.is_deleted AS equipment_is_deleted,
      jsonb_build_object(
        'id', tb.id,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'ten_thiet_bi', tb.ten_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'don_vi', tb.don_vi,
        'is_deleted', tb.is_deleted
      ) AS thiet_bi
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_status IS NULL OR yc.trang_thai = p_status)
      AND (p_date_from IS NULL OR yc.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR yc.created_at::date <= p_date_to)
      AND (
        p_q IS NULL OR (
          yc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
          yc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
          tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
          tb.ma_thiet_bi ILIKE '%' || p_q || '%'
        )
      )
    ORDER BY yc.created_at DESC
    OFFSET v_offset LIMIT p_page_size
  ) row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_thiet_bi_id bigint DEFAULT NULL::bigint,
  p_trang_thai text DEFAULT NULL::text,
  p_active_only boolean DEFAULT false,
  p_started_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_started_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_limit INT := GREATEST(p_limit, 1);
  v_offset INT := GREATEST(p_offset, 0);
BEGIN
  v_is_global := v_role IN ('global', 'admin');

  PERFORM set_config('search_path', 'public', true);

  IF p_trang_thai IS NOT NULL AND p_trang_thai NOT IN ('dang_su_dung', 'hoan_thanh') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = '22023';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', nk.id,
    'thiet_bi_id', nk.thiet_bi_id,
    'nguoi_su_dung_id', nk.nguoi_su_dung_id,
    'thoi_gian_bat_dau', nk.thoi_gian_bat_dau,
    'thoi_gian_ket_thuc', nk.thoi_gian_ket_thuc,
    'tinh_trang_thiet_bi', nk.tinh_trang_thiet_bi,
    'ghi_chu', nk.ghi_chu,
    'trang_thai', nk.trang_thai,
    'created_at', nk.created_at,
    'updated_at', nk.updated_at,
    'equipment_is_deleted', tb.is_deleted,
    'thiet_bi', jsonb_build_object(
      'id', tb.id,
      'ma_thiet_bi', tb.ma_thiet_bi,
      'ten_thiet_bi', tb.ten_thiet_bi,
      'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
      'don_vi', tb.don_vi,
      'is_deleted', tb.is_deleted
    ),
    'nguoi_su_dung', CASE
      WHEN nv.id IS NOT NULL THEN jsonb_build_object(
        'id', nv.id,
        'full_name', nv.full_name,
        'khoa_phong', nv.khoa_phong
      )
      ELSE NULL
    END
  )
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON tb.id = nk.thiet_bi_id
  LEFT JOIN public.nhan_vien nv ON nv.id = nk.nguoi_su_dung_id
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_thiet_bi_id IS NULL OR nk.thiet_bi_id = p_thiet_bi_id)
    AND (NOT p_active_only OR nk.trang_thai = 'dang_su_dung')
    AND (p_trang_thai IS NULL OR nk.trang_thai = p_trang_thai)
    AND (p_started_from IS NULL OR nk.thoi_gian_bat_dau >= p_started_from)
    AND (p_started_to IS NULL OR nk.thoi_gian_bat_dau <= p_started_to)
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
BEGIN
  v_is_global := v_role IN ('global', 'admin');

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(nk)
    || jsonb_build_object(
      'thiet_bi', to_jsonb(tb),
      'equipment_is_deleted', tb.is_deleted
    )
    || jsonb_build_object('nguoi_su_dung', to_jsonb(u))
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  LEFT JOIN public.nhan_vien u ON nk.nguoi_su_dung_id = u.id
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_status IS NULL OR nk.trang_thai = p_status)
    AND (p_date_from IS NULL OR nk.thoi_gian_bat_dau::date >= p_date_from)
    AND (p_date_to IS NULL OR nk.thoi_gian_bat_dau::date <= p_date_to)
    AND (
      p_q IS NULL OR p_q = '' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT p_page_size;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_history_list(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[], TEXT, INT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_log_list(BIGINT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_log_list(TEXT, TEXT, INT, INT, DATE, DATE, BIGINT) TO authenticated;

COMMIT;
