# Repair Requests Page Phase 1: Mechanical Extraction Design

**Date**: 2025-12-27
**Status**: Approved
**Author**: Claude Code
**Target**: `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` (1,725 lines)

## Overview

Mechanically extract five logical blocks from the 1,725-line `RepairRequestsPageClient.tsx` into focused, single-responsibility components and hooks. This is pure refactoring with **zero logic changes** - following the established extraction pattern used in the maintenance page refactor.

**Goal**: Reduce `RepairRequestsPageClient.tsx` from 1,725 to ~1,289 lines (25% reduction) while improving code organization and maintainability.

**Approach**: Mechanical extraction - move code to new files, wire up props/hooks, validate behavior unchanged.

---

## What's Already Extracted

**Existing dialog components:**
- ✅ `EditRequestDialog.tsx` (~180 lines)
- ✅ `DeleteRequestDialog.tsx` (~50 lines)
- ✅ `ApproveRequestDialog.tsx` (~120 lines)
- ✅ `CompleteRequestDialog.tsx` (~130 lines)
- ✅ `CreateRequestSheet.tsx` (~280 lines)
- ✅ `FilterModal.tsx` (~190 lines)
- ✅ `RequestDetailContent.tsx` (~250 lines)

**Current state**: `RepairRequestsPageClient.tsx` is 1,725 lines with individual dialogs already extracted.

---

## Remaining Code Issues

**Current pain points:**
1. **Dialog state explosion** - 15+ separate `useState` calls for form/dialog state (lines 130-192)
2. **Column definitions inline** - 160 lines of column definitions mixed with component logic (lines 800-961)
3. **Mobile view inline** - 110 lines of mobile card rendering in main JSX (lines 1437-1550)
4. **Pagination inline** - 80 lines of pagination controls in main JSX (lines 1635-1712)
5. **Keyboard shortcuts inline** - 16 lines of effect hook for shortcuts (lines 1024-1039)

**What remains in `RepairRequestsPageClient.tsx`:**
- Imports and setup (~100 lines)
- Auth checks and loading state (~20 lines)
- Dialog state declarations (~70 lines) → **EXTRACT**
- Data fetching with TanStack Query (~130 lines)
- CRUD handlers (~260 lines) → **DEFER TO PHASE 2**
- Table column definitions (~160 lines) → **EXTRACT**
- Table configuration (~30 lines)
- Keyboard shortcuts effect (~16 lines) → **EXTRACT**
- Mobile card rendering (~110 lines) → **EXTRACT**
- Desktop table rendering (~80 lines)
- Pagination controls (~80 lines) → **EXTRACT**
- Dialog JSX rendering (~100 lines)
- Summary and filter UI (~150 lines)

---

## Phase 1 Extraction Plan

### Components/Hooks to Extract

**1. `useRepairRequestDialogs` Hook (~70 lines)**

**File:** `_hooks/useRepairRequestDialogs.ts`

**Purpose**: Consolidate all dialog/form state into a single hook.

**Interface**:
```typescript
interface RepairRequestDialogsState {
  // Create dialog
  isCreateOpen: boolean
  // Edit dialog state
  editingRequest: RepairRequestWithEquipment | null
  editIssueDescription: string
  editRepairItems: string
  editDesiredDate: Date | undefined
  editRepairUnit: RepairUnit
  editExternalCompanyName: string
  // Delete dialog state
  requestToDelete: RepairRequestWithEquipment | null
  // Approve dialog state
  requestToApprove: RepairRequestWithEquipment | null
  approvalRepairUnit: RepairUnit
  approvalExternalCompanyName: string
  // Complete dialog state
  requestToComplete: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  completionResult: string
  nonCompletionReason: string
  // View detail state
  requestToView: RepairRequestWithEquipment | null
}

interface RepairRequestDialogsActions {
  setIsCreateOpen: (open: boolean) => void
  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  setEditIssueDescription: (val: string) => void
  setEditRepairItems: (val: string) => void
  setEditDesiredDate: (val: Date | undefined) => void
  setEditRepairUnit: (val: RepairUnit) => void
  setEditExternalCompanyName: (val: string) => void
  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void
  setRequestToApprove: (req: RepairRequestWithEquipment | null) => void
  setApprovalRepairUnit: (val: RepairUnit) => void
  setApprovalExternalCompanyName: (val: string) => void
  setRequestToComplete: (req: RepairRequestWithEquipment | null) => void
  setCompletionType: (val: 'Hoàn thành' | 'Không HT' | null) => void
  setCompletionResult: (val: string) => void
  setNonCompletionReason: (val: string) => void
  setRequestToView: (req: RepairRequestWithEquipment | null) => void
}

export function useRepairRequestDialogs(): RepairRequestDialogsState & RepairRequestDialogsActions
```

