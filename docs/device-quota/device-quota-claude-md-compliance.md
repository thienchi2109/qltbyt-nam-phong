# Device Quota Feature - CLAUDE.md Compliance Checklist

This document ensures the Device Quota implementation follows all rules defined in CLAUDE.md.

---

## 1. Security Model Compliance

### ✅ RPC-Only Architecture

| Rule | Implementation | Status |
|------|----------------|--------|
| Never `supabase.from('table')` | All data via `callRpc()` | ✅ |
| Never trust client `p_don_vi` | Proxy overrides for non-global | ✅ |
| Add to `ALLOWED_FUNCTIONS` | Listed in implementation plan | ✅ |
| Use `callRpc()` wrapper | All hooks use `callRpc()` | ✅ |

### ✅ RPC Functions Follow Template

All RPC functions in implementation plan include:
```sql
-- 1. Extract JWT claims
v_role := current_setting('request.jwt.claims', true)::json->>'app_role';
v_don_vi := current_setting('request.jwt.claims', true)::json->>'don_vi';

-- 2. Permission check
IF v_role NOT IN ('global', 'admin', 'to_qltb') THEN
  RAISE EXCEPTION 'Insufficient permissions';
END IF;

-- 3. Tenant isolation (CRITICAL)
IF v_role NOT IN ('global', 'admin') THEN
  p_don_vi := v_don_vi;  -- Force user's tenant
END IF;
```

---

## 2. File Structure Compliance

### ✅ Module Structure (RepairRequests Pattern)

**Required Structure:**
```
src/app/(app)/device-quota/
├── _components/
│   ├── DeviceQuotaContext.tsx           # ✅ State, mutations, dialog actions
│   ├── DeviceQuotaPageClient.tsx        # ✅ Smart container
│   ├── DeviceQuotaTable.tsx             # ✅ Presentational (decisions list)
│   ├── DeviceQuotaTreeTable.tsx         # ✅ Presentational (hierarchy)
│   ├── DeviceQuotaToolbar.tsx           # ✅ Search, filters
│   ├── DeviceQuotaCreateDialog.tsx      # ✅ Self-contained (0 props)
│   ├── DeviceQuotaEditDialog.tsx        # ✅ Self-contained (0 props)
│   ├── DeviceQuotaActivateDialog.tsx    # ✅ Self-contained (0 props)
│   ├── DeviceQuotaPublishDialog.tsx     # ✅ Self-contained (0 props)
│   ├── DeviceQuotaDeleteDialog.tsx      # ✅ Self-contained (0 props)
│   ├── DeviceQuotaDetailSheet.tsx       # ✅ Self-contained (0 props)
│   ├── DeviceQuotaLineItemDialog.tsx    # ✅ Self-contained (0 props)
│   ├── DeviceQuotaComplianceSummary.tsx # ✅ Dashboard cards
│   └── DeviceQuotaMobileList.tsx        # ✅ Mobile card view
├── _hooks/
│   └── useDeviceQuotaContext.ts         # ✅ Consumer hook
├── page.tsx                              # ✅ Server component entry
└── types.ts                              # ✅ TypeScript interfaces
```

### ✅ File Naming: Grep-Friendly Prefixes (MANDATORY)

| Rule | Correct Name | ❌ Wrong Name |
|------|--------------|---------------|
| Module prefix | `DeviceQuotaContext.tsx` | `Context.tsx` |
| Module prefix | `DeviceQuotaTable.tsx` | `Table.tsx` |
| Module prefix | `DeviceQuotaTreeTable.tsx` | `TreeTable.tsx` |
| Module prefix | `DeviceQuotaCreateDialog.tsx` | `CreateDialog.tsx` |
| Module prefix | `DeviceQuotaEditDialog.tsx` | `EditDialog.tsx` |
| Module prefix | `useDeviceQuotaContext.ts` | `useContext.ts` |

**Verification:** `grep DeviceQuota src/` finds ALL related files.

---

## 3. Code Conventions Compliance

### ✅ File Size: 350-450 Lines Max

| Component | Estimated Lines | Strategy if Over |
|-----------|-----------------|------------------|
| `DeviceQuotaContext.tsx` | ~300 | OK |
| `DeviceQuotaPageClient.tsx` | ~150 | OK |
| `DeviceQuotaTable.tsx` | ~200 | OK |
| `DeviceQuotaTreeTable.tsx` | ~350 | OK |
| `DeviceQuotaColumns.tsx` | ~150 | Extract to separate file |
| `DeviceQuotaDetailSheet.tsx` | ~400 | Split tabs into sub-components |

**If file exceeds 450 lines:**
- Extract column definitions to `DeviceQuotaColumns.tsx`
- Extract tab content to `DeviceQuotaDetailInfo.tsx`, `DeviceQuotaDetailHistory.tsx`
- Extract complex logic to hooks

### ✅ TypeScript: Never `any`

