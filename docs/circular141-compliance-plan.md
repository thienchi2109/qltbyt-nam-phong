# Plan: Integrate Circular 141/2025/TT-BTC Compliance into Medical Equipment Management System

## Executive Summary

This plan implements Vietnamese Circular 141/2025/TT-BTC state asset depreciation and management regulations (effective Jan 1, 2026) into the existing medical equipment management system. The regulations mandate specific field tracking, depreciation calculation methods, and compliance reporting for public healthcare facilities.

**Status**: Updated with critical security fixes and performance improvements based on architecture review.

## Current State Analysis

### Existing Equipment Schema (`thiet_bi` table)
**Current depreciation-related fields:**
- `gia_goc` (NUMERIC) - Historical cost/original price
- `nam_tinh_hao_mon` (INT) - Years for depreciation
- `ty_le_hao_mon` (TEXT) - Depreciation rate (stored as text)
- `ngay_nhap` (DATE) - Import date
- `ngay_dua_vao_su_dung` (DATE) - Date put to use
- `nguon_kinh_phi` (TEXT) - Funding source

**Gaps identified:**
1. No historical cost component breakdown (installation, taxes, fees)
2. No accumulated depreciation tracking
3. No residual value calculation
4. No acquisition method tracking (purchase/donation/transfer)
5. No compliance with Circular 141 field requirements
6. No depreciation vs wear distinction (Khấu hao vs Hao mòn)
7. No asset classification by regulatory category
8. No multi-year depreciation history tracking

## Requirements from Circular 141/2025/TT-BTC

### 1. Fixed Asset Criteria
- **Value threshold**: ≥10M VND for admin units, configurable for autonomous units
- **Useful life**: ≥1 year
- **Medical equipment default**: 8 years useful life, 12.5% depreciation rate
- **Equipment categories**: Must support Ministry of Health specific regulations

### 2. Historical Cost Components (Required)
Must track itemized cost breakdown:
- Purchase price (Giá mua trên hóa đơn)
- Import tax (Thuế nhập khẩu)
- Non-refundable VAT (Thuế GTGT không khấu trừ)
- Installation/commissioning costs (Chi phí lắp đặt, chạy thử) - critical for medical equipment
- Fees and charges (Phí, lệ phí)
- Consulting costs (Chi phí tư vấn)
- Appraised value (Giá trị theo đánh giá lại) - for donations/transfers

### 3. Depreciation Tracking (Required)
- Usage purpose (Admin/Public vs Business/Service) - determines Hao mòn vs Khấu hao
- Asset class ID (links to Annex I categories)
- Useful life in years
- Depreciation rate (%)
- Start depreciation date
- Annual depreciation amount
- Accumulated depreciation (running total)
- Residual value (Historical Cost - Accumulated)

### 4. Acquisition Method Tracking (Required)
- Acquisition method enum: Purchase, Investment, Transfer, Donation, Inventory Surplus
- Donor/transferor name
- Project code (if from investment project)
- Valuation method: Original doc, External appraisal, Internal council
- Project settlement status

### 5. Audit Trail (Required)
- Date of invoice/documentation
- Handover/acceptance date (Ngày bàn giao/Nghiệm thu)
- **Date put to use (CRITICAL)** - triggers asset recording, not project settlement
- Date recorded in accounting
- Annual inventory year tracking
- Asset status: In use, Damaged/Pending disposal, Liquidated, Pending settlement
- Legacy asset ID (for pre-2026 transfers)

### 6. Depreciation Calculation Rules

#### Formula for Annual Depreciation
```
Annual Amount = Historical Cost × Depreciation Rate (%)
```

#### Accumulated Depreciation
```
Accumulated(n) = Accumulated(n-1) + Annual Amount(n)
```

#### Residual Value
```
Residual Value = Historical Cost - Accumulated Depreciation
```

#### Start/Stop Rules
- **Start**: From "Date Put Into Use", NOT project settlement date
- **Stop**: When Residual Value reaches 0 OR asset is disposed/liquidated

#### Edge Cases
1. **Final year**: Use subtraction to avoid overflow
   ```
   Final Year Amount = Historical Cost - Accumulated(n-1)
   ```
2. **Upgrades**: Recalculate based on New Historical Cost
3. **Revaluation**: Recalculate based on Remaining Useful Life
4. **Partial year (Business assets)**: Support monthly/daily calculation
   ```
   Monthly Amount = Annual Amount / 12
   Daily Amount = Monthly Amount / Days in Month × Actual Days Used
   ```

## Implementation Plan

### Phase 1: Database Schema Enhancement

**File**: New migration `supabase/migrations/YYYYMMDD_circular141_compliance.sql`

#### 1.1 Create Historical Cost Details Table
```sql
-- Historical cost component breakdown (Circular 141 Article 29)
CREATE TABLE IF NOT EXISTS public.asset_cost_details (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id),  -- Tenant isolation (REQUIRED)
  -- Cost components
  purchase_price DECIMAL(20,2) DEFAULT 0,           -- Giá mua trên hóa đơn
  import_tax DECIMAL(20,2) DEFAULT 0,              -- Thuế nhập khẩu
  vat_non_refundable DECIMAL(20,2) DEFAULT 0,      -- Thuế GTGT không khấu trừ
  installation_cost DECIMAL(20,2) DEFAULT 0,        -- Chi phí lắp đặt, chạy thử
  fees_and_charges DECIMAL(20,2) DEFAULT 0,        -- Phí, lệ phí
  consulting_cost DECIMAL(20,2) DEFAULT 0,         -- Chi phí tư vấn/Chuyên gia
  compensation_cost DECIMAL(20,2) DEFAULT 0,       -- Chi phí bồi thường, GPMB
  appraised_value DECIMAL(20,2) DEFAULT 0,         -- Giá trị theo đánh giá lại
  total_historical_cost DECIMAL(20,2) GENERATED ALWAYS AS (
    purchase_price + import_tax + vat_non_refundable + installation_cost +
    fees_and_charges + consulting_cost + compensation_cost + appraised_value
  ) STORED,
  -- Audit trail
  created_by BIGINT REFERENCES public.nhan_vien(id),
  updated_by BIGINT REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_cost_per_equipment UNIQUE(thiet_bi_id)
);

COMMENT ON TABLE public.asset_cost_details IS
  'Circular 141/2025/TT-BTC compliance: Historical cost breakdown for fixed assets ≥10M VND';
COMMENT ON COLUMN public.asset_cost_details.installation_cost IS
  'Critical for medical equipment - includes commissioning and testing costs per Article 29';
```

