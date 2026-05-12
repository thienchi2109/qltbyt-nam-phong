# React Doctor Full-Scan Report — 2026-05-12

- **Date**: 2026-05-12
- **Branch**: `issue-450-react-doctor-auth-shell-cleanup`
- **Commit (HEAD)**: `f365e15`
- **Tool**: `react-doctor@0.1.6`
- **Command**: `npx react-doctor@latest . --full --verbose --project nextn --offline`
- **Scan mode**: full repo (config `diff` overridden by `--full`)
- **Source files scanned**: 527
- **Files with issues**: 298
- **Total issues**: **1310**
- **Distinct rules fired**: 49
- **Health score**: **63 / 100 — _Needs work_**
- **Telemetry**: disabled (`--offline`)
- **Code changes in this run**: none — read-only audit

> Stack confirmed by tool: Next.js · React `^18.3.1` · TypeScript · React Compiler not enabled.

---

## TL;DR

The repo is at **63/100** with **1310 issues**, but the distribution is heavily skewed:

- **~53% (692 issues)** are pure design/Tailwind cosmetics that can be fixed by codemods (`size-N` shorthand, palette tokens, padding/space utilities). Mechanical, low-risk.
- **~17% (222 issues)** are dead-code hygiene from `knip` (unused exports/types/files, 3 duplicate exports). Low-risk cleanup.
- **~7% (90 issues)** are React 19 deprecations (`useContext`, `forwardRef`) — pre-flight items before any React 19 bump, **not blockers today** (project is on React 18).
- **~4% (49 issues)** are SSR hydration mismatches — the highest-impact correctness category that warrants a focused pass.
- **~3% (43 issues)** are real performance / re-render anti-patterns (missing query invalidation, cascading setState, useEffect-as-handler, useState-only-in-handlers) — small count, **highest user-visible impact**, should be addressed first.
- **~2% (28 issues)** are accessibility / unknown-property / valid-DOM issues — small count, easy wins, should be batched.
- The remaining ~14% are scattered design/code-smell rules with low individual cost.

**Bottom line:** the score looks low primarily because of mechanical Tailwind/cosmetic findings. Real engineering effort should target the **43 perf/correctness issues** and **49 hydration issues**, in that order.

---

## How to Reproduce

```bash
# Full scan (overrides config.diff)
node scripts/npm-run.js npx react-doctor@latest . --full --verbose --project nextn --offline

# Score-only quick check
node scripts/npm-run.js npx react-doctor@latest . --score --yes --project nextn --offline

# Diff-only (default project workflow)
node scripts/npm-run.js npx react-doctor@latest . --verbose --yes --project nextn --offline --diff main
```

> `--full` and `--yes` are mutually exclusive in `react-doctor@0.1.6`. The repo's `react-doctor.config.json` already lists ignored generated/type-assert files; `--full` does not bypass that ignore list, only the `diff` filter.

---

## Issue Distribution by Rule (sorted)

