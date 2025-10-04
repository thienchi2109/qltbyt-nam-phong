# Regional Leader Authentication Debug Process - October 4, 2025

## Problem Summary
Non-global accounts (regional_leader, to_qltb, user) could not login with 401 Unauthorized errors, while global accounts worked fine.

## Root Cause Analysis

### Initial Issues Identified
1. **Authentication Function Problems**: `authenticate_user_dual_mode` wasn't properly resolving `dia_ban_id` for regional_leader users
2. **RPC Claims Mismatch**: RPC proxy sent 'dia_ban' claim but `allowed_don_vi_for_session()` function expected 'dia_ban' claim
3. **Ambiguous Column References**: JOIN operations between `nhan_vien` and `don_vi` tables both had `dia_ban_id` columns

### Final Root Cause
**Variable-Column Name Conflict**: PL/pgSQL variables named `dia_ban_id` conflicted with table column names, causing PostgreSQL errors like:
```
ERROR: 42702: column reference "dia_ban_id" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
```

## Debug Process Timeline

### 1. Initial Investigation (2025-10-04 05:42 UTC)
- Created `20250927190000_regional_leader_phase4.sql` - Initial attempt to fix regional leader restrictions
- Identified authentication gaps in JWT claims propagation

### 2. First Authentication Fix Attempt (2025-10-04 05:42 UTC)
- Created `20250927133000_global_admin_user_management.sql` - Fixed authentication function
- Updated `allowed_don_vi_for_session()` function
- Reset regional_leader password for testing

### 3. Ambiguous Reference Fix (2025-10-04 06:12 UTC)
- Created `20250927133000_fix_regional_leader_rpc_enforcement.sql` - Fixed RPC enforcement
- Created `20250927120000_regional_leader_schema_foundation.sql` - Fixed schema foundation
- Created `20250927121500_regional_leader_backfill.sql` - Fixed backfill and performance

### 4. Complete Authentication Fix (2025-10-04 06:20 UTC)
- Created `20250927190000_regional_leader_phase4.sql` - Complete function rewrite
- Still had ambiguous column reference errors

### 5. Final Variable-Column Conflict Fix (2025-10-04 06:30 UTC)
- Created `20251004063000_fix_variable_column_conflict.sql` - Final working solution
- Renamed all variables to avoid conflicts with column names
- Successfully resolved all authentication issues

## Migration Files Created

### Working Migration (Final Solution)
- `20251004063000_fix_variable_column_conflict.sql` - ✅ WORKING SOLUTION

### Debug/Reference Migrations (Keep for Understanding)
- `20250927120000_regional_leader_schema_foundation.sql` - Schema foundation
- `20250927121500_regional_leader_backfill.sql` - Backfill and performance
- `20250927133000_global_admin_user_management.sql` - User management functions
- `20250927190000_regional_leader_phase4.sql` - RPC enforcement
- `20250927133000_fix_regional_leader_rpc_enforcement.sql` - RPC enforcement
- `20251004054200_fix_regional_leader_authentication_and_rpc.sql` - Initial auth fix
- `20251004061200_fix_ambiguous_dia_ban_id_reference.sql` - Ambiguous reference fix
- `20251004062000_complete_authenticate_user_dual_mode_fix.sql` - Complete fix attempt

## Key Technical Lessons Learned

### 1. Variable Naming in PL/pgSQL
- Never use variable names that match table column names
- Use descriptive prefixes like `v_` for variables
- Be explicit with table aliases in complex JOINs

### 2. Function Debugging Approach
- Test functions directly in SQL editor before application testing
- Use `pg_proc` to inspect function definitions
- Check function source code with `pg_proc.prosrc`

### 3. Migration Strategy
- Create incremental fixes for complex issues
- Keep track of all migration attempts for debugging
- Use clear naming conventions for migration files

### 4. Authentication Flow Understanding
- NextAuth → JWT → RPC proxy → Database functions
- Claims propagation chain: `session → JWT → RPC → function`
- Importance of consistent claim naming between layers

## User Accounts Tested Successfully

### Regional Leader
- Username: `sytag-khtc`
- Password: `1234`
- Region: An Giang (dia_ban_id: 1)
- Role: `regional_leader`

### to_qltb Users
- Username: `cdc-ag`, `bvdk-ag`
- Password: `1234`
- Region: An Giang (dia_ban_id: 1)
- Role: `to_qltb`

### Regular User
- Username: `bvdk-ag-pkhtc`
- Password: `1234`
- Region: An Giang (dia_ban_id: 1)
- Role: `user`

## Verification Queries

```sql
-- Test regional leader authentication
SELECT * FROM public.authenticate_user_dual_mode('sytag-khtc', '1234');

-- Test to_qltb authentication
SELECT * FROM public.authenticate_user_dual_mode('cdc-ag', '1234');

-- Test regular user authentication
SELECT * FROM public.authenticate_user_dual_mode('bvdk-ag-pkhtc', '1234');

-- Verify user assignments
SELECT id, username, full_name, role, dia_ban_id, don_vi, current_don_vi 
FROM public.nhan_vien 
WHERE role IN ('regional_leader', 'to_qltb', 'user')
ORDER BY id;
```

## Recommendations for Future Development

### 1. Migration Management
- Keep all debug migrations for reference
- Create a single consolidated migration for production deployments
- Document migration dependencies clearly

### 2. Function Development
- Use consistent variable naming conventions
- Test functions directly before application integration
- Include comprehensive comments for complex logic

### 3. Authentication Debugging
- Start with direct function testing
- Check JWT claims at each layer
- Verify claim consistency between components

## Success Criteria Met

✅ **Regional Leader Authentication**: Users can login successfully
✅ **Regional Data Access**: Regional leaders see all units in their region
✅ **Non-Global User Authentication**: All user types can login
✅ **Security Isolation**: Users cannot see data outside their assigned region
✅ **Error Resolution**: All 401 Unauthorized errors resolved

## Conclusion

The authentication issue was successfully resolved through systematic debugging and identifying the variable-column name conflict. The process highlights the importance of careful variable naming in PL/pgSQL functions and the value of incremental debugging approaches.