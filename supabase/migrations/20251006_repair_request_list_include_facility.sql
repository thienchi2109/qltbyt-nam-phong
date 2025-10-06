-- Add facility information to repair_request_list RPC
-- This allows regional leaders to filter by facility name on the client side
DROP FUNCTION repair_request_list(text,text,integer,integer);
CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_result JSONB;
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN '[]'::jsonb;
    END IF;
  END IF;

  SELECT jsonb_agg(row_data ORDER BY (row_data->>'ngay_yeu_cau')::timestamptz DESC) INTO v_result
  FROM (
    SELECT jsonb_build_object(
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
      'thiet_bi', jsonb_build_object(
        'ten_thiet_bi', tb.ten_thiet_bi,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'facility_name', dv.name,
        'facility_id', tb.don_vi
      )
    ) as row_data
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
        v_role = 'global'
        OR tb.don_vi = ANY(v_allowed)
      )
      AND (p_status IS NULL OR r.trang_thai = p_status)
      AND (
        p_q IS NULL OR p_q = '' OR
        r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
        r.hang_muc_sua_chua ILIKE '%' || p_q || '%'
      )
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subquery;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT) TO authenticated;

COMMENT ON FUNCTION public.repair_request_list IS 
'Lists repair requests with equipment and facility information. Returns only requests for equipment in facilities the user has access to.';