| # | Rule | Count | Category |
|---:|------|------:|----------|
| 1 | `react-doctor/design-no-redundant-size-axes` | 540 | Design / Tailwind |
| 2 | `react-doctor/design-no-default-tailwind-palette` | 152 | Design / Tailwind |
| 3 | `knip/exports` | 125 | Dead code |
| 4 | `react-doctor/no-react19-deprecated-apis` | 90 | React 19 readiness |
| 5 | `knip/types` | 89 | Dead code |
| 6 | `react-doctor/rendering-hydration-mismatch-time` | 49 | Hydration / SSR |
| 7 | `react-doctor/design-no-space-on-flex-children` | 41 | Design / Tailwind |
| 8 | `react-doctor/design-no-bold-heading` | 24 | Design |
| 9 | `react-doctor/design-no-three-period-ellipsis` | 19 | Design / Copy |
| 10 | `react-doctor/js-combine-iterations` | 18 | Code smell |
| 11 | `react-doctor/react-compiler-destructure-method` | 16 | React Compiler readiness |
| 12 | `react-doctor/query-mutation-missing-invalidation` | 13 | **Correctness (TanStack Query)** |
| 13 | `react-doctor/no-giant-component` | 11 | Maintainability |
| 14 | `react-doctor/rerender-state-only-in-handlers` | 10 | **Performance / re-render** |
| 15 | `react-doctor/no-effect-event-handler` | 9 | **Effect misuse** |
| 16 | `react-doctor/no-cascading-set-state` | 9 | **Performance / re-render** |
| 17 | `react-doctor/no-generic-handler-names` | 8 | Code style |
| 18 | `knip/files` | 8 | Dead code |
| 19 | `react-doctor/prefer-useReducer` | 6 | State design |
| 20 | `react-doctor/no-side-tab-border` | 5 | Design |
| 21 | `react/no-unknown-property` | 5 | **DOM correctness** |
| 22 | `jsx-a11y/no-static-element-interactions` | 5 | **A11y** |
| 23 | `jsx-a11y/click-events-have-key-events` | 5 | **A11y** |
| 24 | `react-doctor/rendering-usetransition-loading` | 4 | Performance |
| 25 | `react-doctor/no-many-boolean-props` | 4 | API design |
| 26 | `react-doctor/no-array-index-as-key` | 4 | **Correctness** |
| 27 | `react-doctor/js-flatmap-filter` | 4 | Code smell |
| 28 | `jsx-a11y/label-has-associated-control` | 4 | **A11y** |
| 29 | `react-doctor/no-render-in-render` | 3 | Performance |
| 30 | `react-doctor/no-pure-black-background` | 3 | Design |
| 31 | `react-doctor/no-polymorphic-children` | 3 | API design |
| 32 | `knip/duplicates` | 3 | **Dead code (risk: import ambiguity)** |
| 33 | `react-doctor/server-dedup-props` | 2 | RSC |
| 34 | `react-doctor/rerender-functional-setstate` | 2 | Performance |
| 35 | `react-doctor/js-hoist-intl` | 2 | Performance |
| 36 | `jsx-a11y/anchor-is-valid` | 2 | A11y |
| 37 | `react/no-children-prop` | 1 | DOM correctness |
| 38 | `react-doctor/rendering-hydration-no-flicker` | 1 | Hydration |
| 39 | `react-doctor/prefer-use-sync-external-store` | 1 | Concurrent React |
| 40 | `react-doctor/prefer-dynamic-import` | 1 | Bundling |
| 41 | `react-doctor/no-long-transition-duration` | 1 | Design |
| 42 | `react-doctor/no-derived-useState` | 1 | Performance |
| 43 | `react-doctor/nextjs-no-use-search-params-without-suspense` | 1 | **Next.js 15 correctness** |
| 44 | `react-doctor/js-batch-dom-css` | 1 | Performance |
| 45 | `react-doctor/design-no-redundant-padding-axes` | 1 | Design |
| 46 | `react-doctor/design-no-em-dash-in-jsx-text` | 1 | Copy |
| 47 | `react-doctor/async-parallel` | 1 | Performance |
| 48 | `jsx-a11y/no-autofocus` | 1 | A11y |
| 49 | `jsx-a11y/heading-has-content` | 1 | A11y |

---

## Issue Distribution by Category

| Category | Issues | Share | Risk | Effort |
|----------|------:|------:|------|--------|
| Design / Tailwind cosmetics | ~692 | 52.8% | Low | Low (codemod) |
| Dead code (`knip`) | 225 | 17.2% | Low–Med | Low |
| React 19 readiness | 90 | 6.9% | Low (now) / High (pre-bump) | Med |
| Hydration / SSR | 50 | 3.8% | **Med–High** | Med |
| Performance / re-render | 43 | 3.3% | **Med–High** | Med |
| Maintainability (giant components, generic names, boolean props) | 23 | 1.8% | Low | Med |
| Accessibility (jsx-a11y) | 18 | 1.4% | Med | Low–Med |
| Code smells (combine-iterations, flatmap-filter, etc.) | 22 | 1.7% | Low | Low |
| State design (`useReducer`, `useTransition`) | 10 | 0.8% | Low | Low–Med |
| DOM correctness (`no-unknown-property`, `no-children-prop`, `array-index-key`) | 10 | 0.8% | Med | Low |
| RSC / Next.js 15 (search-params suspense, server-dedup-props) | 3 | 0.2% | **High** (where it fires) | Low |

