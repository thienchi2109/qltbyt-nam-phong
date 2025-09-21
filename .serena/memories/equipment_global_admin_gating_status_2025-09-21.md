Status: Implemented global/admin fetch gating on Equipment page and persisted tenant selection.

What changed
- Gated equipment_list_enhanced fetch: no initial DB query for global/admin until tenant filter is selected.
- Tenant select now uses TanStack Query (['tenant_list']) with loading state; dropdown disabled while loading.
- Added tip when gated off: "Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị".
- Footer controls (export, pagination, counts) hidden when gated off.
- Cache invalidation guarded when tenant is 'unset'.
- Persisted tenant selection in localStorage (key: equipment_tenant_filter). Values: 'unset' | 'all' | <numeric id>.

Files touched
- src/app/(app)/equipment/page.tsx
- WARP.md (note about new behavior)
- README.md (note about new behavior)

Impact
- Reduces unnecessary initial DB queries for global/admin users, improving perceived load.
- Clearer UX: users explicitly choose a tenant before requesting data.
- Persistence improves continuity across visits.

Follow-ups
- QA scenarios for multiple tenants and "all" selection.
- Optional: persist tenantFilter to URL or add a quick reset control in UI.