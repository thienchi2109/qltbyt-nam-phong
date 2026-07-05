# Evaluate Tailwind v4 and HeroUI Equipment Spike

## Why

The project currently uses shadcn-style local UI primitives on Tailwind CSS v3. HeroUI is a possible future UI library, but its current React direction is built around Tailwind CSS v4 and a separate React Aria-based component model. Moving directly from shadcn to HeroUI would be risky because `@/components/ui/*` is already widely used across the app.

This change proposes a feasibility spike before any broad migration decision. The spike will measure whether Tailwind CSS v4 and a small HeroUI pilot can fit the existing design system without making the Equipments workflow heavier, less stable, or harder to maintain.

## What Changes

- Add a formal feasibility spike for Tailwind CSS v4 compatibility.
- Add a small HeroUI pilot on the Equipments page after the Tailwind v4 compatibility work is understood.
- Keep shadcn-style `src/components/ui/*` as the default design-system API during the spike.
- Restrict HeroUI usage to a clearly bounded Equipments pilot surface.
- Measure bundle/CSS impact, visual regression risk, test stability, and developer experience before deciding whether to adopt, defer, or reject HeroUI.
- Produce a final decision record and follow-up roadmap only if the spike passes the balanced adoption gate.

## Impact

**Affected Specs:**

- `frontend-design-system` (NEW) - Tailwind v4 modernization and optional HeroUI evaluation rules.

**Affected Code:**

- `package.json`, `package-lock.json` - Possible Tailwind CSS v4 and HeroUI dependency changes during implementation.
- `postcss.config.mjs`, `tailwind.config.ts`, `src/app/globals.css` - Tailwind v4 compatibility and theme token changes during implementation.
- `src/app/(app)/equipment/**` - Bounded HeroUI pilot surface.
- `src/components/ui/**` - Wrapper/import-boundary work only if required for the pilot.

**Out of Scope:**

- Full shadcn-to-HeroUI migration.
- Broad rewrite of `src/components/ui/*`.
- Changes to equipment table selection, bulk delete, data hooks, server pagination, or equipment detail/edit dialogs.
- Unbounded HeroUI imports throughout feature code.

**Breaking Changes:**

- None intended. If Tailwind v4 compatibility requires breaking visual or component API changes, the spike must stop and document the blocker instead of continuing as a migration.
