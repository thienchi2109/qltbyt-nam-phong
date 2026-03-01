# Equipment Page Refactoring Plan

**Goal**: Reduce `src/app/(app)/equipment/page.tsx` from 1,197 lines to ~450-500 lines
**Approach**: Option B - Extract by Responsibility (3 new co-located files)
**Constraints**: No breaking changes, TypeScript strict, Performance critical

---

## Overview

### Current State
- `page.tsx`: 1,197 lines (exceeds 350-450 guideline by 3x)
- Contains: 20+ useState, 8 useQuery, 12+ handlers, 10+ effects, table config, rendering logic

### Target State
```
src/app/(app)/equipment/
├── page.tsx                  (~450-500 lines) - Orchestration + main JSX
├── use-equipment-page.ts     (~400 lines) - Custom hook with all logic
├── equipment-content.tsx     (~200 lines) - Table/card rendering
└── equipment-dialogs.tsx     (~100 lines) - All dialogs grouped
```

---

## Implementation Tasks

### Phase 1: Create Custom Hook

#### Task 1.1: Create `use-equipment-page.ts` skeleton
- [ ] Create file with TypeScript interfaces
- [ ] Define `UseEquipmentPageReturn` interface
- [ ] Export empty hook function

#### Task 1.2: Extract state declarations
- [ ] Move all useState hooks (sorting, filters, dialogs, pagination)
- [ ] Move column visibility state and auto-hide effect
- [ ] Preserve exact initial values

#### Task 1.3: Extract data queries
- [ ] Move equipment list query (equipment_list_enhanced)
- [ ] Move tenant list query
- [ ] Move facilities query
- [ ] Move filter option queries (departments, users, locations, statuses, classifications)
- [ ] Move active usage logs query
- [ ] Preserve query keys and cache settings

#### Task 1.4: Extract computed values
- [ ] Move all useMemo hooks (selectedDonVi, sortParam, filter arrays, etc.)
- [ ] Move tenant/facility computations
- [ ] Move pageCount calculation

#### Task 1.5: Extract handlers
- [ ] Move handleDownloadTemplate
- [ ] Move handleGenerateProfileSheet
- [ ] Move handleGenerateDeviceLabel
- [ ] Move handleShowDetails, handleStartUsage, handleEndUsage
- [ ] Move handleFacilityApply, handleFacilityClear, handleFacilityCancel
- [ ] Move handleExportData
- [ ] Move onDataMutationSuccess callbacks
- [ ] Move renderActions function

#### Task 1.6: Extract effects
- [ ] Move cache invalidation listeners (equipment-cache-invalidated, tenant-switched)
- [ ] Move tenant filter change effects
- [ ] Move localStorage persistence effects
- [ ] Move URL parameter handling effect
- [ ] Move pagination reset effect
- [ ] Move table state restoration effect

#### Task 1.7: Extract table configuration
- [ ] Move useReactTable setup
- [ ] Move columns definition call
- [ ] Preserve manual pagination/filtering settings

---

### Phase 2: Create Content Component

#### Task 2.1: Create `equipment-content.tsx`
- [ ] Create file with EquipmentContentProps interface
- [ ] Extract loading skeleton (card + table variants)
- [ ] Extract empty state rendering
- [ ] Extract table view (headers, rows, hover states)
- [ ] Extract card view with MobileEquipmentListItem
- [ ] Extract fetching overlay

---

### Phase 3: Create Dialogs Component

#### Task 3.1: Create `equipment-dialogs.tsx`
- [ ] Create file with EquipmentDialogsProps interface
- [ ] Group AddEquipmentDialog
- [ ] Group ImportEquipmentDialog
- [ ] Group EditEquipmentDialog
- [ ] Group EquipmentDetailDialog
- [ ] Group StartUsageDialog
- [ ] Group EndUsageDialog
- [ ] Pass through all required props

---

### Phase 4: Refactor Main Page

#### Task 4.1: Update `page.tsx`
- [ ] Replace inline logic with useEquipmentPage() hook
- [ ] Replace renderContent() with EquipmentContent component
- [ ] Replace inline dialogs with EquipmentDialogs component
- [ ] Keep router/redirect logic in component
- [ ] Keep main Card structure
- [ ] Preserve floating button and bottom sheets

#### Task 4.2: Clean up imports
- [ ] Remove unused imports from page.tsx
- [ ] Add imports for new components/hooks
- [ ] Verify import order follows conventions

---

### Phase 5: Verification

#### Task 5.1: Type checking
- [ ] Run `npm run typecheck`
- [ ] Fix any TypeScript errors
- [ ] Ensure no `any` types introduced

#### Task 5.2: Functional testing
- [ ] Verify equipment list loads correctly
- [ ] Test pagination (next, prev, jump)
- [ ] Test all filters (department, status, user, location, classification)
- [ ] Test search functionality
- [ ] Test add/edit/import dialogs
- [ ] Test detail modal
- [ ] Test usage tracking dialogs
- [ ] Test export to Excel
- [ ] Test facility filter (global/regional users)

#### Task 5.3: Performance check
- [ ] Verify no unnecessary re-renders
- [ ] Check React DevTools Profiler
- [ ] Confirm cache behavior unchanged

---

## File Specifications

### use-equipment-page.ts

