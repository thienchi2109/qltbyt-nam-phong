# Global Search Specification Delta

## ADDED Requirements

### Requirement: Vietnamese Accent-Insensitive Text Search Configuration

The system SHALL provide a custom PostgreSQL text search configuration named `vietnamese_unaccent` that enables accent-insensitive searching for Vietnamese text while preserving medical terminology.

#### Scenario: Accent-insensitive matching
- **WHEN** user searches for "may xet nghiem" (no accents)
- **THEN** system returns results containing "Máy xét nghiệm", "máy xét nghiệm", "MAY XET NGHIEM", and other accent variations

#### Scenario: Medical terminology preservation
- **WHEN** equipment has code "Model-X125"
- **THEN** search tokenization preserves the full code without splitting into separate tokens

#### Scenario: Case-insensitive search
- **WHEN** user searches with any case variation (uppercase, lowercase, mixed)
- **THEN** system returns matching results regardless of original text case

### Requirement: Search Vector Columns

The system SHALL maintain automatically-updated search vector columns on all searchable entities using PostgreSQL generated columns.

#### Scenario: Equipment search vectors
- **WHEN** equipment record is created or updated
- **THEN** search_vector column is automatically generated with weights: ten_thiet_bi (A), ma_thiet_bi (A), model (B), mo_ta (C)

#### Scenario: Repair request search vectors
- **WHEN** repair request is created or updated
- **THEN** search_vector column is automatically generated with weights: mo_ta_su_co (A), hang_muc_sua_chua (B), nguyen_nhan (C)

#### Scenario: Transfer request search vectors
- **WHEN** transfer request is created or updated
- **THEN** search_vector column is automatically generated with weights: ma_yeu_cau (A), ly_do_luan_chuyen (B)

#### Scenario: Maintenance plan search vectors
- **WHEN** maintenance plan is created or updated
- **THEN** search_vector column is automatically generated with weights: ten_ke_hoach (A), mo_ta (B)

#### Scenario: User search vectors
- **WHEN** user record is created or updated
- **THEN** search_vector column is automatically generated with weights: full_name (A), username (B)

### Requirement: Search Performance Indexes

The system SHALL maintain composite GIN (Generalized Inverted Index) indexes on searchable entities to optimize full-text search performance with tenant isolation.

#### Scenario: Tenant-scoped equipment search
- **WHEN** searching equipment for a specific tenant
- **THEN** query uses composite index (don_vi, search_vector) for optimal performance

#### Scenario: Cross-entity join performance
- **WHEN** searching repairs or transfers (no direct don_vi column)
- **THEN** query uses search_vector index + foreign key index on thiet_bi_id for efficient joins

#### Scenario: Index scan selection
- **WHEN** PostgreSQL query planner evaluates search query
- **THEN** planner selects bitmap heap scan on GIN index for full-text predicates

### Requirement: Global Search RPC Function

The system SHALL provide a `global_search` RPC function that searches across multiple entity types while respecting multi-tenant isolation and role-based access control.

#### Scenario: Cross-entity unified search
- **WHEN** user executes global_search with query "bảo trì"
- **THEN** system returns ranked results from equipment, maintenance plans, and other relevant entities in a single unified response

#### Scenario: Entity type filtering
- **WHEN** user specifies p_entity_types = ['equipment', 'repairs']
- **THEN** system only searches and returns results from equipment and repair request entities

#### Scenario: Tenant isolation for non-global users
- **WHEN** user with role 'to_qltb' and don_vi=5 calls global_search
- **THEN** system only returns results from tenant 5, even if p_don_vi parameter specifies a different tenant

#### Scenario: Regional leader multi-tenant access
- **WHEN** user with role 'regional_leader' and dia_ban_id=1 calls global_search
- **THEN** system returns results from all tenants within region 1 using allowed_don_vi_for_session_safe()

#### Scenario: Global user cross-tenant search
- **WHEN** user with role 'global' calls global_search without p_don_vi filter
- **THEN** system returns results from all tenants across the entire system

#### Scenario: Global user tenant-scoped search
- **WHEN** user with role 'global' calls global_search with p_don_vi=10
- **THEN** system returns results only from tenant 10

#### Scenario: Relevance ranking
- **WHEN** search results are returned
- **THEN** results are ordered by ts_rank score (descending), then created_at (descending)

#### Scenario: Result limit enforcement
- **WHEN** user calls global_search with p_limit=20
- **THEN** system returns maximum 20 results across all entity types combined

#### Scenario: Empty query handling
- **WHEN** user calls global_search with empty or whitespace-only query
- **THEN** system returns empty array without executing database search

#### Scenario: Result format structure
- **WHEN** search results are returned
- **THEN** each result contains: entity_type, entity_id, title, code, snippet, rank, don_vi, facility_name, created_at

### Requirement: Search Security and Input Sanitization

The system SHALL prevent SQL injection attacks and enforce tenant isolation at the database level for all search operations.

#### Scenario: SQL injection prevention
- **WHEN** user submits query containing SQL syntax ("'; DROP TABLE thiet_bi; --")
- **THEN** system treats input as literal text via plainto_tsquery sanitization without executing SQL

