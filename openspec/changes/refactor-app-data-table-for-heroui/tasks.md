# Implementation Tasks

## 1. Discovery and Baseline

- [ ] 1.1 Re-run the table inventory and record current direct imports of `@tanstack/react-table`, `@/components/ui/table`, `DataTablePagination`, and `FacetedMultiSelectFilter`.
- [ ] 1.2 Confirm the first pilot route after code review; prefer `/users` or `/transfers` unless discovery shows a safer first target.
- [ ] 1.3 Review `evaluate-tailwind-v4-heroui-equipment-spike` status and decide whether HeroUI Table rendering can start immediately or whether only the app contract should land first.
- [ ] 1.4 Identify existing tests for each TanStack-backed route and list missing regression coverage before implementation.
- [ ] 1.5 Use the code-deduplication workflow before adding shared table files; reuse existing pagination/filter helpers where their behavior matches the new contract.

## 2. Contract and Shared Layer

- [ ] 2.1 Define the `AppDataTable` public contract without exposing TanStack `Table<TData>` or HeroUI component props to feature pages.
- [ ] 2.2 Add focused contract tests for loading, empty state, column rendering, sorting callbacks, pagination controls, selection callbacks, and row action slots.
- [ ] 2.3 Implement the shared table shell with HeroUI Table as the target renderer, or a renderer boundary that can be swapped to HeroUI once the HeroUI spike clears dependency/config risk.
- [ ] 2.4 Integrate existing shared pagination/filter behavior without duplicating their public responsibilities.
- [ ] 2.5 Add import-boundary tests or lint-style checks if practical so HeroUI Table imports stay inside the shared table layer.

## 3. Temporary TanStack Adapter

- [ ] 3.1 Add a narrow TanStack adapter that maps existing TanStack-backed page state into the `AppDataTable` contract.
- [ ] 3.2 Keep adapter files clearly named as temporary migration infrastructure.
- [ ] 3.3 Add tests that prove the adapter preserves sorting, pagination, selection, and cell rendering semantics used by the pilot route.
- [ ] 3.4 Document deletion criteria for the adapter in code comments or a nearby README only if the lifecycle is not obvious from file names and tasks.

## 4. TanStack-first Route Migration

- [ ] 4.1 Migrate the pilot route and verify no page-local table markup regression.
- [ ] 4.2 Migrate `/repair-requests` after pilot behavior is stable.
- [ ] 4.3 Migrate `/reports` inventory table.
- [ ] 4.4 Migrate `/equipment` after preserving responsive columns, bulk actions, and selection behavior.
- [ ] 4.5 Migrate `/maintenance` after preserving plans/tasks table behavior and add-task dialog behavior.
- [ ] 4.6 Migrate `/users` or `/transfers` if not already used as the pilot.

## 5. Cleanup Gates

- [ ] 5.1 For each migrated route, run an import check and remove direct route-level `@tanstack/react-table` imports unless the route is explicitly still using the temporary adapter.
- [ ] 5.2 Confirm migrated routes no longer render direct `@/components/ui/table` table markup.
- [ ] 5.3 Remove unused table helper exports after the final caller migrates.
- [ ] 5.4 Remove the TanStack adapter once no migrated or remaining route needs it.
- [ ] 5.5 Record manual shadcn table follow-up scope for `/device-quota`, manual `/reports` tables, and usage-history surfaces.

## 6. Verification

- [ ] 6.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 6.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 6.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 6.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 6.5 Run focused tests for the shared table layer and each migrated route.
- [ ] 6.6 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 6.7 Capture browser screenshots for the pilot route and one high-risk route before broad rollout.
