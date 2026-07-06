## ADDED Requirements

### Requirement: App-Owned Data Table Contract

The system SHALL provide a shared app-owned data table contract for feature pages that need tabular data, expressed in app-level concepts rather than TanStack Table or HeroUI internals.

#### Scenario: Feature page renders a table through the shared contract

- **WHEN** a migrated feature page provides rows, column definitions, row IDs, loading state, empty state, pagination state, sorting state, and optional selection/actions
- **THEN** the shared data table renders the table without the feature page importing HeroUI Table or shadcn table primitives directly.

#### Scenario: Table contract avoids TanStack lock-in

- **WHEN** a feature page migrates to the shared data table contract
- **THEN** the page does not receive or expose TanStack `Table<TData>` as its primary table API.

### Requirement: HeroUI Table Target Renderer

The system SHALL use HeroUI Table as the target renderer for migrated app data tables while keeping HeroUI-specific implementation details inside the shared table layer.

#### Scenario: HeroUI imports stay behind shared boundary

- **WHEN** a feature page renders a migrated data table
- **THEN** HeroUI Table imports are contained in the shared table implementation or approved adapter boundary, not scattered across feature page components.

#### Scenario: Renderer preserves table states

- **WHEN** the shared table is loading, empty, sorted, paginated, selectable, or rendering row actions
- **THEN** the HeroUI-backed renderer presents the corresponding state consistently through the shared table contract.

### Requirement: Temporary TanStack Adapter

The system SHALL provide a temporary adapter for existing TanStack-backed tables during migration, with explicit deletion criteria.

#### Scenario: Existing TanStack table migrates without behavior rewrite

- **WHEN** a current TanStack-backed page is migrated in the first phase
- **THEN** the temporary adapter maps existing sorting, pagination, selection, and cell rendering behavior into the shared table contract.

#### Scenario: Adapter is deleted after final caller migrates

- **WHEN** no migrated or remaining route requires the TanStack adapter
- **THEN** adapter files and obsolete direct `@tanstack/react-table` imports are removed instead of being kept as unused compatibility code.

### Requirement: No Permanent Duplicate Table Systems

The system SHALL prevent migrated table surfaces from retaining redundant shadcn table markup, direct TanStack table rendering, or unused shared helper exports.

#### Scenario: Migrated route cleanup

- **WHEN** a route is marked migrated to the shared data table
- **THEN** direct route-level `@/components/ui/table` table markup and direct route-level TanStack table rendering are removed unless a documented temporary adapter remains in use.

#### Scenario: Shared helper cleanup

- **WHEN** `DataTablePagination`, `FacetedMultiSelectFilter`, or related table helpers have no remaining callers after migration
- **THEN** those exports and files are removed rather than left as dead code.

### Requirement: TanStack-First Migration Scope

The system SHALL migrate active TanStack-backed pages before manual shadcn table pages.

#### Scenario: First migration phase

- **WHEN** the first implementation phase starts
- **THEN** it targets current TanStack-backed table routes such as `/equipment`, `/maintenance`, `/repair-requests`, `/reports` inventory, `/transfers`, and `/users`.

#### Scenario: Manual table follow-up

- **WHEN** the TanStack-first phase completes
- **THEN** manual shadcn table routes such as `device-quota`, manual report tables, and usage-history table surfaces are tracked for follow-up migration into the same shared contract.

### Requirement: Route-Level Behavior Preservation

The system SHALL preserve existing table behavior for each migrated route unless a behavior change is explicitly approved and tested.

#### Scenario: Sorting, pagination, and selection are preserved

- **WHEN** a TanStack-backed route migrates to the shared table contract
- **THEN** sorting, pagination, selection, empty/loading states, row actions, and keyboard/focus interactions continue to work according to the route's previous behavior.

#### Scenario: Verification before completion

- **WHEN** a route migration is marked complete
- **THEN** focused tests and import cleanup checks prove that the route behavior is preserved and obsolete table imports have been removed or documented as temporary.
