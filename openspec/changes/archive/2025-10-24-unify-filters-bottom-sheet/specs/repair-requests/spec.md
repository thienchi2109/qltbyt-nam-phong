## MODIFIED Requirements

### Requirement: Repair Requests Filtering UI
The page SHALL provide a single advanced filters UI for status, facility (when permitted), and date range.

#### Scenario: Single entry point
- **WHEN** users want to filter
- **THEN** they use the "Bộ lọc" control to open the unified filters UI

#### Scenario: Bottom sheet on mobile/tablet
- **WHEN** on small screens
- **THEN** the filters open as a bottom sheet; on desktop they open as a dialog

#### Scenario: Chips and persistence
- **WHEN** filters are applied or removed
- **THEN** chips update accordingly and selections persist across reloads

## REMOVED Requirements

### Requirement: Inline Status Filter Dropdown
**Reason**: Duplicated with advanced filters and caused state conflicts.
**Migration**: Use advanced filters exclusively.
