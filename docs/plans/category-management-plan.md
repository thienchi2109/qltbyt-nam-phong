# Plan: Equipment Category Management (Categories Page + Bulk Import)

> **Status:** Reviewed and Updated
> **Last Updated:** 2026-02-05

## Problem Statement

The `nhom_thiet_bi` table has **0 rows**. Admins/to_qltb have no way to create equipment categories required for:
1. Equipment classification (mapping equipment to categories)
2. Quota definition (defining min/max quantities per category)
3. Compliance tracking (comparing actual vs. quota)

The documentation claims categories are "pre-loaded per TT 08/2019" but no seed data or import mechanism exists.

## Current State

| Component | Status |
|-----------|--------|
| `dinh_muc_nhom_list` RPC | ✅ Ready |
| `dinh_muc_nhom_get` RPC | ✅ Ready |
| `dinh_muc_nhom_upsert` RPC | ✅ Ready |
| `dinh_muc_nhom_delete` RPC | ✅ Ready |
| RPCs whitelisted in `/api/rpc/[fn]` | ✅ Ready |
| `/device-quota/mapping` (assignment UI) | ✅ Ready |
| `/device-quota/categories` (management UI) | ❌ Missing |
| Category bulk import (Excel) | ❌ Missing |
| Canonical TT 08/2019 dataset file | ❌ Missing |
| `ma_nhom` uniqueness constraint | ❌ Missing |
| Sample data script | ✅ Exists (`scripts/generate-sample-nhom-thiet-bi.ts`) |

## Solution Overview

### Phase 1: Category CRUD UI (New Management Page)
Add UI to create/edit/delete categories one-by-one in `/device-quota/categories` (new page).

### Phase 2: Bulk Import (Excel)
Add Excel import dialog + **required** bulk import RPC to load TT 08/2019 hierarchy. Excel template is generated from a canonical dataset file committed in the repo.

### Mapping Page Behavior
`/device-quota/mapping` remains for assigning equipment to categories. If no categories exist, it should link admins/to_qltb to `/device-quota/categories` to create/import them.

### Device-Quota Navigation (Best Practice)
Add a module-level sub-nav inside `/device-quota` (keep the main sidebar shallow). Sub-nav items:
- Dashboard (`/device-quota/dashboard`)
- Decisions (`/device-quota/decisions`)
- Mapping (`/device-quota/mapping`)
- Categories (`/device-quota/categories`, role-gated to `global` / `to_qltb`)

---

## Type Definitions

**File:** `src/app/(app)/device-quota/categories/_types/categories.ts`

```typescript
// Base type from dinh_muc_nhom_list RPC
export interface CategoryListItem {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
  phan_loai: 'A' | 'B' | 'C' | 'D' | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number
  level: number
  so_luong_hien_co: number
}

// Full type for edit dialog (from dinh_muc_nhom_get RPC)
export interface CategoryFull extends CategoryListItem {
  mo_ta: string | null
  created_at: string
  updated_at: string
}

// Form input type for create/edit
export interface CategoryFormInput {
  ma_nhom: string
  ten_nhom: string
  parent_id: number | null
  phan_loai: 'A' | 'B' | 'C' | 'D' | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number
  mo_ta: string | null
}

// Dialog state discriminated union
export type CategoryDialogState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; category: CategoryFull }

// Delete dialog state
export interface CategoryDeleteState {
  categoryToDelete: CategoryListItem | null
}
```

---

## Phase 1: Category CRUD UI (Management Page)

### Files to Create

#### 1. `src/app/(app)/device-quota/categories/page.tsx`
**Purpose:** New category management page at `/device-quota/categories`

**Access control (UI):**
- Allowed roles: `global`, `to_qltb` (note: `admin` is normalized to `global` by API proxy)
- Others: show Access Denied UI (pattern from `activity-logs/page.tsx`) or redirect to `/dashboard`

**Renders:**
- Toolbar (create/import/download template)
- Category tree with edit/delete actions
- Create/Edit dialog
- Delete confirmation dialog
- Import dialog

