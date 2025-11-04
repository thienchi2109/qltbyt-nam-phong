# Investigation: Transfer Kanban Cards Not Rendering

**Date**: 2025-11-04  
**Status**: ACTIVE INVESTIGATION  
**Severity**: P0 - Critical Bug

---

## Timeline of Investigation

### Issue #1: 400 Bad Request Errors (FIXED ✅)

**Symptom**: All RPC calls failing with 400 errors
```
invalid input syntax for type bigint: ""
```

**Root Cause**: RPC proxy was passing empty string `''` for `don_vi` instead of `null` for global users.

**Fix**: `src/app/api/rpc/[fn]/route.ts` line 147-150
```typescript
// BEFORE
don_vi: donVi,        // Empty string for global users
dia_ban: diaBan,      // Empty string for global users

// AFTER
don_vi: donVi || null,     // ✅ Convert empty string to null
dia_ban: diaBan || null,   // ✅ Convert empty string to null
```

**Result**: ✅ All APIs now return 200 OK

---

### Issue #2: Counts API Fallback Bug (FIXED ✅)

**Symptom**: Fallback logic discarding RPC response data

**Fix**: `src/app/api/transfers/counts/route.ts` line 123
```typescript
// BEFORE
let row = usedLegacyFallback ? undefined : data[0]  // ❌ Discards data

// AFTER
let row = data[0]  // ✅ Always use returned data
```

**Result**: ✅ Counts API working correctly

---

### Issue #3: Cards Not Rendering Despite Successful Data Flow (ACTIVE ❌)

**Symptom**: 
- Badge shows count: 2 ✅
- All APIs return 200 OK ✅
- No cards visible in kanban columns ❌

## Data Flow Analysis

### ✅ STEP 1: Server API Layer (WORKING)

**File**: `src/app/api/transfers/kanban/route.ts`

**Logs**:
```
[kanban API] RPC returned: {
  dataIsArray: true,
  dataLength: 2,           // ✅ Server has data
  firstItem: {
    id: 7,
    ma_yeu_cau: 'YCLC-20251104-8',
    trang_thai: 'cho_duyet',
    ...
  }
}

[kanban API] Grouped transfers: {
  cho_duyet: 2,            // ✅ Correctly grouped
  da_duyet: 0,
  ...
}
```

**Conclusion**: Server correctly fetches and groups data

---

### ✅ STEP 2: React Query Fetch Function (WORKING)

**File**: `src/hooks/useTransfersKanban.ts`

**Logs**:
```
[useTransfersKanban] Fetch returned: {
  hasData: true,
  hasTransfers: true,
  transferKeys: ['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh'],
  cho_duyet_length: 2,     // ✅ Fetch function has data
  totalCount: 2
}
```

**Conclusion**: Fetch function correctly parses API response

---

### ✅ STEP 3: React Component Receives Data (WORKING)

**File**: `src/app/(app)/transfers/page.tsx`

**Logs**:
```
[RENDER] cho_duyet column: {
  hasData: true,
  hasTransfers: true,
  columnTransfers_isArray: true,
  columnTransfers_length: 2,    // ✅ Component has data
  firstTransfer: {
    id: 7,
    ma_yeu_cau: 'YCLC-20251104-8',
    trang_thai: 'cho_duyet',
    ...
  }
}
```

**Conclusion**: Page component receives correct data

---

### ✅ STEP 4: VirtualizedKanbanColumn Receives Data (WORKING)

**File**: `src/components/transfers/VirtualizedKanbanColumn.tsx`

**Logs**:
```
[VirtualizedKanbanColumn] Rendering with: {
  transfersLength: 2,           // ✅ Virtualization has data
  density: 'compact',
  firstTransfer: 7
}

[VirtualizedKanbanColumn] AutoSizer dimensions: {
  height: 384,                  // ✅ Valid dimensions
  width: 296
}

[VirtualizedKanbanColumn] Rendering row: 0 7  // ✅ Row rendering called
[VirtualizedKanbanColumn] Rendering row: 1 5  // ✅ Row rendering called
```

**Conclusion**: Virtualization component working correctly

---

### ✅ STEP 5: renderCard Function Called (WORKING)

**File**: `src/app/(app)/transfers/page.tsx` (renderCard callback)

**Logs**:
```
[renderCard] Called for transfer: 7          // ✅ Called
[renderCard] Normalized successfully         // ✅ No errors
[renderCard] Card created successfully       // ✅ JSX created

[renderCard] Called for transfer: 5          // ✅ Called
[renderCard] Normalized successfully         // ✅ No errors
[renderCard] Card created successfully       // ✅ JSX created
```

**Conclusion**: renderCard successfully creates TransferCard JSX elements

---

### ❌ STEP 6: TransferCard Component (BROKEN - NO LOGS)

**File**: `src/components/transfers/TransferCard.tsx`

**Expected Logs**:
```
[TransferCard] Rendering card for: 7
[TransferCard] After normalization: YCLC-20251104-8 density: compact
[TransferCard] Returning COMPACT card
```

**Actual**: **NO LOGS APPEAR** ❌

