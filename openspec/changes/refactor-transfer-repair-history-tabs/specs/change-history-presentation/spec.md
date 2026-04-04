## ADDED Requirements

### Requirement: Shared detail-history presentation uses normalized entries
The system SHALL provide a shared change-history presentation layer for detail views that renders a normalized `ChangeHistoryEntry` input, with common loading, empty, and populated timeline states, without requiring consumers to know source-specific field names.

#### Scenario: Transfer detail renders shared history timeline
- **WHEN** the Transfers detail dialog passes normalized transfer history entries to the shared change-history presentation layer
- **THEN** the UI shows the action label, timestamp, actor, and labeled detail rows using the shared timeline
- **AND** the transfer dialog does not keep transfer-specific history formatting logic inline in the leaf dialog component

#### Scenario: Repair detail renders the same shared history states
- **WHEN** the Repair Requests detail view passes normalized repair history entries to the shared change-history presentation layer
- **THEN** the UI uses the same loading, empty, and populated presentation patterns as the Transfers detail dialog
- **AND** domain-specific field mapping remains outside the shared presentation components

### Requirement: Shared detail-history presentation remains UI-only
The system SHALL keep data fetching, tenant scoping, and permission enforcement outside the shared change-history presentation layer.

#### Scenario: Consumer provides pre-authorized data
- **WHEN** a domain detail surface renders history through the shared change-history components
- **THEN** the shared layer receives already fetched, already authorized, normalized entries from that domain
- **AND** the shared layer does not call RPCs or interpret tenant/user permissions on its own
