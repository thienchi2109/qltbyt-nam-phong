# Transfers Remove Internal HTTP Hop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused `/api/transfers/list` and `/api/transfers/counts` internal self-fetch path after proving there are no production callers.

**Architecture:** Keep the centralized RPC proxy (`/api/rpc/[fn]`) as the only security boundary for transfers data reads. The active transfers page continues to use `useTransferPageData -> callRpc("transfer_request_page_data")`, while legacy list/count wrapper routes and their unused hook wrappers are removed.

**Tech Stack:** Next.js App Router route handlers, React Query, Vitest, TypeScript, React Doctor.

---

## Scope

In scope:
- Prove `/api/transfers/list` and `/api/transfers/counts` have no production callers.
- Remove the extra `/api/transfers/* -> /api/rpc/*` HTTP hop.
- Remove dead transfer list/count hook wrappers if they are only used by tests/export guards.
- Keep current transfers page behavior, filters, table/kanban data, and tenant/security behavior unchanged.
- Document before/after architecture evidence.

Out of scope:
- No Supabase SQL/RPC changes.
- No direct Supabase server client path for transfers routes.
- No broader transfers page UI refactor.
- No DB performance tuning.

## Current Evidence

- Legacy routes:
  - `src/app/api/transfers/list/route.ts`
  - `src/app/api/transfers/counts/route.ts`
- Active page data path:
  - `src/app/(app)/transfers/_components/useTransfersPageController.ts`
  - `src/hooks/useTransferDataGrid.ts`
  - `src/lib/rpc-client.ts`
  - `src/app/api/rpc/[fn]/route.ts`
- Known direct RPC path already in use:
  - `useTransferPageData()` calls `transfer_request_page_data`.
  - `useTransfersKanban()` and infinite scroll call `transfer_request_list` through `callRpc()`.
- Security boundary to preserve:
  - `/api/rpc/[fn]` allowlist, NextAuth session, `admin -> global`, short-lived JWT signing, and tenant override logic.

## File Map

Modify:
- `src/hooks/useTransferDataGrid.ts`
  - Remove unused `fetchTransferList`, `fetchTransferCounts`, `useTransferList`, `useTransferCounts`, `usePrefetchTransferList`, and `usePrefetchTransferCounts` only after tests/inventory prove no production caller.
  - Keep `useTransferPageData`, `getTransferListData`, `transferDataGridKeys`, and kanban-related re-exports that are still used.
- `src/__tests__/react-doctor-p4-knip-exports.source.test.ts`
  - Update expected retained exports for `src/hooks/useTransferDataGrid.ts`.

Delete if no remaining imports:
- `src/app/api/transfers/list/route.ts`
- `src/app/api/transfers/counts/route.ts`
- `src/app/api/transfers/legacy-adapter.ts`

Test/update:
- `src/hooks/__tests__/useTransferPageData.test.tsx`
  - Keep or add regression coverage that `useTransferPageData()` calls `callRpc({ fn: "transfer_request_page_data" })`.
- Add a source-level guard test if there is no existing suitable location:
  - The guard should fail while `/api/transfers/list`, `/api/transfers/counts`, or client fetches to those routes remain.

## Task 1: Branch And Caller Inventory

- [ ] **Step 1: Sync and branch from main**

Run:
```bash
git checkout main
git pull --rebase
git checkout -b issue-486-transfers-remove-internal-hop
```

- [ ] **Step 2: Capture caller inventory**

Run through context-mode:
```bash
rg -n "/api/transfers/(list|counts)|api/transfers/list|api/transfers/counts|fetchTransferList|fetchTransferCounts|useTransferList|useTransferCounts|usePrefetchTransferList|usePrefetchTransferCounts" src docs --glob '!docs/superpowers/plans/2026-05-15-transfers-remove-internal-hop.md'
```

Expected:
- Production references are limited to the legacy route files and unused hook wrappers.
- Test/export guard references may remain and should be updated in later tasks.

- [ ] **Step 3: Record architecture baseline**

Add a short note to the implementation PR body later:
- Before: legacy routes performed `/api/transfers/* -> /api/rpc/*`.
- After: active transfers page uses `callRpc()` directly through the centralized RPC proxy.

## Task 2: Write Failing Source Guard

- [ ] **Step 1: Add or update a source test that rejects legacy transfer route usage**

Preferred file:
- `src/hooks/__tests__/useTransferPageData.test.tsx` for call behavior.

If that is too narrow, add a source guard near existing source tests:
- `src/__tests__/transfer-routes-no-internal-hop.source.test.ts`

Test intent:
```ts
expect(sourceFiles).not.toContain('/api/transfers/list')
expect(sourceFiles).not.toContain('/api/transfers/counts')
expect(routeFiles).not.toContain('src/app/api/transfers/list/route.ts')
expect(routeFiles).not.toContain('src/app/api/transfers/counts/route.ts')
```

- [ ] **Step 2: Run the new/focused test and confirm it fails**

Run through context-mode:
```bash
node scripts/npm-run.js vitest run src/__tests__/transfer-routes-no-internal-hop.source.test.ts
```

Expected:
- FAIL because the route files and/or legacy client fetch strings still exist.

## Task 3: Remove Legacy Route Files

- [ ] **Step 1: Delete legacy list/count route handlers**

Delete:
- `src/app/api/transfers/list/route.ts`
- `src/app/api/transfers/counts/route.ts`

