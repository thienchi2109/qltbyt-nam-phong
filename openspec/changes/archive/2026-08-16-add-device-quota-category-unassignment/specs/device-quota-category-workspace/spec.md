## ADDED Requirements

### Requirement: Per-equipment category unassignment

The workspace SHALL allow an authorized equipment manager to remove one equipment
item at a time from the category to which it is directly assigned.

#### Scenario: authorized user sees the unlink action

- **GIVEN** a `global`, `admin`, or `to_qltb` user is viewing equipment assigned directly to the selected category
- **WHEN** the assigned-equipment rows render
- **THEN** each row exposes a trailing `X` icon command for category removal
- **AND** both its accessible name and tooltip are exactly `Bỏ khỏi danh mục`
- **AND** the workspace does not render checkbox or bulk-selection controls
- **AND** using the row command does not select or activate the containing category row

#### Scenario: user cancels unassignment

- **GIVEN** an authorized user opens the unlink confirmation for an assigned equipment item
- **WHEN** the user cancels or closes the confirmation
- **THEN** no unlink mutation is sent
- **AND** assigned-equipment and category-count caches remain unchanged
- **AND** focus returns to a coherent control without leaving a stuck overlay

#### Scenario: user confirms unassignment

- **GIVEN** an authorized user confirms removal of an equipment item from the selected category
- **WHEN** the concurrency-safe unlink mutation affects that equipment
- **THEN** the equipment category becomes unassigned
- **AND** the equipment is removed from the selected category's direct assigned-equipment list
- **AND** the selected category's direct count and derived ancestor counts decrease exactly once
- **AND** the existing unlink audit trail records the actor, facility, equipment, and previous category

#### Scenario: unassignment creates a quota shortfall

- **GIVEN** the selected category is at or near its configured minimum quantity
- **WHEN** an authorized user confirms a valid unassignment
- **THEN** the mutation remains allowed
- **AND** the reduced count is reflected by category and compliance state
- **AND** the system does not preserve an incorrect category assignment merely to satisfy the minimum

#### Scenario: parent category shows direct assignments

- **GIVEN** the selected parent category has direct assignments and descendant assignments
- **WHEN** its assigned-equipment detail renders
- **THEN** unlink commands are available only for equipment assigned directly to that parent
- **AND** descendant equipment must be managed from its own assigned category

#### Scenario: unauthorized user cannot unlink

- **GIVEN** a user lacks the existing manual-assignment write permission
- **WHEN** the user opens or navigates the category workspace
- **THEN** no unlink command is rendered
- **AND** the user cannot invoke the unlink mutation through the workspace

#### Scenario: unauthorized authenticated role calls the RPC directly

- **GIVEN** an authenticated caller has a role other than `global`, `admin`, or `to_qltb`
- **WHEN** the caller invokes `dinh_muc_thiet_bi_unlink` directly
- **THEN** the function rejects the call with an authorization error
- **AND** no equipment assignment changes
- **AND** no unlink audit entry is written

#### Scenario: required JWT claims are absent

- **GIVEN** the unlink RPC is invoked without a non-empty role or `user_id` claim
- **WHEN** the function validates the session before business logic
- **THEN** it rejects the call with an authorization error
- **AND** no equipment assignment changes
- **AND** no unlink audit entry is written

### Requirement: Concurrency-safe category unassignment

The unlink mutation SHALL require the category the caller expects each equipment item
to still belong to and SHALL fail closed across category and tenant boundaries.

#### Scenario: expected assignment still matches

- **GIVEN** the equipment belongs to the captured facility and expected selected category
- **WHEN** an authorized caller invokes `dinh_muc_thiet_bi_unlink`
- **THEN** the function sets the equipment category to `NULL`
- **AND** it returns an affected count of one for the single-row UI request
- **AND** it writes an `unlink` audit entry for the expected previous category

#### Scenario: assignment changed after the row was loaded

- **GIVEN** the UI loaded the equipment under category A
- **AND** another actor moved the equipment to category B before confirmation
- **WHEN** the stale UI invokes unlink with expected category A
- **THEN** the mutation affects zero rows
- **AND** category B remains assigned
- **AND** the UI reports stale-state feedback rather than successful unassignment

#### Scenario: expected category crosses tenant scope

- **GIVEN** the expected category does not belong to the caller's effective facility
- **WHEN** the unlink mutation is attempted
- **THEN** the function rejects the call before updating equipment
- **AND** no cross-tenant equipment assignment changes
- **AND** no successful unlink audit entry is written

