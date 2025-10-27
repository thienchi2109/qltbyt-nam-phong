# Fix Reports "All Facilities" Aggregation

## Problem Statement

### Current Behavior
When regional_leader or global users select "Tất cả cơ sở (vùng)" / "Tất cả đơn vị" (all facilities) option in the Reports page facility filter, the KPI cards (Tổng nhập, Tổng xuất, Tồn kho, Biến động) display incorrect values. 

**Root Cause Analysis:**
After deep analysis of the code flow, I identified the following issues:

1. **Frontend Logic (page.tsx, lines 119-133)**
   - When `tenantFilter === 'all'`, `shouldFetchReports` is `true` ✅
   - However, `selectedDonVi` is computed as `null` when filter is 'all' (line 128)
   - This `null` is passed down to all child components and hooks

2. **Data Fetching Hooks**
   - `useInventoryData` receives `selectedDonVi = null` when 'all' is selected
   - It passes this to backend RPCs like `equipment_list_for_reports`, `equipment_count_enhanced`, `transfer_request_list_enhanced`
   
3. **Backend RPC Behavior (20251013180000_fix_inventory_rpcs_regional_leader.sql)**
   - When `p_don_vi IS NULL`:
     - For `global` role: Sets `v_effective_donvi := NULL` (line 41)
     - For `regional_leader` role: Falls back to primary facility only (line 62)
   
4. **SQL Query Execution**
   - When `v_effective_donvi IS NULL`, queries use:
     ```sql
     WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
     ```
   - This evaluates to `WHERE (TRUE OR ...)` which returns ALL facilities globally ✅
   - **BUT** for regional_leader with `p_don_vi = NULL`, it only queries ONE facility ❌

### Impact
- **Global users**: When selecting "all", they get data from ALL facilities (correct, but should aggregate properly)
- **Regional leader users**: When selecting "all", they only get data from their PRIMARY facility instead of all region facilities
- **Both roles**: KPI cards don't show proper aggregated sums across multiple facilities

### Example Scenario
Regional leader manages facilities [1, 2, 3]:
- Facility 1: 50 imports, 20 exports, 100 stock
- Facility 2: 30 imports, 10 exports, 80 stock  
- Facility 3: 20 imports, 15 exports, 60 stock

**Expected when "all" selected:**
- Tổng nhập: 100 (50+30+20)
- Tổng xuất: 45 (20+10+15)
- Tồn kho: 240 (100+80+60)

**Actual behavior:**
- Shows only Facility 1 data (primary facility)
- Tổng nhập: 50
- Tổng xuất: 20
- Tồn kho: 100

## Solution Architecture

### High-Level Approach
Implement proper multi-facility aggregation when "all facilities" is selected, distinguishing between:
1. **Regional leader**: Aggregate across all allowed facilities in region
2. **Global users**: Aggregate across all facilities in the system

### Design Decisions

#### Option A: Frontend Aggregation (NOT RECOMMENDED)
- Fetch data for each facility separately
- Aggregate in frontend
- **Cons**: Multiple RPC calls, slow performance, complex logic

#### Option B: Backend Aggregation (RECOMMENDED) ✅
- Modify backend RPCs to handle "all facilities" case
- Return aggregated results in single query
- **Pros**: Single RPC call, better performance, cleaner code

### Technical Strategy

#### 1. Backend RPC Modifications

##### A. New Aggregate RPCs (RECOMMENDED)
Create specialized aggregate functions:

```sql
-- equipment_aggregates_for_reports(p_don_vi BIGINT[], ...)
-- Returns: { totalImported, totalExported, currentStock }
-- Handles array of facilities for efficient aggregation

-- transfer_aggregates_for_reports(p_don_vi BIGINT[], ...)  
-- Returns aggregated transfer statistics
```

**Benefits:**
- Purpose-built for aggregation
- Efficient SQL GROUP BY operations
- Clean separation of concerns
- No breaking changes to existing RPCs

##### B. Modify Existing RPCs (ALTERNATIVE)
Update existing functions to accept facility array:

```sql
-- equipment_list_for_reports(p_don_vi BIGINT[] | BIGINT, ...)
-- Handle both single facility and array input
```

**Concerns:**
- Breaking changes to existing API
- More complex function signatures
- Backward compatibility issues

**Decision: Use Option A (New Aggregate RPCs)**

#### 2. Frontend Changes

##### A. Update Query Keys
Modify cache keys to distinguish between single vs multi-facility queries:

```typescript
// Before
tenant: effectiveTenantKey || 'auto'

// After  
tenant: effectiveTenantKey || 'auto',
isMultiFacility: tenantFilter === 'all'
```

