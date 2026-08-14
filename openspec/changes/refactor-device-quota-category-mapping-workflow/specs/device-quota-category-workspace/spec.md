# device-quota-category-workspace Specification

## ADDED Requirements

### Requirement: Unified Device Quota workspace navigation

The application SHALL expose one top-level Device Quota workspace at `/device-quota/categories` for every role currently authorized to use Categories or Mapping. The workspace SHALL preserve each role's existing category-detail, category-management, manual-mapping, suggestion-preview, and suggestion-apply permissions. After final cleanup, `/device-quota/mapping` SHALL be removed completely and SHALL NOT redirect to the unified workspace.

#### Scenario: user opens the canonical workspace

- **GIVEN** an equipment-manager user opens the Device Quota module
- **WHEN** the module navigation renders
- **THEN** it presents one `Danh mục & phân loại` entry for category and manual assignment work
- **AND** the workspace loads from `/device-quota/categories`

#### Scenario: mapping-only user opens the unified workspace

- **GIVEN** a user currently allowed to access Mapping but not category management
- **WHEN** the module navigation and route resolve
- **THEN** the user receives the `Danh mục & phân loại` entry and `/device-quota/categories` workspace
- **AND** the category hierarchy is available as read-only assignment context
- **AND** the user retains only the manual-mapping and suggestion actions allowed by current permissions
- **AND** the user does not receive quota or assigned-equipment detail unless current permissions already allow it
- **AND** the user does not receive category create, edit, delete, or import controls

#### Scenario: regional leader keeps suggestion preview access in Categories

- **GIVEN** the current user has the `regional_leader` role
- **WHEN** the user opens Device Quota
- **THEN** the workspace loads from `/device-quota/categories`
- **AND** the existing preview-only suggestion workflow remains available
- **AND** quota detail, assigned-equipment detail, manual and batch mutation actions, and category-management controls remain unavailable

#### Scenario: user follows a removed Mapping link

- **GIVEN** navigation cutover and Mapping cleanup are complete
- **WHEN** any user or saved bookmark requests `/device-quota/mapping`
- **THEN** the route uses the application's standard not-found behavior
- **AND** it does not render legacy Mapping UI
- **AND** it does not redirect to `/device-quota/categories`

### Requirement: Category-first master-detail workspace

The workspace SHALL render one category hierarchy as the stable navigation context. It SHALL render the selected category's quota and assigned-equipment detail in the adjacent work surface only for roles whose current permissions already allow that detail.

#### Scenario: user selects a category

- **GIVEN** a user authorized to inspect category detail sees a hierarchy containing selectable categories
- **WHEN** the user selects a category with pointer or keyboard interaction
- **THEN** the category remains visibly selected in the hierarchy
- **AND** the adjacent detail pane shows that category's quota and assigned equipment

#### Scenario: mapping-only user selects category context

- **GIVEN** a user is authorized for Mapping but not category detail
- **WHEN** the user selects or navigates the read-only category hierarchy
- **THEN** the workspace does not fetch or render quota or assigned-equipment detail
- **AND** the user receives only manual-mapping or suggestion controls allowed by current permissions
- **AND** category selection does not grant a new `dinh_muc_thiet_bi_by_nhom` read path

#### Scenario: user opens a category row action

- **GIVEN** a category row contains an action menu
- **WHEN** the user opens or uses the action menu
- **THEN** the row is not selected as a side effect of the menu interaction
- **AND** edit or delete dialogs use the existing deferred dropdown-action handoff without freezing the page

#### Scenario: user selects a parent category

- **GIVEN** a user authorized to inspect category detail selects a parent category that has aggregate descendant counts and may also have directly assigned equipment
- **WHEN** the user selects that parent category
- **THEN** the detail pane presents aggregate quota/count information separately from equipment assigned directly to the parent
- **AND** the direct equipment list uses the existing selected-category detail contract

### Requirement: Inline manual assignment for the selected category

The workspace SHALL allow the right work surface to enter manual assignment mode for the currently selected parent or leaf category while the category hierarchy and selected row remain visible.

#### Scenario: user starts manual assignment

