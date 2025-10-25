-- Add date range filtering to repair_request_list RPC
-- This adds p_date_from and p_date_to parameters to filter by ngay_yeu_cau
-- Dates are in Asia/Ho_Chi_Minh timezone and filtering is inclusive

DROP FUNCTION IF EXISTS public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT);

CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
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
BEGIN
  -- Tenant isolation: determine effective facility filter
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'data', '[]'::jsonb,
        'total', 0,
        'page', p_page,
        'pageSize', p_page_size
      );
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RETURN jsonb_build_object(
          'data', '[]'::jsonb,
          'total', 0,
          'page', p_page,
          'pageSize', p_page_size
        );
      END IF;
    END IF;
  END IF;

  -- Calculate total count with date range filter
  SELECT count(*) INTO v_total
  FROM public.yeu_cau_sua_chua r
  JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
      (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi))
      OR
      (v_role <> 'global' AND (
        (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR
        (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
      ))
    )
    AND (p_status IS NULL OR p_status = '' OR r.trang_thai = p_status)
    AND (
      p_q IS NULL OR p_q = '' OR
      r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
    AND (
      p_date_from IS NULL OR 
      r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
    AND (
      p_date_to IS NULL OR 
      r.ngay_yeu_cau < ((p_date_to + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    );

  -- Get paginated data with date range filter
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
        'thiet_bi', jsonb_build_object(
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', tb.don_vi
        )
      ) as row_data,
      r.ngay_yeu_cau
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
        (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi))
        OR
        (v_role <> 'global' AND (
          (v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR
          (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))
        ))
      )
      AND (p_status IS NULL OR p_status = '' OR r.trang_thai = p_status)
      AND (
        p_q IS NULL OR p_q = '' OR
        r.mo_ta_su_co ILIKE '%' || p_q || '%' OR
        r.hang_muc_sua_chua ILIKE '%' || p_q || '%' OR
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      )
      AND (
        p_date_from IS NULL OR 
        r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      )
      AND (
        p_date_to IS NULL OR 
        r.ngay_yeu_cau < ((p_date_to + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      )
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subquery;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.repair_request_list IS 
'Lists repair requests with equipment and facility information.
Supports server-side pagination, facility filtering (p_don_vi), and date range filtering (p_date_from, p_date_to).
Date filtering is applied to ngay_yeu_cau column in Asia/Ho_Chi_Minh timezone.
Returns paginated response with total count.';