##### B. Conditional Data Fetching
Add logic to detect "all facilities" and call appropriate RPC:

```typescript
// In useInventoryData hook
const isAllFacilities = tenantFilter === 'all'
const facilitiesToQuery = isAllFacilities ? allowedFacilities : [selectedDonVi]

if (isAllFacilities) {
  // Call aggregate RPC
  const aggregates = await callRpc({ 
    fn: 'equipment_aggregates_for_reports',
    args: { p_don_vi_array: facilitiesToQuery, ... }
  })
} else {
  // Existing single-facility logic
  const equipment = await callRpc({
    fn: 'equipment_list_for_reports', 
    args: { p_don_vi: selectedDonVi, ... }
  })
}
```

##### C. Get Allowed Facilities List
Need to retrieve list of allowed facilities for regional_leader:

```typescript
// Can reuse existing facility dropdown data
const { data: facilities } = useQuery({
  queryKey: ['reports-facilities'],
  queryFn: async () => {
    const result = await callRpc({ 
      fn: 'get_facilities_with_equipment_count' 
    })
    return result.map(f => f.id)
  }
})
```

#### 3. Data Flow Changes

##### Current Flow (Single Facility)
```
User selects facility → selectedDonVi=123 → RPC(p_don_vi=123) → Single facility data
```

##### New Flow (All Facilities - Regional Leader)
```
User selects "all" → Get allowed facilities [1,2,3] → 
  RPC(p_don_vi_array=[1,2,3]) → Aggregated data
```

##### New Flow (All Facilities - Global)
```  
User selects "all" → Get all facilities (or pass NULL for global query) →
  RPC(p_don_vi_array=NULL) → Global aggregated data
```

## Implementation Plan

### Phase 1: Backend - Create Aggregate RPCs

#### Task 1.1: Create equipment_aggregates_for_reports
**File:** `supabase/migrations/YYYY-MM-DD/NNNN_add_equipment_aggregates_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.equipment_aggregates_for_reports(
  p_don_vi_array BIGINT[] DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_facilities_to_query BIGINT[];
  v_result JSONB;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(
    public._get_jwt_claim('app_role'), 
    public._get_jwt_claim('role'), 
    ''
  ));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine facilities to query
  IF v_role = 'global' THEN
    -- Global: query all facilities if array not provided
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      -- Query all facilities globally
      v_facilities_to_query := NULL;
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
    
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate and restrict to allowed facilities
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return zeros
      RETURN jsonb_build_object(
        'totalImported', 0,
        'totalExported', 0,
        'currentStock', 0,
        'netChange', 0
      );
    END IF;
    
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      -- Query all allowed facilities
      v_facilities_to_query := v_allowed;
    ELSE
      -- Validate requested facilities are within allowed set
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);
      
      IF v_facilities_to_query IS NULL OR 
         array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    
  ELSE
    -- Other roles: limited to their single facility
    v_facilities_to_query := ARRAY[
      NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT
    ];
  END IF;
  
  -- 3. Execute aggregation query
  WITH imported_equipment AS (
    SELECT COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_date_from IS NULL OR DATE(tb.created_at) >= p_date_from)
      AND (p_date_to IS NULL OR DATE(tb.created_at) <= p_date_to)
  ),
  current_stock AS (
    SELECT COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
  )
  SELECT jsonb_build_object(
    'totalImported', COALESCE((SELECT count FROM imported_equipment), 0),
    'currentStock', COALESCE((SELECT count FROM current_stock), 0),
    'totalExported', 0,  -- Will be calculated from transfers
    'netChange', COALESCE((SELECT count FROM imported_equipment), 0)
  )
  INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(
  BIGINT[], TEXT, DATE, DATE
) TO authenticated;

COMMENT ON FUNCTION public.equipment_aggregates_for_reports IS
'Returns aggregated equipment statistics across multiple facilities.
For regional_leader: aggregates across allowed facilities.
For global: aggregates across all or specified facilities.';
```

#### Task 1.2: Create transfer_aggregates_for_reports
Similar structure to Task 1.1, but for transfer/export aggregation.

#### Task 1.3: Update departments_list_for_tenant  
Modify to support facility array for multi-facility department listing.

### Phase 2: Frontend - Hook Modifications

#### Task 2.1: Update useInventoryData Hook
**File:** `src/app/(app)/reports/hooks/use-inventory-data.ts`

