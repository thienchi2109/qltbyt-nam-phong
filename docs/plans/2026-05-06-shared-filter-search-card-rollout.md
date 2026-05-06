# Shared Filter/Search Card Rollout Plan

## Summary

- Rollout dau chi migrate **Equipment**.
- Tach UI thanh 2 card: **Filter/Search Card** phia tren va **Data Table Card** phia duoi.
- Giu nguyen logic hien tai: tenant scope, main search debounce/data query, multiple-choice filters, QR scan, create/import/export/options, pagination.

## Key Changes

- Create shared `ListFilterSearchCard` layout component:
  - title/description area
  - `tenantControl` slot dat truoc search
  - search area dung `SearchInput`
  - `filterControls`, `actions`, `selectionActions`, `chips`, clear/reset slots
  - desktop/tablet layout wrap gon, khong card long card
- Update `FacetedMultiSelectFilter`:
  - doi sang **Popover + input + checkbox list**, khong dung combobox/Command
  - dropdown rong hon de label dai it bi cat
  - input noi bo loc option **client-side only**
  - input noi bo debounce **300ms** truoc khi cap nhat danh sach option hien thi
  - khong goi API/RPC va khong goi `onChange` filter khi chi go search option
  - giu column mode va controlled mode hien tai
- Refactor Equipment:
  - title "Danh muc thiet bi" nam trong filter/search card
  - tenant selector label chuan la "Co so", nam truoc search
  - table/content/pagination chuyen sang card rieng phia duoi
  - QR scanner, add/import/export/options van la Equipment-owned slots, khong dua vao shared core

## FacetedMultiSelectFilter API Contract

- Keep existing required/behavioral props unchanged: `column`, `title`, `options`, `value`, `onChange`.
- Add optional props only:
  - `searchable?: boolean` defaults to `true`.
  - `searchPlaceholder?: string` defaults to `Tim lua chon...`.
  - `searchDebounceMs?: number` defaults to `300`.
  - `emptySearchMessage?: string` defaults to `Khong tim thay lua chon phu hop`.
  - `contentClassName?: string` for page-specific popover width tuning if needed.
- Existing call sites do not need prop changes in v1:
  - `src/components/equipment/equipment-toolbar.tsx`
  - `src/components/add-tasks-dialog.tsx`
  - `src/app/(app)/device-quota/mapping/_components/DeviceQuotaUnassignedList.tsx`
- Do not introduce async/server-side option loading in this component for v1.

## Impact List

- `EquipmentToolbar`: visual behavior changes from dropdown menu to popover for desktop filter controls; mobile/tablet still routes multiple-choice filters through the existing bottom sheet.
- `add-tasks-dialog`: shared filter controls inherit the new popover/searchable behavior without call site changes.
- `DeviceQuotaUnassignedList`: shared filter controls inherit the new popover/searchable behavior without call site changes.
- Update tests/mocks that assume Radix `DropdownMenu` filter internals:
  - `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
  - `src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`
  - `src/app/(app)/device-quota/mapping/__tests__/DeviceQuotaUnassignedList.test.tsx`

## A11y Spec

- Trigger remains a `button` with `aria-haspopup="dialog"` or popover-equivalent semantics and visible selected-count badge.
- Internal option-search is a real `input type="search"` with an accessible label/placeholder and does not mutate filter selection while typing.
- Options render as `button` rows with checkbox-style visual state and `aria-pressed`, or as native checkbox inputs if implementation stays visually consistent; do not use combobox/listbox `role=option` semantics in v1.
- On popover open, focus moves to the internal search input when searchable; otherwise focus moves to the first option.
- `Escape` closes the popover and returns focus to the trigger.
- `ArrowDown` from the search input moves focus to the first visible option after the debounced visible list is available.

## Mobile Behavior

- Mobile hien thi truc tiep trong filter/search card:
  - tenant selector
  - search input
  - nut "Bo loc" mo bottom sheet
- Multiple-choice filters van dung bottom sheet tren mobile/tablet, giu logic hien tai.
- "Them thiet bi" giu dang FAB nhu hien tai.
- "Tuy chon"/export nam trong menu gon, khong chen ngang search/filter tren mobile.
- Khong hien thi "Tim kiem nang cao" o v1.

## Test Plan

- Add/update tests for:
  - `ListFilterSearchCard` renders tenant before search and supports slots.
  - Mobile mode shows tenant/search/filter button instead of desktop filter dropdown row.
  - `FacetedMultiSelectFilter` renders internal option-search input when popover opens.
  - Typing into internal option-search does **not** call controlled `onChange` or `column.setFilterValue`.
  - Before 300ms debounce, option list remains unchanged.
  - After 300ms debounce, visible options are filtered client-side by typed text.
  - No-match search shows "Khong tim thay lua chon phu hop".
  - Selected option state is preserved even when current search text hides that option.
  - Equipment renders filter/search card above data table card and preserves existing handler wiring.
- Verification:
  - `node scripts/npm-run.js run verify:no-explicit-any`
  - `node scripts/npm-run.js run typecheck`
  - focused Vitest for shared filter + Equipment page/toolbar tests
  - `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`

## Acceptance, Risk, and Rollback

- Acceptance: typing into option-search makes no API/RPC call and does not invoke filter `onChange`; verify with mocks/spies.
- Acceptance: selected values remain selected when current option-search text hides them.
- Acceptance: existing three consumers compile and keep the same call sites.
- Risk: replacing `DropdownMenu` with `Popover` can break tests that query menu roles or mock Radix primitives; update focused tests in the same PR.
- Risk: popover focus/keyboard behavior can regress accessibility; cover Escape and ArrowDown in tests.
- Rollback: revert the PR/commit; no DB migration, no RPC change, and no persisted data shape change.
- PR structure: prefer two PRs, (A) `ListFilterSearchCard` + Equipment card split and (B) `FacetedMultiSelectFilter` popover/search. If shipped in one PR, use separate commits per concern to allow easy revert.

## Assumptions

- First rollout does not migrate Transfers, Repair Requests, Maintenance, Reports, or Device Quota.
- Internal option-search is only for filtering already-loaded dropdown options in v1.
- Server-side/async option search is explicitly out of scope for v1.
- Combobox/Command remains out of scope.
- No SQL/RPC/API changes in this batch.
