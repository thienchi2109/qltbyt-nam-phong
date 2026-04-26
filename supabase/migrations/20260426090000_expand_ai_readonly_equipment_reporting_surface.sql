BEGIN;

CREATE OR REPLACE FUNCTION ai_readonly.try_parse_iso_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_trimmed text;
BEGIN
  v_trimmed := nullif(btrim(p_value), '');
  IF v_trimmed IS NULL OR v_trimmed !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN NULL;
  END IF;

  RETURN v_trimmed::date;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION ai_readonly.try_parse_iso_date(text) IS
'Parses YYYY-MM-DD equipment date text into a date for assistant reporting; returns NULL on blank or invalid input.';

CREATE OR REPLACE VIEW ai_readonly.equipment_search
WITH (security_barrier = true)
AS
SELECT
  tb.id AS equipment_id,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.serial,
  tb.hang_san_xuat,
  tb.noi_san_xuat,
  tb.nam_san_xuat,
  tb.so_luu_hanh,
  tb.nguon_nhap,
  tb.nguon_kinh_phi,
  tb.gia_goc,
  tb.nam_tinh_hao_mon,
  tb.ty_le_hao_mon,
  tb.han_bao_hanh,
  tb.phan_loai_theo_nd98,
  tb.nhom_thiet_bi_id,
  tb.tinh_trang_hien_tai,
  tb.khoa_phong_quan_ly,
  tb.nguoi_dang_truc_tiep_quan_ly,
  tb.vi_tri_lap_dat,
  tb.chu_ky_bt_dinh_ky,
  tb.ngay_bt_tiep_theo,
  tb.chu_ky_hc_dinh_ky,
  tb.ngay_hc_tiep_theo,
  tb.chu_ky_kd_dinh_ky,
  tb.ngay_kd_tiep_theo,
  tb.ngay_nhap AS ngay_nhap_raw,
  ai_readonly.try_parse_iso_date(tb.ngay_nhap) AS ngay_nhap_date,
  EXTRACT(YEAR FROM ai_readonly.try_parse_iso_date(tb.ngay_nhap))::integer AS ngay_nhap_year,
  EXTRACT(MONTH FROM ai_readonly.try_parse_iso_date(tb.ngay_nhap))::integer AS ngay_nhap_month,
  EXTRACT(QUARTER FROM ai_readonly.try_parse_iso_date(tb.ngay_nhap))::integer AS ngay_nhap_quarter,
  tb.ngay_dua_vao_su_dung AS ngay_dua_vao_su_dung_raw,
  ai_readonly.try_parse_iso_date(tb.ngay_dua_vao_su_dung) AS ngay_dua_vao_su_dung_date,
  EXTRACT(YEAR FROM ai_readonly.try_parse_iso_date(tb.ngay_dua_vao_su_dung))::integer AS ngay_dua_vao_su_dung_year,
  EXTRACT(MONTH FROM ai_readonly.try_parse_iso_date(tb.ngay_dua_vao_su_dung))::integer AS ngay_dua_vao_su_dung_month,
  EXTRACT(QUARTER FROM ai_readonly.try_parse_iso_date(tb.ngay_dua_vao_su_dung))::integer AS ngay_dua_vao_su_dung_quarter,
  tb.ngay_ngung_su_dung AS ngay_ngung_su_dung_raw,
  ai_readonly.try_parse_iso_date(tb.ngay_ngung_su_dung) AS ngay_ngung_su_dung_date,
  EXTRACT(YEAR FROM ai_readonly.try_parse_iso_date(tb.ngay_ngung_su_dung))::integer AS ngay_ngung_su_dung_year,
  EXTRACT(MONTH FROM ai_readonly.try_parse_iso_date(tb.ngay_ngung_su_dung))::integer AS ngay_ngung_su_dung_month,
  EXTRACT(QUARTER FROM ai_readonly.try_parse_iso_date(tb.ngay_ngung_su_dung))::integer AS ngay_ngung_su_dung_quarter,
  tb.don_vi AS facility_id,
  dv.code AS facility_code,
  dv.name AS facility_name,
  tb.created_at
FROM public.thiet_bi tb
LEFT JOIN public.don_vi dv
  ON dv.id = tb.don_vi
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

COMMENT ON VIEW ai_readonly.equipment_search IS
'Facility-scoped wide reporting surface for assistant equipment SQL, including governed dimensions and normalized date buckets.';

GRANT EXECUTE ON FUNCTION ai_readonly.try_parse_iso_date(text) TO ai_query_reader;
GRANT SELECT ON TABLE ai_readonly.equipment_search TO ai_query_reader;

COMMIT;
