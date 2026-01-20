# Plan: Integrate Circular 141/2025/TT-BTC Compliance into Medical Equipment Management System

## Executive Summary

This plan implements Vietnamese Circular 141/2025/TT-BTC state asset depreciation and management regulations (effective Jan 1, 2026) into the existing medical equipment management system. The regulations mandate specific field tracking, depreciation calculation methods, and compliance reporting for public healthcare facilities.

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
CREATE TABLE IF NOT EXISTS public.asset_cost_details (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  -- Cost components
  purchase_price DECIMAL(18,2) DEFAULT 0,           -- Giá mua trên hóa đơn
  import_tax DECIMAL(18,2) DEFAULT 0,              -- Thuế nhập khẩu
  vat_non_refundable DECIMAL(18,2) DEFAULT 0,      -- Thuế GTGT không khấu trừ
  installation_cost DECIMAL(18,2) DEFAULT 0,        -- Chi phí lắp đặt, chạy thử
  fees_and_charges DECIMAL(18,2) DEFAULT 0,        -- Phí, lệ phí
  consulting_cost DECIMAL(18,2) DEFAULT 0,         -- Chi phí tư vấn/Chuyên gia
  compensation_cost DECIMAL(18,2) DEFAULT 0,       -- Chi phí bồi thường, GPMB
  appraised_value DECIMAL(18,2) DEFAULT 0,         -- Giá trị theo đánh giá lại
  total_historical_cost DECIMAL(18,2) GENERATED ALWAYS AS (
    purchase_price + import_tax + vat_non_refundable + installation_cost +
    fees_and_charges + consulting_cost + compensation_cost + appraised_value
  ) STORED,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_cost_per_equipment UNIQUE(thiet_bi_id)
);
```

#### 1.2 Create Depreciation Tracking Table
```sql
CREATE TABLE IF NOT EXISTS public.asset_depreciation (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  -- Classification
  asset_class_id VARCHAR(20),                       -- Mã nhóm tài sản (links to Annex I)
  usage_purpose VARCHAR(20) NOT NULL,               -- 'admin', 'business', 'mixed'
  -- Depreciation parameters
  useful_life_years INT NOT NULL DEFAULT 8,         -- Thời gian sử dụng (Năm)
  depreciation_rate DECIMAL(5,2) NOT NULL,          -- Tỷ lệ hao mòn/khấu hao (%)
  start_depreciation_date DATE,                     -- Ngày bắt đầu tính HM/KH
  -- Calculated values
  annual_depreciation_amount DECIMAL(18,2),         -- Mức hao mòn/khấu hao năm
  accumulated_depreciation DECIMAL(18,2) DEFAULT 0, -- Hao mòn/Khấu hao lũy kế
  residual_value DECIMAL(18,2),                     -- Giá trị còn lại
  -- Special cases
  brand_value_allocation DECIMAL(18,2),             -- Phân bổ giá trị thương hiệu
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_depreciation_per_equipment UNIQUE(thiet_bi_id),
  CONSTRAINT valid_usage_purpose CHECK (usage_purpose IN ('admin', 'business', 'mixed'))
);
```

#### 1.3 Create Acquisition Tracking Table
```sql
CREATE TABLE IF NOT EXISTS public.asset_acquisition (
  id BIGSERIAL PRIMARY KEY,
  thiet_bi_id BIGINT NOT NULL REFERENCES public.thiet_bi(id) ON DELETE CASCADE,
  -- Acquisition details
  acquisition_method VARCHAR(50) NOT NULL,          -- 'mua_sam', 'dau_tu_xdcb', 'dieu_chuyen', 'tang_cho', 'kiem_ke_thua'
  donor_transferor_name NVARCHAR(200),             -- Tên đơn vị giao/tặng
  project_code VARCHAR(50),                         -- Mã dự án
  valuation_method VARCHAR(50),                     -- 'ho_so_goc', 'tham_dinh_gia', 'hoi_dong_dinh_gia'
  is_project_settled BOOLEAN DEFAULT FALSE,         -- Trạng thái quyết toán
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_acquisition_per_equipment UNIQUE(thiet_bi_id),
  CONSTRAINT valid_acquisition_method CHECK (acquisition_method IN ('mua_sam', 'dau_tu_xdcb', 'dieu_chuyen', 'tang_cho', 'kiem_ke_thua')),
  CONSTRAINT valid_valuation_method CHECK (valuation_method IN ('ho_so_goc', 'tham_dinh_gia', 'hoi_dong_dinh_gia'))
);
```

#### 1.4 Enhance `thiet_bi` Table (Audit Trail)
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
    asset_status IN ('dang_su_dung', 'hu_hong_cho_ly', 'da_thanh_ly', 'cho_quyet_toan')
  );
```

