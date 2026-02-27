# Device Quota Mapping Feature - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a split-screen interface for mapping equipment to quota categories with AI suggestions, enabling compliance visibility without enforcement.

**Architecture:** New `/device-quota` route group with 3 sub-pages (Dashboard, Mapping, Decisions). Context-driven component pattern following RepairRequests. RPC-only data access with tenant isolation. Gemini AI for category suggestions.

**Tech Stack:** Next.js 15, React 18, TanStack Query v5, Radix UI, Tailwind CSS, Supabase PostgreSQL, Gemini API

---

## Prerequisites

- [ ] Read `docs/device-quota/` folder for full context
- [ ] Ensure Supabase CLI is linked: `npx supabase db remote list`
- [ ] Gemini API key available in environment

---

## Phase 1: Database Schema

### Task 1.1: Create Equipment Category Table

**Files:**
- Create: `supabase/migrations/20260131_device_quota_schema.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Device Quota Schema
-- Description: Tables for equipment quota management

-- Enable btree_gist for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================
-- Table: nhom_thiet_bi (Equipment Categories)
-- ============================================
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
  created_by BIGINT,
  updated_by BIGINT,
  UNIQUE (don_vi_id, ma_nhom)
);

CREATE INDEX idx_nhom_thiet_bi_don_vi ON public.nhom_thiet_bi(don_vi_id);
CREATE INDEX idx_nhom_thiet_bi_parent ON public.nhom_thiet_bi(parent_id);

COMMENT ON TABLE public.nhom_thiet_bi IS 'Equipment categories for quota management per Circular 08/2019';
```

**Step 2: Run migration locally**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260131_device_quota_schema.sql
git commit -m "feat(db): add nhom_thiet_bi table for equipment categories"
```

---

### Task 1.2: Create Quota Decision Tables

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_schema.sql`

**Step 1: Add decision tables to migration**

```sql
-- ============================================
-- Table: quyet_dinh_dinh_muc (Quota Decisions)
-- ============================================
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
  created_by BIGINT,
  updated_by BIGINT,
  UNIQUE (don_vi_id, so_quyet_dinh)
);

CREATE INDEX idx_quyet_dinh_don_vi ON public.quyet_dinh_dinh_muc(don_vi_id);
CREATE INDEX idx_quyet_dinh_trang_thai ON public.quyet_dinh_dinh_muc(trang_thai);

-- ============================================
-- Table: chi_tiet_dinh_muc (Quota Line Items)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chi_tiet_dinh_muc (
  id BIGSERIAL PRIMARY KEY,
  quyet_dinh_id BIGINT NOT NULL REFERENCES public.quyet_dinh_dinh_muc(id) ON DELETE CASCADE,
  nhom_thiet_bi_id BIGINT NOT NULL REFERENCES public.nhom_thiet_bi(id) ON DELETE CASCADE,
  so_luong_toi_da INT NOT NULL DEFAULT 0,
  so_luong_toi_thieu INT DEFAULT 0,
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (quyet_dinh_id, nhom_thiet_bi_id)
);

CREATE INDEX idx_chi_tiet_quyet_dinh ON public.chi_tiet_dinh_muc(quyet_dinh_id);
CREATE INDEX idx_chi_tiet_nhom ON public.chi_tiet_dinh_muc(nhom_thiet_bi_id);

COMMENT ON TABLE public.quyet_dinh_dinh_muc IS 'Quota decisions issued by facility director per Circular 46/2025';
COMMENT ON TABLE public.chi_tiet_dinh_muc IS 'Quota limits per equipment category within a decision';
```

**Step 2: Run migration**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260131_device_quota_schema.sql
git commit -m "feat(db): add quyet_dinh_dinh_muc and chi_tiet_dinh_muc tables"
```

---

### Task 1.3: Add Equipment Category Link Column

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_schema.sql`

**Step 1: Add nhom_thiet_bi_id to thiet_bi table**

```sql
-- ============================================
-- Alter: thiet_bi - Add category link
-- ============================================
ALTER TABLE public.thiet_bi
ADD COLUMN IF NOT EXISTS nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_nhom ON public.thiet_bi(nhom_thiet_bi_id);

COMMENT ON COLUMN public.thiet_bi.nhom_thiet_bi_id IS 'Link to equipment category for quota tracking';
```

**Step 2: Run migration**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260131_device_quota_schema.sql
git commit -m "feat(db): add nhom_thiet_bi_id column to thiet_bi table"
```

---

### Task 1.4: Create Audit Log Table

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_schema.sql`

**Step 1: Add audit log table**

```sql
-- ============================================
-- Table: thiet_bi_nhom_audit_log (Link/Unlink Audit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.thiet_bi_nhom_audit_log (
  id BIGSERIAL PRIMARY KEY,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id) ON DELETE CASCADE,
  thiet_bi_ids BIGINT[] NOT NULL,
  nhom_thiet_bi_id BIGINT REFERENCES public.nhom_thiet_bi(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('link', 'unlink')),
  performed_by BIGINT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_log_don_vi ON public.thiet_bi_nhom_audit_log(don_vi_id);
CREATE INDEX idx_audit_log_performed_at ON public.thiet_bi_nhom_audit_log(performed_at DESC);

COMMENT ON TABLE public.thiet_bi_nhom_audit_log IS 'Audit trail for equipment category link/unlink operations';
```