```typescript
// ✅ CORRECT
interface QuyetDinhDinhMuc {
  id: number
  don_vi_id: number
  so_quyet_dinh: string
  trang_thai: 'draft' | 'active' | 'replaced'
  // ... explicit types
}

// ❌ WRONG
const handleSubmit = (data: any) => {...}  // NEVER use any
```

**All types defined in:**
- `src/app/(app)/device-quota/types.ts` - Module-specific types
- `src/types/database.ts` - Database types (add quota tables)

### ✅ Import Order

```typescript
// 1. React
import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'

// 2. Third-party
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// 3. Components (alias)
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Table, TableBody, TableCell } from '@/components/ui/table'

// 4. Lib/Utils
import { callRpc } from '@/lib/rpc-client'
import { cn } from '@/lib/utils'

// 5. Local (relative)
import { useDeviceQuotaContext } from '../_hooks/useDeviceQuotaContext'
import type { QuyetDinhDinhMuc } from '../types'
```

---

## 4. Data Fetching Compliance

### ✅ TanStack Query v5 ONLY

```typescript
// ✅ CORRECT - TanStack Query
const { data: decisions } = useQuery({
  queryKey: ['device-quota', 'decisions', { donViId, trangThai }],
  queryFn: () => callRpc({
    fn: 'dinh_muc_quyet_dinh_list',
    args: { p_trang_thai: trangThai }
  }),
  enabled: !!donViId
})

// ❌ WRONG - useState for server data
const [decisions, setDecisions] = useState([])
useEffect(() => {
  fetchDecisions().then(setDecisions)  // NEVER do this
}, [])
```

### ✅ Query Key Convention

```typescript
// Hierarchical query keys for proper invalidation
const deviceQuotaKeys = {
  all: ['device-quota'] as const,
  decisions: (donViId: number, trangThai?: string) =>
    [...deviceQuotaKeys.all, 'decisions', { donViId, trangThai }] as const,
  decision: (id: number) =>
    [...deviceQuotaKeys.all, 'decision', id] as const,
  details: (quyetDinhId: number) =>
    [...deviceQuotaKeys.all, 'details', quyetDinhId] as const,
  categories: (phanLoai?: string) =>
    [...deviceQuotaKeys.all, 'categories', { phanLoai }] as const,
  compliance: (donViId: number) =>
    [...deviceQuotaKeys.all, 'compliance', donViId] as const,
}
```

---

## 5. UI/UX Compliance

### ✅ Radix + Tailwind

All UI components from existing library:
- `@/components/ui/dialog` - Radix Dialog
- `@/components/ui/table` - Data tables
- `@/components/ui/button` - Buttons
- `@/components/ui/badge` - Status badges
- `@/components/ui/sheet` - Side panels
- `@/components/ui/tabs` - Tab navigation
- `@/components/ui/accordion` - Mobile tree view

### ✅ Mobile-First

```typescript
// Responsive breakpoints
<div className="hidden md:block">  {/* Desktop table */}
  <DeviceQuotaTable />
</div>
<div className="md:hidden">  {/* Mobile cards */}
  <DeviceQuotaMobileList />
</div>

// Tree table mobile fallback
const isMobile = useMediaQuery("(max-width: 768px)")
if (isMobile) return <DeviceQuotaMobileAccordion />
return <DeviceQuotaTreeTable />
```

### ✅ react-hook-form + zod

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createDecisionSchema = z.object({
  so_quyet_dinh: z.string().min(1, "Số quyết định không được để trống"),
  ngay_ban_hanh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  nguoi_ky: z.string().min(1, "Người ký không được để trống"),
  chuc_vu_nguoi_ky: z.string().min(1, "Chức vụ không được để trống"),
  hieu_luc_tu: z.string(),
  hieu_luc_den: z.string().nullable().optional(),
  ghi_chu: z.string().optional(),
}).refine(
  (data) => new Date(data.hieu_luc_tu) >= new Date(data.ngay_ban_hanh),
  {
    message: "Ngày hiệu lực không được trước ngày ban hành",
    path: ["hieu_luc_tu"]
  }
)

type CreateDecisionInput = z.infer<typeof createDecisionSchema>

// In dialog component
const form = useForm<CreateDecisionInput>({
  resolver: zodResolver(createDecisionSchema),
  defaultValues: {
    so_quyet_dinh: '',
    ngay_ban_hanh: format(new Date(), 'yyyy-MM-dd'),
    // ...
  }
})
```

---

## 6. Component Architecture Compliance

### ✅ Context Pattern (Principles)

```typescript
// DeviceQuotaContext.tsx

// 1. useMemo on context value
const value = useMemo<DeviceQuotaContextValue>(() => ({
  canManageQuota,
  dialogState,
  openCreateDialog,
  // ...mutations
}), [
  canManageQuota,
  dialogState,
  openCreateDialog,
  // ...deps
])

// 2. useCallback on actions
const openCreateDialog = useCallback(() => {
  setDialogState(prev => ({ ...prev, isCreateOpen: true }))
}, [])

const closeAllDialogs = useCallback(() => {
  setDialogState(initialDialogState)
}, [])

