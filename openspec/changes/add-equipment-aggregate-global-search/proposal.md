# Add Equipment Aggregate Global Search

## Why

Admin/global and regional leader users need a fast way to answer "where are matching devices located?" without opening each facility's equipment list. The current equipment search is list-oriented and facility-oriented, so it does not support cross-region comparison or aggregate discovery.

This change adds a role-scoped equipment aggregate search experience: users submit a keyword from the app header, view counts grouped by region or facility, inspect an interactive bar chart, and see each facility's quota status for the matching equipment. The feature remains a statistics and lookup surface; device-level detail stays in the existing equipment page.

## What Changes

- Add a header global equipment search entry point for `admin`/`global` and `regional_leader` users.
- Add a dedicated `/global-search` workspace that supports repeated submit-based searches through the page search box and URL query state.
- Add an equipment aggregate search RPC/API contract that returns grouped counts, not device rows.
- Include quota context for each facility result using the existing equipment group and device quota data.
- Match equipment by equipment name, model, serial, and equipment group/category.
- Exclude internal facility-defined equipment codes from matching.
- Scope results by role:
  - `admin`/`global`: all accessible regions and facilities.
  - `regional_leader`: only facilities in assigned region/scope.
  - other roles: no header entry point and no page access.
- Present admin/global results first by region, then drill down to facilities within a selected region.
- Present regional leader results by facility when the user has a single region scope; use region grouping only when their scope spans multiple regions.
- Render an interactive horizontal bar chart and a table from the same aggregate data.
- Keep the facility row centered on the actual matching equipment count; quota display and status are supplementary.
- Use deep-links into the existing equipment page for read-only detail inspection instead of rendering device rows in global search.

## Non-Goals

- No autocomplete or live suggestions in v1.
- No status, category, region, facility, or date filters beyond keyword and role scope.
- No device-detail list inside global search.
- No multi-entity search across repairs, transfers, maintenance, or users.
- No export, trend, or historical comparison.
- No editing, assigning equipment to quota categories, or managing quota decisions from global search.

## Impact

- Affected specs:
  - `equipment-aggregate-search` (new)
- Affected database/API areas:
  - New Supabase RPC for grouped equipment counts and quota context, likely exposed through `/api/rpc/[fn]`.
  - Equipment search SQL over `thiet_bi`, facility (`don_vi`), region (`dia_ban`), equipment group/category (`nhom_thiet_bi`), quota decisions (`quyet_dinh_dinh_muc`), and quota details (`chi_tiet_dinh_muc`).
  - Role guard logic must preserve `admin` -> `global` normalization outside the RPC proxy where applicable.
- Affected frontend areas:
  - App header/navigation search entry point.
  - New `/global-search` route/page.
  - Global search hook/client data layer.
  - Chart/table components using existing Recharts dependency, with quota limit markers or labels where available.
  - Equipment page route-sync/deep-link handling for `search`, `region`, and `facility` query params if not already supported.
- Security:
  - RPC must validate JWT claims and enforce region/facility scope server-side.
  - Regional leader scope must be derived from allowed facilities/regions, not trusted from client params.
  - Other roles must not receive aggregate counts outside their facility.
- Performance:
  - Search must aggregate equipment counts and quota context in SQL with pagination/limits on groups where needed.
  - Query should avoid returning device rows to the client.
  - Search predicates should use existing indexes where possible and add targeted indexes only after inspecting live schema/query plans.

## Relationship To Existing Proposals

`openspec/changes/add-vietnamese-global-search` is an older active proposal for cross-entity, full-text, list-style global search. This proposal is intentionally narrower and different: equipment-only, aggregate-first, chart-oriented, and deep-linking to the existing equipment list for details.