#### Scenario: Unauthorized tenant access attempt
- **WHEN** non-global user attempts to search tenant they don't have access to
- **THEN** system raises exception with error code 42501 (insufficient_privilege)

#### Scenario: JWT claim validation
- **WHEN** global_search RPC function executes
- **THEN** system extracts and validates role and tenant claims from current_setting('request.jwt.claims')

#### Scenario: Facility access validation
- **WHEN** non-global user specifies p_don_vi not in their allowed_don_vi list
- **THEN** system raises exception "Access denied for facility X"

### Requirement: Search Result Metadata

The system SHALL provide rich metadata for each search result to enable proper display and navigation in the UI.

#### Scenario: Equipment result metadata
- **WHEN** equipment matches search query
- **THEN** result includes title (ten_thiet_bi), code (ma_thiet_bi), snippet (mo_ta), facility_name

#### Scenario: Repair request result metadata
- **WHEN** repair request matches search query
- **THEN** result includes title (mo_ta_su_co), code (equipment ma_thiet_bi), snippet (hang_muc_sua_chua), facility_name

#### Scenario: Transfer result metadata
- **WHEN** transfer request matches search query
- **THEN** result includes title (ly_do_luan_chuyen), code (ma_yeu_cau), snippet (equipment ten_thiet_bi), facility_name

#### Scenario: Maintenance plan result metadata
- **WHEN** maintenance plan matches search query
- **THEN** result includes title (ten_ke_hoach), code (year), snippet (mo_ta), facility_name

#### Scenario: User result metadata
- **WHEN** user record matches search query and user is active
- **THEN** result includes title (full_name), code (username), snippet (role), facility_name

#### Scenario: Inactive user filtering
- **WHEN** searching users
- **THEN** system only returns active users (active = TRUE)

### Requirement: Client-Side Search Hook Integration

The system SHALL provide a TypeScript React hook that integrates global search with TanStack Query for efficient client-side state management.

#### Scenario: Query debouncing requirement
- **WHEN** user types in search input
- **THEN** hook requires minimum 2 characters before enabling query execution

#### Scenario: Cache management
- **WHEN** search query executes successfully
- **THEN** results are cached for 30 seconds (staleTime: 30000ms)

#### Scenario: Stable query key generation
- **WHEN** hook creates TanStack Query cache key
- **THEN** key includes: ['global_search', { query, donVi, entityTypes, limit }]

#### Scenario: Type-safe results
- **WHEN** hook returns search results
- **THEN** results are typed as GlobalSearchResult[] with full TypeScript type checking

#### Scenario: Error handling
- **WHEN** global_search RPC call fails
- **THEN** hook returns error state via TanStack Query error object

### Requirement: Vietnamese Language Labels

The system SHALL provide Vietnamese language labels for all entity types in search results.

#### Scenario: Entity type label mapping
- **WHEN** displaying search results
- **THEN** entity types map to labels: equipment → "Thiết bị", repair → "Yêu cầu sửa chữa", transfer → "Luân chuyển", maintenance → "Kế hoạch bảo trì", user → "Nhân viên"

### Requirement: Search Performance Targets

The system SHALL meet defined performance targets for search operations across different scales and complexity.

#### Scenario: Single-entity search performance
- **WHEN** searching single entity type with tenant filter on dataset < 10,000 records
- **THEN** query completes in less than 200 milliseconds

#### Scenario: Cross-entity search performance
- **WHEN** searching all entity types with tenant filter
- **THEN** query completes in less than 500 milliseconds

#### Scenario: Large dataset scalability
- **WHEN** searching with dataset up to 100,000 records per entity
- **THEN** response time scales linearly and remains under 1 second

### Requirement: Migration Idempotency and Rollback

The system SHALL provide idempotent database migrations with documented rollback procedures.

#### Scenario: Repeated migration execution
- **WHEN** migration file is executed multiple times
- **THEN** subsequent executions complete without errors using IF NOT EXISTS, CREATE OR REPLACE clauses

#### Scenario: Rollback availability
- **WHEN** migration needs to be reverted
- **THEN** commented rollback procedure provides complete instructions to drop all changes

#### Scenario: Extension safety
- **WHEN** rolling back migration
- **THEN** rollback procedure preserves unaccent extension as it may be used by other features

### Requirement: RPC Function Whitelisting

The system SHALL register global_search function in the RPC proxy ALLOWED_FUNCTIONS whitelist to enable client access.

#### Scenario: Function allowlist registration
- **WHEN** client calls /api/rpc/global_search
- **THEN** RPC proxy permits the call due to 'global_search' in ALLOWED_FUNCTIONS Set

#### Scenario: Unauthorized function rejection
- **WHEN** client attempts to call unregistered RPC function
- **THEN** RPC proxy returns 403 Forbidden error

### Requirement: Search Statistics and Monitoring

The system SHALL update PostgreSQL query planner statistics after migration to ensure optimal query plans.

#### Scenario: Statistics collection
- **WHEN** migration completes
- **THEN** system executes ANALYZE on all modified tables (thiet_bi, yeu_cau_sua_chua, yeu_cau_luan_chuyen, ke_hoach_bao_tri, nhan_vien)

#### Scenario: Query plan optimization
- **WHEN** query planner evaluates global_search queries
- **THEN** planner uses updated statistics to select optimal index scan strategies
