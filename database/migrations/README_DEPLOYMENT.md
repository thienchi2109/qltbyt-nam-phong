# Department Filtering Database Indexes - Deployment Guide

## Overview
This guide helps you safely deploy database indexes for department filtering performance optimization.

## Prerequisites
- PostgreSQL database access (Supabase or self-hosted)
- Permission to create indexes
- Backup of your database (recommended)

## Step-by-Step Deployment

### Step 1: Check Database Readiness
Run this script first to verify your database is ready:

```sql
-- Run: database/migrations/check_database_readiness.sql
```

**Expected Output:**
- ✅ All required tables exist
- ✅ All required columns exist  
- ✅ User has permission to create indexes
- ℹ️ Data distribution summary

**If you see warnings:**
- Missing tables/columns: Verify your database schema
- Permission issues: Contact your database administrator
- Low department data: Consider updating your data before proceeding

### Step 2: Create Indexes (Safe Version)
Run the simplified index creation script:

```sql
-- Run: database/migrations/add_department_filtering_indexes_simple.sql
```

**This script creates:**
1. `idx_thiet_bi_khoa_phong_quan_ly` - Primary department filter
2. `idx_thiet_bi_dept_status` - Department + status filter
3. `idx_thiet_bi_dept_created` - Department + date ordering
4. `idx_yeu_cau_sua_chua_thiet_bi_id` - Repair requests by equipment
5. `idx_yeu_cau_sua_chua_status_date` - Repair requests by status/date
6. `idx_nhan_vien_khoa_phong` - User department lookups
7. `idx_nhan_vien_username_role` - User authentication
8. Text search indexes for equipment names/codes

**Expected Duration:** 1-5 minutes depending on data size

### Step 3: Update Table Statistics
After creating indexes, update PostgreSQL statistics:

```sql
ANALYZE thiet_bi;
ANALYZE yeu_cau_sua_chua;
ANALYZE nhan_vien;
```

### Step 4: Verify Index Creation
Check that indexes were created successfully:

```sql
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_thiet_bi_%' 
   OR indexname LIKE 'idx_yeu_cau_%'
   OR indexname LIKE 'idx_nhan_vien_%'
ORDER BY tablename, indexname;
```

### Step 5: Test Performance
Test department filtering queries:

```sql
-- Replace 'Khoa Nội' with actual department name from your data
EXPLAIN ANALYZE 
SELECT * FROM thiet_bi 
WHERE khoa_phong_quan_ly = 'Khoa Nội' 
ORDER BY created_at DESC;
```

**Look for:**
- `Index Scan` instead of `Seq Scan`
- Low execution time (< 100ms for most queries)
- High `rows` to `actual rows` ratio

## Monitoring Index Performance

### Check Index Usage
```sql
SELECT * FROM v_department_index_usage;
```

### Monitor Query Performance
```sql
-- Check slow queries (if pg_stat_statements is enabled)
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements 
WHERE query ILIKE '%khoa_phong_quan_ly%'
ORDER BY mean_exec_time DESC;
```

## Troubleshooting

### Issue: "Permission denied to create index"
**Solution:** Contact your database administrator or use a user with CREATE privilege.

### Issue: "Index creation takes too long"
**Possible causes:**
- Large dataset (>100k records)
- High database load
- Insufficient resources

**Solutions:**
- Run during low-traffic hours
- Create indexes one by one instead of all at once
- Use `CREATE INDEX CONCURRENTLY` for production systems

### Issue: "Indexes not being used"
**Check:**
1. Run `ANALYZE` on tables
2. Verify query patterns match index structure
3. Check if query planner prefers sequential scan (normal for small tables)

### Issue: "Performance not improved"
**Possible causes:**
- Small dataset (indexes may not help)
- Query not using indexed columns
- Need different index structure

**Solutions:**
1. Use `EXPLAIN ANALYZE` to understand query execution
2. Check actual vs expected query patterns
3. Consider additional indexes for specific use cases

## Rollback Instructions

If you need to remove the indexes:

```sql
-- WARNING: This will remove all performance optimizations
DROP INDEX IF EXISTS idx_thiet_bi_khoa_phong_quan_ly;
DROP INDEX IF EXISTS idx_thiet_bi_dept_status;
DROP INDEX IF EXISTS idx_thiet_bi_dept_created;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_thiet_bi_id;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_status_date;
DROP INDEX IF EXISTS idx_nhan_vien_khoa_phong;
DROP INDEX IF EXISTS idx_nhan_vien_username_role;
DROP INDEX IF EXISTS idx_thiet_bi_ten_thiet_bi_lower;
DROP INDEX IF EXISTS idx_thiet_bi_ma_thiet_bi_lower;
DROP VIEW IF EXISTS v_department_index_usage;
```

## Maintenance

### Weekly Tasks
- Check index usage: `SELECT * FROM v_department_index_usage;`
- Monitor slow queries
- Review performance metrics in admin dashboard

### Monthly Tasks
- Run `ANALYZE` on main tables
- Check for unused indexes
- Review and optimize based on usage patterns

### Quarterly Tasks
- Full performance review
- Consider additional optimizations
- Update indexes based on new query patterns

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review PostgreSQL logs for errors
3. Use `EXPLAIN ANALYZE` to understand query behavior
4. Contact your database administrator if needed

## Success Criteria

After deployment, you should see:
- ✅ 50-80% faster department filtering queries
- ✅ Index usage > 80% for department-related queries
- ✅ No application errors
- ✅ Improved user experience for department users
- ✅ Performance dashboard showing good metrics (for admin users)
