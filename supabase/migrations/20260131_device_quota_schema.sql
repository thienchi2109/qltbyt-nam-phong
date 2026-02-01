-- Migration: Device Quota Management Schema
-- Date: 2026-01-31
-- Purpose:
--   Implement equipment quota management per Circular 08/2019/TT-BYT
--   This enables facilities to:
--   1. Define equipment categories (nhom_thiet_bi) with hierarchical structure
--   2. Create quota decisions (quyet_dinh_dinh_muc) with validity periods
--   3. Set min/max quantities per category (chi_tiet_dinh_muc)
--   4. Link existing equipment to categories for quota tracking
--   5. Audit all category link/unlink operations
--
-- Tables Created:
--   - nhom_thiet_bi: Equipment categories with parent-child hierarchy
--   - quyet_dinh_dinh_muc: Quota decision documents
--   - chi_tiet_dinh_muc: Quota line items per category
--   - thiet_bi_nhom_audit_log: Audit trail for category assignments
--   - lich_su_dinh_muc: Append-only audit for decision lifecycle
--
-- Tables Modified:
--   - thiet_bi: Add nhom_thiet_bi_id foreign key
--
-- Security: All tables use tenant isolation via don_vi_id
-- No RLS - security enforced via RPC functions

BEGIN;

-- ============================================================================
-- PART 0: Enable required extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- PART 1: nhom_thiet_bi (Equipment Categories)
-- ============================================================================
-- Hierarchical equipment categories for quota management.
-- Supports parent-child relationships for category grouping.
-- Keywords (tu_khoa) enable AI-powered equipment matching.

CREATE TABLE IF NOT EXISTS public.nhom_thiet_bi (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE CASCADE,
  ma_nhom TEXT NOT NULL,
  ten_nhom TEXT NOT NULL,
  phan_loai TEXT CHECK (phan_loai IN ('A', 'B')) DEFAULT 'B',
  don_vi_tinh TEXT DEFAULT 'Cái',
  thu_tu_hien_thi INT DEFAULT 0,
  mo_ta TEXT,
  tu_khoa TEXT[], -- Keywords for AI matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  UNIQUE (don_vi_id, ma_nhom)
);

CREATE INDEX IF NOT EXISTS idx_nhom_thiet_bi_don_vi ON public.nhom_thiet_bi(don_vi_id);
CREATE INDEX IF NOT EXISTS idx_nhom_thiet_bi_parent ON public.nhom_thiet_bi(parent_id);
-- GIN index for AI keyword matching with @> operator
CREATE INDEX IF NOT EXISTS idx_nhom_thiet_bi_tu_khoa ON public.nhom_thiet_bi USING GIN(tu_khoa);

COMMENT ON TABLE public.nhom_thiet_bi IS 'Equipment categories for quota management per Circular 08/2019/TT-BYT';
COMMENT ON COLUMN public.nhom_thiet_bi.ma_nhom IS 'Category code unique within facility';
COMMENT ON COLUMN public.nhom_thiet_bi.ten_nhom IS 'Category display name';
COMMENT ON COLUMN public.nhom_thiet_bi.phan_loai IS 'Equipment classification: A (high risk) or B (medium/low risk)';
COMMENT ON COLUMN public.nhom_thiet_bi.tu_khoa IS 'Keywords array for AI-powered equipment matching';

-- ============================================================================
-- PART 1.1: Cross-tenant parent_id validation for nhom_thiet_bi
-- ============================================================================
-- Ensures parent category belongs to the same facility (don_vi_id)

CREATE OR REPLACE FUNCTION public.validate_nhom_thiet_bi_parent_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_don_vi BIGINT;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT don_vi_id INTO v_parent_don_vi
    FROM public.nhom_thiet_bi WHERE id = NEW.parent_id;

    IF v_parent_don_vi IS NULL THEN
      RAISE EXCEPTION 'Parent category (id=%) not found', NEW.parent_id;
    END IF;

    IF v_parent_don_vi != NEW.don_vi_id THEN
      RAISE EXCEPTION 'Parent category must belong to the same facility. Expected don_vi_id=%, found %',
        NEW.don_vi_id, v_parent_don_vi;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nhom_thiet_bi_parent_tenant_check
