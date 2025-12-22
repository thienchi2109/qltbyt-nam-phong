# Add Vietnamese Global Search

## Why

Users currently need to navigate to specific sections (equipment, repairs, transfers, maintenance, users) to search for information. This creates friction in workflows where staff need to quickly find information across multiple entity types. A unified global search with Vietnamese accent-insensitive matching will significantly improve user productivity and system usability.

The existing search implementations use simple ILIKE queries which:
- Don't handle Vietnamese diacritics well (searching "may xet nghiem" won't find "Máy xét nghiệm")
- Only search within specific entity types
- Don't provide relevance ranking across different content types
- Require users to know which section contains the information they need

## What Changes

- **Add Vietnamese text search configuration** using PostgreSQL's `unaccent` extension combined with `simple` dictionary to preserve medical terminology while enabling accent-insensitive search
- **Add generated search_vector columns** to 5 core entities (equipment, repairs, transfers, maintenance plans, users) with weighted fields (codes/names = 'A', descriptions = 'B/C')
- **Add composite GIN indexes** `(don_vi, search_vector)` for tenant-scoped search performance
- **Add global_search RPC function** that searches across all entities using UNION ALL pattern while respecting multi-tenant isolation via JWT claims
- **Add client-side React hook** `use-global-search.ts` following existing TanStack Query patterns
- **Add TypeScript types** for search results in `src/types/database.ts`
- **Whitelist new RPC function** in `/api/rpc/[fn]/route.ts` ALLOWED_FUNCTIONS

Result format: Returns JSON array with `entity_type`, `entity_id`, `title`, `code`, `snippet`, `rank`, `don_vi`, `facility_name`, `created_at`

## Impact

**Affected Specs:**
- `search` (NEW) - Global search capability across entities
- `equipment` - Add search_vector column and index
- `repairs` - Add search_vector column and index
- `transfers` - Add search_vector column and index
- `maintenance` - Add search_vector column and index
- `users` - Add search_vector column and index
- `database-security` - New RPC function with tenant isolation enforcement

**Affected Code:**
- `supabase/migrations/YYYYMMDDHHMMSS_global_search_vietnamese_fts.sql` (NEW) - Database migration with extensions, search vectors, indexes, RPC function
- `src/app/api/rpc/[fn]/route.ts` - Add 'global_search' to ALLOWED_FUNCTIONS whitelist (line ~114)
- `src/types/database.ts` - Add GlobalSearchResult, EntityType types (NEW)
- `src/hooks/use-global-search.ts` (NEW) - TanStack Query hook for search
- `src/components/global-search/` (FUTURE) - UI components (not part of this backend-focused change)

**Performance Considerations:**
- GIN indexes will increase storage by ~30% per table (acceptable for search performance)
- Initial index build may take 2-5 minutes on large datasets (run during low-traffic period)
- Search queries target <200ms response time for single-tenant, <500ms for cross-tenant

**Security:**
- Uses existing `allowed_don_vi_for_session_safe()` pattern for tenant isolation
- SECURITY DEFINER function with `SET search_path = public, pg_temp`
- Validates facility access for non-global users
- Input sanitization via `plainto_tsquery()` prevents SQL injection

**Breaking Changes:**
- None (purely additive feature)

**Migration Strategy:**
- Idempotent migration safe to run multiple times
- Generated columns auto-update on INSERT/UPDATE
- No application downtime required
- Rollback procedure included in migration (commented)
