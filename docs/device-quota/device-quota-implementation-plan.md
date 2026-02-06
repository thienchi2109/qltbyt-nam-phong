# Device Quota Implementation Plan

**Consolidated from**: Knowledge Base + Backend Agent Reviews
**Date**: January 2025
**Status**: Ready for Implementation

---

## Executive Summary

This plan implements the Device Quota (Dinh Muc Thiet Bi) feature based on:
- **Circular 46/2025/TT-BYT** (effective Feb 15, 2026) - Decentralized quota authority
- **Circular 08/2019/TT-BYT** - Calculation methodology (still valid)
- **Circular 01/2026/TT-BYT** - National centralized procurement

Key architectural decisions incorporate recommendations from backend architecture, security, and API design reviews.

---

## Phase 1: Database Schema (Priority: Critical)

### 1.1 Equipment Category Hierarchy

> **Design Decision**: Uses simple `parent_id` hierarchy with recursive CTEs instead of `ltree` extension.
> This reduces complexity while remaining performant for typical 2-3 level category hierarchies.
> Categories are per-tenant (each facility manages their own categories).

```sql
-- Equipment categories (per-tenant)
CREATE TABLE public.nhom_thiet_bi (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE CASCADE,
  ma_nhom TEXT NOT NULL,                   -- e.g., "XQ", "CT", "MRI"
  ten_nhom TEXT NOT NULL,                  -- Vietnamese name
  phan_loai TEXT CHECK (phan_loai IN ('A', 'B')) DEFAULT 'B',  -- Risk class
  don_vi_tinh TEXT DEFAULT 'Cái',          -- Unit of measurement
  thu_tu_hien_thi INT DEFAULT 0,           -- Display order
  mo_ta TEXT,                              -- Description
  tu_khoa TEXT[],                          -- Keywords for AI matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES public.nhan_vien(id) ON DELETE SET NULL,
  UNIQUE (don_vi_id, ma_nhom)
);

CREATE INDEX idx_nhom_thiet_bi_don_vi ON public.nhom_thiet_bi(don_vi_id);
CREATE INDEX idx_nhom_thiet_bi_parent ON public.nhom_thiet_bi(parent_id);
CREATE INDEX idx_nhom_thiet_bi_tu_khoa ON public.nhom_thiet_bi USING GIN(tu_khoa);

-- Cross-tenant parent validation trigger
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
      RAISE EXCEPTION 'Parent category must belong to the same facility';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nhom_thiet_bi_parent_tenant_check
BEFORE INSERT OR UPDATE OF parent_id, don_vi_id ON public.nhom_thiet_bi
FOR EACH ROW EXECUTE FUNCTION public.validate_nhom_thiet_bi_parent_tenant();
```

### 1.2 Quota Decisions

> **Design Decision**: Simplified status model (`draft`, `active`, `inactive`) instead of published/immutability triggers.
> Uses unique partial index to enforce exactly one active decision per tenant.

```sql
-- Quota decision (per-tenant, versioned)
CREATE TABLE public.quyet_dinh_dinh_muc (
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

CREATE INDEX idx_quyet_dinh_don_vi ON public.quyet_dinh_dinh_muc(don_vi_id);
CREATE INDEX idx_quyet_dinh_trang_thai ON public.quyet_dinh_dinh_muc(trang_thai);

-- CRITICAL: Enforce exactly one active decision per tenant
CREATE UNIQUE INDEX idx_quyet_dinh_unique_active_per_tenant
ON public.quyet_dinh_dinh_muc(don_vi_id) WHERE trang_thai = 'active';

-- Cross-tenant replacement validation trigger
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
      RAISE EXCEPTION 'Replaced decision must belong to the same facility';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quyet_dinh_replacement_tenant_check
BEFORE INSERT OR UPDATE OF thay_the_cho_id, don_vi_id ON public.quyet_dinh_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.validate_quyet_dinh_replacement_tenant();
```

### 1.3 Quota Line Items

> **Design Decision**: Simplified schema - no denormalized `don_vi_id`, uses trigger for tenant validation.
> Quota limits expressed as `so_luong_toi_da` (max) and `so_luong_toi_thieu` (min).

