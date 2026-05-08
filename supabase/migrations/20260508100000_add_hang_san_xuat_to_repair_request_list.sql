-- Issue #419: expose equipment manufacturer in repair_request_list so the
-- repair-request print sheet can render "Hãng sản xuất" from the list row.
-- Forward-only note: this preserves the latest read-scope contract from
-- 20260428132000_fix_repair_request_read_scope.sql and only adds one nested
-- thiet_bi JSON field.

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
  v_department_scope text := NULL;
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
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', v_page, 'pageSize', v_limit);
    END IF;
  END IF;

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
  AND (
    v_role <> 'user'
    OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
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
          'hang_san_xuat', tb.hang_san_xuat,
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
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
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

COMMIT;
