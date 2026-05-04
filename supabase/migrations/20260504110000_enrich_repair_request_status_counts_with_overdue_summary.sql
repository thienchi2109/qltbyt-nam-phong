-- Issue #384: enrich repair_request_status_counts so the repair-request page
-- can fetch KPI counts and overdue-alert summary in one page-independent RPC.
-- Forward-only note: this supersedes the earlier function body in
-- `supabase/migrations/2025-10-25/20251025_status_filter_and_counts_rpc.sql`.
-- If rollback is needed, add a new migration restoring that contract instead
-- of editing migration history.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_status_counts(
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date
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
  v_sanitized_q text := NULL;
  v_department_scope text := NULL;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN jsonb_build_object(
        'counts', jsonb_build_object(
          'Chờ xử lý', 0,
          'Đã duyệt', 0,
          'Hoàn thành', 0,
          'Không HT', 0
        ),
        'overdue_summary', jsonb_build_object(
          'total', 0,
          'overdue', 0,
          'due_today', 0,
          'due_soon', 0,
          'items', '[]'::jsonb
        )
      );
    END IF;
  END IF;

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'counts', jsonb_build_object(
          'Chờ xử lý', 0,
          'Đã duyệt', 0,
          'Hoàn thành', 0,
          'Không HT', 0
        ),
        'overdue_summary', jsonb_build_object(
          'total', 0,
          'overdue', 0,
          'due_today', 0,
          'due_soon', 0,
          'items', '[]'::jsonb
        )
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RETURN jsonb_build_object(
          'counts', jsonb_build_object(
            'Chờ xử lý', 0,
            'Đã duyệt', 0,
            'Hoàn thành', 0,
            'Không HT', 0
          ),
          'overdue_summary', jsonb_build_object(
            'total', 0,
            'overdue', 0,
            'due_today', 0,
            'due_soon', 0,
            'items', '[]'::jsonb
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN (
    WITH filtered AS (
      SELECT
        r.id,
        r.thiet_bi_id,
        r.ngay_yeu_cau,
        r.trang_thai,
        r.mo_ta_su_co,
        r.hang_muc_sua_chua,
        r.ngay_mong_muon_hoan_thanh,
        r.nguoi_yeu_cau,
        r.ngay_duyet,
        r.ngay_hoan_thanh,
        r.nguoi_duyet,
        r.nguoi_xac_nhan,
        r.don_vi_thuc_hien,
        r.ten_don_vi_thue,
        r.ket_qua_sua_chua,
        r.ly_do_khong_hoan_thanh,
        r.chi_phi_sua_chua,
        tb.ten_thiet_bi,
        tb.ma_thiet_bi,
        tb.model,
        tb.serial,
        tb.khoa_phong_quan_ly,
        tb.don_vi AS facility_id,
        dv.name AS facility_name
      FROM public.yeu_cau_sua_chua r
      LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
      LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
      WHERE (
        (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi))
        OR (
          NOT v_is_global
          AND (
            (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi)
            OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
          )
        )
      )
      AND (
        v_role <> 'user'
        OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
      )
      AND (
        v_sanitized_q IS NULL
        OR r.mo_ta_su_co ILIKE '%' || v_sanitized_q || '%'
        OR r.hang_muc_sua_chua ILIKE '%' || v_sanitized_q || '%'
        OR tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        OR tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
      )
      AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ),
    due_items AS (
      SELECT
        *,
        (ngay_mong_muon_hoan_thanh - v_today) AS days_difference
      FROM filtered
      WHERE trang_thai IN ('Chờ xử lý', 'Đã duyệt')
        AND ngay_mong_muon_hoan_thanh IS NOT NULL
        AND ngay_mong_muon_hoan_thanh <= v_today + 7
    ),
    ranked_items AS (
      SELECT *
      FROM due_items
      ORDER BY ngay_mong_muon_hoan_thanh ASC, id ASC
      LIMIT 50
    )
    SELECT jsonb_build_object(
      'counts', jsonb_build_object(
        'Chờ xử lý', COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Chờ xử lý'), 0),
        'Đã duyệt', COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Đã duyệt'), 0),
        'Hoàn thành', COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Hoàn thành'), 0),
        'Không HT', COALESCE((SELECT count(*) FROM filtered WHERE trang_thai = 'Không HT'), 0)
      ),
      'overdue_summary', jsonb_build_object(
        'total', COALESCE((SELECT count(*) FROM due_items), 0),
        'overdue', COALESCE((SELECT count(*) FROM due_items WHERE days_difference < 0), 0),
        'due_today', COALESCE((SELECT count(*) FROM due_items WHERE days_difference = 0), 0),
        'due_soon', COALESCE((SELECT count(*) FROM due_items WHERE days_difference BETWEEN 1 AND 7), 0),
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'thiet_bi_id', thiet_bi_id,
              'ngay_yeu_cau', ngay_yeu_cau,
              'trang_thai', trang_thai,
              'mo_ta_su_co', mo_ta_su_co,
              'hang_muc_sua_chua', hang_muc_sua_chua,
              'ngay_mong_muon_hoan_thanh', ngay_mong_muon_hoan_thanh,
              'nguoi_yeu_cau', nguoi_yeu_cau,
              'ngay_duyet', ngay_duyet,
              'ngay_hoan_thanh', ngay_hoan_thanh,
              'nguoi_duyet', nguoi_duyet,
              'nguoi_xac_nhan', nguoi_xac_nhan,
              'don_vi_thuc_hien', don_vi_thuc_hien,
              'ten_don_vi_thue', ten_don_vi_thue,
              'ket_qua_sua_chua', ket_qua_sua_chua,
              'ly_do_khong_hoan_thanh', ly_do_khong_hoan_thanh,
              'chi_phi_sua_chua', chi_phi_sua_chua,
              'days_difference', days_difference,
              'thiet_bi', jsonb_build_object(
                'ten_thiet_bi', ten_thiet_bi,
                'ma_thiet_bi', ma_thiet_bi,
                'model', model,
                'serial', serial,
                'khoa_phong_quan_ly', khoa_phong_quan_ly,
                'facility_name', facility_name,
                'facility_id', facility_id
              )
            )
            ORDER BY ngay_mong_muon_hoan_thanh ASC, id ASC
          )
          FROM ranked_items
        ), '[]'::jsonb)
      )
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_status_counts(text, bigint, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_status_counts(text, bigint, date, date) FROM PUBLIC;

COMMIT;
