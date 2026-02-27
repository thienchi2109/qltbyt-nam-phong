# Equipment Page Refactor Design

**Date:** 2025-12-29
**Status:** Approved
**Approach:** Feature-Based Extraction

## Overview

Refactor `src/app/(app)/equipment/page.tsx` from 3,001 lines into smaller, maintainable components following the project's 350-450 line guideline.

### Constraints
- Preserve all existing features
- Preserve RBAC logic (multi-tenant isolation for regional leaders)
- Maintain import conventions (`@/*` alias)
- Keep components in `src/components/equipment/` folder

### Success Criteria
- Main page.tsx reduced to ~400 lines
- Each extracted component under 350 lines
- All existing functionality preserved
- No breaking changes to external interfaces

---

## Current State Analysis

### File Size: 3,001 lines

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1-133 | 50+ imports from various modules |
| Types & Constants | 135-288 | Attachment, HistoryItem, status variants, column labels, form schema |
| DataTableFacetedFilter | 289-403 | Nested filter component (~115 lines) |
| Main Component | 406-3001 | EquipmentPage with all logic |

### Already Extracted Components
- `AddEquipmentDialog` - adding new equipment
- `EditEquipmentDialog` - editing equipment
- `ImportEquipmentDialog` - Excel import
- `MobileEquipmentListItem` - card view item
- `FilterBottomSheet` - mobile filter UI
- `UsageHistoryTab` - usage logs tab
- `StartUsageDialog` / `EndUsageDialog` - usage tracking

### Remaining in Monolith
1. Equipment Detail Dialog (~500+ lines)
2. Profile Sheet Generator (~160 lines)
3. Device Label Generator (~140 lines)
4. Table Columns Definition (~70 lines)
5. Row Actions Menu (~50 lines)
6. Toolbar with Filters (~200 lines)
7. Pagination Controls (~100 lines)
8. Facility Filter Sheet (~110 lines)
9. Data Fetching Logic (~150 lines)

---

## Target Architecture

### File Structure

```
src/components/equipment/
├── filter-bottom-sheet.tsx        (existing - ~200 lines)
├── tenant-selector.tsx            (existing - ~80 lines)
├── equipment-detail-dialog.tsx    (NEW - ~350 lines)
├── equipment-table-columns.tsx    (NEW - ~150 lines)
├── equipment-toolbar.tsx          (NEW - ~250 lines)
├── equipment-print-utils.ts       (NEW - ~180 lines)
├── equipment-pagination.tsx       (NEW - ~120 lines)
├── facility-filter-sheet.tsx      (NEW - ~130 lines)
└── equipment-actions-menu.tsx     (NEW - ~80 lines)

src/app/(app)/equipment/
└── page.tsx                       (REFACTORED - ~400 lines)
```

**Total: 9 files (7 new + 2 existing) instead of 1 monolithic file**

---

## Component Specifications

### 1. equipment-detail-dialog.tsx (~350 lines)

**Source:** Lines 2100-2500 (detail modal with tabs)

**Purpose:** Full-screen dialog for viewing and editing equipment details with tabbed interface.

**Props Interface:**
```typescript
interface EquipmentDetailDialogProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserSession | null
  isRegionalLeader: boolean
  onGenerateProfileSheet: (equipment: Equipment) => void
  onGenerateDeviceLabel: (equipment: Equipment) => void
  onEquipmentUpdated: () => void
}
```

**Contains:**
- Tabs: Details, Attachments, History, Usage
- Inline edit form with react-hook-form + zod validation
- RBAC checks for edit button visibility
- Attachment management (add/delete via RPC)
- History timeline rendering with icons
- UsageHistoryTab integration

**Internal State:**
- `currentTab: string`
- `isEditingDetails: boolean`
- `attachments: Attachment[]`
- `history: HistoryItem[]`
- `editForm: UseFormReturn<EquipmentFormValues>`

**Data Fetching:**
- `useQuery` for attachments (equipment_attachments_list)
- `useQuery` for history (equipment_history_get)
- `useMutation` for equipment_update

---

### 2. equipment-table-columns.tsx (~150 lines)

**Source:** Lines 1149-1216, 167-223

