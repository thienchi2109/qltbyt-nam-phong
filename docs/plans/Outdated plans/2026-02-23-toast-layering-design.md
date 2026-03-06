# Toast Overlay Visibility Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure success toasts always render above the EquipmentDetailDialog (and every other modal) so confirmation feedback is immediately visible after inline edits.

**Architecture:** Keep the single global toast infrastructure (Toaster + ToastViewport) and adjust the shared primitive's layering in line with the existing overlay contract. Update docs/tests so any future regressions are caught automatically.

**Tech Stack:** Next.js App Router, React 18, Radix UI Toast/Dialog primitives, Vitest + Testing Library.

---

## 1. Current Behavior Snapshot

- `EquipmentDetailDialog` uses the shared `Dialog` component (z-[999]/z-[1000]).
- `ToastViewport` (src/components/ui/toast.tsx:12-24) hardcodes `z-[100]` per older contract, so toasts sit beneath modals and their overlays.
- `useEquipmentUpdate` shows toast-based feedback after `equipment_update`, meaning the confirmation is hidden whenever the detail dialog stays open.
- Layering contract (docs/frontend/layering.md:15-25) still lists ToastViewport at z-[100], so tests (e.g., alert-dialog z-index regression) don't cover this case.

## 2. Requirements & Constraints

1. Toast notifications must overlay **all** modal primitives (Dialog, Sheet, AlertDialog) without per-screen overrides.
2. Reuse the global toast infrastructure—no local banners or duplicated code paths.
3. Respect the layering contract: any change must be documented and tested.
4. Follow TDD: write/extend regression tests before changing viewport styles.
5. Avoid side effects on tooltip/menu tiers (non-blocking, informational overlays stay lower).

## 3. Options Considered

| Option | Summary | Pros | Cons |
| --- | --- | --- | --- |
| A | Raise `ToastViewport` tier globally | Single change, fixes every dialog | Requires doc/test updates; must ensure no other overlay depends on low tier |
| B | Inline success banner within dialog | Localized change | Duplicates patterns, contradicts requirement to use toast |
| C | Queue/delay toasts until dialog closes | Avoids z-index tweaks | Adds state complexity and hides immediate confirmation |

**Decision:** Option A—adjust the shared ToastViewport tier (e.g., `z-[1300]`) so it becomes the top-most non-blocking overlay.

## 4. Proposed Solution

1. **Define new overlay tier** in docs/frontend/layering.md:
   - Update table to assign ToastViewport a dedicated high tier (e.g., `z-[1300]` overlay/content) explicitly above AlertDialog.
   - Mention that toast is non-blocking but must remain visible over dialogs.
2. **Update shared primitive** (`src/components/ui/toast.tsx`):
   - Change `ToastViewport` class to new z-index tier.
   - Keep positioning/responsiveness the same; only z-index changes.
3. **Regression tests**:
   - Extend `src/components/ui/__tests__/alert-dialog-z-index.test.tsx` or add `toast-z-index.test.tsx` to assert the viewport carries the new class and stacks above `DialogOverlay`/`SheetOverlay` simultaneously rendered in the DOM.
   - Use Testing Library to render both a Dialog and a Toast, comparing computed class strings.
4. **Validate usage**: no changes needed in feature code (hooks/dialog). After layering update, toasts triggered via `useToast` automatically appear over dialogs.

## 5. TDD Flow

1. **Add failing test** verifying `ToastViewport` has the new z-index tier and overlays dialog content:
   - Render Dialog + Toaster simultaneously.
   - Assert toast container includes `z-[1300]` and (optionally) that dialog overlay lacks it.
   - Commit failure snapshot.
2. **Implement minimal fix**:
   - Update `ToastViewport` class to the new z-index.
   - Adjust layering contract doc to match (tests should still fail until code change is in place if doc referenced? mainly ensures documentation parity).
3. **Re-run tests** to confirm pass (dialog layering + new toast test).
4. **Finalize docs/tests**: ensure layering doc/table is accurate, consider updating any references (comments) citing old z-index values.

## 6. Impacted Files

- `src/components/ui/toast.tsx` — z-index tier adjustment.
- `docs/frontend/layering.md` — contract update for ToastViewport (possibly reordering table to reflect new hierarchy).
- `src/components/ui/__tests__/alert-dialog-z-index.test.tsx` (or new `toast-z-index` test) — enforce new expectations.
- No feature-specific files need changes (`EquipmentDetailDialog` code remains untouched).

## 7. Risks & Mitigations

- **Risk:** Other components relied on toast being beneath dialogs (unlikely). *Mitigation:* since toasts are non-blocking, raising the layer should not interfere with interactions; verify manually on a dialog + toast scenario.
- **Risk:** Future contributors might reintroduce ad-hoc z-index tweaks. *Mitigation:* documented tier + regression test prevents silent regressions.

## 8. Open Questions

- None—user confirmed toast must overlay dialog globally.

---

Once approved, proceed to implementation planning (superpowers:writing-plans → superpowers:executing-plans) following the TDD steps above.
