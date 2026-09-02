## ADDED Requirements

### Requirement: Desktop draft catalog workspace presentation

The draft catalog editor in the Device Quota Categories workspace SHALL provide
a dense desktop/tablet presentation from `1024px` viewport width upward without
changing its existing draft data contracts or business behavior.

#### Scenario: compact workspace is rendered on desktop

- **GIVEN** an authorized user opens an editable or read-only draft catalog at
  a viewport width of at least `1024px`
- **WHEN** the draft catalog editor renders
- **THEN** the workspace uses the available route content area for the editor
- **AND** the structure navigation SHALL provide an approximately `176px`
  expanded panel and a `48px` collapsed rail with a manual toggle between them
- **AND** at constrained widths from `1024px` through `1199px`, the structure
  navigation defaults to the collapsed rail
- **AND** expanding the panel at those constrained widths overlays the editor
  without shrinking the item content or field grid
- **AND** neither sidebar mode causes unintended horizontal page overflow
- **AND** the item content has an independent scroll region
- **AND** the editor does not render a mobile drawer, bottom sheet, or mobile
  navigation mode

#### Scenario: technical metadata is kept out of the user-facing header

- **GIVEN** the draft editor has snapshot, revision, raw draft status, save
  timestamp, and mode state
- **WHEN** the editor header renders
- **THEN** those technical values are not rendered as a dedicated metadata row
- **AND** the header exposes only concise user-relevant save feedback beside the
  existing save action
- **AND** snapshot and revision state remain available to the existing save,
  conflict, and mutation logic
- **AND** stale-conflict feedback retains the user-relevant version context
  required by the existing recovery behavior

#### Scenario: repeated item records share one field grid

- **GIVEN** a section contains multiple regulatory item records
- **WHEN** an item record is rendered in its editable representation
- **THEN** every record uses the same field-grid column boundaries
- **AND** display name, applied unit, proposed quantity, and notes begin on the
  same baseline and use consistent input dimensions
- **AND** a long item name or label does not push a neighboring field to a
  different vertical position

#### Scenario: item labels and actions avoid redundant names

- **GIVEN** an item name is already rendered in its item header
- **WHEN** its editable fields and item actions render
- **THEN** field labels use concise object-independent text
- **AND** source, rule, exclusion, and restoration actions use concise visible
  labels, including `Khôi phục` for restoration, and do not append the item
  name when context is already available
- **AND** accessible names still identify the target item where needed

#### Scenario: compact records expose one editable item

- **GIVEN** a section or workspace contains multiple draft item records
- **WHEN** the item list renders
- **THEN** item records appear as compact summaries by default
- **AND** at most one item is expanded into the full editable field grid at a
  time
- **AND** opening another item collapses the previously expanded item without
  changing its staged values
- **AND** section collapse continues to hide its items without changing their
  data or source order

#### Scenario: source and rule traceability remains available

- **GIVEN** an item has source references, source pages, an immutable source
  position, a parent relationship, or multiline regulatory rule text
- **WHEN** the compact item representation renders
- **THEN** a concise source summary remains visible
- **AND** every item's complete source references and pages remain available
  through disclosure controls
- **AND** its immutable source position and parent relationship are preserved
- **AND** multiline regulatory rule text remains available without truncating,
  flattening, rewriting, or otherwise changing its content
- **AND** the redesign does not infer, rewrite, reorder, or remove regulatory
  source semantics

#### Scenario: save remains available while items scroll

- **GIVEN** an editable draft contains enough records to require scrolling
- **WHEN** the user scrolls the item content region
- **THEN** the single top workspace save toolbar remains sticky and visible
  outside that scroll region
- **AND** it uses the existing save callback, disabled conditions, pending state,
  and validation behavior
- **AND** the editor does not add a second bottom save bar or a new cancel/reset
  operation

#### Scenario: existing draft behavior is preserved

- **GIVEN** the polished presentation is deployed
- **WHEN** a user edits fields, saves, excludes, restores, views rules, opens
  read-only mode, or encounters a stale revision conflict
- **THEN** the existing handlers, validation, authorization, mutation semantics,
  source ordering, and conflict recovery remain unchanged
- **AND** active category CRUD, both Excel import flows, mapping, reporting,
  compliance, and future publication behavior remain unaffected

#### Scenario: target viewport evidence is captured

- **GIVEN** the presentation change is ready for review
- **WHEN** manual or equivalent visual QA is performed for the landed commit
- **THEN** reviewable evidence is captured at `1024px`, `1280x720`,
  `1366x768`, and `1440x900`
- **AND** the evidence verifies field alignment, compact record density,
  sidebar defaults and overlay behavior, sticky save visibility, scroll
  boundaries, and the absence of unintended horizontal overflow
- **AND** automated interaction coverage for this change uses
  `@testing-library/user-event` rather than a browser or Playwright test