#### 1.2 Create Depreciation Tracking Table
```sql
-- Depreciation/wear tracking (Circular 141 Article 30-33)
CREATE TABLE IF NOT EXISTS public.asset_depreciation (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id),  -- Tenant isolation (REQUIRED)
  -- Classification
  asset_class_id VARCHAR(20),                       -- Mã nhóm tài sản (links to Annex I)
  usage_purpose VARCHAR(20) NOT NULL,               -- 'admin', 'business', 'mixed'
  -- Depreciation parameters
  useful_life_years INT NOT NULL DEFAULT 8,         -- Thời gian sử dụng (Năm)
  depreciation_rate DECIMAL(5,2) NOT NULL,          -- Tỷ lệ hao mòn/khấu hao (%)
  start_depreciation_date DATE,                     -- Ngày bắt đầu tính HM/KH
  -- Calculated values
  annual_depreciation_amount DECIMAL(20,2),         -- Mức hao mòn/khấu hao năm
  accumulated_depreciation DECIMAL(20,2) DEFAULT 0, -- Hao mòn/Khấu hao lũy kế
  residual_value DECIMAL(20,2),                     -- Giá trị còn lại
  -- Special cases
  brand_value_allocation DECIMAL(20,2),             -- Phân bổ giá trị thương hiệu
  -- Audit trail
  created_by BIGINT REFERENCES public.nhan_vien(id),
  updated_by BIGINT REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_depreciation_per_equipment UNIQUE(thiet_bi_id),
  CONSTRAINT valid_usage_purpose CHECK (usage_purpose IN ('admin', 'business', 'mixed')),
  CONSTRAINT valid_depreciation_rate CHECK (depreciation_rate >= 0 AND depreciation_rate <= 100)
);

COMMENT ON TABLE public.asset_depreciation IS
  'Circular 141/2025/TT-BTC: Depreciation tracking with distinction between Hao mòn (admin) and Khấu hao (business)';
```

#### 1.3 Create Acquisition Tracking Table
```sql
-- Asset acquisition method tracking (Circular 141 Article 28)
CREATE TABLE IF NOT EXISTS public.asset_acquisition (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id),  -- Tenant isolation (REQUIRED)
  -- Acquisition details
  acquisition_method VARCHAR(50) NOT NULL,          -- 'mua_sam', 'dau_tu_xdcb', 'dieu_chuyen', 'tang_cho', 'kiem_ke_thua'
  donor_transferor_name TEXT,                       -- Tên đơn vị giao/tặng (fixed from NVARCHAR)
  project_code VARCHAR(50),                         -- Mã dự án
  valuation_method VARCHAR(50),                     -- 'ho_so_goc', 'tham_dinh_gia', 'hoi_dong_dinh_gia'
  is_project_settled BOOLEAN DEFAULT FALSE,         -- Trạng thái quyết toán
  -- Audit trail
  created_by BIGINT REFERENCES public.nhan_vien(id),
  updated_by BIGINT REFERENCES public.nhan_vien(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_acquisition_per_equipment UNIQUE(thiet_bi_id),
  CONSTRAINT valid_acquisition_method CHECK (acquisition_method IN ('mua_sam', 'dau_tu_xdcb', 'dieu_chuyen', 'tang_cho', 'kiem_ke_thua')),
  CONSTRAINT valid_valuation_method CHECK (valuation_method IN ('ho_so_goc', 'tham_dinh_gia', 'hoi_dong_dinh_gia'))
);

COMMENT ON TABLE public.asset_acquisition IS
  'Circular 141/2025/TT-BTC: Asset acquisition method and valuation tracking';
```

#### 1.4 Create Annual Depreciation History Table (CRITICAL - Promoted from Future Enhancements)
```sql
-- Multi-year depreciation history for audit trail and compliance reporting
CREATE TABLE IF NOT EXISTS public.asset_depreciation_annual (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  don_vi_id BIGINT NOT NULL REFERENCES public.don_vi(id),
  fiscal_year INT NOT NULL,
  opening_residual DECIMAL(20,2),
  annual_amount DECIMAL(20,2),
  adjustments DECIMAL(20,2) DEFAULT 0,              -- For restatements/corrections
  closing_residual DECIMAL(20,2),
  calculated_by BIGINT REFERENCES public.nhan_vien(id),
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  CONSTRAINT unique_annual_record UNIQUE(thiet_bi_id, fiscal_year),
  CONSTRAINT valid_fiscal_year CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100)
);

CREATE INDEX IF NOT EXISTS idx_depreciation_annual_year ON public.asset_depreciation_annual(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_depreciation_annual_tenant ON public.asset_depreciation_annual(don_vi_id, fiscal_year);

COMMENT ON TABLE public.asset_depreciation_annual IS
  'Year-over-year depreciation history required for regulatory audits and financial reports';
```

#### 1.5 Enhance `thiet_bi` Table (Audit Trail)
```sql
ALTER TABLE public.thiet_bi
  ADD COLUMN IF NOT EXISTS date_invoice DATE,                    -- Ngày hóa đơn/Chứng từ
  ADD COLUMN IF NOT EXISTS date_handover DATE,                   -- Ngày bàn giao/Nghiệm thu
  -- ngay_dua_vao_su_dung already exists
  ADD COLUMN IF NOT EXISTS date_recorded DATE,                   -- Ngày ghi sổ kế toán
  ADD COLUMN IF NOT EXISTS inventory_year INT,                   -- Năm kiểm kê
  ADD COLUMN IF NOT EXISTS asset_status VARCHAR(50),             -- Trạng thái tài sản
  ADD COLUMN IF NOT EXISTS legacy_asset_id VARCHAR(50);          -- Mã tài sản cũ

ALTER TABLE public.thiet_bi
  ADD CONSTRAINT valid_asset_status CHECK (
    asset_status IS NULL OR asset_status IN ('dang_su_dung', 'hu_hong_cho_ly', 'da_thanh_ly', 'cho_quyet_toan')
  );
```

