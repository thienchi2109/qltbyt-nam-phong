## ADDED Requirements

### Requirement: Truncated long-text rendering in equipment desktop table
The system SHALL preserve the current single-line truncated rendering for long `Mã thiết bị` and `Tên thiết bị` values in the Equipments desktop table.

#### Scenario: Long equipment code stays single-line
- **WHEN** an equipment row has a long `Mã thiết bị` value in the desktop table
- **THEN** the code is rendered on a single line
- **AND** the visible text is truncated instead of wrapping

#### Scenario: Long equipment name stays single-line
- **WHEN** an equipment row has a long `Tên thiết bị` value in the desktop table
- **THEN** the name is rendered on a single line
- **AND** the visible text is truncated instead of wrapping

### Requirement: Bounded width for primary text columns
The system SHALL keep `Mã thiết bị` and `Tên thiết bị` visually bounded in the Equipments desktop table so unusually long values do not disproportionately expand those columns.

#### Scenario: Long equipment code does not over-expand its column
- **WHEN** an equipment row has an unusually long `Mã thiết bị` value in the desktop table
- **THEN** the `Mã thiết bị` column remains within its configured width bounds
- **AND** adjacent columns remain visible according to the current responsive layout

#### Scenario: Long equipment name does not over-expand its column
- **WHEN** an equipment row has an unusually long `Tên thiết bị` value in the desktop table
- **THEN** the `Tên thiết bị` column remains within its configured width bounds
- **AND** adjacent columns remain visible according to the current responsive layout

### Requirement: Full-text access for truncated equipment identifiers
The system SHALL preserve access to the full `Mã thiết bị` and `Tên thiết bị` values when the desktop table truncates them.

#### Scenario: Pointer user inspects truncated code
- **WHEN** a pointer user hovers a truncated `Mã thiết bị`
- **THEN** the system reveals the full value via tooltip or equivalent hover affordance

#### Scenario: Pointer user inspects truncated name
- **WHEN** a pointer user hovers a truncated `Tên thiết bị`
- **THEN** the system reveals the full value via tooltip or equivalent hover affordance

#### Scenario: Keyboard user inspects truncated primary text
- **WHEN** a keyboard user focuses truncated `Mã thiết bị` or `Tên thiết bị`
- **THEN** the system exposes the full value without requiring pointer interaction

### Requirement: Preserve current responsive table behavior
The system SHALL keep the current Equipments desktop responsive column-visibility behavior unchanged while adding full-text access for truncated primary text.

#### Scenario: Existing responsive visibility remains intact
- **WHEN** the Equipments page is viewed at a desktop width that already triggers the current reduced-column view
- **THEN** the same set of columns remains visible as before this change
- **AND** the change only adds full-text access for truncated `Mã thiết bị` and `Tên thiết bị`
