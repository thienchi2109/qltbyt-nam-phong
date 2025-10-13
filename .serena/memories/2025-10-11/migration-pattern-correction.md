# Migration Pattern Correction: Transfer Request Facilities RPC

**Date:** October 11, 2025  
**Issue:** Inconsistent SQL pattern with repair requests reference implementation  
**Status:** ✅ Fixed  

---

## Problem Discovered

During code review, user identified that my initial migration didn't match the established pattern used in `get_repair_request_facilities()`.

### Initial Pattern (Wrong - Used EXISTS)
```sql
SELECT jsonb_agg(
  jsonb_build_object('id', dv.id, 'name', dv.name)
  ORDER BY dv.name
)
FROM don_vi dv
WHERE EXISTS (
  SELECT 1 FROM yeu_cau_luan_chuyen yc
  JOIN thiet_bi tb ON yc.thiet_bi_id = tb.id
  WHERE tb.don_vi = dv.id
);
```

**Issues:**
- ❌ Different pattern than repair requests (inconsistent)
- ❌ Uses `EXISTS` subquery instead of `INNER JOIN`
- ❌ Doesn't explicitly check `tb.don_vi IS NOT NULL`
- ❌ Missing `DISTINCT` clause (could cause duplicates)

---

## Investigation Using Supabase MCP Tools

### 1. Verified Schema Structure
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'yeu_cau_luan_chuyen'
ORDER BY ordinal_position;
```

**Confirmed:**
- ✅ `yeu_cau_luan_chuyen.thiet_bi_id` → `thiet_bi.id`
- ✅ `thiet_bi.don_vi` → `don_vi.id`
- ✅ No direct `don_vi` column on transfer requests table
- ✅ Join path: `yeu_cau_luan_chuyen → thiet_bi → don_vi`

### 2. Retrieved Reference Implementation
```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_repair_request_facilities';
```

**Found the correct pattern:**
```sql
SELECT DISTINCT dv.id, dv.name
FROM yeu_cau_sua_chua r
INNER JOIN thiet_bi tb ON tb.id = r.thiet_bi_id
INNER JOIN don_vi dv ON dv.id = tb.don_vi
WHERE tb.don_vi IS NOT NULL
```

### 3. Tested Corrected Query Logic
```sql
-- Verified query works (returns NULL because no transfer requests exist yet)
SELECT jsonb_agg(...)
FROM (
  SELECT DISTINCT dv.id, dv.name
  FROM yeu_cau_luan_chuyen yc
  INNER JOIN thiet_bi tb ON tb.id = yc.thiet_bi_id
  INNER JOIN don_vi dv ON dv.id = tb.don_vi
  WHERE tb.don_vi IS NOT NULL
) dv;
```

---

## Corrected Pattern (Now Matches Repair Requests)

### Global Users Query
```sql
IF v_role = 'global' THEN
  SELECT jsonb_agg(
    jsonb_build_object('id', dv.id, 'name', dv.name)
    ORDER BY dv.name
  )
  INTO v_result
  FROM (
    SELECT DISTINCT dv.id, dv.name
    FROM public.yeu_cau_luan_chuyen yc
    INNER JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
    INNER JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE tb.don_vi IS NOT NULL
  ) dv;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END IF;
