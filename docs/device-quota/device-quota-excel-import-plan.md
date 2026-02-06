# Excel Import for Device Quota Line Items

**Created:** 2026-02-02
**Status:** Approved
**Feature:** Bulk import quota line items from Excel spreadsheet

## Overview

Implement bulk import of quota line items (`chi_tiet_dinh_muc`) from Excel spreadsheets, following the established equipment import pattern.

---

## Regulatory Basis (From NotebookLM - Circular 46/2025/TT-BYT)

### Required Fields per Regulation

According to Thông tư 46/2025/TT-BYT and Thông tư 08/2019/TT-BYT:

| Field | Vietnamese | Required | Notes |
|-------|------------|----------|-------|
| STT | Số thứ tự | ✅ | Sequential number |
| Nhóm/Phân loại | Group classification | ✅ | Tree structure (I → A → 1) |
| Danh mục, chủng loại | Equipment name | ✅ | Standardized generic name |
| Đơn vị tính | Unit | ✅ | Critical: "Cái", "Hệ thống", "Bộ" |
| Số lượng (Định mức) | Quota quantity | ✅ | Maximum allowed |
| Ghi chú | Notes | ❌ | Additional info |

### Hierarchy Structure (3-4 Levels)

```
I. THIẾT BỊ Y TẾ CHUYÊN DÙNG ĐẶC THÙ (Level 1 - Roman numeral)
├── A. Nhóm Chẩn đoán hình ảnh (Level 2 - Letter)
│   ├── 1. Máy X quang kỹ thuật số (Level 3 - Number) ← IMPORT THIS LEVEL
│   ├── 2. Máy siêu âm tổng quát
│   └── 3. Hệ thống CT Scanner
│
└── B. Nhóm Hồi sức cấp cứu
    ├── 1. Máy giúp thở
    └── 2. Máy gây mê kèm thở

II. THIẾT BỊ Y TẾ CHUYÊN DÙNG KHÁC
└── ...
```

**Import targets Level 3** (individual equipment items with quantities).

---

## Scope Clarification

### In Scope (This Plan)
- Excel import for quota line items (`chi_tiet_dinh_muc`)
- Template generation with category reference sheet
- Bulk import RPC function
- Import dialog UI component

### Out of Scope (Deferred)
- **Backfilling `thiet_bi.nhom_thiet_bi_id`** - Will use AI/Keyword auto-suggestion feature (future work)
- Equipment categories (`nhom_thiet_bi`) are assumed to be pre-defined before importing quotas
- Compliance calculation depends on equipment-to-category mapping being completed separately

---

## Excel Template Design

### Sheet 1: "Nhập Định Mức" (Data Entry)

| Column | Header (Vietnamese) | DB Field | Type | Required | Notes |
|--------|---------------------|----------|------|----------|-------|
| A | STT | - | Integer | ❌ | Auto-generated, for reference |
| B | Mã nhóm thiết bị | `nhom_thiet_bi_id` | Text (lookup) | ✅ | Maps to `ma_nhom` in `nhom_thiet_bi` |
| C | Tên thiết bị | - | Text | ❌ | Display only (from category lookup) |
| D | Đơn vị tính | - | Text | ❌ | Display only (from category) |
| E | Số lượng định mức | `so_luong_toi_da` | Integer | ✅ | Maximum allowed (must be > 0) |
| F | Số lượng tối thiểu | `so_luong_toi_thieu` | Integer | ❌ | Minimum required (≤ định mức) |
| G | Ghi chú | `ghi_chu` | Text | ❌ | Additional notes |

### Sheet 2: "Danh Mục Thiết Bị" (Reference Lookup) - PRE-POPULATED

Pre-populated with all equipment categories from `nhom_thiet_bi` when template is downloaded:

| Column | Header | Source |
|--------|--------|--------|
| A | Mã nhóm | `ma_nhom` |
| B | Tên thiết bị | `ten_nhom` |
| C | Phân loại | `phan_loai` (Đặc thù / Khác) |
| D | Đơn vị tính | `don_vi_tinh` |
| E | Nhóm cha | Parent category name |

### Sheet 3: "Hướng Dẫn" (Instructions)

Vietnamese instructions explaining:
1. Required fields (red headers): Mã nhóm, Số lượng định mức
2. How to look up category codes from Sheet 2
3. Quantity validation: phải > 0, tối thiểu ≤ định mức
4. Legal basis: Thông tư 46/2025/TT-BYT, Thông tư 08/2019/TT-BYT
5. Criteria for determining quantities (bed count, workload, staff capacity)

