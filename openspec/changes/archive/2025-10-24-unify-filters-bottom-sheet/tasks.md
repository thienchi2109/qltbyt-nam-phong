## 1. Implementation
- [x] Remove desktop/mobile Status filter UI (DataTableFacetedFilter and MobileFiltersDropdown usage)
- [x] Add `variant` prop to FilterModal and support Radix Sheet (bottom) for mobile/tablet
- [x] Wire FilterModal variant from page via `isMobile`
- [x] Keep chips behavior; Clear All resets status/date and search

## 2. Validation & QA
- [x] Only one filters entry point remains: "Bộ lọc" button
- [x] Desktop shows Dialog; mobile/tablet shows Bottom Sheet
- [x] Status/facility/date selections reflect in chips and persist across reloads
- [x] Clearing chips updates list and persistence
- [x] Typecheck passes