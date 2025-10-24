## Why
Status dropdown filters and advanced filters conflicted in the Repair Requests page, leading to duplicated state and UX confusion. We should keep a single source of truth: advanced filters. On mobile/tablet, they should present as a bottom sheet.

## What Changes
- Remove inline Status filter (desktop and mobile dropdown) and unify on advanced filters.
- Convert advanced filters to Dialog on desktop and Bottom Sheet on mobile/tablet.
- Keep chips and persistence behavior; keep facility filter for permitted roles.

## Impact
- src/app/(app)/repair-requests/page.tsx: remove DataTableFacetedFilter + MobileFiltersDropdown blocks; wire FilterModal variant
- src/app/(app)/repair-requests/_components/FilterModal.tsx: add sheet variant
- No backend changes.