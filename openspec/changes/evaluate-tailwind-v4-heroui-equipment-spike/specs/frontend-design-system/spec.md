## ADDED Requirements

### Requirement: Tailwind v4 Compatibility Spike

The system SHALL evaluate Tailwind CSS v4 compatibility before any broad HeroUI adoption or shadcn replacement work begins.

#### Scenario: Tailwind v4 baseline is captured

- **GIVEN** the current app uses Tailwind CSS v3 and shadcn-style local UI primitives
- **WHEN** the spike starts
- **THEN** it records baseline build, CSS, visual, and Equipments route behavior before changing Tailwind tooling

#### Scenario: Tailwind v4 blocks the migration

- **GIVEN** Tailwind v4 causes broad theme, token, dark mode, or utility regressions
- **WHEN** those regressions cannot be fixed within the spike scope
- **THEN** the spike stops before HeroUI adoption and records the blocker

### Requirement: Bounded HeroUI Equipments Pilot

The system SHALL evaluate HeroUI through a small, bounded Equipments page pilot instead of replacing the app-wide shadcn-style UI system.

#### Scenario: Pilot stays within approved Equipments slice

- **GIVEN** the spike has selected a low-risk Equipments slice
- **WHEN** HeroUI components are introduced
- **THEN** the implementation only changes that slice and leaves bulk delete, table selection, pagination, data hooks, and detail/edit dialogs unchanged

#### Scenario: HeroUI usage remains isolated

- **GIVEN** HeroUI is added for the pilot
- **WHEN** feature code imports HeroUI
- **THEN** imports are limited to the agreed pilot boundary or wrapper layer and are not spread across unrelated modules

### Requirement: Balanced Adoption Gate

The system SHALL require measured evidence before adopting HeroUI beyond the Equipments pilot.

#### Scenario: Pilot passes balanced criteria

- **GIVEN** Tailwind v4 compatibility and the HeroUI pilot are complete
- **WHEN** build, typecheck, focused tests, visual review, and bundle/CSS comparison show acceptable results
- **THEN** the team may create a separate OpenSpec proposal for controlled HeroUI adoption

#### Scenario: Pilot fails balanced criteria

- **GIVEN** the pilot increases complexity, bundle/CSS size, or regression risk beyond the documented benefit
- **WHEN** the final decision record is written
- **THEN** HeroUI adoption is deferred or rejected and spike-only code/dependencies are removed unless explicitly retained for documentation

### Requirement: shadcn Public API Preservation

The system SHALL keep `src/components/ui/*` as the default design-system API during the spike.

#### Scenario: Existing feature code remains stable

- **GIVEN** existing pages import local UI primitives from `@/components/ui/*`
- **WHEN** Tailwind v4 and HeroUI are evaluated
- **THEN** the spike does not require broad import rewrites or app-wide primitive replacement
