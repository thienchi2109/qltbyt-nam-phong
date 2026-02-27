# Transfers Page Refactoring Design

**Date:** 2025-12-29
**Goal:** Reduce `src/app/(app)/transfers/page.tsx` from 1246 lines to ~400 lines
**Approach:** Custom Hook Extraction (Approach A)

## Problem Statement

The Transfers page contains all logic inline:
- 7 action handlers (~170 lines)
- `rowActions()` rendering function (~225 lines)
- Facility filter UI (~100 lines)
- Data mapper (~48 lines)

Despite previous component extractions (TransferTypeTabs, TransferCard, FilterModal, etc.), the page remains at 1246 lines - far exceeding the 350-450 line target from CLAUDE.md.

## Design Decision

**Chosen Approach:** Custom Hook Extraction

**Rationale:**
- Matches existing codebase patterns (`useTransferList`, `useTransferSearch`, `useTransferTypeTab`)
- Easy to grep: `useTransferActions` → find all action logic
- Single responsibility: hook = logic, component = UI
- Minimal refactoring of consuming code

## File Structure

```
src/
├── app/(app)/transfers/
│   └── page.tsx (~400 lines)          # Orchestration, state, rendering
│
├── hooks/
│   └── useTransferActions.ts (~200 lines)  # All action handlers
│
└── components/transfers/
    ├── TransferRowActions.tsx (~180 lines)  # Action button rendering
    └── FacilityFilter.tsx (~80 lines)       # Facility select + mobile sheet
```

## Component Specifications

### 1. `useTransferActions` Hook

**Location:** `src/hooks/useTransferActions.ts`

**Interface:**
```typescript
interface UseTransferActionsOptions {
  onSuccess: () => Promise<void>  // Typically: refetchList + refetchCounts
}

interface UseTransferActionsReturn {
  // Status transition actions
  approveTransfer: (item: TransferListItem) => Promise<void>
  startTransfer: (item: TransferListItem) => Promise<void>
  handoverToExternal: (item: TransferListItem) => Promise<void>
  returnFromExternal: (item: TransferListItem) => Promise<void>
  completeTransfer: (item: TransferListItem) => Promise<void>

  // CRUD actions
  confirmDelete: (item: TransferListItem) => Promise<void>

  // Permission checks
  canEditTransfer: (item: TransferListItem) => boolean
  canDeleteTransfer: (item: TransferListItem) => boolean

  // Utility
  mapToTransferRequest: (item: TransferListItem) => TransferRequest
  isRegionalLeader: boolean
  isTransferCoreRole: boolean
}
```

**Encapsulates:**
- Session access (`useSession`) for role checks
- Toast notifications (`useToast`) for success/error feedback
- Regional leader restriction logic
- All 7 action handlers with consistent error handling
- Permission helper functions

### 2. `TransferRowActions` Component

**Location:** `src/components/transfers/TransferRowActions.tsx`

**Interface:**
```typescript
interface TransferRowActionsProps {
  item: TransferListItem

  // Permission flags
  canEdit: boolean
  canDelete: boolean
  isTransferCoreRole: boolean
  userRole: string
  userKhoaPhong?: number

  // Action callbacks
  onEdit: () => void
  onDelete: () => void
  onApprove: () => void
  onStart: () => void
  onHandover: () => void
  onReturn: () => void
  onComplete: () => void
  onGenerateHandoverSheet: () => void
}
```

**Responsibilities:**
- Switch statement on `item.trang_thai`
- Render appropriate action buttons with tooltips
- Return `null` if no actions available

### 3. `FacilityFilter` Component

**Location:** `src/components/transfers/FacilityFilter.tsx`

**Interface:**
```typescript
interface FacilityFilterProps {
  facilities: Array<{ id: number; name: string }>
  selectedId: number | null
  onSelect: (id: number | null) => void
  show: boolean  // Whether to render at all (based on user role)
}
```

**Responsibilities:**
- Desktop: `Select` dropdown (hidden on mobile)
- Mobile: `Sheet` with button list (hidden on desktop)
- Internal state for temp selection in mobile sheet

## Data Flow

```
page.tsx
    │
    ├─► useTransferActions({ onSuccess }) ─► returns action functions + permissions
    │
    ├─► useTransferList(filters) ─► returns transfer data
    │
    └─► Renders:
            ├─► FacilityFilter ─► calls setSelectedFacilityId
            │
            ├─► TransferRowActions ─► calls action functions from hook
            │
            └─► Dialogs (Add/Edit/Detail/Handover/Delete)
                    └─► controlled by page state
```

## What Stays in page.tsx

- Dialog open/close state (dialogs are rendered in page)
- Which transfer is being edited/deleted (UI state)
- The `onSuccess` callback definition
- Filter state management
- Table/card rendering orchestration

## Estimated Line Counts

| File | Lines | Content |
|------|-------|---------|
| `page.tsx` | ~400 | State, filters, dialogs, table/card rendering |
| `useTransferActions.ts` | ~200 | 7 actions + permission checks + mapper |
| `TransferRowActions.tsx` | ~180 | Action button rendering with tooltips |
| `FacilityFilter.tsx` | ~80 | Select + Sheet UI |

**Total:** ~860 lines across 4 files (vs 1246 in one file)

## Implementation Order

1. Create `useTransferActions.ts` hook
2. Create `TransferRowActions.tsx` component
3. Create `FacilityFilter.tsx` component
4. Refactor `page.tsx` to use extracted modules
5. Run typecheck and verify functionality
