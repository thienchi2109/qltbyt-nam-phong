# Equipment Page Optimization - September 17, 2025

## Summary
- Implemented server-side pagination and filtering via new RPC `equipment_list_enhanced`.
- Added performance indexes on `thiet_bi` for tenant/status/department and search.
- Switched Equipment page to use TanStack Query with server-driven pagination, single-select server filters, and tenant-scoped cache keys.
- Added granular cache invalidation per-tenant; updated realtime and tenant-switch handlers to only refetch current-tenant queries.
- Polished loading UX: skeletons on initial load; overlay spinner during background refetches; responsive tenant select with `startTransition`.
- Added AbortSignal support to RPC client for request dedup/cancellation during rapid filter changes.

## Files Changed
- supabase/migrations/20250917_equipment_list_enhanced_and_indexes.sql
- supabase/migrations/20250917_equipment_list_enhanced_v2.sql (applied to fix 400s)
- src/app/api/rpc/[fn]/route.ts (whitelist + debug logging)
- src/lib/rpc-client.ts (AbortSignal + error logging)
- src/app/(app)/equipment/page.tsx (use enhanced RPC; manual pagination; tenant-scoped invalidation; loading overlay)

## Current Behavior
- Query: `equipment_list_enhanced` returns JSONB `{data,total,page,pageSize}` with proper tenant isolation; global may filter `p_don_vi`.
- UI: Page size selector (10/20/50/100), server-side sort synced with TanStack sorting, single-select server filters for khoa_phong, tinh_trang, phan_loai. Export still client-side (current page rows).
- Caching: Query key includes tenant/page/size/search/sort/filters; invalidation scoped to current tenant. Realtime and tenant switch trigger scoped invalidation.

## Validation
- Typecheck: passes. Lint: interactive prompt unchanged. 400 error resolved by v2 RPC.

## Next Options
- Add multi-select server filters (SQL IN with array params).
- Add server-side export RPC for full dataset.
- Consider virtual scrolling for very large visible pages.