#### 2. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx`
**Purpose:** Separate context for category CRUD operations

**Provides:**
```typescript
interface CategoryContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  categories: CategoryListItem[]
  isLoading: boolean

  // Dialog state (discriminated union)
  dialogState: CategoryDialogState
  mutatingCategoryId: number | null  // For inline loading spinners

  // Delete state (separate for clarity)
  categoryToDelete: CategoryListItem | null

  // Dialog actions
  openCreateDialog: () => void
  openEditDialog: (category: CategoryListItem) => void
  closeDialog: () => void
  openDeleteDialog: (category: CategoryListItem) => void
  closeDeleteDialog: () => void

  // Mutations
  createMutation: UseMutationResult
  updateMutation: UseMutationResult
  deleteMutation: UseMutationResult

  // Import dialog
  isImportDialogOpen: boolean
  openImportDialog: () => void
  closeImportDialog: () => void

  // Helpers
  getDescendantIds: (parentId: number) => Set<number>
}
```

**Query Keys:**
```typescript
// List query (shared with mapping page for cache consistency)
queryKey: ['dinh_muc_nhom_list', { donViId }]

// Single category fetch (for edit dialog if needed)
queryKey: ['dinh_muc_nhom_get', { id: categoryId }]
```

**RPC calls:**
- Create: `callRpc({ fn: 'dinh_muc_nhom_upsert', args: { p_id: null, ...fields } })`
- Update: `callRpc({ fn: 'dinh_muc_nhom_upsert', args: { p_id: id, ...fields } })`
- Delete: `callRpc({ fn: 'dinh_muc_nhom_delete', args: { p_id: id } })`

#### 3. `src/app/(app)/device-quota/categories/_hooks/useDeviceQuotaCategoryContext.ts`
**Purpose:** Consumer hook for category context

```typescript
import { useContext } from "react"
import { DeviceQuotaCategoryContext } from "../_components/DeviceQuotaCategoryContext"

export function useDeviceQuotaCategoryContext() {
  const context = useContext(DeviceQuotaCategoryContext)
  if (!context) {
    throw new Error('useDeviceQuotaCategoryContext must be used within DeviceQuotaCategoryProvider')
  }
  return context
}
```

#### 4. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
**Purpose:** Category tree with edit/delete actions

**Features:**
- Edit/delete dropdown menu per category row (MoreHorizontal icon)
- `React.memo` on `CategoryTreeItem` for performance
- ARIA listbox pattern (flat hierarchical display):
  ```tsx
  <div role="listbox" aria-label="Danh mục thiết bị">
    {categories.map((cat) => (
      <div
        key={cat.id}
        role="option"
        aria-selected={selectedId === cat.id}
        aria-level={cat.level}
        tabIndex={isFocused ? 0 : -1}
      >
        ...
      </div>
    ))}
  </div>
  ```
- Keyboard navigation: arrow keys (up/down), Home/End, Enter/Space for selection

**Empty state (on categories page):**
- Show "Tạo danh mục" button and "Nhập từ Excel" button
- Do NOT link to self

#### 5. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryDialog.tsx`
**Purpose:** Single dialog for create/edit category (zero-props, context-controlled)

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `ma_nhom` | Input | ✅ | Unique per tenant, pattern: `XX` or `XX.XX` or `XX.XX.XXX` |
| `ten_nhom` | Input | ✅ | Non-empty |
| `parent_id` | Select | ❌ | Must exist in same tenant, filter self + descendants when editing |
| `phan_loai` | Select | ❌ | 'A', 'B', 'C', 'D', or null |
| `don_vi_tinh` | Input | ❌ | Default 'Cái' |
| `thu_tu_hien_thi` | Number | ❌ | Default 0 |
| `mo_ta` | Textarea | ❌ | Optional description |

