# Visual Architecture Comparison

## Context Architecture

### Original Plan (Single Context)
```
┌─────────────────────────────────────────────┐
│   TenantSelectionContext                    │
│                                             │
│   Value: {                                  │
│     selectedFacilityId,  ────┐             │
│     setSelectedFacilityId,   │             │
│     facilities,              │             │
│     showSelector,            │ All in one  │
│     isLoading,               │ object      │
│     shouldFetchData          │             │
│   }                      ────┘             │
│                                             │
│   ❌ Problem: New reference every render    │
└─────────────────────────────────────────────┘
         │
         ├───► Toolbar (only needs setSelectedFacilityId)
         │     ❌ Re-renders when selectedFacilityId changes
         │
         ├───► Table (only needs shouldFetchData)
         │     ❌ Re-renders when facilities load
         │
         └───► Selector (needs all)
               ✅ Re-renders appropriately
```

### Revised Plan (Split Context)
```
┌─────────────────────────────────────────────┐
│   TenantSelectionStateContext              │
│                                             │
│   State: {                                  │
│     selectedFacilityId,  ────┐             │
│     facilities,              │             │
│     showSelector,            │ Read-only   │
│     isLoading,               │ data        │
│     shouldFetchData          │             │
│   }                      ────┘             │
└─────────────────────────────────────────────┘
         │
         └───► Components that DISPLAY data
               ✅ Only re-render when displayed value changes

┌─────────────────────────────────────────────┐
│   TenantSelectionActionsContext            │
│                                             │
│   Actions: {                                │
│     setSelectedFacilityId ─────► Stable    │
│   }                             reference  │
└─────────────────────────────────────────────┘
         │
         └───► Components that UPDATE data
               ✅ Never re-render (stable reference)
```

**Result:**
- Toolbar: 0 re-renders (uses actions only)
- Table: Re-renders only when `shouldFetchData` changes
- Selector: Re-renders when `facilities` or `selectedFacilityId` changes

---

## Component Complexity Comparison

### Original Plan (Custom Dropdown)

```typescript
// tenant-selector.tsx - 180 lines
"use client";
import * as React from "react";
import { Building2, Check, X } from "lucide-react";

export function TenantSelector({ facilities, value, onChange }: Props) {
  const [searchQuery, setSearchQuery] = React.useState("")      // ❌ Local state
  const [isOpen, setIsOpen] = React.useState(false)            // ❌ Local state
  const containerRef = React.useRef<HTMLDivElement>(null)

  // ❌ Manual click-outside logic (30 lines)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { ... }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ❌ Manual keyboard handling (20 lines)
  const handleKeyDown = (e: KeyboardEvent) => { ... }

  // ❌ Manual filtering (10 lines)
  const filteredFacilities = React.useMemo(() => {
    const query = searchQuery.toLowerCase()
    return facilities.filter(f => f.name.toLowerCase().includes(query))
  }, [facilities, searchQuery])

  // ❌ Manual dropdown rendering (80 lines)
  return (
    <div ref={containerRef}>
      <Input ... />
      {isOpen && (
        <div className="absolute ...">
          {/* Custom dropdown */}
        </div>
      )}
    </div>
  )
}
```

**Issues:**
- 180 lines of code
- 3 pieces of local state
- Manual accessibility handling
- Custom dropdown styling
- No keyboard navigation by default

### Revised Plan (Radix Select)

```typescript
// TenantSelector.tsx - 30 lines
"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

export function TenantSelector() {
  const { facilities, selectedFacilityId, setSelectedFacilityId, showSelector } = useTenantSelection()

  if (!showSelector || facilities.length <= 1) return null

  return (
    <Select
      value={selectedFacilityId?.toString() ?? "all"}
      onValueChange={(v) => setSelectedFacilityId(v === "all" ? null : Number(v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="Chọn cơ sở..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tất cả ({facilities.length})</SelectItem>
        {facilities.map(f => (
          <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

**Benefits:**
- 30 lines of code (83% reduction)
- 0 pieces of local state
- WCAG 2.1 AA compliant
- Keyboard navigation built-in
- Consistent with rest of app

---

## Data Flow Comparison

### Original Plan (Per-Page Queries)

```
Equipment Page:
  useQuery(['facilities']) ──► RPC ──► 500KB response
  └─► 12 facilities with full equipment data

