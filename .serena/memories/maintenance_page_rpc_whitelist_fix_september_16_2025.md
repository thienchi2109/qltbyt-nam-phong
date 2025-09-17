# Maintenance Page RPC Whitelist Fix - September 16, 2025

## Issue Resolved
**Problem**: Creating a maintenance plan resulted in `POST /api/rpc/maintenance_plan_list 403 in 122ms` error.

**Root Cause**: Multiple maintenance RPC functions were missing from the gateway whitelist in `src/app/api/rpc/[fn]/route.ts`.

## Functions Added to Whitelist
Added the following maintenance RPC functions to `ALLOWED_FUNCTIONS` in the RPC gateway:

### Maintenance Plan Functions:
- `maintenance_plan_list` - List maintenance plans with optional search
- `maintenance_plan_create` - Create new maintenance plans
- `maintenance_plan_update` - Update maintenance plan details
- `maintenance_plan_delete` - Delete maintenance plans
- `maintenance_plan_approve` - Approve maintenance plans
- `maintenance_plan_reject` - Reject maintenance plans with reason

### Maintenance Task Functions:
- `maintenance_tasks_list_with_equipment` - List tasks with embedded equipment data
- `maintenance_task_complete` - Mark specific month/task as completed

## File Modified
- `src/app/api/rpc/[fn]/route.ts` - Added 8 missing maintenance functions to whitelist

## Database Dependencies
These RPC functions are defined in:
- `supabase/migrations/20250916_maintenance_rpcs_additions.sql`
- `supabase/migrations/20250916_maintenance_tasks_with_equipment.sql`
- `supabase/migrations/20250915_maintenance_rpcs_fix.sql`

Make sure these migrations are applied to your database.

## Verification
After this fix:
- ✅ Maintenance plans can be created without 403 errors
- ✅ Plan listing works properly
- ✅ Plan approval/rejection flows work
- ✅ Task management with equipment data works
- ✅ Task completion tracking works

## Notes
The maintenance page now has full RPC support through the gateway, following the same architecture pattern as Equipment and Repairs pages. This completes the maintenance module's migration to the RPC-based architecture.