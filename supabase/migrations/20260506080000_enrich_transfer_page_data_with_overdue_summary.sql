-- Issue #386: keep the Transfers overdue-return alert on the same
-- server-side filter/scope contract as transfer_request_page_data.
-- Local-only until applied through Supabase MCP.
-- Rollback pointer: restore the previous transfer_request_page_data body from
-- supabase/migrations/20260502040000_add_transfer_request_page_data_rpc.sql.
-- To restore the detached pending-returns RPC, use the body/grants from
-- supabase/migrations/2025-09-29/20250927_regional_leader_phase4.sql
-- or supabase/migrations/2025-09-15/20250915_transfers_rpcs_more.sql
-- in a new forward-only superseding migration.

CREATE OR REPLACE FUNCTION public.transfer_request_page_data(
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
  p_exclude_completed boolean DEFAULT false,
  p_include_counts boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id text := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_view_mode text := COALESCE(p_view_mode, 'table');
  v_is_global boolean := false;
  v_effective_donvi bigint := NULL;
  v_allowed bigint[] := NULL;
  v_has_scope boolean := true;
  v_sanitized_q text := NULL;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_list jsonb := NULL;
  v_kanban jsonb := NULL;
  v_counts_raw jsonb := NULL;
  v_counts jsonb := NULL;
  v_total_count bigint := 0;
  v_overdue_summary jsonb := jsonb_build_object(
    'total', 0,
    'overdue', 0,
    'due_today', 0,
    'due_soon', 0,
    'items', '[]'::jsonb
  );
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_view_mode NOT IN ('table', 'kanban') THEN
    RAISE EXCEPTION 'Invalid view mode: %', v_view_mode USING ERRCODE = '22023';
  END IF;

  p_per_column_limit := LEAST(GREATEST(COALESCE(p_per_column_limit, 30), 1), 100);
  v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      v_has_scope := false;
    ELSIF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        v_has_scope := false;
      END IF;
    END IF;
  END IF;

  IF p_include_counts THEN
    v_counts_raw := public.transfer_request_counts(
      p_q,
      p_don_vi,
      p_date_from,
      p_date_to,
      p_types,
      p_assignee_ids
    );

    v_total_count :=
      COALESCE((v_counts_raw->>'cho_duyet')::bigint, 0) +
      COALESCE((v_counts_raw->>'da_duyet')::bigint, 0) +
      COALESCE((v_counts_raw->>'dang_luan_chuyen')::bigint, 0) +
      COALESCE((v_counts_raw->>'da_ban_giao')::bigint, 0) +
      COALESCE((v_counts_raw->>'hoan_thanh')::bigint, 0);

    v_counts := jsonb_build_object(
      'totalCount', v_total_count,
      'columnCounts', jsonb_build_object(
        'cho_duyet', COALESCE((v_counts_raw->>'cho_duyet')::integer, 0),
        'da_duyet', COALESCE((v_counts_raw->>'da_duyet')::integer, 0),
        'dang_luan_chuyen', COALESCE((v_counts_raw->>'dang_luan_chuyen')::integer, 0),
        'da_ban_giao', COALESCE((v_counts_raw->>'da_ban_giao')::integer, 0),
        'hoan_thanh', COALESCE((v_counts_raw->>'hoan_thanh')::integer, 0)
      )
    );
  END IF;

  IF v_has_scope THEN
    WITH filtered AS (
      SELECT
        yclc.id,
        yclc.ma_yeu_cau,
        yclc.thiet_bi_id,
        yclc.loai_hinh,
        yclc.trang_thai,
        yclc.nguoi_yeu_cau_id,
        yclc.ly_do_luan_chuyen,
        yclc.khoa_phong_hien_tai,
        yclc.khoa_phong_nhan,
        yclc.muc_dich,
        yclc.don_vi_nhan,
        yclc.dia_chi_don_vi,
        yclc.nguoi_lien_he,
        yclc.so_dien_thoai,
        yclc.ngay_du_kien_tra,
        yclc.ngay_ban_giao,
        yclc.ngay_hoan_tra,
        yclc.ngay_hoan_thanh,
        yclc.nguoi_duyet_id,
        yclc.ngay_duyet,
        yclc.ghi_chu_duyet,
        yclc.created_at,
        yclc.updated_at,
        yclc.created_by,
        yclc.updated_by,
        tb.ten_thiet_bi,
        tb.ma_thiet_bi,
        tb.model,
        tb.serial,
        tb.khoa_phong_quan_ly,
        tb.is_deleted,
        dv.name AS facility_name,
        dv.id AS facility_id
      FROM public.yeu_cau_luan_chuyen yclc
      LEFT JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
      LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
      WHERE (
        (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
        (
          NOT v_is_global
          AND (
            (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR
            (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
          )
        )
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
    ),
    due_items AS (
      SELECT
        *,
        ((ngay_du_kien_tra AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - v_today) AS days_difference
      FROM filtered
      WHERE loai_hinh = 'ben_ngoai'
        AND trang_thai IN ('da_ban_giao', 'dang_luan_chuyen')
        AND ngay_du_kien_tra IS NOT NULL
        AND (ngay_du_kien_tra AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= v_today + 7
    ),
    due_aggregated AS (
      SELECT
        count(*) AS total_count,
        count(*) FILTER (WHERE days_difference < 0) AS overdue_count,
        count(*) FILTER (WHERE days_difference = 0) AS due_today_count,
        count(*) FILTER (WHERE days_difference BETWEEN 1 AND 7) AS due_soon_count
      FROM due_items
    ),
    ranked_items AS (
      SELECT *
      FROM due_items
      ORDER BY (ngay_du_kien_tra AT TIME ZONE 'Asia/Ho_Chi_Minh')::date ASC, id ASC
      LIMIT 50
    )
    SELECT jsonb_build_object(
      'total', COALESCE(due_aggregated.total_count, 0),
      'overdue', COALESCE(due_aggregated.overdue_count, 0),
      'due_today', COALESCE(due_aggregated.due_today_count, 0),
      'due_soon', COALESCE(due_aggregated.due_soon_count, 0),
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'ma_yeu_cau', ma_yeu_cau,
            'thiet_bi_id', thiet_bi_id,
            'loai_hinh', loai_hinh,
            'trang_thai', trang_thai,
            'nguoi_yeu_cau_id', nguoi_yeu_cau_id,
            'ly_do_luan_chuyen', ly_do_luan_chuyen,
            'khoa_phong_hien_tai', khoa_phong_hien_tai,
            'khoa_phong_nhan', khoa_phong_nhan,
            'muc_dich', muc_dich,
            'don_vi_nhan', don_vi_nhan,
            'dia_chi_don_vi', dia_chi_don_vi,
            'nguoi_lien_he', nguoi_lien_he,
            'so_dien_thoai', so_dien_thoai,
            'ngay_du_kien_tra', ngay_du_kien_tra,
            'ngay_ban_giao', ngay_ban_giao,
            'ngay_hoan_tra', ngay_hoan_tra,
            'ngay_hoan_thanh', ngay_hoan_thanh,
            'nguoi_duyet_id', nguoi_duyet_id,
            'ngay_duyet', ngay_duyet,
            'ghi_chu_duyet', ghi_chu_duyet,
            'created_at', created_at,
            'updated_at', updated_at,
            'created_by', created_by,
            'updated_by', updated_by,
            'equipment_is_deleted', is_deleted,
            'days_difference', days_difference,
            'thiet_bi', jsonb_build_object(
              'ten_thiet_bi', ten_thiet_bi,
              'ma_thiet_bi', ma_thiet_bi,
              'model', model,
              'serial', serial,
              'khoa_phong_quan_ly', khoa_phong_quan_ly,
              'facility_name', facility_name,
              'facility_id', facility_id,
              'is_deleted', is_deleted
            )
          )
          ORDER BY (ngay_du_kien_tra AT TIME ZONE 'Asia/Ho_Chi_Minh')::date ASC, id ASC
        )
        FROM ranked_items
      ), '[]'::jsonb)
    )
    INTO v_overdue_summary
    FROM due_aggregated;
  END IF;

  IF v_view_mode = 'kanban' THEN
    v_kanban := public.transfer_request_list(
      p_q,
      NULL,
      p_types,
      p_page,
      p_page_size,
      p_don_vi,
      p_date_from,
      p_date_to,
      p_assignee_ids,
      'kanban',
      p_per_column_limit,
      p_exclude_completed
    );
  ELSE
    v_list := public.transfer_request_list(
      p_q,
      p_statuses,
      p_types,
      p_page,
      p_page_size,
      p_don_vi,
      p_date_from,
      p_date_to,
      p_assignee_ids,
      'table',
      p_per_column_limit,
      p_exclude_completed
    );
  END IF;

  RETURN jsonb_build_object(
    'viewMode', v_view_mode,
    'list', v_list,
    'counts', v_counts,
    'kanban', v_kanban,
    'overdue_summary', v_overdue_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_page_data(
  text,
  text[],
  text[],
  integer,
  integer,
  bigint,
  date,
  date,
  bigint[],
  text,
  integer,
  boolean,
  boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.transfer_request_page_data(
  text,
  text[],
  text[],
  integer,
  integer,
  bigint,
  date,
  date,
  bigint[],
  text,
  integer,
  boolean,
  boolean
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.transfer_request_external_pending_returns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transfer_request_external_pending_returns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.transfer_request_external_pending_returns() FROM authenticated;