> Numbers are approximate where rules straddle categories.

---

## Detailed Findings

### 1. Design / Tailwind cosmetics — 692 issues

#### 1.1 `design-no-redundant-size-axes` (×540)

`w-N h-N` should be collapsed to `size-N` (Tailwind v3.4+). Files with the heaviest concentration include:

- `src/app/(app)/maintenance/_components/maintenance-columns.tsx`
- `src/app/(app)/maintenance/_components/maintenance-mobile-task-card.tsx`
- `src/app/(app)/qr-scanner/page.tsx`
- `src/app/(app)/repair-requests/_components/RepairRequestsColumns.tsx`
- `src/app/(app)/repair-requests/_components/RepairRequestsFilterChips.tsx`
- `src/components/mobile-usage-actions.tsx`
- `src/components/login-template.tsx`

**Recommendation:** A regex-based codemod over `*.tsx` with the pattern `\bw-(\d+|\[[^\]]+\])\s+h-\1\b` → `size-$1` is sufficient. Run inside a single PR, run `verify:no-explicit-any` + `typecheck` + visual smoke. **Estimated 1 PR, ≤1 day.**

#### 1.2 `design-no-default-tailwind-palette` (×152)

Raw Tailwind palette tokens used directly instead of design tokens. Best handled together with the design system audit; consider a follow-up PR aligning all UI to `tailwind.config.ts` semantic tokens.

#### 1.3 Other Tailwind/design rules (~24 + 19 + 5 + 3 + 1 + 1 + 1 + 1 = 55)

`design-no-space-on-flex-children` (41), `design-no-bold-heading` (24), `design-no-three-period-ellipsis` (19), `no-side-tab-border` (5), `no-pure-black-background` (3), `no-long-transition-duration` (1), `design-no-redundant-padding-axes` (1), `design-no-em-dash-in-jsx-text` (1). All cosmetic; group into one design polish PR.

---

### 2. Dead code — 225 issues

#### 2.1 `knip/exports` (×125), `knip/types` (×89), `knip/files` (×8)

A large number of exports/types/files that are never imported. Most of the unused files are `.types.assert.ts` typecheck-helper files plus a few legacy supabase functions:

- `src/hooks/use-audit-logs.types.assert.ts`
- `src/hooks/use-cached-repair.complete.typecheck.ts`
- `src/hooks/use-cached-repair.legacy-list.typecheck.ts`
- `src/lib/chart-utils.types.assert.ts`
- `supabase/functions/auth-audit-cleanup/handler.ts`
- `supabase/functions/auth-audit-cleanup/index.ts`
- `src/lib/ai/tools/query-catalog.types.assert.ts`
- `src/app/(app)/reports/hooks/use-maintenance-data.types.assert.ts`

Some of these may be intentional typecheck assertions referenced only by `tsconfig`. **Verify before deleting** — the existing `react-doctor.config.json` already ignores most known type-assertion files, so the remaining ones likely _are_ truly unused.

#### 2.2 `knip/duplicates` (×3) — **non-trivial risk**

Duplicate exported names across the repair-requests module:

- `RepairRequestsCompleteDialog | CompleteRequestDialog` exported from:
  - <ref_file file="/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_components/RepairRequestsCompleteDialog.tsx" />
  - <ref_file file="/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx" />
  - <ref_file file="/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_components/RepairRequestsApproveDialog.tsx" />

Risk: import ambiguity / wrong dialog rendered. **Recommend explicit single-source export and consumer audit.**

---

### 3. React 19 readiness — 90 issues (`no-react19-deprecated-apis`)

The rule fires on usages of `useContext` (superseded by `use()` in React 19) and `forwardRef` (no longer required). Concentrated in foundational UI primitives:

- `src/components/ui/form.tsx` (×7)
- `src/components/ui/table.tsx` (×3+)
- `src/components/ui/progress.tsx`, `separator.tsx`, etc.
- `src/test-utils/tooltip-mock.tsx` (×4)

**These are not bugs on React 18.** They become required work _before_ a React 19 bump. Treat as a tracked migration ticket, not a "fix me now" item. The blast radius (foundational `ui/*`) means this should be done as a single planned PR with snapshot tests.

---

### 4. Hydration / SSR — 50 issues

#### 4.1 `rendering-hydration-mismatch-time` (×49)

Components rendering `Date.now()`, `new Date()`, `Math.random()`, or locale-dependent formatting at render time will hydrate differently on server vs client. This is the highest-impact **correctness** category in the report — symptoms include console warnings in production and occasional UI flicker.

**Recommendation:**
- Add `suppressHydrationWarning` for harmless cases (timestamps).
- For real time-dependent UI, render client-only via `dynamic(() => ..., { ssr: false })` or `useEffect`-mounted state.
- Audit list-by-list; do not blanket-apply `suppressHydrationWarning`.

#### 4.2 `rendering-hydration-no-flicker` (×1)

- `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingGuide.tsx:22` — `useEffect(setState, [])` on mount causes flash. Replace with `useSyncExternalStore` or move state into props/server.

---

### 5. Performance / re-render — 43 issues

#### 5.1 `query-mutation-missing-invalidation` (×13) — **highest user-visible impact**

`useMutation` without `queryClient.invalidateQueries / setQueryData / refetchQueries` in `onSuccess`. Symptoms: stale data after create/update/delete until manual refresh. Hot spots:

- <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx" lines="75-220" /> — 5 mutations
- <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx" lines="80-184" /> — 3 mutations
- <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsContext.tsx" lines="94-214" /> — 4 mutations
- <ref_snippet file="/root/qltbyt-nam-phong/src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx" lines="118-118" /> — 1 mutation

**Recommendation:** This should be **the first batch** to fix. One PR, per-mutation: add `onSuccess: () => queryClient.invalidateQueries({ queryKey: [...] })` aligned with the existing query keys. Verify with TanStack Query devtools or by reproducing each stale-data flow manually.

#### 5.2 `no-cascading-set-state` (×9)

Multiple `setState` calls in a single `useEffect` — should be `useReducer`. Hot spots:

- `src/components/pwa-install-prompt.tsx:24,165`
- `src/contexts/EquipmentFilterContext.tsx:171`
- `src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx:62,132`
- `src/app/(app)/repair-requests/_components/RepairRequestsEditDialog.tsx:47`
- `src/components/add-tasks-dialog.tsx:100`
- `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext.tsx:261`
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx:76`

#### 5.3 `rerender-state-only-in-handlers` (×10)

`useState` whose value is **only mutated**, never read in render — should be `useRef`. Files:

- `src/components/pwa-install-prompt.tsx` (×4)
- `src/components/tenant-logo.tsx`, `tenants-management-tenant-card.tsx`
- `src/app/(app)/repair-requests/_components/RepairRequestsCreateSheet.tsx` (×2)
- `src/app/(app)/device-quota/dashboard/_components/DeviceQuotaUnassignedAlert.tsx`
- `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingGuide.tsx`

#### 5.4 `no-effect-event-handler` (×9)

`useEffect` simulating an event handler — move logic into `onClick/onChange/onSubmit`. Hot spots include `handover-template.tsx`, `qr-action-sheet.tsx`, `RepairRequestsApproveDialog.tsx`, `RepairRequestsEditDialog.tsx`, `add-tasks-dialog.tsx`, `SuggestedMappingPreviewDialog.tsx`, `DeviceQuotaMappingPreviewDialog.tsx`.

#### 5.5 Other (×2-×4 each)

`rendering-usetransition-loading` (4 dialog `isLoading` flags that should use `useTransition`), `no-render-in-render` (3 inline `renderActions()`), `no-derived-useState`, `js-batch-dom-css`, `async-parallel`, `prefer-use-sync-external-store`, `rerender-functional-setstate` (2), `js-hoist-intl` (2).

---

### 6. RSC / Next.js 15 — 3 issues (small count, **high blast radius**)

- `react-doctor/nextjs-no-use-search-params-without-suspense` (×1) — `useSearchParams` not wrapped in `<Suspense>`. In Next.js 15 this can break static generation / cause client bailout.
- `react-doctor/server-dedup-props` (×2) — server component prop dedup opportunities.

**Recommendation:** Fix the search-params suspense issue immediately; investigate file location from the diagnostics file.

---

### 7. Maintainability — 23 issues

#### 7.1 `no-giant-component` (×11)

Components > ~300 lines. Highest priority refactors:

- `src/components/handover-template.tsx` (354 lines)
- `src/components/qr-scanner-camera.tsx`
- `src/components/usage-analytics-dashboard.tsx`
- `src/components/activity-logs/activity-logs-viewer.tsx`
- `src/components/usage-history-tab.tsx`
- `src/components/equipment-distribution-summary.tsx`
- `src/components/handover-preview-dialog.tsx`
- `src/components/add-tasks-dialog.tsx`
- `src/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionDialog.tsx`
- `src/app/(app)/device-quota/dashboard/_components/DeviceQuotaComplianceReport.tsx`
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog.tsx`

