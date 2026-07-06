# Design: App Data Table Contract for HeroUI Migration

## Context

The app is gradually rolling out HeroUI while still relying on shadcn-style primitives and direct TanStack Table usage. A current codebase scan found:

- Active TanStack table usage on `/equipment`, `/maintenance`, `/repair-requests`, `/reports` inventory, `/transfers`, and `/users`.
- Manual `@/components/ui/table` usage on `device-quota`, several report tables, usage history, and some table views that also use TanStack.
- Existing shared table-adjacent helpers: `DataTablePagination` and `FacetedMultiSelectFilter`.
- HeroUI is already installed and used in limited shared controls/filters, but HeroUI Table is not yet the app table boundary.

The migration should reduce duplicate table behavior without creating a permanent second table system.

## Goals

- Centralize table behavior behind an app-owned `AppDataTable` contract.
- Make HeroUI Table the target renderer for data tables.
- Avoid coupling page code to TanStack Table or HeroUI internals.
- Migrate current TanStack tables first with low-risk adapters.
- Keep deletion gates so temporary TanStack/shadcn table code is removed when no longer needed.
- Reuse existing pagination/filter behavior where it matches the shared table contract.

## Non-Goals

- Do not replace all shadcn UI primitives.
- Do not migrate manual shadcn table pages in the first implementation phase.
- Do not change server data contracts, role scoping, tenant filters, or RPC behavior.
- Do not introduce a generic table framework that tries to own every domain-specific action or toolbar.
- Do not keep multiple renderers permanently.

## Proposed Architecture

### AppDataTable Contract

Create a shared table API expressed in app-level concepts:

- `rows`
- `columns`
- `getRowId`
- `loading`
- `emptyState`
- `sortState` and `onSortChange`
- `pagination` and page-size controls
- `selection` and `onSelectionChange`
- `renderCell`
- optional row actions
- optional toolbar/filter slots

The contract should not expose TanStack's `Table<TData>` as the primary public API. It should also avoid leaking HeroUI-specific props into feature pages. HeroUI-specific styling and slot mapping belong inside the shared table implementation.

### HeroUI Renderer

`AppDataTable` should render through HeroUI Table as the target table implementation. The renderer owns:

- table shell markup
- loading and empty states
- header and body rendering
- sort indicator mapping
- selection mapping
- accessibility defaults
- table density and responsive styling
- integration with existing pagination/filter helpers where still needed

HeroUI imports should live in the shared table layer, not in every feature page.

### Temporary TanStack Adapter

Existing TanStack pages can migrate through a bridge such as `TanStackDataTableAdapter` or helper functions that translate current TanStack column/table state into the `AppDataTable` contract.

The adapter is temporary. It exists to protect current behavior while route-specific logic is moved out of page render code. Each migrated route must make clear whether it still depends on the adapter. When the final TanStack-backed route migrates away, the adapter and remaining direct `@tanstack/react-table` table imports should be deleted.

### Existing Shared Helpers

Do not duplicate existing `DataTablePagination` or `FacetedMultiSelectFilter` behavior blindly. Reuse or wrap them while they fit the shared contract. Once their behavior is absorbed into `AppDataTable`, remove old exports that no longer have callers.

## Migration Strategy

### Phase 0: Baseline and API Tests

- Inventory direct table imports with `rg`.
- Lock the shared contract with focused tests before moving pages.
- Add no broad visual changes during contract setup.

### Phase 1: TanStack-first Migration

Migrate current TanStack-backed pages one route at a time:

1. `/users` or `/transfers` as the first lower-risk pilot.
2. `/repair-requests`.
3. `/reports` inventory table.
4. `/equipment`.
5. `/maintenance`.

The order can change after implementation discovery, but high-risk tables with selection, bulk actions, or complex responsive behavior should not be first.

### Phase 2: Remove TanStack Table From Feature Pages

After each route migrates, page-owned components should stop rendering TanStack table markup directly. Direct TanStack imports are allowed only inside the temporary adapter or route code that has not migrated yet.

### Phase 3: Manual shadcn Table Migration

After the TanStack-first phase is stable, migrate manual table surfaces such as `device-quota` and report tables into the same `AppDataTable` contract. Remove direct `@/components/ui/table` imports from migrated surfaces.

### Phase 4: Cleanup

Run explicit deletion checks:

- `rg "@/components/ui/table" src`
- `rg "@tanstack/react-table" src`
- `rg "DataTablePagination|FacetedMultiSelectFilter" src`

Any remaining imports must be either legitimate non-migrated surfaces or documented blockers. Temporary adapter code and unused shared helper exports must be removed when they have zero callers.

## Risks and Mitigations

- **Risk: shared table API becomes too generic.** Keep domain-specific toolbars and actions as slots rather than flags.
- **Risk: behavior regressions in sorting, selection, or pagination.** Migrate one route at a time with focused tests and route-specific snapshots where useful.
- **Risk: duplicate table systems persist.** Require deletion gates in tasks before each phase is marked complete.
- **Risk: HeroUI styling conflicts with ongoing Tailwind/HeroUI spike.** Coordinate with `evaluate-tailwind-v4-heroui-equipment-spike`; do not duplicate dependency or Tailwind config decisions.
- **Risk: accessibility changes are subtle.** Add tests for keyboard/focus behavior where the current table supports interactive rows, menus, or selection.

## Verification Strategy

- Focused tests for the shared contract and each migrated route.
- Route-level regression tests for sorting, pagination, selection, empty/loading states, and row actions as applicable.
- Required repo checks for TypeScript/React changes:
  - `node scripts/npm-run.js run format:check`
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run verify:dedupe`
  - `node scripts/npm-run.js run typecheck`
  - focused tests
  - `node scripts/npm-run.js run react-doctor`
- Browser screenshots for at least the pilot route and one high-risk table route before broad rollout.

## Rollback Strategy

Each route migration must be independently revertible. Keep adapter boundaries narrow so a single route can temporarily return to its previous table path without reverting the shared contract or other migrated routes.

## Open Questions

- Which TanStack-backed route should be the first implementation pilot after approval: `/users` or `/transfers`?
- Should HeroUI Table adoption wait for the Tailwind/HeroUI spike decision, or can the shared contract be implemented first with a minimal renderer boundary?