```sql
-- Quota line items (linked to decision)
CREATE TABLE public.chi_tiet_dinh_muc (
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

CREATE INDEX idx_chi_tiet_quyet_dinh ON public.chi_tiet_dinh_muc(quyet_dinh_id);
CREATE INDEX idx_chi_tiet_nhom ON public.chi_tiet_dinh_muc(nhom_thiet_bi_id);

-- Cross-tenant validation: decision and category must belong to same facility
CREATE OR REPLACE FUNCTION public.validate_chi_tiet_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_decision_don_vi BIGINT;
  v_category_don_vi BIGINT;
BEGIN
  IF NEW.quyet_dinh_id IS NOT NULL THEN
    SELECT don_vi_id INTO v_decision_don_vi 
    FROM public.quyet_dinh_dinh_muc WHERE id = NEW.quyet_dinh_id;
    
    SELECT don_vi_id INTO v_category_don_vi 
    FROM public.nhom_thiet_bi WHERE id = NEW.nhom_thiet_bi_id;
    
    IF v_decision_don_vi != v_category_don_vi THEN
      RAISE EXCEPTION 'Decision and category must belong to the same facility';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chi_tiet_tenant_check
BEFORE INSERT OR UPDATE OF quyet_dinh_id, nhom_thiet_bi_id ON public.chi_tiet_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.validate_chi_tiet_tenant();
```

### 1.4 Audit Logs (Append-Only)

> **Design Decision**: Uses TRIGGER-based immutability (raises exception) instead of RULEs.
> Two audit tables: equipment category assignments and decision lifecycle.

```sql
-- Shared trigger function for all append-only audit tables
CREATE OR REPLACE FUNCTION public.raise_audit_immutable_error()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable. % not permitted on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Equipment category assignment audit log
CREATE TABLE public.thiet_bi_nhom_audit_log (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  thiet_bi_ids BIGINT[] NOT NULL CHECK (array_length(thiet_bi_ids, 1) > 0),
  nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('link', 'unlink')),
  performed_by BIGINT NOT NULL REFERENCES public.nhan_vien(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TRIGGER trg_thiet_bi_audit_immutable
BEFORE UPDATE OR DELETE ON public.thiet_bi_nhom_audit_log
FOR EACH ROW EXECUTE FUNCTION public.raise_audit_immutable_error();

CREATE INDEX idx_audit_log_don_vi ON public.thiet_bi_nhom_audit_log(don_vi_id);
CREATE INDEX idx_audit_log_performed_at ON public.thiet_bi_nhom_audit_log(performed_at DESC);

-- Decision lifecycle audit log
CREATE TABLE public.lich_su_dinh_muc (
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

CREATE TRIGGER trg_lich_su_immutable
BEFORE UPDATE OR DELETE ON public.lich_su_dinh_muc
FOR EACH ROW EXECUTE FUNCTION public.raise_audit_immutable_error();

CREATE INDEX idx_lich_su_don_vi ON public.lich_su_dinh_muc(don_vi_id);
CREATE INDEX idx_lich_su_quyet_dinh ON public.lich_su_dinh_muc(quyet_dinh_id);
CREATE INDEX idx_lich_su_chi_tiet ON public.lich_su_dinh_muc(chi_tiet_id) WHERE chi_tiet_id IS NOT NULL;
CREATE INDEX idx_lich_su_thoi_diem ON public.lich_su_dinh_muc(thoi_diem DESC);
```

### 1.5 Link Equipment to Categories

```sql
-- Add foreign key to thiet_bi table
ALTER TABLE public.thiet_bi
ADD COLUMN IF NOT EXISTS nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL;

CREATE INDEX idx_thiet_bi_nhom ON public.thiet_bi(nhom_thiet_bi_id);

-- Cross-tenant validation: equipment and category must belong to same facility
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
```

---

## Phase 2: RPC Functions (Security-First)

### 2.1 Category Hierarchy (Tenant-Isolated)

> **Design Decision**: Uses recursive CTE for hierarchy traversal instead of `ltree`.
> Categories are per-tenant, accessed via `dinh_muc_nhom_list`.