```typescript
export function useInventoryData(
  dateRange: DateRange,
  selectedDepartment: string,
  searchTerm: string,
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  // NEW: Determine if this is multi-facility query
  const isAllFacilities = tenantFilter === 'all'
  
  // NEW: Get allowed facilities for regional leader
  const { data: facilitiesData } = useQuery({
    queryKey: ['reports-facilities-list'],
    queryFn: async () => {
      const result = await callRpc<any>({ 
        fn: 'get_facilities_with_equipment_count', 
        args: {} 
      })
      return Array.isArray(result) ? result.map((f: any) => f.id) : []
    },
    enabled: isAllFacilities,
    staleTime: 5 * 60_000,
  })
  
  const queryKey = reportsKeys.inventoryData({
    dateRange: {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to, 'yyyy-MM-dd')
    },
    selectedDepartment,
    searchTerm,
    tenant: effectiveTenantKey || 'auto',
    isMultiFacility: isAllFacilities,  // NEW: cache key differentiation
  })
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd')
      const toDate = format(dateRange.to, 'yyyy-MM-dd')
      
      if (isAllFacilities) {
        // NEW: Multi-facility aggregation path
        const facilitiesToQuery = facilitiesData || []
        
        // Call aggregate RPC
        const aggregates = await callRpc<any>({
          fn: 'equipment_aggregates_for_reports',
          args: {
            p_don_vi_array: facilitiesToQuery.length > 0 ? facilitiesToQuery : null,
            p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null,
            p_date_from: fromDate,
            p_date_to: toDate,
          },
        })
        
        // Get transfer aggregates
        const transferAggregates = await callRpc<any>({
          fn: 'transfer_aggregates_for_reports',
          args: {
            p_don_vi_array: facilitiesToQuery.length > 0 ? facilitiesToQuery : null,
            p_khoa_phong: selectedDepartment !== 'all' ? selectedDepartment : null,
            p_date_from: fromDate,
            p_date_to: toDate,
          },
        })
        
        // Get departments across facilities
        const deptRows = await callRpc<any>({ 
          fn: 'departments_list_for_facilities',
          args: { 
            p_don_vi_array: facilitiesToQuery.length > 0 ? facilitiesToQuery : null 
          }
        })
        
        const summary: InventorySummary = {
          totalImported: aggregates.totalImported || 0,
          totalExported: transferAggregates.totalExported || 0,
          currentStock: aggregates.currentStock || 0,
          netChange: (aggregates.totalImported || 0) - (transferAggregates.totalExported || 0),
        }
        
        return {
          data: [],  // No detailed transactions for "all" view
          summary,
          departments: (deptRows || []).map((r: any) => r.name).filter(Boolean),
        }
        
      } else {
        // EXISTING: Single-facility detailed query
        // ... keep existing implementation ...
      }
    },
    enabled: effectiveTenantKey !== 'unset' && 
             (!isAllFacilities || (facilitiesData !== undefined)),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}
```

#### Task 2.2: Update InventoryReportTab Component
**File:** `src/app/(app)/reports/components/inventory-report-tab.tsx`

```typescript
// Line 316: Conditional rendering for "all facilities" mode
{tenantFilter === 'all' && (
  <div className="rounded-lg border p-4 bg-muted/50">
    <p className="text-sm text-muted-foreground">
      📊 Đang hiển thị dữ liệu tổng hợp từ tất cả cơ sở. 
      Bảng chi tiết giao dịch không khả dụng trong chế độ này.
    </p>
  </div>
)}

{/* Only show detailed table when single facility selected */}
{tenantFilter !== 'all' && (
  <InventoryTable data={data} isLoading={isLoading} />
)}
```

#### Task 2.3: Similar Updates for Other Tabs
- `MaintenanceReportTab` - maintenance aggregates
- `UsageAnalyticsDashboard` - usage aggregates

### Phase 3: Testing Strategy

#### Unit Tests
1. **Backend RPC Tests**
   - Global user with NULL facilities → returns all
   - Global user with specific array → returns filtered
   - Regional leader with NULL → returns allowed only
   - Regional leader with valid array → returns intersection
   - Regional leader with invalid array → raises exception
   - Other roles → limited to single facility

2. **Frontend Hook Tests**
   - `isAllFacilities` detection
   - Query key uniqueness
   - Aggregate RPC calls
   - Summary calculation

#### Integration Tests  
1. **Regional Leader Scenarios**
   - Select "all" → verify aggregated KPIs
   - Switch between single facility and "all"
   - Verify cache invalidation

2. **Global User Scenarios**
   - Select "all" → verify global aggregates
   - Department filter interaction
   - Date range interaction

