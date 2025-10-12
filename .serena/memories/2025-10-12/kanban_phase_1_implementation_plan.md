# Kanban Scalability - Phase 1 Implementation Plan

**Created:** October 12, 2025  
**Status:** Ready to implement  
**Prerequisites:** Phase 0 complete (commit 73e4a7e)  
**Estimated Time:** 4-5 hours

## Phase 1 Goals

1. **Overview Header Component** - Show totals, WIP alerts, active filters summary
2. **Filter Bar Component** - Multi-criteria filtering (assignee, facility, type, status, date, text)
3. **Saved Views Component** - Create, edit, delete, set default views
4. **LocalStorage Persistence** - All filter states and saved views persist across sessions

## Implementation Checklist

### 1. Overview Header (`src/components/transfers/OverviewHeader.tsx`) [1.5 hours]

**Features:**
- Per-column item counts with badges
- WIP warnings (configurable threshold per column)
- Active filters summary chip (dismissible)
- Total items count (filtered vs unfiltered)
- Last updated timestamp
- Quick actions (Refresh, Clear all filters, Create view)

**Props Interface:**
```typescript
{
  columnCounts: Record<TransferStatus, number>
  totalCount: number
  filteredCount: number
  activeFilters: ActiveFiltersSummary
  wipLimits?: Record<TransferStatus, number>
  lastUpdated?: Date
  onRefresh: () => void
  onClearFilters: () => void
  onSaveView: () => void
  isLoading?: boolean
}
```

**Design Notes:**
- Mobile: Stack vertically, hide detailed WIP if space constrained
- Desktop: Horizontal layout with flex-wrap
- Use Radix UI Badge for counts
- Color-code WIP warnings (yellow approaching, red exceeded)

---

### 2. Filter Bar (`src/components/transfers/FilterBar.tsx`) [2 hours]

**Filter Criteria:**
1. **Assignee** - Multi-select dropdown (fetched from `nhan_vien`)
2. **Facility** - Reuse existing `useFacilityFilter` hook
3. **Type** - Multi-select: `noi_bo`, `thanh_ly`, `ben_ngoai`
4. **Status** - Multi-select: All `TransferStatus` values
5. **Date Range** - From/To date pickers (filter by `created_at` or `ngay_yeu_cau`)
6. **Text Search** - Full-text search across: `ma_yeu_cau`, equipment name, notes

**Props Interface:**
```typescript
{
  filters: TransferFilters
  onFiltersChange: (filters: TransferFilters) => void
  savedViews: SavedView[]
  activeViewId?: string
  onLoadView: (viewId: string) => void
  onSaveCurrentView: () => void
  facilityOptions: Facility[]
  assigneeOptions: NhanVien[]
  isLoading?: boolean
}
```

**State Management:**
```typescript
// src/types/transfer-filters.ts
export type TransferFilters = {
  assigneeIds?: string[]
  facilityIds?: string[]
  types?: TransferType[]
  statuses?: TransferStatus[]
  dateFrom?: string // ISO date
  dateTo?: string
  searchText?: string
  onlyMine?: boolean // Show only current user's requests
}

export type SavedView = {
  id: string
  name: string
  filters: TransferFilters
  isDefault?: boolean
  createdAt: string
}
```

**Client-Side Filtering Logic:**
```typescript
// src/lib/transfer-filters.ts
export function applyTransferFilters(
  transfers: TransferRequest[],
  filters: TransferFilters,
  currentUserId?: string
): TransferRequest[] {
  return transfers.filter(transfer => {
    // Assignee filter
    if (filters.assigneeIds?.length && 
        !filters.assigneeIds.includes(transfer.nguoi_yeu_cau_id)) {
      return false
    }
    
    // Facility filter
    if (filters.facilityIds?.length && 
        !filters.facilityIds.includes(transfer.don_vi_id)) {
      return false
    }
    
    // Type filter
    if (filters.types?.length && 
        !filters.types.includes(transfer.loai_yeu_cau)) {
      return false
    }
    
    // Status filter
    if (filters.statuses?.length && 
        !filters.statuses.includes(transfer.trang_thai)) {
      return false
    }
    
    // Date range filter
    if (filters.dateFrom) {
      const transferDate = new Date(transfer.created_at)
      if (transferDate < new Date(filters.dateFrom)) {
        return false
      }
    }
    if (filters.dateTo) {
      const transferDate = new Date(transfer.created_at)
      if (transferDate > new Date(filters.dateTo)) {
        return false
      }
    }
    
    // Text search (case-insensitive)
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      const searchableFields = [
        transfer.ma_yeu_cau,
        transfer.thiet_bi?.ten_thiet_bi,
        transfer.ly_do,
        transfer.ghi_chu
      ].filter(Boolean).join(' ').toLowerCase()
      
      if (!searchableFields.includes(searchLower)) {
        return false
      }
    }
    
    // Only mine filter
    if (filters.onlyMine && transfer.nguoi_yeu_cau_id !== currentUserId) {
      return false
    }
    
    return true
  })
}

// Debounced search hook
export function useDebouncedSearch(
  value: string,
  delay: number = 300
): string {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}
```

