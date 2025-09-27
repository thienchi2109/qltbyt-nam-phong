# Equipment Page Department Filter Fix - 2025-09-27

## Issue Resolved
✅ **Equipment page department filter showing only single value instead of all tenant departments**

### Root Cause
- Department filter options were derived from current page data only
- Code used `data.map((item) => item.khoa_phong_quan_ly)` where `data` is current page results
- Multi-tenant architecture requires tenant-aware department loading
- Current page might only contain equipment from one department, hiding other options

### Evidence
- Database query showed 8 different departments with equipment
- User reported filter only showing "Xét nghiệm" 
- Equipment page lacked proper tenant-aware department loading

### Solution Applied
Replaced client-side department extraction with tenant-aware RPC call in `src/app/(app)/equipment/page.tsx`:

**Before (lines 1411-1413):**
```typescript
const departments = React.useMemo(() => (
  Array.from(new Set(data.map((item) => item.khoa_phong_quan_ly?.trim()).filter(Boolean))) as string[]
), [data])
```

**After (lines 1411-1428):**
```typescript
// Load departments for current tenant via RPC (tenant-aware filtering)
const { data: departmentsData } = useQuery<{ name: string; count: number }[]>({
  queryKey: ['departments_list_for_tenant', selectedDonVi],
  queryFn: async () => {
    const result = await callRpc<{ name: string; count: number }[]>({
      fn: 'departments_list_for_tenant',
      args: { p_don_vi: selectedDonVi }
    })
    return result || []
  },
  enabled: shouldFetchEquipment, // Same gating as equipment query
  staleTime: 300_000,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
})
const departments = React.useMemo(() => 
  (departmentsData || []).map(x => x.name).filter(Boolean),
  [departmentsData]
)
```

### Key Improvements
1. **Tenant-Aware**: Uses `departments_list_for_tenant` RPC with `p_don_vi: selectedDonVi`
2. **Consistent Logic**: Matches equipment query gating with `shouldFetchEquipment`
3. **Global User Support**: Works for both regular users (own tenant) and global users (selected tenant)
4. **Performance**: Cached with 5-minute stale time, proper garbage collection
5. **Data Format**: Correctly extracts `name` from `{name, count}` objects

### Multi-Tenant Architecture Compliance
- Regular users: See departments from their own tenant only
- Global users: See departments from selected tenant (or all if no tenant selected)
- Respects JWT claims for tenant isolation
- Server-side filtering prevents cross-tenant data exposure

### Pattern Consistency
Now matches the working pattern used in reports page (`use-inventory-data.ts` lines 222-226).

### Testing Status
- ✅ TypeScript compilation passes
- ✅ RPC exists and is whitelisted in API routes
- ✅ Query follows established caching patterns
- ✅ Tenant logic matches equipment query logic

The equipment page department filter will now show all departments available within the user's tenant scope, enabling proper multi-department filtering regardless of current page content.