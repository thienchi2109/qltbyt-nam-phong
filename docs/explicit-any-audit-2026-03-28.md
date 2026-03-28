# Explicit `any` Audit Report (2026-03-28)

## Status
- Status: Active
- Date: 2026-03-28
- Repo: `qltbyt-nam-phong-new`

## Audit Context
- Goal: identify explicit `any` debt across the repo, separate runtime risk from test-only debt, and locate the highest-leverage remediation points.
- Scope: full repository audit, not diff-only.
- Working tree at the end of the audit: clean before this documentation update.

## Tools Used
- Custom AST scan based on [`scripts/check-no-explicit-any-in-diff.js`](../scripts/check-no-explicit-any-in-diff.js)
- `node scripts/npm-run.js run verify:no-explicit-any`
- React Doctor full scan
- GitNexus CLI re-index + context/impact queries
- `rg` for file-level pattern verification

## Commands Run
- `node scripts/npm-run.js run verify:no-explicit-any`
- React Doctor full scan with temporary `diff: false`
- `gitnexus analyze E:\qltbyt-nam-phong-new`
- GitNexus `context` and `impact` for:
  - `callRpc`
  - `useInventoryData`
  - `useMaintenanceSchedules`
  - `authorize`
  - `jwt`
  - `processChartData`
  - `initializeFirebaseMessaging`

## Headline Results
- Explicit `any` occurrences: `350`
- Files with explicit `any`: `89`
- Runtime occurrences: `241`
- Test occurrences: `108`
- Supabase Edge Function occurrences: `1`

## Important Caveat
- `verify:no-explicit-any` is diff-aware. On a clean branch it reported no issues because there were no changed TypeScript files.
- That result does not contradict the full-repo AST audit. It only means the repo currently has no new `any` debt relative to the branch diff.

## Syntax Pattern Breakdown
- `124` occurrences are `as any`
- `97` occurrences are parameter annotations such as `(value: any)`
- `31` occurrences are variable declarations
- `29` occurrences are `any[]`
- `29` occurrences are generic/type-reference cases such as `Record<string, any>`
- `28` occurrences are interface property signatures

## Root Cause Summary
The repo does not mainly suffer from random isolated `any` usage. Most debt clusters around weakly-typed boundaries:

1. RPC client boundary
2. NextAuth user/JWT/session boundary
3. Report and maintenance hooks that deserialize RPC payloads
4. Test scaffolding that uses loose mocks and `as any`

This matters because replacing `any` file-by-file without fixing boundary contracts will create churn and repeated regressions.

## Highest-Risk Runtime Hotspots

