# Current Issues and Work Items

## Critical Issue: Repair Requests Page Crash (P0)
**Status**: Identified, awaiting implementation  
**Severity**: Critical  
**File**: `src/app/(app)/repair-requests/page.tsx`  
**Affected Role**: `regional_leader` (primarily), all users  
**Created**: 2025-10-10  
**Document**: `docs/Issues/GITHUB_ISSUE_REPAIR_CRASH.md`

### Root Causes Identified (4)

#### Issue #1: Null Safety in useFacilityFilter (CRITICAL)
- **Location**: `src/hooks/useFacilityFilter.ts:142`
- **Problem**: Unsafe comparison `(getName(it) || null) === selectedFacilityName`
- **Impact**: Incorrect filtering → empty/wrong results → React Table state corruption

#### Issue #2: Incorrect Count Calculations (HIGH)
- **Location**: `page.tsx:1981, 1997`
- **Problem**: Counts computed from unfiltered `requests` instead of displayed `tableData`
- **Impact**: User confusion, incorrect metrics, potential state corruption

#### Issue #3: Accessor Function Null Safety (MEDIUM)
- **Location**: `page.tsx:1109`
- **Problem**: Returns `"undefined undefined"` when `thiet_bi` is null
- **Impact**: Broken sorting, visual bugs, search/filter logic errors

#### Issue #4: React Table State Corruption (HIGH)
- **Problem**: Repeated filtering causes state corruption
- **Impact**: Application crashes/freezes

### Fix Plan (3 Phases)

**Phase 1: Immediate Hotfix** (2-4 hours)
- Fix null safety in useFacilityFilter
- Add null checks to accessor functions
- Use tableData for counts
- Add defensive null checks throughout

**Phase 2: Medium-term Enhancements** (1 sprint)
- Database schema updates for data integrity
- Improved error boundaries
- Better state management

**Phase 3: Long-term Safety** (1 sprint)
- Comprehensive test coverage
- Monitoring and alerting
- Performance optimization

## Recent Work (October 2, 2025)

### Login Page Improvements ✅
1. **Logo Circle Fix**: Added `flex-shrink-0` and `aspect-square`
2. **Logo Repositioning**: Moved to login form area
3. **Development Account Selector**: Quick login for 3 account types
   - `soyte_admin` (Sở Y Tế - System Admin)
   - `benhvien_qldt` (Bệnh viện - Unit Manager)
   - `bacsi_nguyen` (Bác sĩ - Practitioner)

### Database Setup ✅
- **Project**: Neon PostgreSQL (endpoint: ep-polished-night-a1su6evx)
- **Schema Migration**: `v_1_init_schema.sql` ran successfully
- **Seed Data**: 15 organizations, 8 accounts, 3 practitioners

## Equipment Page Behavior Note
- For global/admin users: No initial fetch until tenant filter selected
- Tip displayed: "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị"
- Last tenant selection remembered in localStorage: `equipment_tenant_filter`
- TanStack Query with `enabled` gating and scoped caching
