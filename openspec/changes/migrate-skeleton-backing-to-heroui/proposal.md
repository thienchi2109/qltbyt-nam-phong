# Migrate Skeleton Backing to HeroUI

## Why

The gradual shadcn-to-HeroUI rollout needs a next step with lower behavioral
risk than the deferred TanStack Table migration. The shared
`@/components/ui/skeleton` primitive is a strong compatibility migration
candidate: its 18-line implementation serves 49 production consumers and 171
standalone placeholder instances without owning application state, events,
overlays, forms, or data-fetching behavior.

HeroUI v3 supports the same standalone Skeleton usage with `className`-driven
dimensions. Replacing the backing implementation while preserving the existing
local import path can migrate a high-fan-out surface without editing feature
consumers.

## What Changes

- Replace the internal backing of `@/components/ui/skeleton` with HeroUI
  Skeleton while preserving the existing local component name and import path.
- Preserve current `HTMLAttributes<HTMLDivElement>` compatibility, including
  `className`, inline `style`, `data-*`, and `aria-*` pass-through.
- Preserve the current default `animate-pulse rounded-md bg-muted` visual
  contract unless equivalent computed behavior is proven in compatibility
  tests.
- Add focused compatibility tests before changing the implementation.
- Add `src/components/ui/skeleton.tsx` to the approved HeroUI import boundary
  while keeping direct feature-level HeroUI Skeleton imports disallowed.
- Capture representative visual and route-level CSS/bundle evidence before
  approving follow-up primitive migrations.
- Keep TanStack Table and the broader `AppDataTable` proposal deferred.
- Keep Separator, Avatar, and Progress migrations outside this change; they may
  become independent follow-up proposals after this migration passes.

## Impact

- Affected specs: `frontend-design-system`
- Primary code:
  - `src/components/ui/skeleton.tsx`
  - `scripts/check-heroui-import-boundary.js`
  - `scripts/__tests__/check-heroui-import-boundary.test.ts`
  - focused Skeleton compatibility tests
- Existing feature consumers: 49 production files using 171 Skeleton
  instances; their imports and behavior remain unchanged.
- Dependencies: no new package is required because `@heroui/react` is already
  installed.
- Data, API, authentication, database, TanStack Table, and business workflows
  are unaffected.