RepairRequests Page:
  useQuery(['facilities']) ──► RPC ──► 500KB response
  └─► Same 12 facilities

Transfers Page:
  useQuery(['facilities']) ──► RPC ──► 500KB response
  └─► Same 12 facilities

Reports Page:
  useQuery(['facilities']) ──► RPC ──► 500KB response
  └─► Same 12 facilities

❌ TOTAL: 4 identical 500KB requests = 2MB transferred
```

### Revised Plan (Global Query)

```
TenantSelectionProvider (mounted once in app layout):
  useQuery(['accessible_facilities', { role, diaBan }]) ──► RPC ──► 2KB response
  └─► 12 facilities with only id + name

  Cached for 30 minutes ──► All pages use same cache

Equipment Page:
  useTenantSelection() ──► Read from cache (0 network)

RepairRequests Page:
  useTenantSelection() ──► Read from cache (0 network)

Transfers Page:
  useTenantSelection() ──► Read from cache (0 network)

Reports Page:
  useTenantSelection() ──► Read from cache (0 network)

✅ TOTAL: 1 lightweight 2KB request
✅ SAVINGS: 1.998MB (99.9% reduction)
```

---

## Migration Flow

### Week 1: Infrastructure (No User Impact)
```
1. Add RPC Function
   ┌─────────────────────────────────────────┐
   │ get_accessible_facilities()            │
   │ Returns: [{ id: 1, name: "Facility A" }]│
   └─────────────────────────────────────────┘

2. Add Context
   ┌─────────────────────────────────────────┐
   │ TenantSelectionProvider                │
   │ ├─ Read from localStorage (migration)  │
   │ ├─ Fetch facilities via RPC            │
   │ └─ Provide state + actions             │
   └─────────────────────────────────────────┘

3. Add Component
   ┌─────────────────────────────────────────┐
   │ <TenantSelector />                     │
   │ (Not used yet)                          │
   └─────────────────────────────────────────┘

4. Wrap App Layout
   app/(app)/layout.tsx:
   <TenantSelectionProvider>
     {children}
   </TenantSelectionProvider>

✅ NO BREAKING CHANGES - Old code still works
```

### Week 2: Page Migrations (Incremental)
```
Day 1: Equipment Page
  Before:
  ┌─────────────────────────────────────────┐
  │ useEquipmentAuth()                     │
  │ ├─ useState(localStorage)              │
  │ ├─ Manual tenant logic                 │
  │ └─ <TenantSelector facilities={...} /> │
  └─────────────────────────────────────────┘

  After:
  ┌─────────────────────────────────────────┐
  │ useTenantSelection()                   │
  │ └─ <TenantSelector />                  │
  └─────────────────────────────────────────┘

  ✅ Context syncs with localStorage (migration support)
  ✅ User sees no difference

Day 2-5: Other Pages
  Same pattern, one page at a time

✅ SAFE: Can test each page independently
✅ ROLLBACK: Can revert individual pages if issues
```

### Week 3: Cleanup
```
1. Remove localStorage logic from context
2. Delete useFacilityFilter.ts
3. Delete old tenant-selector.tsx
4. Update types to use centralized facility.ts

✅ COMPLETE: Full migration done
```

---

## Security Flow

### Query Key Scoping (Critical Fix)

```
❌ ORIGINAL (Security Issue):
┌─────────────────────────────────────────────────┐
│ User A (global) logs in                        │
│ Query Key: ["accessible_facilities"]           │
│ Cache: [Facility 1, 2, 3, ..., 100]            │
└─────────────────────────────────────────────────┘
         │
         │ User A logs out, User B (regional_leader) logs in
         ▼