### Data Validation

- **Column B (Mã nhóm)**: Dropdown from "Danh Mục Thiết Bị"!A:A
- **Column E/F (Quantities)**: Whole number >= 0

### Duplicate Handling

If the same `ma_nhom` appears multiple times in the Excel file, use **UPSERT behavior** (last row wins). This follows standard database semantics and the existing `dinh_muc_chi_tiet_upsert` RPC pattern.

---

## Implementation Tasks

### Task 1: RPC Function for Bulk Import

**File:** `supabase/migrations/YYYYMMDDHHMMSS_dinh_muc_chi_tiet_bulk_import.sql`

```sql
CREATE FUNCTION dinh_muc_chi_tiet_bulk_import(
  p_quyet_dinh_id BIGINT,
  p_items JSONB,  -- [{ma_nhom, so_luong_dinh_muc, so_luong_toi_thieu?, ghi_chu?}]
  p_don_vi BIGINT DEFAULT NULL
) RETURNS JSONB
```

**Logic:**
1. Extract JWT claims for tenant isolation
2. Validate decision exists, belongs to tenant, and is in `draft` status
3. For each item in `p_items`:
   - Lookup `nhom_thiet_bi_id` from `ma_nhom` (within same tenant)
   - Validate `so_luong_dinh_muc > 0`
   - Validate `so_luong_toi_thieu <= so_luong_dinh_muc` (if provided)
   - UPSERT into `chi_tiet_dinh_muc`
   - Log to `lich_su_dinh_muc`
4. Return `{success, inserted, updated, failed, errors[]}`

### Task 2: API Whitelist

**File:** `src/app/api/rpc/[fn]/route.ts`

Add to `ALLOWED_FUNCTIONS`:
```typescript
'dinh_muc_chi_tiet_bulk_import',
```

### Task 3: Excel Template Generator

**File:** `src/lib/device-quota-excel.ts` (new file)

```typescript
export async function generateDeviceQuotaImportTemplate(
  categories: NhomThietBi[]
): Promise<Blob>
```

**Sheets:**
1. "Nhập Định Mức" - Data entry with dropdowns
2. "Danh Mục Thiết Bị" - Pre-populated category reference
3. "Hướng Dẫn" - Vietnamese instructions with legal basis

**Features:**
- Red headers for required columns (Mã nhóm, Số lượng định mức)
- Dropdown validation for category codes
- Integer validation for quantity fields
- Legal references to Thông tư 46/2025 and 08/2019

### Task 4: Import Dialog Component

**File:** `src/app/(app)/device-quota/_components/DeviceQuotaImportDialog.tsx`

**Pattern:** Follow `ImportEquipmentDialog.tsx` structure

```typescript
interface DeviceQuotaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quyetDinhId: number
  onSuccess: () => void
}
```

**Validation Rules:**
- Required: `ma_nhom`, `so_luong_dinh_muc`
- `so_luong_dinh_muc` must be integer > 0
- `so_luong_toi_thieu` (if provided) must be ≤ `so_luong_dinh_muc`
- `ma_nhom` must exist in category list

**Error Display:**
- Row-level errors with Vietnamese messages
- Summary of successful/failed imports

### Task 5: Hook for Template Download

**File:** `src/app/(app)/device-quota/_hooks/useDeviceQuotaExcel.ts`

```typescript
export function useDeviceQuotaTemplateDownload(quyetDinhId: number)
export function useDeviceQuotaBulkImport(quyetDinhId: number)
```

### Task 6: Integration in UI

**File:** `src/app/(app)/device-quota/_components/DeviceQuotaChiTietToolbar.tsx`

Add buttons:
- "Tải mẫu Excel" - Download template with current categories
- "Nhập từ Excel" - Open import dialog

---

## Files Summary

| File | Action | Est. Lines |
|------|--------|------------|
| `supabase/migrations/..._dinh_muc_chi_tiet_bulk_import.sql` | Create | ~100 |
| `src/app/api/rpc/[fn]/route.ts` | Modify | +1 |
| `src/lib/device-quota-excel.ts` | Create | ~200 |
| `src/app/(app)/device-quota/_components/DeviceQuotaImportDialog.tsx` | Create | ~350 |
| `src/app/(app)/device-quota/_hooks/useDeviceQuotaExcel.ts` | Create | ~80 |
| `src/app/(app)/device-quota/_components/DeviceQuotaChiTietToolbar.tsx` | Modify | +20 |

---

## Verification

