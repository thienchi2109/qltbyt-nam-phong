## ADDED Requirements

### Requirement: Repair Request detail view separates details and history into tabs
The system SHALL present the Repair Request detail view with `Details` and `History` tabs so history is no longer absent from the view or mixed into the main details content.

#### Scenario: Repair Request detail opens in tabbed layout
- **WHEN** a user opens a Repair Request detail view
- **THEN** the view shows `Details` and `History` tabs
- **AND** the existing request detail content appears under `Details`
- **AND** history is rendered separately from the main details content

### Requirement: Repair Request history uses a tenant-safe RPC read path
The system SHALL retrieve Repair Request history through an RPC-only read path that reuses audit-log source data while enforcing the same tenant and role boundaries as the Repair Request detail view.

#### Scenario: Authorized tenant-scoped user views repair history
- **WHEN** a non-global user opens the `History` tab for a Repair Request they are allowed to view
- **THEN** the system fetches only that request's authorized history events through the Repair Request history RPC path
- **AND** the UI does not depend on the global-only audit viewer hook to render the detail-history surface

#### Scenario: Repair Request without authorized history shows empty state
- **WHEN** a user opens the `History` tab for a Repair Request with no authorized history events
- **THEN** the view shows the shared empty state
- **AND** the UI does not render blank space or raw audit payload data
