## MODIFIED Requirements

### Requirement: Transfers Filtering UI Presentation
The Transfers page SHALL provide advanced filters with responsive presentation that adapts to screen size.

#### Scenario: Bottom sheet on mobile/tablet
- **WHEN** users access the page on mobile or tablet screens (viewport width < 1024px)
- **THEN** clicking "Bộ lọc" opens filters in a bottom sheet that slides up from the bottom of the screen

#### Scenario: Dialog on desktop
- **WHEN** users access the page on desktop screens (viewport width >= 1024px)
- **THEN** clicking "Bộ lọc" opens filters in a centered modal dialog

#### Scenario: Consistent filter functionality
- **WHEN** filters are opened in either presentation mode
- **THEN** all filter controls work identically: status multi-select, date range pickers, clear button, and apply button

#### Scenario: Filter state persistence
- **WHEN** filters are applied and the sheet/dialog is closed
- **THEN** active filters display as chips below the search bar and persist across page reloads

#### Scenario: Filter count badge
- **WHEN** one or more filter criteria are active
- **THEN** the "Bộ lọc" button displays a badge indicating the count of active filter groups

### Requirement: Transfers Toolbar Layout
The Transfers page toolbar SHALL maintain facility filter in the toolbar for users with cross-facility permissions.

#### Scenario: Facility filter remains in toolbar
- **WHEN** global or regional_leader users access the page
- **THEN** the facility dropdown selector remains visible in the toolbar alongside the "Bộ lọc" button
- **AND** the facility filter is NOT moved into the advanced filters bottom sheet/dialog
