-- 20250925_performance_fk_indexes.sql
-- Purpose: Add covering indexes for foreign keys flagged by advisors to improve join/filter performance.
-- Notes:
-- - Idempotent (uses IF NOT EXISTS)
-- - Transactional, safe to run multiple times

BEGIN;

-- file_dinh_kem (FK -> thiet_bi.id)
CREATE INDEX IF NOT EXISTS idx_file_dinh_kem_thiet_bi_id
  ON public.file_dinh_kem (thiet_bi_id);

-- nhat_ky_su_dung (FKs -> thiet_bi.id, nhan_vien.id)
CREATE INDEX IF NOT EXISTS idx_nhat_ky_su_dung_thiet_bi_id
  ON public.nhat_ky_su_dung (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_nhat_ky_su_dung_nguoi_su_dung_id
  ON public.nhat_ky_su_dung (nguoi_su_dung_id);

-- yeu_cau_luan_chuyen (multiple FKs to nhan_vien.id)
CREATE INDEX IF NOT EXISTS idx_yclc_nguoi_yeu_cau_id
  ON public.yeu_cau_luan_chuyen (nguoi_yeu_cau_id);

CREATE INDEX IF NOT EXISTS idx_yclc_created_by
  ON public.yeu_cau_luan_chuyen (created_by);

CREATE INDEX IF NOT EXISTS idx_yclc_updated_by
  ON public.yeu_cau_luan_chuyen (updated_by);

CREATE INDEX IF NOT EXISTS idx_yclc_nguoi_duyet_id
  ON public.yeu_cau_luan_chuyen (nguoi_duyet_id);

-- (Optional safety) thiet_bi_id is commonly filtered/joined
CREATE INDEX IF NOT EXISTS idx_yclc_thiet_bi_id
  ON public.yeu_cau_luan_chuyen (thiet_bi_id);

-- Refresh planner stats
ANALYZE public.file_dinh_kem;
ANALYZE public.nhat_ky_su_dung;
ANALYZE public.yeu_cau_luan_chuyen;

COMMIT;