- [ ] **Step 2: Check whether `legacy-adapter.ts` still has imports**

Run through context-mode:
```bash
rg -n "legacy-adapter|sanitizeStatuses|sanitizeTypes|ALLOWED_STATUSES|ALLOWED_TYPES" src
```

- [ ] **Step 3: Delete `legacy-adapter.ts` if it is now unused**

Delete:
- `src/app/api/transfers/legacy-adapter.ts`

- [ ] **Step 4: Run the source guard**

Run:
```bash
node scripts/npm-run.js vitest run src/__tests__/transfer-routes-no-internal-hop.source.test.ts
```

Expected:
- May still fail if legacy hook wrappers still contain `/api/transfers/*` fetches.

## Task 4: Remove Dead Hook Wrappers

- [ ] **Step 1: Remove unused list/count fetch functions from `useTransferDataGrid.ts`**

Remove only if caller inventory confirms they are unused:
- `fetchTransferList`
- `fetchTransferCounts`
- `useTransferList`
- `useTransferCounts`
- `usePrefetchTransferList`
- `usePrefetchTransferCounts`

Keep:
- `sanitizeFilters`
- `fetchTransferPageData`
- `useTransferPageData`
- `transferDataGridKeys`
- `getTransferListData`
- kanban re-exports used by `TransfersKanbanView`

- [ ] **Step 2: Update export guard**

Modify:
- `src/__tests__/react-doctor-p4-knip-exports.source.test.ts`

Remove deleted exports from the retained export list for:
- `src/hooks/useTransferDataGrid.ts`

- [ ] **Step 3: Run focused tests**

Run:
```bash
node scripts/npm-run.js vitest run src/hooks/__tests__/useTransferPageData.test.tsx src/__tests__/react-doctor-p4-knip-exports.source.test.ts src/__tests__/transfer-routes-no-internal-hop.source.test.ts
```

Expected:
- PASS.

## Task 5: Verify Active Transfers Behavior Contract

- [ ] **Step 1: Run transfers page/controller focused tests**

Run:
```bash
node scripts/npm-run.js vitest run src/app/'(app)'/transfers/__tests__/TransfersKpi.test.tsx src/components/transfers/__tests__/TransfersKanbanView.infinite-scroll.test.tsx src/hooks/__tests__/useTransfersKanban.test.tsx src/hooks/__tests__/useTransferPageData.test.tsx
```

Expected:
- PASS.

- [ ] **Step 2: Re-run caller inventory**

Run through context-mode:
```bash
rg -n "/api/transfers/(list|counts)|api/transfers/list|api/transfers/counts|fetchTransferList|fetchTransferCounts|useTransferList|useTransferCounts|usePrefetchTransferList|usePrefetchTransferCounts" src docs --glob '!docs/superpowers/plans/2026-05-15-transfers-remove-internal-hop.md'
```

Expected:
- No source references except intentional historical docs, if any.
- If historical docs mention the old route, leave them only if they are clearly review/history documents.

## Task 6: Full Verification Gates

- [ ] **Step 1: Run TypeScript/React verification chain in order**

Run through one `ctx_batch_execute`:
```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js vitest run src/hooks/__tests__/useTransferPageData.test.tsx src/hooks/__tests__/useTransfersKanban.test.tsx src/app/'(app)'/transfers/__tests__/TransfersKpi.test.tsx src/components/transfers/__tests__/TransfersKanbanView.infinite-scroll.test.tsx src/__tests__/react-doctor-p4-knip-exports.source.test.ts src/__tests__/transfer-routes-no-internal-hop.source.test.ts
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected:
- `verify:no-explicit-any` PASS.
- `typecheck` PASS.
- Focused Vitest PASS.
- React Doctor diff has no new issue related to the changed files.

- [ ] **Step 2: Run diff hygiene**

Run:
```bash
git diff --check
```

Expected:
- PASS.

## Task 7: Commit And PR

- [ ] **Step 1: Review diff**

Run through context-mode:
```bash
git diff --stat
git diff -- src/hooks/useTransferDataGrid.ts src/app/api/transfers src/__tests__ src/hooks/__tests__
```

Check:
- No route handler remains for `/api/transfers/list` or `/api/transfers/counts`.
- No direct Supabase path was added.
- Existing `callRpc()` path remains the security boundary.

- [ ] **Step 2: Commit**

Run:
```bash
git add src docs/superpowers/plans/2026-05-15-transfers-remove-internal-hop.md
git commit -m "refactor: remove transfers internal http hop"
```

- [ ] **Step 3: Open PR**

PR body must include:
- `Fixes #486`
- Caller inventory result.
- Before/after architecture note.
- Verification commands and results.
- Note that no SQL/RPC behavior changed.

- [ ] **Step 4: Push**

Run:
```bash
git push -u origin issue-486-transfers-remove-internal-hop
```

## Risk Notes

- Do not choose Option B unless implementation discovers a real external caller that must keep `/api/transfers/*`.
- Do not duplicate `/api/rpc/[fn]` auth/JWT/tenant behavior in a new helper unless a separate architecture decision approves it.
- If a production caller is discovered, stop and revise the plan toward direct `callRpc()` replacement or a shared server RPC helper.
- If tests rely on `useTransferList` or `useTransferCounts` only as mocks for old behavior, update the tests to reflect the active `useTransferPageData` path rather than preserving dead exports.