**What it contains**:
- All `useState` declarations for dialogs (lines 130-192)
- Returns both state values and setters

**Data flow**: Parent calls hook, destructures state and setters, uses them as before.

**Lines extracted from main:** ~70 (lines 130-192)

---

**2. `repair-requests-columns.tsx` (~160 lines)**

**File:** `_components/repair-requests-columns.tsx`

**Purpose**: Table column definitions for repair requests table.

**Interface**:
```typescript
interface RepairRequestColumnOptions {
  // Actions from page client
  onGenerateSheet: (request: RepairRequestWithEquipment) => void
  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void
  handleApproveRequest: (req: RepairRequestWithEquipment) => void
  handleCompletion: (req: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  setRequestToView: (req: RepairRequestWithEquipment | null) => void
  // User context
  user: any
  isRegionalLeader: boolean
}

export function useRepairRequestColumns(options: RepairRequestColumnOptions): ColumnDef<RepairRequestWithEquipment>[]
```

**What it contains**:
- `renderActions` function (currently lines 741-798)
- All 6 column definitions:
  - Thiết bị (with description)
  - Người yêu cầu
  - Ngày yêu cầu
  - Ngày mong muốn HT (with progress bar)
  - Trạng thái (with badge and status details)
  - Actions column

**Data flow**: Pure function via `useMemo`, receives action callbacks, returns memoized column array.

**Lines extracted from main:** ~160 (lines 741-961)

---

**3. `MobileRequestList.tsx` (~110 lines)**

**File:** `_components/MobileRequestList.tsx`

**Purpose**: Mobile card view rendering for repair requests.

**Interface**:
```typescript
interface MobileRequestListProps {
  requests: RepairRequestWithEquipment[]
  isLoading: boolean
  setRequestToView: (req: RepairRequestWithEquipment | null) => void
  renderActions: (req: RepairRequestWithEquipment) => React.ReactNode
}

export function MobileRequestList({
  requests,
  isLoading,
  setRequestToView,
  renderActions
}: MobileRequestListProps)
```

**What it contains**:
- Mobile card rendering (lines 1437-1550)
- Loading skeleton
- Empty state
- Individual card with all fields

**Data flow**: Receives data and callbacks, renders mobile-optimized cards.

**Lines extracted from main:** ~110 (lines 1437-1550)

---

**4. `RepairRequestsPagination.tsx` (~80 lines)**

**File:** `_components/RepairRequestsPagination.tsx`

**Purpose**: Pagination controls with page size selector.

**Interface**:
```typescript
interface PaginationProps {
  table: Table<RepairRequestWithEquipment>
  totalRequests: number
  pagination: { pageIndex: number; pageSize: number }
}

export function RepairRequestsPagination({ table, totalRequests, pagination }: PaginationProps)
```

**What it contains**:
- "Showing X-Y of Z" text
- Page size selector (10, 20, 50, 100)
- Page navigation buttons (first, prev, next, last)
- Current page indicator

**Data flow**: Receives table instance and pagination state, renders controls.

**Lines extracted from main:** ~80 (lines 1635-1712)

---

**5. `useRepairRequestShortcuts` Hook (~16 lines)**

**File:** `_hooks/useRepairRequestShortcuts.ts`

**Purpose**: Keyboard shortcuts for search focus and new request creation.

**Interface**:
```typescript
interface ShortcutOptions {
  searchInputRef: React.RefObject<HTMLInputElement>
  onCreate: () => void
  isRegionalLeader: boolean
}

export function useRepairRequestShortcuts({
  searchInputRef,
  onCreate,
  isRegionalLeader
}: ShortcutOptions)
```

**What it contains**:
- Keyboard event listener effect
- `/` key → focus search input
- `n` key → open create dialog (non-regional-leaders only)
- Ignores when typing in inputs

**Data flow**: Sets up effect on mount, cleans up on unmount.

**Lines extracted from main:** ~16 (lines 1024-1039)

---

## File Structure After Extraction

