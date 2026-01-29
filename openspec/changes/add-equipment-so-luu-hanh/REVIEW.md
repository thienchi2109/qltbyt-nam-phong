# Review: Add Equipment `so_luu_hanh` Column

**Date:** 2026-01-29
**Reviewers:** Security Auditor, Frontend Reviewer, Backend Architect
**Status:** APPROVED FOR IMPLEMENTATION

## Proposal Summary
Add Marketing Authorization Number ("Số lưu hành") to equipment records:
- New nullable TEXT column in `public.thiet_bi`
- Show by default in table; hide "Model" and "Vị trí lắp đặt"
- Add to create/edit dialogs, detail view, bulk import

---

## Review Results

### Security Review: APPROVED (Low Risk)
| Category | Risk | Notes |
|----------|------|-------|
| Tenant Isolation | None | Existing RPC architecture maintains isolation |
| Input Validation | Low | Consider VARCHAR(100) for length protection |
| RBAC | None | Existing role checks cover this field |
| Migration | None | Nullable column, no locks |

**Recommendations:**
1. Use `VARCHAR(100)` instead of `TEXT` for length protection
2. Current update pattern cannot clear values to NULL - may need adjustment if required

### Frontend Review: APPROVED (Minor Concerns)

**Issue Found:** Responsive visibility logic conflict in `useEquipmentTable.ts`:
```typescript
// Current: Forces model:true on large screens
if (!isMediumScreen) {
  setColumnVisibility(prev => ({ ...prev, model: true, ... }))
}
```
This will override the new default of hiding `model`. **Must fix during implementation.**

**Files requiring changes:**
| File | Change |
|------|--------|
| `src/types/database.ts` | Add `so_luu_hanh?: string \| null` |
| `src/components/equipment/equipment-table-columns.tsx` | Add to `columnLabels` |
| `src/app/(app)/equipment/_hooks/useEquipmentTable.ts` | Update defaults + fix responsive logic |
| `src/components/add-equipment-dialog.tsx` | Add schema field + form input |
| `src/components/edit-equipment-dialog.tsx` | Add schema field + form input |
| `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx` | Add FormField |
| `src/lib/excel-utils.ts` | Add to `EQUIPMENT_COLUMN_LABELS` |
| `src/components/import-equipment-dialog.tsx` | Add to `headerToDbKeyMap` |

**Auto-updated (no changes needed):**
- Detail view uses `columnLabels` - inherits automatically
- Export uses `columnLabels` - inherits automatically

### Architecture Review: APPROVED

**Key finding:** `equipment_list_enhanced` uses `to_jsonb(tb.*)` - no RPC changes needed for list.

**RPC changes required:**
| Function | Change |
|----------|--------|
| `equipment_create` | Add `so_luu_hanh` to INSERT |
| `equipment_update` | Add `so_luu_hanh` to UPDATE SET |
| Column added | Automatically appears in list response |

---

## Implementation Plan

### Phase 1: Database (Migration)
```sql
BEGIN;
ALTER TABLE public.thiet_bi
ADD COLUMN IF NOT EXISTS so_luu_hanh VARCHAR(100) NULL;

COMMENT ON COLUMN public.thiet_bi.so_luu_hanh IS 'Marketing Authorization Number (Số lưu hành)';
COMMIT;
```

### Phase 2: RPC Updates (Same or Separate Migration)
1. Update `equipment_create` - add to INSERT values
2. Update `equipment_update` - add to UPDATE SET clause

### Phase 3: TypeScript Types
1. `src/types/database.ts` - add field
2. `src/lib/data.ts` - add field (if equipment type defined here)

### Phase 4: UI Components
1. `equipment-table-columns.tsx` - add to columnLabels
2. `useEquipmentTable.ts` - update DEFAULT_COLUMN_VISIBILITY + fix responsive logic
3. `add-equipment-dialog.tsx` - add zod schema + form field
4. `edit-equipment-dialog.tsx` - add zod schema + form field
5. `EquipmentDetailEditForm.tsx` - add form field

### Phase 5: Bulk Import
1. `excel-utils.ts` - add to EQUIPMENT_COLUMN_LABELS
2. `import-equipment-dialog.tsx` - add header mapping

---

## Verification Checklist
- [ ] `npm run typecheck` passes
- [ ] Create equipment with so_luu_hanh value - persists correctly
- [ ] Edit equipment - can update so_luu_hanh
- [ ] Equipment table shows "Số lưu hành" by default, hides Model/Vị trí lắp đặt
- [ ] Column visibility persists across screen size changes (responsive fix verified)
- [ ] Equipment detail view displays the field
- [ ] Bulk import with "Số lưu hành" column works
- [ ] Download template includes the new column

---

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Responsive logic overrides new defaults | Fix in useEquipmentTable.ts during implementation |
| Users miss Model column by default | Column visibility is user-configurable |
| Cannot clear value to NULL once set | Current pattern limitation - acceptable for optional field |

---

## Verdict: APPROVED FOR IMPLEMENTATION

The proposal is well-designed, follows existing patterns, and introduces minimal risk.