- **GIVEN** a category is selected in detail mode
- **WHEN** the user chooses `Gán thiết bị`
- **THEN** the right work surface shows the existing unassigned-equipment search, filters, pagination, and page-selection controls
- **AND** the left hierarchy continues to show the target category as selected
- **AND** no second selectable category tree is rendered

#### Scenario: user assigns to a parent category

- **GIVEN** a parent category is selected
- **WHEN** an authorized user enters manual assignment mode
- **THEN** the parent remains a valid target according to current Mapping behavior
- **AND** a successful assignment is reconciled against the parent's direct assigned-equipment list

#### Scenario: user cancels the manual preview

- **GIVEN** the user selected unassigned equipment and opened the manual assignment preview
- **WHEN** the user cancels or closes the preview without confirming
- **THEN** no assignment mutation is sent
- **AND** the workspace returns to the same selected category's assignment context
- **AND** the application remains interactive without a stuck overlay or disabled pointer state

### Requirement: Immediate assignment result reconciliation

After a nonzero manual assignment result, the workspace SHALL reconcile unassigned equipment, category counts, compliance data, and the exact selected-category assigned-equipment detail before presenting reconciliation as complete.

#### Scenario: manual assignment succeeds

- **GIVEN** the user confirms one or more equipment assignments for the selected category
- **WHEN** `dinh_muc_thiet_bi_link` returns the full requested affected count
- **THEN** the workspace returns to that category's detail mode
- **AND** the unassigned-equipment, filter-option, category-list, and compliance queries are invalidated
- **AND** the exact selected-category and tenant assigned-equipment query resolves before reconciled detail is presented
- **AND** the refreshed detail pane includes the newly assigned equipment
- **AND** the newly assigned rows are temporarily distinguishable
- **AND** the manual selection is cleared

#### Scenario: selected-category detail cache is stale

- **GIVEN** the selected category has stale assigned-equipment data in the client cache
- **WHEN** a nonzero manual assignment result is returned
- **THEN** the workspace keeps the detail result pending until the exact selected-category and tenant refetch resolves
- **AND** it does not present stale detail as successfully reconciled

#### Scenario: manual assignment partially succeeds

- **GIVEN** the user confirms multiple equipment assignments
- **WHEN** `dinh_muc_thiet_bi_link` returns an affected count greater than zero but less than the requested count
- **THEN** the workspace reconciles the exact selected-category detail
- **AND** it reports the affected count relative to the requested count
- **AND** it highlights only confirmed IDs present in the refreshed result
- **AND** it does not invent failed-item identities or reasons

#### Scenario: manual assignment affects zero equipment

- **GIVEN** the user confirms one or more equipment assignments
- **WHEN** `dinh_muc_thiet_bi_link` returns zero
- **THEN** the workspace refreshes the unassigned-equipment state
- **AND** it remains in assignment mode
- **AND** it shows non-success feedback
- **AND** it does not present any equipment as newly assigned

#### Scenario: manual assignment fails

- **GIVEN** the user confirms a manual assignment
- **WHEN** the assignment request fails
- **THEN** the workspace remains in the selected category's assignment context
- **AND** it shows actionable error feedback
- **AND** it does not present the equipment as successfully assigned

### Requirement: Facility-wide suggestion workflow preservation

The application SHALL preserve the existing facility-wide suggested-mapping workflow as an independent page-level Categories action that is not scoped to the selected category. Route consolidation SHALL NOT change its dialog, async job, API, retry, exclusion, unmatched-result, permission, preview-only, or batch-apply behavior.

#### Scenario: authorized user opens facility-wide suggestions

- **GIVEN** a role currently allowed to open suggested mapping has a facility scope
- **WHEN** the user opens `Gợi ý phân loại hàng loạt`
- **THEN** the existing suggestion preview workflow runs for the facility's unassigned equipment
- **AND** it may return suggestions grouped across multiple categories
- **AND** selected-category state does not constrain or alter the suggestion request

#### Scenario: user reviews suggestion results

- **GIVEN** the suggestion job returns grouped and unmatched results
- **WHEN** the preview renders
- **THEN** the user can preserve or exclude existing groups and equipment-name mappings according to current behavior
- **AND** unmatched results remain excluded from batch save
- **AND** the existing review disclaimer remains visible

