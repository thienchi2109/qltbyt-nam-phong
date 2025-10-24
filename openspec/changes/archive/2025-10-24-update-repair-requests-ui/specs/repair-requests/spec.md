## ADDED Requirements

### Requirement: Filter Chips and Modal
The system SHALL provide filter chips under the search input and a filter modal to manage status, facility (when permitted), and date range filters, with local persistence.

#### Scenario: Apply filters via modal
- **WHEN** the user selects status values (and facility/date range if needed) and confirms
- **THEN** corresponding chips appear under the search input reflecting the selections

#### Scenario: Remove a chip
- **WHEN** the user removes a status/facility/date chip
- **THEN** the filter state updates and the chip disappears

#### Scenario: Clear all
- **WHEN** the user chooses “Clear all”
- **THEN** all filters reset to defaults and no chips remain

#### Scenario: Facility visibility by role
- **WHEN** the user is `global` or `regional_leader`
- **THEN** the facility filter is available
- **AND** for other roles it is hidden

#### Scenario: Persistence across reloads
- **WHEN** the page reloads
- **THEN** the last filter state is restored from local storage

---

### Requirement: Column Presets, Density, and Text Wrap
The system SHALL provide column-visibility presets (Compact/Standard/Full), density (compact/standard/spacious), and text-wrap toggles, persisted locally.

#### Scenario: Apply a preset
- **WHEN** the user selects Compact or Full
- **THEN** visible columns update immediately to match the preset

#### Scenario: Persist density and wrap
- **WHEN** the user changes density or wrap
- **THEN** the setting persists across reloads

---

### Requirement: Sticky Leading Columns
The system SHALL keep the first two columns sticky-left with proper header alignment during horizontal scrolling.

#### Scenario: Horizontal scroll alignment
- **WHEN** the user scrolls horizontally
- **THEN** the first two columns and their headers remain aligned and visible

---

### Requirement: SLA Left-Border Highlight
The system SHALL display a left-border stripe on non-completed rows indicating time status toward the desired completion date (green/amber/red).

#### Scenario: SLA colors
- **WHEN** the desired completion date is far/near/past
- **THEN** the row shows green/orange/red left border respectively
- **AND** completed/"Không HT" rows have no stripe

---

### Requirement: Keyboard Shortcuts
The system SHALL support keyboard shortcuts for search, create, and opening details, without interfering with text inputs.

#### Scenario: Focus search
- **WHEN** the user presses “/” outside of inputs
- **THEN** focus moves to the search input

#### Scenario: Open create (permitted roles)
- **WHEN** the user presses “n” outside of inputs and role permits creation
- **THEN** the create sheet opens

#### Scenario: Open details from row
- **WHEN** a row has focus and the user presses Enter
- **THEN** the details view opens for that row

---

### Requirement: Desktop Slide-Over Details
The system SHALL use a right-side slide-over Sheet for details on desktop, and keep the existing Dialog on mobile.

#### Scenario: Desktop vs mobile
- **WHEN** opening details on desktop
- **THEN** a right-side Sheet opens with independent scroll and Esc/backdrop close
- **AND** on mobile the Dialog is used

---

### Requirement: Saved Filter Sets (Optional)
The system MAY allow saving, applying, and deleting named filter sets per user, persisted locally.

#### Scenario: Save and apply
- **WHEN** the user saves a named set and later applies it
- **THEN** the filter state updates to match the saved set

---

### Requirement: Dashboard KPIs Reuse
The system SHALL reuse the SummaryBar to show Repair Request KPIs (Total, Chờ xử lý, Đã duyệt, Hoàn thành) and allow click-through to navigate/apply a status filter on the Repair Requests page.

#### Scenario: Click-through filter
- **WHEN** the user clicks a KPI card
- **THEN** the app navigates to the Repair Requests page with that status filter applied

## REMOVED Requirements

### Requirement: CSV/XLSX Export
**Reason**: Simplified scope to reduce complexity and bundle size. Export is out of scope for this iteration.
**Migration**: None required.

### Requirement: View-Mode Toggle and Auto-Collapse
**Reason**: Simplified scope; retain current split view and manual collapse only.
**Migration**: None required (existing split view remains).