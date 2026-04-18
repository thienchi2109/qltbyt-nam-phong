-- Issue #271 Batch 2: assistant SQL semantic-layer foundation.
-- Scope:
--   - create ai_readonly schema and fail-closed facility-scope helpers
--   - create approved facility-scoped semantic views
--   - create read-only grant role for future assistant SQL login role
--
-- Out of scope:
--   - passworded login role creation
--   - runtime SQL executor rollout
--   - audit plumbing

BEGIN;

CREATE SCHEMA IF NOT EXISTS ai_readonly;

REVOKE ALL ON SCHEMA ai_readonly FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'ai_query_reader'
  ) THEN
    CREATE ROLE ai_query_reader NOLOGIN;
  END IF;
END
$$;

COMMENT ON ROLE ai_query_reader IS
'Grant-only role for the assistant SQL semantic layer. Passworded login role must be created manually outside git.';

CREATE OR REPLACE FUNCTION ai_readonly.current_facility_id()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := nullif(current_setting('app.current_facility_id', true), '');

  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_raw::bigint;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid app.current_facility_id session value'
      USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION ai_readonly.require_single_facility_scope()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_facility_id bigint;
BEGIN
  v_facility_id := ai_readonly.current_facility_id();

  IF v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Missing app.current_facility_id session scope'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_facility_id;
END;
$$;

COMMENT ON FUNCTION ai_readonly.current_facility_id() IS
'Reads the server-injected app.current_facility_id GUC for assistant SQL reads.';

COMMENT ON FUNCTION ai_readonly.require_single_facility_scope() IS
'Returns the active facility scope or raises fail-closed when assistant SQL scope was not injected.';

CREATE OR REPLACE VIEW ai_readonly.equipment_search
WITH (security_barrier = true)
AS
SELECT
  tb.id AS equipment_id,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.serial,
  tb.so_luu_hanh,
  tb.phan_loai_theo_nd98,
  tb.nhom_thiet_bi_id,
  tb.tinh_trang_hien_tai,
  tb.khoa_phong_quan_ly,
  tb.vi_tri_lap_dat,
  tb.ngay_bt_tiep_theo,
  tb.ngay_hc_tiep_theo,
  tb.ngay_kd_tiep_theo,
  tb.don_vi AS facility_id,
  dv.code AS facility_code,
  dv.name AS facility_name,
  tb.created_at
FROM public.thiet_bi tb
LEFT JOIN public.don_vi dv
  ON dv.id = tb.don_vi
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

CREATE OR REPLACE VIEW ai_readonly.maintenance_facts
WITH (security_barrier = true)
AS
SELECT
  cv.id AS maintenance_task_id,
  cv.ke_hoach_id AS maintenance_plan_id,
  cv.thiet_bi_id AS equipment_id,
  cv.loai_cong_viec,
  cv.don_vi_thuc_hien,
  cv.diem_hieu_chuan,
  cv.ghi_chu AS task_notes,
  kh.ten_ke_hoach,
  kh.nam AS plan_year,
  kh.trang_thai AS plan_status,
  kh.ngay_phe_duyet,
  kh.don_vi AS plan_facility_id,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.khoa_phong_quan_ly,
  tb.tinh_trang_hien_tai,
  tb.don_vi AS facility_id
FROM public.cong_viec_bao_tri cv
JOIN public.ke_hoach_bao_tri kh
  ON kh.id = cv.ke_hoach_id
JOIN public.thiet_bi tb
  ON tb.id = cv.thiet_bi_id
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

CREATE OR REPLACE VIEW ai_readonly.repair_facts
WITH (security_barrier = true)
AS
SELECT
  r.id AS repair_request_id,
  r.thiet_bi_id AS equipment_id,
  r.trang_thai AS repair_status,
  r.mo_ta_su_co,
  r.hang_muc_sua_chua,
  r.ngay_yeu_cau,
  r.ngay_duyet,
  r.ngay_hoan_thanh,
  r.don_vi_thuc_hien,
  r.ten_don_vi_thue,
  r.chi_phi_sua_chua,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.khoa_phong_quan_ly,
  tb.don_vi AS facility_id,
  dv.name AS facility_name
FROM public.yeu_cau_sua_chua r
JOIN public.thiet_bi tb
  ON tb.id = r.thiet_bi_id
LEFT JOIN public.don_vi dv
  ON dv.id = tb.don_vi
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