**Step 2: Run migration**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260131_device_quota_schema.sql
git commit -m "feat(db): add thiet_bi_nhom_audit_log table"
```

---

## Phase 2: RPC Functions

### Task 2.1: Category List RPC

**Files:**
- Create: `supabase/migrations/20260131_device_quota_rpcs.sql`

**Step 1: Write the RPC function**

```sql
-- ============================================
-- RPC: dinh_muc_nhom_list
-- Description: List equipment categories with quota counts
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_list(
  p_don_vi BIGINT DEFAULT NULL,
  p_quyet_dinh_id BIGINT DEFAULT NULL
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
  so_luong_toi_da INT,
  so_luong_toi_thieu INT,
  so_luong_hien_co BIGINT,
  trang_thai_tuan_thu TEXT,
  level INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_effective_don_vi BIGINT;
BEGIN
  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Root nodes
    SELECT
      n.id, n.parent_id, n.ma_nhom, n.ten_nhom, n.phan_loai,
      n.don_vi_tinh, n.thu_tu_hien_thi, n.mo_ta, n.tu_khoa,
      1 as level
    FROM nhom_thiet_bi n
    WHERE n.don_vi_id = v_effective_don_vi AND n.parent_id IS NULL

    UNION ALL

    -- Child nodes
    SELECT
      n.id, n.parent_id, n.ma_nhom, n.ten_nhom, n.phan_loai,
      n.don_vi_tinh, n.thu_tu_hien_thi, n.mo_ta, n.tu_khoa,
      ct.level + 1
    FROM nhom_thiet_bi n
    INNER JOIN category_tree ct ON n.parent_id = ct.id
    WHERE n.don_vi_id = v_effective_don_vi
  ),
  quota_data AS (
    SELECT
      cd.nhom_thiet_bi_id,
      cd.so_luong_toi_da,
      cd.so_luong_toi_thieu
    FROM chi_tiet_dinh_muc cd
    WHERE cd.quyet_dinh_id = p_quyet_dinh_id
  ),
  equipment_counts AS (
    SELECT
      t.nhom_thiet_bi_id,
      COUNT(*)::BIGINT as count
    FROM thiet_bi t
    WHERE t.don_vi = v_effective_don_vi
      AND t.nhom_thiet_bi_id IS NOT NULL
    GROUP BY t.nhom_thiet_bi_id
  )
  SELECT
    ct.id,
    ct.parent_id,
    ct.ma_nhom,
    ct.ten_nhom,
    ct.phan_loai,
    ct.don_vi_tinh,
    ct.thu_tu_hien_thi,
    ct.mo_ta,
    ct.tu_khoa,
    COALESCE(qd.so_luong_toi_da, 0)::INT,
    COALESCE(qd.so_luong_toi_thieu, 0)::INT,
    COALESCE(ec.count, 0)::BIGINT,
    CASE
      WHEN ec.count IS NULL OR ec.count = 0 THEN
        CASE WHEN COALESCE(qd.so_luong_toi_thieu, 0) > 0 THEN 'thieu' ELSE 'dat' END
      WHEN ec.count > COALESCE(qd.so_luong_toi_da, 0) AND COALESCE(qd.so_luong_toi_da, 0) > 0 THEN 'vuot'
      WHEN ec.count < COALESCE(qd.so_luong_toi_thieu, 0) THEN 'thieu'
      ELSE 'dat'
    END::TEXT,
    ct.level
  FROM category_tree ct
  LEFT JOIN quota_data qd ON qd.nhom_thiet_bi_id = ct.id
  LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = ct.id
  ORDER BY ct.level, ct.thu_tu_hien_thi, ct.ma_nhom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_nhom_list TO authenticated;
```

**Step 2: Run migration**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260131_device_quota_rpcs.sql
git commit -m "feat(rpc): add dinh_muc_nhom_list function"
```

---

