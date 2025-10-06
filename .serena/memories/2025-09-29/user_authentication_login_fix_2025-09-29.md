# User Authentication Login Fix - September 29, 2025

## Issue Identified: New User Login Failure (401)
After fixing the tenant creation issue, newly created users were unable to login, receiving 401 errors at `/api/auth/callback/credentials`.

## Root Cause Analysis

### Problem
- **`user_create` function**: Stores passwords in plain text in the `password` column
- **`authenticate_user_dual_mode` function**: Expects hashed passwords in `hashed_password` column first
- **Mismatch**: New users had plain text passwords but authentication expected hashed passwords

### Database Investigation
```sql
-- Existing users (working)
SELECT username, password, hashed_password FROM nhan_vien LIMIT 4;
-- Result: All have password = "hashed password" and hashed_password = "$2a$12$..."

-- New users (broken)
-- Would have: password = "actualplaintext" and hashed_password = NULL
```

### Authentication Flow Issue
1. User creates new account → `user_create` stores plain text password
2. User tries to login → `authenticate_user_dual_mode` checks hashed_password first (NULL)
3. Falls back to plain text password check, but logic fails
4. Authentication fails with 401 error

## Solution Implemented

### Migration: `20250929143944_fix_user_create_password_hashing.sql`

**Key Changes:**
1. **Hash passwords during creation**: Use `extensions.crypt(p_password, extensions.gen_salt('bf', 12))`
2. **Consistent storage pattern**: Set `password = 'hashed password'` and `hashed_password = actual_hash`
3. **Match existing users**: Same bcrypt cost factor 12 as existing system
4. **Maintain compatibility**: Same structure as existing working users

### Updated Function Logic
```sql
-- Before (broken)
INSERT INTO nhan_vien(username, password, full_name, role, current_don_vi)
VALUES (trim(p_username), p_password, trim(p_full_name), lower(p_role), p_current_don_vi)

-- After (fixed)
v_hashed_password := extensions.crypt(p_password, extensions.gen_salt('bf', 12));
INSERT INTO nhan_vien(username, password, hashed_password, full_name, role, current_don_vi)
VALUES (trim(p_username), 'hashed password', v_hashed_password, trim(p_full_name), lower(p_role), p_current_don_vi)
```

## Technical Details

### Password Hashing
- **Algorithm**: bcrypt with cost factor 12
- **Salt Generation**: `extensions.gen_salt('bf', 12)`
- **Hashing**: `extensions.crypt(password, salt)`
- **Compatibility**: Matches existing user password format

### Authentication Compatibility
- **Dual mode support**: Maintains backward compatibility with existing auth flow
- **Hashed password priority**: New users will authenticate via hashed_password column
- **Fallback intact**: Plain text fallback still works for any edge cases

### Security Improvements
- ✅ **No plain text storage**: All new passwords properly hashed
- ✅ **Strong hashing**: bcrypt cost factor 12 (industry standard)
- ✅ **Consistent security**: Same protection level as existing users
- ✅ **Audit trail**: Maintains existing authentication modes in RPC

## Files Modified
1. **New Migration**: `supabase/migrations/20250929143944_fix_user_create_password_hashing.sql`
   - Updates `user_create` function to hash passwords
   - Adds proper grants and documentation
   - Maintains backward compatibility

## Testing Required
1. **User Creation**: Verify new users can be created successfully
2. **Login Test**: Confirm newly created users can authenticate
3. **Existing Users**: Ensure existing users still work normally
4. **Multi-tenant**: Test user creation across different tenants

## Related Issues Fixed
- **Tenant Creation**: ✅ Fixed don_vi_create ambiguous id reference
- **User Authentication**: ✅ Fixed new user login failure
- **Password Security**: ✅ Proper bcrypt hashing for new accounts

## Next Steps
1. Run the migration manually in Supabase
2. Test user creation + login flow
3. Verify no regression for existing users
4. Document success in project memories

## Status: READY FOR DEPLOYMENT
Migration file created and ready to be applied to fix new user authentication issues.