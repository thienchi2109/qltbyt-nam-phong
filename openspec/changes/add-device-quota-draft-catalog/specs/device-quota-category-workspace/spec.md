## MODIFIED Requirements

### Requirement: Existing data-contract preservation

The unified workspace SHALL preserve existing category listing, assigned-equipment
detail, manual assignment, suggested-mapping, RPC allowlist, and generated database
contracts. It SHALL also preserve the current category Excel import and separate
quota-decision Excel import, including their entry points, permissions,
validation, API/RPC contracts, imported data mapping, active-category or
decision writes, optional quota-column behavior, automatic decision creation,
and partial-success behavior. This change MAY add the draft-catalog schema and
RPC contracts defined below. It SHALL NOT modify the unrelated `#928`
per-equipment unassignment initiative, change or remove either Excel import
contract, or change any unrelated existing contract.

#### Scenario: existing Excel import remains compatible

- **GIVEN** the draft-catalog implementation is ready for review
- **WHEN** an authorized user opens and executes the existing category Excel
  import flow
- **THEN** its entry point, permissions, validation, imported data mapping, and
  `dinh_muc_nhom_bulk_import` contract remain compatible
- **AND** category import continues to write active-category data through its
  existing contract
- **AND** if quota columns are present, the existing
  `dinh_muc_unified_import` invocation, automatic decision creation, and
  partial-success behavior remain compatible
- **AND** draft initialization or draft mutation does not invoke, alter, or
  disable this import flow

#### Scenario: existing quota-decision Excel import remains compatible

- **GIVEN** an authorized user opens the existing quota-decision Excel import
- **WHEN** the user validates and imports a workbook
- **THEN** its entry point, permissions, validation, payload mapping, and
  `dinh_muc_chi_tiet_bulk_import` contract remain compatible
- **AND** the importer continues to write quota-decision data through its
  existing contract
- **AND** draft initialization or draft mutation does not invoke, alter, or
  disable this import flow

#### Scenario: canonical workspace data contracts remain compatible

- **GIVEN** the unified workspace implementation is ready for review
- **WHEN** its data access and repository diff are inspected
- **THEN** category listing uses `dinh_muc_nhom_list`
- **AND** assigned-equipment detail uses `dinh_muc_thiet_bi_by_nhom`
- **AND** manual assignment uses the existing unassigned-equipment queries and
  `dinh_muc_thiet_bi_link`
- **AND** per-equipment unassignment uses the existing expected-category
  `dinh_muc_thiet_bi_unlink` contract from its own change
- **AND** suggested mapping continues to use the existing suggestion routes and
  `dinh_muc_thiet_bi_link_batch`
- **AND** removing the Mapping page does not remove or rename
  `/api/device-quota/mapping/suggest/**`
- **AND** the draft change adds only its own ordered migrations, tables, and
  RPC contracts
- **AND** no unrelated suggestion API, RPC allowlist, or generated database
  contract is changed

## ADDED Requirements

### Requirement: Unit-scoped draft catalog creation

The Device Quota workspace SHALL allow an authorized user to create or open
one editable draft catalog for the current unit resolved from the authenticated
session. The flow SHALL NOT ask the user to select or override the unit. The
draft capability SHALL preserve existing category-management boundaries:
`global`, `admin`, and `to_qltb` may manage drafts only when their authenticated
session contains the current unit; mapping-only users and `regional_leader`
cannot create or mutate drafts in this MVP.

#### Scenario: current unit is available

- **GIVEN** an authorized user has a current unit in the authenticated session
- **WHEN** the user chooses `Tạo danh mục`
- **THEN** the application creates or opens the editable draft for that unit
- **AND** the draft is associated with the system-selected immutable canonical
  Thông tư 10/2026 catalog version

#### Scenario: current unit is missing

- **GIVEN** an authorized user has no current unit in the authenticated session
- **WHEN** the user chooses `Tạo danh mục`
- **THEN** the application refuses to create the draft
- **AND** it shows actionable feedback
- **AND** no draft or active quota data is written

