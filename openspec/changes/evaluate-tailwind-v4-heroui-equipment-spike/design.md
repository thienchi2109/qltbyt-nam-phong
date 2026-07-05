# Design: Tailwind v4 and HeroUI Equipment Spike

## Context

The current frontend stack is Next.js 15, React 18, Tailwind CSS v3.4, Radix-based shadcn-style primitives, and local UI components under `src/components/ui/*`. A repository scan before this proposal found:

- `@/components/ui/*` imports in about 235 source files.
- 43 local UI primitive files under `src/components/ui`.
- High-use primitives include `button`, `card`, `badge`, `skeleton`, `input`, and `dialog`.
- Existing global styling depends on Tailwind v3 directives, CSS variables such as `--background`, `--primary`, `--radius`, dark mode variables, and custom utility layers.

Context7 documentation for HeroUI indicates that current HeroUI React guidance is Tailwind CSS v4-native, uses HeroUI styles imported after Tailwind, relies on CSS variables and Tailwind `@theme` mappings for theming, and uses React Aria-based compound components. That makes the proposal a combined Tailwind v4 compatibility and HeroUI feasibility question, not a simple component import swap.

## Goals

- Verify whether Tailwind CSS v4 can support the current theme tokens, dark mode, and utility conventions without broad visual regressions.
- Pilot HeroUI on a small Equipments page slice that is representative enough to evaluate DX and runtime cost.
- Keep the spike reversible and isolated.
- Produce an adoption decision with evidence: adopt, defer, or reject.
- Define follow-up work only after the spike has measurable results.

## Non-Goals

- Do not migrate the entire app to HeroUI.
- Do not replace all shadcn/Radix primitives.
- Do not rewrite high-risk Equipments behavior such as row selection, bulk delete, data fetching hooks, server pagination, or detail/edit dialogs.
- Do not introduce a permanent second component library without an import-boundary rule and measured benefit.

## Proposed Approach

Use a balanced feasibility spike with two sequential tracks.

### Track 1: Tailwind v4 Compatibility

Tailwind v4 is treated as the foundation work because HeroUI's current React guidance depends on it. The spike should:

- Capture Tailwind v3 baseline build output, CSS size, route behavior, and relevant screenshots.
- Attempt the Tailwind v4 migration in an isolated branch.
- Map existing shadcn-style CSS variables to Tailwind v4-compatible theme tokens.
- Preserve existing dark mode and core visual language where possible.
- Stop and document blockers if Tailwind v4 breaks broad UI behavior or requires a large redesign.

### Track 2: HeroUI Equipments Pilot

HeroUI should be introduced only after the Tailwind v4 track is stable enough to evaluate component behavior. The pilot should target a low-risk Equipments slice, such as:

- Toolbar shell controls.
- Status badges or simple action buttons.
- Empty and loading states.
- Small card/skeleton fragments that do not own data or selection state.

The pilot must avoid:

- Bulk delete flow.
- Table row selection and keyboard behavior.
- Equipment detail/edit dialog behavior.
- Server pagination and data hooks.
- Shared `src/components/ui/*` rewrites beyond a thin wrapper needed for the pilot.

## Import Boundary

HeroUI imports should not appear broadly in feature code during the spike. Prefer one of these patterns:

1. A pilot-only wrapper colocated with the Equipments pilot.
2. A temporary adapter under a clearly named experiment boundary.
3. A local component wrapper in `src/components/ui` only when the existing public API can remain stable.

The spike should document which boundary was used and whether it would scale if HeroUI is adopted.

## Balanced Pass / Fail Criteria

Pass if:

- Build, typecheck, focused tests, and React Doctor do not show new blocking regressions.
- CSS and bundle impact are small enough to justify, or the increase is explained by clear maintainability and accessibility benefits.
- Equipments UX remains at least as good as the current shadcn implementation.
- The pilot reduces or plausibly reduces maintenance cost for the tested component surface.
- The team has a clear rule for where HeroUI may be imported.

Defer or reject if:

- Tailwind v4 causes broad token/theme regressions.
- HeroUI needs substantial workarounds to match current behavior.
- Bundle or CSS growth is not proportional to the benefit.
- The Equipments pilot destabilizes core workflows.
- Developers would need to maintain two overlapping design systems without a clear boundary.

## Verification Strategy

- Run the repository TypeScript/React verification chain required for `.ts` and `.tsx` changes.
- Add focused regression tests if the pilot touches behavior, state, accessibility, or keyboard/focus interactions.
- Capture before/after screenshots for the affected Equipments slice.
- Compare build output and CSS/bundle size against baseline.
- Record the final result in a decision document before proposing any broader roadmap.

## Rollback Strategy

The spike must remain easy to revert. If Tailwind v4 or HeroUI fails the balanced gate, revert dependency/config/component changes and keep only the decision record and follow-up issue links.