// 3. Local form state in dialogs (not in context)
// See DeviceQuotaCreateDialog.tsx - form state is local
```

### ✅ Zero-Prop Dialogs

```typescript
// DeviceQuotaCreateDialog.tsx

export function DeviceQuotaCreateDialog() {
  // ✅ CORRECT: Consume context, no props
  const {
    dialogState,
    closeAllDialogs,
    createMutation
  } = useDeviceQuotaContext()

  // Local form state
  const form = useForm<CreateDecisionInput>({...})

  return (
    <Dialog open={dialogState.isCreateOpen} onOpenChange={closeAllDialogs}>
      {/* ... */}
    </Dialog>
  )
}

// ❌ WRONG: Props-based dialog
export function DeviceQuotaCreateDialog({
  isOpen,
  onClose,
  onSubmit
}: Props) {
  // Don't do this - use context instead
}
```

---

## 7. Security Priority Compliance

Per CLAUDE.md priority: **1. Security 2. Data Integrity 3. Type Safety 4. Performance 5. Maintainability**

### Implementation Priorities

1. **Security** (Phase 1)
   - RPC functions with tenant isolation
   - Add to ALLOWED_FUNCTIONS whitelist
   - Role-based UI rendering

2. **Data Integrity** (Phase 1)
   - Immutability trigger for published decisions
   - Append-only audit log
   - Version control with `thay_the_cho_id`

3. **Type Safety** (Phase 2)
   - Full TypeScript interfaces
   - Zod validation schemas
   - No `any` types

4. **Performance** (Phase 3)
   - useMemo for tree building
   - Query key invalidation strategy
   - Virtualization for large trees (optional)

5. **Maintainability** (Phase 4)
   - File size limits
   - Grep-friendly naming
   - Consistent patterns

---

## 8. Checklist Summary

### Before Implementation

- [ ] All RPC functions use security template
- [ ] All functions added to ALLOWED_FUNCTIONS
- [ ] TypeScript types defined in `types.ts`
- [ ] File names use `DeviceQuota` prefix

### During Implementation

- [ ] Each file stays under 450 lines
- [ ] No `any` types anywhere
- [ ] All data fetching via TanStack Query
- [ ] Forms use react-hook-form + zod
- [ ] Context uses useMemo/useCallback
- [ ] Dialogs are zero-prop (consume context)

### Before PR

- [ ] `grep DeviceQuota src/` finds all related files
- [ ] Mobile responsive (test at 375px)
- [ ] Accessibility: keyboard navigation works
- [ ] No direct Supabase calls
- [ ] Run typecheck: `node scripts/npm-run.js run typecheck`
- [ ] Run lint: `node scripts/npm-run.js run lint`

---

## 9. Corrected File Structure

Based on CLAUDE.md rules, here is the final compliant structure:

```
src/app/(app)/device-quota/
├── _components/
│   ├── DeviceQuotaContext.tsx           # ~300 lines
│   ├── DeviceQuotaPageClient.tsx        # ~150 lines
│   ├── DeviceQuotaTable.tsx             # ~200 lines
│   ├── DeviceQuotaColumns.tsx           # ~150 lines (extracted)
│   ├── DeviceQuotaTreeTable.tsx         # ~350 lines
│   ├── DeviceQuotaToolbar.tsx           # ~100 lines
│   ├── DeviceQuotaSummaryBar.tsx        # ~80 lines
│   ├── DeviceQuotaCreateDialog.tsx      # ~150 lines
│   ├── DeviceQuotaEditDialog.tsx        # ~150 lines
│   ├── DeviceQuotaActivateDialog.tsx    # ~100 lines
│   ├── DeviceQuotaPublishDialog.tsx     # ~120 lines
│   ├── DeviceQuotaDeleteDialog.tsx      # ~80 lines
│   ├── DeviceQuotaDetailSheet.tsx       # ~200 lines
│   ├── DeviceQuotaDetailInfo.tsx        # ~100 lines (tab content)
│   ├── DeviceQuotaDetailHistory.tsx     # ~150 lines (tab content)
│   ├── DeviceQuotaLineItemDialog.tsx    # ~150 lines
│   ├── DeviceQuotaComplianceSummary.tsx # ~150 lines
│   ├── DeviceQuotaMobileList.tsx        # ~150 lines
│   └── DeviceQuotaMobileAccordion.tsx   # ~200 lines
├── _hooks/
│   ├── useDeviceQuotaContext.ts         # ~20 lines
│   ├── useDeviceQuota.ts                # ~150 lines (TanStack hooks)
│   └── useQuotaTree.ts                  # ~100 lines (tree builder)
├── page.tsx                              # ~30 lines (server entry)
└── types.ts                              # ~100 lines

# Also add to:
src/types/database.ts                     # Add quota table types
src/app/api/rpc/[fn]/route.ts            # Add to ALLOWED_FUNCTIONS
```

**Total: ~25 files, all under 450 lines, all grep-friendly.**