### Task 2.2: Unassigned Equipment RPC

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_rpcs.sql`

**Step 1: Add unassigned equipment function**

```sql
-- ============================================
-- RPC: dinh_muc_thiet_bi_chua_phan_loai
-- Description: List equipment without category assignment
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_chua_phan_loai(
  p_don_vi BIGINT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  ma_thiet_bi TEXT,
  ten_thiet_bi TEXT,
  model TEXT,
  serial TEXT,
  hang_san_xuat TEXT,
  khoa_phong_quan_ly TEXT,
  tinh_trang TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_effective_don_vi BIGINT;
  v_total BIGINT;
BEGIN
  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM thiet_bi t
  WHERE t.don_vi = v_effective_don_vi
    AND t.nhom_thiet_bi_id IS NULL
    AND (p_search IS NULL OR p_search = '' OR
         t.ten_thiet_bi ILIKE '%' || p_search || '%' OR
         t.ma_thiet_bi ILIKE '%' || p_search || '%' OR
         t.model ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    t.id,
    t.ma_thiet_bi,
    t.ten_thiet_bi,
    t.model,
    COALESCE(t.serial, t.serial_number) as serial,
    t.hang_san_xuat,
    t.khoa_phong_quan_ly,
    COALESCE(t.tinh_trang, t.tinh_trang_hien_tai) as tinh_trang,
    v_total
  FROM thiet_bi t
  WHERE t.don_vi = v_effective_don_vi
    AND t.nhom_thiet_bi_id IS NULL
    AND (p_search IS NULL OR p_search = '' OR
         t.ten_thiet_bi ILIKE '%' || p_search || '%' OR
         t.ma_thiet_bi ILIKE '%' || p_search || '%' OR
         t.model ILIKE '%' || p_search || '%')
  ORDER BY t.ten_thiet_bi
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_chua_phan_loai TO authenticated;
```

**Step 2: Run migration and commit**

```bash
node scripts/npm-run.js npx supabase db push --linked
git add supabase/migrations/20260131_device_quota_rpcs.sql
git commit -m "feat(rpc): add dinh_muc_thiet_bi_chua_phan_loai function"
```

---

### Task 2.3: Link/Unlink Equipment RPC

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_rpcs.sql`

**Step 1: Add link/unlink function**

```sql
-- ============================================
-- RPC: dinh_muc_thiet_bi_link
-- Description: Link or unlink equipment to/from category
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_link(
  p_thiet_bi_ids BIGINT[],
  p_nhom_thiet_bi_id BIGINT DEFAULT NULL, -- NULL = unlink
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_effective_don_vi BIGINT;
  v_action TEXT;
  v_updated_count INT;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions. Required: global, admin, or to_qltb';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  -- Validate category belongs to tenant (if linking)
  IF p_nhom_thiet_bi_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM nhom_thiet_bi
      WHERE id = p_nhom_thiet_bi_id AND don_vi_id = v_effective_don_vi
    ) THEN
      RAISE EXCEPTION 'Category not found or does not belong to this facility';
    END IF;
    v_action := 'link';
  ELSE
    v_action := 'unlink';
  END IF;

  -- Update equipment
  UPDATE thiet_bi
  SET
    nhom_thiet_bi_id = p_nhom_thiet_bi_id,
    updated_at = NOW()
  WHERE id = ANY(p_thiet_bi_ids)
    AND don_vi = v_effective_don_vi;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Audit log
  INSERT INTO thiet_bi_nhom_audit_log (
    don_vi_id,
    thiet_bi_ids,
    nhom_thiet_bi_id,
    action,
    performed_by,
    metadata
  ) VALUES (
    v_effective_don_vi,
    p_thiet_bi_ids,
    p_nhom_thiet_bi_id,
    v_action,
    v_user_id::BIGINT,
    jsonb_build_object('updated_count', v_updated_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'action', v_action,
    'updated_count', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_link TO authenticated;
```

**Step 2: Run migration and commit**

```bash
node scripts/npm-run.js npx supabase db push --linked
git add supabase/migrations/20260131_device_quota_rpcs.sql
git commit -m "feat(rpc): add dinh_muc_thiet_bi_link function for link/unlink"
```

---

### Task 2.4: Quota Decision CRUD RPCs

**Files:**
- Modify: `supabase/migrations/20260131_device_quota_rpcs.sql`

**Step 1: Add decision CRUD functions**

```sql
-- ============================================
-- RPC: dinh_muc_quyet_dinh_list
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_list(
  p_don_vi BIGINT DEFAULT NULL,
  p_trang_thai TEXT DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  so_quyet_dinh TEXT,
  ngay_ban_hanh DATE,
  ngay_hieu_luc DATE,
  ngay_het_hieu_luc DATE,
  nguoi_ky TEXT,
  chuc_vu_nguoi_ky TEXT,
  trang_thai TEXT,
  ghi_chu TEXT,
  created_at TIMESTAMPTZ,
  so_danh_muc BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_effective_don_vi BIGINT;
BEGIN
  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.so_quyet_dinh,
    q.ngay_ban_hanh,
    q.ngay_hieu_luc,
    q.ngay_het_hieu_luc,
    q.nguoi_ky,
    q.chuc_vu_nguoi_ky,
    q.trang_thai,
    q.ghi_chu,
    q.created_at,
    COUNT(cd.id)::BIGINT as so_danh_muc
  FROM quyet_dinh_dinh_muc q
  LEFT JOIN chi_tiet_dinh_muc cd ON cd.quyet_dinh_id = q.id
  WHERE q.don_vi_id = v_effective_don_vi
    AND (p_trang_thai IS NULL OR q.trang_thai = p_trang_thai)
  GROUP BY q.id
  ORDER BY q.ngay_hieu_luc DESC, q.created_at DESC;
END;
$$;

-- ============================================
-- RPC: dinh_muc_quyet_dinh_create
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_create(
  p_so_quyet_dinh TEXT,
  p_ngay_ban_hanh DATE,
  p_ngay_hieu_luc DATE,
  p_nguoi_ky TEXT,
  p_chuc_vu_nguoi_ky TEXT,
  p_ghi_chu TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_effective_don_vi BIGINT;
  v_new_id BIGINT;
BEGIN
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  INSERT INTO quyet_dinh_dinh_muc (
    don_vi_id, so_quyet_dinh, ngay_ban_hanh, ngay_hieu_luc,
    nguoi_ky, chuc_vu_nguoi_ky, ghi_chu, trang_thai, created_by
  ) VALUES (
    v_effective_don_vi, p_so_quyet_dinh, p_ngay_ban_hanh, p_ngay_hieu_luc,
    p_nguoi_ky, p_chuc_vu_nguoi_ky, p_ghi_chu, 'draft', v_user_id::BIGINT
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ============================================
-- RPC: dinh_muc_quyet_dinh_activate
-- ============================================
CREATE OR REPLACE FUNCTION public.dinh_muc_quyet_dinh_activate(
  p_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_effective_don_vi BIGINT;
BEGIN
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF v_role NOT IN ('global', 'admin') THEN
    v_effective_don_vi := v_don_vi::BIGINT;
  ELSE
    v_effective_don_vi := COALESCE(p_don_vi, v_don_vi::BIGINT);
  END IF;

  -- Deactivate current active decision
  UPDATE quyet_dinh_dinh_muc
  SET trang_thai = 'inactive', updated_at = NOW()
  WHERE don_vi_id = v_effective_don_vi AND trang_thai = 'active';

  -- Activate selected decision
  UPDATE quyet_dinh_dinh_muc
  SET trang_thai = 'active', updated_at = NOW()
  WHERE id = p_id AND don_vi_id = v_effective_don_vi;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_list TO authenticated;
GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_create TO authenticated;
GRANT EXECUTE ON FUNCTION public.dinh_muc_quyet_dinh_activate TO authenticated;
```

**Step 2: Run migration and commit**

```bash
node scripts/npm-run.js npx supabase db push --linked
git add supabase/migrations/20260131_device_quota_rpcs.sql
git commit -m "feat(rpc): add quota decision CRUD functions"
```

---

### Task 2.5: Add Functions to ALLOWED_FUNCTIONS

**Files:**
- Modify: `src/app/api/rpc/[fn]/route.ts`

**Step 1: Add new functions to whitelist**

Find the `ALLOWED_FUNCTIONS` Set and add:

```typescript
// Device Quota
'dinh_muc_nhom_list',
'dinh_muc_thiet_bi_chua_phan_loai',
'dinh_muc_thiet_bi_link',
'dinh_muc_quyet_dinh_list',
'dinh_muc_quyet_dinh_create',
'dinh_muc_quyet_dinh_activate',
'dinh_muc_assigned_equipment_list',
```

**Step 2: Commit**

```bash
git add src/app/api/rpc/[fn]/route.ts
git commit -m "feat(api): whitelist device quota RPC functions"
```

---

## Phase 3: TypeScript Types

### Task 3.1: Create Device Quota Types

**Files:**
- Create: `src/app/(app)/device-quota/types.ts`

**Step 1: Write the types file**

```typescript
// ============================================
// Device Quota Types
// ============================================

export interface NhomThietBi {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
  phan_loai: 'A' | 'B'
  don_vi_tinh: string
  thu_tu_hien_thi: number
  mo_ta: string | null
  tu_khoa: string[] | null
  // Computed from RPC
  so_luong_toi_da: number
  so_luong_toi_thieu: number
  so_luong_hien_co: number
  trang_thai_tuan_thu: 'dat' | 'thieu' | 'vuot'
  level: number
  // UI state
  children?: NhomThietBi[]
  isExpanded?: boolean
}

export interface QuyetDinhDinhMuc {
  id: number
  so_quyet_dinh: string
  ngay_ban_hanh: string
  ngay_hieu_luc: string
  ngay_het_hieu_luc: string | null
  nguoi_ky: string
  chuc_vu_nguoi_ky: string
  trang_thai: 'draft' | 'active' | 'inactive'
  ghi_chu: string | null
  created_at: string
  so_danh_muc: number
}

export interface ChiTietDinhMuc {
  id: number
  quyet_dinh_id: number
  nhom_thiet_bi_id: number
  so_luong_toi_da: number
  so_luong_toi_thieu: number
  ghi_chu: string | null
}

export interface ThietBiChuaPhanLoai {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
  total_count: number
  // AI suggestion state
  ai_suggestion?: AISuggestion | null
  ai_loading?: boolean
}

export interface AISuggestion {
  category_id: number
  category_name: string
  confidence: number
  reason: string
}

export interface ThietBiDaPhanLoai {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
}

export interface LinkUnlinkResult {
  success: boolean
  action: 'link' | 'unlink'
  updated_count: number
}

export interface ComplianceSummary {
  total_categories: number
  dat: number
  thieu: number
  vuot: number
}

// Dialog state for context
export interface DeviceQuotaDialogState {
  isCreateDecisionOpen: boolean
  isImportExcelOpen: boolean
  selectedEquipmentIds: number[]
  selectedCategoryId: number | null
}

// Session user type (reuse from database.ts)
export type { SessionUser } from '@/types/database'
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/types.ts
git commit -m "feat(types): add device quota TypeScript interfaces"
```

---

## Phase 4: Frontend Components

### Task 4.1: Create Page Structure

**Files:**
- Create: `src/app/(app)/device-quota/page.tsx`
- Create: `src/app/(app)/device-quota/mapping/page.tsx`
- Create: `src/app/(app)/device-quota/decisions/page.tsx`

**Step 1: Create main page (dashboard redirect)**

```typescript
// src/app/(app)/device-quota/page.tsx
import { redirect } from 'next/navigation'

export default function DeviceQuotaPage() {
  redirect('/device-quota/mapping')
}
```

**Step 2: Create mapping page**

```typescript
// src/app/(app)/device-quota/mapping/page.tsx
import { DeviceQuotaMappingPageClient } from '../_components/DeviceQuotaMappingPageClient'

export default function DeviceQuotaMappingPage() {
  return <DeviceQuotaMappingPageClient />
}
```

**Step 3: Create decisions page**

```typescript
// src/app/(app)/device-quota/decisions/page.tsx
import { DeviceQuotaDecisionsPageClient } from '../_components/DeviceQuotaDecisionsPageClient'

export default function DeviceQuotaDecisionsPage() {
  return <DeviceQuotaDecisionsPageClient />
}
```

**Step 4: Commit**

```bash
git add src/app/(app)/device-quota/
git commit -m "feat(pages): add device quota page structure"
```

---

### Task 4.2: Create Context Provider

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaContext.tsx`
- Create: `src/app/(app)/device-quota/_hooks/useDeviceQuotaContext.ts`

**Step 1: Write the context**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaContext.tsx
"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import type {
  NhomThietBi,
  QuyetDinhDinhMuc,
  ThietBiChuaPhanLoai,
  DeviceQuotaDialogState,
  LinkUnlinkResult,
  SessionUser,
} from "../types"

// ============================================
// Query Keys
// ============================================
export const deviceQuotaKeys = {
  all: ['device-quota'] as const,
  decisions: (donViId?: number) => [...deviceQuotaKeys.all, 'decisions', donViId] as const,
  categories: (donViId?: number, quyetDinhId?: number) =>
    [...deviceQuotaKeys.all, 'categories', donViId, quyetDinhId] as const,
  unassigned: (donViId?: number, search?: string) =>
    [...deviceQuotaKeys.all, 'unassigned', donViId, search] as const,
  assigned: (nhomId?: number) =>
    [...deviceQuotaKeys.all, 'assigned', nhomId] as const,
}

// ============================================
// Context Types
// ============================================
interface DeviceQuotaContextValue {
  // User/Auth
  user: SessionUser | null
  canEdit: boolean

  // Active decision
  activeDecision: QuyetDinhDinhMuc | null
  setActiveDecisionId: (id: number | null) => void

  // Queries
  decisionsQuery: ReturnType<typeof useDecisionsQuery>
  categoriesQuery: ReturnType<typeof useCategoriesQuery>
  unassignedQuery: ReturnType<typeof useUnassignedQuery>

  // Mutations
  linkMutation: ReturnType<typeof useLinkMutation>

  // Dialog state
  dialogState: DeviceQuotaDialogState
  setDialogState: React.Dispatch<React.SetStateAction<DeviceQuotaDialogState>>

  // Selection state
  selectedEquipmentIds: number[]
  setSelectedEquipmentIds: React.Dispatch<React.SetStateAction<number[]>>
  selectedCategoryId: number | null
  setSelectedCategoryId: React.Dispatch<React.SetStateAction<number | null>>

  // Search
  unassignedSearch: string
  setUnassignedSearch: React.Dispatch<React.SetStateAction<string>>

  // Actions
  handleLink: () => Promise<void>
  handleUnlink: (equipmentIds: number[]) => Promise<void>
  invalidateAll: () => void
}

// ============================================
// Query Hooks
// ============================================
function useDecisionsQuery(donViId?: number) {
  return useQuery({
    queryKey: deviceQuotaKeys.decisions(donViId),
    queryFn: () => callRpc<QuyetDinhDinhMuc[]>({
      fn: 'dinh_muc_quyet_dinh_list',
      args: {}
    }),
    enabled: !!donViId,
  })
}

function useCategoriesQuery(donViId?: number, quyetDinhId?: number) {
  return useQuery({
    queryKey: deviceQuotaKeys.categories(donViId, quyetDinhId),
    queryFn: () => callRpc<NhomThietBi[]>({
      fn: 'dinh_muc_nhom_list',
      args: { p_quyet_dinh_id: quyetDinhId }
    }),
    enabled: !!donViId && !!quyetDinhId,
  })
}

function useUnassignedQuery(donViId?: number, search?: string) {
  return useQuery({
    queryKey: deviceQuotaKeys.unassigned(donViId, search),
    queryFn: () => callRpc<ThietBiChuaPhanLoai[]>({
      fn: 'dinh_muc_thiet_bi_chua_phan_loai',
      args: { p_search: search || null }
    }),
    enabled: !!donViId,
  })
}

function useLinkMutation(
  toast: ReturnType<typeof useToast>["toast"],
  invalidate: () => void
) {
  return useMutation({
    mutationFn: async (args: {
      thiet_bi_ids: number[],
      nhom_thiet_bi_id: number | null
    }) => {
      return callRpc<LinkUnlinkResult>({
        fn: 'dinh_muc_thiet_bi_link',
        args: {
          p_thiet_bi_ids: args.thiet_bi_ids,
          p_nhom_thiet_bi_id: args.nhom_thiet_bi_id
        }
      })
    },
    onSuccess: (result) => {
      toast({
        title: result.action === 'link' ? 'Đã liên kết' : 'Đã hủy liên kết',
        description: `${result.updated_count} thiết bị đã được cập nhật`,
      })
      invalidate()
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: error.message,
      })
    },
  })
}

// ============================================
// Context
// ============================================
const DeviceQuotaContext = React.createContext<DeviceQuotaContextValue | null>(null)

// ============================================
// Provider
// ============================================
interface DeviceQuotaProviderProps {
  children: React.ReactNode
}

export function DeviceQuotaProvider({ children }: DeviceQuotaProviderProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user as SessionUser | null

  const donViId = user?.don_vi ? Number(user.don_vi) : undefined
  const canEdit = user?.role === 'global' || user?.role === 'admin' || user?.role === 'to_qltb'

  // State
  const [activeDecisionId, setActiveDecisionId] = React.useState<number | null>(null)
  const [selectedEquipmentIds, setSelectedEquipmentIds] = React.useState<number[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null)
  const [unassignedSearch, setUnassignedSearch] = React.useState('')
  const [dialogState, setDialogState] = React.useState<DeviceQuotaDialogState>({
    isCreateDecisionOpen: false,
    isImportExcelOpen: false,
    selectedEquipmentIds: [],
    selectedCategoryId: null,
  })

  // Queries
  const decisionsQuery = useDecisionsQuery(donViId)
  const categoriesQuery = useCategoriesQuery(donViId, activeDecisionId ?? undefined)
  const unassignedQuery = useUnassignedQuery(donViId, unassignedSearch)

  // Set active decision from query
  React.useEffect(() => {
    if (decisionsQuery.data && !activeDecisionId) {
      const active = decisionsQuery.data.find(d => d.trang_thai === 'active')
      if (active) {
        setActiveDecisionId(active.id)
      }
    }
  }, [decisionsQuery.data, activeDecisionId])

  const activeDecision = React.useMemo(() => {
    return decisionsQuery.data?.find(d => d.id === activeDecisionId) ?? null
  }, [decisionsQuery.data, activeDecisionId])

  // Invalidation
  const invalidateAll = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: deviceQuotaKeys.all })
  }, [queryClient])

  // Mutations
  const linkMutation = useLinkMutation(toast, invalidateAll)

  // Actions
  const handleLink = React.useCallback(async () => {
    if (selectedEquipmentIds.length === 0 || !selectedCategoryId) {
      toast({
        variant: 'destructive',
        title: 'Chưa chọn đủ',
        description: 'Vui lòng chọn thiết bị và nhóm định mức',
      })
      return
    }

    await linkMutation.mutateAsync({
      thiet_bi_ids: selectedEquipmentIds,
      nhom_thiet_bi_id: selectedCategoryId,
    })

    setSelectedEquipmentIds([])
  }, [selectedEquipmentIds, selectedCategoryId, linkMutation, toast])

  const handleUnlink = React.useCallback(async (equipmentIds: number[]) => {
    await linkMutation.mutateAsync({
      thiet_bi_ids: equipmentIds,
      nhom_thiet_bi_id: null,
    })
  }, [linkMutation])

  // Context value
  const value = React.useMemo<DeviceQuotaContextValue>(() => ({
    user,
    canEdit,
    activeDecision,
    setActiveDecisionId,
    decisionsQuery,
    categoriesQuery,
    unassignedQuery,
    linkMutation,
    dialogState,
    setDialogState,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
    selectedCategoryId,
    setSelectedCategoryId,
    unassignedSearch,
    setUnassignedSearch,
    handleLink,
    handleUnlink,
    invalidateAll,
  }), [
    user, canEdit, activeDecision, decisionsQuery, categoriesQuery,
    unassignedQuery, linkMutation, dialogState, selectedEquipmentIds,
    selectedCategoryId, unassignedSearch, handleLink, handleUnlink, invalidateAll
  ])

  return (
    <DeviceQuotaContext.Provider value={value}>
      {children}
    </DeviceQuotaContext.Provider>
  )
}

export { DeviceQuotaContext }
```

**Step 2: Write the hook**

```typescript
// src/app/(app)/device-quota/_hooks/useDeviceQuotaContext.ts
"use client"

import * as React from "react"
import { DeviceQuotaContext } from "../_components/DeviceQuotaContext"

export function useDeviceQuotaContext() {
  const context = React.useContext(DeviceQuotaContext)
  if (!context) {
    throw new Error("useDeviceQuotaContext must be used within DeviceQuotaProvider")
  }
  return context
}
```

**Step 3: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaContext.tsx
git add src/app/(app)/device-quota/_hooks/useDeviceQuotaContext.ts
git commit -m "feat(context): add DeviceQuotaContext with queries and mutations"
```

---

### Task 4.3: Create Mapping Page Client

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaMappingPageClient.tsx`

**Step 1: Write the page client component**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaMappingPageClient.tsx
"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { DeviceQuotaProvider } from "./DeviceQuotaContext"
import { DeviceQuotaMappingContent } from "./DeviceQuotaMappingContent"

export function DeviceQuotaMappingPageClient() {
  const { status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <DeviceQuotaProvider>
      <DeviceQuotaMappingContent />
    </DeviceQuotaProvider>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaMappingPageClient.tsx
git commit -m "feat(ui): add DeviceQuotaMappingPageClient wrapper"
```

---

### Task 4.4: Create Split-Screen Mapping Content

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaMappingContent.tsx`

**Step 1: Write the split-screen layout**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaMappingContent.tsx
"use client"

import * as React from "react"
import { FileDown, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDeviceQuotaContext } from "../_hooks/useDeviceQuotaContext"
import { DeviceQuotaCategoryTree } from "./DeviceQuotaCategoryTree"
import { DeviceQuotaUnassignedList } from "./DeviceQuotaUnassignedList"
import { DeviceQuotaDecisionSelector } from "./DeviceQuotaDecisionSelector"

export function DeviceQuotaMappingContent() {
  const {
    canEdit,
    activeDecision,
    selectedEquipmentIds,
    selectedCategoryId,
    handleLink,
    linkMutation,
  } = useDeviceQuotaContext()

  const canLink = canEdit && selectedEquipmentIds.length > 0 && selectedCategoryId !== null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ánh xạ thiết bị vào định mức</h1>
          <p className="text-muted-foreground">
            Liên kết thiết bị với danh mục định mức theo quyết định
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeviceQuotaDecisionSelector />
          <Button variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* Split Screen */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Panel - Category Tree */}
        <Card className="lg:h-[calc(100vh-220px)] lg:overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Danh mục định mức</CardTitle>
            <CardDescription>
              {activeDecision
                ? `Quyết định: ${activeDecision.so_quyet_dinh}`
                : 'Chưa chọn quyết định'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="lg:h-[calc(100%-100px)] lg:overflow-auto">
            <DeviceQuotaCategoryTree />
          </CardContent>
        </Card>

        {/* Right Panel - Unassigned Equipment */}
        <Card className="lg:h-[calc(100vh-220px)] lg:overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Thiết bị chưa phân loại</CardTitle>
                <CardDescription>
                  Đã chọn: {selectedEquipmentIds.length} thiết bị
                </CardDescription>
              </div>
              {canEdit && (
                <Button
                  onClick={handleLink}
                  disabled={!canLink || linkMutation.isPending}
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Link {selectedEquipmentIds.length > 0 && `(${selectedEquipmentIds.length})`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="lg:h-[calc(100%-100px)] lg:overflow-auto">
            <DeviceQuotaUnassignedList />
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <p className="text-sm text-muted-foreground text-center">
        Chọn thiết bị bên phải, sau đó chọn nhóm bên trái và nhấn &quot;Link&quot;
      </p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaMappingContent.tsx
git commit -m "feat(ui): add split-screen DeviceQuotaMappingContent"
```

---

### Task 4.5: Create Category Tree Component

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaCategoryTree.tsx`

**Step 1: Write the tree component**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaCategoryTree.tsx
"use client"

import * as React from "react"
import { ChevronRight, ChevronDown, CheckCircle, AlertTriangle, XCircle, Loader2, Unlink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDeviceQuotaContext } from "../_hooks/useDeviceQuotaContext"
import type { NhomThietBi } from "../types"

// Build tree structure from flat list
function buildTree(items: NhomThietBi[]): NhomThietBi[] {
  const map = new Map<number, NhomThietBi>()
  const roots: NhomThietBi[] = []

  items.forEach(item => {
    map.set(item.id, { ...item, children: [] })
  })

  items.forEach(item => {
    const node = map.get(item.id)!
    if (item.parent_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(item.parent_id)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    }
  })

  return roots
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'dat':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'thieu':
      return <AlertTriangle className="h-4 w-4 text-amber-600" />
    case 'vuot':
      return <XCircle className="h-4 w-4 text-red-600" />
    default:
      return null
  }
}

interface TreeNodeProps {
  node: NhomThietBi
  level: number
  selectedId: number | null
  onSelect: (id: number) => void
  expandedIds: Set<number>
  onToggleExpand: (id: number) => void
}

function TreeNode({ node, level, selectedId, onSelect, expandedIds, onToggleExpand }: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedId === node.id
  const isLeaf = !hasChildren

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer hover:bg-muted/50",
          isSelected && "bg-primary/10 border border-primary/20",
          !isLeaf && "font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => isLeaf && onSelect(node.id)}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Category info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate">{node.ten_nhom}</span>
            {node.phan_loai && (
              <Badge variant="outline" className="text-xs">
                {node.phan_loai}
              </Badge>
            )}
          </div>
        </div>

        {/* Quota status */}
        {isLeaf && (
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              "font-mono",
              node.trang_thai_tuan_thu === 'dat' && "text-green-600",
              node.trang_thai_tuan_thu === 'thieu' && "text-amber-600",
              node.trang_thai_tuan_thu === 'vuot' && "text-red-600",
            )}>
              {node.so_luong_hien_co}/{node.so_luong_toi_da}
            </span>
            <StatusIcon status={node.trang_thai_tuan_thu} />
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DeviceQuotaCategoryTree() {
  const {
    categoriesQuery,
    selectedCategoryId,
    setSelectedCategoryId,
  } = useDeviceQuotaContext()

  const [expandedIds, setExpandedIds] = React.useState<Set<number>>(new Set())

  const tree = React.useMemo(() => {
    if (!categoriesQuery.data) return []
    return buildTree(categoriesQuery.data)
  }, [categoriesQuery.data])

  // Auto-expand first level
  React.useEffect(() => {
    if (tree.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(tree.map(n => n.id)))
    }
  }, [tree, expandedIds.size])

  const handleToggleExpand = React.useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!categoriesQuery.data || categoriesQuery.data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Chưa có danh mục định mức. Vui lòng tạo quyết định mới.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {tree.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
        />
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaCategoryTree.tsx
git commit -m "feat(ui): add DeviceQuotaCategoryTree with expand/collapse"
```

---

### Task 4.6: Create Unassigned Equipment List

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaUnassignedList.tsx`

**Step 1: Write the component**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaUnassignedList.tsx
"use client"

import * as React from "react"
import { Search, Loader2, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useDeviceQuotaContext } from "../_hooks/useDeviceQuotaContext"
import { useDebounce } from "@/hooks/use-debounce"
import type { ThietBiChuaPhanLoai } from "../types"

interface EquipmentCardProps {
  equipment: ThietBiChuaPhanLoai
  isSelected: boolean
  onToggle: (id: number) => void
  canEdit: boolean
}

function EquipmentCard({ equipment, isSelected, onToggle, canEdit }: EquipmentCardProps) {
  const [isLoadingAI, setIsLoadingAI] = React.useState(false)
  const [aiSuggestion, setAiSuggestion] = React.useState<string | null>(null)

  const handleAISuggest = async () => {
    setIsLoadingAI(true)
    try {
      const response = await fetch('/api/ai/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ten_thiet_bi: equipment.ten_thiet_bi,
          model: equipment.model,
          hang_san_xuat: equipment.hang_san_xuat,
        }),
      })
      const data = await response.json()
      if (data.category_name) {
        setAiSuggestion(`${data.category_name} (${Math.round(data.confidence * 100)}%)`)
      }
    } catch (error) {
      console.error('AI suggestion failed:', error)
    } finally {
      setIsLoadingAI(false)
    }
  }

  return (
    <Card className={isSelected ? "border-primary" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {canEdit && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(equipment.id)}
              className="mt-1"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{equipment.ten_thiet_bi}</div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              {equipment.ma_thiet_bi && (
                <div>Mã: {equipment.ma_thiet_bi}</div>
              )}
              {equipment.model && (
                <div>Model: {equipment.model}</div>
              )}
              {equipment.khoa_phong_quan_ly && (
                <div>Khoa: {equipment.khoa_phong_quan_ly}</div>
              )}
            </div>

            {/* AI Suggestion */}
            {aiSuggestion ? (
              <Badge variant="secondary" className="mt-2 gap-1">
                <Sparkles className="h-3 w-3" />
                Gợi ý: {aiSuggestion}
              </Badge>
            ) : canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 h-7 text-xs"
                onClick={handleAISuggest}
                disabled={isLoadingAI}
              >
                {isLoadingAI ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Gợi ý phân loại
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DeviceQuotaUnassignedList() {
  const {
    canEdit,
    unassignedQuery,
    unassignedSearch,
    setUnassignedSearch,
    selectedEquipmentIds,
    setSelectedEquipmentIds,
  } = useDeviceQuotaContext()

  const [localSearch, setLocalSearch] = React.useState(unassignedSearch)
  const debouncedSearch = useDebounce(localSearch, 300)

  React.useEffect(() => {
    setUnassignedSearch(debouncedSearch)
  }, [debouncedSearch, setUnassignedSearch])

  const handleToggle = React.useCallback((id: number) => {
    setSelectedEquipmentIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    )
  }, [setSelectedEquipmentIds])

  const handleSelectAll = React.useCallback(() => {
    if (!unassignedQuery.data) return
    const allIds = unassignedQuery.data.map(e => e.id)
    const allSelected = allIds.every(id => selectedEquipmentIds.includes(id))

    if (allSelected) {
      setSelectedEquipmentIds([])
    } else {
      setSelectedEquipmentIds(allIds)
    }
  }, [unassignedQuery.data, selectedEquipmentIds, setSelectedEquipmentIds])

  const totalCount = unassignedQuery.data?.[0]?.total_count ?? 0

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm thiết bị..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Select all */}
      {canEdit && unassignedQuery.data && unassignedQuery.data.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              unassignedQuery.data.length > 0 &&
              unassignedQuery.data.every(e => selectedEquipmentIds.includes(e.id))
            }
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Chọn tất cả ({totalCount} thiết bị)
          </span>
        </div>
      )}

      {/* List */}
      {unassignedQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : unassignedQuery.data && unassignedQuery.data.length > 0 ? (
        <div className="space-y-2">
          {unassignedQuery.data.map(equipment => (
            <EquipmentCard
              key={equipment.id}
              equipment={equipment}
              isSelected={selectedEquipmentIds.includes(equipment.id)}
              onToggle={handleToggle}
              canEdit={canEdit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {localSearch
            ? "Không tìm thấy thiết bị phù hợp"
            : "Tất cả thiết bị đã được phân loại"
          }
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaUnassignedList.tsx
git commit -m "feat(ui): add DeviceQuotaUnassignedList with AI suggestion button"
```

---

### Task 4.7: Create Decision Selector

**Files:**
- Create: `src/app/(app)/device-quota/_components/DeviceQuotaDecisionSelector.tsx`

**Step 1: Write the component**

```typescript
// src/app/(app)/device-quota/_components/DeviceQuotaDecisionSelector.tsx
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, FileSpreadsheet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useDeviceQuotaContext } from "../_hooks/useDeviceQuotaContext"

export function DeviceQuotaDecisionSelector() {
  const {
    canEdit,
    activeDecision,
    setActiveDecisionId,
    decisionsQuery,
    setDialogState,
  } = useDeviceQuotaContext()

  const [open, setOpen] = React.useState(false)

  const decisions = decisionsQuery.data ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
        >
          {activeDecision ? (
            <span className="truncate">
              {activeDecision.so_quyet_dinh}
              {activeDecision.trang_thai === 'active' && (
                <Badge variant="default" className="ml-2 text-xs">
                  Đang áp dụng
                </Badge>
              )}
            </span>
          ) : (
            "Chọn quyết định..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Tìm quyết định..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy quyết định.</CommandEmpty>
            <CommandGroup heading="Quyết định">
              {decisions.map((decision) => (
                <CommandItem
                  key={decision.id}
                  value={decision.so_quyet_dinh}
                  onSelect={() => {
                    setActiveDecisionId(decision.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeDecision?.id === decision.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div>{decision.so_quyet_dinh}</div>
                    <div className="text-xs text-muted-foreground">
                      {decision.ngay_hieu_luc} - {decision.so_danh_muc} danh mục
                    </div>
                  </div>
                  {decision.trang_thai === 'active' && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            {canEdit && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setDialogState(prev => ({ ...prev, isImportExcelOpen: true }))
                      setOpen(false)
                    }}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Import từ Excel...
                  </CommandItem>
                  <CommandItem
                    onSelect={() => {
                      setDialogState(prev => ({ ...prev, isCreateDecisionOpen: true }))
                      setOpen(false)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tạo quyết định mới...
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/device-quota/_components/DeviceQuotaDecisionSelector.tsx
git commit -m "feat(ui): add DeviceQuotaDecisionSelector dropdown"
```

---

## Phase 5: AI Suggestion API

### Task 5.1: Create AI Suggestion Endpoint

**Files:**
- Create: `src/app/api/ai/suggest-category/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/ai/suggest-category/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ten_thiet_bi, model, hang_san_xuat, categories } = await request.json()

    if (!ten_thiet_bi) {
      return NextResponse.json({ error: 'Missing ten_thiet_bi' }, { status: 400 })
    }

    const model_ai = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Bạn là chuyên gia phân loại thiết bị y tế theo Thông tư 08/2019/TT-BYT của Việt Nam.

Thiết bị cần phân loại:
- Tên: ${ten_thiet_bi}
- Model: ${model || 'N/A'}
- Hãng: ${hang_san_xuat || 'N/A'}

Hãy xác định thiết bị này thuộc nhóm nào trong danh mục thiết bị y tế chuyên dùng:
- Nhóm A (Đặc thù): CT Scanner, MRI, DSA, X-quang, Siêu âm chuyên khoa, Máy thở, Máy gây mê, Máy xét nghiệm sinh hóa/miễn dịch/huyết học, Nội soi, v.v.
- Nhóm B (Khác): Thiết bị hỗ trợ, phụ kiện, thiết bị CNTT y tế, v.v.

Trả về JSON với format:
{
  "category_name": "Tên nhóm thiết bị gợi ý",
  "phan_loai": "A hoặc B",
  "confidence": 0.0 đến 1.0,
  "reason": "Lý do ngắn gọn"
}

Chỉ trả về JSON, không có text khác.`

    const result = await model_ai.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        category_name: 'Không xác định',
        confidence: 0,
        reason: 'Không thể phân tích kết quả'
      })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI suggestion error:', error)
    return NextResponse.json(
      { error: 'AI suggestion failed' },
      { status: 500 }
    )
  }
}
```

**Step 2: Add GEMINI_API_KEY to .env.local**

```bash
echo "GEMINI_API_KEY=your_api_key_here" >> .env.local
```

**Step 3: Commit**

```bash
git add src/app/api/ai/suggest-category/route.ts
git commit -m "feat(api): add AI category suggestion endpoint using Gemini"
```

---

## Phase 6: Navigation Integration

### Task 6.1: Add Navigation Menu Item

**Files:**
- Modify: `src/components/app-sidebar.tsx` (or equivalent navigation file)

**Step 1: Find navigation config and add device-quota section**

Add to navigation items array:

```typescript
{
  title: "Định mức",
  icon: BarChart3, // or appropriate icon
  items: [
    {
      title: "Ánh xạ thiết bị",
      url: "/device-quota/mapping",
    },
    {
      title: "Quyết định",
      url: "/device-quota/decisions",
    },
  ],
}
```

**Step 2: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(nav): add device-quota section to sidebar navigation"
```

---

## Phase 7: Testing & Verification

### Task 7.1: Manual Testing Checklist

**Step 1: Verify database migrations**

```bash
node scripts/npm-run.js npx supabase db push --linked
```

**Step 2: Verify RPC functions work**

Test in Supabase SQL Editor:
```sql
SELECT * FROM dinh_muc_quyet_dinh_list();
SELECT * FROM dinh_muc_thiet_bi_chua_phan_loai(NULL, NULL, 10, 0);
```

**Step 3: Verify frontend loads**

```bash
npm run dev
# Navigate to /device-quota/mapping
```

**Step 4: Test link/unlink flow**

1. Select equipment on right panel
2. Select category on left panel
3. Click "Link" button
4. Verify equipment moves and counts update

**Step 5: Test AI suggestion**

1. Click "Gợi ý phân loại" on equipment card
2. Verify suggestion appears

**Step 6: Final commit**

```bash
git add .
git commit -m "feat(device-quota): complete MVP implementation"
```

---

## Summary

**Files Created:**
- `supabase/migrations/20260131_device_quota_schema.sql`
- `supabase/migrations/20260131_device_quota_rpcs.sql`
- `src/app/(app)/device-quota/page.tsx`
- `src/app/(app)/device-quota/mapping/page.tsx`
- `src/app/(app)/device-quota/decisions/page.tsx`
- `src/app/(app)/device-quota/types.ts`
- `src/app/(app)/device-quota/_components/DeviceQuotaContext.tsx`
- `src/app/(app)/device-quota/_components/DeviceQuotaMappingPageClient.tsx`
- `src/app/(app)/device-quota/_components/DeviceQuotaMappingContent.tsx`
- `src/app/(app)/device-quota/_components/DeviceQuotaCategoryTree.tsx`
- `src/app/(app)/device-quota/_components/DeviceQuotaUnassignedList.tsx`
- `src/app/(app)/device-quota/_components/DeviceQuotaDecisionSelector.tsx`
- `src/app/(app)/device-quota/_hooks/useDeviceQuotaContext.ts`
- `src/app/api/ai/suggest-category/route.ts`

**Files Modified:**
- `src/app/api/rpc/[fn]/route.ts` (add to ALLOWED_FUNCTIONS)
- `src/components/app-sidebar.tsx` (add navigation)

**Estimated Tasks:** 20 bite-sized tasks across 7 phases
