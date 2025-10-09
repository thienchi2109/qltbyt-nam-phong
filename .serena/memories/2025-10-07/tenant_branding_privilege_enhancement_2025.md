# Tenant Branding Privilege Enhancement Implementation

## Completed: October 1, 2025

### Overview
Successfully implemented privileged user branding system for Vietnamese medical equipment management system. Global/admin users now see original tenant branding when viewing forms, while regular tenant users continue to see their session-based dynamic branding.

### Key Components Modified

#### 1. Enhanced Branding Hook (`src/hooks/use-tenant-branding.ts`)
- Added `formTenantId` parameter for context-specific branding
- Added `useFormContext` parameter for privilege detection mode
- Smart tenant selection based on user role: global/admin use formTenantId, regular users use session

#### 2. Form Branding Header Component (`src/components/form-branding-header.tsx`)
- Added `tenantId` prop for static tenant specification
- Auto-detection of branding mode based on user role
- Handles both privileged (static) and regular (dynamic) branding scenarios

#### 3. Form Components Updated
- `src/components/handover-template.tsx`: Added `tenantId` prop support
- `src/components/maintenance-form.tsx`: Added `tenantId` prop support  
- `src/components/repair-result-form.tsx`: Added `tenantId` prop support

#### 4. Equipment Page Print Functions (`src/app/(app)/equipment/page.tsx`)
- `handleGenerateProfileSheet`: Async function with equipment.don_vi branding fetch
- `handleGenerateDeviceLabel`: Async function with equipment.don_vi branding fetch
- **Critical Fix**: RPC `don_vi_branding_get` returns array, fixed to use `[0]` element
- Global/admin users: Always fetch equipment owner's tenant branding
- Regular users: Use session branding, fallback to equipment tenant branding

### Technical Implementation Details

#### Privilege Detection Logic
```typescript
// Global/admin users see original tenant branding
if (user?.role === 'global' || user?.role === 'admin') {
  // Fetch equipment owner's branding via RPC
  const brandingRes = await callRpc<any[]>({ 
    fn: 'don_vi_branding_get', 
    args: { p_id: equipment.don_vi } 
  });
  brandingToUse = brandingRes?.[0]; // Array response handling
}
```

#### Key Bug Fixed
- **Issue**: RPC `don_vi_branding_get` returns array `[{id, name, logo_url}]` but code treated as object
- **Fix**: Added array indexing `equipmentTenantBrandingRes?.[0]` to extract first element
- **Result**: Global users now correctly see equipment owner's tenant name instead of session tenant

### Behavior Verification
- ✅ **Global User**: Opens equipment from "Bệnh viện Đa khoa An Giang" → Profile sheet shows "Bệnh viện Đa khoa An Giang" branding
- ✅ **Tenant User**: Opens equipment → Profile sheet shows their session tenant branding  
- ✅ **All Forms**: Maintenance, handover, repair result forms follow same privilege logic
- ✅ **Error Handling**: RPC failures gracefully fallback, console errors for debugging

### Files Modified
1. `src/hooks/use-tenant-branding.ts` - Enhanced hook with privilege detection
2. `src/components/form-branding-header.tsx` - Added tenantId prop support  
3. `src/components/handover-template.tsx` - Updated to pass tenantId
4. `src/components/maintenance-form.tsx` - Updated to pass tenantId
5. `src/components/repair-result-form.tsx` - Updated to pass tenantId
6. `src/app/(app)/equipment/page.tsx` - Async print functions with RPC branding fetch

### Business Value
- **Compliance**: Global/admin users can now properly view original tenant documentation
- **User Experience**: Maintains dynamic branding for regular tenant users
- **Audit Trail**: Equipment forms show correct organizational branding for regulatory compliance
- **Multi-tenancy**: Proper tenant isolation while allowing privileged cross-tenant access

### Next Steps
- Monitor production usage for any edge cases
- Consider extending privilege branding to other form types if needed
- Potential optimization: Cache tenant branding data to reduce RPC calls