#### Scenario: equipment is outside the effective tenant scope

- **GIVEN** the expected category is valid for the caller's effective facility
- **AND** the requested equipment does not belong to that facility
- **WHEN** the unlink mutation is attempted
- **THEN** the tenant-scoped update affects zero rows
- **AND** no cross-tenant equipment assignment changes
- **AND** no successful unlink audit entry is written

#### Scenario: unsafe overload is inspected

- **GIVEN** the hardened unlink migration is ready for review
- **WHEN** local and deployed function signatures and grants are inspected
- **THEN** the expected-category overload is executable only by the required authenticated path
- **AND** the old two-argument overload is unavailable to authenticated callers
- **AND** `public` and `anon` cannot execute the hardened function

### Requirement: Cache-efficient unassignment reconciliation

After the unlink mutation resolves, the workspace SHALL update deterministic local
state without issuing immediate backend reads that are unnecessary for the current
interaction.

#### Scenario: confirmed unlink patches visible caches

- **GIVEN** the unlink RPC returns an affected count of one
- **WHEN** the mutation success handler reconciles the workspace
- **THEN** it first cancels matching in-flight reads for the affected query families
- **AND** it removes the equipment from the exact assigned-equipment cache
- **AND** it decrements only the selected category's direct cached count
- **AND** existing full-tree aggregation recalculates ancestor totals
- **AND** cache updaters preserve immutable structural sharing

#### Scenario: a pre-mutation read resolves late

- **GIVEN** an affected read query started before the unlink mutation
- **AND** its response would contain stale pre-unlink state
- **WHEN** the mutation result is reconciled
- **THEN** the matching in-flight query is canceled before cache patching
- **AND** the delayed response cannot overwrite the confirmed cache state
- **AND** cancellation does not issue another backend read

#### Scenario: related queries are not immediately needed

- **GIVEN** assigned, category-list, unassigned, filter-option, or compliance queries are affected by the unlink
- **WHEN** deterministic visible caches have been patched
- **THEN** those queries are marked stale with no immediate refetch
- **AND** the success path sends exactly one required mutation request
- **AND** normal query lifecycle rules may reconcile server state when a consuming surface later needs it

#### Scenario: unlink affects zero rows

- **GIVEN** the expected-category unlink returns zero because the displayed row is stale
- **WHEN** the client handles the result
- **THEN** it does not report successful unassignment
- **AND** it removes the provably stale row from the exact assigned-equipment cache
- **AND** it leaves the unconfirmed category-list count unchanged
- **AND** it marks assigned-equipment and category-list queries stale without an immediate read
- **AND** it does not decrement a count that may already reflect the concurrent assignment

#### Scenario: unlink request fails

- **GIVEN** the user confirms an unlink
- **WHEN** the mutation throws an authorization, validation, tenant, or network error
- **THEN** assigned-equipment and category-count caches remain unchanged
- **AND** the row action becomes available again
- **AND** the workspace shows actionable error feedback

## MODIFIED Requirements

### Requirement: Existing data-contract preservation

The unified workspace SHALL preserve existing category listing, assigned-equipment
detail, manual assignment, suggested-mapping, RPC allowlist, and generated database
contracts. It MAY add only one correctly ordered SQL migration that replaces the
existing `dinh_muc_thiet_bi_unlink` overload with the expected-category concurrency
guard required by per-equipment unassignment. It SHALL NOT require any other database
migration, schema change, new RPC name, suggestion API contract change, RPC allowlist
change, or generated database contract change.

#### Scenario: implementation data access is reviewed

- **GIVEN** the unified workspace implementation is ready for review
- **WHEN** its data access and repository diff are inspected
- **THEN** category listing uses `dinh_muc_nhom_list`
- **AND** assigned-equipment detail uses `dinh_muc_thiet_bi_by_nhom`
- **AND** manual assignment uses the existing unassigned-equipment queries and `dinh_muc_thiet_bi_link`
- **AND** per-equipment unassignment uses the hardened expected-category `dinh_muc_thiet_bi_unlink` contract
- **AND** suggested mapping continues to use the existing suggestion routes and `dinh_muc_thiet_bi_link_batch`
- **AND** removing the Mapping page does not remove or rename `/api/device-quota/mapping/suggest/**`
- **AND** the only SQL migration present is the ordered unlink-overload replacement
- **AND** no schema change, new RPC name, suggestion API contract change, RPC allowlist change, or generated database contract change is present
