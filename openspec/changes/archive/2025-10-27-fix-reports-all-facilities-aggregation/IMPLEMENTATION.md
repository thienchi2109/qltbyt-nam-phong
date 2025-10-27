# Implementation Summary - Reports "All Facilities" Aggregation

## Status: ✅ Core Implementation Complete

**Implementation Date:** 2025-10-27  
**Estimated Effort:** Phase 1 & 2 completed (~3 days worth of work)  
**Remaining:** Testing and other report tabs

---

## What Was Implemented

### Phase 1: Backend RPCs ✅

#### 1. `equipment_aggregates_for_reports` RPC
**File:** `supabase/migrations/2025-10-27/20251027130000_add_equipment_aggregates_rpc.sql`

**Purpose:** Aggregates equipment statistics across multiple facilities

**Signature:**
```sql
equipment_aggregates_for_reports(
  p_don_vi_array BIGINT[],
  p_khoa_phong TEXT,
  p_date_from DATE,
  p_date_to DATE
) RETURNS JSONB
```

**Returns:**
```json
{
  "totalImported": number,
  "totalExported": number,
  "currentStock": number,
  "netChange": number
}
```

**Security:**
- ✅ Uses `SECURITY DEFINER` with `search_path = public, pg_temp`
- ✅ Validates access via `allowed_don_vi_for_session_safe()`
- ✅ Global/admin: can query all facilities or subset
- ✅ Regional leader: validates against allowed facilities array
- ✅ Other roles: limited to single facility
- ✅ Raises `42501` error for unauthorized access

**Key Features:**
- Efficient single-query aggregation using PostgreSQL COUNT
- Handles both internal transfers and liquidations for exports
- Differentiates between `ngay_ban_giao` (transfers) and `ngay_hoan_thanh` (liquidations)
- NULL facility array means "all allowed" for each role

#### 2. `departments_list_for_facilities` RPC
**File:** `supabase/migrations/2025-10-27/20251027130100_add_departments_list_for_facilities_rpc.sql`

**Purpose:** Lists all departments across multiple facilities

**Signature:**
```sql
departments_list_for_facilities(
  p_don_vi_array BIGINT[]
) RETURNS TABLE(name TEXT, count BIGINT)
```

**Returns:** Table with department name and equipment count

**Security:** Same pattern as equipment_aggregates_for_reports

---

### Phase 2: Frontend Changes ✅

#### 1. `useInventoryData` Hook Update
**File:** `src/app/(app)/reports/hooks/use-inventory-data.ts`

**Changes:**
1. **Multi-facility detection:**
   ```typescript
   const isAllFacilities = tenantFilter === 'all'
   ```

2. **Facilities list fetching:**
   ```typescript
   const { data: facilitiesData } = useQuery({
     queryKey: ['reports-facilities-list'],
     queryFn: async () => {
       const result = await callRpc({ 
         fn: 'get_facilities_with_equipment_count' 
       })
       return result.map(f => f.id)
     },
     enabled: isAllFacilities,
     staleTime: 5 * 60_000,
   })
   ```

3. **Conditional RPC calling:**
   ```typescript
   if (isAllFacilities) {
     // Call aggregate RPCs
     const aggregates = await callRpc({
       fn: 'equipment_aggregates_for_reports',
       args: { p_don_vi_array: facilitiesToQuery, ... }
     })
     
     const deptRows = await callRpc({
       fn: 'departments_list_for_facilities',
       args: { p_don_vi_array: facilitiesToQuery }
     })
     
     return {
       data: [], // No detailed transactions
       summary: { ...aggregates },
       departments: deptRows.map(r => r.name)
     }
   } else {
     // Existing single-facility logic
   }
   ```

4. **Updated cache keys:**
   ```typescript
   queryKey: reportsKeys.inventoryData({
     // ...other filters
     isMultiFacility: isAllFacilities, // NEW
   })
   ```

5. **Query gating:**
   ```typescript
   enabled: effectiveTenantKey !== 'unset' && 
            (!isAllFacilities || (facilitiesData !== undefined))
   ```

#### 2. `InventoryReportTab` Component Update
**File:** `src/app/(app)/reports/components/inventory-report-tab.tsx`