```sql
-- List equipment categories with hierarchy and equipment counts
CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  parent_id BIGINT,
  ma_nhom TEXT,
  ten_nhom TEXT,
  phan_loai TEXT,
  don_vi_tinh TEXT,
  thu_tu_hien_thi INT,
  mo_ta TEXT,
  tu_khoa TEXT[],
  level INT,
  so_luong_hien_co BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
  -- Tenant isolation based on role
  IF v_role IN ('global', 'admin') THEN
    -- Global/admin can access any tenant
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate p_don_vi against allowed facilities
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- Other roles: force to their own tenant
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Recursive CTE for hierarchical category listing
  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Base case: root categories (no parent)
    SELECT n.id, n.parent_id, n.ma_nhom, n.ten_nhom, n.phan_loai,
           n.don_vi_tinh, n.thu_tu_hien_thi, n.mo_ta, n.tu_khoa, 1 AS level
    FROM public.nhom_thiet_bi n
    WHERE n.don_vi_id = p_don_vi AND n.parent_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT n.id, n.parent_id, n.ma_nhom, n.ten_nhom, n.phan_loai,
           n.don_vi_tinh, n.thu_tu_hien_thi, n.mo_ta, n.tu_khoa, ct.level + 1
    FROM public.nhom_thiet_bi n
    INNER JOIN category_tree ct ON n.parent_id = ct.id
    WHERE n.don_vi_id = p_don_vi
  ),
  equipment_counts AS (
    SELECT tb.nhom_thiet_bi_id, COUNT(*)::BIGINT AS cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = p_don_vi AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  )
  SELECT ct.id, ct.parent_id, ct.ma_nhom, ct.ten_nhom, ct.phan_loai,
         ct.don_vi_tinh, ct.thu_tu_hien_thi, ct.mo_ta, ct.tu_khoa,
         ct.level, COALESCE(ec.cnt, 0) AS so_luong_hien_co
  FROM category_tree ct
  LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = ct.id
  ORDER BY ct.level, ct.thu_tu_hien_thi, ct.ma_nhom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list(BIGINT) TO authenticated;
```

### 2.2 Quota Decisions CRUD