#### 1.6 Create Indexes (Performance Optimization)
```sql
-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_cost_details_thiet_bi ON public.asset_cost_details(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_thiet_bi ON public.asset_depreciation(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_thiet_bi ON public.asset_acquisition(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_asset_status ON public.thiet_bi(asset_status);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_inventory_year ON public.thiet_bi(inventory_year);

-- Composite indexes for tenant-aware queries
CREATE INDEX IF NOT EXISTS idx_cost_details_tenant_equipment
  ON public.asset_cost_details(don_vi_id, thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_depreciation_tenant_equipment
  ON public.asset_depreciation(don_vi_id, thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_acquisition_tenant_equipment
  ON public.asset_acquisition(don_vi_id, thiet_bi_id);

-- Partial indexes for active depreciation filtering
CREATE INDEX IF NOT EXISTS idx_depreciation_residual_positive
  ON public.asset_depreciation(thiet_bi_id, don_vi_id)
  WHERE residual_value > 0;

-- Status filtering for batch operations
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi_status
  ON public.thiet_bi(don_vi, asset_status)
  WHERE asset_status = 'dang_su_dung';

-- Covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cost_details_covering
  ON public.asset_cost_details(thiet_bi_id, don_vi_id)
  INCLUDE (total_historical_cost, purchase_price);

CREATE INDEX IF NOT EXISTS idx_depreciation_covering
  ON public.asset_depreciation(thiet_bi_id, don_vi_id)
  INCLUDE (residual_value, accumulated_depreciation, annual_depreciation_amount);
```

### Phase 2: Database Functions & Triggers

**File**: Same migration or new `YYYYMMDD_circular141_functions.sql`

#### 2.1 Auto-calculate Depreciation Rate Trigger
```sql
CREATE OR REPLACE FUNCTION public.calculate_depreciation_rate()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public  -- CRITICAL: Prevent search path injection
LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-calculate rate from useful life if not provided
  IF NEW.depreciation_rate IS NULL OR NEW.depreciation_rate = 0 THEN
    NEW.depreciation_rate := ROUND((100.0 / NULLIF(NEW.useful_life_years, 0))::NUMERIC, 2);
  END IF;

  -- Validate range
  IF NEW.depreciation_rate < 0 OR NEW.depreciation_rate > 100 THEN
    RAISE EXCEPTION 'Invalid depreciation rate: % (must be 0-100)', NEW.depreciation_rate;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_depreciation_rate
  BEFORE INSERT OR UPDATE ON public.asset_depreciation
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_depreciation_rate();
```

#### 2.2 Sync Historical Cost to Main Table
```sql
CREATE OR REPLACE FUNCTION public.sync_historical_cost()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_total DECIMAL(20,2);
BEGIN
  -- Calculate total (since trigger fires BEFORE generated column computation)
  v_total := NEW.purchase_price + NEW.import_tax + NEW.vat_non_refundable +
             NEW.installation_cost + NEW.fees_and_charges + NEW.consulting_cost +
             NEW.compensation_cost + NEW.appraised_value;

  -- Update gia_goc in thiet_bi table when cost details change
  UPDATE public.thiet_bi
  SET gia_goc = v_total
  WHERE id = NEW.thiet_bi_id;

  RETURN NEW;
END;
$$;

-- Use DEFERRABLE to prevent race conditions
CREATE CONSTRAINT TRIGGER trg_sync_historical_cost
  AFTER INSERT OR UPDATE ON public.asset_cost_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_historical_cost();
```

#### 2.3 Update Residual Value Trigger
```sql
CREATE OR REPLACE FUNCTION public.update_residual_value()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_historical_cost DECIMAL(20,2);
BEGIN
  -- Get historical cost from cost_details
  SELECT total_historical_cost
  INTO v_historical_cost
  FROM public.asset_cost_details
  WHERE thiet_bi_id = NEW.thiet_bi_id;

  IF v_historical_cost IS NULL THEN
    v_historical_cost := 0;
  END IF;

  -- Calculate residual value
  NEW.residual_value := GREATEST(v_historical_cost - NEW.accumulated_depreciation, 0);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_residual
  BEFORE INSERT OR UPDATE OF accumulated_depreciation
  ON public.asset_depreciation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_residual_value();
```

#### 2.4 Annual Depreciation Calculation Function (Single Equipment)
```sql
CREATE OR REPLACE FUNCTION public.calculate_annual_depreciation(
  p_thiet_bi_id BIGINT,
  p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS TABLE (
  annual_amount DECIMAL(20,2),
  new_accumulated DECIMAL(20,2),
  new_residual DECIMAL(20,2)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_historical_cost DECIMAL(20,2);
  v_depreciation_rate DECIMAL(5,2);
  v_current_accumulated DECIMAL(20,2);
  v_start_date DATE;
  v_usage_purpose VARCHAR(20);
  v_annual_amount DECIMAL(20,2);
  v_new_accumulated DECIMAL(20,2);
  v_new_residual DECIMAL(20,2);
  v_years_in_use INT;
  v_useful_life INT;
BEGIN
  -- Validate year
  IF p_year < 2000 OR p_year > EXTRACT(YEAR FROM CURRENT_DATE) + 10 THEN
    RAISE EXCEPTION 'Invalid year: % (must be 2000-current+10)', p_year USING ERRCODE = '22023';
  END IF;

  -- Get equipment details
  SELECT
    cd.total_historical_cost,
    ad.depreciation_rate,
    ad.accumulated_depreciation,
    ad.start_depreciation_date,
    ad.usage_purpose,
    ad.useful_life_years
  INTO
    v_historical_cost,
    v_depreciation_rate,
    v_current_accumulated,
    v_start_date,
    v_usage_purpose,
    v_useful_life
  FROM public.asset_cost_details cd
  JOIN public.asset_depreciation ad ON cd.thiet_bi_id = ad.thiet_bi_id
  WHERE cd.thiet_bi_id = p_thiet_bi_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment % not found or missing depreciation data', p_thiet_bi_id;
  END IF;

  -- Calculate years in use
  v_years_in_use := p_year - EXTRACT(YEAR FROM v_start_date)::INT + 1;

  -- Standard calculation
  v_annual_amount := v_historical_cost * (v_depreciation_rate / 100.0);

  -- Edge case: Final year - use subtraction to avoid overflow
  IF v_years_in_use >= v_useful_life THEN
    v_annual_amount := GREATEST(v_historical_cost - v_current_accumulated, 0);
  END IF;

  -- Calculate new values
  v_new_accumulated := LEAST(v_current_accumulated + v_annual_amount, v_historical_cost);
  v_new_residual := v_historical_cost - v_new_accumulated;

  RETURN QUERY SELECT v_annual_amount, v_new_accumulated, v_new_residual;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_annual_depreciation(BIGINT, INT) TO authenticated;
```