BEFORE INSERT OR UPDATE OF parent_id, don_vi_id ON public.nhom_thiet_bi
FOR EACH ROW EXECUTE FUNCTION public.validate_nhom_thiet_bi_parent_tenant();

COMMENT ON FUNCTION public.validate_nhom_thiet_bi_parent_tenant() IS
  'Enforces tenant isolation: parent_id must reference category in same don_vi_id';

-- ============================================================================
-- PART 2: quyet_dinh_dinh_muc (Quota Decisions)
-- ============================================================================
-- Official quota decision documents issued by facility leadership.
-- Supports versioning via thay_the_cho_id for decision replacement.
-- Validity period tracking with ngay_hieu_luc and ngay_het_hieu_luc.

CREATE TABLE IF NOT EXISTS public.quyet_dinh_dinh_muc (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  so_quyet_dinh TEXT NOT NULL,
  ngay_ban_hanh DATE NOT NULL,
  ngay_hieu_luc DATE NOT NULL,
  ngay_het_hieu_luc DATE,
  nguoi_ky TEXT NOT NULL,
  chuc_vu_nguoi_ky TEXT NOT NULL,
  trang_thai TEXT CHECK (trang_thai IN ('draft', 'active', 'inactive')) DEFAULT 'draft',
  ghi_chu TEXT,
  thay_the_cho_id BIGINT REFERENCES public.quyet_dinh_dinh_muc(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  UNIQUE (don_vi_id, so_quyet_dinh),
  -- Date validation: issue <= effective <= expiry
  CONSTRAINT chk_quyet_dinh_date_sequence CHECK (
    ngay_hieu_luc >= ngay_ban_hanh AND 
    (ngay_het_hieu_luc IS NULL OR ngay_het_hieu_luc >= ngay_hieu_luc)
  )
);

CREATE INDEX IF NOT EXISTS idx_quyet_dinh_don_vi ON public.quyet_dinh_dinh_muc(don_vi_id);
CREATE INDEX IF NOT EXISTS idx_quyet_dinh_trang_thai ON public.quyet_dinh_dinh_muc(trang_thai);

COMMENT ON TABLE public.quyet_dinh_dinh_muc IS 'Equipment quota decision documents for facility-wide equipment planning';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.so_quyet_dinh IS 'Decision number unique within facility';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.ngay_ban_hanh IS 'Date decision was issued';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.ngay_hieu_luc IS 'Date decision takes effect';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.ngay_het_hieu_luc IS 'Date decision expires (NULL = no expiry)';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.trang_thai IS 'Decision status: draft, active, or inactive';
COMMENT ON COLUMN public.quyet_dinh_dinh_muc.thay_the_cho_id IS 'References the previous decision this one replaces';

-- ============================================================================
-- PART 2.1: Cross-tenant thay_the_cho_id validation for quyet_dinh_dinh_muc
-- ============================================================================
-- Ensures replaced decision belongs to the same facility (don_vi_id)

CREATE OR REPLACE FUNCTION public.validate_quyet_dinh_replacement_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_replaced_don_vi BIGINT;
BEGIN
  IF NEW.thay_the_cho_id IS NOT NULL THEN
    SELECT don_vi_id INTO v_replaced_don_vi
    FROM public.quyet_dinh_dinh_muc WHERE id = NEW.thay_the_cho_id;

    IF v_replaced_don_vi IS NULL THEN
      RAISE EXCEPTION 'Replaced decision (id=%) not found', NEW.thay_the_cho_id;
    END IF;

    IF v_replaced_don_vi != NEW.don_vi_id THEN
      RAISE EXCEPTION 'Replaced decision must belong to the same facility. Expected don_vi_id=%, found %',
        NEW.don_vi_id, v_replaced_don_vi;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quyet_dinh_replacement_tenant_check
BEFORE INSERT OR UPDATE OF thay_the_cho_id, don_vi_id ON public.quyet_dinh_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.validate_quyet_dinh_replacement_tenant();

COMMENT ON FUNCTION public.validate_quyet_dinh_replacement_tenant() IS
  'Enforces tenant isolation: thay_the_cho_id must reference decision in same don_vi_id';

-- ============================================================================
-- PART 3: chi_tiet_dinh_muc (Quota Line Items)
-- ============================================================================
-- Individual quota limits per equipment category within a decision.
-- Defines min/max quantities for each category.

CREATE TABLE IF NOT EXISTS public.chi_tiet_dinh_muc (
  id BIGSERIAL PRIMARY KEY,
  quyet_dinh_id BIGINT NOT NULL REFERENCES public.quyet_dinh_dinh_muc(id) ON DELETE CASCADE,
  nhom_thiet_bi_id BIGINT NOT NULL REFERENCES public.nhom_thiet_bi(id) ON DELETE CASCADE,
  so_luong_toi_da INT NOT NULL DEFAULT 0 CHECK (so_luong_toi_da >= 0),
  so_luong_toi_thieu INT DEFAULT 0 CHECK (so_luong_toi_thieu >= 0),
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (quyet_dinh_id, nhom_thiet_bi_id),
  -- CRITICAL: Ensure min <= max
  CONSTRAINT chk_chi_tiet_quota_range CHECK (so_luong_toi_thieu <= so_luong_toi_da)
);

CREATE INDEX IF NOT EXISTS idx_chi_tiet_quyet_dinh ON public.chi_tiet_dinh_muc(quyet_dinh_id);
CREATE INDEX IF NOT EXISTS idx_chi_tiet_nhom ON public.chi_tiet_dinh_muc(nhom_thiet_bi_id);

COMMENT ON TABLE public.chi_tiet_dinh_muc IS 'Quota line items specifying min/max quantities per equipment category';
COMMENT ON COLUMN public.chi_tiet_dinh_muc.so_luong_toi_da IS 'Maximum allowed quantity for this category';
COMMENT ON COLUMN public.chi_tiet_dinh_muc.so_luong_toi_thieu IS 'Minimum required quantity for this category';

-- ============================================================================
-- PART 3.1: Cross-tenant validation trigger for chi_tiet_dinh_muc
-- ============================================================================
-- Ensures decision and category belong to the same facility

CREATE OR REPLACE FUNCTION public.validate_chi_tiet_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_decision_don_vi BIGINT;
  v_category_don_vi BIGINT;
BEGIN
  SELECT don_vi_id INTO v_decision_don_vi 
  FROM public.quyet_dinh_dinh_muc WHERE id = NEW.quyet_dinh_id;
  
  SELECT don_vi_id INTO v_category_don_vi 
  FROM public.nhom_thiet_bi WHERE id = NEW.nhom_thiet_bi_id;
  
  IF v_decision_don_vi != v_category_don_vi THEN
    RAISE EXCEPTION 'Decision and category must belong to the same facility (don_vi)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chi_tiet_tenant_check
BEFORE INSERT OR UPDATE OF quyet_dinh_id, nhom_thiet_bi_id ON public.chi_tiet_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.validate_chi_tiet_tenant();

-- ============================================================================
-- PART 4: Alter thiet_bi table
-- ============================================================================
-- Add foreign key to link equipment to categories for quota tracking.

ALTER TABLE public.thiet_bi
ADD COLUMN IF NOT EXISTS nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_nhom ON public.thiet_bi(nhom_thiet_bi_id);

COMMENT ON COLUMN public.thiet_bi.nhom_thiet_bi_id IS 'Link to equipment category for quota tracking';

-- ============================================================================
-- PART 4.1: Cross-tenant validation trigger for thiet_bi
-- ============================================================================
-- Ensures equipment and category belong to the same facility

CREATE OR REPLACE FUNCTION public.validate_thiet_bi_category_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_category_don_vi BIGINT;
BEGIN
  IF NEW.nhom_thiet_bi_id IS NOT NULL THEN
    SELECT don_vi_id INTO v_category_don_vi 
    FROM public.nhom_thiet_bi WHERE id = NEW.nhom_thiet_bi_id;
    
    -- thiet_bi uses 'don_vi' column (not 'don_vi_id')
    IF v_category_don_vi != NEW.don_vi THEN
      RAISE EXCEPTION 'Category must belong to the same facility as equipment';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_thiet_bi_category_tenant_check
BEFORE INSERT OR UPDATE OF nhom_thiet_bi_id ON public.thiet_bi
FOR EACH ROW EXECUTE FUNCTION public.validate_thiet_bi_category_tenant();

-- ============================================================================
-- PART 5: thiet_bi_nhom_audit_log (Audit Log)
-- ============================================================================
-- Audit trail for all equipment category link/unlink operations.
-- Tracks bulk operations via thiet_bi_ids array.
-- Append-only: UPDATE and DELETE raise exceptions.

-- Shared trigger function for all append-only audit tables
CREATE OR REPLACE FUNCTION public.raise_audit_immutable_error()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable. % not permitted on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.raise_audit_immutable_error() IS
  'Raises exception on UPDATE/DELETE attempts on audit tables. Ensures append-only behavior with loud failure.';

CREATE TABLE IF NOT EXISTS public.thiet_bi_nhom_audit_log (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  thiet_bi_ids BIGINT[] NOT NULL CHECK (array_length(thiet_bi_ids, 1) > 0),
  nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('link', 'unlink')),
  performed_by BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Append-only constraints: prevent modification of audit records (raises exception)
CREATE TRIGGER trg_thiet_bi_audit_immutable
BEFORE UPDATE OR DELETE ON public.thiet_bi_nhom_audit_log
FOR EACH ROW EXECUTE FUNCTION public.raise_audit_immutable_error();

CREATE INDEX IF NOT EXISTS idx_audit_log_don_vi ON public.thiet_bi_nhom_audit_log(don_vi_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON public.thiet_bi_nhom_audit_log(performed_at DESC);

COMMENT ON TABLE public.thiet_bi_nhom_audit_log IS 'Append-only audit trail for equipment category link/unlink operations';
COMMENT ON COLUMN public.thiet_bi_nhom_audit_log.thiet_bi_ids IS 'Array of equipment IDs affected by this operation';
COMMENT ON COLUMN public.thiet_bi_nhom_audit_log.action IS 'Operation type: link or unlink';
COMMENT ON COLUMN public.thiet_bi_nhom_audit_log.metadata IS 'Additional context (e.g., previous category, reason)';

-- ============================================================================
-- PART 6: lich_su_dinh_muc (Decision Audit Log - Append Only)
-- ============================================================================
-- Immutable audit log for quota decision lifecycle changes.
-- Tracks: create, update, adjust, cancel, publish operations.
-- Append-only: UPDATE and DELETE raise exceptions via trigger.

CREATE TABLE IF NOT EXISTS public.lich_su_dinh_muc (
  id BIGSERIAL PRIMARY KEY,
  chi_tiet_id BIGINT REFERENCES public.chi_tiet_dinh_muc(id) ON DELETE SET NULL,
  quyet_dinh_id BIGINT REFERENCES public.quyet_dinh_dinh_muc(id) ON DELETE SET NULL,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  thao_tac TEXT NOT NULL CHECK (thao_tac IN ('tao', 'cap_nhat', 'dieu_chinh', 'huy', 'cong_khai')),
  snapshot_truoc JSONB,
  snapshot_sau JSONB,
  ly_do TEXT,
  thuc_hien_boi BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  client_info JSONB,
  thoi_diem TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Append-only constraints: prevent modification of audit records (raises exception)
CREATE TRIGGER trg_lich_su_immutable
BEFORE UPDATE OR DELETE ON public.lich_su_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.raise_audit_immutable_error();

CREATE INDEX IF NOT EXISTS idx_lich_su_don_vi ON public.lich_su_dinh_muc(don_vi_id);
CREATE INDEX IF NOT EXISTS idx_lich_su_quyet_dinh ON public.lich_su_dinh_muc(quyet_dinh_id);
CREATE INDEX IF NOT EXISTS idx_lich_su_chi_tiet ON public.lich_su_dinh_muc(chi_tiet_id) WHERE chi_tiet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lich_su_thoi_diem ON public.lich_su_dinh_muc(thoi_diem DESC);

COMMENT ON TABLE public.lich_su_dinh_muc IS 'Append-only audit log for quota decision lifecycle changes';
COMMENT ON COLUMN public.lich_su_dinh_muc.thao_tac IS 'Operation: tao (create), cap_nhat (update), dieu_chinh (adjust), huy (cancel), cong_khai (publish)';
COMMENT ON COLUMN public.lich_su_dinh_muc.snapshot_truoc IS 'State before change (JSON snapshot)';
COMMENT ON COLUMN public.lich_su_dinh_muc.snapshot_sau IS 'State after change (JSON snapshot)';
COMMENT ON COLUMN public.lich_su_dinh_muc.client_info IS 'Client metadata: IP, user agent for forensics';

COMMIT;
