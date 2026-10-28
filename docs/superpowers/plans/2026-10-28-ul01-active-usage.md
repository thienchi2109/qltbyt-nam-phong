# UL-01 Active Usage Implementation Plan

> **For agentic workers:** Execute in the assigned isolated worktree using TDD and review checkpoints. Parent coordinates review and integration; do not spawn further agents.

**Goal:** Show “Đang sử dụng” and prevent duplicate starts consistently on desktop/mobile with foreground polling every five seconds.

**Architecture:** Extend the existing scoped TanStack Query batch hook. Fetch every active page atomically; keep known active data on errors and fail closed while status is unknown. Await server-confirmed mutation invalidation/refetch without guessing a returned session's tenant/dataset.

**Tech Stack:** React, Next.js, TanStack Query, existing RPC client, Vitest/Testing Library.

## Chunk 1: Scoped query and actions

### Task 1: Query and mutation regression

**Files:** Modify `src/hooks/use-usage-logs.ts`; create `src/hooks/__tests__/use-usage-logs.active.test.tsx`.

- [x] Write regression tests: >200 active rows, nine RPC arguments on each page, partial/malformed response failure, tenant/dataset isolation, retained busy data after error, mutation pending/success/failure and competing-start refresh.
- [x] Run `node scripts/npm-run.js exec vitest run src/hooks/__tests__/use-usage-logs.active.test.tsx`; record expected RED behavior.
- [x] Implement smallest all-page batch fetch; `staleTime: 0`, `refetchInterval: 5000`, background polling disabled, focus/reconnect enabled. Await successful active/history invalidation; refresh active queries after start error.
- [x] Add two independent QueryClients proving start/end propagate by the next five-second poll, plus foreground/focus/reconnect coverage. Run focused suite GREEN.

### Task 2: Desktop/mobile availability

**Files:** Modify `src/components/equipment/equipment-actions-menu.tsx`, `src/components/mobile-usage-actions.tsx`, `src/components/start-usage-dialog.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentData.ts`, `src/app/(app)/equipment/use-equipment-page.tsx`; extend existing desktop/mobile/dialog tests.

- [x] Write RED UI checks for exact badge text, unavailable/error/retry, owner/other start denial, and preserved authorized end.
- [x] Remove five-minute page override, pass existing query availability/error/refetch, and reuse Badge/Button/pending dialogs. Keep all source files at most 450 lines. Extract the existing row callback into `src/app/(app)/equipment/_hooks/useEquipmentRowActions.tsx` to keep the page under the ceiling.
- [x] Run focused UI tests GREEN, including existing dialog validation/start/end flow regressions and real QueryClient mutation pending/failure checks.
- [x] Review correction: dialog observes the same scoped batch query only while open with equipment; disable both button and native submit when polling reports busy/unknown/error. RED 5/7 then GREEN 7/7 dialog tests; forward mobile equipment tenant/funding to the dialog.

### Task 3: Verification and handoff

**Files:** Update `backlog/tasks/UL-01-active-usage-badge-and-start-guard.md` and this plan with evidence.

- [x] Simplify only changed logic. Reuse decision: extend existing batch hook/actions/dialogs; no new dependencies, per-row RPC, Realtime, or SQL migration.
- [x] Run one sequential context-mode batch: `node scripts/npm-run.js run format:check` → `verify:no-explicit-any` → `verify:dedupe` → `typecheck` → focused Vitest → `react-doctor` (all commands through `node scripts/npm-run.js`). PASS: 126 tests / 14 files; staged React Doctor scans 13 TS/TSX files, 91/100 with complexity warnings in the action menu and start dialog.
- [x] Update backlog as implemented with browser smoke explicitly incomplete. Parent checked concurrent starts on disposable PostgreSQL 17.11 using the exact existing RPC SQL and minimal fixtures: B waited on A's lock, then received P0001; one active row remained. This is DISPOSABLE ONLY, not full-baseline/RLS/live certification. No live/Oracle operation is authorized by this plan.
- [x] Parent and independent reviewer reviewed the final diff; parent reran all gates (126 tests / 14 files, React Doctor 91/100, two warnings, no errors). Parent handles branch publication with hooks enabled.