```
src/app/(app)/repair-requests/
├── page.tsx                                    # ~1,289 lines (-436 from 1,725)
├── request-sheet.ts                            # (existing)
├── types.ts                                    # (existing)
├── utils.ts                                    # (existing)
├── _components/
│   ├── ApproveRequestDialog.tsx                # (existing)
│   ├── CompleteRequestDialog.tsx               # (existing)
│   ├── CreateRequestSheet.tsx                  # (existing)
│   ├── DeleteRequestDialog.tsx                 # (existing)
│   ├── EditRequestDialog.tsx                   # (existing)
│   ├── FilterChips.tsx                         # (existing)
│   ├── FilterModal.tsx                         # (existing)
│   ├── RequestDetailContent.tsx                # (existing)
│   ├── ResizableAside.tsx                      # (existing, empty)
│   ├── repair-requests-columns.tsx             # (NEW - ~160 lines)
│   ├── MobileRequestList.tsx                   # (NEW - ~110 lines)
│   └── RepairRequestsPagination.tsx            # (NEW - ~80 lines)
└── _hooks/
    ├── useRepairRequestDialogs.ts              # (NEW - ~70 lines)
    └── useRepairRequestShortcuts.ts            # (NEW - ~16 lines)
```

---

## page.tsx After Extraction

**Responsibilities:**
- Imports and component setup
- Auth checks and loading states
- Data fetching (TanStack Query)
- CRUD handlers (handleSubmit, handleApproveRequest, etc.) - **remain in Phase 1**
- Table configuration (useReactTable setup)
- Summary bar calculation
- Filter toolbar rendering
- Desktop table rendering
- Dialog orchestration (rendering existing dialog components)

**What gets removed:**
- ❌ Dialog state declarations (moved to `useRepairRequestDialogs`)
- ❌ Column definitions (moved to `repair-requests-columns.tsx`)
- ❌ Mobile card rendering (moved to `MobileRequestList.tsx`)
- ❌ Pagination controls (moved to `RepairRequestsPagination.tsx`)
- ❌ Keyboard shortcuts effect (moved to `useRepairRequestShortcuts`)

**What gets added:**
```typescript
// Hook imports
import { useRepairRequestDialogs } from './_hooks/useRepairRequestDialogs'
import { useRepairRequestShortcuts } from './_hooks/useRepairRequestShortcuts'

// Component imports
import { useRepairRequestColumns } from './_components/repair-requests-columns'
import { MobileRequestList } from './_components/MobileRequestList'
import { RepairRequestsPagination } from './_components/RepairRequestsPagination'

// In component:
const {
  isCreateOpen, setIsCreateOpen,
  editingRequest, setEditingRequest,
  editIssueDescription, setEditIssueDescription,
  // ... all dialog state
} = useRepairRequestDialogs()

useRepairRequestShortcuts({
  searchInputRef,
  onCreate: () => setIsCreateOpen(true),
  isRegionalLeader
})

const columns = useRepairRequestColumns({
  onGenerateSheet: handleGenerateRequestSheet,
  setEditingRequest,
  setRequestToDelete,
  handleApproveRequest,
  handleCompletion,
  setRequestToView,
  user,
  isRegionalLeader
})
```

---

## Error Handling & Validation

### Error Handling Strategy

**Parent (`page.tsx`) responsibilities:**
- All RPC calls remain in component (handleSubmit, handleApproveRequest, etc.)
- Toast notifications already handled by parent
- No changes needed - error handling stays in place

**Child components/hooks:**
- `useRepairRequestDialogs`: No error handling (just state)
- `repair-requests-columns.tsx`: No error handling (pure functions)
- `MobileRequestList`: No error handling (presentation only)
- `RepairRequestsPagination`: No error handling (UI only)
- `useRepairRequestShortcuts`: No error handling (event listeners)

---

### Validation Strategy

**All validation remains in parent component:**
- Form validation (handleSubmit, handleUpdateRequest)
- Dialog state validation (handleConfirmApproval, handleConfirmCompletion)
- Empty state checks before opening dialogs

Child components receive validated data and render.

---

### Loading States

Loading state management remains in parent:

| State | Source | Usage |
|-------|--------|-------|
| `isLoading` | TanStack Query | Passed to MobileRequestList, desktop table |
| `isSubmitting` | Parent state | Passed to CreateRequestSheet |
| `isEditSubmitting` | Parent state | Passed to EditRequestDialog |
| `isApproving` | Parent state | Passed to ApproveRequestDialog |
| `isCompleting` | Parent state | Passed to CompleteRequestDialog |
| `isDeleting` | Parent state | Passed to DeleteRequestDialog |

---

## Testing Strategy

### Validation After Each Extraction

**After creating each new file:**
```bash
npm run typecheck  # Must PASS
git add <new-file>
git commit -m "feat(repair-requests): extract <component-name> scaffold"
```

