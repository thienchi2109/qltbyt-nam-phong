## ADDED Requirements

### Requirement: Canonical repair-request create intent
The system SHALL provide a single canonical app-wide intent for opening the Repair Request create flow. All UI surfaces that start a new repair request MUST derive navigation from the shared intent contract instead of hardcoding their own `/repair-requests` query strings.

#### Scenario: Shared helper builds create flow without equipment context
- **WHEN** a caller requests the repair-request create flow without an equipment identifier
- **THEN** the system returns the canonical create deep-link for the Repair Requests page
- **AND** the deep-link includes the create action contract required to open the form.

#### Scenario: Shared helper builds create flow with equipment context
- **WHEN** a caller requests the repair-request create flow with an `equipmentId`
- **THEN** the system returns the same canonical create deep-link
- **AND** the deep-link also includes the equipment identifier needed for downstream prefill.

### Requirement: Shared create intent across source surfaces
The Dashboard, Equipment desktop actions, Equipment mobile actions, QR scanner repair actions, and AssistantPanel repair-draft handoff SHALL all use the same create-intent API to navigate into the Repair Requests create flow.

#### Scenario: Equipment desktop action uses shared create intent
- **WHEN** a user clicks the repair-request action from an equipment row on desktop
- **THEN** the navigation is produced by the shared create-intent API
- **AND** the target deep-link matches the canonical create contract.

#### Scenario: Equipment mobile action uses shared create intent
- **WHEN** a user taps "Báo sửa chữa" or the equivalent repair action from the mobile equipment surface
- **THEN** the navigation is produced by the shared create-intent API
- **AND** the target deep-link matches the canonical create contract.

#### Scenario: Dashboard action uses shared create intent
- **WHEN** a user starts a repair request from the Dashboard equipment action flow
- **THEN** the navigation is produced by the shared create-intent API
- **AND** the target deep-link matches the canonical create contract.

#### Scenario: QR scanner action uses shared create intent
- **WHEN** a user starts a repair request from the QR scanner equipment action flow
- **THEN** the navigation is produced by the shared create-intent API
- **AND** the target deep-link matches the canonical create contract.

#### Scenario: Assistant draft handoff uses shared create intent
- **WHEN** the assistant panel hands off a repair-request draft into the Repair Requests page
- **THEN** the navigation is produced by the shared create-intent API
- **AND** the target deep-link matches the canonical create contract.

### Requirement: Repair Requests page remains the single create-flow sink
The Repair Requests page SHALL remain the single sink for interpreting the create deep-link, opening the create sheet, and applying optional equipment prefill from `equipmentId`.

#### Scenario: Canonical create deep-link opens the create sheet
- **WHEN** the user lands on the Repair Requests page with the canonical create action deep-link
- **THEN** the page opens the create sheet without requiring additional user interaction.

#### Scenario: Canonical create deep-link preselects equipment
- **WHEN** the canonical create deep-link includes a valid `equipmentId`
- **THEN** the Repair Requests flow resolves that equipment
- **AND** the create sheet preselects the matching device so name and code are already filled in the equipment field.

#### Scenario: Invalid equipmentId degrades gracefully
- **WHEN** the canonical create deep-link includes an `equipmentId` that cannot be resolved for the current user context
- **THEN** the Repair Requests page still opens the create sheet
- **AND** the equipment field remains unselected rather than crashing or blocking the form
- **AND** the flow degrades gracefully without changing the submission contract.

#### Scenario: Canonical create deep-link survives direct navigation
- **WHEN** the user refreshes, pastes, or opens the canonical create deep-link directly in the browser
- **THEN** the Repair Requests page resolves the same create-flow behavior
- **AND** the flow does not depend on in-memory state from the source page.

### Requirement: Contract changes do not alter repair-request submission semantics
Centralizing the create intent SHALL NOT change the fields, submission payload, or backend write behavior of the Repair Request create form.

#### Scenario: Form submission contract remains unchanged
- **WHEN** a user submits a repair request after opening the form through the shared create intent
- **THEN** the system uses the same create-form fields and submission flow as before
- **AND** no backend schema or RPC changes are required solely for this navigation change.
