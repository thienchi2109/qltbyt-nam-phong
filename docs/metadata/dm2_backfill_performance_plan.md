# Backfill & Performance Implementation Plan (DM-2)

## Overview
This document captures the detailed execution plan for DM-2 as part of the regional leader rollout. The objective is to populate `dia_ban` data, assign all existing organizational units and staff to their respective regions, and ensure the database remains performant ahead of claim propagation and RPC rewrites.

## Deliverables Summary ✅
- ✅ Data backfill migration: `20250927_regional_leader_backfill.sql`
- ✅ Regional mappings for current production `don_vi`
- ✅ Staff alignment to `dia_ban`
- ✅ Refresh utilities and diagnostic view for verification
- ✅ Performance indexes tailored to multi-tenant area queries
- ✅ ANALYZE guidance and verification queries

## Backfill Strategy

### 1. Regional Dataset Provisioning
- Root region `VN_QUOC_GIA` anchors the hierarchy.
- Child regions reflect current tenants:
  - `VN_TP_HCM`: Governs `YKPNT`
  - `VN_CAN_THO`: Governs `CDC`
  - `VN_DOANH_NGHIEP`: Covers `CVMEMS`
- Upserts maintain idempotency; re-running the migration keeps names/leadership current while preserving historical IDs.

### 2. Organizational Unit Mapping
- `don_vi.code` → `dia_ban.ma_dia_ban` mapping stored inline for transparency.
- Fallback assigns any future/unmapped `don_vi` to `VN_QUOC_GIA` (prevents NULL leaks while signaling missing governance data).
- Diagnostic view `v_don_vi_dia_ban_check` simplifies verification and can underpin future admin dashboards.

### 3. Staff Assignment Logic
- Staff inherits `dia_ban_id` from `current_don_vi` when available, otherwise from `don_vi`.
- Global users retain the dia_ban of their home unit; true roaming accounts without a unit stay NULL for now and are handled during AUTH-1.
- Update is idempotent—reruns keep the latest mapping from `don_vi` changes.

## Performance Enhancements

### Index Additions
1. `idx_don_vi_dia_ban_active (dia_ban_id, active, id)`
   - Supports region dashboards and WHERE filters like `dia_ban_id = ANY($1)` with active-only constraints.
2. `idx_nhan_vien_dia_ban_role (dia_ban_id, role)` (partial)
   - Accelerates admin panels listing staff per region and protects the `/api/tenants/**` expansions planned in API/UI-1.

Existing indexes on `thiet_bi`, `yeu_cau_sua_chua`, and `yeu_cau_luan_chuyen` already cover joins via `thiet_bi.don_vi`. No additional indexes are required until RPC-1 introduces broader regional aggregates.

### Statistics Maintenance
- `ANALYZE` statements embedded in the migration for `dia_ban`, `don_vi`, and `nhan_vien`.
- Post-deployment: schedule `ANALYZE` via maintenance job (or manual execution) after large imports or restructuring.

## Verification & Diagnostics

### Automated Checks (Post-Migration)
```sql
SELECT * FROM public.verify_regional_leader_schema();
SELECT * FROM public.v_don_vi_dia_ban_check ORDER BY don_vi_id;
SELECT id, username, role, dia_ban_id FROM public.nhan_vien ORDER BY id;
SELECT ma_dia_ban, so_luong_don_vi_truc_thuoc FROM public.dia_ban ORDER BY sort_order;
```

### Additional Validation Queries
- **Orphan detection**
  ```sql
  SELECT dv.id, dv.code
  FROM public.don_vi dv
  WHERE dv.dia_ban_id IS NULL;
  ```
- **Staff without coverage**
  ```sql
  SELECT nv.id, nv.username, nv.role
  FROM public.nhan_vien nv
  WHERE nv.dia_ban_id IS NULL AND nv.role <> 'global';
  ```
- **Region coverage summary**
  ```sql
  SELECT db.ma_dia_ban,
         COUNT(DISTINCT dv.id) AS don_vi_count,
         COUNT(DISTINCT nv.id) FILTER (WHERE nv.role = 'regional_leader') AS regional_leaders
  FROM public.dia_ban db
  LEFT JOIN public.don_vi dv ON db.id = dv.dia_ban_id
  LEFT JOIN public.nhan_vien nv ON db.id = nv.dia_ban_id
  GROUP BY db.ma_dia_ban
  ORDER BY db.sort_order;
  ```

## Interplay with RPCs & NextAuth
- **NextAuth / JWT**: No schema changes required yet, but dia_ban assignments ensure upcoming `authenticate_user_dual_mode` enhancements will have consistent data to pull from.
- **Equipment & Maintenance RPCs**: Continue filtering by `don_vi`; the new helper function (`allowed_don_vi_for_session`) returns multi-tenant arrays but still resolves to existing `don_vi` IDs, so legacy WHERE clauses remain valid until RPC-1 updates them to use `= ANY` semantics.
- **Tenant APIs**: Backfilled dia_ban values enable `/api/tenants/*` endpoints to expose regional groupings with no additional database calls during AUTH-1/API/UI-1.

## Rollback & Safety
- Migration includes an explicit rollback block (reset assignments, drop helper artifacts, optionally delete inserted regions).
- Idempotent design allows safe re-application after partial failures.
- All write operations occur inside a single transaction for atomicity.

## Dependencies & Next Steps
- ✅ DM-1 (schema foundation) complete.
- ▶️ AUTH-1: will piggyback on populated `dia_ban_id` for JWT claims.
- ▶️ RPC-1: will reuse `refresh_dia_ban_unit_counts()` and the diagnostic view while enforcing regional read logic.
- ▶️ API/UI-1: can surface `v_don_vi_dia_ban_check` as the source for region selectors.

## Success Criteria ✅
- All `don_vi` rows assigned to a valid `dia_ban_id`.
- All non-global staff assigned to a valid `dia_ban_id`.
- Region counts accurately reflect assignments.
- New indexes present and used in query plans (verify with `EXPLAIN`).
- ANALYZE executed for refreshed statistics.

---
**Phase**: DM-2 Backfill & Performance  
**Status**: ✅ COMPLETE  
**Date**: September 27, 2025  
**Next Phase**: AUTH-1 Claims Propagation