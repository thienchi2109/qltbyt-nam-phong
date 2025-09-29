# Schema Foundation Implementation Plan (DM-1)

## Overview
This document outlines the detailed implementation strategy for the Regional Leader Role Schema Foundation phase.

## Deliverables Summary ✅

### 1. Database Schema Changes
- ✅ **dia_ban table**: Created with hierarchical support, governance columns, and proper constraints
- ✅ **Foreign key columns**: Added `dia_ban_id` to both `don_vi` and `nhan_vien` tables
- ✅ **Helper function**: `allowed_don_vi_for_session()` for session-based access control
- ✅ **Indexes**: Performance indexes for joins and filtering operations
- ✅ **Verification function**: `verify_regional_leader_schema()` for post-migration validation

### 2. Migration Structure
- ✅ **File**: `20250927_regional_leader_schema_foundation.sql`
- ✅ **Transaction safety**: Wrapped in BEGIN/COMMIT with rollback plan
- ✅ **Non-breaking**: Existing data remains intact, new columns nullable initially
- ✅ **Verification**: Built-in validation checks and sample data

### 3. Documentation
- ✅ **Canonical dataset**: `docs/metadata/dia_ban_canonical_dataset.md`
- ✅ **Migration documentation**: Inline comments and rollback procedures
- ✅ **Change control process**: Defined governance for dia_ban modifications

## Technical Architecture Decisions

### 1. Hierarchical Design
**Decision**: Support parent-child relationships in dia_ban table
**Rationale**: Vietnamese administrative structure is inherently hierarchical (Province → District → Commune)
**Implementation**: `parent_id` self-referencing foreign key with proper indexing

### 2. Gradual Migration Strategy
**Decision**: Nullable foreign keys initially, constraints added after backfill
**Rationale**: Production safety - avoid breaking existing system during migration
**Implementation**: 
- Add columns as nullable
- Populate during backfill phase (DM-2)
- Add NOT NULL constraints in later migration

### 3. Security-First Access Control
**Decision**: Helper function with JWT claims parsing for access control
**Rationale**: Centralized logic, consistent with existing RPC security model
**Implementation**: `allowed_don_vi_for_session()` function with role-based logic

### 4. Performance Optimization
**Decision**: Covering indexes for high-volume table joins
**Rationale**: Regional queries will use `= ANY(array)` patterns requiring efficient filtering
**Implementation**: Strategic indexes on foreign keys and commonly filtered columns

## Schema Design Details

### dia_ban Table Structure
```sql
CREATE TABLE public.dia_ban (
    -- Core identification
    id BIGSERIAL PRIMARY KEY,
    ma_dia_ban TEXT NOT NULL UNIQUE,
    ten_dia_ban TEXT NOT NULL,
    
    -- Leadership and capacity
    ten_lanh_dao TEXT,
    so_luong_don_vi_truc_thuoc INTEGER NOT NULL DEFAULT 0,
    
    -- Geographic info
    dia_chi TEXT,
    logo_dia_ban_url TEXT,
    
    -- Hierarchy and governance
    cap_do TEXT,
    parent_id BIGINT REFERENCES public.dia_ban(id),
    active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Access Control Logic
```sql
-- Regional leader access pattern
WHEN 'regional_leader' THEN
    SELECT array_agg(id) INTO v_allowed_don_vi 
    FROM public.don_vi 
    WHERE dia_ban_id = v_user_dia_ban 
    AND active = true;
```

### Index Strategy
- `idx_dia_ban_ma_dia_ban`: Unique constraint on regional code
- `idx_dia_ban_parent_active`: Hierarchical queries optimization  
- `idx_don_vi_dia_ban_id`: Foreign key join performance
- `idx_nhan_vien_dia_ban_id`: User-region association queries

## Validation & Testing

### Schema Validation
The migration includes a verification function:
```sql
SELECT * FROM public.verify_regional_leader_schema();
```

Expected results:
- `dia_ban_table_exists`: PASS
- `don_vi_dia_ban_id_column`: PASS  
- `nhan_vien_dia_ban_id_column`: PASS
- `allowed_don_vi_function`: PASS
- `dia_ban_indexes`: PASS

### Data Integrity Checks
Post-migration verification queries:
1. **Orphaned records check**: Ensure no dangling foreign keys
2. **Function execution test**: Verify helper function works with different roles
3. **Index usage analysis**: Confirm query plans use new indexes
4. **Sample data validation**: Check initial dia_ban record creation

## Dependencies & Prerequisites

### Before Migration
- ✅ Current database schema understood
- ✅ Existing migration pattern analyzed  
- ✅ Rollback procedures documented
- ✅ Canonical dataset defined

### After Migration (Next Phase - DM-2)
- [ ] Backfill existing don_vi with dia_ban assignments
- [ ] Create regional_leader user accounts
- [ ] Add NOT NULL constraints after data population
- [ ] Performance testing with regional queries

## Risk Assessment & Mitigation

### High Risk Items
1. **Production Impact**: Schema changes on live system
   - **Mitigation**: Non-breaking migration, gradual rollout
   
2. **Performance Degradation**: New indexes and joins
   - **Mitigation**: Strategic indexing, ANALYZE after creation
   
3. **Data Consistency**: Foreign key integrity during backfill
   - **Mitigation**: Verification functions, transaction safety

### Medium Risk Items
1. **JWT Claims Compatibility**: New dia_ban claim requirement
   - **Mitigation**: Graceful fallback in helper function
   
2. **Helper Function Logic**: Complex role-based access patterns
   - **Mitigation**: Comprehensive testing, clear error messages

## Deployment Instructions

### Pre-Deployment
1. **Backup Database**: Full backup of production system
2. **Staging Test**: Run migration on staging environment
3. **Performance Baseline**: Capture current query performance metrics
4. **Stakeholder Notification**: Inform teams of scheduled changes

### Deployment Steps
1. **Execute Migration**: Run `20250927_regional_leader_schema_foundation.sql`
2. **Verify Schema**: Execute verification function
3. **Update Statistics**: Run ANALYZE on affected tables
4. **Monitor Performance**: Check query execution plans
5. **Validate Sample Data**: Confirm initial dia_ban record exists

### Post-Deployment
1. **Performance Monitoring**: Watch for slow queries
2. **Error Log Review**: Check for constraint violations
3. **Function Testing**: Test helper function with different user contexts
4. **Documentation Update**: Mark schema foundation as complete

## Success Criteria

### Functional Requirements ✅
- [x] dia_ban table created with proper structure
- [x] Foreign key columns added to don_vi and nhan_vien  
- [x] Helper function implements role-based access control
- [x] Indexes support efficient regional queries
- [x] Migration is transaction-safe and reversible

### Non-Functional Requirements ✅  
- [x] Zero downtime deployment (nullable columns initially)
- [x] Performance impact minimized (strategic indexing)
- [x] Security model maintained (SECURITY DEFINER functions)
- [x] Documentation complete (canonical dataset, procedures)
- [x] Rollback plan available (commented in migration)

## Next Phase Integration

### DM-2 Preparation
The schema foundation enables the next phase (Backfill & Performance):
- Tables ready for data population
- Indexes in place for efficient updates
- Helper function available for validation
- Verification tools ready for testing

### Expected Handoff Artifacts
- Migration file executed successfully
- Verification results documented
- Performance baseline captured
- Canonical dataset ready for backfill mapping

---

**Phase**: DM-1 Schema Foundation  
**Status**: ✅ **COMPLETE**  
**Date**: September 27, 2025
**Next Phase**: DM-2 Backfill & Performance