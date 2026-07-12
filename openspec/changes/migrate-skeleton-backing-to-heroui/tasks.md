# Implementation Tasks

## 1. Baseline and Contract

- [ ] 1.1 Re-run the Skeleton inventory and confirm the current production
      consumer and instance counts.
- [ ] 1.2 Record the current `src/components/ui/skeleton.tsx` public props and
      representative `className`, inline `style`, `data-*`, and `aria-*` usage.
- [ ] 1.3 Record the default `animate-pulse rounded-md bg-muted` visual contract.
- [ ] 1.4 Capture deterministic loading-state baseline screenshots at 1440x900
      and 390x844 for `/equipment`, `/reports`, and `/maintenance`; use request
      interception or fixtures if necessary.
- [ ] 1.5 Add an isolated `FormBrandingHeader` baseline for inline
      `style`-driven Skeleton dimensions.
- [ ] 1.6 Run two clean `origin/main` builds and record, for `/equipment`,
      `/reports`, and `/maintenance`, each First Load JavaScript value plus total
      emitted CSS gzip.
- [ ] 1.7 For each metric, calculate `baselineValue` as the larger main
      measurement and `baselineNoise` as the absolute difference between the two
      main measurements.

## 2. Test-First Compatibility Guardrails

- [ ] 2.1 Add a focused local Skeleton contract test for standalone rendering
      and `className` pass-through.
- [ ] 2.2 Add inline `style`, `data-*`, and `aria-*` pass-through assertions.
- [ ] 2.3 Add default animation, radius, muted background, dimensions, and shape
      assertions without coupling tests to HeroUI implementation details.
- [ ] 2.4 Confirm all characterization tests pass against the current wrapper.
- [ ] 2.5 Add a positive HeroUI boundary test proving
      `src/components/ui/skeleton.tsx` is initially rejected.
- [ ] 2.6 Confirm the positive boundary test fails for the expected reason while
      existing negative boundary tests continue passing.

## 3. HeroUI Backing Migration

- [ ] 3.1 Replace the local Skeleton implementation with HeroUI Skeleton while
      preserving the existing export and import path.
- [ ] 3.2 Preserve `HTMLAttributes<HTMLDivElement>` compatibility, including
      `className`, inline `style`, `data-*`, and `aria-*`.
- [ ] 3.3 Preserve the effective default
      `animate-pulse rounded-md bg-muted` behavior.
- [ ] 3.4 Add only `src/components/ui/skeleton.tsx` to the HeroUI boundary
      allowlist.
- [ ] 3.5 Keep negative boundary coverage for arbitrary feature-level HeroUI
      Skeleton imports.
- [ ] 3.6 Confirm no production consumer file requires modification.

## 4. Verification

- [ ] 4.1 Run `node scripts/npm-run.js run format:check`.
- [ ] 4.2 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.3 Run `node scripts/npm-run.js run verify:dedupe`.
- [ ] 4.4 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.5 Run the focused Skeleton and HeroUI boundary tests.
- [ ] 4.6 Run representative existing tests that render Skeleton loading states.
- [ ] 4.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 4.8 Run two clean migration builds and record the same `/equipment`,
      `/reports`, `/maintenance`, and total CSS metrics.
- [ ] 4.9 Calculate `migrationValue` as the larger migration measurement and
      `effectiveIncrease` as
      `max(0, migrationValue - baselineValue - baselineNoise)`.
- [ ] 4.10 Require each route First Load JavaScript metric and total emitted CSS
      gzip `effectiveIncrease` to remain within the greater of 5 kB gzip or 2% of
      `baselineValue`; otherwise defer/rollback or obtain explicit maintainer
      approval.
- [ ] 4.11 Capture `/equipment`, `/reports`, and `/maintenance` loading-state
      after screenshots at 1440x900 and 390x844 with animation paused.
- [ ] 4.12 Confirm Skeleton root bounding boxes stay within 1 CSS pixel of the
      baseline and default animation, radius, and muted color remain equivalent.
- [ ] 4.13 Run `node scripts/npm-run.js run verify:heroui-boundary`.

## 5. Decision and Follow-Up

- [ ] 5.1 Record pass, defer, or rollback evidence in the change.
- [ ] 5.2 Record Separator, Avatar, and Progress as separate deferred candidates;
      do not create or implement their follow-ups in this change.
- [ ] 5.3 Keep `refactor-app-data-table-for-heroui` deferred; do not start a
      TanStack or `AppDataTable` implementation from this change.
