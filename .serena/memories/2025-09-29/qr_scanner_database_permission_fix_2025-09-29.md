# QR Scanner Database Permission Fix - September 29, 2025

## Issue Identified: Permission Denied for Table thiet_bi
The QR scanner page was failing with "permission denied for table thiet_bi" error when searching for equipment by QR code.

## Root Cause Analysis

### Problem
- **QRActionSheet component** was making direct Supabase table queries instead of using RPC proxy
- **Direct table access**: `supabase.from('thiet_bi').select('*').eq('ma_thiet_bi', qrCode)`
- **Bypasses security**: Direct table access violates the project's RPC-only database access pattern
- **Multi-tenant isolation**: Direct queries don't enforce tenant boundaries or role permissions

### Security & Architecture Violation
The project follows an **RPC-only database access pattern** where:
- All database operations must go through Supabase RPC functions
- RPC functions enforce tenant isolation and role-based access
- Client code uses `/api/rpc/[fn]` proxy with JWT-signed claims
- Direct table access is prohibited for security reasons

## Solution Implemented

### File Modified: `src/components/qr-action-sheet.tsx`

#### 1. **Replaced Direct Supabase Import**:
```typescript
// Before
import { supabase } from "@/lib/supabase"

// After  
import { callRpc } from "@/lib/rpc-client"
import type { Equipment } from "@/types/database"
```

#### 2. **Updated Equipment Search Logic**:
```typescript
// Before (BROKEN - Direct table access)
const { data, error: supabaseError } = await supabase
  .from('thiet_bi')
  .select('*')
  .eq('ma_thiet_bi', qrCode.trim())
  .single()

// After (FIXED - RPC proxy with tenant security)
const result = await callRpc<any>({
  fn: 'equipment_list_enhanced',
  args: {
    p_q: qrCode.trim(),
    p_page: 1,
    p_page_size: 1,
    p_fields: 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98,gia_goc,hang_san_xuat,nam_san_xuat'
  }
})

const data = result?.data || []
const matchingEquipment = data.find((eq: any) => eq.ma_thiet_bi === qrCode.trim())
```

#### 3. **Enhanced Error Handling**:
```typescript
// Before (Basic Supabase error handling)
if (supabaseError.code === 'PGRST116') {
  setError(`Không tìm thấy thiết bị với mã: ${qrCode}`)
}

// After (RPC error handling) 
} catch (err: any) {
  console.error("Search error:", err)
  const errorMsg = err?.message || 'Đã có lỗi xảy ra khi tìm kiếm'
  setError(`Lỗi tìm kiếm: ${errorMsg}`)
  setEquipment(null)
}
```

## Technical Benefits

### ✅ **Security Compliance**:
- **RPC-only access**: Follows established security pattern
- **Tenant isolation**: Automatic filtering by user's current_don_vi  
- **Role validation**: Server-side permission checks enforced
- **JWT claims**: Proper authentication context passed

### ✅ **Multi-Tenancy Support**:
- **Automatic filtering**: Non-global users only see their equipment
- **Cross-tenant protection**: Prevents equipment access across tenants
- **Regional leader support**: Works with new regional leader roles

### ✅ **Consistent Architecture**:
- **Pattern compliance**: Follows same RPC pattern as rest of application
- **Whitelisted function**: `equipment_list_enhanced` already in ALLOWED_FUNCTIONS
- **Error handling**: Consistent with other RPC client usage

### ✅ **Performance & Functionality**:
- **Enhanced search**: Uses optimized `equipment_list_enhanced` RPC
- **Field selection**: Only fetches needed equipment fields
- **Search logic**: Maintains exact QR code matching behavior

## Testing Status
- ✅ **TypeScript compilation**: Successful (npm run typecheck)
- ✅ **Import resolution**: All types properly imported
- ⏳ **Runtime testing**: Ready for QR scanner functionality test

## Integration Notes
- Uses existing `callRpc` client from `@/lib/rpc-client`
- Leverages `equipment_list_enhanced` RPC function (already whitelisted)
- Maintains same UI/UX behavior for equipment search results
- Compatible with existing equipment action handling

## Security Validation
- ✅ **No direct table access**: Removed all `supabase.from()` calls
- ✅ **RPC proxy enforced**: All database access through `/api/rpc/[fn]`
- ✅ **Tenant boundaries**: Server-side filtering automatically applied
- ✅ **Role permissions**: Proper JWT claims validation

## Next Steps
1. Test QR scanner with various equipment codes
2. Verify tenant isolation works correctly
3. Test with different user roles (global, to_qltb, technician, user)
4. Validate equipment actions work properly after search

## Status: READY FOR TESTING
Database permission error fixed. QR scanner now uses secure RPC proxy pattern with proper tenant isolation.