#### Scenario: user has no draft-management role

- **GIVEN** a mapping-only or `regional_leader` user opens the workspace
- **WHEN** the user chooses `Tạo danh mục`
- **THEN** the application refuses the mutation
- **AND** it does not expose draft create or edit controls
- **AND** a direct RPC call is rejected by the server

### Requirement: Regulatory-basis initialization

The draft catalog SHALL initialize from the 42-row immutable Thông tư 10/2026
snapshot: five structural section rows and 37 equipment item rows. Rendering
SHALL preserve source order and source-declared parent relationships, including
16 child items and 21 top-level items. Regulatory names, original units, rules,
source pages, source references, and immutable source positions SHALL remain
available as read-only data.

#### Scenario: new draft is initialized

- **GIVEN** the current unit has no editable draft
- **WHEN** the user opens `Tạo danh mục`
- **THEN** the editor renders five structural section rows
- **AND** it renders all 37 regulatory equipment items in source order
- **AND** it preserves the 16 source-declared child relationships and 21
  top-level equipment rows
- **AND** every regulatory item shows a Thông tư 10/2026 source reference
- **AND** source positions preserve the relative order of all 42 snapshot rows

#### Scenario: canonical source snapshot is unavailable

- **GIVEN** no unique ready canonical snapshot for Thông tư 10/2026 exists
- **WHEN** the user opens `Tạo danh mục`
- **THEN** the application refuses to initialize the draft
- **AND** it explains that the regulatory source is unavailable or invalid
- **AND** no partial draft is written

#### Scenario: regulatory rule has multiple lines

- **GIVEN** a regulatory item has multiple quota conditions
- **WHEN** the item renders in the draft editor
- **THEN** the complete source rule text remains readable as separate multiline
  content
- **AND** the application does not replace it with an inferred single formula

#### Scenario: regulatory fields are edited

- **GIVEN** a user edits a draft item
- **WHEN** the user attempts to change its regulatory name, original unit,
  rule text, or source reference
- **THEN** the mutation rejects those regulatory-field changes
- **AND** the regulatory source remains unchanged

### Requirement: Unit-specific draft editing

The draft editor SHALL allow editing only unit-specific values for a
regulatory item: display name, applied unit, applied quantity, and notes. The
editor SHALL distinguish those fields visually from regulatory fields.

#### Scenario: user edits applied values

- **GIVEN** a regulatory item is present in the current unit's draft
- **WHEN** the user changes its display name, applied unit, applied quantity,
  or notes
- **THEN** the draft reflects the unit-specific changes
- **AND** the regulatory original name, unit, and rule remain unchanged

#### Scenario: user saves an incomplete draft

- **GIVEN** one or more non-excluded draft items have no applied quantity
- **WHEN** the user saves the draft
- **THEN** the draft is saved successfully
- **AND** the incomplete item remains visibly incomplete
- **AND** the application does not attempt publication or activation

#### Scenario: applied quantity is a draft proposal

- **GIVEN** the user enters a non-negative integer applied quantity
- **WHEN** the user saves the draft
- **THEN** the value is stored as a unit-proposed draft value
- **AND** the UI does not label it as an approved or legally determined quota
- **AND** the application does not infer, reject, or certify compliance against
  the conditional regulatory rule

#### Scenario: applied quantity is invalid

- **GIVEN** the user enters a negative, fractional, or otherwise invalid
  applied quantity
- **WHEN** the user saves the draft
- **THEN** the draft is rejected with field-level validation feedback
- **AND** previously saved draft values remain unchanged

### Requirement: Draft exclusion and restoration

The draft editor SHALL support excluding and restoring regulatory items without
deleting regulatory source data or historical draft records.

#### Scenario: user excludes an item

