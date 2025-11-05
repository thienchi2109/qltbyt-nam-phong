## Why
The Transfers page currently uses a Dialog-based filter modal on all screen sizes. For consistency with Equipment and Repair Requests pages, and to improve mobile UX, advanced filters should present as a bottom sheet on mobile/tablet devices and remain as a dialog on desktop.

## What Changes
- Update Transfers page to use responsive filter variant: bottom sheet on mobile/tablet, dialog on desktop
- Leverage existing `variant` prop in `FilterModal` component (which already supports both "dialog" and "sheet")
- Maintain all existing filter functionality: status multi-select, date range, filter chips, and persistence
- Keep facility filter in toolbar for global/regional roles (no changes to facility filter placement)

## Impact
- Affected specs: `transfers` (UI filtering behavior)
- Affected code:
  - `src/app/(app)/transfers/page.tsx` - add responsive variant detection and pass to FilterModal
  - `src/components/transfers/FilterModal.tsx` - already supports both variants, no changes needed
- No backend/API changes
- No database migration required
- No breaking changes
