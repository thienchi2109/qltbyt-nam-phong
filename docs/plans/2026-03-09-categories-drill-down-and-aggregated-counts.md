# Gap Fix: Categories Drill-down + Aggregated Counts

**Goal:** Two tightly-coupled changes on `/device-quota/categories`:
1. **Bug fix:** Intermediate categories (level 2) show `0/-` even when their leaf children have equipment — fix with frontend aggregation
2. **New feature:** Click any category row to drill-down and see its assigned equipment

## UI Preview

![Drill-down mockup](C:\Users\admin\.gemini\antigravity\brain\e47b9b99-4739-43c4-92c3-f0441669178b\categories_drilldown_1773021109615.png)

---

## Bug Analysis: `so_luong_hien_co` for intermediate categories

**Root cause:** SQL computes a flat `LEFT JOIN equipment_counts ON nhom_thiet_bi_id = ct.id` — each category only counts equipment **directly** assigned to it. Since equipment only goes to leaf categories, all intermediate categories always show `0`.

**Current aggregation behavior:**

| Level | Where computed | Correct? |
|-------|---------------|----------|
| Level 1 (group header) | Frontend `CategoryGroup.tsx:145` sums ALL children array items | ✅ Works — [groupByRoot()](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/categories/_components/category-tree-utils.ts#30-59) puts all descendants in `children` |
| Level 2 (intermediate) | Raw SQL value — only direct equipment | ❌ Always 0 for non-leaf |
| Level 3+ (leaf) | Raw SQL value — direct equipment | ✅ Correct |

**Fix approach:** Frontend-only. Build a `Map<categoryId, aggregatedCount>` from the flat category list by summing each node's descendants' `so_luong_hien_co`. No SQL changes needed since the per-leaf counts are correct.

---

## Proposed Changes

### Categories — Utilities

---

#### [MODIFY] [category-tree-utils.ts](file:///d:/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/category-tree-utils.ts) (59 → ~90 lines)

Add a new utility function:

```typescript
/**
 * Build aggregated equipment counts: each category's count = 
 * its own so_luong_hien_co + sum of all descendants' so_luong_hien_co.
 * Works correctly for any tree depth.
 */
export function buildAggregatedCounts(
  categories: CategoryListItem[]
): Map<number, number>
```

**Algorithm:** Bottom-up aggregation using a parent→children map. Since the list is sorted by `sort_path` (depth-first), we iterate in reverse to accumulate leaf-to-root.

---

### Categories — Components

---

#### [NEW] [CategoryAssignedEquipment.tsx](file:///d:/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/CategoryAssignedEquipment.tsx)

Expandable panel showing equipment assigned to a category (and its descendants).

**Key details:**
- Fetches via `callRpc<EquipmentPreviewItem[]>({ fn: 'dinh_muc_thiet_bi_by_nhom', args: { p_nhom_id, p_don_vi } })`
- For intermediate categories: fetches equipment from **each leaf descendant** and merges results
- React Query key: `['dinh_muc_thiet_bi_by_nhom', { nhomId, donViId }]`
- Compact table: Mã TB, Tên thiết bị, Model, Serial, Khoa phòng, Tình trạng
- Read-only (no exclude/restore toggle)
- Subtle panel style: indented, `bg-muted/30`, left accent border
- Shows loading state via [MappingPreviewLoadingState](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/MappingPreviewPrimitives.tsx#69-92)
- Shows empty state when no equipment assigned
- ~120-140 lines

**Reused:**
- [EquipmentPreviewItem](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/MappingPreviewPrimitives.tsx#14-24) type + [MappingPreviewLoadingState](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/MappingPreviewPrimitives.tsx#69-92) from [MappingPreviewPrimitives.tsx](file:///d:/qltbyt-nam-phong/src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx)
- [Badge](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/mapping/_components/MappingPreviewPrimitives.tsx#29-44) from `@/components/ui/badge`
- [callRpc](file:///d:/qltbyt-nam-phong/src/lib/rpc-client.ts#8-34) from [rpc-client.ts](file:///d:/qltbyt-nam-phong/src/lib/rpc-client.ts)

> [!IMPORTANT]
> For **intermediate categories** (non-leaf), the RPC `dinh_muc_thiet_bi_by_nhom` only returns equipment directly linked to that category (which is 0 for intermediate). Two options:
> - **Option A:** Call the RPC for each leaf descendant and merge client-side
> - **Option B:** Fetch only for the clicked category (leaf only), disable drill-down for intermediates and just show aggregated count
>
> **I recommend Option B** for simplicity — only leaf rows are clickable for drill-down. Intermediate rows show the aggregated count badge but have no expand action. This matches the business rule that equipment is only at leaves.

---

#### [MODIFY] [CategoryGroup.tsx](file:///d:/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx) (260 → ~300 lines)

**Changes to [CategoryChildRow](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/categories/_components/CategoryGroup.tsx#29-35):**

```diff
 interface CategoryChildRowProps {
     category: CategoryListItem
     onEdit: (category: CategoryListItem) => void
     onDelete: (category: CategoryListItem) => void
     isMutating: boolean
+    aggregatedCount: number
+    isLeaf: boolean
+    isExpanded: boolean
+    onToggleExpand: (id: number) => void
+    donViId: number | null
 }
```

1. Use `aggregatedCount` instead of `category.so_luong_hien_co` in [QuotaProgressBar](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/categories/_components/QuotaProgressBar.tsx#4-8)
2. Make quota area clickable **only for leaf categories** with `aggregatedCount > 0`
3. Show subtle expand chevron for expandable leaf rows
4. When expanded, render `<CategoryAssignedEquipment>` below the row

**Changes to [CategoryGroup](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/categories/_components/CategoryGroup.tsx#128-135):**

```diff
 interface CategoryGroupProps {
     root: CategoryListItem
     children: CategoryListItem[]
     onEdit: (category: CategoryListItem) => void
     onDelete: (category: CategoryListItem) => void
     mutatingCategoryId: number | null
+    aggregatedCounts: Map<number, number>
+    expandedCategoryId: number | null
+    onToggleExpand: (id: number) => void
+    donViId: number | null
 }
```

1. Pass `aggregatedCounts` to each [CategoryChildRow](file:///d:/qltbyt-nam-phong/src/app/%28app%29/device-quota/categories/_components/CategoryGroup.tsx#29-35)
2. Use aggregated count for root group header progress bar too
3. Determine `isLeaf` for each child (no other categories have `parent_id === child.id`)

---

#### [MODIFY] [DeviceQuotaCategoryTree.tsx](file:///d:/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx) (99 → ~125 lines)

```diff
+import { buildAggregatedCounts } from "./category-tree-utils"

 export function DeviceQuotaCategoryTree() {
-  const { categories, isLoading, ... } = useDeviceQuotaCategoryContext()
+  const { categories, donViId, isLoading, ... } = useDeviceQuotaCategoryContext()
+  const [expandedCategoryId, setExpandedCategoryId] = React.useState<number | null>(null)
+
+  const aggregatedCounts = React.useMemo(
+    () => buildAggregatedCounts(categories),
+    [categories]
+  )
+
+  const handleToggleExpand = React.useCallback((id: number) => {
+    setExpandedCategoryId(prev => prev === id ? null : id)
+  }, [])
```

Pass `aggregatedCounts`, `expandedCategoryId`, `handleToggleExpand`, and `donViId` to each `<CategoryGroup>`.

---

### No Backend Changes Required

> [!NOTE]
> Zero migrations needed. RPC `dinh_muc_thiet_bi_by_nhom` is already deployed and [whitelisted](file:///d:/qltbyt-nam-phong/src/app/api/rpc/[fn]/route.ts#L145). The aggregation fix is frontend-only.

---

## Verification Plan

### Automated Tests

| File | Scope |
|------|-------|
| `categories/__tests__/category-tree-utils.test.ts` | `buildAggregatedCounts` — 3-level tree, single level, empty tree |
| `categories/__tests__/CategoryAssignedEquipment.test.tsx` | Loading state, equipment table render, empty state, read-only |

```bash
npx vitest run src/app/(app)/device-quota/categories/__tests__/
```

### Manual Verification

1. Assign some devices to leaf categories via `/device-quota/mapping`
2. Navigate to `/device-quota/categories`
3. Verify level 2 intermediate categories show **aggregated** count (sum of leaf children)
4. Verify level 1 group header shows correct total
5. Click a **leaf** category with equipment → drill-down panel expands
6. Verify equipment table: Mã TB, Tên, Model, Serial, Khoa phòng, Tình trạng
7. Click again → collapse
8. Intermediate categories (level 2) → no expand chevron (count only)
9. Leaf with 0 equipment → no expand chevron
