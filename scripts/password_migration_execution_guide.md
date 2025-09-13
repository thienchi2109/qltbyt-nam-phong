# 🔐 PASSWORD MIGRATION EXECUTION GUIDE

## 📋 **PRE-MIGRATION CHECKLIST**

### ✅ **1. Prerequisites Verification**
```sql
-- Run this query to verify all prerequisites
SELECT * FROM verify_migration_prerequisites();
```

Expected output:
- `pgcrypto_extension`: OK
- `hashed_password_column`: OK
- `user_count`: INFO - Shows total users
- `users_need_migration`: INFO - Shows users to migrate

### ✅ **2. Test bcrypt Functionality**
```sql
-- Test bcrypt hashing and verification
SELECT * FROM test_bcrypt_functionality();
```

Expected output:
- `hash_generation`: SUCCESS
- `hash_verification`: SUCCESS

### ✅ **3. Create Full Database Backup**
```bash
# Create full database backup
pg_dump -h localhost -U postgres -d your_database > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase CLI
supabase db dump > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🚀 **MIGRATION EXECUTION STEPS**

### **Step 1: Run Preparation Migration**
```bash
# Apply backup and preparation migration
supabase migration apply --file supabase/migrations/20241225_password_migration_backup.sql
```

### **Step 2: Run Main Migration Script**
```bash
# Apply migration execution script
supabase migration apply --file supabase/migrations/20241225_password_migration_execute.sql
```

### **Step 3: Run Enhanced Authentication**
```bash
# Apply enhanced authentication
supabase migration apply --file supabase/migrations/20241225_enhanced_authentication.sql
```

### **Step 4: Execute Password Migration**
```sql
-- Execute the migration (this will hash all existing passwords)
SELECT * FROM migrate_existing_passwords();
```

**Expected Output:**
```
user_id | username | status  | message
--------|----------|---------|------------------
1       | admin    | SUCCESS | Migrated 1/5
2       | user1    | SUCCESS | Migrated 2/5
3       | user2    | SUCCESS | Migrated 3/5
...
```

### **Step 5: Verify Migration Results**
```sql
-- Verify all migrated passwords work correctly
SELECT * FROM verify_migrated_passwords();
```

**Expected Output:**
```
user_id | username | original_password_works | hashed_password_works | verification_status
--------|----------|-------------------------|----------------------|--------------------
1       | admin    | t                       | f                    | PASS
2       | user1    | t                       | f                    | PASS
...
```

**🚨 CRITICAL:** All rows must show `PASS` status!

### **Step 6: Test Authentication**
```sql
-- Test authentication with original passwords
SELECT * FROM authenticate_user_dual_mode('admin', 'original_password');
SELECT * FROM authenticate_user_dual_mode('admin', 'hashed password'); -- Should fail
```

**Expected Results:**
- Original password: `is_authenticated = true`, `authentication_mode = 'hashed'`
- "hashed password": `is_authenticated = false`, `authentication_mode = 'blocked_suspicious'`

### **Step 7: Finalize Migration (Optional)**
```sql
-- Replace plain text passwords with placeholder (after thorough testing)
SELECT * FROM finalize_password_migration();
```

---

## 📊 **MONITORING & VERIFICATION**

### **Migration Statistics**
```sql
-- Check migration progress
SELECT * FROM get_migration_statistics();
```

### **User Authentication Status**
```sql
-- Check specific user auth status
SELECT * FROM get_user_auth_status(1); -- Replace 1 with user ID
```

### **Migration Log Review**
```sql
-- Review migration log
SELECT * FROM password_migration_log ORDER BY migration_timestamp DESC;
```

---

## 🔄 **ROLLBACK PROCEDURES**

### **Emergency Rollback**
```sql
-- EMERGENCY: Rollback all migrations
SELECT * FROM rollback_password_migration();
```

### **Verification After Rollback**
```sql
-- Verify rollback was successful
SELECT username, password, hashed_password FROM nhan_vien;
```

### **Complete System Restore**
```sql
-- Restore from backup table
UPDATE nhan_vien SET 
    password = backup.password,
    hashed_password = NULL
FROM nhan_vien_backup_pre_hash backup
WHERE nhan_vien.id = backup.id;
```

---

## ⚠️ **COMMON ISSUES & SOLUTIONS**

### **Issue 1: Migration Function Not Found**
```sql
-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%migrate%' OR routine_name LIKE '%password%';
```

### **Issue 2: Permission Denied**
```sql
-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
```

### **Issue 3: Authentication Failures**
```sql
-- Check authentication mode for failing users
SELECT username, 
       CASE WHEN hashed_password IS NOT NULL THEN 'hashed' ELSE 'plain' END as mode
FROM nhan_vien;
```

### **Issue 4: Performance Issues**
```sql
-- Check migration performance
SELECT COUNT(*) as total_users, 
       AVG(EXTRACT(EPOCH FROM (migration_timestamp - created_at))) as avg_migration_time
FROM password_migration_log pml
JOIN nhan_vien nv ON pml.user_id = nv.id;
```

---

## 🎯 **SUCCESS CRITERIA**

### ✅ **Migration Successful When:**
1. All users in `password_migration_log` have `migration_status = 'success'`
2. All users can login with their original passwords
3. No users can login with "hashed password" string
4. `verify_migrated_passwords()` returns all `PASS` status
5. No performance degradation in authentication

### ❌ **Migration Failed When:**
1. Any user has `migration_status = 'failed'`
2. Any user cannot login with original password
3. Any user can login with "hashed password" string
4. Authentication takes >2 seconds per request
5. Any system functionality is broken

---

## 📞 **EMERGENCY CONTACTS**

### **Immediate Actions Required:**
1. **Stop all user operations**
2. **Run rollback procedures**
3. **Verify system functionality**
4. **Check authentication endpoints**
5. **Monitor system logs**

### **Post-Migration Tasks:**
1. Update frontend authentication logic
2. Test all user flows
3. Update documentation
4. Schedule follow-up security audit
5. Plan next security improvements

---

**📅 Migration Timeline:**
- **Preparation:** 30 minutes
- **Migration Execution:** 15 minutes  
- **Verification:** 30 minutes
- **Rollback (if needed):** 15 minutes
- **Total:** ~1.5 hours

**🔒 Security Level:** HIGH - Full system authentication affected 