```sql
-- List quota decisions for tenant
CREATE OR REPLACE FUNCTION dinh_muc_quyet_dinh_list(
  p_don_vi bigint DEFAULT NULL,
  p_trang_thai text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_offset int;
  v_total int;
  v_items jsonb;
BEGIN
  -- Permission check
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Count total
  SELECT COUNT(*) INTO v_total
  FROM quyet_dinh_dinh_muc
  WHERE (p_don_vi IS NULL OR don_vi_id = p_don_vi)
    AND (p_trang_thai IS NULL OR trang_thai = p_trang_thai);

  -- Fetch items
  SELECT jsonb_agg(row_to_json(q)::jsonb)
  INTO v_items
  FROM (
    SELECT
      qd.id, qd.don_vi_id, qd.so_quyet_dinh, qd.ngay_ban_hanh,
      qd.nguoi_ky, qd.chuc_vu_nguoi_ky,
      qd.hieu_luc_tu, qd.hieu_luc_den,
      qd.trang_thai, qd.da_cong_khai, qd.ngay_cong_khai,
      qd.phien_ban, qd.thay_the_cho_id,
      qd.created_at, qd.updated_at,
      dv.ten_don_vi
    FROM quyet_dinh_dinh_muc qd
    JOIN don_vi dv ON dv.id = qd.don_vi_id
    WHERE (p_don_vi IS NULL OR qd.don_vi_id = p_don_vi)
      AND (p_trang_thai IS NULL OR qd.trang_thai = p_trang_thai)
    ORDER BY qd.ngay_ban_hanh DESC, qd.id DESC
    LIMIT p_page_size OFFSET v_offset
  ) q;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'pages', CEIL(v_total::float / p_page_size)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_quyet_dinh_list TO authenticated;

-- Create quota decision
CREATE OR REPLACE FUNCTION dinh_muc_quyet_dinh_create(
  p_so_quyet_dinh text,
  p_ngay_ban_hanh date,
  p_nguoi_ky text,
  p_chuc_vu_nguoi_ky text,
  p_hieu_luc_tu date,
  p_hieu_luc_den date DEFAULT NULL,
  p_ghi_chu text DEFAULT NULL,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_id bigint;
BEGIN
  -- Permission: only to_qltb or global can create
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions to create quota decisions';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'don_vi_id is required';
  END IF;

  -- Validation
  IF p_hieu_luc_tu < p_ngay_ban_hanh THEN
    RAISE EXCEPTION 'Effective date cannot be before signing date';
  END IF;

  INSERT INTO quyet_dinh_dinh_muc (
    don_vi_id, so_quyet_dinh, ngay_ban_hanh,
    nguoi_ky, chuc_vu_nguoi_ky,
    hieu_luc_tu, hieu_luc_den,
    trang_thai, ghi_chu,
    created_by, updated_by
  ) VALUES (
    p_don_vi, p_so_quyet_dinh, p_ngay_ban_hanh,
    p_nguoi_ky, p_chuc_vu_nguoi_ky,
    p_hieu_luc_tu, p_hieu_luc_den,
    'draft', p_ghi_chu,
    v_user_id::bigint, v_user_id::bigint
  )
  RETURNING id INTO v_id;

  -- Audit log
  INSERT INTO lich_su_dinh_muc (quyet_dinh_id, don_vi_id, thao_tac, snapshot_sau, thuc_hien_boi)
  SELECT v_id, p_don_vi, 'tao', row_to_json(q)::jsonb, v_user_id::bigint
  FROM quyet_dinh_dinh_muc q WHERE q.id = v_id;

  RETURN jsonb_build_object('id', v_id, 'success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_quyet_dinh_create TO authenticated;

-- Activate quota decision
CREATE OR REPLACE FUNCTION dinh_muc_quyet_dinh_activate(
  p_id bigint,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_decision RECORD;
  v_old_active_id bigint;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  -- Fetch decision with tenant check
  SELECT * INTO v_decision
  FROM quyet_dinh_dinh_muc
  WHERE id = p_id AND (p_don_vi IS NULL OR don_vi_id = p_don_vi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota decision not found or access denied';
  END IF;

  IF v_decision.trang_thai != 'draft' THEN
    RAISE EXCEPTION 'Only draft decisions can be activated';
  END IF;

  -- Deactivate current active decision for same tenant
  SELECT id INTO v_old_active_id
  FROM quyet_dinh_dinh_muc
  WHERE don_vi_id = v_decision.don_vi_id AND trang_thai = 'active';

  IF v_old_active_id IS NOT NULL THEN
    UPDATE quyet_dinh_dinh_muc
    SET trang_thai = 'inactive', updated_by = v_user_id::bigint, updated_at = now()
    WHERE id = v_old_active_id;

    -- Log deactivation
    INSERT INTO lich_su_dinh_muc (quyet_dinh_id, don_vi_id, thao_tac, ly_do, thuc_hien_boi)
    VALUES (v_old_active_id, v_decision.don_vi_id, 'huy', 'Replaced by decision ' || p_id, v_user_id::bigint);
  END IF;

  -- Activate new decision
  UPDATE quyet_dinh_dinh_muc
  SET trang_thai = 'active',
      thay_the_cho_id = v_old_active_id,
      updated_by = v_user_id::bigint,
      updated_at = now()
  WHERE id = p_id;

  -- Audit log
  INSERT INTO lich_su_dinh_muc (quyet_dinh_id, don_vi_id, thao_tac, thuc_hien_boi)
  VALUES (p_id, v_decision.don_vi_id, 'cap_nhat', v_user_id::bigint);

  RETURN jsonb_build_object('success', true, 'replaced_id', v_old_active_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_quyet_dinh_activate TO authenticated;

-- Publish quota decision (mark as public)
CREATE OR REPLACE FUNCTION dinh_muc_quyet_dinh_publish(
  p_id bigint,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_decision RECORD;
BEGIN
  -- Permission: only to_qltb or global
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  SELECT * INTO v_decision
  FROM quyet_dinh_dinh_muc
  WHERE id = p_id AND (p_don_vi IS NULL OR don_vi_id = p_don_vi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota decision not found or access denied';
  END IF;

  IF v_decision.trang_thai != 'active' THEN
    RAISE EXCEPTION 'Only active decisions can be published';
  END IF;

  IF v_decision.da_cong_khai THEN
    RAISE EXCEPTION 'Decision already published';
  END IF;

  UPDATE quyet_dinh_dinh_muc
  SET da_cong_khai = true, ngay_cong_khai = now(), updated_by = v_user_id::bigint
  WHERE id = p_id;

  -- Audit log
  INSERT INTO lich_su_dinh_muc (quyet_dinh_id, don_vi_id, thao_tac, thuc_hien_boi)
  VALUES (p_id, v_decision.don_vi_id, 'cong_khai', v_user_id::bigint);

  RETURN jsonb_build_object('success', true, 'published_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_quyet_dinh_publish TO authenticated;
```

### 2.3 Quota Details CRUD