```typescript
// Interface for hook return value
export interface UseEquipmentPageReturn {
  // Session/Auth
  user: User | null
  status: "loading" | "authenticated" | "unauthenticated"
  isGlobal: boolean
  isRegionalLeader: boolean

  // Data
  data: Equipment[]
  total: number
  isLoading: boolean
  isFetching: boolean
  shouldFetchEquipment: boolean

  // Table
  table: Table<Equipment>
  columns: ColumnDef<Equipment>[]
  pagination: { pageIndex: number; pageSize: number }
  setPagination: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number

  // Filters
  searchTerm: string
  setSearchTerm: Dispatch<SetStateAction<string>>
  columnFilters: ColumnFiltersState
  setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>
  isFiltered: boolean

  // Filter options (from server)
  departments: string[]
  users: string[]
  locations: string[]
  statuses: string[]
  classifications: string[]
  filterData: FilterBottomSheetData  // For bottom sheet

  // Facility filter
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null
  setSelectedFacilityId: Dispatch<SetStateAction<number | null>>
  activeFacility: FacilityOption | null
  hasFacilityFilter: boolean
  isFacilitiesLoading: boolean

  // Facility sheet
  isFacilitySheetOpen: boolean
  setIsFacilitySheetOpen: Dispatch<SetStateAction<boolean>>
  pendingFacilityId: number | null
  setPendingFacilityId: Dispatch<SetStateAction<number | null>>
  handleFacilityApply: () => void
  handleFacilityClear: () => void
  handleFacilityCancel: () => void

  // Dialogs
  isAddDialogOpen: boolean
  setIsAddDialogOpen: Dispatch<SetStateAction<boolean>>
  isImportDialogOpen: boolean
  setIsImportDialogOpen: Dispatch<SetStateAction<boolean>>
  editingEquipment: Equipment | null
  setEditingEquipment: Dispatch<SetStateAction<Equipment | null>>
  selectedEquipment: Equipment | null
  isDetailModalOpen: boolean
  setIsDetailModalOpen: Dispatch<SetStateAction<boolean>>
  isStartUsageDialogOpen: boolean
  startUsageEquipment: Equipment | null
  isEndUsageDialogOpen: boolean
  endUsageLog: UsageLog | null

  // Filter sheet
  isFilterSheetOpen: boolean
  setIsFilterSheetOpen: Dispatch<SetStateAction<boolean>>

  // Columns dialog
  isColumnsDialogOpen: boolean
  setIsColumnsDialogOpen: Dispatch<SetStateAction<boolean>>

  // Handlers
  handleShowDetails: (equipment: Equipment) => void
  handleStartUsage: (equipment: Equipment) => void
  handleEndUsage: (usage: UsageLog) => void
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  handleGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
  onDataMutationSuccess: () => void

  // Usage tracking
  activeUsageLogs: UsageLog[] | undefined
  isLoadingActiveUsage: boolean

  // UI state
  isMobile: boolean
  isCardView: boolean
  useTabletFilters: boolean

  // Branding
  tenantBranding: TenantBranding | undefined
}

export function useEquipmentPage(): UseEquipmentPageReturn
```

### equipment-content.tsx

```typescript
export interface EquipmentContentProps {
  isGlobal: boolean
  shouldFetchEquipment: boolean
  isLoading: boolean
  isFetching: boolean
  isCardView: boolean
  table: Table<Equipment>
  columns: ColumnDef<Equipment>[]
  onShowDetails: (equipment: Equipment) => void
  onEdit: (equipment: Equipment | null) => void
}

export function EquipmentContent(props: EquipmentContentProps): JSX.Element
```

### equipment-dialogs.tsx

```typescript
export interface EquipmentDialogsProps {
  // Add dialog
  isAddDialogOpen: boolean
  setIsAddDialogOpen: Dispatch<SetStateAction<boolean>>

  // Import dialog
  isImportDialogOpen: boolean
  setIsImportDialogOpen: Dispatch<SetStateAction<boolean>>

  // Edit dialog
  editingEquipment: Equipment | null
  setEditingEquipment: Dispatch<SetStateAction<Equipment | null>>

  // Detail dialog
  selectedEquipment: Equipment | null
  isDetailModalOpen: boolean
  setIsDetailModalOpen: Dispatch<SetStateAction<boolean>>

  // Usage dialogs
  isStartUsageDialogOpen: boolean
  setIsStartUsageDialogOpen: Dispatch<SetStateAction<boolean>>
  startUsageEquipment: Equipment | null
  setStartUsageEquipment: Dispatch<SetStateAction<Equipment | null>>
  isEndUsageDialogOpen: boolean
  setIsEndUsageDialogOpen: Dispatch<SetStateAction<boolean>>
  endUsageLog: UsageLog | null
  setEndUsageLog: Dispatch<SetStateAction<UsageLog | null>>

  // Callbacks
  onSuccess: () => void
  onGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  onGenerateDeviceLabel: (equipment: Equipment) => Promise<void>

  // Context
  user: User | null
  isRegionalLeader: boolean
  tenantBranding: TenantBranding | undefined
}

export function EquipmentDialogs(props: EquipmentDialogsProps): JSX.Element
```

---

## Success Criteria

1. ✅ `page.tsx` under 500 lines
2. ✅ `npm run typecheck` passes
3. ✅ No `any` types introduced
4. ✅ All existing functionality preserved
5. ✅ No performance regression
6. ✅ Files follow project conventions (imports, naming)

---

## Rollback Plan

If issues arise:
1. Git revert the commit
2. Files are co-located, easy to delete
3. No external dependencies changed

---

**Created**: 2025-12-29
**Status**: Ready for implementation