**LocalStorage Persistence:**
```typescript
// src/lib/transfer-filter-preferences.ts
const STORAGE_KEYS = {
  FILTERS: 'transfers-filters',
  SAVED_VIEWS: 'transfers-saved-views',
  ACTIVE_VIEW: 'transfers-active-view-id'
} as const

export function getStoredFilters(): TransferFilters | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FILTERS)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error('Failed to parse stored filters:', error)
    return null
  }
}

export function storeFilters(filters: TransferFilters): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters))
  } catch (error) {
    console.error('Failed to store filters:', error)
  }
}

export function getSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SAVED_VIEWS)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to parse saved views:', error)
    return []
  }
}

export function storeSavedViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_VIEWS, JSON.stringify(views))
  } catch (error) {
    console.error('Failed to store saved views:', error)
  }
}

export function getActiveViewId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_VIEW) || null
}

export function setActiveViewId(viewId: string | null): void {
  if (typeof window === 'undefined') return
  if (viewId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_VIEW, viewId)
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_VIEW)
  }
}
```

---

### 3. Saved Views Dialog (`src/components/transfers/SavedViewsDialog.tsx`) [1 hour]

**Features:**
- List all saved views with name, filter summary, default badge
- Create new view (name + current filters)
- Edit existing view (rename, update filters)
- Delete view with confirmation
- Set default view (auto-applies on page load)
- Import/Export views (bonus feature)

**Props Interface:**
```typescript
{
  isOpen: boolean
  onClose: () => void
  savedViews: SavedView[]
  currentFilters: TransferFilters
  onSaveView: (name: string, filters: TransferFilters, isDefault?: boolean) => void
  onUpdateView: (viewId: string, updates: Partial<SavedView>) => void
  onDeleteView: (viewId: string) => void
  onLoadView: (viewId: string) => void
}
```

**UI Design:**
- Use Radix UI Dialog for modal
- Table layout: Name | Filters Summary | Default | Actions
- Actions: Load, Edit, Delete, Set Default
- Create form: Text input + "Save current filters" checkbox + "Set as default" checkbox
- Mobile: Stack cards instead of table

---

### 4. Integration into Transfers Page (`src/app/(app)/transfers/page.tsx`) [0.5 hours]

**State Additions:**
```typescript
// Add to existing state
const [filters, setFilters] = useState<TransferFilters>(() => 
  getStoredFilters() || {}
)
const [savedViews, setSavedViews] = useState<SavedView[]>(() => 
  getSavedViews()
)
const [activeViewId, setActiveViewId] = useState<string | null>(() => 
  getActiveViewId()
)

// Apply filters to displayed transfers
const filteredTransfers = useMemo(() => {
  return applyTransferFilters(displayedTransfers, filters, session?.user?.id)
}, [displayedTransfers, filters, session?.user?.id])

// Auto-apply default view on mount
useEffect(() => {
  if (activeViewId) {
    const defaultView = savedViews.find(v => v.id === activeViewId)
    if (defaultView) {
      setFilters(defaultView.filters)
    }
  }
}, []) // Run once on mount
```

**Event Handlers:**
```typescript
const handleFiltersChange = useCallback((newFilters: TransferFilters) => {
  setFilters(newFilters)
  storeFilters(newFilters)
  // Clear active view when filters manually changed
  setActiveViewId(null)
  setActiveViewId(null)
}, [])

const handleSaveView = useCallback((
  name: string, 
  filters: TransferFilters, 
  isDefault?: boolean
) => {
  const newView: SavedView = {
    id: crypto.randomUUID(),
    name,
    filters,
    isDefault,
    createdAt: new Date().toISOString()
  }
  
  const updated = isDefault
    ? savedViews.map(v => ({ ...v, isDefault: false })).concat(newView)
    : [...savedViews, newView]
  
  setSavedViews(updated)
  storeSavedViews(updated)
  
  if (isDefault) {
    setActiveViewId(newView.id)
    setActiveViewId(newView.id)
  }
}, [savedViews])

const handleLoadView = useCallback((viewId: string) => {
  const view = savedViews.find(v => v.id === viewId)
  if (view) {
    setFilters(view.filters)
    storeFilters(view.filters)
    setActiveViewId(viewId)
    setActiveViewId(viewId)
  }
}, [savedViews])

const handleDeleteView = useCallback((viewId: string) => {
  const updated = savedViews.filter(v => v.id !== viewId)
  setSavedViews(updated)
  storeSavedViews(updated)
  
  if (activeViewId === viewId) {
    setActiveViewId(null)
    setActiveViewId(null)
  }
}, [savedViews, activeViewId])

const handleClearFilters = useCallback(() => {
  setFilters({})
  storeFilters({})
  setActiveViewId(null)
  setActiveViewId(null)
}, [])
```

