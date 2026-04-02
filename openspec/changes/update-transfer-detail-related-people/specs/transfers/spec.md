## ADDED Requirements

### Requirement: Transfer detail dialog shows requester and approver from `transfer_request_get(p_id)`
The system SHALL populate `Người liên quan` in the Transfers detail dialog from `transfer_request_get(p_id)`, a transfer-detail read path that resolves requester and approver user objects independently of the transfer list-row payload.

#### Scenario: Completed transfer shows requester and approver
- **WHEN** a user opens the detail dialog for a transfer request in status `hoan_thanh`
- **AND** `transfer_request_get(p_id)` returns resolvable `nguoi_yeu_cau` and `nguoi_duyet` objects
- **THEN** the dialog displays `Người yêu cầu` with the requester full name
- **AND** the dialog displays `Người duyệt` with the approver full name

#### Scenario: Approved transfer shows requester and approver
- **WHEN** a user opens the detail dialog for a transfer request in status `da_duyet`
- **AND** `transfer_request_get(p_id)` returns resolvable `nguoi_yeu_cau` and `nguoi_duyet` objects
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
- **WHEN** `transfer_request_get(p_id)` returns a transfer request where a requester or approver reference cannot be resolved to a user object
- **THEN** the dialog still renders successfully
- **AND** only the resolvable related-person rows are shown

### Requirement: Transfer detail related-people data does not depend on list-row enrichment
The system SHALL keep Transfers list and kanban row payloads independent from the detail-dialog related-people contract.

#### Scenario: Detail dialog resolves related people even when list row only has IDs
- **WHEN** a transfer list or kanban row contains `nguoi_yeu_cau_id` and `nguoi_duyet_id` without nested user objects
- **AND** the user opens the detail dialog from that row
- **THEN** the dialog calls `transfer_request_get(p_id)` and resolves requester and approver through that detail read path
- **AND** the list-row payload shape does not need to embed those nested user objects
