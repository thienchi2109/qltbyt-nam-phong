-- Migration: Extend transfer_request_list for Kanban board support
-- Date: 2026-01-12
-- Purpose: Add kanban view mode with per-column pagination
-- Backward compatible: All new params have defaults

-- Strategy: Use LATERAL JOIN for "Top N per Group" (O(Groups * Limit) vs ROW_NUMBER O(N log N))
-- This avoids sorting ALL 10k+ rows just to get 30 items per status

-- NOTE: Existing indexes are sufficient for kanban queries:
--   - idx_transfers_kanban_facility_status_date (trang_thai, created_at DESC, id DESC)
--   - idx_yclc_thiet_bi_id (thiet_bi_id)
-- REMOVED per backend architect + Gemini review (2026-01-12):
--   - idx_transfer_kanban_by_status (redundant - covered by existing index)
--   - idx_transfer_thiet_bi_lookup (redundant - covered by idx_yclc_thiet_bi_id)

-- Index: Fast counting for hoan_thanh column (when shown)
-- Partial index only scans completed transfers, useful when hoan_thanh grows large
CREATE INDEX IF NOT EXISTS idx_transfer_completed_count
ON public.yeu_cau_luan_chuyen (trang_thai)
WHERE trang_thai = 'hoan_thanh';

COMMENT ON INDEX idx_transfer_completed_count IS 'Fast COUNT(*) for completed transfers without scanning active transfers';

-- Index: Optimize kanban ORDER BY pattern (status + created_at DESC)
-- Enables index-only scans for LATERAL LIMIT queries per status
CREATE INDEX IF NOT EXISTS idx_yclc_status_created_desc
ON public.yeu_cau_luan_chuyen (trang_thai, created_at DESC);

COMMENT ON INDEX idx_yclc_status_created_desc IS 'Optimize kanban per-column queries: ORDER BY created_at DESC with status filter';

-- Drop existing function to add new parameters
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[]);

-- Recreate with kanban parameters (backward compatible)
CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL,
  -- NEW KANBAN PARAMETERS
  p_view_mode TEXT DEFAULT 'table',          -- 'table' | 'kanban'
  p_per_column_limit INT DEFAULT 30,         -- Tasks per column (kanban only)
  p_exclude_completed BOOLEAN DEFAULT FALSE  -- Hide hoan_thanh (kanban only)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_kanban_result JSONB;
BEGIN
  -- Security: Validate p_view_mode to prevent injection
  IF p_view_mode NOT IN ('table', 'kanban') THEN
    RAISE EXCEPTION 'Invalid view_mode: must be ''table'' or ''kanban''';
  END IF;

  -- Security: Cap p_per_column_limit to prevent abuse (1-100 range)
  p_per_column_limit := LEAST(GREATEST(COALESCE(p_per_column_limit, 30), 1), 100);

  -- Tenant isolation (same as existing logic)
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      IF p_view_mode = 'kanban' THEN
        RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
      ELSE
        RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
      END IF;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        IF p_view_mode = 'kanban' THEN
          RETURN jsonb_build_object('columns', '{}'::jsonb, 'totalCount', 0);
        ELSE
          RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
        END IF;
      END IF;
    END IF;
  END IF;

  -- KANBAN MODE BRANCH
  IF p_view_mode = 'kanban' THEN
    -- Performance: Two-phase approach for optimal performance
    -- Phase 1: Efficient counts per status (single index scan per status)
    -- Phase 2: LATERAL with LIMIT for top N items (early termination, O(Groups * Limit))
    WITH active_statuses AS (
      -- Respect p_statuses filter if provided (intersection with base statuses)
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
    -- Phase 1: Get counts per status efficiently
    status_counts AS (
      SELECT
        yclc.trang_thai as status,
        COUNT(*) as total_count
      FROM public.yeu_cau_luan_chuyen yclc
      JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
      WHERE yclc.trang_thai = ANY(SELECT status FROM active_statuses)
        AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
        AND (
          (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
          (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
        )
        AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
        AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
        AND (
          p_q IS NULL OR p_q = '' OR
          yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
          yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
          tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
          tb.ma_thiet_bi ILIKE '%' || p_q || '%'
        )
        AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      GROUP BY yclc.trang_thai
    ),
    -- Phase 2: LATERAL with LIMIT for top N items per status (early termination)
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
            'thiet_bi', jsonb_build_object(
              'ten_thiet_bi', tb.ten_thiet_bi,
              'ma_thiet_bi', tb.ma_thiet_bi,
              'model', tb.model,
              'serial', tb.serial,
              'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
              'facility_name', dv.name,
              'facility_id', dv.id
            )
          ) as row_data,
          yclc.created_at
        FROM public.yeu_cau_luan_chuyen yclc
        JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
        LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
        WHERE yclc.trang_thai = s.status
          AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
          AND (
            (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
            (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
          )
          AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
          AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
          AND (
            p_q IS NULL OR p_q = '' OR
            yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
            yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
            tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
            tb.ma_thiet_bi ILIKE '%' || p_q || '%'
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

  -- TABLE MODE (existing logic - unchanged)
  SELECT count(*) INTO v_total
  FROM public.yeu_cau_luan_chuyen yclc
  JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
  AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
  AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
  AND (
    p_q IS NULL OR p_q = '' OR
    yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
    yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || p_q || '%'
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
      'thiet_bi', jsonb_build_object(
        'ten_thiet_bi', tb.ten_thiet_bi,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'facility_name', dv.name,
        'facility_id', dv.id
      )
    ) as row_data, yclc.created_at
    FROM public.yeu_cau_luan_chuyen yclc
    JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
      (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (
      p_q IS NULL OR p_q = '' OR
      yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
      yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
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
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list TO authenticated;

COMMENT ON FUNCTION public.transfer_request_list IS 'Unified transfer list function - supports both table (paginated) and kanban (per-column) views';
