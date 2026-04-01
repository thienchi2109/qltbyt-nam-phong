## ADDED Requirements

### Requirement: Bounded long-text rendering in equipment desktop table
The system SHALL keep `Mã thiết bị` and `Tên thiết bị` from disproportionately expanding the Equipments desktop table when their values are long.

#### Scenario: Long equipment code stays single-line
- **WHEN** an equipment row has a long `Mã thiết bị` value in the desktop table
- **THEN** the code is rendered on a single line
- **AND** the visible text is truncated instead of wrapping

#### Scenario: Long equipment name uses at most two lines
- **WHEN** an equipment row has a long `Tên thiết bị` value in the desktop table
- **THEN** the name is rendered using no more than two visible lines
- **AND** any overflow beyond that limit is visually clamped

#### Scenario: Long primary text no longer dominates table width
- **WHEN** the desktop table contains long `Mã thiết bị` or `Tên thiết bị` values
- **THEN** those columns remain visually bounded
- **AND** lower-priority columns are not pushed off-screen solely because one row has unusually long primary text

### Requirement: Full-text access for truncated equipment identifiers
The system SHALL preserve access to the full `Mã thiết bị` and `Tên thiết bị` values when the desktop table truncates or clamps them.

#### Scenario: Pointer user inspects truncated code
- **WHEN** a pointer user hovers a truncated `Mã thiết bị`
- **THEN** the system reveals the full value via tooltip or equivalent hover affordance

#### Scenario: Pointer user inspects clamped name
- **WHEN** a pointer user hovers a clamped `Tên thiết bị`
- **THEN** the system reveals the full value via tooltip or equivalent hover affordance

#### Scenario: Keyboard user inspects truncated primary text
- **WHEN** a keyboard user focuses truncated or clamped `Mã thiết bị` or `Tên thiết bị`
- **THEN** the system exposes the full value without requiring pointer interaction

### Requirement: Responsive column priority for narrower desktops
The system SHALL preserve visibility of higher-priority equipment columns on narrower desktop widths by hiding `Serial` before further degrading the presentation of `Mã thiết bị` and `Tên thiết bị`.

#### Scenario: Narrower desktop hides serial first
- **WHEN** the Equipments page is viewed on a narrower desktop width that triggers responsive column reduction
- **THEN** the `Serial` column is hidden before the system further compromises the readability of `Mã thiết bị` and `Tên thiết bị`

#### Scenario: Wider desktop restores serial
- **WHEN** the viewport returns to a wider desktop width after responsive auto-hide has hidden `Serial`
- **THEN** the table restores the user's prior `Serial` visibility preference