**Conclusion**: TransferCard component is **NOT being rendered** despite JSX being created

---

## Critical Finding

**The Problem is Between Steps 5 and 6:**

1. ✅ `renderCard()` successfully creates `<TransferCard />` JSX
2. ✅ No errors thrown (try/catch in renderCard catches nothing)
3. ❌ TransferCard component never executes (no console logs)

**This means**: React is **not mounting the TransferCard component** even though the JSX element exists.

---

## Possible Root Causes

### Hypothesis #1: React Window API Mismatch

**Issue**: The `rowComponent` prop might not match the expected API.

**Evidence**:
```typescript
// VirtualizedKanbanColumn.tsx
<List
  rowComponent={RowComponent}  // Passing component
  rowProps={{}}
  ...
/>
```

**Check**: Verify `react-window` version and API compatibility.

### Hypothesis #2: Key Prop Conflict

**Issue**: The `key={transfer.id}` might be causing React to not render.

**Evidence**:
```typescript
<TransferCard
  key={transfer.id}  // Might conflict with virtualization
  transfer={transfer as any}
  ...
/>
```

**Fix Attempt**: Remove `key` prop since virtualization handles keys.

### Hypothesis #3: Module Resolution Issue

**Issue**: TransferCard import might be broken.

**Check**:
```typescript
// page.tsx
import { TransferCard } from "@/components/transfers/TransferCard"
```

**Verify**: Confirm import is correct and module exists.

### Hypothesis #4: Component Return Type Issue

**Issue**: TransferCard might be returning `null` or `undefined` silently.

**Check**: Add console.log BEFORE every return statement in TransferCard.

### Hypothesis #5: CSS Display Issue

**Issue**: Cards are rendered but invisible (CSS `display: none`, `opacity: 0`, etc.)

**Check**: Inspect DOM in browser Elements tab to see if cards exist.

---

## Debug Logs Added

### Files Modified for Debugging

1. **src/app/api/transfers/kanban/route.ts**
   - Lines 110-114: RPC response logging
   - Lines 138-145: Grouped transfers logging

2. **src/hooks/useTransfersKanban.ts**
   - Lines 81-88: Fetch function return logging

3. **src/app/(app)/transfers/page.tsx**
   - Lines 150-164: Data received logging
   - Lines 661-670: Render column logging
   - Lines 693-716: renderCard error handling

4. **src/components/transfers/VirtualizedKanbanColumn.tsx**
   - Lines 24-28: Component props logging
   - Line 33: Row rendering logging
   - Lines 53-54: AutoSizer dimensions logging

5. **src/components/transfers/TransferCard.tsx**
   - Line 50: Component entry logging
   - Line 55: Post-normalization logging
   - Line 63: Return statement logging

---

## Next Steps

### Immediate Actions

1. **Check Browser Console** for TransferCard logs
   - If NO logs: Component not mounting (React issue)
   - If logs appear: Component rendering but invisible (CSS issue)

2. **Inspect DOM Elements Tab**
   - Navigate to kanban column in Elements inspector
   - Search for `class="mb-3 shadow-sm"` (Card wrapper)
   - Check if cards exist in DOM but are hidden

3. **Test Key Prop Removal**
   - Remove `key={transfer.id}` from TransferCard
   - Virtualization should handle keys internally

4. **Verify Import Path**
   - Check if TransferCard is actually imported
   - Try adding `console.log('TransferCard module loaded')` at module level

5. **Check React Error Boundaries**
   - Look for React errors in console (red text)
   - Check if error boundary is catching renders

### If TransferCard Logs Don't Appear

**Action**: The component is not mounting - this is a React rendering issue.

**Potential Fixes**:
1. Remove `key` prop from TransferCard in renderCard
2. Check react-window List API compatibility
3. Verify rowComponent signature matches expected type
4. Try returning a simple `<div>` instead of TransferCard to isolate issue

### If TransferCard Logs DO Appear

**Action**: Cards are rendering but invisible - this is a CSS/layout issue.

**Potential Fixes**:
1. Inspect computed styles in Elements tab
2. Check for `display: none`, `opacity: 0`, `height: 0`
3. Check parent container overflow/clipping
4. Verify z-index stacking

---

## Environment Info

- **Browser**: Unknown
- **React Version**: 18
- **Next.js**: 15
- **react-window**: Check package.json
- **react-virtualized-auto-sizer**: Check package.json

---

## Summary

**What Works**:
- ✅ Data fetching (API, React Query, Component state)
- ✅ Data transformation and grouping
- ✅ Virtualization setup (AutoSizer, List, RowComponent)
- ✅ renderCard function execution
- ✅ JSX element creation

**What Doesn't Work**:
- ❌ TransferCard component rendering/mounting

**Critical Mystery**:
- renderCard creates `<TransferCard />` successfully
- NO errors thrown
- But TransferCard's function body NEVER executes

**Most Likely Cause**:
- react-window `rowComponent` API mismatch
- OR Key prop conflict with virtualization
- OR Component import/export issue

---

**Last Updated**: 2025-11-04  
**Investigator**: Droid  
**Status**: Awaiting browser console logs for TransferCard component