```sql
-- Add quota detail line item
CREATE OR REPLACE FUNCTION dinh_muc_chi_tiet_upsert(
  p_quyet_dinh_id bigint,
  p_nhom_thiet_bi_id bigint,
  p_don_vi_tinh text,
  p_so_luong_dinh_muc int,
  p_so_luong_toi_thieu int DEFAULT NULL,
  p_khoa_phong_id bigint DEFAULT NULL,
  p_can_cu_tinh_toan text DEFAULT NULL,
  p_mua_sam_tap_trung boolean DEFAULT false,
  p_ghi_chu text DEFAULT NULL,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_decision RECORD;
  v_id bigint;
  v_is_insert boolean;
  v_action text;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  -- Verify decision exists and belongs to tenant
  SELECT * INTO v_decision
  FROM quyet_dinh_dinh_muc
  WHERE id = p_quyet_dinh_id AND (p_don_vi IS NULL OR don_vi_id = p_don_vi);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota decision not found or access denied';
  END IF;

  IF v_decision.da_cong_khai THEN
    RAISE EXCEPTION 'Cannot modify published decision. Create a new version.';
  END IF;

  -- Upsert detail
  INSERT INTO chi_tiet_dinh_muc (
    quyet_dinh_id, don_vi_id, nhom_thiet_bi_id, don_vi_tinh,
    so_luong_dinh_muc, so_luong_toi_thieu, khoa_phong_id,
    can_cu_tinh_toan, mua_sam_tap_trung, ghi_chu
  ) VALUES (
    p_quyet_dinh_id, v_decision.don_vi_id, p_nhom_thiet_bi_id, p_don_vi_tinh,
    p_so_luong_dinh_muc, p_so_luong_toi_thieu, p_khoa_phong_id,
    p_can_cu_tinh_toan, p_mua_sam_tap_trung, p_ghi_chu
  )
  ON CONFLICT (quyet_dinh_id, nhom_thiet_bi_id, khoa_phong_id) DO UPDATE SET
    don_vi_tinh = EXCLUDED.don_vi_tinh,
    so_luong_dinh_muc = EXCLUDED.so_luong_dinh_muc,
    so_luong_toi_thieu = EXCLUDED.so_luong_toi_thieu,
    can_cu_tinh_toan = EXCLUDED.can_cu_tinh_toan,
    mua_sam_tap_trung = EXCLUDED.mua_sam_tap_trung,
    ghi_chu = EXCLUDED.ghi_chu,
    updated_at = now()
  RETURNING id, (xmax = 0) AS is_insert INTO v_id, v_is_insert;

  v_action := CASE WHEN v_is_insert THEN 'tao' ELSE 'cap_nhat' END;

  -- Audit log
  INSERT INTO lich_su_dinh_muc (chi_tiet_id, quyet_dinh_id, don_vi_id, thao_tac, thuc_hien_boi)
  VALUES (v_id, p_quyet_dinh_id, v_decision.don_vi_id, v_action, v_user_id::bigint);

  RETURN jsonb_build_object('id', v_id, 'action', v_action);
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_chi_tiet_upsert TO authenticated;

-- List quota details for a decision
CREATE OR REPLACE FUNCTION dinh_muc_chi_tiet_list(
  p_quyet_dinh_id bigint,
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_items jsonb;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  SELECT jsonb_agg(row_to_json(c)::jsonb ORDER BY n.path, n.thu_tu)
  INTO v_items
  FROM (
    SELECT
      cd.id, cd.nhom_thiet_bi_id, cd.don_vi_tinh,
      cd.so_luong_dinh_muc, cd.so_luong_toi_thieu,
      cd.khoa_phong_id, kp.ten_khoa_phong,
      cd.can_cu_tinh_toan, cd.mua_sam_tap_trung, cd.ghi_chu,
      n.ma_nhom, n.ten_nhom, n.phan_loai, n.path, n.loai_cap
    FROM chi_tiet_dinh_muc cd
    JOIN quyet_dinh_dinh_muc qd ON qd.id = cd.quyet_dinh_id
    JOIN nhom_thiet_bi n ON n.id = cd.nhom_thiet_bi_id
    LEFT JOIN khoa_phong kp ON kp.id = cd.khoa_phong_id
    WHERE cd.quyet_dinh_id = p_quyet_dinh_id
      AND (p_don_vi IS NULL OR qd.don_vi_id = p_don_vi)
  ) c
  JOIN nhom_thiet_bi n ON n.id = c.nhom_thiet_bi_id;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_chi_tiet_list TO authenticated;
```

### 2.4 Compliance Report