1. **Template Generation:**
   - [ ] Download template button works
   - [ ] Template has 3 sheets (Nhập Định Mức, Danh Mục Thiết Bị, Hướng Dẫn)
   - [ ] Category dropdown populated with all leaf equipment categories
   - [ ] Required columns have red headers
   - [ ] Legal basis mentioned in instructions

2. **Import Flow:**
   - [ ] Select file → parse → validate → display preview
   - [ ] Row-level validation errors in Vietnamese
   - [ ] Successful import shows inserted/updated count
   - [ ] Data appears in quota details table after refresh

3. **Edge Cases:**
   - [ ] Duplicate `ma_nhom` in file → last row wins (UPSERT)
   - [ ] Invalid `ma_nhom` → row error with message
   - [ ] `so_luong_toi_thieu > so_luong_dinh_muc` → row error
   - [ ] Published decision → reject entire import with message
   - [ ] Empty file → "Không có dữ liệu" error

4. **Security:**
   - [ ] Only `draft` decisions can be imported to
   - [ ] Tenant isolation enforced via JWT claims
   - [ ] RPC function in ALLOWED_FUNCTIONS whitelist

---

## Sample Excel Template Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sheet: Nhập Định Mức                                                        │
├─────┬────────────┬──────────────────────┬──────────┬──────────┬─────────────┤
│ STT │ Mã nhóm*   │ Tên thiết bị         │ ĐVT      │ Định mức*│ Tối thiểu   │
├─────┼────────────┼──────────────────────┼──────────┼──────────┼─────────────┤
│ 1   │ I.A.1      │ Máy X-quang KTS      │ Cái      │ 3        │ 1           │
│ 2   │ I.A.2      │ Máy siêu âm tổng quát│ Cái      │ 5        │ 2           │
│ 3   │ I.B.1      │ Máy giúp thở         │ Cái      │ 12       │ 6           │
│ 4   │ II.A.1     │ Tủ an toàn sinh học  │ Cái      │ 2        │ 1           │
└─────┴────────────┴──────────────────────┴──────────┴──────────┴─────────────┘
* = Bắt buộc (tiêu đề màu đỏ)

┌─────────────────────────────────────────────────────────────────────────────┐
│ Sheet: Danh Mục Thiết Bị (Tra cứu) - PRE-POPULATED ON DOWNLOAD              │
├────────────┬──────────────────────────────┬────────────┬──────────┬─────────┤
│ Mã nhóm    │ Tên thiết bị                 │ Phân loại  │ ĐVT      │ Nhóm cha│
├────────────┼──────────────────────────────┼────────────┼──────────┼─────────┤
│ I.A.1      │ Máy X-quang kỹ thuật số      │ Đặc thù    │ Cái      │ CĐHA    │
│ I.A.2      │ Máy siêu âm tổng quát        │ Đặc thù    │ Cái      │ CĐHA    │
│ I.B.1      │ Máy giúp thở                 │ Đặc thù    │ Cái      │ Hồi sức │
│ II.A.1     │ Tủ an toàn sinh học          │ Khác       │ Cái      │ XN      │
└────────────┴──────────────────────────────┴────────────┴──────────┴─────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Sheet: Hướng Dẫn                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ HƯỚNG DẪN NHẬP ĐỊNH MỨC THIẾT BỊ TỪ EXCEL                                   │
│                                                                             │
│ 1. CĂN CỨ PHÁP LÝ:                                                          │
│    - Thông tư 46/2025/TT-BYT (hiệu lực 15/02/2026)                          │
│    - Thông tư 08/2019/TT-BYT (phương pháp tính)                             │
│                                                                             │
│ 2. CÁC TRƯỜNG BẮT BUỘC (tiêu đề màu đỏ):                                    │
│    - Mã nhóm thiết bị: Tra cứu từ Sheet "Danh Mục Thiết Bị"                 │
│    - Số lượng định mức: Số nguyên > 0                                       │
│                                                                             │
│ 3. QUY TẮC SỐ LƯỢNG:                                                        │
│    - Số lượng tối thiểu phải ≤ Số lượng định mức                            │
│    - Căn cứ xác định: quy mô giường bệnh, tần suất sử dụng, nhân lực        │
│                                                                             │
│ 4. LƯU Ý:                                                                   │
│    - Chỉ nhập vào Quyết định ở trạng thái "Dự thảo"                         │
│    - Nếu trùng Mã nhóm, dòng sau sẽ ghi đè dòng trước                       │
└─────────────────────────────────────────────────────────────────────────────┘
```