#### 2.5 Batch Update Depreciation Function (REWRITTEN - Set-Based)
```sql
-- Batch depreciation update using set-based operation (not loop)
CREATE OR REPLACE FUNCTION public.update_annual_depreciation(
  p_don_vi TEXT DEFAULT NULL,  -- TEXT to match JWT claim type
  p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS TABLE (
  thiet_bi_id BIGINT,
  ten_thiet_bi TEXT,
  annual_amount DECIMAL(20,2),
  new_accumulated DECIMAL(20,2),
  new_residual DECIMAL(20,2)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
  v_don_vi TEXT;
  v_batch_count INT;
BEGIN
  -- Extract JWT claims (FIXED: Use current_setting directly, not helper function)
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', ''),
    ''
  );
  v_don_vi := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'don_vi', ''),
    ''
  );

  -- Permission check
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation: Force tenant for non-global users
  IF v_role NOT IN ('global') THEN
    p_don_vi := v_don_vi;
  END IF;

  -- CRITICAL: Require explicit tenant for global users (prevent DoS)
  IF v_role = 'global' AND p_don_vi IS NULL THEN
    RAISE EXCEPTION 'Global users must specify p_don_vi explicitly' USING ERRCODE = '22023';
  END IF;

  -- Validate year
  IF p_year < 2000 OR p_year > EXTRACT(YEAR FROM CURRENT_DATE) + 10 THEN
    RAISE EXCEPTION 'Invalid year: %', p_year USING ERRCODE = '22023';
  END IF;

  -- Batch size limit (prevent DoS)
  SELECT COUNT(*) INTO v_batch_count
  FROM public.thiet_bi tb
  JOIN public.asset_depreciation ad ON tb.id = ad.thiet_bi_id
  WHERE tb.don_vi = p_don_vi::INT
    AND ad.residual_value > 0
    AND tb.asset_status = 'dang_su_dung';

  IF v_batch_count > 1000 THEN
    RAISE EXCEPTION 'Batch size exceeds limit of 1000 records (found %)', v_batch_count USING ERRCODE = '54000';
  END IF;

  -- Advisory lock to prevent concurrent updates
  PERFORM pg_advisory_xact_lock(hashtext('depreciation_batch_' || p_don_vi || '_' || p_year::text));

  -- SET-BASED OPERATION (not loop) - Performance optimized
  WITH depreciation_calc AS (
    SELECT
      tb.id,
      tb.ten_thiet_bi,
      cd.total_historical_cost,
      ad.depreciation_rate,
      ad.accumulated_depreciation,
      ad.useful_life_years,
      ad.start_depreciation_date,
      -- Inline calculation
      CASE
        WHEN (p_year - EXTRACT(YEAR FROM ad.start_depreciation_date)::INT + 1) >= ad.useful_life_years
        THEN GREATEST(cd.total_historical_cost - ad.accumulated_depreciation, 0)  -- Final year
        ELSE cd.total_historical_cost * (ad.depreciation_rate / 100.0)  -- Standard
      END as calculated_annual_amount
    FROM public.thiet_bi tb
    JOIN public.asset_cost_details cd ON tb.id = cd.thiet_bi_id
    JOIN public.asset_depreciation ad ON tb.id = ad.thiet_bi_id
    WHERE tb.don_vi = p_don_vi::INT
      AND ad.residual_value > 0
      AND tb.asset_status = 'dang_su_dung'
  )
  UPDATE public.asset_depreciation ad
  SET
    annual_depreciation_amount = dc.calculated_annual_amount,
    accumulated_depreciation = LEAST(ad.accumulated_depreciation + dc.calculated_annual_amount, dc.total_historical_cost),
    residual_value = dc.total_historical_cost - LEAST(ad.accumulated_depreciation + dc.calculated_annual_amount, dc.total_historical_cost),
    updated_at = NOW()
  FROM depreciation_calc dc
  WHERE ad.thiet_bi_id = dc.id
  RETURNING
    ad.thiet_bi_id,
    dc.ten_thiet_bi,
    ad.annual_depreciation_amount,
    ad.accumulated_depreciation,
    ad.residual_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_annual_depreciation(TEXT, INT) TO authenticated;
```

### Phase 3: RPC Whitelist & API Integration

**Files**:
- `src/app/api/rpc/[fn]/route.ts` (update ALLOWED_FUNCTIONS)
- `src/lib/rpc-client.ts` (add type definitions)

#### 3.1 Update ALLOWED_FUNCTIONS
```typescript
const ALLOWED_FUNCTIONS = [
  // ... existing functions ...

  // Circular 141 compliance functions
  'calculate_annual_depreciation',
  'update_annual_depreciation',
  'equipment_create_with_circular141',
  'equipment_get_circular141_details',      // Read full compliance data
  'equipment_list_with_depreciation',       // List with depreciation status
] as const;
```

#### 3.2 Create Core Equipment Insert Helper (DRY Principle)

**File**: New migration `YYYYMMDD_circular141_equipment_rpcs.sql`