**Parent dropdown filtering (when editing):**
```typescript
function getDescendantIds(categories: CategoryListItem[], parentId: number): Set<number> {
  const descendants = new Set<number>()
  const stack = [parentId]

  while (stack.length > 0) {
    const current = stack.pop()!
    for (const cat of categories) {
      if (cat.parent_id === current && !descendants.has(cat.id)) {
        descendants.add(cat.id)
        stack.push(cat.id)
      }
    }
  }

  return descendants
}

// Filter options: exclude current category and all its descendants
const availableParents = categories.filter(cat =>
  cat.id !== editingCategoryId && !descendantIds.has(cat.id)
)
```

**Pattern:** Copy from `DeviceQuotaDecisionDialog.tsx` (react-hook-form + zod)

#### 6. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryDeleteDialog.tsx`
**Purpose:** Delete confirmation dialog using AlertDialog

**Pattern:** Copy from `RepairRequestsDeleteDialog.tsx`

**Features:**
- Uses `AlertDialog` from Radix UI
- Reads `categoryToDelete` from context
- Shows category name and warning about dependencies
- Destructive styling (`className="bg-destructive hover:bg-destructive/90"`)
- Loading state during deletion

#### 7. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx`
**Purpose:** Toolbar above category tree with action buttons

**Features:**
- "Tạo danh mục" button → opens create dialog
- "Nhập từ Excel" button → opens import dialog
- "Tải mẫu Excel" button → downloads template (available in Phase 1)

#### 8. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`
**Purpose:** Import categories from Excel file (context-controlled, zero-props)

#### 9. `src/app/(app)/device-quota/categories/_types/categories.ts`
**Purpose:** Types shared by tree, dialogs, and context (see Type Definitions section above)

#### 10. `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx`
**Purpose:** Module sub-navigation for device-quota pages

### Files to Modify

#### 1. `src/app/(app)/device-quota/layout.tsx`
**Changes:**
- Render `DeviceQuotaSubNav`
- Role-gate Categories nav item (`global`, `to_qltb`)

#### 2. `src/app/(app)/device-quota/mapping/_components/DeviceQuotaCategoryTree.tsx`
**Changes:**
- Keep mapping page read-only (no create/edit/delete)
- Update `CategoryTreeEmpty` to link to `/device-quota/categories` (CTA: "Tạo danh mục")

#### 3. `src/app/(app)/device-quota/decisions/[id]/_components/DeviceQuotaChiTietToolbar.tsx`
**Changes:**
- Update alert link to `/device-quota/categories`
- Update copy to reflect new management page

### Database Migration Required

#### Add `ma_nhom` uniqueness constraint:
```sql
-- Migration: add_nhom_thiet_bi_unique_constraint.sql
ALTER TABLE nhom_thiet_bi
ADD CONSTRAINT uq_nhom_thiet_bi_don_vi_ma_nhom
UNIQUE (don_vi_id, ma_nhom);
```

### Access Control (Server-Side)
- Enforce role checks in RPCs (`dinh_muc_nhom_upsert`, `dinh_muc_nhom_delete`, new bulk import RPC)
- Allow only `global`, `to_qltb` (note: `admin` is normalized to `global` by API proxy)
- `regional_leader`: READ-ONLY access to `dinh_muc_nhom_list` (explicitly defined)
- Prefer SQL-level validation via JWT claims (not just UI gating)

---

## Phase 2: Bulk Import (Excel)

### Files to Create

#### 1. `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`
**Purpose:** Import categories from Excel file

**Pattern:** Context-controlled (zero-props), following established pattern

**Features:**
- File upload (xlsx)
- Parse with `readExcelFile()` + `worksheetToJson()`
- Validation order:
  1. Required fields (fail fast)
  2. Format validation (ma_nhom pattern)
  3. Duplicate detection within file
  4. Parent reference resolution
  5. Cycle detection
  6. Duplicate detection against database
- Preview valid/invalid rows
- Submit: call `dinh_muc_nhom_bulk_import` (single RPC)
- Display success/error summary

**Column mapping:**
```typescript
const HEADER_MAP = {
  'Mã nhóm': 'ma_nhom',
  'Tên nhóm thiết bị': 'ten_nhom',
  'Mã nhóm cha': 'parent_ma_nhom', // Lookup to get parent_id
  'Phân loại': 'phan_loai',
  'Đơn vị tính': 'don_vi_tinh',
  'Mô tả': 'mo_ta',
}
```

