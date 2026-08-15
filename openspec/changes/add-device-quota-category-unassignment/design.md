# Design: Device Quota Category Unassignment

## Context

The canonical Device Quota category workspace renders a selected category's quota
and directly assigned equipment in the right detail pane. The assigned-equipment
table is currently read-only, although both the local migration history and live
database expose `dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT)`.

The current unlink RPC:

- sets `thiet_bi.nhom_thiet_bi_id` to `NULL`;
- permits `global`, `admin`, and `to_qltb`;
- scopes writes by facility;
- writes `unlink` audit entries containing the previous category; and
- accepts equipment IDs and facility, but not the category the caller expects.

That final property creates a stale-write race. If a row was loaded under category A
and another user moves the equipment to category B before the unlink is confirmed,
the current RPC can clear the newer category B assignment.

The category-list query returns each category's direct `so_luong_hien_co`. Existing
frontend helpers derive parent totals bottom-up from the full category list. This
makes a confirmed one-row removal deterministic to patch locally without an
immediate category-list refetch.

## Goals / Non-Goals

### Goals

- Provide a direct, accessible, per-row correction workflow.
- Preserve current write authorization, tenant isolation, and auditability.
- Prevent stale UI from unlinking a concurrently changed category assignment.
- Update visible assigned rows and category counts immediately after server
  confirmation.
- Avoid read requests that can be replaced by deterministic TanStack Query cache
  updates.
- Split delivery into small phases with independent review and deploy boundaries.

### Non-Goals

- No checkbox or bulk-selection UI.
- No direct move-to-another-category workflow.
- No blocking rule when unassignment creates a quota shortfall.
- No descendant-wide unlink operation from a parent category.
- No change to facility-wide suggested mapping.
- No modification of the archived August 14, 2026 workspace-consolidation change.
- No live database write during proposal work.

## Decisions

### 1. Use a trailing per-row unlink command

Each directly assigned equipment row receives a trailing icon-only command using the
Lucide `X` icon. The button has the exact accessible name and tooltip
`Bỏ khỏi danh mục`, stops row-selection event propagation, and is visible only when
the current user can manually assign equipment.

The command opens a focused confirmation dialog containing the equipment identity
and current category. Canceling sends no mutation and leaves all caches unchanged.
The pending state disables the affected row action and confirmation command without
blocking unrelated rows or the entire workspace.

Alternatives considered:

- Always-visible checkboxes: rejected because the maintainer explicitly chose a
  single-row correction workflow.
- Immediate unlink without confirmation: rejected because an icon-only destructive
  classification change is easy to trigger accidentally.
- A row overflow menu: rejected because unlink is the only row command and a direct
  icon is faster and clearer.

### 2. Require the expected category in the unlink RPC

Implementation SHALL replace the existing unsafe overload with:

```sql
public.dinh_muc_thiet_bi_unlink(
  p_thiet_bi_ids BIGINT[],
  p_nhom_id BIGINT,
  p_don_vi BIGINT DEFAULT NULL
) RETURNS INTEGER
```

The superseding migration must sort after every local migration that defines this
function at implementation time. It must:

- validate non-empty role and `user_id` JWT claims;
- normalize and enforce `global`, `admin`, and `to_qltb` access consistently with
  assignment;
- enforce facility scope and verify the expected category belongs to that facility;
- update only rows matching equipment ID, facility, and
  `nhom_thiet_bi_id = p_nhom_id`;
- preserve `SECURITY DEFINER` with
  `SET search_path = public, pg_temp`;
- return the affected count;
- write one `unlink` audit record for confirmed affected IDs and their previous
  category;
- revoke execution from `public` and `anon`;
- grant only the required execution privilege to `authenticated`; and
- revoke and remove the old two-argument overload so callers cannot bypass the
  expected-category guard.

The API proxy allowlist remains name-based, so no new RPC name is required. Source
tests must still prove that the intended overload is exposed and the unsafe overload
is absent.

### 3. Patch caches only after server confirmation

The frontend uses `useMutation` and sends one equipment ID in the existing array
shape. It does not use an `onMutate` optimistic write. Cache changes happen only
after the RPC returns, avoiding rollback complexity and preventing an unconfirmed
count from being shown.

Before reconciling any resolved mutation, the client cancels matching in-flight
assigned-equipment, category-list, unassigned-equipment, filter-option, and compliance
queries for the captured facility/category scope. Cancellation prevents an older
response from overwriting the deterministic patch or incorrectly marking stale data
fresh, and it does not start another backend request.

When the affected count is one:

1. Remove the equipment from the exact selected-category assigned-equipment cache
   with `setQueryData`.
2. Use targeted `setQueriesData` on matching `dinh_muc_nhom_list` caches for the
   captured facility and decrement only the selected category's direct
   `so_luong_hien_co`, clamped at zero.
3. Let existing `buildAggregatedCounts` logic recompute ancestor totals from the
   patched full tree.
4. Mark the assigned-equipment, category-list, unassigned-equipment,
   unassigned-filter-option, and compliance queries stale with
   `refetchType: "none"`.
5. Show success without issuing an immediate read RPC.