**Purpose:** Column definitions and cell renderers for the equipment table.

**Exports:**
```typescript
// Constants
export const columnLabels: Record<string, string>
export const equipmentStatusOptions: readonly string[]
export const filterableColumns: (keyof Equipment)[]

// Badge variant helpers
export function getStatusVariant(
  status: Equipment["tinh_trang_hien_tai"]
): "default" | "secondary" | "destructive" | "outline"

export function getClassificationVariant(
  classification: Equipment["phan_loai_theo_nd98"]
): "default" | "secondary" | "destructive" | "outline"

// Column factory
export function createEquipmentColumns(config: {
  onShowDetails: (equipment: Equipment) => void
  renderActions: (equipment: Equipment) => React.ReactNode
}): ColumnDef<Equipment>[]
```

**Notes:**
- Column factory returns ColumnDef array
- Actions column uses renderActions callback for flexibility
- Cell renderers handle null/empty values with "Chưa có dữ liệu"

---

### 3. equipment-toolbar.tsx (~250 lines)

**Source:** Lines 2536-2692

**Purpose:** Unified toolbar with search, filters, and action buttons.

**Props Interface:**
```typescript
interface EquipmentToolbarProps {
  // Search
  searchTerm: string
  onSearchChange: (value: string) => void

  // Table reference for filters
  table: Table<Equipment>
  columnFilters: ColumnFiltersState
  isFiltered: boolean

  // Filter options from server
  filterOptions: {
    statuses: string[]
    departments: string[]
    users: string[]
    classifications: string[]
  }

  // Mobile filter sheet trigger
  onOpenFilterSheet: () => void

  // Actions
  onAddEquipment: () => void
  onImportEquipment: () => void
  onDownloadTemplate: () => void
  onExportData: () => void
  onOpenColumnsDialog: () => void

  // Display context
  isMobile: boolean
  useTabletFilters: boolean
  isRegionalLeader: boolean

  // Facility filter (optional, for regional leaders/global)
  hasFacilityFilter?: boolean
  onClearFacilityFilter?: () => void
}
```

**Contains:**
- Search input with debounce
- DataTableFacetedFilter components (inline, not extracted)
- Mobile/tablet filter button
- Options dropdown menu
- Add equipment dropdown (manual/Excel import)
- Clear filters button

---

### 4. equipment-print-utils.ts (~180 lines)

**Source:** Lines 720-1063

**Purpose:** Utility functions for generating printable HTML documents.

**Exports:**
```typescript
export interface PrintContext {
  tenantBranding: TenantBranding | null
  user: UserSession | null
  fetchTenantBranding: (tenantId: number) => Promise<TenantBranding | null>
}

export async function generateProfileSheet(
  equipment: Equipment,
  context: PrintContext
): Promise<void>

export async function generateDeviceLabel(
  equipment: Equipment,
  context: PrintContext
): Promise<void>
```

**Implementation Notes:**
- Pure functions (no React components)
- Open new browser window with generated HTML
- Handle tenant branding fetching for global/admin users
- Use equipment's don_vi for branding when user is global
- HTML templates use Tailwind CDN for styling

---

### 5. equipment-pagination.tsx (~120 lines)

**Source:** Lines 2731-2826

**Purpose:** Pagination controls with page size selector and navigation.

**Props Interface:**
```typescript
interface EquipmentPaginationProps {
  // Table reference
  table: Table<Equipment>

  // Pagination state
  pagination: { pageIndex: number; pageSize: number }
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void
  pageCount: number

  // Display info
  currentCount: number
  totalCount: number

  // Actions
  onExportData: () => void
  isLoading: boolean
  shouldFetchEquipment: boolean
}
```

**Contains:**
- ResponsivePaginationInfo component usage
- Page size selector (10, 20, 50, 100)
- First/Previous/Next/Last navigation buttons
- Export to Excel link
- Mobile-optimized layout

---

### 6. facility-filter-sheet.tsx (~130 lines)

**Source:** Lines 2889-2997

**Purpose:** Bottom sheet for regional leaders to filter by facility.