```sql
-- Get compliance status for a tenant
CREATE OR REPLACE FUNCTION dinh_muc_bao_cao_tuan_thu(
  p_don_vi bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_result jsonb;
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := v_don_vi::bigint;
  END IF;

  IF p_don_vi IS NULL THEN
    RAISE EXCEPTION 'don_vi_id is required';
  END IF;

  SELECT jsonb_build_object(
    'don_vi_id', p_don_vi,
    'quyet_dinh', (
      SELECT row_to_json(qd)::jsonb
      FROM quyet_dinh_dinh_muc qd
      WHERE qd.don_vi_id = p_don_vi AND qd.trang_thai = 'active'
      LIMIT 1
    ),
    'summary', (
      SELECT jsonb_build_object(
        'total_categories', COUNT(*),
        'dat', COUNT(*) FILTER (WHERE trang_thai_tuan_thu = 'dat'),
        'thieu', COUNT(*) FILTER (WHERE trang_thai_tuan_thu = 'thieu'),
        'vuot', COUNT(*) FILTER (WHERE trang_thai_tuan_thu = 'vuot')
      )
      FROM v_so_sanh_dinh_muc
      WHERE don_vi_id = p_don_vi
    ),
    'details', (
      SELECT jsonb_agg(row_to_json(v)::jsonb)
      FROM v_so_sanh_dinh_muc v
      WHERE v.don_vi_id = p_don_vi
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION dinh_muc_bao_cao_tuan_thu TO authenticated;
```

---

## Phase 3: API Proxy Whitelist

Add to `src/app/api/rpc/[fn]/route.ts`:

```typescript
const ALLOWED_FUNCTIONS = [
  // ... existing functions ...

  // Device Quota functions
  'dinh_muc_nhom_thiet_bi_list',
  'dinh_muc_quyet_dinh_list',
  'dinh_muc_quyet_dinh_create',
  'dinh_muc_quyet_dinh_update',
  'dinh_muc_quyet_dinh_activate',
  'dinh_muc_quyet_dinh_publish',
  'dinh_muc_chi_tiet_list',
  'dinh_muc_chi_tiet_upsert',
  'dinh_muc_chi_tiet_delete',
  'dinh_muc_bao_cao_tuan_thu',
  'dinh_muc_lich_su_list',
] as const;
```

---

## Phase 4: TypeScript Types

Add to `src/types/database.ts`:

```typescript
// Device Quota Types
export interface NhomThietBiDinhMuc {
  id: number;
  parent_id: number | null;
  ma_nhom: string;
  ten_nhom: string;
  ten_nhom_en: string | null;
  loai_cap: 'cap_nhom' | 'cap_hang_muc' | 'cap_thiet_bi';
  phan_loai: 'A' | 'B' | null;
  path: string;
  thu_tu: number;
  is_leaf: boolean;
  don_vi_tinh: string | null;
  ghi_chu: string | null;
  created_at: string;
}

export interface QuyetDinhDinhMuc {
  id: number;
  don_vi_id: number;
  so_quyet_dinh: string;
  ngay_ban_hanh: string; // date
  nguoi_ky: string | null;
  chuc_vu_nguoi_ky: string | null;
  hieu_luc_tu: string; // date
  hieu_luc_den: string | null; // date
  trang_thai: 'draft' | 'active' | 'inactive';
  file_dinh_kem: string | null;
  da_cong_khai: boolean;
  ngay_cong_khai: string | null;
  ghi_chu: string | null;
  phien_ban: number;
  thay_the_cho_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChiTietDinhMuc {
  id: number;
  quyet_dinh_id: number;
  don_vi_id: number;
  nhom_thiet_bi_id: number;
  don_vi_tinh: string;
  so_luong_dinh_muc: number;
  so_luong_toi_thieu: number | null;
  khoa_phong_id: number | null;
  can_cu_tinh_toan: string | null;
  mua_sam_tap_trung: boolean;
  ghi_chu: string | null;
  created_at: string;
  updated_at: string;
}

export type TrangThaiTuanThu = 'dat' | 'thieu' | 'vuot';

export interface SoSanhDinhMuc {
  don_vi_id: number;
  quyet_dinh_id: number;
  nhom_thiet_bi_id: number;
  ten_nhom: string;
  phan_loai: 'A' | 'B' | null;
  don_vi_tinh: string;
  quota: number;
  minimum: number | null;
  actual_count: number;
  trang_thai_tuan_thu: TrangThaiTuanThu;
}
```

---

## Phase 5: TanStack Query Hooks