The query keys must include the facility/category variables already used by their
query contracts. Updaters must be immutable so TanStack Query structural sharing
can avoid unrelated rerenders.

When the affected count is zero, the expected-category guard proves the row no
longer belongs to the selected category. The client removes that provably stale row
from the exact assigned-equipment cache, leaves the unconfirmed category-list count
unchanged, and marks the assigned-equipment and category-list queries stale with
`refetchType: "none"`. It presents informational stale-data feedback rather than
mutation success. The client must not decrement a count that may already reflect the
concurrent reassignment.

When the mutation throws, no cache is patched and actionable error feedback is
shown.

### 4. Defer authoritative reads until they are useful

Queries marked stale with `refetchType: "none"` retain their patched or previous
cache without an immediate backend request. Normal query lifecycle rules may refetch
them later when:

- the user enters manual assignment and needs the unassigned list;
- a compliance surface mounts;
- focus/reconnect freshness policy applies; or
- the user explicitly refreshes.

This policy keeps one required mutation request on the critical interaction path.
It does not disable eventual server reconciliation or weaken normal freshness
behavior.

### 5. Preserve direct-versus-aggregate hierarchy semantics

The assigned-equipment table continues to use
`dinh_muc_thiet_bi_by_nhom`, which returns direct assignments only. A parent-category
row action therefore affects only equipment directly assigned to that parent.
Descendant equipment is unlinked from the corresponding descendant category.

The direct count is patched once on the selected category. Parent counts are not
manually decremented; they are derived from the patched full tree to avoid double
counting.

### 6. Keep compliance descriptive, not blocking

The unlink RPC does not reject a change because it moves the category below a
minimum quota. The cached category count changes immediately, and compliance data
is marked stale for its next use. The UI may then show an under-minimum state, which
is the intended reflection of the corrected classification.

## Risks / Trade-offs

- **Cache drift from unrelated concurrent changes:** local patching confirms only
  this unlink.
  - Mitigation: mark all affected caches stale without immediate refetch so normal
    lifecycle reconciliation remains available.
- **An older in-flight read overwrites the confirmed patch:** invalidation alone does
  not stop a request that began before the mutation.
  - Mitigation: cancel matching in-flight reads before patching or marking affected
    queries stale, and cover delayed-response races in tests.
- **Unsafe legacy overload remains callable:** callers could bypass the category
  guard.
  - Mitigation: revoke and remove the old overload in the superseding migration.
- **Migration and UI deploy ordering:** the UI requires the new three-argument
  overload.
  - Mitigation: land and apply the backend contract before exposing the UI action;
    keep phases separately reviewable.
- **Icon ambiguity:** an `X` can be interpreted as deletion rather than category
  removal.
  - Mitigation: use an accessible label, tooltip, confirmation copy, and consistent
    disabled/pending states that explicitly say `Bỏ khỏi danh mục`.
- **Incorrect aggregate decrement:** directly modifying parent totals would double
  apply the change.
  - Mitigation: patch only the selected category's direct count and reuse existing
    aggregate helpers.

## Migration and Rollout

1. Characterize current UI, role, RPC, audit, and cache behavior with failing tests.
2. Add the correctly ordered superseding migration, frontend workflow, cache
   reconciliation, and focused tests on an isolated implementation branch.
3. Complete repository quality gates and independent review to zero findings without
   applying live changes or deploying the frontend action.
4. Obtain explicit maintainer permission for the specific live migration.
5. Apply the migration through Supabase MCP, run security advisors, and verify the
   hardened overload with read-only checks.
6. Only after the backend verification passes, land and deploy or enable the frontend
   action.
7. Keep production smoke verification read-only unless the maintainer separately
   authorizes mutation of designated test records and an explicit cleanup plan.
8. Monitor RPC errors and stale-data feedback after rollout.

Rollback removes or hides the frontend action first. If the database contract must
be rolled back, restore a guarded compatibility function through a new forward
migration; never edit migration history or live migration metadata manually.

## Verification Strategy

- OpenSpec strict validation and rendered change inspection.
- SQL source-contract tests for signature, JWT guards, tenant/category predicates,
  search path, audit, grants, and removal of the unsafe overload.
- Component tests for icon visibility, tooltip/accessibility, event isolation,
  confirmation, cancel, pending, and direct-parent semantics. Tooltip and accessible
  name assertions use the exact text `Bỏ khỏi danh mục`.
- Mutation-hook tests proving:
  - exactly one mutation request per confirmation;
  - no request on cancel;
  - matching in-flight reads are canceled before cache reconciliation;
  - a delayed pre-mutation response cannot overwrite the confirmed cache patch;
  - deterministic cache updates after affected count one;
  - no immediate read refetch;
  - stale-row removal without count decrement after affected count zero; and
  - unchanged cache on error.
- Existing assignment, category aggregation, role-matrix, and assigned-equipment
  suites remain green.
- Required TypeScript/React gates run in repository order.
- Independent `post_implementation_reviewer` review against Wayfinder decision
  #929 and this OpenSpec change.

## Open Questions

None. Remaining choices are implementation details constrained by this design.