**Changes:**
1. **Hide charts in "all" mode:**
   ```typescript
   {tenantFilter !== 'all' && (
     <InventoryCharts data={data} isLoading={isLoading} />
   )}
   ```

2. **Conditional table rendering:**
   ```typescript
   {tenantFilter === 'all' ? (
     <Card>
       <CardContent>
         <div className="text-center">
           📊
           <h3>Đang hiển thị dữ liệu tổng hợp</h3>
           <p>Bảng chi tiết không khả dụng...</p>
         </div>
       </CardContent>
     </Card>
   ) : (
     <InventoryTable data={data} isLoading={isLoading} />
   )}
   ```

---

## How It Works

### For Regional Leaders

1. User selects "Tất cả cơ sở (vùng)" in dropdown
2. `tenantFilter = 'all'` triggers `isAllFacilities = true`
3. Hook fetches list of allowed facilities via `get_facilities_with_equipment_count`
4. Hook calls `equipment_aggregates_for_reports` with facility array
5. Backend validates facilities against `allowed_don_vi_for_session_safe()`
6. Backend returns aggregated totals across all allowed facilities
7. UI displays aggregated KPIs (Tổng nhập, Tổng xuất, Tồn kho, Biến động)
8. UI shows info message instead of detailed transaction table

### For Global Users

1. User selects "Tất cả đơn vị" in dropdown
2. Same flow as regional leader
3. Backend allows querying ALL facilities (NULL facility check)
4. Returns system-wide aggregated totals

### For Single Facility Selection

1. User selects specific facility (e.g., "Trung tâm Y tế X")
2. `tenantFilter = '123'` (facility ID)
3. `isAllFacilities = false`
4. Hook uses existing detailed query logic
5. Returns full transaction list, charts, and table

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ User Interface (Reports Page)                       │
│                                                     │
│ ┌─────────────────────┐                           │
│ │ Facility Dropdown   │                           │
│ │ ├─ Facility 1       │                           │
│ │ ├─ Facility 2       │                           │
│ │ └─ [Tất cả cơ sở]  │◄─── User selects "all"   │
│ └─────────────────────┘                           │
└──────────────┬──────────────────────────────────────┘
               │
               │ tenantFilter = 'all'
               ▼
┌─────────────────────────────────────────────────────┐
│ useInventoryData Hook                               │
│                                                     │
│ isAllFacilities = true                             │
│                                                     │
│ 1. Fetch facilities list                           │
│    ├─ get_facilities_with_equipment_count()       │
│    └─ Returns: [1, 2, 3, ...]                     │
│                                                     │
│ 2. Call aggregate RPCs                             │
│    ├─ equipment_aggregates_for_reports([1,2,3])   │
│    └─ departments_list_for_facilities([1,2,3])    │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Backend RPCs (Supabase)                            │
│                                                     │
│ equipment_aggregates_for_reports()                 │
│ ├─ Get role and allowed facilities                │
│ ├─ Validate access                                 │
│ ├─ Query: COUNT(*) FROM thiet_bi                  │
│ │         WHERE don_vi = ANY([1,2,3])             │
│ ├─ Query: COUNT(*) FROM transfers                 │
│ │         WHERE don_vi = ANY([1,2,3])             │
│ └─ Return: { totalImported, totalExported, ... }  │
└──────────────┬──────────────────────────────────────┘
               │
               │ Returns aggregated data
               ▼