#### Scenario: regional leader previews suggestions

- **GIVEN** the current user has the `regional_leader` role
- **WHEN** the suggestion preview completes
- **THEN** the user can inspect the results
- **AND** the batch-apply action remains unavailable according to current permissions

#### Scenario: authorized user applies suggestions

- **GIVEN** a role currently allowed to apply suggested mappings confirms the reviewed groups
- **WHEN** the batch save runs
- **THEN** it uses the existing `dinh_muc_thiet_bi_link_batch` contract
- **AND** existing affected and skipped result handling remains unchanged

### Requirement: Readable long category names

The category pane SHALL allocate sufficient horizontal space to category names and SHALL provide full-text access without allowing long names to collide with classification, usage, hierarchy, or action controls.

#### Scenario: wide desktop category layout

- **GIVEN** the workspace is rendered at a wide desktop viewport
- **WHEN** the split pane is laid out
- **THEN** the category pane receives approximately 46% of the available workspace width
- **AND** the detail or assignment pane receives the remaining width
- **AND** the right pane preserves horizontal overflow for wide equipment tables

#### Scenario: category name exceeds one line

- **GIVEN** a category has a long Vietnamese name
- **WHEN** its hierarchy row renders
- **THEN** the name may wrap to at most two lines
- **AND** code, classification, usage/progress, indentation, and row actions remain readable and non-overlapping
- **AND** pointer hover and keyboard focus can reveal the complete category name through a visible full-text affordance

#### Scenario: workspace switches between detail and assignment modes

- **GIVEN** the corrected category pane is visible with a selected category
- **WHEN** the right work surface switches between detail and manual assignment modes
- **THEN** the category pane retains the same width allocation and category-row rendering
- **AND** the selected category and full-text affordance remain visible
- **AND** no replacement category tree is rendered

#### Scenario: workspace renders below wide-desktop width

- **GIVEN** the viewport cannot support the wide-desktop split
- **WHEN** the responsive layout adapts
- **THEN** category and equipment controls remain usable without incoherent overlap
- **AND** single-line truncation is not the only way to inspect the complete category name

### Requirement: Wide unified workspace content area

The unified Categories workspace SHALL use the full content width available inside the application shell on wide desktop viewports. It SHALL retain responsive horizontal gutters and SHALL NOT change the width contract of unrelated routes.

#### Scenario: workspace renders on wide desktop

- **GIVEN** the application shell provides width beyond the current centered Categories container
- **WHEN** `/device-quota/categories` renders
- **THEN** the workspace expands across the available app-shell content area
- **AND** no route-local centered maximum-width container leaves large unused columns on both sides
- **AND** the internal category/detail split remains approximately `46-54`

#### Scenario: expanded workspace preserves equipment usability

- **GIVEN** the full-width workspace contains a wide assigned or unassigned equipment table
- **WHEN** the detail or assignment surface renders
- **THEN** the right pane preserves its minimum-width and horizontal-overflow behavior
- **AND** expanding the outer shell does not overlap category, filter, pagination, preview, or row-action controls

#### Scenario: width change remains route-scoped

- **GIVEN** another Device Quota route renders
- **WHEN** the Categories workspace width change is deployed
- **THEN** the unrelated route keeps its existing outer width behavior
- **AND** the global application shell is not widened as a side effect

### Requirement: Existing data-contract preservation

The unified workspace SHALL reuse existing frontend API and RPC contracts and SHALL NOT require a database migration, schema change, new RPC, or suggestion API contract change.

#### Scenario: implementation data access is reviewed

- **GIVEN** the unified workspace implementation is ready for review
- **WHEN** its data access and repository diff are inspected
- **THEN** category listing uses `dinh_muc_nhom_list`
- **AND** assigned-equipment detail uses `dinh_muc_thiet_bi_by_nhom`
- **AND** manual assignment uses the existing unassigned-equipment queries and `dinh_muc_thiet_bi_link`
- **AND** suggested mapping continues to use the existing suggestion routes and `dinh_muc_thiet_bi_link_batch`
- **AND** removing the Mapping page does not remove or rename `/api/device-quota/mapping/suggest/**`
- **AND** no SQL migration, RPC allowlist change, or generated database contract change is present
