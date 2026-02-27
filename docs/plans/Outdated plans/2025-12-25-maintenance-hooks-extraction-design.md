# Maintenance Page Hooks Extraction Design

**Date**: 2025-12-25
**Target File**: `src/app/(app)/maintenance/page.tsx` (~3400 lines)
**Goal**: Extract business logic into reusable hooks, reducing page.tsx complexity

## Overview

Extract three granular hooks from the maintenance page to separate concerns:
- Operations (approve, reject, delete)
- Draft management (inline editing with localStorage)
- Print generation (HTML template rendering)

## File Structure

```
src/app/(app)/maintenance/
├── _hooks/
│   ├── use-maintenance-operations.ts  (~150 lines)
│   ├── use-maintenance-drafts.ts      (~200 lines)
│   └── use-maintenance-print.ts       (~520 lines)
└── page.tsx                           (reduced by ~870 lines)
```

## Hook 1: `use-maintenance-operations.ts`

**Purpose**: Encapsulate plan lifecycle operations (approve, reject, delete, bulk approve).

### Interface

```typescript
interface UseMaintenanceOperationsParams {
  onSuccess?: () => void;  // Callback after successful mutation (invalidate queries)
}

interface UseMaintenanceOperationsReturn {
  // Single plan operations
  approvePlan: (plan: MaintenancePlan) => void;
  rejectPlan: (planId: number) => void;
  deletePlan: (planId: number) => void;

  // Bulk operations
  bulkApprovePlans: (planIds: number[]) => void;

  // Loading states
  isApproving: boolean;
  isRejecting: boolean;
  isDeleting: boolean;
  isBulkApproving: boolean;

  // Confirmation dialogs state (managed internally)
  confirmDialog: {
    type: 'approve' | 'reject' | 'delete' | 'bulk-approve' | null;
    plan?: MaintenancePlan;
    planIds?: number[];
    open: boolean;
  };
  setConfirmDialog: (state) => void;
}
```

### Key Internals

- Uses existing mutations from `@/hooks/use-maintenance-plans`
- Manages confirmation dialog state internally
- Handles toast notifications on success/error
- ~150 lines total

## Hook 2: `use-maintenance-drafts.ts`

**Purpose**: Manage draft/unsaved changes for inline cell editing with localStorage persistence.

### Interface

```typescript
interface UseMaintenanceDraftsParams {
  plans: MaintenancePlan[];           // Current plans from query
  currentTenant: string | null;       // For localStorage key scoping
}

interface DraftPlan {
  id: number;
  changes: Partial<MaintenancePlan>;  // Only modified fields
  originalValues: Partial<MaintenancePlan>;
}

interface UseMaintenanceDraftsReturn {
  // Draft state
  draftPlans: Map<number, DraftPlan>;
  hasUnsavedChanges: boolean;

  // Cell editing
  handleCellEdit: (planId: number, field: string, value: any) => void;
  getCellValue: (planId: number, field: string, originalValue: any) => any;
  isCellModified: (planId: number, field: string) => boolean;

  // Batch operations
  saveAllChanges: () => Promise<void>;
  discardAllChanges: () => void;
  discardPlanChanges: (planId: number) => void;

  // Saving state
  isSaving: boolean;
  saveError: Error | null;
}
```

### Key Internals

- Syncs to `localStorage` with key `maintenance_drafts_${currentTenant}`
- Restores drafts on mount if plans match
- Clears drafts for deleted/approved plans automatically
- Uses `updateMaintenancePlan` mutation for saving
- ~200 lines total

## Hook 3: `use-maintenance-print.ts`

**Purpose**: Handle print form generation with HTML template rendering.

### Interface

```typescript
interface UseMaintenancePrintParams {
  plans: MaintenancePlan[];
  tasks: MaintenanceTask[];
  selectedPlanIds: number[];
  tenantName: string;
}

interface UseMaintenancePrintReturn {
  // Main action
  generatePlanForm: () => Promise<void>;

  // State
  isGenerating: boolean;
  error: Error | null;
}
```

### Key Internals

- Contains ~500 line HTML template as `buildPrintTemplate()` function
- Groups tasks by plan for rendering
- Opens print window with Vietnamese formatting
- Template includes:
  - Header with tenant name, date
  - Plan details table (equipment, frequency, dates)
  - Task checklist per plan
  - Signature blocks
- ~520 lines total (mostly template)

### Structure

```typescript
function buildPrintTemplate(data: PrintTemplateData): string {
  return `<!DOCTYPE html>
    <html lang="vi">
    <head>...</head>
    <body>
      <!-- Vietnamese maintenance form template -->
    </body>
    </html>`;
}

export function useMaintenancePrint(params: UseMaintenancePrintParams) {
  const generatePlanForm = useCallback(async () => {
    const html = buildPrintTemplate({...});
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(html);
    printWindow?.print();
  }, [params]);

  return { generatePlanForm, isGenerating, error };
}
```

## Migration Strategy

1. Create `_hooks/` directory
2. Extract `use-maintenance-operations.ts` first (simplest, fewer dependencies)
3. Extract `use-maintenance-drafts.ts` (requires careful state migration)
4. Extract `use-maintenance-print.ts` (largest, but self-contained)
5. Update `page.tsx` imports and remove extracted code
6. Verify functionality after each extraction

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| page.tsx lines | ~3400 | ~2530 |
| Extracted to hooks | 0 | ~870 |
| Reusable logic | No | Yes |
| Testability | Low | High |

## Related Beads

- `qltbyt-nam-phong-uwg`: Phase 1: Extract maintenance hooks (this design)
- `qltbyt-nam-phong-tq5`: Phase 2: Extract MobileMaintenanceView component (blocked)
- `qltbyt-nam-phong-qlh`: Phase 3: Extract Desktop UI components (blocked)
- `qltbyt-nam-phong-m4i`: Phase 4: Simplify page.tsx to controller only (blocked)
