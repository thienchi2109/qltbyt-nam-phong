# Implementation Tasks

## 1. Database Migration
- [ ] 1.1 Create migration file `supabase/migrations/YYYYMMDDHHMMSS_global_search_vietnamese_fts.sql`
- [ ] 1.2 Enable `unaccent` extension
- [ ] 1.3 Create `vietnamese_unaccent` text search configuration (unaccent + simple dictionary)
- [ ] 1.4 Add `search_vector` generated column to `thiet_bi` (weighted: ten_thiet_bi=A, ma_thiet_bi=A, model=B, mo_ta=C)
- [ ] 1.5 Add `search_vector` generated column to `yeu_cau_sua_chua` (weighted: mo_ta_su_co=A, hang_muc_sua_chua=B, nguyen_nhan=C)
- [ ] 1.6 Add `search_vector` generated column to `yeu_cau_luan_chuyen` (weighted: ma_yeu_cau=A, ly_do_luan_chuyen=B)
- [ ] 1.7 Add `search_vector` generated column to `ke_hoach_bao_tri` (weighted: ten_ke_hoach=A, mo_ta=B)
- [ ] 1.8 Add `search_vector` generated column to `nhan_vien` (weighted: full_name=A, username=B)
- [ ] 1.9 Create composite GIN index `idx_thiet_bi_tenant_search_vector` on `(don_vi, search_vector)`
- [ ] 1.10 Create GIN index `idx_yeu_cau_sua_chua_search_vector` on `search_vector` + FK index on `thiet_bi_id`
- [ ] 1.11 Create GIN index `idx_yeu_cau_luan_chuyen_search_vector` on `search_vector` + FK index on `thiet_bi_id`
- [ ] 1.12 Create composite GIN index `idx_ke_hoach_bao_tri_tenant_search_vector` on `(don_vi, search_vector)`
- [ ] 1.13 Create composite GIN index `idx_nhan_vien_tenant_search_vector` on `(don_vi, search_vector)`
- [ ] 1.14 Create `global_search(p_query TEXT, p_don_vi BIGINT, p_entity_types TEXT[], p_limit INT)` RPC function
- [ ] 1.15 Implement tenant isolation using `allowed_don_vi_for_session_safe()`
- [ ] 1.16 Implement UNION ALL search across 5 entities with `plainto_tsquery('vietnamese_unaccent', p_query)`
- [ ] 1.17 Return JSONB array with entity metadata and `ts_rank()` scores
- [ ] 1.18 Grant EXECUTE permission to `authenticated` role
- [ ] 1.19 Add performance testing queries (commented)
- [ ] 1.20 Add ANALYZE statements for query planner statistics
- [ ] 1.21 Test migration in Supabase SQL Editor
- [ ] 1.22 Verify search vectors generated correctly with sample queries
- [ ] 1.23 Run EXPLAIN ANALYZE on global_search with various inputs
- [ ] 1.24 Commit migration file to repository

## 2. Backend RPC Proxy Integration
- [ ] 2.1 Open `src/app/api/rpc/[fn]/route.ts`
- [ ] 2.2 Add `'global_search'` to `ALLOWED_FUNCTIONS` Set (after `'header_notifications_summary'`, line ~114)
- [ ] 2.3 Add comment: `// Vietnamese accent-insensitive global search`
- [ ] 2.4 Test RPC proxy with Postman/curl for all user roles (global, regional_leader, to_qltb, user)
- [ ] 2.5 Verify tenant isolation: non-global user cannot access other tenant's data
- [ ] 2.6 Verify proxy overrides `p_don_vi` for non-global/non-regional users

## 3. TypeScript Type Definitions
- [ ] 3.1 Open `src/types/database.ts`
- [ ] 3.2 Add `GlobalSearchResult` interface with fields: entity_type, entity_id, title, code, snippet, rank, don_vi, facility_name, created_at
- [ ] 3.3 Add `EntityType` type alias: 'equipment' | 'repair' | 'transfer' | 'maintenance' | 'user'
- [ ] 3.4 Add `ENTITY_TYPE_LABELS` constant mapping EntityType to Vietnamese labels
- [ ] 3.5 Run `npm run typecheck` to verify types

## 4. Client-Side React Hook
- [ ] 4.1 Create `src/hooks/use-global-search.ts`
- [ ] 4.2 Import TanStack Query `useQuery` and `callRpc`
- [ ] 4.3 Define `UseGlobalSearchParams` interface with: query, donVi, entityTypes, limit, enabled
- [ ] 4.4 Implement `useGlobalSearch` hook with stable queryKey
- [ ] 4.5 Set query enabled condition: `enabled && query.trim().length >= 2`
- [ ] 4.6 Set staleTime to 30000ms (30 seconds)
- [ ] 4.7 Return TanStack Query result with GlobalSearchResult[] type
- [ ] 4.8 Test hook with sample queries in browser console

## 5. Testing
- [ ] 5.1 Test Vietnamese accent-insensitive search: "may xet nghiem" matches "Máy xét nghiệm"
- [ ] 5.2 Test cross-entity search: query returns results from multiple entities
- [ ] 5.3 Test tenant isolation: non-global user only sees their tenant
- [ ] 5.4 Test regional leader: sees all tenants in their region
- [ ] 5.5 Test global user: can search all tenants or filter by specific tenant
- [ ] 5.6 Test entity_types filter: only returns specified entity types
- [ ] 5.7 Test limit parameter: respects result count limit
- [ ] 5.8 Test empty query: returns empty array
- [ ] 5.9 Test special characters and SQL injection attempts
- [ ] 5.10 Performance test: verify <200ms for single-entity, <500ms for all entities

## 6. Documentation
- [ ] 6.1 Update `CLAUDE.md` with global_search RPC function reference
- [ ] 6.2 Add usage examples to migration file comments
- [ ] 6.3 Document query performance benchmarks
- [ ] 6.4 Add troubleshooting guide for common issues

## 7. Deployment
- [ ] 7.1 Review migration idempotency (safe to run multiple times)
- [ ] 7.2 Schedule migration during low-traffic period
- [ ] 7.3 Run migration in Supabase SQL Editor
- [ ] 7.4 Monitor index build progress (expect 2-5 minutes)
- [ ] 7.5 Verify no errors in Supabase logs
- [ ] 7.6 Deploy backend changes (RPC proxy whitelist)
- [ ] 7.7 Deploy TypeScript types and hook
- [ ] 7.8 Monitor performance metrics in production
- [ ] 7.9 Collect initial user feedback

## Notes
- This is a backend-focused change; UI components for global search dialog are NOT included
- UI implementation can be done in a separate change proposal (e.g., `add-global-search-ui`)
- Migration is non-destructive and idempotent (safe to retry)
- Rollback procedure included in migration file (commented out)
