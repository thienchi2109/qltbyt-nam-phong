## MODIFIED Requirements

### Requirement: Desktop draft catalog workspace presentation

The draft catalog editor in the Device Quota Categories workspace SHALL render
the immutable Thông tư 10/2026 appendix structure as one appendix-aligned
semantic table at viewport widths of at least `1024px`. The table SHALL
preserve all 42 source rows, source order, source-declared parent
relationships, and source references.

The table SHALL present the legal source columns in this order:

1. `TT`
2. `Chủng loại`
3. `Đơn vị tính`
4. `Số lượng định mức`

Those four columns SHALL be read-only. The table SHALL present a separate
unit-draft column group after them:

1. `ĐVT áp dụng`
2. `SL đề xuất`
3. `Ghi chú`

Only the unit-draft group may contain the ordinary inline draft inputs.
`displayNameOverride` SHALL remain available through an explicit secondary row
action, but SHALL NOT replace or make the regulatory `Chủng loại` editable.
The primary editor SHALL NOT retain the permanent structure sidebar, compact
item-card summaries, or single-expanded-item interaction from the previous
presentation.

#### Scenario: appendix columns are visible in source order

- **GIVEN** an authorized user opens an editable or read-only draft catalog
- **WHEN** the table renders
- **THEN** it shows the legal column group in the exact order `TT`,
  `Chủng loại`, `Đơn vị tính`, `Số lượng định mức`
- **AND** it shows the unit-draft group after the legal group in the exact
  order `ĐVT áp dụng`, `SL đề xuất`, `Ghi chú`
- **AND** the table identifies the two groups so users can distinguish source
  values from unit-entered values
- **AND** the primary editor does not render a permanent structure sidebar,
  compact item-card summaries, or a single-expanded-item control

#### Scenario: appendix hierarchy and source order are preserved

- **GIVEN** the frozen snapshot contains five structural section rows and 37
  equipment rows
- **WHEN** the table renders
- **THEN** it renders each section as a full-width hierarchy row
- **AND** it renders the 37 equipment rows in source order beneath their
  source-declared section where applicable
- **AND** it keeps top-level equipment rows in their source positions
- **AND** it does not synthesize, flatten, or reorder regulatory parents

#### Scenario: legal source fields remain read-only

- **GIVEN** an item row contains a regulatory name, unit, and multiline quota
  rules
- **WHEN** the row renders in editable mode
- **THEN** `Chủng loại`, `Đơn vị tính`, and `Số lượng định mức` render as
  read-only cells rather than inputs
- **AND** the complete source quota text is visible as readable multiline
  content in the `Số lượng định mức` cell
- **AND** source page/reference details remain available without a separate
  structure panel

#### Scenario: only unit-specific fields are entered inline

- **GIVEN** an editable draft item has no applied-unit override
- **WHEN** the row renders
- **THEN** `ĐVT áp dụng` shows the regulatory unit as a visible suggestion or
  fallback
- **AND** rendering that suggestion does not create a staged patch or
  persisted value
- **AND** the user can edit `ĐVT áp dụng`, `SL đề xuất`, and `Ghi chú`
- **AND** the user is not required to re-enter unchanged legal source values
- **AND** the existing staged patch and validation semantics remain unchanged

#### Scenario: proposed quantity is not presented as a legal quota

- **GIVEN** the user enters a value in `SL đề xuất`
- **WHEN** the row or save feedback renders
- **THEN** the value is labeled as a unit proposal
- **AND** the UI does not call it an approved quota or legal determination
- **AND** the application does not infer or certify compliance against the
  conditional source rules

#### Scenario: display-name override remains secondary

- **GIVEN** a user needs a local display name
- **WHEN** the user invokes the row's explicit secondary-name action
- **THEN** the user can edit the existing `displayNameOverride` draft field
- **AND** the regulatory `Chủng loại` text remains unchanged and visible
- **AND** the override is staged through the existing patch callback
- **AND** the main table does not add a permanently repeated name input
- **AND** the secondary-name and exclude/restore actions share the
  `Chủng loại` row-action area rather than adding a permanent action column

#### Scenario: section rows and excluded rows remain understandable

- **GIVEN** the draft contains included, excluded, or read-only rows
- **WHEN** the table renders
- **THEN** section rows remain visually distinct and non-editable
- **AND** excluded rows remain visible in source order with muted status
- **AND** editable rows expose only the actions allowed by the existing mode
- **AND** exclude/restore uses the existing immediate mutation callbacks

#### Scenario: save and scrolling remain coherent

- **GIVEN** an editable draft is long enough to require scrolling
- **WHEN** the user edits a draft cell and scrolls the table
- **THEN** the existing save toolbar remains sticky, visible, and outside the
  table's vertical scroll region
- **AND** ordinary edits remain staged until the existing save action
- **AND** horizontal overflow is contained by the table viewport
- **AND** `TT` and `Chủng loại` remain visible while the remaining columns
  scroll at constrained desktop widths
- **AND** the page does not acquire unintended horizontal overflow

#### Scenario: technical metadata remains outside the user-facing header

- **GIVEN** the editor has snapshot, revision, raw draft status, save
  timestamp, and mode state
- **WHEN** the appendix-aligned workspace header renders
- **THEN** those technical values are not rendered as a dedicated metadata row
- **AND** the header exposes only concise user-relevant save feedback beside
  the existing save action
- **AND** snapshot and revision state remain available to existing save,
  conflict, and mutation logic
- **AND** stale-conflict feedback retains the user-relevant version context
  required by the existing recovery behavior

#### Scenario: table semantics and actions are accessible

- **GIVEN** the appendix-aligned table renders
- **WHEN** a keyboard or assistive-technology user navigates the table
- **THEN** the table has an accessible name or caption
- **AND** grouped and individual headers are associated with their columns
- **AND** every editable input and row action has an item-specific accessible
  name
- **AND** status and read-only distinctions do not depend on color alone
- **AND** keyboard order proceeds coherently across each row's source context
  and editable fields

#### Scenario: existing draft behavior is preserved

- **GIVEN** the appendix-aligned table presentation is deployed
- **WHEN** a user edits fields, saves, excludes, restores, views rules, opens
  read-only mode, or encounters a stale revision conflict
- **THEN** existing handlers, validation, authorization, mutation semantics,
  source ordering, and conflict recovery remain unchanged
- **AND** active category CRUD, both Excel import flows, mapping, reporting,
  compliance, and future publication behavior remain unaffected
- **AND** no API, database, permission, business-rule, mobile, or `#982`
  scope is introduced

#### Scenario: required visual and interaction evidence is captured

- **GIVEN** the presentation change is ready for review
- **WHEN** equivalent visual QA and interaction verification are performed
- **THEN** evidence covers `1024px`, `1280x720`, `1366x768`, and `1440x900`
- **AND** evidence verifies grouped headers, source/input alignment,
  hierarchy rows, sticky columns, contained scrolling, and no page overflow
- **AND** interaction tests use `@testing-library/user-event`
- **AND** no browser or Playwright test is added