#### 1.5 Create Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_cost_details_thiet_bi ON public.asset_cost_details(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_thiet_bi ON public.asset_depreciation(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_acquisition_thiet_bi ON public.asset_acquisition(thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_asset_status ON public.thiet_bi(asset_status);
CREATE INDEX IF NOT EXISTS idx_thiet_bi_inventory_year ON public.thiet_bi(inventory_year);
```

### Phase 2: Database Functions & Triggers

**File**: Same migration or new `YYYYMMDD_circular141_functions.sql`

#### 2.1 Auto-calculate Depreciation Rate Trigger
```sql
CREATE OR REPLACE FUNCTION public.calculate_depreciation_rate()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate rate from useful life if not provided
  IF NEW.depreciation_rate IS NULL OR NEW.depreciation_rate = 0 THEN
    NEW.depreciation_rate := ROUND((100.0 / NULLIF(NEW.useful_life_years, 0))::NUMERIC, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_depreciation_rate
  BEFORE INSERT OR UPDATE ON public.asset_depreciation
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_depreciation_rate();
```

#### 2.2 Sync Historical Cost to Main Table
```sql
CREATE OR REPLACE FUNCTION public.sync_historical_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Update gia_goc in thiet_bi table when cost details change
  UPDATE public.thiet_bi
  SET gia_goc = NEW.total_historical_cost
  WHERE id = NEW.thiet_bi_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_historical_cost
  AFTER INSERT OR UPDATE ON public.asset_cost_details
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_historical_cost();
```

#### 2.3 Annual Depreciation Calculation Function
```sql
CREATE OR REPLACE FUNCTION public.calculate_annual_depreciation(
  p_thiet_bi_id BIGINT,
  p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS TABLE (
  annual_amount DECIMAL(18,2),
  new_accumulated DECIMAL(18,2),
  new_residual DECIMAL(18,2)
) LANGUAGE plpgsql AS $$
DECLARE
  v_historical_cost DECIMAL(18,2);
  v_depreciation_rate DECIMAL(5,2);
  v_current_accumulated DECIMAL(18,2);
  v_start_date DATE;
  v_usage_purpose VARCHAR(20);
  v_annual_amount DECIMAL(18,2);
  v_new_accumulated DECIMAL(18,2);
  v_new_residual DECIMAL(18,2);
  v_years_in_use INT;
  v_useful_life INT;
BEGIN
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
    v_annual_amount := v_historical_cost - v_current_accumulated;
  END IF;

  -- Calculate new values
  v_new_accumulated := LEAST(v_current_accumulated + v_annual_amount, v_historical_cost);
  v_new_residual := v_historical_cost - v_new_accumulated;

  RETURN QUERY SELECT v_annual_amount, v_new_accumulated, v_new_residual;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_annual_depreciation(BIGINT, INT) TO authenticated;
```

#### 2.4 Batch Update Depreciation Function
```sql
CREATE OR REPLACE FUNCTION public.update_annual_depreciation(
  p_don_vi BIGINT DEFAULT NULL,
  p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS TABLE (
  thiet_bi_id BIGINT,
  ten_thiet_bi TEXT,
  annual_amount DECIMAL(18,2),
  new_accumulated DECIMAL(18,2),
  new_residual DECIMAL(18,2)
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  rec RECORD;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation
  IF v_role NOT IN ('global') THEN
    p_don_vi := v_donvi;
  END IF;

  -- Loop through eligible equipment
  FOR rec IN
    SELECT
      tb.id,
      tb.ten_thiet_bi,
      ad.residual_value
    FROM public.thiet_bi tb
    JOIN public.asset_depreciation ad ON tb.id = ad.thiet_bi_id
    WHERE
      (p_don_vi IS NULL OR tb.don_vi = p_don_vi)
      AND ad.residual_value > 0
      AND tb.asset_status = 'dang_su_dung'
  LOOP
    -- Calculate depreciation
    SELECT * INTO annual_amount, new_accumulated, new_residual
    FROM public.calculate_annual_depreciation(rec.id, p_year);

    -- Update depreciation table
    UPDATE public.asset_depreciation
    SET
      annual_depreciation_amount = annual_amount,
      accumulated_depreciation = new_accumulated,
      residual_value = new_residual,
      updated_at = NOW()
    WHERE thiet_bi_id = rec.id;

    -- Return result row
    thiet_bi_id := rec.id;
    ten_thiet_bi := rec.ten_thiet_bi;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_annual_depreciation(BIGINT, INT) TO authenticated;
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
  'equipment_create_with_circular141',  // Enhanced creation
  'equipment_update_with_circular141',  // Enhanced update
] as const;
```

#### 3.2 Create Enhanced Equipment RPC Functions

**File**: New migration `YYYYMMDD_circular141_equipment_rpcs.sql`

```sql
-- Enhanced equipment creation with Circular 141 data
CREATE OR REPLACE FUNCTION public.equipment_create_with_circular141(p_payload JSONB)
RETURNS public.thiet_bi LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_equipment_id BIGINT;
  rec public.thiet_bi;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Create base equipment record using existing function
  SELECT * INTO rec FROM public.equipment_create(p_payload);
  v_equipment_id := rec.id;

  -- Insert cost details if provided
  IF p_payload ? 'cost_details' THEN
    INSERT INTO public.asset_cost_details (
      thiet_bi_id,
      purchase_price,
      import_tax,
      vat_non_refundable,
      installation_cost,
      fees_and_charges,
      consulting_cost,
      compensation_cost,
      appraised_value
    ) VALUES (
      v_equipment_id,
      COALESCE((p_payload->'cost_details'->>'purchase_price')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'import_tax')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'vat_non_refundable')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'installation_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'fees_and_charges')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'consulting_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'compensation_cost')::DECIMAL, 0),
      COALESCE((p_payload->'cost_details'->>'appraised_value')::DECIMAL, 0)
    );
  END IF;

  -- Insert depreciation details
  IF p_payload ? 'depreciation' THEN
    INSERT INTO public.asset_depreciation (
      thiet_bi_id,
      asset_class_id,
      usage_purpose,
      useful_life_years,
      depreciation_rate,
      start_depreciation_date
    ) VALUES (
      v_equipment_id,
      p_payload->'depreciation'->>'asset_class_id',
      COALESCE(p_payload->'depreciation'->>'usage_purpose', 'admin'),
      COALESCE((p_payload->'depreciation'->>'useful_life_years')::INT, 8),
      (p_payload->'depreciation'->>'depreciation_rate')::DECIMAL,
      COALESCE((p_payload->'depreciation'->>'start_depreciation_date')::DATE, rec.ngay_dua_vao_su_dung)
    );
  END IF;

  -- Insert acquisition details
  IF p_payload ? 'acquisition' THEN
    INSERT INTO public.asset_acquisition (
      thiet_bi_id,
      acquisition_method,
      donor_transferor_name,
      project_code,
      valuation_method,
      is_project_settled
    ) VALUES (
      v_equipment_id,
      p_payload->'acquisition'->>'acquisition_method',
      p_payload->'acquisition'->>'donor_transferor_name',
      p_payload->'acquisition'->>'project_code',
      p_payload->'acquisition'->>'valuation_method',
      COALESCE((p_payload->'acquisition'->>'is_project_settled')::BOOLEAN, FALSE)
    );
  END IF;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_create_with_circular141(JSONB) TO authenticated;