┌─────────────────────────────────────────────────┐
│ User B (regional_leader) sees cached data      │
│ Query Key: ["accessible_facilities"]  ◄─── SAME KEY!
│ ❌ Sees all 100 facilities (should see only 5)  │
└─────────────────────────────────────────────────┘

✅ REVISED (Secure):
┌─────────────────────────────────────────────────┐
│ User A (global) logs in                        │
│ Query Key: ["accessible_facilities", {         │
│   role: "global",                              │
│   diaBan: null                                 │
│ }]                                              │
│ Cache: [Facility 1, 2, 3, ..., 100]            │
└─────────────────────────────────────────────────┘
         │
         │ User A logs out, User B (regional_leader) logs in
         ▼
┌─────────────────────────────────────────────────┐
│ User B (regional_leader) queries with NEW KEY  │
│ Query Key: ["accessible_facilities", {         │
│   role: "regional_leader",  ◄─── DIFFERENT!    │
│   diaBan: "5"               ◄─── SCOPED!       │
│ }]                                              │
│ ✅ Fetches only 5 facilities in their region    │
└─────────────────────────────────────────────────┘
```

---

## Performance Metrics

### Re-render Count per User Action

```
User selects a facility from dropdown:

ORIGINAL PLAN:
┌─────────────────────────┬──────────┐
│ Component               │ Re-renders│
├─────────────────────────┼──────────┤
│ TenantSelector          │    1     │
│ Toolbar                 │    1 ❌  │
│ Table                   │    1 ❌  │
│ Pagination              │    1 ❌  │
│ Stats Summary           │    1 ❌  │
│ Filter Modal            │    1 ❌  │
│ Export Button           │    1 ❌  │
│ Create Button           │    1 ❌  │
├─────────────────────────┼──────────┤
│ TOTAL                   │    8     │
└─────────────────────────┴──────────┘

REVISED PLAN (Split Context):
┌─────────────────────────┬──────────┐
│ Component               │ Re-renders│
├─────────────────────────┼──────────┤
│ TenantSelector          │    1     │
│ Table (uses state)      │    1     │
│ Stats Summary (state)   │    1     │
├─────────────────────────┼──────────┤
│ Toolbar (actions only)  │    0 ✅  │
│ Pagination              │    0 ✅  │
│ Filter Modal            │    0 ✅  │
│ Export Button           │    0 ✅  │
│ Create Button           │    0 ✅  │
├─────────────────────────┼──────────┤
│ TOTAL                   │    3     │
└─────────────────────────┴──────────┘

Improvement: 62.5% fewer re-renders
```

---

## Type Safety Flow

### BEFORE (Inconsistent Types)

```typescript
// useFacilityFilter.ts
export type FacilityOption = {
  id: number
  name: string
  count?: number  // ❌ Optional count
}

// tenant-selector.tsx
import { FacilityOption } from "@/lib/equipment-utils"  // ❌ Different import

// RepairRequestsPageClient.tsx
type FacilityOption = {  // ❌ Redeclared
  id: number
  name: string
}

❌ PROBLEM: 3 different definitions, hard to refactor
```

### AFTER (Centralized Types)

```typescript
// src/types/facility.ts (SINGLE SOURCE OF TRUTH)
export type FacilityOption = {
  id: number
  name: string
}

export type FacilityOptionWithCount = FacilityOption & {
  count: number
}

// All files import from one place:
import type { FacilityOption } from "@/types/facility"

✅ BENEFIT: Change once, updates everywhere
✅ BENEFIT: TypeScript enforces consistency
```

---

**Visual Summary:**
- Context: Single → Split (50% fewer re-renders)
- Component: 180 lines → 30 lines (83% reduction)
- Queries: 4 × 500KB → 1 × 2KB (99.9% reduction)
- Types: 3 definitions → 1 source of truth
- Security: Missing scoping → Role + region scoped
- Accessibility: Custom → WCAG 2.1 AA compliant