**Props Interface:**
```typescript
interface FacilityFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // Facilities data
  facilities: Array<{
    id: number
    name: string
    count: number
  }>
  isLoading: boolean

  // Selection
  selectedFacilityId: number | null
  onApply: (facilityId: number | null) => void
  onClear: () => void

  // Total count for "All facilities" option
  totalEquipmentCount: number
}
```

**Contains:**
- Search input for facility name
- "All facilities" option
- Facility list with equipment counts
- Apply/Clear/Cancel buttons
- Loading skeleton state

---

### 7. equipment-actions-menu.tsx (~80 lines)

**Source:** Lines 1080-1147

**Purpose:** Dropdown menu for per-row equipment actions.

**Props Interface:**
```typescript
interface EquipmentActionsMenuProps {
  equipment: Equipment
  user: UserSession | null
  isRegionalLeader: boolean

  // Usage state
  activeUsageLog: UsageLog | undefined
  isLoadingActiveUsage: boolean

  // Action handlers
  onShowDetails: () => void
  onStartUsage: () => void
  onEndUsage: () => void
  onCreateRepairRequest: () => void
}
```

**Contains:**
- DropdownMenu with actions:
  - View details
  - Start/End usage (conditional)
  - Create repair request
- RBAC-based action visibility
- Disabled states based on usage status

---

## Data Flow Diagram

```
page.tsx (orchestrator, ~400 lines)
│
├── State Management
│   ├── pagination: { pageIndex, pageSize }
│   ├── searchTerm, debouncedSearch
│   ├── columnFilters
│   ├── sorting
│   ├── selectedEquipment
│   ├── dialog open states
│   └── tenantFilter / selectedFacilityId
│
├── Data Fetching (useQuery hooks)
│   ├── equipment_list_enhanced
│   ├── departments_list_for_tenant
│   ├── equipment_users_list_for_tenant
│   ├── equipment_locations_list_for_tenant
│   ├── equipment_statuses_list_for_tenant
│   ├── equipment_classifications_list_for_tenant
│   ├── get_facilities_with_equipment_count
│   └── tenant_list (global users)
│
├── UI Composition
│   │
│   ├── <Card>
│   │   ├── <CardHeader>
│   │   │   ├── Title + Description
│   │   │   └── Facility filter button (regional leader/global)
│   │   │
│   │   ├── <CardContent>
│   │   │   ├── <EquipmentToolbar />
│   │   │   │   ├── Search input
│   │   │   │   ├── DataTableFacetedFilter (x4)
│   │   │   │   └── Action buttons
│   │   │   │
│   │   │   └── Table or CardView
│   │   │       └── columns from createEquipmentColumns()
│   │   │           └── <EquipmentActionsMenu /> (per row)
│   │   │
│   │   └── <CardFooter>
│   │       └── <EquipmentPagination />
│   │
│   ├── <EquipmentDetailDialog />
│   │   └── Uses equipment-print-utils for print actions
│   │
│   ├── <FacilityFilterSheet /> (regional leader)
│   │
│   └── Existing Dialogs
│       ├── <AddEquipmentDialog />
│       ├── <EditEquipmentDialog />
│       ├── <ImportEquipmentDialog />
│       ├── <StartUsageDialog />
│       ├── <EndUsageDialog />
│       └── <FilterBottomSheet />
│
└── Floating Add Button (mobile)
```

---

## RBAC Considerations

### User Roles
- `global` / `admin`: Access all tenants, can select tenant filter
- `regional_leader`: Access facilities in their region, uses facility filter
- `to_qltb`: Equipment team, tenant-scoped
- `technician`: Department-restricted
- `user`: Basic access, tenant-scoped

### RBAC in Components

| Component | RBAC Logic |
|-----------|------------|
| `equipment-detail-dialog` | Edit button visible for global/admin/to_qltb/qltb_khoa |
| `equipment-actions-menu` | Start usage disabled for regional_leader |
| `equipment-toolbar` | Add button hidden for regional_leader |
| `facility-filter-sheet` | Only shown for regional_leader or global |
| `equipment-print-utils` | Fetches equipment's tenant branding for global users |