```sql
-- Internal helper function for equipment insertion (no permission check - called by trusted functions)
CREATE OR REPLACE FUNCTION public._equipment_insert_core(
  p_payload JSONB,
  p_don_vi BIGINT
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_id BIGINT;
  v_khoa_phong TEXT := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);
BEGIN
  -- Core equipment insert logic
  INSERT INTO public.thiet_bi (
    ten_thiet_bi,
    ma_thiet_bi,
    khoa_phong_quan_ly,
    model,
    serial,
    hang_san_xuat,
    noi_san_xuat,
    nam_san_xuat,
    ngay_nhap,
    ngay_dua_vao_su_dung,
    nguon_kinh_phi,
    gia_goc,
    nam_tinh_hao_mon,
    ty_le_hao_mon,
    han_bao_hanh,
    vi_tri_lap_dat,
    nguoi_dang_truc_tiep_quan_ly,
    tinh_trang_hien_tai,
    ghi_chu,
    phan_loai_theo_nd98,
    don_vi
  )
  VALUES (
    p_payload->>'ten_thiet_bi',
    p_payload->>'ma_thiet_bi',
    v_khoa_phong,
    NULLIF(p_payload->>'model',''),
    NULLIF(p_payload->>'serial',''),
    NULLIF(p_payload->>'hang_san_xuat',''),
    NULLIF(p_payload->>'noi_san_xuat',''),
    NULLIF(p_payload->>'nam_san_xuat','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_nhap','') = '' THEN NULL ELSE (p_payload->>'ngay_nhap')::DATE END,
    CASE WHEN COALESCE(p_payload->>'ngay_dua_vao_su_dung','') = '' THEN NULL ELSE (p_payload->>'ngay_dua_vao_su_dung')::DATE END,
    NULLIF(p_payload->>'nguon_kinh_phi',''),
    NULLIF(p_payload->>'gia_goc','')::NUMERIC,
    NULLIF(p_payload->>'nam_tinh_hao_mon','')::INT,
    NULLIF(p_payload->>'ty_le_hao_mon',''),
    CASE WHEN COALESCE(p_payload->>'han_bao_hanh','') = '' THEN NULL ELSE (p_payload->>'han_bao_hanh')::DATE END,
    NULLIF(p_payload->>'vi_tri_lap_dat',''),
    NULLIF(p_payload->>'nguoi_dang_truc_tiep_quan_ly',''),
    NULLIF(p_payload->>'tinh_trang_hien_tai',''),
    NULLIF(p_payload->>'ghi_chu',''),
    NULLIF(p_payload->>'phan_loai_theo_nd98',''),
    p_don_vi
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Enhanced equipment creation with Circular 141 data
CREATE OR REPLACE FUNCTION public.equipment_create_with_circular141(p_payload JSONB)
RETURNS public.thiet_bi
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
  v_donvi BIGINT;
  v_equipment_id BIGINT;
  v_user_id BIGINT;
  rec public.thiet_bi;
BEGIN
  -- Extract JWT claims (FIXED)
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', ''),
    ''
  );
  v_donvi := NULLIF(current_setting('request.jwt.claims', true)::json->>'don_vi', '')::BIGINT;
  v_user_id := NULLIF(current_setting('request.jwt.claims', true)::json->>'user_id', '')::BIGINT;

  -- Permission check
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Create base equipment record using helper
  v_equipment_id := public._equipment_insert_core(p_payload, v_donvi);

  -- Insert cost details if provided
  IF p_payload ? 'cost_details' THEN
    INSERT INTO public.asset_cost_details (
      thiet_bi_id,
      don_vi_id,
      purchase_price,
      import_tax,
      vat_non_refundable,
      installation_cost,
      fees_and_charges,
      consulting_cost,
      compensation_cost,
      appraised_value,
      created_by
    ) VALUES (
      v_equipment_id,
      v_donvi,
      COALESCE((p_payload->'cost_details'->>'purchase_price')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'import_tax')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'vat_non_refundable')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'installation_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'fees_and_charges')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'consulting_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'compensation_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'appraised_value')::DECIMAL, 0),
      v_user_id
    );
  END IF;

  -- Insert depreciation details
  IF p_payload ? 'depreciation' THEN
    INSERT INTO public.asset_depreciation (
      thiet_bi_id,
      don_vi_id,
      asset_class_id,
      usage_purpose,
      useful_life_years,
      depreciation_rate,
      start_depreciation_date,
      created_by
    ) VALUES (
      v_equipment_id,
      v_donvi,
      p_payload->'depreciation'->>'asset_class_id',
      COALESCE(p_payload->'depreciation'->>'usage_purpose', 'admin'),
      COALESCE((p_payload->'depreciation'->>'useful_life_years')::INT, 8),
      (p_payload->'depreciation'->>'depreciation_rate')::DECIMAL,
      COALESCE(
        (p_payload->'depreciation'->>'start_depreciation_date')::DATE,
        (p_payload->>'ngay_dua_vao_su_dung')::DATE
      ),
      v_user_id
    );
  END IF;

  -- Insert acquisition details
  IF p_payload ? 'acquisition' THEN
    INSERT INTO public.asset_acquisition (
      thiet_bi_id,
      don_vi_id,
      acquisition_method,
      donor_transferor_name,
      project_code,
      valuation_method,
      is_project_settled,
      created_by
    ) VALUES (
      v_equipment_id,
      v_donvi,
      p_payload->'acquisition'->>'acquisition_method',
      p_payload->'acquisition'->>'donor_transferor_name',
      p_payload->'acquisition'->>'project_code',
      p_payload->'acquisition'->>'valuation_method',
      COALESCE((p_payload->'acquisition'->>'is_project_settled')::BOOLEAN, FALSE),
      v_user_id
    );
  END IF;

  -- Return full equipment record
  SELECT * INTO rec FROM public.thiet_bi WHERE id = v_equipment_id;
  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_create_with_circular141(JSONB) TO authenticated;

-- Get equipment with full Circular 141 details
CREATE OR REPLACE FUNCTION public.equipment_get_circular141_details(p_id BIGINT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT;
  v_donvi BIGINT;
  v_result JSONB;
BEGIN
  -- Extract JWT claims
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'app_role', ''),
    ''
  );
  v_donvi := NULLIF(current_setting('request.jwt.claims', true)::json->>'don_vi', '')::BIGINT;

  -- Tenant isolation check
  IF v_role NOT IN ('global') THEN
    IF NOT EXISTS (SELECT 1 FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi) THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Return combined data
  SELECT jsonb_build_object(
    'equipment', row_to_json(tb.*),
    'cost_details', row_to_json(cd.*),
    'depreciation', row_to_json(ad.*),
    'acquisition', row_to_json(aa.*)
  ) INTO v_result
  FROM public.thiet_bi tb
  LEFT JOIN public.asset_cost_details cd ON tb.id = cd.thiet_bi_id
  LEFT JOIN public.asset_depreciation ad ON tb.id = ad.thiet_bi_id
  LEFT JOIN public.asset_acquisition aa ON tb.id = aa.thiet_bi_id
  WHERE tb.id = p_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_get_circular141_details(BIGINT) TO authenticated;
```

### Phase 4: TypeScript Type Definitions

**File**: `src/types/circular141.ts` (new file)

