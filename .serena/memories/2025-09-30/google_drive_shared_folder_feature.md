# Google Drive Shared Folder URL Feature

## Overview
Implemented per-tenant Google Drive shared folder URL configuration for equipment attachments. Global users can configure a shared Drive folder for each tenant, and users see the "Mở thư mục chung" (Open shared folder) button when viewing equipment details.

## Database Schema Changes

### Migration: `20250930_add_google_drive_folder_to_don_vi.sql`

**Status:** ✅ Migration file created and tested - APPLIED by user

**Column Added:**
- `don_vi.google_drive_folder_url` (TEXT, nullable)
- Stores the Google Drive shared folder URL for each tenant

**RPC Functions Updated:**

1. **`don_vi_get(p_id)`** - Returns tenant data including `google_drive_folder_url`
   - Updated return type to include new field
   - Security: global role only

2. **`don_vi_update(...)`** - Updated to support updating the folder URL
   - New parameters: `p_google_drive_folder_url`, `p_set_google_drive_folder_url`
   - Old function dropped to avoid signature conflicts
   - Security: global role only

3. **`don_vi_create(...)`** - Updated to support setting folder URL on creation
   - New parameter: `p_google_drive_folder_url`
   - Old function dropped to avoid signature conflicts
   - **Fixed:** Ambiguous column reference by using `RETURNING public.don_vi.id INTO v_new_id` instead of just `RETURNING id INTO v_new_id`
   - Security: global role only

### Migration Fix Applied

**Issue:** Ambiguous column reference error when creating tenant
```sql
-- BEFORE (caused error):
RETURNING id INTO v_new_id;

-- AFTER (fixed):
RETURNING public.don_vi.id INTO v_new_id;
```

The `id` was ambiguous because the function's RETURNS TABLE also has an `id` column. Qualifying it with the table name resolved the issue.

## Frontend Implementation

### 1. User Management - Unit Configuration

**Files Modified:**
- `src/components/edit-tenant-dialog.tsx`
- `src/components/add-tenant-dialog.tsx`

**Changes:**
- Added `google_drive_folder_url` field to `TenantRow` interface
- Added input field in both create and edit dialogs
- Field appears after "Hạn mức tài khoản thành viên"
- Placeholder: `https://drive.google.com/drive/folders/...`
- Help text: "Thư mục Google Drive chia sẻ cho file đính kèm thiết bị của đơn vị này."
- Uses `p_set_google_drive_folder_url` flag for proper NULL handling (edit dialog)

**Testing Results:** ✅ Can create and edit tenants with Google Drive URL successfully

### 2. Equipment Details - Attachments Tab

**Files Modified:**
- `src/app/(app)/equipment/page.tsx`
- `src/types/database.ts`

**Changes:**
- Added `don_vi` field to `Equipment` interface (for tenant association)
- Added `ExternalLink` icon import from lucide-react
- Created `tenantDataQuery` using TanStack Query to fetch tenant data when viewing equipment
- Added "Mở thư mục chung" button in attachments tab
  - Only appears if tenant has configured a Google Drive folder URL
  - Opens folder in new tab with `target="_blank"` and security attributes
  - Button location: Inside the alert box that explains how to get URLs

**Query Configuration:**
```typescript
const tenantDataQuery = useQuery({
  queryKey: ['don_vi', selectedEquipment?.don_vi],
  queryFn: async () => {
    if (!selectedEquipment?.don_vi) return null
    const data = await callRpc({ fn: 'don_vi_get', args: { p_id: selectedEquipment.don_vi } })
    return Array.isArray(data) ? data[0] : data
  },
  enabled: !!selectedEquipment?.don_vi && isDetailModalOpen,
  staleTime: 300_000,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
})
```

## User Experience Flow

### For Global Users (Configuration):
1. Navigate to User Management → Đơn vị tab
2. Click "Thêm đơn vị" (create) or "Sửa" (edit) on existing tenant
3. Enter Google Drive folder URL in the dedicated field
4. Save changes - ✅ Works correctly with no errors

### For All Users (Usage):
1. Navigate to Equipment page
2. Click on any equipment to open details modal
3. Switch to "File đính kèm" tab
4. If tenant has configured Drive folder:
   - See "Mở thư mục chung" button in the alert box
   - Click to open shared folder in new tab
5. Add attachment links from shared folder

## Business Logic

**Important:** The displayed Google Drive folder URL is based on the **equipment's tenant** (equipment.don_vi), NOT the user's tenant (user.current_don_vi).

### Examples:
- User from BVDKAG views equipment from BVDKAG → Shows BVDKAG's Drive folder ✓
- User from CDCAG views equipment from BVDKAG → Shows BVDKAG's Drive folder ✓
- Global user views equipment from any tenant → Shows that equipment's tenant Drive folder ✓

This design ensures file management follows equipment ownership, not user affiliation.

## Performance Optimization

The attachments tab already uses TanStack Query with optimal configuration:
- **5-minute cache** (`staleTime: 300_000`) - Reduces redundant API calls
- **Smart invalidation** - Only refetches when attachments are added/deleted
- **Conditional fetching** - Only runs when modal is open (`enabled: !!selectedEquipment && isDetailModalOpen`)
- **No refetch on focus** - Prevents unnecessary calls when switching tabs
- **keepPreviousData** - Smooth UI transitions

No additional optimization needed - already properly implemented.

## Security

- Only `global` role users can create/update tenant Google Drive folder URLs
- RPC functions enforce role validation via JWT claims
- Multi-tenancy isolation maintained: users only see equipment they have access to
- The Drive folder URL is stored per tenant, not globally

## Files Changed

### Database:
- `supabase/migrations/20250930_add_google_drive_folder_to_don_vi.sql` (NEW - APPLIED)

### Frontend:
- `src/components/edit-tenant-dialog.tsx` (MODIFIED)
- `src/components/add-tenant-dialog.tsx` (MODIFIED)
- `src/app/(app)/equipment/page.tsx` (MODIFIED)
- `src/types/database.ts` (MODIFIED)

## Testing Status

- ✅ Migration applied successfully
- ✅ Global user can create tenant with Drive folder URL
- ✅ Global user can edit tenant's Drive folder URL
- ✅ Ambiguous column reference error fixed
- ⏳ Button appears in attachments tab when URL is configured (pending equipment with don_vi data)
- ⏳ Button does not appear when URL is empty/null
- ⏳ Clicking button opens correct Drive folder in new tab
- ⏳ Equipment from different tenants show their respective Drive folders
- ⏳ TanStack Query properly caches tenant data

## Technical Notes

### Bug Fix: Ambiguous Column Reference

When creating a tenant, PostgreSQL threw error:
```
code: "42702"
message: "column reference 'id' is ambiguous"
hint: "It could refer to either a PL/pgSQL variable or a table column."
```

**Root Cause:** In `don_vi_create`, the RETURNS TABLE includes an `id` column, and the INSERT statement uses `RETURNING id`, creating ambiguity.

**Solution:** Qualify the column with the table name:
```sql
RETURNING public.don_vi.id INTO v_new_id;
```

This explicitly tells PostgreSQL we want the `id` from the `don_vi` table, not the function's return column.

## Future Enhancements (Optional)

- Add validation to ensure URL is a valid Google Drive folder link
- Add tenant-level permissions to restrict who can see the shared folder
- Track usage/analytics of Drive folder access
- Support for multiple folder URLs per tenant (e.g., different folders per equipment type)
- Add visual indicator in tenant list showing which tenants have Drive folder configured