- **GIVEN** a regulatory item is present in the editable draft
- **WHEN** the user excludes the item and saves
- **THEN** the item is marked excluded in that draft
- **AND** it is not treated as an active unit quota
- **AND** its regulatory source remains available

#### Scenario: user restores an item

- **GIVEN** a regulatory item is excluded in the current draft
- **WHEN** the user restores it
- **THEN** the item becomes editable again
- **AND** its regulatory reference and source traceability are preserved

#### Scenario: draft initialization is idempotent

- **GIVEN** a regulatory item already exists in the current draft
- **WHEN** create-or-open is requested repeatedly or concurrently
- **THEN** the application returns the same editable draft
- **AND** the draft contains at most one row for that regulatory item

### Requirement: Draft persistence and isolation

The application SHALL allow the current unit to save, reopen, and view its
editable draft. Draft persistence SHALL NOT change active decisions, equipment
classification, compliance calculations, reports, or other active quota reads.

#### Scenario: user saves and reopens a draft

- **GIVEN** the user has edited the current unit's draft
- **WHEN** the user saves, leaves, and later reopens the draft
- **THEN** all saved unit-specific values and exclusion states are restored
- **AND** the same regulatory catalog version and source references are shown

#### Scenario: draft is isolated from active operations

- **GIVEN** the user saves or updates a draft
- **WHEN** active quota and equipment surfaces are queried
- **THEN** those surfaces continue to use their existing active contracts
- **AND** no equipment mapping, compliance result, or report changes because of
  the draft write

#### Scenario: second editable draft is requested

- **GIVEN** the current unit already has an editable draft
- **WHEN** the user chooses `Tạo danh mục` again
- **THEN** the application opens the existing draft
- **AND** it does not create a second editable draft for that unit

#### Scenario: stale draft save is rejected

- **GIVEN** two editor sessions opened the same draft revision
- **WHEN** the older revision attempts to save after the newer revision was
  persisted
- **THEN** the application rejects the stale save with a conflict response
- **AND** the newer saved values remain unchanged
- **AND** the user is prompted to reload before retrying

### Requirement: Draft view and mutation authorization

The application SHALL enforce draft read and mutation authorization on the
server. In the MVP, only `global`, `admin`, and `to_qltb` users with a
server-verified current unit may read or mutate the unit draft. The server
SHALL normalize `admin` as a global role and SHALL reject caller-supplied
tenant overrides.

#### Scenario: authorized user views a draft

- **GIVEN** an authorized category-management user has a current unit in the
  authenticated session
- **WHEN** the user opens an existing draft
- **THEN** the application renders the saved draft read-only or editable
  according to the selected UI mode
- **AND** the server verifies the same session unit before returning data

#### Scenario: direct cross-tenant access is rejected

- **GIVEN** an authorized user has a session unit A
- **WHEN** a client or direct RPC request supplies unit B
- **THEN** the server rejects the request
- **AND** no data from unit B is returned or modified

### Requirement: Draft persistence security and audit

New regulatory source, draft, and audit tables SHALL be inaccessible through
direct `anon`, `authenticated`, or `public` table privileges. Access SHALL use
explicitly granted guarded RPCs with authenticated user, role, and unit checks.
Read operations SHALL NOT require an expected revision. Save, exclude, and
restore SHALL require an expected revision and atomically reject stale writes
with a conflict response. Create-or-open SHALL be transactional and protected
by the one-editable-draft uniqueness invariant. Security-definer functions
SHALL set `search_path = public, pg_temp`.

Each successful draft create, save, exclude, and restore mutation SHALL write
an audit event in the same transaction. The event SHALL derive actor identity
and unit from JWT claims and include event type, timestamp, and before/after
state. Audit history is persistence-only and is not a user-visible MVP screen.

#### Scenario: unauthorized direct table access is rejected

- **GIVEN** a caller does not use an authorized draft RPC
- **WHEN** the caller attempts to read or write new draft/source/audit tables
- **THEN** the database rejects the direct table operation
- **AND** existing active quota contracts remain unaffected
