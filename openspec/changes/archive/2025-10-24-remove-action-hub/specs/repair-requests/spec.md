## REMOVED Requirements

### Requirement: Action Hub Aside (Split-Pane Quick Create)
**Reason**: Simplified UX. The aside duplicated the create Sheet and increased layout/state complexity (resizing, collapse state, view modes) without material benefit.
**Migration**: Use the "Tạo yêu cầu" button (desktop) or the floating action button (mobile) to open the create Sheet. Deep-link via `equipmentId` query param continues to prefill the form.

## MODIFIED Requirements

### Requirement: Repair Requests Page Layout
The page SHALL present a single-column layout on desktop and mobile; the split view and aside persistence is removed.

#### Scenario: Single-column content
- **WHEN** the user opens the Repair Requests page on desktop
- **THEN** the content is laid out in a single column (list + controls), with creation via right-side Sheet
- **AND** no aside expand/collapse or resize controls are present
