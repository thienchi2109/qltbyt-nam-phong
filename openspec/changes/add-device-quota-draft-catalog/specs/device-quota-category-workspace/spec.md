## ADDED Requirements

### Requirement: Unit-scoped draft catalog creation

The Device Quota workspace SHALL allow an authorized user to create or open
one editable draft catalog for the current unit resolved from the authenticated
session. The flow SHALL NOT ask the user to select or override the unit.

#### Scenario: current unit is available

- **GIVEN** an authorized user has a current unit in the authenticated session
- **WHEN** the user chooses `Tạo danh mục`
- **THEN** the application creates or opens the editable draft for that unit
- **AND** the draft is associated with the selected regulatory catalog version

#### Scenario: current unit is missing

- **GIVEN** an authorized user has no current unit in the authenticated session
- **WHEN** the user chooses `Tạo danh mục`
- **THEN** the application refuses to create the draft
- **AND** it shows actionable feedback
- **AND** no draft or active quota data is written

### Requirement: Regulatory-basis initialization

The draft catalog SHALL initialize with all 37 equipment items from the five
sections of the Thông tư 10/2026 appendix. Regulatory names, original units,
rules, source pages, and source references SHALL remain available as
read-only data.

#### Scenario: new draft is initialized

- **GIVEN** the current unit has no editable draft
- **WHEN** the user opens `Tạo danh mục`
- **THEN** the editor renders five regulatory sections
- **AND** it renders all 37 regulatory equipment items under those sections
- **AND** every regulatory item shows a Thông tư 10/2026 source reference

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

#### Scenario: user attempts to add a duplicate regulatory item

- **GIVEN** a regulatory item already exists in the current draft
- **WHEN** the user attempts to add the same regulatory item again
- **THEN** the application rejects the duplicate
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