CREATE OR REPLACE VIEW ai_readonly.usage_facts
WITH (security_barrier = true)
AS
SELECT
  nk.id AS usage_log_id,
  nk.thiet_bi_id AS equipment_id,
  nk.nguoi_su_dung_id,
  nk.thoi_gian_bat_dau,
  nk.thoi_gian_ket_thuc,
  nk.trang_thai,
  nk.tinh_trang_thiet_bi,
  nk.tinh_trang_ban_dau,
  nk.tinh_trang_ket_thuc,
  nk.ghi_chu,
  CASE
    WHEN nk.thoi_gian_bat_dau IS NOT NULL AND nk.thoi_gian_ket_thuc IS NOT NULL
      THEN extract(epoch FROM (nk.thoi_gian_ket_thuc - nk.thoi_gian_bat_dau)) / 3600.0
    ELSE NULL
  END AS duration_hours,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.khoa_phong_quan_ly,
  tb.don_vi AS facility_id
FROM public.nhat_ky_su_dung nk
JOIN public.thiet_bi tb
  ON tb.id = nk.thiet_bi_id
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

CREATE OR REPLACE VIEW ai_readonly.quota_facts
WITH (security_barrier = true)
AS
SELECT
  tb.id AS equipment_id,
  tb.ma_thiet_bi,
  tb.ten_thiet_bi,
  tb.model,
  tb.nhom_thiet_bi_id AS category_id,
  ntb.ma_nhom AS category_code,
  ntb.ten_nhom AS category_name,
  tb.don_vi AS facility_id,
  dv.name AS facility_name,
  qd.id AS decision_id,
  qd.so_quyet_dinh,
  qd.trang_thai AS decision_status,
  qd.ngay_hieu_luc,
  cd.so_luong_toi_thieu,
  cd.so_luong_toi_da,
  count(*) FILTER (
    WHERE tb.nhom_thiet_bi_id IS NOT NULL
  ) OVER (
    PARTITION BY tb.don_vi, tb.nhom_thiet_bi_id
  )::bigint AS category_device_count,
  CASE
    WHEN tb.nhom_thiet_bi_id IS NULL THEN 'notMapped'
    WHEN qd.id IS NULL THEN 'insufficientEvidence'
    WHEN cd.id IS NULL THEN 'notInApprovedCatalog'
    ELSE 'inQuotaCatalog'
  END AS quota_status,
  CASE
    WHEN cd.id IS NULL THEN NULL
    ELSE greatest(
      cd.so_luong_toi_da::bigint
      - count(*) FILTER (
          WHERE tb.nhom_thiet_bi_id IS NOT NULL
        ) OVER (
          PARTITION BY tb.don_vi, tb.nhom_thiet_bi_id
        )::bigint,
      0
    )
  END AS remaining_quota
FROM public.thiet_bi tb
LEFT JOIN public.don_vi dv
  ON dv.id = tb.don_vi
LEFT JOIN public.nhom_thiet_bi ntb
  ON ntb.id = tb.nhom_thiet_bi_id
 AND ntb.don_vi_id = tb.don_vi
LEFT JOIN LATERAL (
  SELECT
    qd_inner.id,
    qd_inner.so_quyet_dinh,
    qd_inner.trang_thai,
    qd_inner.ngay_hieu_luc
  FROM public.quyet_dinh_dinh_muc qd_inner
  WHERE qd_inner.don_vi_id = tb.don_vi
    AND qd_inner.trang_thai = 'active'
  ORDER BY qd_inner.ngay_hieu_luc DESC, qd_inner.id DESC
  LIMIT 1
) qd
  ON true
LEFT JOIN public.chi_tiet_dinh_muc cd
  ON cd.quyet_dinh_id = qd.id
 AND cd.nhom_thiet_bi_id = tb.nhom_thiet_bi_id
WHERE tb.is_deleted = false
  AND tb.don_vi = ai_readonly.require_single_facility_scope();

COMMENT ON VIEW ai_readonly.equipment_search IS
'Facility-scoped semantic surface for assistant equipment lookup SQL.';

COMMENT ON VIEW ai_readonly.maintenance_facts IS
'Facility-scoped maintenance task and plan facts for assistant SQL.';

COMMENT ON VIEW ai_readonly.repair_facts IS
'Facility-scoped repair request facts for assistant SQL.';

COMMENT ON VIEW ai_readonly.usage_facts IS
'Facility-scoped equipment usage log facts for assistant SQL.';

COMMENT ON VIEW ai_readonly.quota_facts IS
'Facility-scoped equipment-to-quota semantic surface for assistant SQL.';

GRANT USAGE ON SCHEMA ai_readonly TO ai_query_reader;
GRANT EXECUTE ON FUNCTION ai_readonly.current_facility_id() TO ai_query_reader;
GRANT EXECUTE ON FUNCTION ai_readonly.require_single_facility_scope() TO ai_query_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ai_readonly TO ai_query_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA ai_readonly
  GRANT SELECT ON TABLES TO ai_query_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA ai_readonly
  GRANT EXECUTE ON FUNCTIONS TO ai_query_reader;

REVOKE ALL ON ALL TABLES IN SCHEMA ai_readonly FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ai_readonly FROM PUBLIC;

COMMIT;
