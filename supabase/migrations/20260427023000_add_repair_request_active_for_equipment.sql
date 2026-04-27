-- supabase/migrations/20260427023000_add_repair_request_active_for_equipment.sql
-- Issue #338 (umbrella #207): introduce active-repair resolver per equipment.
-- Rollback: DROP FUNCTION public.repair_request_active_for_equipment(INT);
--           DROP INDEX IF EXISTS public.idx_yeu_cau_sua_chua_thiet_bi_status;

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_active_for_equipment(
  p_thiet_bi_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     TEXT  := lower(coalesce(public._get_jwt_claim('app_role'),
                                     public._get_jwt_claim('role'), ''));
  v_user_id  TEXT  := nullif(public._get_jwt_claim('user_id'), '');
  v_allowed  BIGINT[] := NULL;
  v_count    INTEGER := 0;
  v_request  JSONB   := NULL;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role NOT IN ('global', 'admin') THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('active_count', 0, 'request', NULL);
    END IF;
  END IF;

  WITH active AS (
    SELECT
      r.*,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.serial,
      tb.khoa_phong_quan_ly,
      tb.don_vi AS thiet_bi_don_vi,
      dv.name AS facility_name
    FROM public.yeu_cau_sua_chua r
    JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE r.thiet_bi_id = p_thiet_bi_id
      AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
      AND COALESCE(tb.is_deleted, false) = false
      AND (v_role IN ('global','admin') OR tb.don_vi = ANY(v_allowed))
    ORDER BY COALESCE(r.ngay_duyet, r.ngay_yeu_cau) DESC, r.id DESC
  ),
  counted AS (SELECT count(*)::int AS c FROM active)
  SELECT
    jsonb_build_object(
      'active_count', counted.c,
      'request',
      CASE WHEN counted.c = 0 THEN NULL ELSE (
        SELECT jsonb_build_object(
          'id', a.id,
          'thiet_bi_id', a.thiet_bi_id,
          'ngay_yeu_cau', a.ngay_yeu_cau,
          'trang_thai', a.trang_thai,
          'mo_ta_su_co', a.mo_ta_su_co,
          'hang_muc_sua_chua', a.hang_muc_sua_chua,
          'ngay_mong_muon_hoan_thanh', a.ngay_mong_muon_hoan_thanh,
          'nguoi_yeu_cau', a.nguoi_yeu_cau,
          'ngay_duyet', a.ngay_duyet,
          'ngay_hoan_thanh', a.ngay_hoan_thanh,
          'nguoi_duyet', a.nguoi_duyet,
          'nguoi_xac_nhan', a.nguoi_xac_nhan,
          'don_vi_thuc_hien', a.don_vi_thuc_hien,
          'ten_don_vi_thue', a.ten_don_vi_thue,
          'ket_qua_sua_chua', a.ket_qua_sua_chua,
          'ly_do_khong_hoan_thanh', a.ly_do_khong_hoan_thanh,
          'chi_phi_sua_chua', a.chi_phi_sua_chua,
          'thiet_bi', jsonb_build_object(
            'ten_thiet_bi', a.ten_thiet_bi,
            'ma_thiet_bi', a.ma_thiet_bi,
            'model', a.model,
            'serial', a.serial,
            'khoa_phong_quan_ly', a.khoa_phong_quan_ly,
            'facility_name', a.facility_name,
            'facility_id', a.thiet_bi_don_vi
          )
        )
        FROM active a LIMIT 1
      ) END
    )
  INTO v_request
  FROM counted;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_active_for_equipment(INT) FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_status
  ON public.yeu_cau_sua_chua (thiet_bi_id, trang_thai);

COMMIT;