┌─────────────────────────────────────────────────────┐
│ Component Rendering                                 │
│                                                     │
│ KPI Cards (Show aggregated values)                 │
│ ├─ Tổng nhập: 150 (50+30+70)                      │
│ ├─ Tổng xuất: 45 (20+10+15)                       │
│ ├─ Tồn kho: 380 (100+150+130)                     │
│ └─ Biến động: +105                                 │
│                                                     │
│ Info Message (Instead of table/charts)             │
│ └─ "Đang hiển thị dữ liệu tổng hợp..."           │
└─────────────────────────────────────────────────────┘
```

---

## Security Validation

### ✅ Authorization Checks

1. **Role Detection:**
   ```sql
   v_role := lower(COALESCE(
     public._get_jwt_claim('app_role'), 
     public._get_jwt_claim('role'), 
     ''
   ));
   ```

2. **Allowed Facilities Retrieval:**
   ```sql
   v_allowed := public.allowed_don_vi_for_session_safe();
   ```

3. **Access Validation (Regional Leader):**
   ```sql
   IF p_don_vi_array IS NOT NULL THEN
     SELECT ARRAY_AGG(fid) INTO v_facilities_to_query
     FROM UNNEST(p_don_vi_array) AS fid
     WHERE fid = ANY(v_allowed);
     
     IF v_facilities_to_query IS NULL THEN
       RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
     END IF;
   END IF;
   ```

4. **SQL Injection Prevention:**
   - Uses parameterized queries
   - `SECURITY DEFINER` with `search_path = public, pg_temp`
   - No dynamic SQL construction with user input

---

## Performance Optimization

### ✅ Implemented Optimizations

1. **Single Query Aggregation:**
   - One COUNT query for imports
   - One COUNT query for exports
   - One COUNT query for current stock
   - vs. N queries (one per facility)

2. **Frontend Caching:**
   ```typescript
   staleTime: 5 * 60_000,  // 5 minutes
   gcTime: 5 * 60 * 1000,   // 5 minutes
   ```

3. **Facilities List Caching:**
   - Cached separately with 5-minute staleTime
   - Only fetched when `isAllFacilities = true`

4. **Query Key Differentiation:**
   - Separate cache for single vs multi-facility
   - Prevents cache conflicts

### Expected Performance

- **Single facility:** Same as before (~500ms)
- **All facilities (3-5):** ~800ms - 1.5s
- **All facilities (10+):** ~1.5s - 3s

*Note: Actual performance depends on data volume and database indexes*

---

## Testing Checklist

### Backend Testing

- [ ] Global user with NULL facilities → returns all
- [ ] Global user with specific array → returns filtered
- [ ] Regional leader with NULL → returns allowed only
- [ ] Regional leader with valid array → returns intersection
- [ ] Regional leader with invalid array → raises 42501 error
- [ ] Other roles → limited to single facility
- [ ] Date range filtering works correctly
- [ ] Department filtering works correctly
- [ ] Export count matches manual verification

### Frontend Testing

- [ ] Regional leader selects "all" → shows aggregated KPIs
- [ ] Global user selects "all" → shows system-wide totals
- [ ] KPI cards show correct sums
- [ ] Info message displays instead of table
- [ ] Charts are hidden in "all" mode
- [ ] Switching from "all" to single facility works
- [ ] Switching from single facility to "all" works
- [ ] Cache invalidation works correctly
- [ ] Loading states display properly
- [ ] Error states handled gracefully

### Security Testing

- [ ] Regional leader cannot access unauthorized facilities
- [ ] Error 42501 raised for unauthorized access
- [ ] No data leakage in error messages
- [ ] SQL injection attempts fail safely

---

## Deployment Instructions

### Step 1: Apply Database Migrations

**Using Supabase CLI:**
```bash
# Navigate to project directory
cd D:\qltbyt-nam-phong

# Apply migrations
supabase db push

# Or apply specific migrations
psql -h <host> -U <user> -d <database> -f supabase/migrations/2025-10-27/20251027130000_add_equipment_aggregates_rpc.sql
psql -h <host> -U <user> -d <database> -f supabase/migrations/2025-10-27/20251027130100_add_departments_list_for_facilities_rpc.sql
```

**Verification:**
```sql
-- Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'equipment_aggregates_for_reports',
    'departments_list_for_facilities'
  );

-- Test aggregate function (as global user)
SELECT * FROM equipment_aggregates_for_reports(
  NULL, -- all facilities
  NULL, -- all departments
  '2025-01-01'::date,
  '2025-12-31'::date
);
```

### Step 2: Deploy Frontend Changes

**Build and deploy:**
```bash
# Install dependencies (if needed)
npm install

# Build
npm run build