**After integrating each component into `page.tsx`:**
```bash
npm run typecheck  # Must PASS
npm run build      # Must SUCCESS
```

**Manual smoke test:**
- Start dev server: `npm run dev`
- Navigate to `/repair-requests`
- Verify page loads without console errors
- Test extracted functionality (see checklists below)

---

### Manual Testing Checklist

**After `useRepairRequestDialogs`:**
- [ ] Create dialog opens with `/` key or `n` key
- [ ] Edit dialog opens and populates with correct data
- [ ] Delete confirmation appears
- [ ] Approve dialog opens
- [ ] Complete dialog opens
- [ ] Detail view opens on click
- [ ] All form state persists correctly

**After `repair-requests-columns.tsx`:**
- [ ] Table renders all columns correctly
- [ ] Sorting works on sortable columns
- [ ] Actions menu opens and all items work
- [ ] Due date progress bars display correctly
- [ ] Status badges show correct colors and details
- [ ] Sheet generation works

**After `MobileRequestList.tsx`:**
- [ ] Mobile cards render correctly
- [ ] Card tap opens detail view
- [ ] Actions menu works on cards
- [ ] Loading skeleton appears
- [ ] Empty state shows when no results
- [ ] All fields display correctly

**After `RepairRequestsPagination.tsx`:**
- [ ] Page count displays correctly
- [ ] Page size selector works (10, 20, 50, 100)
- [ ] Navigation buttons work (first, prev, next, last)
- [ ] "Showing X-Y of Z" text is accurate
- [ ] Disabled states work correctly

**After `useRepairRequestShortcuts`:**
- [ ] `/` key focuses search input
- [ ] `n` key opens create dialog (non-regional-leaders)
- [ ] Shortcuts don't trigger when typing in inputs
- [ ] Shortcuts don't work for regional leaders (except `/`)

**Final integration testing:**
- [ ] Complete create workflow
- [ ] Complete edit workflow
- [ ] Complete approve workflow
- [ ] Complete complete workflow
- [ ] Complete delete workflow
- [ ] Mobile and desktop views both work
- [ ] Refresh page → Changes persist
- [ ] All filters work correctly
- [ ] Pagination works correctly

---

### Type Safety Coverage

**TypeScript prevents:**
- ❌ Missing required props
- ❌ Wrong prop types
- ❌ Incorrect handler signatures
- ❌ Null/undefined access

**We manually test:**
- User interactions
- Visual rendering
- Data persistence
- Error states
- Keyboard shortcuts

---

## Implementation Sequence

### Extraction Order (Lowest Risk → Highest Risk)

**Phase 1A: `useRepairRequestShortcuts` Hook** (Easiest)
- **Why first?** Smallest extraction, pure effect hook, isolated functionality
- **Risk:** Very low - just moving effect to new file
- **Validation:** Typecheck passes, keyboard shortcuts work

**Phase 1B: `useRepairRequestDialogs` Hook** (Low-Medium)
- **Why second?** Groups state declarations, no JSX changes
- **Risk:** Low - state stays in component, just grouped differently
- **Validation:** All dialogs open/close correctly, form state persists

**Phase 1C: `repair-requests-columns.tsx`** (Low)
- **Why third?** Pure functions returning column definitions
- **Risk:** Very low - just moving column definitions
- **Validation:** Table renders correctly, sorting works, actions work

**Phase 1D: `RepairRequestsPagination.tsx`** (Low)
- **Why fourth?** Self-contained JSX component
- **Risk:** Very low - state stays in parent, just JSX extraction
- **Validation:** All pagination controls work

**Phase 1E: `MobileRequestList.tsx`** (Low-Medium)
- **Why last?** More complex JSX with conditional rendering
- **Risk:** Low-Medium - need to ensure all callbacks pass correctly
- **Validation:** Mobile view renders correctly, cards work

---

### Implementation Steps (Per Component)

**For each component, repeat this cycle:**

1. Create file with imports and interface
2. Extract implementation from `page.tsx`
3. Add import to `page.tsx`
4. Remove extracted code from `page.tsx`
5. Run typecheck → `npm run typecheck`
6. Manual smoke test → Dev server, check functionality
7. Git commit → Small, focused commit message

---

### Expected Line Count Reduction

| Phase | Component | Lines Extracted | page.tsx After |
|-------|-----------|-----------------|----------------|
| Start | — | — | 1,725 |
| 1A | `useRepairRequestShortcuts` | -16 | 1,709 |
| 1B | `useRepairRequestDialogs` | -70 | 1,639 |
| 1C | `repair-requests-columns.tsx` | -160 | 1,479 |
| 1D | `RepairRequestsPagination.tsx` | -80 | 1,399 |
| 1E | `MobileRequestList.tsx` | -110 | 1,289 |