#### 7.2 `no-generic-handler-names` (×8) and `no-many-boolean-props` (×4)

Code-style — batch into a single touch-up PR.

#### 7.3 `prefer-useReducer` (×6)

Components with many related `useState`s. Frequently overlap with `no-cascading-set-state` files.

---

### 8. Accessibility — 18 issues

| Rule | Count |
|------|------:|
| `jsx-a11y/click-events-have-key-events` | 5 |
| `jsx-a11y/no-static-element-interactions` | 5 |
| `jsx-a11y/label-has-associated-control` | 4 |
| `jsx-a11y/anchor-is-valid` | 2 |
| `jsx-a11y/no-autofocus` | 1 |
| `jsx-a11y/heading-has-content` | 1 |

Hot spots: `RepairRequestsColumns.tsx:295`, `data-table-selection.tsx:32`, `TransferCard.tsx:179`, `TransfersKanbanCard.tsx:118`, `RepairRequestsMobileList.tsx:68`, `handover-template.tsx:133-151`. Most are fixed by switching to semantic `<button>` or adding `role` + key handlers.

---

### 9. DOM correctness — 10 issues

- `react/no-unknown-property` (×5): `handover-template.tsx:240`, `maintenance-form.tsx:204`, `qr-scanner-camera.tsx:477`, `log-template.tsx:200`, `DeviceQuotaComplianceReport.tsx:317`.
- `no-array-index-as-key` (×4): `assistant/AssistantThinkingIndicator.tsx`, `assistant/AssistantDraftCard.tsx` (×3).
- `react/no-children-prop` (×1).

---

### 10. Code smells — 22 issues

- `js-combine-iterations` (×18) — multiple sequential `.map`/`.filter` chains.
- `js-flatmap-filter` (×4) — `.map().filter(Boolean)` → `.flatMap`. Hot spot: `add-tasks-dialog.tsx:204-206`.

Mostly micro-optimizations; bundle into a code-quality PR if/when touching the affected files.

---

### 11. React Compiler readiness — 16 issues

`react-compiler-destructure-method` (×16). Project does not currently enable React Compiler. These are blockers _only if_ the project chooses to enable it. Track with the React 19 migration ticket.

---

## Recommendations & Priority Plan

> Goal: lift score above 80 within 2-3 PRs **without** touching foundational `ui/*` for React 19.

### P0 — Correctness (do first, 1 PR, ~1 day)

1. **TanStack Query invalidation** (`query-mutation-missing-invalidation` ×13)
   - Files: `RepairRequestsContext.tsx`, `DeviceQuotaCategoryContext.tsx`, `DeviceQuotaDecisionsContext.tsx`, `DeviceQuotaMappingContext.tsx`.
   - Verify each by reproducing stale-data flow.
