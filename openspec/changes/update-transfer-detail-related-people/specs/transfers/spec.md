## ADDED Requirements

### Requirement: Transfer detail dialog shows requester and approver from a detail read path
The system SHALL populate `Người liên quan` in the Transfers detail dialog from a transfer-detail read path that resolves requester and approver user objects independently of the transfer list-row payload.

#### Scenario: Completed transfer shows requester and approver
- **WHEN** a user opens the detail dialog for a transfer request in status `hoan_thanh`
- **AND** the transfer record has resolvable `nguoi_yeu_cau_id` and `nguoi_duyet_id`
- **THEN** the dialog displays `Người yêu cầu` with the requester full name
- **AND** the dialog displays `Người duyệt` with the approver full name

#### Scenario: Approved transfer shows requester and approver
- **WHEN** a user opens the detail dialog for a transfer request in status `da_duyet`
- **AND** the transfer record has resolvable `nguoi_yeu_cau_id` and `nguoi_duyet_id`
- **THEN** the dialog displays both requester and approver in `Người liên quan`

### Requirement: Related people render consistently across statuses when data exists
The Transfers detail dialog SHALL render requester and approver consistently for any transfer status when the corresponding user data exists.

#### Scenario: Pending transfer shows requester only
- **WHEN** a user opens the detail dialog for a transfer request in status `cho_duyet`
- **AND** the transfer record has a resolvable requester
- **AND** no approver has been assigned yet
- **THEN** the dialog displays `Người yêu cầu`
- **AND** the dialog does not display an empty or misleading approver row

#### Scenario: Missing referenced user does not crash the dialog
- **WHEN** a transfer request references a requester or approver ID that cannot be resolved to a user object
- **THEN** the dialog still renders successfully
- **AND** only the resolvable related-person rows are shown

### Requirement: Transfer detail related-people data does not depend on list-row enrichment
The system SHALL keep Transfers list and kanban row payloads independent from the detail-dialog related-people contract.

#### Scenario: Detail dialog resolves related people even when list row only has IDs
- **WHEN** a transfer list or kanban row contains `nguoi_yeu_cau_id` and `nguoi_duyet_id` without nested user objects
- **AND** the user opens the detail dialog from that row
- **THEN** the dialog still resolves and displays requester and approver through the transfer-detail read path
- **AND** the list-row payload shape does not need to embed those nested user objects
