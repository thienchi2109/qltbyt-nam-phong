# Maintenance Page 450-Line Refactor Design

**Date:** 2026-02-06  
**Target File:** `src/app/(app)/maintenance/page.tsx`  
**Constraint:** `CLAUDE.md` requires `350-450` lines per file

## Audit Summary

- Current size: `1132` lines (`wc -l src/app/(app)/maintenance/page.tsx`).
- Size gap: needs at least `682` lines removed from `page.tsx`.
- Current file mixes too many concerns:
  - Page-level auth/session and routing.
  - Plan query/filter/facility state.
  - URL synchronization and state restoration.
  - Task draft persistence, save orchestration, completion tracking.
  - Bulk task operations and table state.
  - Legacy mobile card rendering and desktop layout rendering.
- Existing extracted modules already present:
  - `use-maintenance-operations.ts`
  - `use-maintenance-drafts.ts`
  - `use-maintenance-print.ts`
  - `mobile-maintenance-layout.tsx`
  - `maintenance-columns.tsx`
  - `maintenance-dialogs.tsx`

Primary issue is orchestration gravity: logic is extracted, but `page.tsx` still wires everything inline in one place.

## Brainstorming: Refactor Approaches

### Option 1 (Mechanical JSX Split Only)

Move only `renderMobileCards` and desktop `<Tabs>` JSX into new components.

- Pros: low risk, quick.
- Cons: removes mostly view code; page still owns heavy task/filter orchestration and likely remains above 450 lines.

### Option 2 (Recommended): Controller Hooks + Thin View Components

Keep `page.tsx` as a composition root and move orchestration into focused hooks/components:

- Hook for plans/filtering/pagination/URL sync.
- Hook for task workflow (draft loading/saving/completion/bulk actions/table state).
- Component for desktop shell (tabs/cards/actions/table wiring).
- Component for legacy plan cards (non-redesign mobile fallback).

This is still mechanical (no behavior change), but removes both logic and view mass.

- Pros: highest chance to hit 450-line target safely; better long-term maintainability.
- Cons: larger diff and interface plumbing.

### Option 3 (Context/Reducer Rewrite)

Introduce maintenance page context + reducer, then split by feature.

- Pros: very scalable architecture.
- Cons: highest risk and scope; unnecessary for current objective (YAGNI).

## Recommended Design

Use Option 2 with strict behavior parity and test-first extraction.

### Proposed Target Structure

- Keep:
  - `src/app/(app)/maintenance/page.tsx` as a thin coordinator (`~320-420` lines).
- Create:
  - `src/app/(app)/maintenance/_hooks/use-maintenance-plan-controller.ts`
  - `src/app/(app)/maintenance/_hooks/use-maintenance-task-controller.ts`
  - `src/app/(app)/maintenance/_components/maintenance-desktop-view.tsx`
  - `src/app/(app)/maintenance/_components/maintenance-plan-cards.tsx`
  - `src/app/(app)/maintenance/_components/maintenance-tabs-shell.tsx` (optional if needed to stay under 450)
- Modify:
  - `src/app/(app)/maintenance/_hooks/use-maintenance-drafts.ts` (reuse instead of duplicating draft logic in `page.tsx`)

### Data Flow After Refactor

1. `page.tsx` handles auth guard + feature-flag route branching only.
2. Plan controller hook owns:
   - search term, debounced search, facility filtering, pagination.
   - facility fetch and URL param handling.
   - plan selection and state-preservation callbacks.
3. Task controller hook owns:
   - task loading, draft persistence, completion status, bulk operations, task table selection/pagination.
4. Desktop/mobile fallback components receive prepared props and render only.

### Error Handling

- Keep existing toast/catch behavior unchanged.
- Keep RPC entrypoints unchanged (`maintenance_tasks_bulk_insert`, `maintenance_task_update`, `maintenance_tasks_delete`, `maintenance_task_complete`).
- Preserve destructive confirmation flows through `MaintenanceDialogs`.

### Testing Strategy

- Add characterization tests for extracted controller hooks (state transitions and side effects).
- Add render-level smoke test for `maintenance-desktop-view`.
- Keep existing `maintenance-columns` tests green.
- Run targeted tests first, then full maintenance test folder, then lint/typecheck.

## Success Criteria

- `src/app/(app)/maintenance/page.tsx` is `<= 450` lines.
- No behavior regression in:
  - plan filtering/pagination,
  - plan selection + URL-driven navigation,
  - draft load/save/cancel behavior,
  - completion marking and bulk operations,
  - dialogs and action permissions.
- New files keep single responsibility and stay close to the 350-450 guideline.
