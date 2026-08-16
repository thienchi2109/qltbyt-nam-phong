# Phase 0 Characterization and RED Baseline

Recorded on 2026-08-15 for OpenSpec change
`add-device-quota-category-unassignment`.

- Branch: `feat/device-quota-category-unassignment`
- Worktree:
  `/root/qltbyt-nam-phong/.worktrees/device-quota-category-unassignment-implementation`
- `PHASE_BASE`: `a5736cd3308fc3808f6be18f0d3b3d0fe7c653d2`
- Scope: tests and characterization only
- Live database activity: read-only Supabase MCP inspection; no write or deployment

## Existing Green Baseline

Before adding RED cases, the focused existing suites passed:

- `DeviceQuotaCategoryAssignedEquipment.test.tsx`
- `DeviceQuotaCategoryDetailPane.test.tsx`
- `DeviceQuotaCategoriesPage.test.tsx`
- `useDeviceQuotaCategoryAssignment.test.tsx`
- `dinh-muc-nhom-list-contract.test.ts`

Result: 5 files passed, 23 tests passed.

## Local RPC Baseline

- The only local migration defining `dinh_muc_thiet_bi_unlink` is
  `supabase/migrations/20260201_device_quota_rpc_mapping.sql`.
- The local overload is
  `dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT)`.
- It checks the manager role set and facility predicate, sets assigned categories to
  `NULL`, returns the affected count, and writes `unlink` audit rows grouped by the
  previous category.
- It does not accept an expected category, does not fail closed on a missing
  `user_id`, uses `search_path = public`, and does not explicitly revoke `PUBLIC` or
  `anon`.
- The only application reference is the name-based RPC allowlist. No frontend caller
  currently invokes the unlink RPC.

Phase 1 must choose a migration filename that sorts after
`20260201_device_quota_rpc_mapping.sql`.

## Live Read-Only Baseline

Supabase MCP project `cdthersvldpnlbvpufrr` confirms:

- Exactly one live overload exists:
  `dinh_muc_thiet_bi_unlink(bigint[], bigint)`.
- The live definition matches the local two-argument behavior and has
  `SECURITY DEFINER` with `search_path=public`.
- `PUBLIC`, `anon`, `authenticated`, `postgres`, and `service_role` currently have
  `EXECUTE`.
- No other live function/procedure or view references the unlink RPC.
- `thiet_bi_nhom_audit_log.performed_by` is `NOT NULL` and references
  `nhan_vien(id)`.
- The audit table accepts `link`, `unlink`, and `link_batch`, rejects empty equipment
  ID arrays, is immutable through `trg_thiet_bi_audit_immutable`, and validates
  category references through `trg_validate_nhom_thiet_bi_audit_reference`.
- `thiet_bi` validates category/facility consistency through
  `trg_thiet_bi_category_tenant_check`.

## Expected RED Suites

The Phase 0 suites intentionally describe behavior that does not exist yet:

- `DeviceQuotaCategoryAssignedEquipment.unassignment-red.test.tsx`
  - authorized trailing Lucide `X` action;
  - exact accessible name and tooltip `Bỏ khỏi danh mục`;
  - pointer and keyboard event isolation;
  - confirmation cancel and confirm;
  - manager-only role matrix.
- `DeviceQuotaCategoryDetailPane.test.tsx`
  - parent-category action scope remains tied to direct assignments for the selected
    parent.
- `useDeviceQuotaCategoryUnassignment.red.test.tsx`
  - one expected-category unlink RPC;
  - targeted in-flight cancellation before cache reconciliation;
  - delayed stale-response protection;
  - deterministic success and zero-affected cache patches;
  - no immediate read refetch;
  - unchanged caches and destructive feedback on error.
- `dinh-muc-thiet-bi-unlink-contract.red.test.ts`
  - hardened three-argument signature and expected-category predicate;
  - direct-RPC role rejection and fail-closed JWT claims;
  - cross-tenant category rejection and tenant-scoped equipment zero-row behavior;
  - safe search path, audit, grants, and unsafe-overload removal.

Exact failing test names and observed failure reasons are recorded after the focused
RED run.

### Observed RED Run

Result: 4 files failed as expected, with 18 failing tests and 6 passing
baseline/negative-control tests.

- Seven assigned-equipment tests fail because the authorized trailing action,
  tooltip, event isolation, and confirmation dialog do not exist:
  - `shows the trailing Lucide X action for the global role`;
  - `shows the trailing Lucide X action for the admin role`;
  - `shows the trailing Lucide X action for the to_qltb role`;
  - `shows the exact Bỏ khỏi danh mục tooltip`;
  - `isolates pointer and keyboard action events from the containing row`;
  - `cancels without sending an unassignment request`;
  - `confirms exactly one equipment/category/tenant unassignment request`.
    Five unauthorized role cases pass because the current read-only component exposes
    no action.
- The parent-category test
  `keeps parent-category unlink actions scoped to equipment assigned directly to that parent`
  fails because the direct-assignment panel does not yet receive the authorized
  `canUnassign` contract.
- The mutation tests
  `sends one unlink RPC with the equipment, expected category, and captured tenant`,
  `cancels matching reads before patching visible caches and avoids immediate reads`,
  `prevents a delayed pre-mutation assigned read from restoring the removed row`,
  `removes a stale assigned row without decrementing count when zero rows are affected`,
  and `leaves caches unchanged and reports the mutation error` fail with
  `Phase 0 RED: useDeviceQuotaCategoryUnassignment has not been implemented`.
  The delayed-response harness was separately verified to reach an in-flight read
  before failing on the missing hook.
- The SQL/source-contract tests
  `uses the latest correctly ordered three-argument expected-category overload`,
  `runs claim, role, and category guards before the equipment mutation`,
  `rejects cross-tenant categories but returns zero for tenant-scoped equipment misses`,
  `audits IDs returned by the constrained update and returns their affected count`,
  and `preserves security definer and exposes only the hardened authenticated overload`
  fail against
  `20260201_device_quota_rpc_mapping.sql`: the latest definition is still the unsafe
  two-argument overload and lacks the expected-category predicate, fail-closed claim
  messages, category rejection, tenant-scoped zero-row update, `pg_temp` search path,
  explicit revokes, and old-overload removal.
- No transform error, timeout, or unrelated regression remained after correcting the
  delayed-response test harness.

## Phase 1 Prerequisite

Phase 1 may add only a correctly ordered, idempotent superseding migration. Applying
that migration to the live database remains a separately approved operation.