```

### Non-Global Users Query
```sql
SELECT jsonb_agg(
  jsonb_build_object('id', dv.id, 'name', dv.name)
  ORDER BY dv.name
)
INTO v_result
FROM (
  SELECT DISTINCT dv.id, dv.name
  FROM public.yeu_cau_luan_chuyen yc
  INNER JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
  INNER JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE tb.don_vi = ANY(v_allowed_don_vi)  -- Tenant isolation
    AND tb.don_vi IS NOT NULL
) dv;
```

---

## Key Differences: EXISTS vs INNER JOIN Pattern

### EXISTS Pattern (Initial - Wrong)
```sql
FROM don_vi dv
WHERE EXISTS (SELECT 1 FROM yeu_cau_luan_chuyen yc ...)
```

**Characteristics:**
- Scans all facilities first, then filters
- Can be slower with large facility tables
- Less explicit about join relationships
- Different pattern than established codebase

### INNER JOIN + DISTINCT Pattern (Corrected - Right)
```sql
FROM (
  SELECT DISTINCT dv.id, dv.name
  FROM yeu_cau_luan_chuyen yc
  INNER JOIN thiet_bi tb ON tb.id = yc.thiet_bi_id
  INNER JOIN don_vi dv ON dv.id = tb.don_vi
) dv
```

**Characteristics:**
- ✅ Starts from transfer requests (likely smaller table)
- ✅ More explicit join relationships
- ✅ DISTINCT ensures no duplicate facilities
- ✅ Matches repair requests pattern (consistency)
- ✅ More maintainable (follows established convention)

---

## Why Pattern Consistency Matters

### 1. Maintainability
- Developers expect same pattern across similar functions
- Easier to understand when patterns are consistent
- Reduces cognitive load during code review

### 2. Testing
- Same test cases can be applied to both functions
- Edge cases handled consistently
- Security model identical

### 3. Performance Predictability
- Query planner behaves similarly
- Index usage patterns consistent
- Performance characteristics known

### 4. Code Quality
- Follows established conventions (from `copilot-instructions.md`)
- Adheres to "Project Convention Supremacy" principle
- Easier to spot anomalies when patterns diverge

---

## Verification Steps Taken

### 1. Schema Validation ✅
- Confirmed table structure matches schema.md
- Verified join path: `yeu_cau_luan_chuyen → thiet_bi → don_vi`
- Checked for NULL don_vi values (none found: 146/146 equipment have facilities)

### 2. Reference Implementation Review ✅
- Retrieved actual `get_repair_request_facilities()` definition
- Compared SQL patterns line-by-line
- Identified differences and corrected

### 3. Query Logic Testing ✅
- Tested corrected query with Supabase MCP tools
- Verified returns NULL for empty table (correct behavior)
- Confirmed COALESCE handles NULL → `[]` conversion

### 4. TypeScript Compilation ✅
- Ran `npm run typecheck`
- No errors (frontend code unchanged)

---

## Database State Observations

**Equipment (thiet_bi):**
- Total: 146 records
- With facility: 146 (100%)
- Without facility: 0

**Transfer Requests (yeu_cau_luan_chuyen):**
- Total: 0 records
- Expected behavior: Function returns `[]` (empty array)

**Repair Requests (yeu_cau_sua_chua):**
- Unknown count (not queried)
- Has established working pattern

---

## Files Modified

### `supabase/migrations/20251011180000_add_get_transfer_request_facilities.sql`

**Changes:**
1. Global users query: Changed from `EXISTS` to `INNER JOIN + DISTINCT` pattern
2. Non-global users query: Changed from `EXISTS` to `INNER JOIN + DISTINCT` pattern
3. Added explicit `tb.don_vi IS NOT NULL` check
4. Added subquery wrapping for aggregation

**Lines Changed:** ~20 lines in 2 query blocks

---

## Lessons Learned

### 1. Always Check Reference Implementations
- Don't assume patterns - verify with actual code
- Use MCP tools to retrieve function definitions
- Database is source of truth, not assumptions

### 2. MCP Tools Are Powerful
- `execute_sql` for schema inspection
- `pg_get_functiondef()` for retrieving existing functions
- Test query logic before committing migrations

### 3. Pattern Consistency Is Critical
- EXISTS vs INNER JOIN can have different implications
- Follow established patterns even if alternatives exist
- Document deviations if intentional

### 4. User Review Catches Issues
- Code review is valuable (caught pattern mismatch)
- "Examine schema more carefully" was the right call
- MCP tools enable confident verification

---

## Testing Recommendations

When migration is applied, test with:

1. **Empty Database State:**
   - Expected: `[]` (empty array)
   - Verified: ✅ Works with test query

2. **Single Transfer Request:**
   - Create 1 transfer request
   - Expected: 1 facility in result

3. **Multiple Transfer Requests, Same Facility:**
   - Create 2+ transfers for same facility
   - Expected: Only 1 facility in result (DISTINCT works)

4. **Transfer Requests Across Multiple Facilities:**
   - Create transfers for different facilities
   - Expected: All unique facilities in result

5. **Role-Based Filtering:**
   - Test as global: See all facilities
   - Test as regional_leader: See only region's facilities
   - Test as regular user: No dropdown (handled by frontend)

---

## Migration Safety Confirmation

✅ **Idempotent:** `CREATE OR REPLACE FUNCTION` - safe to re-run  
✅ **No Data Changes:** Function creation only, no data modification  
✅ **No Breaking Changes:** New function, existing code continues working  
✅ **Backward Compatible:** Frontend will use after deployment  
✅ **Matches Pattern:** Now identical to repair requests pattern  
✅ **TypeScript Passes:** No compilation errors  

---

## Conclusion

The migration has been corrected to match the established `get_repair_request_facilities()` pattern. The use of Supabase MCP tools enabled confident verification of:
- Schema structure
- Reference implementation
- Query logic correctness

This correction ensures consistency across the codebase and follows the "Project Convention Supremacy" principle from the project's coding standards.

**Status:** ✅ Ready for deployment (after manual testing)

---

**Related Documents:**
- `.serena/memories/2025-10-11/facility-filter-consolidation.md`
- `.serena/memories/2025-10-11/transfers-server-side-filtering-migration.md`
- `supabase/migrations/20251011150858_add_get_repair_request_facilities.sql` (reference)
