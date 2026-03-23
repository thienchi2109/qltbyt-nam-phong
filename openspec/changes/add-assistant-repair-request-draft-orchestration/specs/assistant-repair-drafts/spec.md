## ADDED Requirements

### Requirement: Route-Orchestrated Repair Request Draft Emission
The system SHALL emit a structured `repairRequestDraft` assistant artifact from `/api/chat` only after route-owned orchestration confirms explicit draft intent, a single target equipment, and complete required draft fields.

#### Scenario: Emit a repair-request draft after complete multi-turn input
- **WHEN** the user enters an explicit draft-intent phrase such as `tạo phiếu sửa chữa`, `tạo phiếu yêu cầu sửa chữa thiết bị`, `lập yêu cầu sửa chữa`, `soạn yêu cầu sửa chữa`, or `điền trước form sửa chữa`
- **AND** the active conversation resolves exactly one equipment target from `equipmentLookup`
- **AND** the conversation provides both `mo_ta_su_co` and `hang_muc_sua_chua`
- **THEN** `/api/chat` emits a `repairRequestDraft` artifact in the assistant stream
- **AND** the emitted artifact is represented as `generateRepairRequestDraft` tool output

#### Scenario: Explicit draft intent preserves equipment evidence lookup
- **WHEN** the request includes both `equipmentLookup` and `repairSummary`
- **AND** the latest user turn contains an explicit draft-intent phrase, including the built-in starter-chip text `Tạo phiếu yêu cầu sửa chữa thiết bị`
- **THEN** the route keeps `equipmentLookup` available for the draft flow
- **AND** the request is not collapsed into a `repairSummary`-only path before draft orchestration runs

#### Scenario: Missing required draft fields
- **WHEN** the user has active draft intent
- **AND** the conversation does not yet provide `mo_ta_su_co` or `hang_muc_sua_chua`
- **THEN** `/api/chat` does not emit a `repairRequestDraft` artifact
- **AND** the assistant asks follow-up questions for the missing required information

#### Scenario: Ambiguous or unresolved equipment target
- **WHEN** the user has active draft intent
- **AND** `equipmentLookup` returns zero or multiple equipment candidates
- **THEN** `/api/chat` does not emit a `repairRequestDraft` artifact
- **AND** the assistant asks the user to clarify the target equipment

### Requirement: Repair Draft Session Lifecycle
The system SHALL maintain a repair-draft session across follow-up turns until the draft is emitted successfully or the user explicitly cancels the draft flow.

#### Scenario: Continue an active draft session on a follow-up turn
- **WHEN** the user previously started a repair-draft session with explicit draft intent
- **AND** the assistant asked for missing required information
- **AND** the user replies with the missing details on a later turn without repeating the original create-intent phrase
- **THEN** the route continues the same active draft session
- **AND** the draft may be emitted once all guards pass

#### Scenario: Non-draft repair workflow questions keep existing repair-summary routing
- **WHEN** the latest user turn asks about repair-request status, backlog, or handling progress
- **AND** the turn does not contain explicit draft-intent language
- **THEN** the existing repair workflow routing may still prefer `repairSummary`
- **AND** the route does not treat that turn as the start of a repair-draft session

#### Scenario: Cancel an active draft session
- **WHEN** the user says `thôi không tạo nữa`, `hủy tạo phiếu`, or `không cần tạo phiếu` during an active repair-draft session
- **THEN** the active draft session is canceled
- **AND** `/api/chat` does not emit a `repairRequestDraft` artifact for that canceled flow

#### Scenario: Close the draft session after successful emission
- **WHEN** `/api/chat` emits a `repairRequestDraft` artifact successfully
- **THEN** the active repair-draft session is considered complete
- **AND** later turns require new explicit draft intent to start another repair-draft flow

### Requirement: Orchestration-Only Safety Contract
The system SHALL keep repair-request draft generation under route-owned orchestration and MUST NOT treat it as a model-autonomous tool or a mutating backend action.

#### Scenario: Draft tool remains excluded from model runtime tools
- **WHEN** `buildToolRegistry()` assembles the runtime tool map for the assistant
- **THEN** `generateRepairRequestDraft` is not exposed as an autonomous model tool
- **AND** repair-request draft emission remains controlled by route orchestration

#### Scenario: Draft emission does not create a repair request
- **WHEN** a `repairRequestDraft` artifact is emitted
- **THEN** the system only returns advisory draft data for UI handoff
- **AND** the route does not call `repair_request_create`
- **AND** no repair request record is created until the user submits the form manually
