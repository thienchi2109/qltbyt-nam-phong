# maintenance-mobile-experience Specification

## Purpose
TBD - created by archiving change add-mobile-maintenance-redesign. Update Purpose after archive.
## Requirements
### Requirement: Mobile maintenance experience gating
The system SHALL serve a dedicated `MobileMaintenance` interface to authenticated users on handset viewports when the `mobile-maintenance-redesign` feature flag is enabled, while preserving the desktop table for larger screens or when the flag is disabled. The mobile interface MUST use the existing maintenance plan RPC hooks so that server-side filters, pagination metadata, and permissions remain consistent across form factors.

#### Scenario: Mobile user receives dedicated maintenance view
- **GIVEN** an authenticated user on a handset viewport with the `mobile-maintenance-redesign` feature flag enabled
- **WHEN** the user navigates to `/maintenance`
- **THEN** the system renders the `MobileMaintenance` interface instead of the desktop table
- **AND** the interface loads maintenance plans via the paginated RPC hook using the current search and facility criteria.

#### Scenario: Feature flag disabled falls back to desktop
- **GIVEN** the `mobile-maintenance-redesign` feature flag is disabled for a tenant
- **WHEN** a mobile user opens `/maintenance`
- **THEN** the system renders the existing desktop maintenance table to avoid regressions.

### Requirement: Mobile maintenance header and filters
The mobile maintenance interface SHALL display a sticky safe-area-aware header containing the page title, a full-width 44px search input with debounced queries, and a filter trigger that opens a bottom sheet with large touch targets. Applying or clearing filters in the sheet MUST update the server-side query arguments and badge counts without requiring a manual refresh.

#### Scenario: Sticky header exposes search and filter entry points
- **GIVEN** a mobile user viewing the maintenance plan list
- **WHEN** they scroll or focus the page header
- **THEN** the header remains pinned to the top, exposing the search input and filter button sized for touch interaction.

#### Scenario: Filter bottom sheet applies facility selection
- **GIVEN** a mobile user with the filter sheet open and a facility selected
- **WHEN** they tap "Áp dụng"
- **THEN** the sheet closes, the active filter badge increments, and the maintenance plan query refetches with the selected facility.

#### Scenario: Filter clear removes active criteria
- **GIVEN** a mobile user with active filters applied
- **WHEN** they tap "Xóa bộ lọc" in the sheet
- **THEN** all filter criteria reset, the badge clears, and the plan list refetches with default arguments.

### Requirement: Mobile maintenance plan cards
The mobile interface SHALL present maintenance plans as card components with color-coded status headers, key metadata rows, and inline actions for draft plans. Empty states MUST provide friendly guidance, and loading states MUST use skeleton cards that match the final layout to reduce layout shift.

#### Scenario: Plan card highlights draft actions
- **GIVEN** a maintenance plan in "Bản nháp" status
- **WHEN** the mobile user expands its action menu
- **THEN** the card displays approve, reject, edit, and delete actions without requiring precise taps on dropdown menus.

#### Scenario: Plan list shows empty state on no results
- **GIVEN** filters that return zero maintenance plans
- **WHEN** the mobile list renders
- **THEN** the user sees a centered empty-state card with localized guidance instead of a blank screen.

#### Scenario: Loading state uses skeleton cards
- **GIVEN** maintenance plans are still loading from the server
- **WHEN** the mobile list renders
- **THEN** the UI displays skeleton cards that reserve header and content space until data arrives.

### Requirement: Mobile maintenance tasks interactions
When a plan is selected, the mobile interface SHALL present tasks as expandable cards that summarize equipment identifiers and scheduled months, reveal full details (notes, executing unit, actions) when expanded, and respect plan approval status when offering edit controls. Unsaved edits MUST trigger a persistent banner with save and cancel affordances tied to the existing draft cache.

#### Scenario: Task expansion reveals detailed controls
- **GIVEN** a mobile user viewing the tasks tab for a maintenance plan
- **WHEN** they tap a task card
- **THEN** the card expands to show executing unit, notes, edit/delete buttons (if plan is draft), and a month completion checklist consistent with desktop behavior.

#### Scenario: Unsaved changes banner prompts save or cancel
- **GIVEN** a mobile user modifies task scheduling or notes without saving
- **WHEN** the draft data diverges from the persisted tasks
- **THEN** a banner appears above the task list with "Lưu thay đổi" and "Hủy bỏ" actions, and dismissing via either action synchronizes the draft cache accordingly.

### Requirement: Mobile pagination and safe-area compliance
The mobile maintenance interface SHALL render a fixed bottom pagination bar that respects iOS/Android safe-area insets, surfaces current page/total counts, and offers large buttons for first, previous, next, and last navigation. Content containers MUST include bottom padding so list items are visible above the pagination bar.

#### Scenario: Pagination bar navigates between pages
- **GIVEN** multiple pages of maintenance plans exist
- **WHEN** the mobile user taps the "Sau" button on the pagination bar
- **THEN** the next page loads, the page indicator increments, and focus remains within the safe-area-aligned footer.

#### Scenario: Safe area prevents control clipping
- **GIVEN** a device with a home indicator safe-area inset
- **WHEN** the pagination bar renders
- **THEN** the bar adds padding equal to the device inset to keep buttons fully visible and tappable.