2. **Next.js 15 Suspense** for `useSearchParams` (×1) — block on this if SSR/SSG starts to fail.
3. **`knip/duplicates`** (×3) — disambiguate the 3 duplicate exports in `repair-requests/_components/`.
4. **`react/no-unknown-property`** (×5) and **`array-index-as-key`** (×4) — small, scattered, easy.

### P1 — Hydration audit (1 PR, ~1 day)

5. **`rendering-hydration-mismatch-time`** (×49) — categorize each into:
   - "Cosmetic timestamp" → `suppressHydrationWarning`.
   - "Real time-dependent UI" → `dynamic(..., { ssr: false })` or client-only mount.
6. **`rendering-hydration-no-flicker`** in `DeviceQuotaMappingGuide.tsx`.

### P2 — Performance / re-render (1 PR, ~1 day)

7. **`no-cascading-set-state`** (×9) + **`rerender-state-only-in-handlers`** (×10) + **`prefer-useReducer`** (×6) — overlap heavily; refactor `pwa-install-prompt.tsx`, `RepairRequestsCreateSheet.tsx`, `RepairRequestsEditDialog.tsx`, `add-tasks-dialog.tsx`, `DeviceQuotaCategoryImportDialog.tsx`, `DeviceQuotaMappingContext.tsx` together.
8. **`no-effect-event-handler`** (×9) — move logic to handlers.
9. **`rendering-usetransition-loading`** (×4) — easy `useTransition` swap.

### P3 — Cosmetic codemod (1 PR, ~0.5 day)

10. **`design-no-redundant-size-axes`** (×540) — single regex codemod `w-N h-N` → `size-N` over `*.tsx`.
11. **`design-no-space-on-flex-children`** (×41) and other minor design rules — same PR if scope allows.

### P4 — Dead code cleanup (1 PR, ~0.5 day)

12. **`knip/exports`** (×125), **`knip/types`** (×89), **`knip/files`** (×8) — verify each isn't a typecheck assertion still referenced by a `tsconfig` "test" project; then delete in batches.

### P5 — A11y batch (1 PR, ~0.5 day)

13. All 18 `jsx-a11y/*` issues — convert clickable `<div>` to `<button>`, add `role` + key handlers, fix labels in `handover-template.tsx`.

### P6 — Maintainability (separate planned work)

14. **`no-giant-component`** (×11) — refactor 11 large components incrementally; not a single PR.

### P7 — React 19 readiness (defer until React 19 bump)

15. **`no-react19-deprecated-apis`** (×90) + **`react-compiler-destructure-method`** (×16). Foundational `ui/*` and `test-utils/tooltip-mock.tsx`. Plan separately.

### P8 — Design system polish (optional, separate)

16. **`design-no-default-tailwind-palette`** (×152) and remaining `design-*` rules — alongside any design-system audit.

---

## Notes & Caveats

- **Score interpretation:** the score is heavily dragged down by 692 cosmetic Tailwind findings. Fixing P0–P3 should move the score above 80 without touching React 19 surface area.
- **`react-doctor.config.json` ignores** are already in place for generated/typecheck files; we did **not** modify the config (verified clean working tree).
- **Diff vs full:** `npm run n:lint`, `verify:no-explicit-any`, and the standard react-doctor wrapper all run **diff-aware**. This report represents the **whole-repo baseline** and will not match the next branch-diff run.
- **Telemetry:** disabled (`--offline`); no data left the local machine.
- **Reproducibility:** tool version pinned in this report (`0.1.6`); rule weights and counts may shift on tool upgrades.

---

## Artifacts (local, not committed)

- Cleaned scan log: `/tmp/rd-clean.log`
- Raw scan log: `/tmp/rd-fullscan.log`
- React Doctor diagnostics dump: `/tmp/react-doctor-ceccbc33-f5a9-4ae5-be8f-f23125a6c03f`

These are ephemeral; re-run the scan command above to regenerate.
