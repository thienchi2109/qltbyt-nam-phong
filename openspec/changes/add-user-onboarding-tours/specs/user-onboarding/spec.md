## ADDED Requirements

### Requirement: Interactive Product Tours
The system SHALL provide interactive product tours using Driver.js to guide users through key features and workflows.

#### Scenario: User triggers Dashboard Welcome Tour
- **WHEN** user clicks the Help button in the app header
- **THEN** the Dashboard Welcome Tour starts with a welcome modal
- **AND** subsequent steps highlight KPI cards, quick actions, QR scanner, dashboard tabs, and navigation
- **AND** each step displays Vietnamese title and description

#### Scenario: User completes a tour
- **WHEN** user reaches the final step and clicks "Done" (Xong)
- **THEN** the tour closes
- **AND** completion state is saved to localStorage

#### Scenario: User exits tour early
- **WHEN** user clicks the close button or presses Escape during a tour
- **THEN** the tour closes immediately
- **AND** completion state is NOT saved (tour can be replayed)

### Requirement: Tour Completion Persistence
The system SHALL persist tour completion state in localStorage to prevent redundant tour triggers.

#### Scenario: Previously completed tour
- **WHEN** user has completed the Dashboard Welcome Tour
- **AND** user clicks the Help button again
- **THEN** the tour starts from the beginning (replay functionality)

#### Scenario: Tour state reset
- **WHEN** user clears browser localStorage
- **THEN** tour completion state is reset
- **AND** tours can be triggered again as if first-time

### Requirement: Help Button in Header
The system SHALL display a Help button in the app header that triggers available tours.

#### Scenario: Help button visibility
- **WHEN** user is logged in and on any app page
- **THEN** a Help button (with HelpCircle icon) is visible in the header

#### Scenario: Help button interaction
- **WHEN** user clicks the Help button while on the Dashboard page
- **THEN** the Dashboard Welcome Tour is triggered

### Requirement: Tour Element Targeting
The system SHALL use `data-tour-*` HTML attributes to mark elements as tour step targets.

#### Scenario: Tour targets marked elements
- **WHEN** a tour step references `[data-tour-kpi-cards]`
- **THEN** Driver.js highlights the element with that data attribute
- **AND** the popover is positioned relative to that element

#### Scenario: Missing target element
- **WHEN** a tour step references a `data-tour-*` attribute that does not exist in the DOM
- **THEN** the step is skipped
- **AND** the tour continues to the next step

### Requirement: Vietnamese Language Support
The system SHALL display all tour content (titles, descriptions, button labels) in Vietnamese.

#### Scenario: Tour step content language
- **WHEN** a tour step is displayed
- **THEN** the title is in Vietnamese (e.g., "Chào mừng đến CVMEMS!")
- **AND** the description is in Vietnamese
- **AND** navigation buttons display Vietnamese labels ("Tiếp theo", "Trước", "Xong")
