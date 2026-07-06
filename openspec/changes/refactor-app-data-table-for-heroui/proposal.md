# Refactor App Data Tables for HeroUI

## Why

The app currently has multiple table implementations: several pages use TanStack Table directly, several pages render shadcn-style `@/components/ui/table` manually, and shared pagination/filter helpers sit outside a single table ownership boundary. This makes the ongoing shadcn-to-HeroUI rollout harder because each table would need an independent migration and future table-library upgrades would repeat the same work.

This change proposes an app-owned data-table contract that centralizes table behavior before replacing the table rendering layer with HeroUI. The goal is not to keep TanStack or shadcn table code around indefinitely; they are migration inputs and temporary bridges only.

## What Changes

- Add a shared `AppDataTable` contract that describes table behavior in app terms: rows, columns, row IDs, loading state, empty state, sorting, pagination, selection, row actions, and cell rendering.
- Make HeroUI Table the target renderer for the shared table layer.
- Add a temporary TanStack adapter only for existing TanStack-backed pages during migration.
- Keep existing shared table support such as `DataTablePagination` and `FacetedMultiSelectFilter` only while they have real callers or until their behavior is absorbed into the shared table layer.
- Migrate current TanStack-first pages to the shared contract before migrating manual shadcn tables.
- Require cleanup gates so migrated table surfaces no longer import `@/components/ui/table` or `@tanstack/react-table` directly unless they are explicitly still using the temporary adapter.
- Document and verify removal of obsolete bridge/helper code once the final caller migrates.

## Scope

### Phase 1: TanStack-first tables

The first migration phase covers routes whose import graph currently reaches active TanStack Table usage:

- `/equipment`
- `/maintenance`
- `/repair-requests`
- `/reports` inventory table
- `/transfers`
- `/users`

### Phase 2: Manual table migration

Manual shadcn-style table surfaces are out of the first implementation phase but must be tracked for follow-up cleanup. Known examples include:

- `/device-quota/decisions`
- `/device-quota/decisions/[id]`
- manual report tables inside `/reports`
- shared usage-history table surfaces

## Non-Goals

- Do not migrate all shadcn/Radix primitives across the app.
- Do not keep parallel shadcn and HeroUI table renderers as a permanent architecture.
- Do not rewrite data fetching, tenant scoping, RPC contracts, or server pagination semantics.
- Do not migrate manual `@/components/ui/table` pages in the first TanStack-first implementation phase.
- Do not hide table-specific behavior behind broad flags that make the shared component harder to delete or reason about.

## Impact

**Affected Specs:**

- `app-data-table` (NEW) - shared data-table ownership, HeroUI target renderer, and migration cleanup rules.

**Affected Code:**

- New shared table layer under a project-standard shared component location, likely `src/components/shared/AppDataTable/**`.
- Current TanStack table users:
  - `src/app/(app)/equipment/**`
  - `src/app/(app)/maintenance/**`
  - `src/app/(app)/repair-requests/**`
  - `src/app/(app)/reports/components/inventory-table.tsx`
  - `src/app/(app)/transfers/**`
  - `src/app/(app)/users/**`
  - shared table-adjacent components under `src/components/shared/DataTablePagination/**` and `src/components/shared/table-filters/**`
- HeroUI imports must remain behind the shared table boundary except for already-approved non-table HeroUI rollout surfaces.

**Risks:**

- Table behavior is user-visible and high-traffic; migration must be route-by-route with focused regression tests.
- TanStack and HeroUI expose different table state models. The design must use an app-owned contract so the final state is not coupled to either library.
- Existing pending HeroUI/Tailwind work may affect styling assumptions. This change must coordinate with `evaluate-tailwind-v4-heroui-equipment-spike` instead of duplicating its dependency/config decisions.

**Breaking Changes:**

- None intended. Any table behavior change such as selection semantics, sorting semantics, pagination contract, keyboard navigation, or loading/empty state presentation must be explicitly tested and reviewed.