#### 2. `src/lib/category-excel.ts`
**Purpose:** Generate category import template

**Template structure (3 sheets):**
1. **"Nhập Danh Mục"** - Data entry with validation
2. **"Danh Mục Mẫu TT 08/2019"** - Reference data from canonical dataset
3. **"Hướng Dẫn"** - Instructions in Vietnamese

**Note:** Template generation moved to Phase 1 so users can see expected format before importing.

### Bulk Import RPC (Required, Transactional)

**Migration file:** Add to Phase 1 implementation

```sql
CREATE FUNCTION dinh_muc_nhom_bulk_import(
  p_items JSONB,  -- Array of category objects
  p_don_vi BIGINT,
  p_mode TEXT DEFAULT 'strict'  -- 'strict' only (no upsert)
) RETURNS TABLE (
  success_count INT,
  errors JSONB  -- [{row: 1, code: 'DUPLICATE_CODE', field: 'ma_nhom', detail: '...'}]
)
```

**Rules:**
- All-or-nothing (transactional) — if any row fails validation, abort and insert nothing
- Error on duplicate `ma_nhom` (no upsert behavior in bulk import)
- Error on missing parent reference
- **Cycle detection** using recursive CTE:
  ```sql
  -- Detect cycles using recursive CTE
  WITH RECURSIVE parent_chain AS (
    SELECT id, parent_id, ARRAY[id] as path
    FROM temp_import
    UNION ALL
    SELECT c.id, p.parent_id, path || p.id
    FROM parent_chain c
    JOIN temp_import p ON c.parent_id = p.id
    WHERE NOT p.id = ANY(path)
  )
  SELECT * FROM parent_chain WHERE parent_id = ANY(path);
  ```
- Sort inserts topologically (parents before children)
- Enforce role checks (`global`, `to_qltb`) inside the function
- **Advisory lock** to prevent concurrent imports:
  ```sql
  PERFORM pg_advisory_xact_lock(hashtext('nhom_thiet_bi_import_' || p_don_vi::text));
  ```
- Return structured error objects with `row_number` and `error_code` for UI translation

**Whitelist:** Add `dinh_muc_nhom_bulk_import` to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`

---

## Canonical Dataset (TT 08/2019)

**Decision:** Store a versioned, canonical dataset file in the repo and use it for:
- Excel template generation
- Initial bulk import (seed)
- Documentation reference

**File:** `src/data/tt08-2019-categories.json`

**Shape:**
```json
{
  "metadata": {
    "source": "Thông tư 08/2019/TT-BYT",
    "version": "1.0.0",
    "effective_date": "2019-05-01",
    "last_updated": "2026-02-05"
  },
  "categories": [
    {
      "ma_nhom": "01",
      "ten_nhom": "Thiết bị chẩn đoán hình ảnh",
      "phan_loai": null,
      "don_vi_tinh": null,
      "parent_ma_nhom": null
    }
  ]
}
```

**Updates:**
- Update `scripts/generate-sample-nhom-thiet-bi.ts` to read this file (single source of truth)
- Add a small loader helper (e.g., `src/lib/category-data.ts`) to read the JSON for UI template generation

---

## Shared Utilities

### Error Translation (extract to shared)

**File:** `src/lib/error-translations.ts`

```typescript
export function translateRpcError(error: string): string {
  const errorMappings: Record<string, string> = {
    'duplicate key value violates unique constraint': 'Mã nhóm đã tồn tại',
    'violates foreign key constraint': 'Không thể xóa vì có dữ liệu liên quan',
    'Cannot delete: equipment items are linked': 'Không thể xóa: có thiết bị đang thuộc danh mục này',
    'Cannot delete: category has child categories': 'Không thể xóa: danh mục có danh mục con',
    'CYCLE_DETECTED': 'Phát hiện vòng lặp trong phân cấp danh mục',
    'DUPLICATE_CODE': 'Mã nhóm bị trùng lặp',
    'MISSING_PARENT': 'Không tìm thấy danh mục cha',
    // ... more mappings
  }

  for (const [key, value] of Object.entries(errorMappings)) {
    if (error.includes(key)) return value
  }
  return error
}
```

---

## File Dependencies

```
DeviceQuotaCategoryContext.tsx (new)
    ├── provides: categories data, dialog state, mutations
    └── used by:
        ├── DeviceQuotaCategoryTree.tsx (new)
        ├── DeviceQuotaCategoryDialog.tsx (new)
        ├── DeviceQuotaCategoryDeleteDialog.tsx (new) ← ADDED
        ├── DeviceQuotaCategoryToolbar.tsx (new)
        └── DeviceQuotaCategoryImportDialog.tsx (new)