#### Manual QA Checklist
- [ ] Regional leader: "all" shows sum of allowed facilities
- [ ] Global: "all" shows system-wide totals  
- [ ] Switching between facilities updates correctly
- [ ] KPI cards show proper values
- [ ] Charts render appropriately (or show message for "all" mode)
- [ ] Export functionality handles "all" mode
- [ ] Performance: aggregate queries under 2 seconds

### Phase 4: Documentation

#### Task 4.1: Update Technical Docs
- Add aggregate RPC documentation
- Update data flow diagrams
- Document "all facilities" behavior

#### Task 4.2: User Documentation
- Explain "all facilities" aggregation in UI
- Document limitations (no detailed transactions)

## Migration Strategy

### Deployment Steps
1. Deploy backend migration (aggregate RPCs)
2. Verify RPCs work correctly in staging
3. Deploy frontend changes
4. Monitor performance and errors
5. Rollback plan: Remove aggregate calls, use fallback

### Backward Compatibility
- New RPCs don't affect existing functionality
- Existing single-facility queries unchanged
- No breaking changes

### Rollback Plan
If issues arise:
1. Revert frontend to use single-facility queries only
2. Disable "all facilities" option temporarily
3. Keep aggregate RPCs for future use

## Risk Assessment

### High Risk Areas
1. **Performance**: Aggregate queries across many facilities
   - **Mitigation**: Add indexes, query optimization, caching
   
2. **Authorization**: Ensure regional_leader can't access unauthorized facilities
   - **Mitigation**: Rigorous validation in RPCs, security audit

3. **Data Consistency**: Aggregates must match sum of individual queries
   - **Mitigation**: Integration tests, data validation

### Low Risk Areas
- Frontend UI changes (minimal impact)
- Cache key modifications (isolated)
- New RPCs (additive, no breaking changes)

## Success Criteria

### Functional Requirements
- [x] Regional leader selecting "all" sees aggregated data from allowed facilities
- [x] Global user selecting "all" sees system-wide aggregated data
- [x] KPI cards show correct sums
- [x] Charts adapt appropriately
- [x] Performance acceptable (< 3s load time)

### Non-Functional Requirements  
- [x] No breaking changes to existing code
- [x] Authorization properly enforced
- [x] Code maintainability preserved
- [x] Proper error handling and user feedback

## Timeline Estimate

- **Phase 1 (Backend)**: 2-3 days
  - RPC development: 1 day
  - Testing: 1 day  
  - Review: 0.5 day

- **Phase 2 (Frontend)**: 2 days
  - Hook updates: 1 day
  - Component updates: 0.5 day
  - Testing: 0.5 day

- **Phase 3 (Testing)**: 1 day
  - Integration tests: 0.5 day
  - Manual QA: 0.5 day

- **Phase 4 (Documentation)**: 0.5 day

**Total Estimate: 5.5-6.5 days**

## Alternatives Considered

### Alternative 1: Client-Side Aggregation
**Approach**: Fetch data for each facility, aggregate in React
**Pros**: Simpler backend, full transaction details available
**Cons**: Multiple RPC calls, slow, complex frontend logic
**Decision**: Rejected - poor performance

### Alternative 2: Single Aggregate View Page
**Approach**: Separate route for multi-facility aggregates
**Pros**: Clean separation, no complexity in existing code
**Cons**: Poor UX, duplicate code, confusing navigation
**Decision**: Rejected - poor user experience

### Alternative 3: Remove "All Facilities" Option
**Approach**: Force users to select specific facility
**Pros**: Simplest solution, no code changes needed
**Cons**: Poor UX, defeats purpose of feature
**Decision**: Rejected - doesn't solve user need

## Appendix

### Related Files
- `src/app/(app)/reports/page.tsx` - Main reports page
- `src/app/(app)/reports/components/tenant-filter-dropdown.tsx` - Facility selector
- `src/app/(app)/reports/hooks/use-inventory-data.ts` - Data fetching hook
- `src/app/(app)/reports/components/inventory-report-tab.tsx` - Inventory tab UI
- `supabase/migrations/2025-10-13_reports/*` - Existing report RPCs

### Key SQL Functions
- `equipment_list_for_reports(...)` - Lists equipment with filters
- `equipment_count_enhanced(...)` - Counts equipment
- `transfer_request_list_enhanced(...)` - Lists transfers
- `get_facilities_with_equipment_count()` - Gets facility list
- `allowed_don_vi_for_session_safe()` - Gets allowed facilities for user

### Database Schema References
```sql
-- Key tables
public.thiet_bi (equipment)
  - id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, created_at

public.yeu_cau_luan_chuyen (transfers)  
  - id, thiet_bi_id, loai_hinh, trang_thai, ngay_ban_giao

public.don_vi (facilities)
  - id, name, vung (region)
```
