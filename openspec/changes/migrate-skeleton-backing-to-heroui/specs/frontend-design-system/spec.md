## ADDED Requirements

### Requirement: HeroUI-Backed Skeleton Compatibility

The system SHALL render the application-owned
`@/components/ui/skeleton` primitive with HeroUI while preserving the existing
local import path and standalone placeholder contract.

#### Scenario: Existing consumer imports remain stable

- **GIVEN** feature code imports `Skeleton` from
  `@/components/ui/skeleton`
- **WHEN** the backing implementation migrates to HeroUI
- **THEN** the feature code continues using the same import path and component
  name without a consumer rewrite

#### Scenario: Placeholder dimensions remain stable

- **GIVEN** an existing Skeleton call site supplies width, height, radius, or
  custom presentation through `className` or inline `style`
- **WHEN** the HeroUI-backed Skeleton renders
- **THEN** those presentation props continue controlling the placeholder
  dimensions and shape with a root bounding-box difference no greater than 1
  CSS pixel from baseline

#### Scenario: DOM presentation props remain compatible

- **GIVEN** an existing Skeleton call site supplies `data-*`, `aria-*`, or other
  supported `HTMLAttributes<HTMLDivElement>`
- **WHEN** the HeroUI-backed Skeleton renders
- **THEN** those attributes remain present on the application-owned Skeleton
  root without a consumer rewrite

#### Scenario: Default visual contract remains stable

- **GIVEN** a Skeleton call site does not override animation, radius, or
  background classes
- **WHEN** the HeroUI-backed Skeleton renders
- **THEN** its effective behavior remains equivalent to
  `animate-pulse rounded-md bg-muted`

#### Scenario: Skeleton remains a standalone placeholder

- **GIVEN** existing loading code conditionally renders a self-contained
  Skeleton without children or local loading state
- **WHEN** the backing implementation migrates
- **THEN** the Skeleton renders without requiring an `isLoaded` prop, children,
  or a new feature-level state contract

### Requirement: Skeleton HeroUI Import Boundary

The system SHALL allow direct HeroUI Skeleton imports only inside the
application-owned Skeleton implementation.

#### Scenario: Local primitive implementation is allowed

- **GIVEN** `src/components/ui/skeleton.tsx` implements the shared Skeleton
- **WHEN** the HeroUI import-boundary check runs
- **THEN** its direct HeroUI import is accepted

#### Scenario: Feature-level imports remain rejected

- **GIVEN** an arbitrary feature file imports HeroUI Skeleton directly
- **WHEN** the HeroUI import-boundary check runs
- **THEN** the check fails and directs the feature to use
  `@/components/ui/skeleton`

### Requirement: Measured Skeleton Adoption Gate

The system SHALL require test, visual, and bundle evidence before the
HeroUI-backed Skeleton migration is accepted or used to justify further
primitive migrations.

#### Scenario: Compatibility evidence passes

- **GIVEN** the local Skeleton backing has changed
- **WHEN** focused tests and required TypeScript/React gates pass,
  `/equipment`, `/reports`, and `/maintenance` loading screenshots at 1440x900
  and 390x844 preserve Skeleton root bounds within 1 CSS pixel, and two clean
  main plus two clean migration builds are reviewed
- **THEN** for each route First Load JavaScript metric and total emitted CSS
  gzip, `effectiveIncrease` calculated as
  `max(0, max(migration builds) - max(main builds) - abs(main build 2 - main build 1))`
  is no greater than the larger of 5 kB gzip or 2% of the larger main
  measurement

#### Scenario: Compatibility evidence fails

- **GIVEN** the HeroUI-backed Skeleton violates the DOM/default visual contract,
  exceeds the 1 CSS pixel layout tolerance, leaks the import boundary, or
  exceeds the defined bundle gate
- **WHEN** verification is completed
- **THEN** the migration is rolled back or deferred without changing feature
  consumers unless the maintainer explicitly approves the measured exception

### Requirement: Stateful Table Migration Deferral

The system SHALL keep TanStack Table and the proposed shared `AppDataTable`
migration outside the Skeleton migration scope.

#### Scenario: Skeleton work remains behaviorally bounded

- **GIVEN** table routes currently own server pagination, sorting, filtering,
  selection, bulk actions, or overlay workflows
- **WHEN** the Skeleton migration is implemented
- **THEN** no TanStack Table, manual table renderer, table state, or table data
  flow is changed