DeviceQuotaMappingContext.tsx (unchanged)
    └── provides: equipment mapping, selected category for assignment
```

---

## Implementation Order

### Phase 1 (CRUD UI)
1. Add `ma_nhom` uniqueness constraint migration
2. Create canonical dataset file `src/data/tt08-2019-categories.json` with metadata
3. Create types file `_types/categories.ts`
4. Add bulk import RPC migration (transactional, role-guarded, cycle detection)
5. Add `dinh_muc_nhom_bulk_import` to `ALLOWED_FUNCTIONS` whitelist
6. Create `DeviceQuotaSubNav.tsx` and render it in `src/app/(app)/device-quota/layout.tsx`
7. Create `/device-quota/categories` page with role gating
8. Create `DeviceQuotaCategoryContext.tsx` (data + mutations + dialog state + delete state)
9. Create `useDeviceQuotaCategoryContext.ts`
10. Create `DeviceQuotaCategoryDialog.tsx` (zod form with parent filtering)
11. Create `DeviceQuotaCategoryDeleteDialog.tsx` (AlertDialog pattern)
12. Create `DeviceQuotaCategoryToolbar.tsx`
13. Create `DeviceQuotaCategoryTree.tsx` (edit/delete + ARIA listbox + React.memo)
14. Add template generation to `src/lib/category-excel.ts` (moved from Phase 2)
15. Wire provider + components in `/device-quota/categories`
16. Update mapping empty state to link to `/device-quota/categories`
17. Update alert message link in `DeviceQuotaChiTietToolbar.tsx`
18. Create shared `src/lib/error-translations.ts`
19. Test: Create, edit, delete categories manually

### Phase 2 (Bulk Import)
1. Create `DeviceQuotaCategoryImportDialog.tsx` (context-controlled)
2. Connect toolbar buttons
3. Test: Import TT 08/2019 categories from Excel (transactional)
4. Test: Concurrent import handling (advisory locks)
5. Test: Cycle detection in import

---

## Existing Code to Reuse

| Need | Reuse From | Path |
|------|------------|------|
| Form dialog pattern | `DeviceQuotaDecisionDialog` | `decisions/_components/DeviceQuotaDecisionDialog.tsx` |
| Delete dialog pattern | `RepairRequestsDeleteDialog` | `repair-requests/_components/RepairRequestsDeleteDialog.tsx` |
| Excel import pattern | `DeviceQuotaImportDialog` | `decisions/_components/DeviceQuotaImportDialog.tsx` |
| Excel utilities | `readExcelFile`, `worksheetToJson` | `src/lib/excel-utils.ts` |
| Template generation | `generateDeviceQuotaImportTemplate` | `src/lib/device-quota-excel.ts` |
| Context pattern | `DeviceQuotaMappingContext` | `mapping/_components/DeviceQuotaMappingContext.tsx` |
| Sample category data | Script | `scripts/generate-sample-nhom-thiet-bi.ts` |

---

## Verification

### Phase 1 Tests
1. Navigate to `/device-quota/categories`
2. Verify access denied for non-admin/to_qltb users
3. Click "Tạo danh mục" → Fill form → Submit → Category appears in tree
4. Click edit on category → Modify → Save → Changes reflected
5. Click delete → Confirm → Category removed (if no dependencies)
6. Try delete with dependencies → Should show error message
7. Verify mapping page empty state links to `/device-quota/categories`
8. Run: `node scripts/npm-run.js run typecheck`

### Phase 2 Tests
1. Click "Tải mẫu Excel" → Download template
2. Fill template with sample categories
3. Click "Nhập từ Excel" → Upload file → Preview → Import
4. Verify categories appear in tree with correct hierarchy
5. Try importing duplicate `ma_nhom` → Should error and **not insert any rows**
6. Try importing with cycle (A -> B -> A) → Should error with cycle message
7. Test concurrent import from two browsers → Should handle via advisory lock

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Management page route | `/device-quota/categories` (new page) |
| Import semantics | Transactional, all-or-nothing |
| Duplicate handling | Error (no upsert) |
| Canonical dataset | Versioned JSON in `src/data/tt08-2019-categories.json` with metadata |
| Access control | `global` / `to_qltb` only (`admin` normalized to `global`) |
| `regional_leader` access | READ-ONLY for listing, no write access |
| Navigation pattern | Module sub-nav inside `/device-quota` layout |
| Parent dropdown | Show all categories (filter self + descendants when editing) |
| Delete behavior | Require manual cleanup (no cascade), check dependencies |
| Keywords (`tu_khoa`) | Defer to future AI matching feature |
| ARIA pattern | Listbox for flat hierarchical display (not collapsible tree) |
| Import dialog pattern | Context-controlled (zero-props) |
| Template generation | Phase 1 (not Phase 2) |

---

## Review Feedback (Incorporated)

### Architecture Review Recommendations

| Issue | Severity | Resolution |
|-------|----------|------------|
| Bulk import RPC not in whitelist | CRITICAL | Add to `ALLOWED_FUNCTIONS` ✅ |
| Cycle detection missing | HIGH | Implement recursive CTE cycle detection ✅ |
| `ma_nhom` uniqueness constraint | HIGH | Add database unique constraint migration ✅ |
| Delete dependency checks | MEDIUM | Verify existing RPC checks equipment and child categories |
| `regional_leader` access undefined | MEDIUM | Explicitly defined as read-only ✅ |
| Concurrent import race condition | MEDIUM | Add advisory locks ✅ |
| Audit trail for compliance | MEDIUM | Defer (existing created_by/updated_by sufficient for now) |
| `admin` role normalization | LOW | Standardized on `global` only in documentation ✅ |
| JSON dataset schema validation | LOW | Add metadata structure ✅ |
| Large import progress feedback | LOW | Defer to future enhancement |

### Code Review Recommendations

| Issue | Severity | Resolution |
|-------|----------|------------|
| Missing delete dialog component | CRITICAL | Added `DeviceQuotaCategoryDeleteDialog.tsx` ✅ |
| Incomplete type definitions | CRITICAL | Added complete type definitions section ✅ |
| Context dialog state incomplete | HIGH | Added `categoryToDelete` and `openDeleteDialog` ✅ |
| ARIA tree pattern under-specified | HIGH | Clarified as listbox pattern ✅ |
| Import dialog props pattern mismatch | HIGH | Standardized on context-controlled ✅ |
| Parent dropdown filtering unspecified | MEDIUM | Added `getDescendantIds` helper ✅ |
| Query keys not documented | MEDIUM | Added query key patterns ✅ |
| Template generation in Phase 2 | MEDIUM | Moved to Phase 1 ✅ |
| React.memo pattern not prominent | LOW | Added explicit code pattern ✅ |
| Error translation not reused | LOW | Added shared utility file ✅ |
| Empty state behavior per page | LOW | Clarified different behavior per page ✅ |

---

## Alert Message Fix

Update the alert in `DeviceQuotaChiTietToolbar.tsx` to:
- Link to `/device-quota/categories`
- Update message to reflect new capability: "Chưa có danh mục thiết bị. Vui lòng tạo danh mục trước khi nhập định mức."
