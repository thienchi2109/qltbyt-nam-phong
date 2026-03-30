## ADDED Requirements

### Requirement: Requested equipment resolution reaches a terminal state before create-intent cleanup
The Repair Requests create-intent sink SHALL keep `action=create&equipmentId=<id>` active until the requested equipment has reached a terminal resolution state for the current user context.

#### Scenario: equipment list settles before targeted equipment fetch
- **WHEN** the user opens `/repair-requests?action=create&equipmentId=<valid-id>`
- **AND** the initial equipment list finishes loading before the targeted equipment resolution path has finished
- **THEN** the create sheet is not opened blank during the pending window
- **AND** the deep-link intent remains active until the targeted equipment is resolved or declared unavailable.

#### Scenario: targeted equipment fetch resolves first
- **WHEN** the user opens `/repair-requests?action=create&equipmentId=<valid-id>`
- **AND** the targeted equipment resolution completes before the initial list meaningfully contains that equipment
- **THEN** the create sheet opens with the resolved equipment preselected
- **AND** the URL cleanup happens only after the create-intent path has reached that terminal resolved state.

### Requirement: Valid create intent with resolvable equipment prefills before opening
For a valid `action=create&equipmentId=<id>` deep-link, the Repair Requests page SHALL prefill the requested equipment before presenting the create sheet whenever that equipment can be resolved for the current user context.

#### Scenario: valid equipmentId prefills name and code
- **WHEN** the requested equipment can be resolved from the initial list or targeted fetch
- **THEN** the create sheet opens with that equipment selected
- **AND** the equipment field shows the matching device name and code instead of an empty selection.

### Requirement: Invalid or unavailable equipmentId degrades gracefully after resolution
If `action=create&equipmentId=<id>` references an invalid or unavailable equipment record, the system SHALL degrade gracefully only after the resolution path becomes terminal.

#### Scenario: invalid equipmentId opens blank create sheet after terminal missing state
- **WHEN** the user opens `/repair-requests?action=create&equipmentId=<invalid-or-unavailable-id>`
- **THEN** the system does not crash or loop while resolution is pending
- **AND** once the requested equipment is determined to be unavailable, the create sheet opens without a preselected device
- **AND** the URL cleanup happens after that terminal missing outcome.

### Requirement: Assistant draft handoff keeps precedence over equipment-resolution gating
Assistant draft handoff SHALL continue to open the create sheet from cached assistant data without being blocked by the requested-equipment resolution guard.

#### Scenario: assistant draft still opens create flow immediately
- **WHEN** an assistant draft is present in query cache for the Repair Requests create flow
- **THEN** the page applies the assistant draft and opens the create sheet using the existing handoff behavior
- **AND** the new requested-equipment resolution sequencing does not alter that precedence.