**Final result**: `page.tsx` reduced from **1,725 → ~1,289 lines (25% reduction)**

---

### Rollback Strategy

**If something goes wrong:**
```bash
# After each commit, we can rollback
git revert HEAD          # Undo last commit
git revert HEAD~2        # Undo last 3 commits

# Or reset to known-good state
git reset --hard <commit-hash>
```

**Since we commit after each component:**
- Maximum loss: 1 component (~160 lines)
- Can't break everything at once
- Always have working state to return to

---

## Post-Extraction Cleanup (Optional)

After all five extractions complete:

1. **Review imports** → Remove unused imports from `page.tsx`
2. **Add file headers** → Add descriptive comments to each new file
3. **Update documentation** → Update any docs that reference page.tsx structure
4. **Final commit** → Summary commit: "refactor(repair-requests): Phase 1 mechanical extraction complete (-436 lines)"

---

## Validation Criteria

**Success metrics:**
- ✅ `npm run typecheck` passes with 0 errors
- ✅ `npm run build` succeeds
- ✅ All manual testing checklists pass
- ✅ No console errors in browser
- ✅ `page.tsx` line count ≤ 1,300 lines
- ✅ All existing functionality works identically

**Failure conditions:**
- ❌ TypeScript errors after extraction
- ❌ Build fails
- ❌ Any existing feature broken
- ❌ Console errors at runtime

---

## Future Work (Phase 2 - Optional)

If further reduction is needed after Phase 1, consider:

**`useRepairRequestHandlers` Hook:**
- Extract CRUD handlers (handleSubmit, handleApproveRequest, handleUpdateRequest, handleDeleteRequest, handleGenerateRequestSheet)
- ~260 lines of handler logic
- Reduces page.tsx to ~1,029 lines (~40% total reduction)

**Filter Toolbar Component:**
- Extract search, filter button, display settings dropdown
- ~100 lines of JSX
- Cleaner separation of concerns

**Prop-Drilling Fix (Deferred from original discussion):**
- URL-based actions or Context API
- Eliminates 4-level callback chain
- More complex architecture change

**Trigger for Phase 2:**
- File still feels unwieldy after Phase 1
- Adding features requires threading too many props
- Difficult to track which components use which state

**Note: Phase 2 is optional and may not be needed if Phase 1 provides sufficient organization.**

---

## Dependencies

### Required Imports for New Components

**`useRepairRequestDialogs.ts`:**
```typescript
import * as React from "react"
import type { RepairRequestWithEquipment, RepairUnit } from "../../types"
```

**`useRepairRequestShortcuts.ts`:**
```typescript
import { useEffect } from "react"
```

**`repair-requests-columns.tsx`:**
```typescript
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment } from "../../types"
import { calculateDaysRemaining, getStatusVariant } from "../../utils"
```

**`MobileRequestList.tsx`:**
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment } from "../../types"
import { calculateDaysRemaining, getStatusVariant } from "../../utils"
```

**`RepairRequestsPagination.tsx`:**
```typescript
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import type { Table } from "@tanstack/react-table"
```

---

## Related Work

- **Maintenance page refactor**: Similar extraction pattern (2025-12-26-maintenance-page-phase1-mechanical-extraction-design.md)
- **Repair requests dialog extraction**: Previous dialog component extractions (EditRequestDialog, ApproveRequestDialog, etc.)

---

## Summary

**What we're building:**
- 5 focused components/hooks extracted from 1,725-line `RepairRequestsPageClient.tsx`
- Mechanical extraction following established patterns
- Zero logic changes - pure refactoring for maintainability

**Expected outcome:**
- `page.tsx`: 1,725 → ~1,289 lines (-25%)
- Better code organization
- Easier to locate and modify logic
- Foundation for future enhancements (optional Phase 2)

**Implementation timeline:**
- Phase 1A: `useRepairRequestShortcuts` - ~15-30 minutes
- Phase 1B: `useRepairRequestDialogs` - ~30-45 minutes
- Phase 1C: `repair-requests-columns.tsx` - ~1 hour
- Phase 1D: `RepairRequestsPagination.tsx` - ~30-45 minutes
- Phase 1E: `MobileRequestList.tsx` - ~45-60 minutes
- Testing and validation: ~1 hour

**Total estimate**: ~4-5 hours of focused work
