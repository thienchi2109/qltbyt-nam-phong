# Maintenance System Fixes - September 2025

## Session Overview (2025-09-28)
Resolved two critical issues in the maintenance planning system that were preventing proper functionality.

## Issue 1: Maintenance Plan Creation Error

### Problem
- PostgreSQL error 42601: "query has no destination for result data"
- `maintenance_plan_create` RPC function failed with syntax error
- Users couldn't create new maintenance plans

### Root Cause
```sql
-- BROKEN: No variable to capture RETURNING value
INSERT INTO ke_hoach_bao_tri(...) VALUES (...) RETURNING id;
```

### Solution
- **Migration**: `20250928044923_fix_maintenance_plan_create.sql`
- Added proper variable declaration and capture:
```sql
DECLARE
  v_new_id int;
BEGIN
  INSERT INTO ke_hoach_bao_tri(...) VALUES (...) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
```

## Issue 2: Equipment Display Problem

### Problem
- Equipment codes ("Mã TB") and names ("Tên thiết bị") displayed correctly in draft mode
- After saving and reloading from database, these fields appeared blank
- Frontend table columns used `row.original.thiet_bi?.ma_thiet_bi` (nested format)
- But RPC returned `ma_thiet_bi` (flat format)

### Root Cause Analysis
1. **Frontend Code**: Expected nested object format
   ```typescript
   cell: ({ row }) => row.original.thiet_bi?.ma_thiet_bi || '',
   cell: ({ row }) => row.original.thiet_bi?.ten_thiet_bi || '',
   ```

2. **RPC Function**: Returned flat fields only
   ```sql
   SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, ... FROM ...
   ```

3. **Save Process**: Stripped `thiet_bi` object before sending to backend
   ```typescript
   const { thiet_bi, ...dbData } = task; // Removed nested object
   ```

### Solution
- **Migration**: `20250928051317_fix_maintenance_tasks_equipment_schema.sql`
- Enhanced `maintenance_tasks_list_with_equipment` RPC to return BOTH formats:
  - **Flat fields**: `ma_thiet_bi`, `ten_thiet_bi` (backward compatibility)
  - **Nested object**: `thiet_bi` JSONB with equipment details

```sql
-- NEW: Added nested equipment object
CASE 
  WHEN tb.id IS NOT NULL THEN
    jsonb_build_object(
      'id', tb.id,
      'ma_thiet_bi', tb.ma_thiet_bi,
      'ten_thiet_bi', tb.ten_thiet_bi,
      'model', COALESCE(tb.model, ''),
      'khoa_phong_quan_ly', COALESCE(tb.khoa_phong_quan_ly, ''),
      'vi_tri_lap_dat', COALESCE(tb.vi_tri_lap_dat, ''),
      'hang_san_xuat', COALESCE(tb.hang_san_xuat, ''),
      'noi_san_xuat', COALESCE(tb.noi_san_xuat, ''),
      'nam_san_xuat', tb.nam_san_xuat,
      'serial', COALESCE(tb.serial, '')
    )
  ELSE NULL
END as thiet_bi
```

## Important Schema Details

### Equipment Table (`thiet_bi`) Columns
- `ma_thiet_bi` (text) - Equipment code
- `ten_thiet_bi` (text) - Equipment name
- `model` (text) - Model
- `serial` (text) - Serial number (NOT `serial_number`)
- `hang_san_xuat` (text) - Manufacturer (NOT `nha_san_xuat`)
- `noi_san_xuat` (text) - Manufacturing location (NOT `nuoc_san_xuat`)
- `nam_san_xuat` (integer) - Manufacturing year
- `khoa_phong_quan_ly` (text) - Managing department
- `vi_tri_lap_dat` (text) - Installation location
- `don_vi` (bigint) - Tenant ID

## System Architecture Notes

### Data Flow
1. **Draft Mode**: Equipment added with nested `thiet_bi` object from AddTasksDialog
2. **Save Process**: Nested `thiet_bi` stripped before sending to backend
3. **Reload**: RPC returns both flat fields AND nested `thiet_bi` object
4. **Display**: Frontend can access either format

### Security & Tenancy
- All RPCs include proper tenant filtering via JWT claims
- Global users see all tenants, non-global users see only their tenant
- Equipment data filtered by `tb.don_vi = v_effective_donvi`

## Migration Safety
- Both migrations are **additive only** - no breaking changes
- Full backward compatibility maintained
- Existing code continues to work unchanged
- New functionality available for frontend consumption

## Testing Verification
- ✅ Maintenance plan creation works
- ✅ Equipment codes display correctly in draft mode
- ✅ Equipment codes display correctly after save/reload
- ✅ All existing functionality preserved
- ✅ Tenant filtering works correctly

## Files Modified
1. `supabase/migrations/20250928044923_fix_maintenance_plan_create.sql`
2. `supabase/migrations/20250928051317_fix_maintenance_tasks_equipment_schema.sql`

## Future Considerations
- Monitor performance impact of JSONB object generation
- Consider migrating other equipment-related RPCs to consistent nested format
- Evaluate if frontend can be simplified to use single data format