```

### Phase 4: TypeScript Type Definitions

**File**: `src/types/circular141.ts` (new file)

```typescript
// Circular 141/2025/TT-BTC compliance types

export interface AssetCostDetails {
  id?: number;
  thiet_bi_id: number;
  purchase_price: number;          // Giá mua trên hóa đơn
  import_tax: number;              // Thuế nhập khẩu
  vat_non_refundable: number;      // Thuế GTGT không khấu trừ
  installation_cost: number;        // Chi phí lắp đặt, chạy thử
  fees_and_charges: number;        // Phí, lệ phí
  consulting_cost: number;         // Chi phí tư vấn
  compensation_cost: number;       // Chi phí bồi thường
  appraised_value: number;         // Giá trị theo đánh giá lại
  total_historical_cost?: number;  // Auto-calculated
  created_at?: string;
  updated_at?: string;
}

export type UsagePurpose = 'admin' | 'business' | 'mixed';

export interface AssetDepreciation {
  id?: number;
  thiet_bi_id: number;
  asset_class_id?: string;                 // Mã nhóm tài sản
  usage_purpose: UsagePurpose;             // Hao mòn vs Khấu hao
  useful_life_years: number;               // Thời gian sử dụng (Năm)
  depreciation_rate: number;               // Tỷ lệ hao mòn/khấu hao (%)
  start_depreciation_date?: string;        // Ngày bắt đầu tính
  annual_depreciation_amount?: number;     // Mức hao mòn/khấu hao năm
  accumulated_depreciation: number;        // Lũy kế
  residual_value?: number;                 // Giá trị còn lại
  brand_value_allocation?: number;         // Phân bổ thương hiệu
  created_at?: string;
  updated_at?: string;
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
  acquisition_method: AcquisitionMethod;
  donor_transferor_name?: string;
  project_code?: string;
  valuation_method?: ValuationMethod;
  is_project_settled: boolean;
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
INSERT INTO public.asset_depreciation (
  thiet_bi_id,
  usage_purpose,
  useful_life_years,
  depreciation_rate,
  start_depreciation_date,
  accumulated_depreciation,
  residual_value
)
SELECT
  tb.id,
  'admin' as usage_purpose,
  COALESCE(tb.nam_tinh_hao_mon, 8) as useful_life_years,
  CASE
    WHEN tb.ty_le_hao_mon IS NOT NULL THEN
      REPLACE(tb.ty_le_hao_mon, '%', '')::DECIMAL
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
);

