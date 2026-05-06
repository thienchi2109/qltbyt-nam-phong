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

## Assumptions

- First rollout does not migrate Transfers, Repair Requests, Maintenance, Reports, or Device Quota.
- Internal option-search is only for filtering already-loaded dropdown options in v1.
- Server-side/async option search is explicitly out of scope for v1.
- Combobox/Command remains out of scope.
- No SQL/RPC/API changes in this batch.
