# Plan: Phase 2 - Category Bulk Import with Shared Component

> **Status:** Ready for Approval
> **Prerequisite:** Phase 1 (CRUD UI) is complete

## Overview

Implement bulk import for Equipment Categories (`nhom_thiet_bi`) while **first** creating a shared bulk import component system to eliminate ~300 lines of duplicated code across existing implementations.

## Current State

| Component | Status |
|-----------|--------|
| Phase 1 CRUD UI (`/device-quota/categories`) | ✅ Complete |
| Import dialog state in context | ✅ Ready (lines 55-57, 275-281) |
| Toolbar import buttons | ❌ Missing |
| Shared bulk import component | ❌ Missing |
| Category import dialog | ❌ Missing |
| `dinh_muc_nhom_bulk_import` RPC | ❌ Missing |
| Category Excel template generator | ❌ Missing |

## Existing Bulk Import Implementations (to extract patterns from)

1. **Equipment Import** - `src/components/import-equipment-dialog.tsx` (460 lines)
2. **Device Quota Import** - `src/app/(app)/device-quota/decisions/_components/DeviceQuotaImportDialog.tsx` (559 lines)

**~300 lines duplicated** across both (state management, file upload, error UI, etc.)

---

## Architecture: Shared Bulk Import Component

### Design Philosophy

**Composition over Configuration**: Use compound components + custom hook, not a monolithic config object.

### File Structure

```
src/components/bulk-import/
├── index.ts                      # Public exports
├── useBulkImportState.ts         # ~60 lines - State management hook
├── BulkImportDialogParts.tsx     # ~120 lines - Reusable UI pieces
├── bulk-import-types.ts          # ~40 lines - Shared types
└── bulk-import-error-utils.ts    # ~60 lines - Error translation
```

### Core Interfaces

```typescript
// bulk-import-types.ts
export interface BulkImportRpcResult<TDetail = unknown> {
  success: boolean
  inserted: number
  updated?: number  // Optional for upsert
  failed: number
  total: number
  details: TDetail[]
}

export interface BulkImportState<TRow> {
  status: 'idle' | 'parsing' | 'parsed' | 'submitting' | 'success' | 'error'
  selectedFile: File | null
  parsedData: TRow[]
  parseError: string | null
  validationErrors: string[]
}

export interface ValidationResult<TRow> {
  isValid: boolean
  errors: string[]
  validRecords: TRow[]
}
```

### Custom Hook

```typescript
// useBulkImportState.ts
export function useBulkImportState<TRaw, TRow>(options: {
  headerMap: Record<string, string>
  transformRow: (raw: Record<string, unknown>) => TRaw
  validateData: (data: TRaw[]) => ValidationResult<TRow>
}): {
  state: BulkImportState<TRow>
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  resetState: () => void
  setSubmitting: () => void
  setSuccess: () => void
  setSubmitError: (error: string) => void
}
```

### Compound UI Components

```typescript
// BulkImportDialogParts.tsx
export function BulkImportFileInput(props: {...}): JSX.Element
export function BulkImportErrorAlert(props: { error: string | null }): JSX.Element | null
export function BulkImportValidationErrors(props: { errors: string[] }): JSX.Element | null
export function BulkImportSuccessMessage(props: {...}): JSX.Element | null
export function BulkImportSubmitButton(props: {...}): JSX.Element
```

### Error Utilities

```typescript
// bulk-import-error-utils.ts
export function translateBulkImportError(error: string): string
export function formatImportResultErrors(details: BulkImportDetailItem[]): string
export function buildImportToastMessage(params: {...}): ToastConfig
```

---

## Implementation Order

### Step 1: Create Shared Bulk Import Infrastructure

