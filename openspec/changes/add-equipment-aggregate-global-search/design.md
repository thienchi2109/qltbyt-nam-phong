# Equipment Aggregate Global Search Design

## Context

The feature serves elevated users who need system-level visibility across facilities. The key user question is not "which exact rows match?" but "which regions or facilities have how many matching devices?"

The UI must avoid duplicating the equipment catalog. Global search is a summary and navigation layer; device-level operations remain in the existing equipment page.

## Goals

- Provide a header search entry point for elevated users.
- Support repeated keyword searches without leaving the result workspace.
- Show aggregate counts by region first for admin/global users.
- Drill from region aggregate to facility aggregate.
- Show regional leader users only their permitted scope.
- Visualize aggregate counts with an interactive horizontal bar chart.
- Deep-link to the existing equipment page for device-level inspection.

## Non-Goals

- Autocomplete, live search, or command-palette behavior.
- Device-detail rendering inside global search.
- Manual filter controls beyond keyword and role scope.
- Cross-entity search.
- Export or historical trend analysis.

## UX Flow

### Header Entry

The header shows a compact search input only for `admin`/`global` and `regional_leader`.

- Placeholder: `Tim thiet bi toan he thong...`
- Submit triggers only on Enter or the search button.
- Submit navigates to `/global-search?q=<keyword>`.
- Empty or whitespace-only submit does not navigate.

### Search Workspace

`/global-search` is the primary analysis workspace.

- It has a larger search input at the top.
- It reads the initial keyword from `q`.
- Submitting a new keyword updates URL query state and refreshes aggregate data in place.
- The page shows a scope badge:
  - `Toan he thong` for admin/global.
  - `Khu vuc: <region name>` for single-scope regional leaders.
  - `Pham vi duoc phan quyen` for multi-region scoped users.

### Admin/Global Result Hierarchy

Level 1 groups by region:

- Bar label: region name.
- Value: matching equipment count.
- Summary: total matching equipment, number of regions, number of facilities.
- Clicking a region drills into Level 2.

Level 2 groups by facility within the selected region:

- Breadcrumb: `Toan he thong / <Region>`.
- Bar label: facility name.
- Value: matching equipment count.
- Table action: `Xem thiet bi`.
- Clicking `Xem thiet bi` deep-links to the equipment page with keyword and selected facility/region params.

### Regional Leader Result Hierarchy

If the user has one region scope, the page opens directly at facility grouping.

If the user has multiple region scopes, the page uses the same region-first hierarchy as admin/global, but only for regions in the user's allowed scope.

### Empty and Small-Result States

- No matches: show `Khong co thiet bi phu hop trong pham vi cua ban`.
- One facility match: show the aggregate row and make `Xem thiet bi` prominent.
- Errors: show a retry affordance and avoid exposing raw database errors.

## Data Contract

The aggregate search RPC should return grouped rows, not equipment rows.

Suggested request:

```ts
type EquipmentAggregateSearchRequest = {
  query: string
  groupBy: "region" | "facility"
  regionId?: number | null
  limit?: number
}
```

Suggested response:

```ts
type EquipmentAggregateSearchRow = {
  groupType: "region" | "facility"
  groupId: number
  groupName: string
  parentRegionId: number | null
  parentRegionName: string | null
  equipmentCount: number
  facilityCount: number
}
```

Suggested summary:

```ts
type EquipmentAggregateSearchSummary = {
  totalEquipmentCount: number
  regionCount: number
  facilityCount: number
  query: string
  scopeLabel: string
}
```

## Search Semantics

The keyword matches:

- equipment name
- model
- serial
- equipment group/category

The keyword does not match:

- internal equipment code, because codes are facility-defined and not comparable across the system

Implementation may use accent-insensitive matching if the existing database helpers support it, but the v1 user contract is aggregate scope and field selection, not generalized full-text search.

## Authorization

The database function must validate JWT claims before aggregating.

- Treat `admin` as `global` where role checks happen outside the RPC proxy.
- Admin/global users may aggregate across all facilities.
- Regional leaders may aggregate only facilities allowed by their regional scope.
- Other roles must be rejected for this aggregate global search RPC/page.
- Client-supplied `regionId` is a drill-down hint, not an authority boundary.

## UI Components

- Header search entry component.
- Global search page shell.
- Search form.
- Scope/summary strip.
- Drill-down breadcrumb.
- Horizontal bar chart.
- Results table mirroring chart data.
- Empty/error/loading states.

Chart and table must use the same normalized data source to prevent count drift.

## Deep-Linking

The global search page does not render device rows. It deep-links into the existing equipment page:

- Region context: `/equipment?search=<q>&region=<regionId>`
- Facility context: `/equipment?search=<q>&facility=<facilityId>`

If the equipment page does not currently support one of these query params, implementation must add route-sync support there rather than building a duplicate detail list.

## Testing Strategy

- Unit-test query param parsing and role-based visibility helpers.
- Add RPC tests or SQL verification for admin/global, regional leader, and unauthorized roles.
- Add focused React tests for:
  - header submit navigation
  - search page submit updates URL
  - admin region-to-facility drill-down
  - regional leader facility-level default
  - deep-link action construction
- Run mandatory TypeScript/React gates for changed TS/TSX files.
