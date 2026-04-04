## ADDED Requirements

### Requirement: Transfer detail dialog separates overview, history, and progress into tabs
The system SHALL present the Transfer detail dialog with `Overview`, `History`, and `Progress` tabs so change history is no longer rendered inline with the main detail content.

#### Scenario: Transfer detail opens in tabbed layout
- **WHEN** a user opens a Transfer detail dialog
- **THEN** the dialog shows `Overview`, `History`, and `Progress` tabs
- **AND** the overview tab contains the transfer detail content without the inline history section

#### Scenario: History tab renders shared transfer history presentation
- **WHEN** a user opens the `History` tab for a transfer that has history events
- **THEN** the dialog renders those events through the shared normalized change-history presentation layer
- **AND** the transfer-specific field mapping is handled by a Transfer adapter instead of inline dialog logic

### Requirement: Transfer history refactor preserves existing detail and history read paths
The system SHALL keep the current Transfer detail/history read-path and cache-root contracts compatible while moving history into the tabbed layout.

#### Scenario: Existing cache and invalidation roots remain compatible
- **WHEN** a transfer mutation invalidates detail-dialog data after the tab refactor
- **THEN** the existing Transfer detail and history query roots remain sufficient to refresh the dialog state
- **AND** reopening the same transfer continues to reuse the current cached detail/history behavior expected by the dialog tests
