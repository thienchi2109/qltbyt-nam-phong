## ADDED Requirements

### Requirement: Read-Only Tool Payload Compaction
The assistant system SHALL compact migrated read-only / RPC tool outputs before they are resent to the model and SHALL keep model-visible history limited to compact summaries plus required follow-up context.

#### Scenario: Follow-up turn reuses compacted read-only tool history
- **WHEN** an earlier assistant turn contains output from a migrated read-only / RPC tool
- **AND** the user sends a follow-up message or regenerates the assistant response
- **THEN** the outgoing assistant request uses a compacted representation of that migrated tool output
- **AND** large raw payload fields are not resent as model-visible history

#### Scenario: Server enforces compacted model-context budget
- **WHEN** `/api/chat` receives validated UI messages that contain migrated read-only / RPC tool outputs
- **THEN** the route evaluates the raw request budget and the compacted model-context budget separately
- **AND** model execution runs against the compacted history rather than the raw UI transcript

### Requirement: Draft Tool Output Carve-Out
The assistant system SHALL preserve the current raw output contract for draft-producing tools during the payload-compaction rollout.

#### Scenario: Troubleshooting draft output stays on the raw artifact contract
- **WHEN** `generateTroubleshootingDraft` produces a tool output
- **THEN** payload compaction does not wrap that output in the read-only / RPC envelope
- **AND** downstream UI logic can continue to inspect `output.kind` directly

#### Scenario: Repair-request draft output stays on the raw artifact contract
- **WHEN** `/api/chat` emits the synthetic `generateRepairRequestDraft` artifact
- **THEN** payload compaction does not wrap that output in the read-only / RPC envelope
- **AND** repair-draft session completion logic can continue to inspect `output.kind` directly

### Requirement: Scoped `categorySuggestion` Candidate Retrieval
The assistant system SHALL require `device_name` before calling `categorySuggestion` and SHALL return a bounded candidate set instead of the full category catalog.

#### Scenario: Missing device name triggers clarification instead of broad retrieval
- **WHEN** the user asks which category a device should map to
- **AND** the conversation has not yet provided `device_name`
- **THEN** the assistant asks for the device name first
- **AND** `categorySuggestion` is not called with an empty input object

#### Scenario: Provided device name returns bounded category candidates
- **WHEN** `categorySuggestion` receives `device_name`
- **THEN** the tool returns a compact candidate set rather than the full facility category tree
- **AND** the model-visible candidate fields include `ma_nhom`, `ten_nhom`, `parent_name`, and `phan_loai`
- **AND** the candidate set is bounded to the configured top-k limit

### Requirement: `departmentList` Uses the Shared Envelope Contract
The assistant system SHALL migrate `departmentList` to the shared read-only / RPC envelope contract without requiring an artifact channel in pass 1.

#### Scenario: Department list history resends without a raw payload dump
- **WHEN** `departmentList` returns its result in an earlier assistant turn
- **AND** the conversation continues on a later turn
- **THEN** assistant history resends only the compact model-visible summary and follow-up context for `departmentList`
- **AND** no `uiArtifact` is required for pass-1 behavior

### Requirement: Read-Only / RPC Tool Migration Gate
The assistant system SHALL require explicit migration metadata for every read-only / RPC tool and SHALL lock the pass-1 migration map so later audits cannot be skipped silently.

#### Scenario: New read-only / RPC tool requires migration metadata
- **WHEN** a developer adds a new read-only / RPC tool to the assistant registry
- **THEN** the tool definition includes `migrationStatus` and budget metadata
- **AND** the assistant contract tests fail if that metadata is missing

#### Scenario: Pass-1 migration scope remains explicitly bounded
- **WHEN** the pass-1 migration map is evaluated by the assistant contract tests
- **THEN** `categorySuggestion` and `departmentList` are the only tools marked `migrated`
- **AND** every other read-only / RPC tool remains explicitly marked `pending` until a later audited migration updates the map
