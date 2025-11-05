# Debug Guide: Transfer Kanban Cards Not Rendering (400 Errors Fixed)

**Status**: Investigating - 400 errors resolved, but cards still not rendering  
**Date**: 2025-11-04

## Current Situation

✅ **Fixed**: 400 Bad Request errors (empty string in JWT claims)  
✅ **Working**: All API calls return 200 OK  
❌ **Issue**: Cards still not rendering in kanban columns

## API Call Log (All Successful)

```
POST /api/rpc/get_transfers_kanban 200 in 369ms
GET /api/transfers/kanban?dateFrom=2025-10-05T13%3A24%3A45.617Z&limit=500 200 in 1099ms

POST /api/rpc/get_transfer_counts 200 in 448ms
GET /api/transfers/counts?dateFrom=2025-10-05T13%3A24%3A45.617Z 200 in 1138ms

GET /api/transfers/kanban?facilityIds=9&limit=500 200 in 715ms
GET /api/transfers/counts?facilityIds=9 200 in 761ms
```

## Diagnostic Steps Added

### Server-Side Logging

**File**: `src/app/api/transfers/kanban/route.ts`

Added console logs to track:
1. RPC response structure (is it an array?)
2. Number of items returned
3. First item structure
4. Grouped counts by status

### Client-Side Logging

**File**: `src/app/(app)/transfers/page.tsx`

Added React useEffect to log:
1. Data received from React Query
2. Structure of `data.transfers` object
3. Count of items in each status column

## What to Check

### 1. Browser Console (Client-Side)

Open browser DevTools Console and look for:

```
[transfers page] Data received: {
  hasData: true/false,
  hasTransfers: true/false,
  cho_duyet: 0,
  da_duyet: 0,
  dang_luan_chuyen: 0,
  da_ban_giao: 0,
  hoan_thanh: 0,
  totalCount: 0
}
```

**Expected**: At least one status should have count > 0 if transfers exist

### 2. Server Console (API Logs)

Check terminal running `npm run dev` for:

```
[kanban API] RPC returned: {
  dataIsArray: true,
  dataLength: 0,  // <-- THIS IS THE KEY
  firstItem: null
}

[kanban API] Grouped transfers: {
  cho_duyet: 0,
  da_duyet: 0,
  dang_luan_chuyen: 0,
  da_ban_giao: 0,
  hoan_thanh: 0,
  totalCount: 0
}
```

## Possible Root Causes

### Hypothesis #1: No Data in Database
**Symptom**: `dataLength: 0` in server logs  
**Cause**: No transfer requests exist in the database  
**Solution**: Create a test transfer request via UI or SQL

### Hypothesis #2: Date Filter Too Restrictive
**Symptom**: `dataLength: 0` with date filter, but > 0 without  
**Cause**: Default 30-day filter (`dateFrom=2025-10-05`) excludes older transfers  
**Solution**: 
- Remove date filter temporarily (clear filters button)
- Adjust default date window in `page.tsx` line 127-130

### Hypothesis #3: Facility Filter Mismatch
**Symptom**: `dataLength: 0` with facility filter, but > 0 without  
**Cause**: Selected facility has no transfer requests  
**Solution**: Try "Tất cả cơ sở" (all facilities) or different facility

### Hypothesis #4: Data Grouping Logic Error
**Symptom**: `dataLength > 0` but grouped counts are all 0  
**Cause**: `transfer.trang_thai` doesn't match kanban column keys  
**Check**: First item's `trang_thai` field value

### Hypothesis #5: RPC Function Returns Wrong Structure
**Symptom**: `dataIsArray: false` or unexpected structure  
**Cause**: RPC function returns single object instead of array  
**Solution**: Check migration file and RPC function signature

## Temporary Workarounds

### Remove Date Filter

Edit `src/app/(app)/transfers/page.tsx` line 127-130:

```typescript
// BEFORE (restrictive 30-day default)
const [filters, setFilters] = React.useState<TransferKanbanFilters>(() => ({
  facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  dateFrom: thirtyDaysAgo.toISOString(), // ❌ Might be too restrictive
  dateTo: undefined,
  limit: 500,
}))

// AFTER (no date filter initially)
const [filters, setFilters] = React.useState<TransferKanbanFilters>(() => ({
  facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  // dateFrom: thirtyDaysAgo.toISOString(), // Commented out
  dateTo: undefined,
  limit: 500,
}))
```

### Check Database Directly

Run in Supabase SQL Editor:

```sql
-- Check if any transfers exist
SELECT COUNT(*) as total_transfers FROM yeu_cau_luan_chuyen;

-- Check recent transfers (last 90 days)
SELECT 
  id,
  ma_yeu_cau,
  trang_thai,
  loai_hinh,
  created_at
FROM yeu_cau_luan_chuyen
WHERE created_at >= NOW() - INTERVAL '90 days'
ORDER BY created_at DESC
LIMIT 10;

-- Check by facility
SELECT 
  tb.don_vi,
  COUNT(*) as transfer_count
FROM yeu_cau_luan_chuyen yclc
INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
GROUP BY tb.don_vi;
```

## Next Steps

1. **Refresh page** and check both client + server console logs
2. **Try different filters**:
   - Remove date filter (click "Xóa tất cả")
   - Try "Tất cả cơ sở" facility option
   - Try removing limit
3. **Share console output** from both browser and server
4. **Verify database has data** using SQL queries above

## Clean Up After Debug

Once issue is identified, **remove debug console.log statements**:
- `src/app/api/transfers/kanban/route.ts` (lines 110-114, 138-145)
- `src/app/(app)/transfers/page.tsx` (lines 150-164)

---

**Investigation Status**: Waiting for console log output to identify root cause