-- Backfill cost details with gia_goc
INSERT INTO public.asset_cost_details (
  thiet_bi_id,
  purchase_price
)
SELECT
  tb.id,
  COALESCE(tb.gia_goc, 0)
FROM public.thiet_bi tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_cost_details cd
  WHERE cd.thiet_bi_id = tb.id
);

-- Backfill acquisition with default purchase method
INSERT INTO public.asset_acquisition (
  thiet_bi_id,
  acquisition_method,
  valuation_method,
  is_project_settled
)
SELECT
  tb.id,
  'mua_sam',
  'ho_so_goc',
  TRUE
FROM public.thiet_bi tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.asset_acquisition aa
  WHERE aa.thiet_bi_id = tb.id
);

-- Set default asset status
UPDATE public.thiet_bi
SET asset_status = 'dang_su_dung'
WHERE asset_status IS NULL;
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
         cost_details: {
           purchase_price: 50000000,
           installation_cost: 5000000,
           import_tax: 2000000,
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
       p_don_vi: currentDonVi,
       p_year: 2026,
     },
   });
   ```

3. **Verify data integrity**
   - Check that `total_historical_cost` is auto-calculated correctly
   - Verify `depreciation_rate` auto-calculated from `useful_life_years`
   - Confirm `gia_goc` syncs with `total_historical_cost`
   - Test edge cases: final year calculation, zero residual value

### Compliance Checks

1. **Fixed Asset Threshold**: Verify equipment ≥10M VND is tracked
2. **Mandatory Fields**: Ensure all required Circular 141 fields captured
3. **Date Logic**: Confirm `date_put_to_use` triggers recording, not project settlement
4. **Depreciation Formula**: Validate straight-line calculation accuracy
5. **Audit Trail**: Check all dates (invoice, handover, put-to-use, recorded) tracked

## Critical Files to Modify

1. **Database Schema**:
   - `supabase/migrations/YYYYMMDD_circular141_compliance.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_functions.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_equipment_rpcs.sql` (NEW)
   - `supabase/migrations/YYYYMMDD_circular141_backfill.sql` (NEW)

2. **API Layer**:
   - `src/app/api/rpc/[fn]/route.ts` - Add new functions to whitelist

3. **Type Definitions**:
   - `src/types/circular141.ts` (NEW) - Circular 141 specific types
   - `src/types/database.ts` - Update Equipment interface

4. **RPC Client**:
   - `src/lib/rpc-client.ts` - Add type definitions for new RPC functions

## Key Decisions & Trade-offs

### 1. Schema Design: Normalized vs Denormalized
**Decision**: Create separate tables (`asset_cost_details`, `asset_depreciation`, `asset_acquisition`) instead of adding 30+ columns to `thiet_bi`.

**Rationale**:
- ✅ Cleaner data model, easier to maintain
- ✅ Future-proof for additional regulatory requirements
- ✅ Better query performance (join only when needed)
- ❌ Slightly more complex queries (requires JOINs)

### 2. Backward Compatibility
**Decision**: Keep existing fields (`gia_goc`, `nam_tinh_hao_mon`, `ty_le_hao_mon`) and sync with new tables.

**Rationale**:
- ✅ Existing code continues to work
- ✅ Gradual migration path
- ✅ Fallback for legacy data
- ⚠️ Must maintain sync logic (handled via trigger)

### 3. Depreciation Calculation: Real-time vs Batch
**Decision**: Provide both options - on-demand calculation function and batch update function.

**Rationale**:
- ✅ Flexibility for different use cases
- ✅ Real-time for single equipment view
- ✅ Batch for annual compliance reporting
- ⚠️ Must ensure consistency between approaches

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

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data migration errors | High | Use transactions, test on copy first |
| Performance degradation | Medium | Add indexes, monitor query plans |
| User confusion with new fields | Medium | Phase UI rollout, provide documentation |
| Regulatory interpretation errors | High | Validate with NotebookLM queries, cite sources |
| Backward compatibility breaks | High | Maintain existing fields, gradual deprecation |

## Success Criteria

1. ✅ All Circular 141 required fields captured in database
2. ✅ Depreciation calculations match regulatory formulas
3. ✅ Existing equipment backfilled with default compliance data
4. ✅ RPC functions whitelisted and callable from frontend
5. ✅ Type safety maintained (TypeScript types generated)
6. ✅ Audit trail fields populated for new equipment entries
7. ✅ Performance acceptable (no queries >500ms)

## Future Enhancements (Out of Scope)

1. UI components for Circular 141 data entry
2. Compliance reporting dashboard
3. Automated annual depreciation batch job (cron)
4. Export to National Database on Public Assets format
5. Integration with Ministry of Health equipment category database
6. Multi-year depreciation history tracking
7. Asset revaluation workflow
8. Disposal/liquidation workflow with compliance checks

## References

All requirements sourced from NotebookLM notebook: "Vietnamese Circular 141/2025/TT-BTC - State Asset Depreciation & Management"

Key regulation points:
- Fixed asset criteria: Value ≥10M VND, useful life ≥1 year
- Default medical equipment: 8 years, 12.5% depreciation
- Straight-line depreciation method required
- Recording triggered by "date put to use", not project settlement
- Annual inventory requirement
- Distinction between Hao mòn (admin) and Khấu hao (business)
