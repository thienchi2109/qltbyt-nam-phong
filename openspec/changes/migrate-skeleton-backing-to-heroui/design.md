# Design: HeroUI-Backed Skeleton Compatibility Migration

## Context

The application has adopted React 19, Tailwind CSS v4, and HeroUI v3, then
rolled HeroUI into bounded Equipments, shared filter/search, floating-action,
and overlay surfaces. Recent overlay work showed that stateful migrations can
have a wide focus and workflow blast radius even when the visual replacement
appears small.

A fresh repository survey on 2026-07-12 found:

- 133 production consumers of the local Button primitive.
- 68 Card consumers.
- 62 Badge consumers with 98 variant-driven usages.
- 49 Skeleton consumers with 171 standalone instances.
- 51 production files importing TanStack Table directly.
- 8 separate `useReactTable` owners.
- 15 manual `@/components/ui/table` consumers.

Skeleton has the best current effort/risk/return profile. Its implementation is
18 lines, existing call sites use it as a standalone placeholder, and no call
site depends on Skeleton-owned interaction or state. HeroUI v3 also treats
Skeleton as a standalone placeholder and accepts `className` for dimensions.
The current local component accepts `HTMLAttributes<HTMLDivElement>`, and at
least one production consumer uses inline `style` for dynamic width and height.
Most consumers also rely on the wrapper's default
`animate-pulse rounded-md bg-muted` classes.

## Goals

- Migrate all existing Skeleton consumers through one stable local API.
- Preserve DOM presentation props, default animation/color/radius, dimensions,
  shape, layout participation, and loading semantics.
- Prove the compatibility-wrapper pattern with tests and visual evidence.
- Keep HeroUI imports centralized instead of spreading them to feature files.
- Establish evidence for selecting later low-risk primitive migrations.

## Non-Goals

- Do not migrate TanStack Table, `AppDataTable`, or manual table renderers.
- Do not migrate Button, Card, Badge, Alert, Tooltip, Tabs, ScrollArea, form
  controls, or overlay primitives.
- Do not rewrite Skeleton call sites or rename their imports.
- Do not combine Separator, Avatar, or Progress dependency retirement into this
  change.
- Do not change loading conditions, data fetching, Suspense boundaries, or
  page-level state.
- Do not redesign the product loading experience.

## Decisions

### Preserve the Local Public API

`@/components/ui/skeleton` remains the application-owned public API. Existing
feature code continues importing `Skeleton` from that path. HeroUI is an
implementation detail of the local primitive.

This avoids editing 49 production consumers and keeps rollback limited to the
primitive implementation.

### Use HeroUI Only as the Backing Renderer

The compatibility wrapper will render HeroUI Skeleton and pass through the
existing DOM presentation props required by current call sites. The public
contract remains compatible with `HTMLAttributes<HTMLDivElement>`, including
`className`, inline `style`, `data-*`, and `aria-*`.

The wrapper must also preserve the effective default
`animate-pulse rounded-md bg-muted` behavior. An implementation may use HeroUI
internals to produce that behavior, but it must not silently replace the
application's current animation, radius, or muted color contract.

The implementation must not introduce an `isLoaded` state contract or require
children because current consumers conditionally render standalone
placeholders.

### Expand the Import Boundary by One File

Only `src/components/ui/skeleton.tsx` becomes a newly approved direct HeroUI
import. Feature consumers remain prohibited from importing HeroUI Skeleton
directly. Boundary tests must prove both the allowance and the continuing
rejection of arbitrary feature imports.

### Defer Stateful and Broad Primitive Migrations

The TanStack/AppDataTable proposal remains deferred because table state is
distributed across server pagination, sorting, filtering, selection, bulk
actions, and overlay workflows.

Button, Card, and Badge also remain deferred despite high fan-out because their
variant, composition, and visual contracts are substantially broader than
Skeleton. Separator, Avatar, and Progress are possible independent follow-ups
because replacing them can retire one Radix dependency each, but they are not
required to validate this migration.

## Alternatives Considered

### Migrate TanStack Table Next

Rejected for the current rollout. The table migration combines renderer,
state-engine, pagination, selection, row-action, and accessibility decisions
across high-risk routes.

### Replace Skeleton Imports in Every Feature

Rejected because it creates unnecessary diff volume and weakens the local UI
boundary. A backing replacement achieves the same migration with fewer changed
files.

### Migrate Badge Instead

Deferred. Badge reaches more consumers, but 98 of 102 observed usages pass a
variant and several add custom status colors. Preserving that contract would
require a broader visual and variant adapter.

### Start With Separator, Avatar, or Progress