```typescript
// Circular 141/2025/TT-BTC compliance types
import type { Equipment } from './database';  // FIXED: Add import

export interface AssetCostDetails {
  id?: number;
  thiet_bi_id: number;
  don_vi_id: number;
  purchase_price: number;          // Giá mua trên hóa đơn
  import_tax: number;              // Thuế nhập khẩu
  vat_non_refundable: number;      // Thuế GTGT không khấu trừ
  installation_cost: number;        // Chi phí lắp đặt, chạy thử
  fees_and_charges: number;        // Phí, lệ phí
  consulting_cost: number;         // Chi phí tư vấn
  compensation_cost: number;       // Chi phí bồi thường
  appraised_value: number;         // Giá trị theo đánh giá lại
  total_historical_cost?: number;  // Auto-calculated
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export type UsagePurpose = 'admin' | 'business' | 'mixed';

export interface AssetDepreciation {
  id?: number;
  thiet_bi_id: number;
  don_vi_id: number;
  asset_class_id?: string;                 // Mã nhóm tài sản
  usage_purpose: UsagePurpose;             // Hao mòn vs Khấu hao
  useful_life_years: number;               // Thời gian sử dụng (Năm)
  depreciation_rate: number;               // Tỷ lệ hao mòn/khấu hao (%)
  start_depreciation_date?: string;        // Ngày bắt đầu tính
  annual_depreciation_amount?: number;     // Mức hao mòn/khấu hao năm
  accumulated_depreciation: number;        // Lũy kế
  residual_value?: number;                 // Giá trị còn lại
  brand_value_allocation?: number;         // Phân bổ thương hiệu
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AssetDepreciationAnnual {
  id?: number;
  thiet_bi_id: number;
  don_vi_id: number;
  fiscal_year: number;
  opening_residual: number;
  annual_amount: number;
  adjustments: number;
  closing_residual: number;
  calculated_by?: number;
  calculated_at?: string;
  notes?: string;
}

export type AcquisitionMethod =
  | 'mua_sam'          // Purchase
  | 'dau_tu_xdcb'      // Investment/Construction
  | 'dieu_chuyen'      // Transfer
  | 'tang_cho'         // Donation
  | 'kiem_ke_thua';    // Inventory Surplus

export type ValuationMethod =
  | 'ho_so_goc'        // Original documentation
  | 'tham_dinh_gia'    // External appraisal
  | 'hoi_dong_dinh_gia'; // Internal council

export interface AssetAcquisition {
  id?: number;
  thiet_bi_id: number;
  don_vi_id: number;
  acquisition_method: AcquisitionMethod;
  donor_transferor_name?: string;
  project_code?: string;
  valuation_method?: ValuationMethod;
  is_project_settled: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export type AssetStatus =
  | 'dang_su_dung'        // In use
  | 'hu_hong_cho_ly'      // Damaged/Pending disposal
  | 'da_thanh_ly'         // Liquidated
  | 'cho_quyet_toan';     // Pending settlement

// Enhanced equipment type with Circular 141 data
export interface EquipmentWithCircular141 extends Equipment {
  date_invoice?: string;
  date_handover?: string;
  date_recorded?: string;
  inventory_year?: number;
  asset_status?: AssetStatus;
  legacy_asset_id?: string;

  // Related data
  cost_details?: AssetCostDetails;
  depreciation?: AssetDepreciation;
  acquisition?: AssetAcquisition;
}

// RPC response types (ADDED)
export interface DepreciationCalculationResult {
  annual_amount: number;
  new_accumulated: number;
  new_residual: number;
}

export interface BatchDepreciationResult {
  thiet_bi_id: number;
  ten_thiet_bi: string;
  annual_amount: number;
  new_accumulated: number;
  new_residual: number;
}

// Constants for display
export const USAGE_PURPOSE_LABELS: Record<UsagePurpose, string> = {
  admin: 'Hành chính - Hao mòn',
  business: 'Hoạt động kinh doanh - Khấu hao',
  mixed: 'Hỗn hợp',
};

export const ACQUISITION_METHOD_LABELS: Record<AcquisitionMethod, string> = {
  mua_sam: 'Mua sắm',
  dau_tu_xdcb: 'Đầu tư XDCB',
  dieu_chuyen: 'Điều chuyển',
  tang_cho: 'Tặng, cho',
  kiem_ke_thua: 'Kiểm kê thừa',
};

export const VALUATION_METHOD_LABELS: Record<ValuationMethod, string> = {
  ho_so_goc: 'Hồ sơ gốc',
  tham_dinh_gia: 'Thẩm định giá',
  hoi_dong_dinh_gia: 'Hội đồng định giá',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  dang_su_dung: 'Đang sử dụng',
  hu_hong_cho_ly: 'Hư hỏng chờ lý',
  da_thanh_ly: 'Đã thanh lý',
  cho_quyet_toan: 'Chờ quyết toán',
};

// Default depreciation rates by category (from Annex I)
export const DEFAULT_DEPRECIATION_RATES = {
  medical_equipment: { years: 8, rate: 12.5 },
  computers: { years: 5, rate: 20 },
  air_conditioners: { years: 8, rate: 12.5 },
  furniture: { years: 10, rate: 10 },
  vehicles: { years: 15, rate: 6.67 },
  buildings_special: { years: 80, rate: 1.25 },
  buildings_level3: { years: 25, rate: 4 },
} as const;
```

**File**: `src/lib/rpc-client.ts` (add type overloads)

```typescript
// Add to existing RpcFunctions type
type RpcFunctions = {
  // ... existing functions ...

  // Circular 141 compliance
  calculate_annual_depreciation: {
    args: { p_thiet_bi_id: number; p_year?: number };
    returns: DepreciationCalculationResult[];
  };
  update_annual_depreciation: {
    args: { p_don_vi?: number; p_year?: number };
    returns: BatchDepreciationResult[];
  };
  equipment_create_with_circular141: {
    args: { p_payload: any };  // JSONB
    returns: Equipment;
  };
  equipment_get_circular141_details: {
    args: { p_id: number };
    returns: any;  // JSONB
  };
};
```

### Phase 5: UI Components (Optional - Phase 2 Enhancement)

**Directory**: `src/app/(app)/equipment/_components/`

Create new components for Circular 141 data entry:
- `EquipmentCircular141Form.tsx` - Form sections for cost details, depreciation, acquisition
- `DepreciationCalculator.tsx` - Interactive depreciation calculation display
- `AssetComplianceReport.tsx` - Compliance reporting view

**Note**: UI implementation is OPTIONAL for MVP. Focus on backend compliance first.

### Phase 6: Data Migration & Backfill

**File**: `supabase/migrations/YYYYMMDD_circular141_backfill.sql`

