# Implementation Tasks

## 1. Baseline and Planning

- [ ] 1.1 Confirm current Tailwind, shadcn/Radix, and Equipments page dependency footprint.
- [ ] 1.2 Record baseline build, CSS, and route chunk metrics.
- [ ] 1.3 Capture baseline Equipments screenshots for desktop and mobile.
- [ ] 1.4 Identify the exact low-risk Equipments slice for the HeroUI pilot.
- [ ] 1.5 Define the import boundary for the pilot before adding HeroUI imports.

## 2. Tailwind v4 Compatibility Spike

- [ ] 2.1 Upgrade Tailwind CSS tooling in the spike branch.
- [ ] 2.2 Update PostCSS/global CSS setup for Tailwind v4.
- [ ] 2.3 Map existing CSS variables and theme tokens to the Tailwind v4 model.
- [ ] 2.4 Preserve dark mode behavior and existing visual defaults.
- [ ] 2.5 Run build/typecheck and capture Tailwind-related regressions.
- [ ] 2.6 Decide whether Tailwind v4 is stable enough to continue to HeroUI evaluation.

## 3. HeroUI Equipments Pilot

- [ ] 3.1 Add HeroUI dependencies only after Tailwind v4 compatibility is understood.
- [ ] 3.2 Import HeroUI styles in the required order.
- [ ] 3.3 Implement the pilot on the approved low-risk Equipments slice.
- [ ] 3.4 Keep data hooks, table selection, bulk delete, pagination, and detail/edit dialogs unchanged.
- [ ] 3.5 Prevent unbounded HeroUI imports outside the pilot boundary.
- [ ] 3.6 Document any API mismatches between HeroUI and current shadcn-style primitives.

## 4. Verification

- [ ] 4.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 4.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 4.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.5 Run focused Equipments tests or add them if the pilot changes behavior.
- [ ] 4.6 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 4.7 Compare before/after screenshots for the pilot surface.
- [ ] 4.8 Compare bundle/CSS metrics against baseline.

## 5. Decision and Follow-Up

- [ ] 5.1 Write a decision record: adopt, defer, or reject HeroUI.
- [ ] 5.2 Include measured bundle/CSS/test/visual results in the decision record.
- [ ] 5.3 If adopted, create follow-up issues for module-by-module migration.
- [ ] 5.4 If deferred or rejected, document the blocker and remove spike-only dependencies/code.
- [ ] 5.5 Do not start broad migration until a separate OpenSpec proposal is approved.