Create `src/hooks/useDeviceQuota.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callRpc } from '@/lib/rpc-client';
import { useSession } from '@/hooks/useSession';

export const deviceQuotaKeys = {
  all: ['device-quota'] as const,
  categories: (phanLoai?: string) => [...deviceQuotaKeys.all, 'categories', { phanLoai }] as const,
  decisions: (donViId: number, trangThai?: string) =>
    [...deviceQuotaKeys.all, 'decisions', { donViId, trangThai }] as const,
  decision: (id: number) => [...deviceQuotaKeys.all, 'decision', id] as const,
  details: (quyetDinhId: number) => [...deviceQuotaKeys.all, 'details', quyetDinhId] as const,
  compliance: (donViId: number) => [...deviceQuotaKeys.all, 'compliance', donViId] as const,
};

export function useNhomThietBiList(phanLoai?: 'A' | 'B') {
  return useQuery({
    queryKey: deviceQuotaKeys.categories(phanLoai),
    queryFn: () => callRpc({
      fn: 'dinh_muc_nhom_thiet_bi_list',
      args: { p_phan_loai: phanLoai }
    }),
  });
}

export function useQuyetDinhList(trangThai?: string) {
  const { donViId } = useSession();

  return useQuery({
    queryKey: deviceQuotaKeys.decisions(donViId!, trangThai),
    queryFn: () => callRpc({
      fn: 'dinh_muc_quyet_dinh_list',
      args: { p_trang_thai: trangThai }
    }),
    enabled: !!donViId,
  });
}

export function useChiTietList(quyetDinhId: number) {
  return useQuery({
    queryKey: deviceQuotaKeys.details(quyetDinhId),
    queryFn: () => callRpc({
      fn: 'dinh_muc_chi_tiet_list',
      args: { p_quyet_dinh_id: quyetDinhId }
    }),
    enabled: !!quyetDinhId,
  });
}

export function useComplianceReport() {
  const { donViId } = useSession();

  return useQuery({
    queryKey: deviceQuotaKeys.compliance(donViId!),
    queryFn: () => callRpc({
      fn: 'dinh_muc_bao_cao_tuan_thu',
      args: {}
    }),
    enabled: !!donViId,
  });
}

export function useCreateQuyetDinh() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuyetDinhInput) =>
      callRpc({ fn: 'dinh_muc_quyet_dinh_create', args: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all });
    },
  });
}

export function useActivateQuyetDinh() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      callRpc({ fn: 'dinh_muc_quyet_dinh_activate', args: { p_id: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all });
    },
  });
}

export function usePublishQuyetDinh() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      callRpc({ fn: 'dinh_muc_quyet_dinh_publish', args: { p_id: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all });
    },
  });
}
```

---

## Phase 6: Seed Data

Create migration for official equipment category hierarchy:

```sql
-- Seed Group A: Thiết bị y tế chuyên dùng đặc thù
INSERT INTO nhom_thiet_bi (ma_nhom, ten_nhom, ten_nhom_en, loai_cap, phan_loai, thu_tu) VALUES
('I', 'Thiết bị y tế chuyên dùng đặc thù', 'Specific Specialized Medical Equipment', 'cap_nhom', 'A', 1);

-- Get the parent ID for Group I
WITH parent AS (SELECT id FROM nhom_thiet_bi WHERE ma_nhom = 'I' AND phan_loai = 'A')
INSERT INTO nhom_thiet_bi (parent_id, ma_nhom, ten_nhom, ten_nhom_en, loai_cap, phan_loai, thu_tu)
SELECT id, 'A', 'Chẩn đoán hình ảnh', 'Imaging', 'cap_hang_muc', 'A', 1 FROM parent
UNION ALL SELECT id, 'B', 'Xét nghiệm', 'Laboratory', 'cap_hang_muc', 'A', 2 FROM parent
UNION ALL SELECT id, 'C', 'Hồi sức & Phẫu thuật', 'ICU & Surgery', 'cap_hang_muc', 'A', 3 FROM parent
UNION ALL SELECT id, 'D', 'Chuyên khoa lẻ', 'Specialty Departments', 'cap_hang_muc', 'A', 4 FROM parent;

-- Insert equipment items under each category (example for Imaging)
WITH category AS (
  SELECT id FROM nhom_thiet_bi
  WHERE ma_nhom = 'A' AND loai_cap = 'cap_hang_muc' AND phan_loai = 'A'
)
INSERT INTO nhom_thiet_bi (parent_id, ma_nhom, ten_nhom, ten_nhom_en, loai_cap, phan_loai, thu_tu, is_leaf, don_vi_tinh)
SELECT id, '1', 'Hệ thống chụp cắt lớp vi tính', 'CT Scanner System', 'cap_thiet_bi', 'A', 1, true, 'Hệ thống' FROM category
UNION ALL SELECT id, '2', 'Hệ thống chụp cộng hưởng từ', 'MRI System', 'cap_thiet_bi', 'A', 2, true, 'Hệ thống' FROM category
UNION ALL SELECT id, '3', 'Hệ thống chụp mạch số hóa xóa nền', 'DSA System', 'cap_thiet_bi', 'A', 3, true, 'Hệ thống' FROM category
UNION ALL SELECT id, '4', 'Máy X-quang kỹ thuật số chụp tổng quát', 'General Digital X-Ray', 'cap_thiet_bi', 'A', 4, true, 'Cái' FROM category
UNION ALL SELECT id, '5', 'Máy X-quang di động', 'Mobile X-Ray', 'cap_thiet_bi', 'A', 5, true, 'Cái' FROM category
UNION ALL SELECT id, '6', 'Máy X-quang C-Arm', 'C-Arm X-Ray', 'cap_thiet_bi', 'A', 6, true, 'Cái' FROM category
UNION ALL SELECT id, '7', 'Máy chụp X-quang răng toàn cảnh', 'Panoramic Dental X-Ray', 'cap_thiet_bi', 'A', 7, true, 'Cái' FROM category
UNION ALL SELECT id, '8', 'Máy siêu âm chuyên tim mạch', 'Cardiac Ultrasound', 'cap_thiet_bi', 'A', 8, true, 'Cái' FROM category
UNION ALL SELECT id, '9', 'Máy siêu âm tổng quát', 'General Ultrasound', 'cap_thiet_bi', 'A', 9, true, 'Cái' FROM category;

-- Continue for other categories (B, C, D) and Group II...
```

---

## Implementation Checklist

### Database (Priority 1)
- [ ] Create `nhom_thiet_bi` table with parent_id hierarchy
- [ ] Create `quyet_dinh_dinh_muc` table with immutability trigger
- [ ] Create `chi_tiet_dinh_muc` table with tenant isolation
- [ ] Create `lich_su_dinh_muc` append-only audit table
- [ ] Add `nhom_thiet_bi_id` to `thiet_bi` table
- [ ] Create `v_so_sanh_dinh_muc` view
- [ ] Seed equipment categories

### RPC Functions (Priority 2)
- [ ] `dinh_muc_nhom_list` - Category tree with recursive CTE
- [ ] `dinh_muc_quyet_dinh_list` - List decisions
- [ ] `dinh_muc_quyet_dinh_create` - Create decision
- [ ] `dinh_muc_quyet_dinh_activate` - Activate decision
- [ ] `dinh_muc_quyet_dinh_publish` - Mark as public
- [ ] `dinh_muc_chi_tiet_upsert` - Add/update line items
- [ ] `dinh_muc_chi_tiet_list` - List details
- [ ] `dinh_muc_bao_cao_tuan_thu` - Compliance report

### API Layer (Priority 3)
- [ ] Add functions to `ALLOWED_FUNCTIONS` whitelist
- [ ] Add TypeScript types
- [ ] Create TanStack Query hooks

### UI (Priority 4)
- [ ] Quota decision list page
- [ ] Decision create/edit dialog
- [ ] Tree-table for equipment categories
- [ ] Line item management
- [ ] Compliance dashboard
- [ ] PDF export for Ministry portal

---

## Security Considerations (From Backend Security Review)

1. **Immutability**: Published decisions cannot be modified (enforced by trigger)
2. **Audit Trail**: All changes logged with user info and timestamps
3. **Tenant Isolation**: All functions enforce `don_vi_id` from JWT claims
4. **Role-Based Access**:
   - `global/admin`: Full access across tenants
   - `regional_leader`: Read-only, multi-tenant
   - `to_qltb`: Full CRUD for own tenant
   - Others: Read-only for own tenant
5. **Input Validation**: CHECK constraints on enums, positive quantities

---

## References

- [Knowledge Base](./device-quota-knowledge-2025.md)
- [Circular 46/2025/TT-BYT](https://notebooklm.google.com/notebook/a6de7cf9-ba0d-42e4-8d39-2f4a668add48)
- [Project CLAUDE.md](../../CLAUDE.md) - Security architecture