### Prop Drilling
- `user` and `isRegionalLeader` passed to components that need RBAC checks
- Alternative: Create an `EquipmentPageContext` if prop drilling becomes unwieldy

---

## Migration Strategy

### Phase 1: Extract Utilities (Low Risk)
1. `equipment-print-utils.ts` - Pure functions, no React
2. `equipment-table-columns.tsx` - Constants and column factory

### Phase 2: Extract Leaf Components (Medium Risk)
3. `equipment-actions-menu.tsx` - Per-row dropdown
4. `equipment-pagination.tsx` - CardFooter content
5. `facility-filter-sheet.tsx` - Bottom sheet

### Phase 3: Extract Major Components (Higher Risk)
6. `equipment-toolbar.tsx` - Contains DataTableFacetedFilter
7. `equipment-detail-dialog.tsx` - Largest extraction, has internal state

### Phase 4: Cleanup
8. Remove dead code from page.tsx
9. Consolidate imports
10. Final verification

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Equipment list loads correctly for all user roles
- [ ] Search filters work with debounce
- [ ] Faceted filters work (status, department, user, classification)
- [ ] Mobile filter bottom sheet works
- [ ] Pagination works (page size, navigation)
- [ ] Detail dialog opens and shows all tabs
- [ ] Inline edit in detail dialog works
- [ ] Attachments can be added/deleted
- [ ] History timeline renders correctly
- [ ] Usage tab shows usage logs
- [ ] Print profile sheet works
- [ ] Generate device label works
- [ ] Add equipment (manual + Excel import)
- [ ] Edit equipment dialog works
- [ ] Start/End usage works
- [ ] Create repair request navigates correctly
- [ ] Regional leader facility filter works
- [ ] Global user tenant filter works
- [ ] Column visibility dialog works
- [ ] Export to Excel works
- [ ] Download template works
- [ ] Mobile floating add button works

### TypeScript Verification
- Run `npm run typecheck` after each component extraction
- Ensure no `any` types introduced

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking RBAC logic | Medium | High | Test all user roles after each extraction |
| State synchronization issues | Medium | Medium | Keep state in page.tsx, pass callbacks |
| Performance regression | Low | Medium | Profile before/after, check re-renders |
| Import path errors | Low | Low | Use `@/` alias consistently |

---

## Estimated Effort

| Component | Effort | Notes |
|-----------|--------|-------|
| equipment-print-utils.ts | 15 min | Pure extraction |
| equipment-table-columns.tsx | 20 min | Factory pattern |
| equipment-actions-menu.tsx | 15 min | Small component |
| equipment-pagination.tsx | 20 min | Straightforward |
| facility-filter-sheet.tsx | 25 min | Has search logic |
| equipment-toolbar.tsx | 40 min | Contains filters |
| equipment-detail-dialog.tsx | 60 min | Largest, has state |
| page.tsx cleanup | 30 min | Remove dead code |
| Testing | 45 min | All user roles |

**Total: ~4-5 hours**

---

## Appendix: Types

### Shared Types (already in codebase)
```typescript
// From @/types/database
type Equipment = { ... }
type UsageLog = { ... }

// From next-auth
type UserSession = {
  id: string
  username: string
  role: 'global' | 'admin' | 'regional_leader' | 'to_qltb' | 'technician' | 'user'
  khoa_phong: string | null
  don_vi: number
  dia_ban_id: number | null
  full_name: string
}
```

### New Types (to add if needed)
```typescript
// In equipment-detail-dialog.tsx
type Attachment = {
  id: string
  ten_file: string
  duong_dan_luu_tru: string
  thiet_bi_id: number
}

type HistoryItem = {
  id: number
  ngay_thuc_hien: string
  loai_su_kien: string
  mo_ta: string
  chi_tiet: {
    mo_ta_su_co?: string
    hang_muc_sua_chua?: string
    nguoi_yeu_cau?: string
    cong_viec_id?: number
    thang?: number
    ten_ke_hoach?: string
    khoa_phong?: string
    nam?: number
    ma_yeu_cau?: string
    loai_hinh?: string
    khoa_phong_hien_tai?: string
    khoa_phong_nhan?: string
    don_vi_nhan?: string
  } | null
}
```