# Deploy (depends on your deployment method)
npm run deploy
# or
vercel deploy --prod
# or copy build files to server
```

### Step 3: Verify in Production

1. **Login as regional_leader user**
2. **Navigate to Reports page**
3. **Select "Tất cả cơ sở (vùng)"**
4. **Verify:**
   - KPI cards show aggregated values
   - Info message displays
   - No errors in console

5. **Login as global user**
6. **Repeat verification**

### Step 4: Monitor

- Watch for errors in Supabase logs
- Check browser console for frontend errors
- Monitor performance metrics
- Gather user feedback

---

## Rollback Plan

If issues arise:

### Database Rollback
```sql
-- Drop the new functions
DROP FUNCTION IF EXISTS public.equipment_aggregates_for_reports(BIGINT[], TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.departments_list_for_facilities(BIGINT[]);
```

### Frontend Rollback
```bash
# Revert to previous deployment
git revert <commit-hash>
npm run build
npm run deploy
```

### Temporary Disable
Alternatively, temporarily disable "all facilities" option:
```typescript
// In tenant-filter-dropdown.tsx
// Comment out the "all" option
// <SelectItem value="all">{allText}</SelectItem>
```

---

## Known Limitations

1. **No Detailed Transactions in "All" Mode**
   - By design - aggregation only
   - User must select specific facility for details

2. **Charts Hidden in "All" Mode**
   - Timeline charts not meaningful across facilities
   - Can be enhanced in future if needed

3. **Other Tabs Not Updated**
   - Maintenance and Usage tabs still pending
   - Use same pattern when implementing

---

## Future Enhancements

1. **Maintenance Tab Aggregation**
   - Similar RPC: `maintenance_aggregates_for_reports`
   - Aggregate repair counts, status distribution

2. **Usage Analytics Aggregation**
   - Aggregate usage hours across facilities
   - Top equipment by total usage time

3. **Export Functionality**
   - Update export to handle aggregated data
   - Add facility breakdown in exported reports

4. **Performance Monitoring**
   - Add query performance logging
   - Alert if queries exceed 3-second threshold

5. **Caching Strategy**
   - Consider longer cache for aggregates
   - Implement background refresh

---

## Files Modified

### Backend
- ✅ `supabase/migrations/2025-10-27/20251027130000_add_equipment_aggregates_rpc.sql` (NEW)
- ✅ `supabase/migrations/2025-10-27/20251027130100_add_departments_list_for_facilities_rpc.sql` (NEW)

### Frontend
- ✅ `src/app/(app)/reports/hooks/use-inventory-data.ts` (MODIFIED)
- ✅ `src/app/(app)/reports/components/inventory-report-tab.tsx` (MODIFIED)

### Documentation
- ✅ `openspec/changes/fix-reports-all-facilities-aggregation/proposal.md` (NEW)
- ✅ `openspec/changes/fix-reports-all-facilities-aggregation/README.md` (NEW)
- ✅ `openspec/changes/fix-reports-all-facilities-aggregation/IMPLEMENTATION.md` (NEW - this file)

---

## Success Metrics

- [x] Backend RPCs created with proper authorization
- [x] Frontend hook updated with multi-facility support
- [x] UI component adapted for aggregated view
- [x] No breaking changes to existing functionality
- [ ] Testing completed (pending manual QA)
- [ ] Deployment successful (pending)
- [ ] User feedback positive (pending)
- [ ] Performance within acceptable range (pending verification)

---

## Support & Troubleshooting

### Common Issues

**Q: KPI cards show 0 when selecting "all"**
A: Check that facilities list is loading correctly. Verify `get_facilities_with_equipment_count` returns data.

**Q: Error 42501 for regional leader**
A: User's allowed facilities list may be empty or misconfigured. Check `allowed_don_vi_for_session_safe()` return value.

**Q: Slow performance with "all" selected**
A: Check database indexes on `don_vi`, `created_at`, `khoa_phong_quan_ly`. Run `EXPLAIN ANALYZE` on aggregate queries.

**Q: Facility dropdown doesn't show "all" option**
A: Verify user role is `global`, `admin`, or `regional_leader`. Check TenantFilterDropdown component logic.

---

**Implementation completed by:** Claude (Warp AI)  
**Date:** 2025-10-27  
**Review:** Pending user testing and QA