These are low-risk dependency-retirement candidates, but each has only two to
seven production consumers. Skeleton provides substantially higher reach while
remaining non-interactive.

## Risks and Mitigations

- **Risk: loading placeholders change size or cause layout shift.**
  Preserve both `className` and inline `style` dimensions, then compare root
  bounding boxes with a tolerance of 1 CSS pixel.
- **Risk: animation, color, or radius changes are visually inconsistent.**
  Assert the default animation, radius, and muted background contract and
  compare deterministic screenshots with animation paused.
- **Risk: HeroUI adds unexpected route-level CSS or JavaScript.**
  Compare two clean main builds to establish measurement noise. Defer or require
  explicit maintainer approval if representative-route First Load JavaScript or
  emitted CSS gzip increases beyond baseline noise by more than the greater of
  5 kB or 2%.
- **Risk: direct HeroUI imports spread after the migration.**
  Extend the boundary allowlist only for the local Skeleton implementation and
  retain negative boundary tests.
- **Risk: the wrapper exposes HeroUI-specific props and becomes difficult to
  replace.**
  Keep the public contract limited to behavior already used by local
  consumers.

## Verification Strategy

- Add characterization tests before implementation. They must pass against the
  current wrapper and prove:
  - standalone rendering;
  - `className` and inline `style` sizing;
  - `data-*` and `aria-*` pass-through;
  - default `animate-pulse rounded-md bg-muted` behavior.
- Add a positive boundary-allowance test that fails before the new file is
  allowed. Existing negative boundary tests must continue passing.
- Run the repository TypeScript/React verification chain.
- Run existing tests that render Skeleton in:
  - `AppLayoutShell`;
  - reports maintenance sections;
  - maintenance page loading/auth boundaries;
  - `FormBrandingHeader` with inline `style` dimensions.
- Capture loading-state screenshots at 1440x900 and 390x844 for `/equipment`,
  `/reports`, and `/maintenance`. If data resolves too quickly, use deterministic
  request interception or a test fixture rather than substituting another route.
  Use an isolated `FormBrandingHeader` harness for the dynamic-style case.
- Pause animation for deterministic screenshots. Confirm the migration does not
  add animation behavior beyond the current `animate-pulse` contract.
- Compare two clean `origin/main` builds with two clean migration builds. For
  each route metric and total emitted CSS gzip:
  - `baselineValue` is the larger of the two main measurements;
  - `baselineNoise` is the absolute difference between the two main
    measurements;
  - `migrationValue` is the larger of the two migration measurements;
  - `effectiveIncrease` is
    `max(0, migrationValue - baselineValue - baselineNoise)`.
- For `/equipment`, `/reports`, and `/maintenance`, First Load JavaScript and
  total emitted CSS gzip pass when `effectiveIncrease` is no greater than the
  larger of 5 kB gzip or 2% of `baselineValue`. Exceeding the gate requires
  defer/rollback or explicit maintainer approval.
- Confirm no production consumer file changed and no direct HeroUI Skeleton
  import was added outside the local primitive.

## Migration and Rollback

1. Capture baseline tests, screenshots, and route metrics.
2. Add characterization tests and confirm they pass against the current
   wrapper.
3. Add the positive boundary-allowance test and confirm it fails for the
   expected reason.
4. Replace only the local Skeleton backing and update the boundary allowlist.
5. Confirm characterization, positive boundary, and existing negative boundary
   tests all pass.
6. Run focused and repository-required verification.
7. Record pass, defer, or rollback evidence.

Rollback restores the previous implementation of
`src/components/ui/skeleton.tsx` and removes its boundary allowance. Feature
consumers require no rollback changes because their imports remain stable.

## Deferred Candidates

The survey also identified these independent candidates:

1. Separator, to retire `@radix-ui/react-separator`.
2. Avatar, to retire `@radix-ui/react-avatar`.
3. Progress, to retire `@radix-ui/react-progress` if the HeroUI compound API
   does not make the adapter more complex than the current implementation.

They remain outside this proposal. Completing this change does not require
creating issues, evaluating their implementations, or approving them.

## Table Reactivation Gate

Skeleton evidence does not validate table state or reactivate
`refactor-app-data-table-for-heroui`. Table work requires a separate maintainer
decision that:

1. selects one bounded route and renderer-only slice;
2. identifies the single source of truth for sorting, filtering, pagination,
   selection, and row actions;
3. adds route-specific behavior and accessibility tests before implementation;
4. excludes data fetching, mobile, bulk-action, and overlay changes from the
   first pilot;
5. defines route-level rollback independently of Skeleton.