```sql
-- Backfill existing equipment with default depreciation records
-- IMPORTANT: Only backfill equipment meeting Circular 141 criteria

BEGIN;

-- Backfill asset_depreciation (with validation)
INSERT INTO public.asset_depreciation (
  thiet_bi_id,
  don_vi_id,
  usage_purpose,
  useful_life_years,
  depreciation_rate,
  start_depreciation_date,
  accumulated_depreciation,
  residual_value
)
SELECT
  tb.id,
  tb.don_vi,  -- ADDED: Tenant ID
  'admin' as usage_purpose,
  COALESCE(tb.nam_tinh_hao_mon, 8) as useful_life_years,
  CASE
    WHEN tb.ty_le_hao_mon ~ '^[0-9.]+%?$' THEN
      REPLACE(REPLACE(tb.ty_le_hao_mon, '%', ''), ',', '.')::DECIMAL
    ELSE
      ROUND(100.0 / COALESCE(tb.nam_tinh_hao_mon, 8), 2)
  END as depreciation_rate,
  COALESCE(tb.ngay_dua_vao_su_dung, tb.ngay_nhap) as start_depreciation_date,
  0 as accumulated_depreciation,
  COALESCE(tb.gia_goc, 0) as residual_value
FROM public.thiet_bi tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_depreciation ad
  WHERE ad.thiet_bi_id = tb.id
)
  -- VALIDATION: Only backfill compliant assets
  AND COALESCE(tb.gia_goc, 0) >= 10000000  -- ≥10M VND threshold
  AND tb.ngay_dua_vao_su_dung IS NOT NULL  -- Must have start date
  AND tb.asset_status IS DISTINCT FROM 'da_thanh_ly'  -- Exclude disposed
  AND tb.don_vi IS NOT NULL;  -- Must have tenant

-- Backfill asset_cost_details (with tenant ID)
INSERT INTO public.asset_cost_details (
  thiet_bi_id,
  don_vi_id,  -- ADDED
  purchase_price
)
SELECT
  tb.id,
  tb.don_vi,
  COALESCE(tb.gia_goc, 0)
FROM public.thiet_bi tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_cost_details cd
  WHERE cd.thiet_bi_id = tb.id
)
  AND COALESCE(tb.gia_goc, 0) >= 10000000
  AND tb.don_vi IS NOT NULL;

-- Backfill asset_acquisition (with tenant ID)
INSERT INTO public.asset_acquisition (
  thiet_bi_id,
  don_vi_id,  -- ADDED
  acquisition_method,
  valuation_method,
  is_project_settled
)
SELECT
  tb.id,
  tb.don_vi,
  'mua_sam',
  'ho_so_goc',
  TRUE
FROM public.thiet_bi tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_acquisition aa
  WHERE aa.thiet_bi_id = tb.id
)
  AND tb.don_vi IS NOT NULL;

-- Set default asset status
UPDATE public.thiet_bi
SET asset_status = 'dang_su_dung'
WHERE asset_status IS NULL
  AND COALESCE(gia_goc, 0) >= 10000000;

COMMIT;
```

### Phase 7: Rollback Migration (Safety)

**File**: `supabase/migrations/YYYYMMDD_circular141_rollback.sql`

```sql
-- Rollback script for Circular 141 compliance migration
BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_sync_historical_cost ON public.asset_cost_details;
DROP TRIGGER IF EXISTS trg_auto_depreciation_rate ON public.asset_depreciation;
DROP TRIGGER IF EXISTS trg_update_residual ON public.asset_depreciation;

-- Drop functions
DROP FUNCTION IF EXISTS public.sync_historical_cost();
DROP FUNCTION IF EXISTS public.calculate_depreciation_rate();
DROP FUNCTION IF EXISTS public.update_residual_value();
DROP FUNCTION IF EXISTS public.calculate_annual_depreciation(BIGINT, INT);
DROP FUNCTION IF EXISTS public.update_annual_depreciation(TEXT, INT);
DROP FUNCTION IF EXISTS public.equipment_create_with_circular141(JSONB);
DROP FUNCTION IF EXISTS public.equipment_get_circular141_details(BIGINT);
DROP FUNCTION IF EXISTS public._equipment_insert_core(JSONB, BIGINT);

-- Drop tables (CASCADE will remove FK constraints)
DROP TABLE IF EXISTS public.asset_depreciation_annual CASCADE;
DROP TABLE IF EXISTS public.asset_acquisition CASCADE;
DROP TABLE IF EXISTS public.asset_depreciation CASCADE;
DROP TABLE IF EXISTS public.asset_cost_details CASCADE;

-- Remove columns from thiet_bi
ALTER TABLE public.thiet_bi
  DROP COLUMN IF EXISTS date_invoice,
  DROP COLUMN IF EXISTS date_handover,
  DROP COLUMN IF EXISTS date_recorded,
  DROP COLUMN IF EXISTS inventory_year,
  DROP COLUMN IF EXISTS asset_status,
  DROP COLUMN IF EXISTS legacy_asset_id;

-- Remove constraint
ALTER TABLE public.thiet_bi DROP CONSTRAINT IF EXISTS valid_asset_status;

COMMIT;
```

## Verification & Testing

### Database Verification
```bash
# Execute migration
cd "D:\qltbyt-nam-phong"
node scripts/npm-run.js npx supabase db push --linked

# Generate updated types
node scripts/npm-run.js run db:types

# Verify table creation
node scripts/npm-run.js npx supabase inspect db table-stats --linked

# Test rollback (on staging first!)
# node scripts/npm-run.js npx supabase db push --linked -f YYYYMMDD_circular141_rollback.sql
```

### Functional Testing

1. **Create equipment with Circular 141 data**
   ```typescript
   const result = await callRpc({
     fn: 'equipment_create_with_circular141',
     args: {
       p_payload: {
         ten_thiet_bi: 'MRI Scanner',
         ma_thiet_bi: 'MRI-001',
         khoa_phong_quan_ly: 'Khoa Chẩn đoán hình ảnh',
         ngay_dua_vao_su_dung: '2026-01-15',
         cost_details: {
           purchase_price: 50000000000,  // 50B VND (tests DECIMAL(20,2))
           installation_cost: 5000000000,
           import_tax: 2000000000,
         },
         depreciation: {
           usage_purpose: 'business',
           useful_life_years: 8,
           depreciation_rate: 12.5,
         },
         acquisition: {
           acquisition_method: 'mua_sam',
           valuation_method: 'ho_so_goc',
         },
       },
     },
   });
   ```

2. **Calculate annual depreciation**
   ```typescript
   const depreciationResults = await callRpc({
     fn: 'update_annual_depreciation',
     args: {
       p_don_vi: currentDonVi,  // REQUIRED for global users
       p_year: 2026,
     },
   });
   ```

3. **Verify data integrity**
   - Check that `total_historical_cost` is auto-calculated correctly
   - Verify `depreciation_rate` auto-calculated from `useful_life_years`
   - Confirm `gia_goc` syncs with `total_historical_cost`
   - Test edge cases: final year calculation, zero residual value
   - Verify tenant isolation: non-global users cannot see other tenants' data

### Compliance Checks

1. **Fixed Asset Threshold**: Verify equipment ≥10M VND is tracked
2. **Mandatory Fields**: Ensure all required Circular 141 fields captured
3. **Date Logic**: Confirm `date_put_to_use` triggers recording, not project settlement
4. **Depreciation Formula**: Validate straight-line calculation accuracy
5. **Audit Trail**: Check all dates (invoice, handover, put-to-use, recorded) tracked
6. **Multi-year History**: Verify annual depreciation records created

## Critical Files to Modify

1. **Database Schema**:
   - `supabase/migrations/YYYYMMDD_circular141_compliance.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_functions.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_equipment_rpcs.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_backfill.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_rollback.sql` (NEW - Safety)

2. **API Layer**:
   - `src/app/api/rpc/[fn]/route.ts` - Add new functions to whitelist

