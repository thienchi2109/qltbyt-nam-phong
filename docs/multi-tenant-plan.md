# Multi-tenant Plan (No-RLS, RPC-only)

This document summarizes the no-RLS multi-tenant architecture and provides guidance for applying Phase 1.

## Phase 1 (This PR)
- Schema changes via `supabase/migrations/20250914_multi_tenant_phase1.sql`:
  - `don_vi` table
  - Add `don_vi` to `nhan_vien` and `thiet_bi`
  - `nhan_vien.current_don_vi`
  - `user_don_vi_memberships`
  - Indexes and FKs
  - Backfill scaffold `khoa_phong_to_don_vi`
- Equipment RPCs:
  - `equipment_list(p_q, p_sort, p_page, p_page_size)`
  - `equipment_get(p_id)`
  - `equipment_create(p_payload jsonb)`
  - `equipment_update(p_id, p_patch jsonb)`
  - `equipment_delete(p_id)`

## Applying the migration
Run in Supabase SQL Editor or via CLI:

```sql
-- Review and run the migration content from supabase/migrations/20250914_multi_tenant_phase1.sql
```

After applying:
- Verify tables/columns created
- Grant EXECUTE on RPCs to `authenticated` (already in migration)
- Ensure `anon/authenticated` have no direct table privileges for new tables

## Next phases
- Backfill mapping
- Add maintenance/repairs/transfers RPCs
- Lock down legacy table privileges and refactor frontend to RPCs
- Implement Tenant Switcher and JWT refresh