### 1. RPC Boundary
- File: [`src/lib/rpc-client.ts`](../src/lib/rpc-client.ts)
- Key lines:
  - [`src/lib/rpc-client.ts:7`](../src/lib/rpc-client.ts#L7)
  - [`src/lib/rpc-client.ts:22`](../src/lib/rpc-client.ts#L22)
- Main issues:
  - `TArgs = any` in `callRpc`
  - error payload parsing uses `as any`
- GitNexus impact:
  - Risk: `CRITICAL`
  - Impacted symbols: `36`
  - Direct callers: `26`
  - Affected processes: `20`
- Why this is the real root cause:
  - many downstream hooks normalize or transform data from `callRpc<any>` and inherit the typing hole.

### 2. Auth and Session Boundary
- File: [`src/auth/config.ts`](../src/auth/config.ts)
- Count: `19`
- Representative lines:
  - [`src/auth/config.ts:48`](../src/auth/config.ts#L48)
  - [`src/auth/config.ts:62`](../src/auth/config.ts#L62)
  - [`src/auth/config.ts:86`](../src/auth/config.ts#L86)
  - [`src/auth/config.ts:94`](../src/auth/config.ts#L94)
  - [`src/auth/config.ts:124`](../src/auth/config.ts#L124)
  - [`src/auth/config.ts:176`](../src/auth/config.ts#L176)
- Main issues:
  - `data[0] as any` after auth RPC
  - `user as any`
  - `token as any`
  - `session as any`
- Why this is high priority:
  - this is on the login, JWT refresh, and session shaping path.
  - shape drift here can silently break access control or tenant context.

### 3. Reports Inventory Hook
- File: [`src/app/(app)/reports/hooks/use-inventory-data.ts`](../src/app/(app)/reports/hooks/use-inventory-data.ts)
- Count: `17`
- Representative lines:
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts:39`](../src/app/(app)/reports/hooks/use-inventory-data.ts#L39)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts:57`](../src/app/(app)/reports/hooks/use-inventory-data.ts#L57)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts:91`](../src/app/(app)/reports/hooks/use-inventory-data.ts#L91)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts:125`](../src/app/(app)/reports/hooks/use-inventory-data.ts#L125)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts:161`](../src/app/(app)/reports/hooks/use-inventory-data.ts#L161)
- Main issues:
  - `Record<string, any>` in query keys
  - `callRpc<any>` and `callRpc<any[]>`
  - repeated `(item: any)` and `(transfer: any)` transformations
  - `catch (e: any)` on RPC fallback path
- GitNexus impact:
  - risk reported as `CRITICAL` to its direct app consumer
  - direct caller: [`src/app/(app)/reports/components/inventory-report-tab.tsx`](../src/app/(app)/reports/components/inventory-report-tab.tsx)

### 4. Maintenance Cached Hooks
- File: [`src/hooks/use-cached-maintenance.ts`](../src/hooks/use-cached-maintenance.ts)
- Count: `25`
- Representative lines:
  - [`src/hooks/use-cached-maintenance.ts:11`](../src/hooks/use-cached-maintenance.ts#L11)
  - [`src/hooks/use-cached-maintenance.ts:113`](../src/hooks/use-cached-maintenance.ts#L113)
  - [`src/hooks/use-cached-maintenance.ts:178`](../src/hooks/use-cached-maintenance.ts#L178)
  - [`src/hooks/use-cached-maintenance.ts:217`](../src/hooks/use-cached-maintenance.ts#L217)
  - [`src/hooks/use-cached-maintenance.ts:362`](../src/hooks/use-cached-maintenance.ts#L362)
  - [`src/hooks/use-cached-maintenance.ts:392`](../src/hooks/use-cached-maintenance.ts#L392)
- Main issues:
  - query key filters typed as `Record<string, any>`
  - `callRpc<any[]>`
  - mutation payloads typed as `any`
  - RPC args force-cast with `as any`
  - error handlers typed as `any`
- Why this matters:
  - this hook mixes query keys, server payloads, and mutation inputs, so the loose typing propagates in multiple directions.

### 5. Secondary Runtime Hotspots
- [`src/hooks/use-cached-equipment.ts`](../src/hooks/use-cached-equipment.ts): `12`
- [`src/lib/firebase-utils.tsx`](../src/lib/firebase-utils.tsx): `12`
- [`src/hooks/use-audit-logs.ts`](../src/hooks/use-audit-logs.ts): `9`
- [`src/hooks/use-dashboard-stats.ts`](../src/hooks/use-dashboard-stats.ts): `9`
- [`src/hooks/use-cached-repair.ts`](../src/hooks/use-cached-repair.ts): `8`

## Lower-Priority or Potentially Unused Areas

### Chart Utilities
- File: [`src/lib/chart-utils.ts`](../src/lib/chart-utils.ts)
- Count: `17`
- Notes:
  - broad `any` in chart component types and `processChartData`
  - React Doctor also flagged unused exports here
- Conclusion:
  - useful cleanup target, but lower priority than auth/RPC/reporting boundaries

### Firebase Utilities
- File: [`src/lib/firebase-utils.tsx`](../src/lib/firebase-utils.tsx)
- Count: `12`
- Notes:
  - file comments state push notifications are not used in the main application
  - React Doctor flagged the file as unused
- Conclusion:
  - good cleanup candidate if doing dead-code reduction, but not a top runtime risk

## Test Debt Summary
- Test-only explicit `any`: `108`
- Biggest clusters:
  - [`src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`](../src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx): `20`
  - [`src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`](../src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts): `16`
  - [`src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`](../src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx): `12`
  - [`src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`](../src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx): `10`
- Typical patterns:
  - mock wrappers typed as `any`
  - `React.cloneElement(... as React.ReactElement<any>)`
  - fixtures coerced with `as any`
  - mocked callbacks using `(...args: any[])`
- Conclusion:
  - this is worth fixing, but it should follow runtime boundary cleanup because production safety payoff is lower.

## React Doctor Cross-Check
- React Doctor full scan result: `81 / 100`
- Warnings: `373` across `207 / 607` files
- Relevance to this audit:
  - corroborated that some `any` hotspots sit inside broader weak zones
  - confirmed several large components and dead-code areas
  - reduced priority for utility files flagged as unused
- Important note:
  - React Doctor does not directly measure explicit `any`, so it was used here as corroborating evidence, not the source of truth.

## Recommended Quick Wins

### Quick Win 1: Tighten `callRpc` argument typing without changing response contracts
- Files:
  - [`src/lib/rpc-client.ts`](../src/lib/rpc-client.ts)
- Change:
  - replace `TArgs = any` with `TArgs = Record<string, unknown> | undefined`
  - replace local `as any` error parsing with a small `unknown` narrowing helper
- Why it is low-breakage:
  - call sites already send plain objects in nearly all cases
  - most breakage will be compile-time only and usually easy to fix
- Why payoff is high:
  - it removes the most central `any` escape hatch in the repo
  - it forces better typing at future call sites

### Quick Win 2: Add NextAuth module augmentation for custom user, JWT, and session fields
- Files:
  - [`src/auth/config.ts`](../src/auth/config.ts)
  - likely a new `next-auth.d.ts` or local auth types file
- Change:
  - define typed custom fields such as `username`, `role`, `khoa_phong`, `don_vi`, `dia_ban_id`, `dia_ban_ma`, `full_name`, `auth_mode`
  - remove repeated `user as any`, `token as any`, and `session as any`
- Why it is low-breakage:
  - behavior stays the same
  - changes are mostly type declarations and cast removal
- Why payoff is high:
  - removes `19` risky auth-path `any` usages
  - gives immediate IntelliSense and compile-time guarantees on a critical path

### Quick Win 3: Replace `Record<string, any>` query-key filters with `Record<string, unknown>`
- Files:
  - [`src/hooks/use-cached-maintenance.ts`](../src/hooks/use-cached-maintenance.ts)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts`](../src/app/(app)/reports/hooks/use-inventory-data.ts)
- Change:
  - only tighten query key/filter object typing
- Why it is low-breakage:
  - query keys are local implementation details
  - no runtime contract changes required
- Why payoff is high:
  - removes several pervasive generic `any` usages with minimal logic changes

### Quick Win 4: Type error handlers as `unknown` and normalize once
- Files:
  - [`src/hooks/use-cached-maintenance.ts`](../src/hooks/use-cached-maintenance.ts)
  - [`src/hooks/use-cached-equipment.ts`](../src/hooks/use-cached-equipment.ts)
  - [`src/app/(app)/reports/hooks/use-inventory-data.ts`](../src/app/(app)/reports/hooks/use-inventory-data.ts)
- Change:
  - replace `catch (e: any)` and `onError: (error: any)` with `unknown`
  - use a shared helper to extract `message`
- Why it is low-breakage:
  - runtime behavior stays the same
  - compile-time fixes are local and mechanical
- Why payoff is high:
  - removes a large amount of repeated low-quality typing quickly

### Quick Win 5: Clean test mocks that use `any[]` and `ReactElement<any>`
- Files:
  - [`src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`](../src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx)
  - [`src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`](../src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx)
  - [`src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`](../src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts)
- Why it is low-breakage:
  - production code is untouched
- Why payoff is moderate:
  - reduces raw count quickly
  - improves signal-to-noise in future audits
- Why it is not the first quick win:
  - impact on production safety is much lower than the first four options

## Recommended Execution Order
1. Quick Win 2
2. Quick Win 1
3. Quick Win 3
4. Quick Win 4
5. Quick Win 5

This order keeps behavior stable while improving the highest-risk boundaries first.

## Suggested Success Metrics For A First Pass
- Eliminate all explicit `any` in [`src/auth/config.ts`](../src/auth/config.ts)
- Remove `TArgs = any` and local `as any` parsing from [`src/lib/rpc-client.ts`](../src/lib/rpc-client.ts)
- Replace `Record<string, any>` query-key filters in maintenance and report hooks
- Reduce runtime explicit `any` count from `241` to below `200` without changing server behavior

## Summary
The repo's `any` debt is real, but it is concentrated. The best leverage is not a repo-wide sweep. The best leverage is typing the central boundaries first:

1. RPC client
2. NextAuth augmentation
3. report and maintenance query-key and payload boundaries

That sequence should produce the largest quality gain with the smallest behavioral risk.
