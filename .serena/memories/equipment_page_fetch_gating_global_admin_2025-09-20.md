Title: Reduce initial DB queries for global/admin on Equipment page

Goal
- Avoid fetching equipment data on first load for global/admin users to reduce confusion and DB load.
- Only fetch after a tenant filter is selected: either a specific tenant or "all tenants".
- Preserve existing behavior for non-global users.

Approach
1) Introduce a tenant filter sentinel
- Add tenantFilter value 'unset' and default to it for global/admin.
- Non-global users keep existing behavior (no 'unset').

2) Gate data fetching with TanStack Query 'enabled'
- Compute shouldFetchEquipment: true for non-global; for global only when tenantFilter is 'all' or a numeric tenant id; false for 'unset'.
- Pass enabled: shouldFetchEquipment to useQuery for equipment_list_enhanced.

3) Cache partitioning and params
- effectiveTenantKey:
  - Non-global: existing tenantKey;
  - Global: 'unset' when gated off; 'all' for all-tenants; '<id>' for specific tenant.
- Query key: include { tenant: effectiveTenantKey, page, size, q, filters, sort } to keep caches scoped.
- RPC args: p_don_vi = null for 'all', numeric id for specific tenant, ignored when disabled.

4) Tenant select UI
- Add options: 'unset' = — Chọn đơn vị — (default), 'all' = Tất cả đơn vị, plus tenant list.
- Set initial value to 'unset' for global/admin.

5) UX tip when disabled
- When isGlobal && !shouldFetchEquipment, show tip instead of the table:
  "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị".
- Hide/disable export, pagination, and counts in this state.

6) Invalidation guard
- Skip invalidation when tenant is 'unset'.
- Continue using predicate that matches queryKey[1].tenant === effectiveTenantKey.

7) QA / Acceptance
- Global/admin: no initial equipment_list_enhanced calls; tip visible. Selecting tenant or 'all' fetches and renders data; switching back to 'unset' stops fetch and shows tip.
- Non-global: unchanged behavior.
- No spurious refetches.

Key edit points
- File: src/app/(app)/equipment/page.tsx
  - State: default tenantFilter to 'unset' for global/admin.
  - Derived: shouldFetchEquipment, effectiveTenantKey, selectedDonVi.
  - useQuery: add enabled: shouldFetchEquipment; include effectiveTenantKey in queryKey; pass selectedDonVi to RPC.
  - UI: tenant Select includes 'unset' + 'all'; tip shown when not fetching; table, export, pagination hidden in that case.
  - Invalidation: guard when 'unset'.

Risks / Edge cases
- Ensure QR-highlight or deep-link flows set tenantFilter appropriately (optional).
- Keep disabled state from triggering accidental background refetches.
- Confirm tenant list loads before showing select; handle empty tenant options gracefully.

Rollback plan
- If issues occur, set tenantFilter default back to 'all' for global/admin and remove enabled gating to restore current behavior.