3. **Type Definitions**:
   - `src/types/circular141.ts` (NEW) - Circular 141 specific types
   - `src/types/database.ts` - Update Equipment interface
   - `src/lib/rpc-client.ts` - Add RPC function type overloads

## Key Decisions & Trade-offs

### 1. Schema Design: Normalized vs Denormalized
**Decision**: Create separate tables (`asset_cost_details`, `asset_depreciation`, `asset_acquisition`, `asset_depreciation_annual`) instead of adding 40+ columns to `thiet_bi`.

**Rationale**:
- ✅ Cleaner data model, easier to maintain
- ✅ Future-proof for additional regulatory requirements
- ✅ Better query performance (join only when needed)
- ✅ Multi-year history tracking enabled
- ❌ Slightly more complex queries (requires JOINs)

### 2. Backward Compatibility
**Decision**: Keep existing fields (`gia_goc`, `nam_tinh_hao_mon`, `ty_le_hao_mon`) and sync with new tables.

**Rationale**:
- ✅ Existing code continues to work
- ✅ Gradual migration path
- ✅ Fallback for legacy data
- ⚠️ Must maintain sync logic (handled via trigger)

### 3. Depreciation Calculation: Real-time vs Batch
**Decision**: Provide both options - on-demand calculation function and set-based batch update.

**Rationale**:
- ✅ Flexibility for different use cases
- ✅ Real-time for single equipment view
- ✅ Batch for annual compliance reporting (optimized with CTEs)
- ✅ Batch size limits prevent DoS attacks

### 4. Representation of Depreciation Rate
**Current**: `ty_le_hao_mon` is TEXT (e.g., "12.5%")
**New**: `depreciation_rate` is DECIMAL(5,2) (e.g., 12.50)

**Decision**: Store as DECIMAL in new table, maintain TEXT in old field for compatibility.

**Rationale**:
- ✅ DECIMAL allows mathematical operations
- ✅ TEXT preserves display format for existing UI
- ✅ Auto-sync trigger handles conversion
- ⚠️ Must handle % stripping in backfill

### 5. UI Implementation Priority
**Decision**: Backend-first approach. UI is Phase 2 enhancement.

**Rationale**:
- ✅ Regulatory compliance at database level is critical
- ✅ UI can be built incrementally
- ✅ API-first approach enables multiple frontends
- ⚠️ Users may need to use database tools temporarily

### 6. Multi-Year History (PROMOTED FROM FUTURE)
**Decision**: Implement `asset_depreciation_annual` table in Phase 1.

**Rationale**:
- ✅ Required for regulatory audits
- ✅ Enables comparative financial reports
- ✅ Supports restatement scenarios
- ✅ Architecture review identified as critical

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data migration errors | High | Use transactions, rollback script, test on staging first |
| Performance degradation | Medium | Set-based batch operations, comprehensive indexes, batch size limits |
| User confusion with new fields | Medium | Phase UI rollout, provide documentation |
| Regulatory interpretation errors | High | Validate with NotebookLM queries, cite sources |
| Backward compatibility breaks | High | Maintain existing fields, sync triggers |
| Security vulnerabilities | Critical | Fixed: tenant isolation, JWT claims, search_path, DoS protection |
| Concurrent update conflicts | Medium | Advisory locks in batch operations |

## Success Criteria

1. ✅ All Circular 141 required fields captured in database
2. ✅ Depreciation calculations match regulatory formulas
3. ✅ Existing equipment backfilled with validated compliance data
4. ✅ RPC functions whitelisted and callable from frontend
5. ✅ Type safety maintained (TypeScript types generated)
6. ✅ Audit trail fields populated for new equipment entries
7. ✅ Performance acceptable (no queries >500ms, batch size limits enforced)
8. ✅ Security model maintained (tenant isolation, no DoS vulnerabilities)
9. ✅ Rollback script tested and ready
10. ✅ Multi-year depreciation history tracking enabled

## Architecture Review Fixes Applied

### Critical Security Fixes (Phase 0)
1. ✅ Added `don_vi_id` to all three new tables + `asset_depreciation_annual`
2. ✅ Replaced `_get_jwt_claim()` with direct `current_setting()` calls
3. ✅ Added `SET search_path = public` to all SECURITY DEFINER functions
4. ✅ Fixed batch function DoS vulnerability (require tenant, add limits)
5. ✅ Changed DECIMAL(18,2) → DECIMAL(20,2) for large medical equipment costs
6. ✅ Changed NVARCHAR → TEXT (PostgreSQL standard)
7. ✅ Added `asset_depreciation_annual` history table (promoted from future)

### Performance & Safety Improvements (Phase 1)
8. ✅ Rewrote batch depreciation as set-based CTE operation (not loop)
9. ✅ Added composite and partial indexes for tenant-aware queries
10. ✅ Extracted equipment create logic to `_equipment_insert_core` helper (DRY)
11. ✅ Fixed trigger race condition with DEFERRABLE INITIALLY DEFERRED
12. ✅ Added validation filters to backfill (10M threshold, non-null dates)
13. ✅ Created rollback migration script

### TypeScript Integration (Phase 2)
14. ✅ Added RPC function type overloads to `rpc-client.ts`
15. ✅ Imported Equipment type in `circular141.ts`
16. ✅ Defined response types (`DepreciationCalculationResult`, `BatchDepreciationResult`)

### Additional Improvements
17. ✅ Added advisory locks for batch operations (prevent concurrent conflicts)
18. ✅ Added database comments for documentation
19. ✅ Added audit trail fields (`created_by`, `updated_by`)
20. ✅ Added validation constraints (depreciation rate 0-100, fiscal year range)

## Future Enhancements (Out of Scope)

1. UI components for Circular 141 data entry
2. Compliance reporting dashboard
3. Automated annual depreciation batch job (cron)
4. Export to National Database on Public Assets format
5. Integration with Ministry of Health equipment category database
6. Asset revaluation workflow
7. Disposal/liquidation workflow with compliance checks
8. Materialized view for reporting performance optimization

## References

All requirements sourced from NotebookLM notebook: "Vietnamese Circular 141/2025/TT-BTC - State Asset Depreciation & Management"

Key regulation points:
- Fixed asset criteria: Value ≥10M VND, useful life ≥1 year
- Default medical equipment: 8 years, 12.5% depreciation
- Straight-line depreciation method required
- Recording triggered by "date put to use", not project settlement
- Annual inventory requirement
- Distinction between Hao mòn (admin) and Khấu hao (business)
- Multi-year depreciation tracking for audit compliance

---

**Plan Status**: Updated with all critical fixes from architecture review
**Last Updated**: 2026-01-20
**Ready for Implementation**: ✅ Yes (after final review)
