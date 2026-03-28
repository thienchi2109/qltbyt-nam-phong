# Quick Win 3 Query-Key Typing TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten the maintenance and inventory-report query-key filter signatures from `Record<string, any>` to `Record<string, unknown>` without changing runtime behavior.

**Architecture:** Drive the change with compile-time assertions first, then make the smallest possible signature edits in the two target modules. Keep this branch strictly scoped to query-key typing so the risky report hook stays runtime-identical.

**Tech Stack:** Next.js App Router, TypeScript, TanStack Query, Vitest, GitNexus CLI, ripgrep

---

## Context

- This is the audited Quick Win 3 from `docs/explicit-any-audit-2026-03-28.md`.
- Current `any` targets are limited to query-key filter signatures:
  - `src/hooks/use-cached-maintenance.ts`
  - `src/app/(app)/reports/hooks/use-inventory-data.ts`
- GitNexus impact data before editing:
  - `useInventoryData`
    - risk: `CRITICAL`
    - direct upstream caller: `InventoryReportTab`
  - `useMaintenancePlans`
    - risk: `LOW`
    - GitNexus direct upstream caller: `DashboardTabs`
    - repo grep also shows `MaintenancePageClient` calling it, so treat maintenance UI verification as required
- Non-goals for this branch:
  - no `callRpc<any>` cleanup
  - no `catch (e: any)` or `onError: (error: any)` cleanup
  - no payload-shape refactors
  - no shared utility extraction beyond tiny local aliases

## Commit Checkpoint Rule

- Use one narrow commit once RED -> GREEN -> verification is complete:
  - `refactor: tighten query-key filter typing`
- Do not bundle Quick Win 4 or unrelated `any` cleanup into the same branch.

## Task 1: Establish a clean baseline in the worktree

**Files:**
- None

**Step 1: Install dependencies if the worktree does not have them**

Run:

```bash
if [ ! -d node_modules ]; then npm install; fi
```

**Step 2: Re-check GitNexus impact in the worktree before editing**

Run:

```bash
gitnexus impact useInventoryData --repo qltbyt-nam-phong
gitnexus impact useMaintenancePlans --repo qltbyt-nam-phong
```

Expected:
- `useInventoryData` remains a high-risk path, so scope stays type-only
- `useMaintenancePlans` remains low-risk, but maintenance UI verification is still required

**Step 3: Run baseline checks**

Run:

```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-cached-maintenance-barrel.test.ts
```

Expected:
- both commands pass on the untouched worktree

## Task 2: RED - add compile-time assertions that prove the desired signature

**Files:**
- Create: `src/hooks/use-cached-maintenance.types.assert.ts`
- Create: `src/app/(app)/reports/hooks/use-inventory-data.types.assert.ts`

**Step 1: Add exact type-equality helpers in both assertion files**

Use this helper block:

```ts
type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false
```

**Step 2: Assert the maintenance query-key filter params are `Record<string, unknown>`**

In `src/hooks/use-cached-maintenance.types.assert.ts`, add:

```ts
import { maintenanceKeys } from "@/hooks/use-cached-maintenance"

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _listFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.list>[0], Record<string, unknown>>
>
type _scheduleFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.schedule>[0], Record<string, unknown>>
>
type _planFilters = Assert<
  Equal<Parameters<typeof maintenanceKeys.plan>[0], Record<string, unknown>>
>
```

**Step 3: Assert the report query-key filter param is `Record<string, unknown>`**

In `src/app/(app)/reports/hooks/use-inventory-data.types.assert.ts`, add:

```ts
import { reportsKeys } from "@/app/(app)/reports/hooks/use-inventory-data"

type Assert<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false

type _inventoryDataFilters = Assert<
  Equal<Parameters<typeof reportsKeys.inventoryData>[0], Record<string, unknown>>
>
```

**Step 4: Run the RED check**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected:
- `typecheck` fails because the current parameter types are still `Record<string, any>`
- the failure must point at the new assertion files, not at missing imports or syntax mistakes

## Task 3: GREEN - make the minimal production-code change

**Files:**
- Modify: `src/hooks/use-cached-maintenance.ts`
- Modify: `src/app/(app)/reports/hooks/use-inventory-data.ts`

**Step 1: Tighten the maintenance query-key filter signatures**

In `src/hooks/use-cached-maintenance.ts`, add a local alias near `maintenanceKeys`:

```ts
type MaintenanceKeyFilters = Record<string, unknown>
```

Change only these three signatures:

```ts
list: (filters: MaintenanceKeyFilters) => ...
schedule: (filters: MaintenanceKeyFilters) => ...
plan: (filters: MaintenanceKeyFilters) => ...
```

**Step 2: Tighten the report query-key filter signature**

In `src/app/(app)/reports/hooks/use-inventory-data.ts`, add a local alias near `reportsKeys`:

```ts
type InventoryReportKeyFilters = Record<string, unknown>
```

Change only this signature:

```ts
inventoryData: (filters: InventoryReportKeyFilters) => ...
```

**Step 3: Hold the branch boundary**

Do not touch:

```ts
callRpc<any>(...)
catch (e: any)
onError: (error: any)
```

Do not change runtime logic, query key structure, or cache invalidation behavior.

**Step 4: Re-run GREEN**

Run:

```bash
node scripts/npm-run.js run typecheck
```

Expected:
- `typecheck` passes
- the new assertion files now pass without broad fallout

## Task 4: Verify, smoke test, and commit

**Files:**
- Verify the changed files only

**Step 1: Run required verification in repo order**

Run:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/hooks/__tests__/use-cached-maintenance-barrel.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:
- all commands pass
- no new explicit `any` is introduced

**Step 2: Manual browser smoke**

Verify:
- Maintenance plans page still loads, filters, and paginates correctly
- Inventory report tab still loads for tenant-scoped and all-facilities flows
- no visible cache-key regressions when changing date range, department, or tenant filters

**Step 3: Commit the isolated batch**

Run:

```bash
git add \
  docs/plans/2026-03-28-quick-win-3-query-key-typing.md \
  src/hooks/use-cached-maintenance.ts \
  src/hooks/use-cached-maintenance.types.assert.ts \
  'src/app/(app)/reports/hooks/use-inventory-data.ts' \
  'src/app/(app)/reports/hooks/use-inventory-data.types.assert.ts'
git commit -m "refactor: tighten query-key filter typing"
```

Expected:
- one narrow commit containing only the plan, the two assertion files, and the two minimal signature changes