**Render Updates:**
```tsx
<div className="flex flex-col gap-4">
  {/* Overview Header */}
  <OverviewHeader
    columnCounts={columnCounts}
    totalCount={displayedTransfers.length}
    filteredCount={filteredTransfers.length}
    activeFilters={filters}
    onRefresh={refetch}
    onClearFilters={handleClearFilters}
    onSaveView={() => setShowSavedViewsDialog(true)}
    isLoading={isLoading}
  />
  
  {/* Filter Bar */}
  <FilterBar
    filters={filters}
    onFiltersChange={handleFiltersChange}
    savedViews={savedViews}
    activeViewId={activeViewId}
    onLoadView={handleLoadView}
    onSaveCurrentView={() => setShowSavedViewsDialog(true)}
    facilityOptions={facilities}
    assigneeOptions={assignees}
    isLoading={isLoading}
  />
  
  {/* Existing Density Toggle */}
  <DensityToggle mode={densityMode} onChange={handleDensityChange} />
  
  {/* Kanban Columns (use filteredTransfers instead of displayedTransfers) */}
  {KANBAN_COLUMNS.map(column => {
    const columnTransfers = getTransfersByStatus(filteredTransfers, column.status)
    // ... rest of existing rendering
  })}
</div>

{/* Saved Views Dialog */}
<SavedViewsDialog
  isOpen={showSavedViewsDialog}
  onClose={() => setShowSavedViewsDialog(false)}
  savedViews={savedViews}
  currentFilters={filters}
  onSaveView={handleSaveView}
  onUpdateView={handleUpdateView}
  onDeleteView={handleDeleteView}
  onLoadView={handleLoadView}
/>
```

---

## Testing Checklist

### Functional Tests
- [ ] All filter criteria work independently
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Search debouncing works (no lag during typing)
- [ ] Clear filters button resets all criteria
- [ ] Saved views persist across page reloads
- [ ] Default view auto-applies on page load
- [ ] Loading view updates active filters
- [ ] Deleting view clears if active
- [ ] Filter counts update correctly in Overview Header
- [ ] WIP warnings show when threshold exceeded

### Integration Tests
- [ ] Filters work with existing facility filter
- [ ] Filters work with Phase 0 collapsible lanes
- [ ] Filters work with Phase 0 density toggle
- [ ] Per-column windowing respects filtered counts
- [ ] Regional leader sees only allowed facilities in filter

### Performance Tests
- [ ] Filtering 1000 items < 100ms (desktop)
- [ ] Search debouncing prevents excessive re-renders
- [ ] localStorage operations don't block UI
- [ ] No memory leaks on repeated filter changes

### Edge Cases
- [ ] Empty filter results show clear message
- [ ] Malformed localStorage data falls back to defaults
- [ ] Long saved view names truncate gracefully
- [ ] Date range validation (from <= to)
- [ ] Search special characters handled correctly

---

## Files to Create

1. `src/components/transfers/OverviewHeader.tsx` (~150 lines)
2. `src/components/transfers/FilterBar.tsx` (~250 lines)
3. `src/components/transfers/SavedViewsDialog.tsx` (~200 lines)
4. `src/lib/transfer-filters.ts` (~100 lines)
5. `src/lib/transfer-filter-preferences.ts` (~120 lines)
6. `src/types/transfer-filters.ts` (~40 lines)

**Total:** ~860 new lines

---

## Files to Modify

1. `src/app/(app)/transfers/page.tsx` (~+80 lines for state & handlers)

---

## Dependencies

**New:**
- None (use existing Radix UI components)

**Existing:**
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-checkbox`
- `date-fns` (for date formatting)

---

## Success Criteria

- [ ] Users can filter by 6 criteria simultaneously
- [ ] Search returns results in < 100ms for 1000 items
- [ ] Saved views persist across sessions
- [ ] Default view auto-applies on load
- [ ] Filter bar is mobile-responsive
- [ ] No TypeScript errors (strict mode)
- [ ] SSR-safe (all localStorage guarded)
- [ ] Regional leader permissions respected

---

## Next Steps After Phase 1

1. Gather user feedback on filter usability
2. Monitor localStorage usage (prevent quota issues)
3. Analyze filter adoption metrics
4. Plan Phase 2 (Virtualization for 1000+ items)