**Files to create:**

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/bulk-import/bulk-import-types.ts` | ~40 | TypeScript interfaces |
| `src/components/bulk-import/useBulkImportState.ts` | ~60 | State management hook |
| `src/components/bulk-import/BulkImportDialogParts.tsx` | ~120 | Compound UI components |
| `src/components/bulk-import/bulk-import-error-utils.ts` | ~60 | Error translation (extend existing `error-translations.ts`) |
| `src/components/bulk-import/index.ts` | ~15 | Public exports |

**Pattern sources:**
- State management: Extract from `DeviceQuotaImportDialog.tsx:286-291`
- Error UI: Extract from `import-equipment-dialog.tsx:405-423`
- File input: Extract from `DeviceQuotaImportDialog.tsx:311-325`

---

### Step 2: Add Category Bulk Import RPC

**Migration file:** `supabase/migrations/YYYYMMDD_dinh_muc_nhom_bulk_import.sql`

```sql
CREATE OR REPLACE FUNCTION public.dinh_muc_nhom_bulk_import(
  p_items JSONB,
  p_don_vi BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT;
  v_inserted INT := 0;
  v_failed INT := 0;
  v_details JSONB := '[]'::jsonb;
  -- ... more declarations
BEGIN
  -- 1. Permission check
  IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- 2. Tenant isolation
  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  -- 3. Cycle detection via recursive CTE
  -- 4. Topological sort (parents before children)
  -- 5. Per-item INSERT with error recovery
  -- 6. Return {success, inserted, failed, total, details}
END;
$$;
```

**Key features:**
- Transactional: Individual item recovery (per-item `EXCEPTION WHEN OTHERS`)
- Parent resolution: Lookup `parent_ma_nhom` → `parent_id`
- Cycle detection: Recursive CTE before insert
- Topological sort: Insert parents before children
- Advisory lock: `pg_advisory_xact_lock(hashtext('nhom_thiet_bi_import_' || p_don_vi::text))`

**Whitelist:** Add `dinh_muc_nhom_bulk_import` to `src/app/api/rpc/[fn]/route.ts`

---

### Step 3: Create Category Import Dialog

**File:** `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`

**Pattern:** Zero-props, context-controlled (uses `useDeviceQuotaCategoryContext`)

**Header mapping:**
```typescript
const HEADER_MAP = {
  'Mã nhóm': 'ma_nhom',
  'Tên nhóm': 'ten_nhom',
  'Mã nhóm cha': 'parent_ma_nhom',
  'Phân loại (A/B)': 'phan_loai',
  'Đơn vị tính': 'don_vi_tinh',
  'Thứ tự hiển thị': 'thu_tu_hien_thi',
  'Mô tả': 'mo_ta',
}
```

**Validation rules:**
1. Required: `ma_nhom`, `ten_nhom`
2. Format: `ma_nhom` pattern (XX, XX.XX, XX.XX.XXX)
3. Uniqueness: `ma_nhom` not in existing categories or earlier rows
4. Parent exists: `parent_ma_nhom` in existing or earlier rows
5. Classification: `phan_loai` in ['A', 'B', null] (only A/B per TT 08/2019)

---

### Step 4: Create Category Template Generator

**File:** `src/lib/category-excel.ts`

**Template structure (2 sheets):**
1. **"Nhập Danh Mục"** - Data entry with validation dropdowns (Phân loại: A/B)
2. **"Hướng Dẫn"** - Instructions in Vietnamese

**Required fields (red headers):** Mã nhóm, Tên nhóm
**Dropdown validation:** Phân loại (A, B)

---

### Step 5: Update Toolbar with Import Buttons

**File:** `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx`

**Add buttons:**
- "Nhập từ Excel" → `openImportDialog()`
- "Tải mẫu Excel" → Download template

---

### Step 6: Wire Import Dialog in Page

**File:** `src/app/(app)/device-quota/categories/page.tsx`

Add `<DeviceQuotaCategoryImportDialog />` inside provider.

---

### Step 7 (Optional): Refactor Existing Import Dialogs

After Category Import works, refactor to use shared components:
1. `src/components/import-equipment-dialog.tsx` - Save ~310 lines
2. `src/app/(app)/device-quota/decisions/_components/DeviceQuotaImportDialog.tsx` - Save ~400 lines

**Total savings:** ~470 lines net (280 shared + 470 removed - 280 shared = 470 net)

---

## Files to Create

| File | Est. Lines |
|------|------------|
| `src/components/bulk-import/bulk-import-types.ts` | 40 |
| `src/components/bulk-import/useBulkImportState.ts` | 60 |
| `src/components/bulk-import/BulkImportDialogParts.tsx` | 120 |
| `src/components/bulk-import/bulk-import-error-utils.ts` | 60 |
| `src/components/bulk-import/index.ts` | 15 |
| `supabase/migrations/YYYYMMDD_dinh_muc_nhom_bulk_import.sql` | 150 |
| `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx` | 140 |
| `src/lib/category-excel.ts` | 200 |

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/rpc/[fn]/route.ts` | Add `dinh_muc_nhom_bulk_import` to ALLOWED_FUNCTIONS |
| `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx` | Add import buttons |
| `src/app/(app)/device-quota/categories/page.tsx` | Render import dialog |

## Reuse From Existing Code

| Need | Source | Path |
|------|--------|------|
| Excel parsing | `readExcelFile`, `worksheetToJson` | `src/lib/excel-utils.ts` |
| Error translation | `translateRpcError` | `src/lib/error-translations.ts` |
| Template generation pattern | `generateDeviceQuotaImportTemplate` | `src/lib/device-quota-excel.ts` |
| RPC bulk pattern | `dinh_muc_chi_tiet_bulk_import` | `supabase/migrations/20260202_dinh_muc_chi_tiet_bulk_import.sql` |
| Context pattern | `DeviceQuotaCategoryContext` | Already exists with import state |

---

## Verification

### Unit Tests
1. `useBulkImportState` hook - file parsing, state transitions
2. `BulkImportDialogParts` - render tests
3. Category validation logic - uniqueness, parent resolution

### Integration Tests
1. Upload valid Excel → categories imported
2. Upload with duplicate `ma_nhom` → error shown, nothing inserted
3. Upload with missing parent → error shown
4. Upload with cycle (A→B→A) → cycle detected, nothing inserted
5. Concurrent uploads → advisory lock prevents race

### Manual Verification
```bash
# 1. Build passes
node scripts/npm-run.js run build

# 2. Typecheck passes
node scripts/npm-run.js run typecheck

# 3. Tests pass
node scripts/npm-run.js run test:run

# 4. Navigate to /device-quota/categories
# 5. Click "Tải mẫu Excel" → template downloads
# 6. Fill template, click "Nhập từ Excel" → import succeeds
# 7. Verify categories appear in tree
```

---

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Priority | Maximum reusability - refactor all 3 dialogs to use shared components |
| Abstraction level | Composition with compound components + hook (not config object) |
| RPC error handling | Per-item recovery (continue on error, return details) |
| Parent reference | Lookup by `ma_nhom` code (user-friendly, server resolves to ID) |
| TT 08 dataset | Skip for now - add as separate enhancement later |
| phan_loai values | Only 'A' or 'B' (per TT 08/2019) |
| Duplicate handling | Error (no upsert in bulk import) |
| Cycle detection | Server-side via recursive CTE |
| Advisory lock | Yes, prevent concurrent imports per tenant |
| Refactor existing | Follow-up after Category Import works |
