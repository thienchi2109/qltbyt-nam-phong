# Equipment Aggregate Global Search Specification Delta

## ADDED Requirements

### Requirement: Header Aggregate Search Entry

The system SHALL provide a header search entry point for aggregate equipment search to users with `admin`, `global`, or `regional_leader` roles.

#### Scenario: Elevated user sees header search

- **WHEN** a user with role `admin`, `global`, or `regional_leader` views the authenticated app shell
- **THEN** the header shows a compact aggregate equipment search input

#### Scenario: Unsupported role does not see header search

- **WHEN** a user with role other than `admin`, `global`, or `regional_leader` views the authenticated app shell
- **THEN** the header does not show the aggregate equipment search input

#### Scenario: Header submit opens search workspace

- **WHEN** an allowed user submits a non-empty keyword with Enter or the search button
- **THEN** the system URL-encodes the keyword and navigates to `/reports?tab=equipment-search&q=<encodedKeyword>`

#### Scenario: Header does not autocomplete

- **WHEN** an allowed user types in the header search input
- **THEN** the system does not show autocomplete, suggestions, or live result previews in v1

### Requirement: Reports Equipment Search Tab

The system SHALL provide a dedicated equipment search tab inside the existing Reports page for repeated aggregate equipment searches.

#### Scenario: Initial query from URL

- **WHEN** a user opens `/reports?tab=equipment-search&q=May%20X-quang`
- **THEN** the Reports page activates the `Tìm kiếm thiết bị` tab
- **AND** the tab search input is populated with `May X-quang`
- **AND** aggregate results are loaded for that keyword within the user's role scope

#### Scenario: Repeated search in Reports tab

- **WHEN** a user submits a new keyword from the Reports equipment search tab
- **THEN** the page updates the URL query with `tab=equipment-search` and the encoded keyword
- **AND** refreshes the chart and table in place without returning to the previous page

#### Scenario: Empty Reports tab query

- **WHEN** the Reports equipment search tab has no non-empty keyword
- **THEN** the page prompts the user to enter a keyword
- **AND** does not execute aggregate search

### Requirement: Equipment Match Fields

The system SHALL match aggregate equipment search keywords against equipment name, model, serial, and equipment group/category fields.

#### Scenario: Match equipment name

- **WHEN** an allowed user searches for `May X-quang`
- **THEN** equipment whose name matches `May X-quang` contributes to aggregate counts

#### Scenario: Match model

- **WHEN** an allowed user searches for a model value
- **THEN** equipment whose model matches the keyword contributes to aggregate counts

#### Scenario: Match serial

- **WHEN** an allowed user searches for a serial value
- **THEN** equipment whose serial matches the keyword contributes to aggregate counts

#### Scenario: Match equipment group

- **WHEN** an allowed user searches for an equipment group/category name
- **THEN** equipment in matching groups/categories contributes to aggregate counts

#### Scenario: Exclude internal equipment code

- **WHEN** an allowed user searches for a facility-defined internal equipment code
- **THEN** the internal code field is not used as a search predicate

### Requirement: Role-Scoped Aggregate Authorization

The system SHALL enforce role-based scope for aggregate equipment search on the server side.

#### Scenario: Admin alias has global scope

- **WHEN** a user with legacy role `admin` performs aggregate equipment search
- **THEN** the system treats the user as global for this feature

#### Scenario: Global user sees all regions

- **WHEN** a user with role `global` searches without a selected drill-down region
- **THEN** results include matching equipment from all regions and facilities

#### Scenario: Regional leader sees assigned scope only

- **WHEN** a user with role `regional_leader` searches
- **THEN** results include only matching equipment from regions/facilities assigned to that user

#### Scenario: Other roles are rejected

- **WHEN** a user with an unsupported role opens or calls aggregate equipment search
- **THEN** the system denies access and returns no aggregate counts

#### Scenario: Client region parameter does not expand scope

- **WHEN** a regional leader submits a region or facility parameter outside their allowed scope
- **THEN** the system rejects or ignores the unauthorized scope server-side

### Requirement: Admin Region-First Aggregation

The system SHALL show admin/global users aggregate search results grouped by region before facility-level drill-down.

#### Scenario: Region-level results

- **WHEN** an admin/global user searches for a keyword
- **THEN** the first result level groups matching equipment counts by region

#### Scenario: Region drill-down

- **WHEN** an admin/global user selects a region result
- **THEN** the workspace shows matching equipment counts grouped by facility within that region

#### Scenario: Breadcrumb returns to all regions

- **WHEN** an admin/global user is viewing facility results for a selected region
- **THEN** the breadcrumb allows returning to the all-regions view for the same keyword

### Requirement: Regional Leader Facility Aggregation

The system SHALL optimize regional leader results for their assigned scope.

#### Scenario: Single-region leader opens facility level

- **WHEN** a regional leader assigned to one region searches
- **THEN** the workspace shows matching equipment counts grouped by facility in that region

#### Scenario: Multi-region leader opens region level

- **WHEN** a regional leader assigned to multiple regions searches
- **THEN** the workspace first groups matching equipment counts by the allowed regions

### Requirement: Aggregate Chart And Table

The system SHALL render aggregate equipment search results as both an interactive horizontal bar chart and a table using the same data source.

#### Scenario: Chart shows sorted bars

- **WHEN** aggregate results are loaded
- **THEN** the chart displays horizontal bars sorted by matching equipment count descending

#### Scenario: Table mirrors chart

- **WHEN** aggregate results are loaded
- **THEN** the table shows the same region or facility groups and counts as the chart
- **AND** facility-level rows show the matching equipment count as the primary value

#### Scenario: Chart drill-down interaction

- **WHEN** a user clicks a region bar at region level
- **THEN** the Reports equipment search tab drills down to facility-level results for that region

#### Scenario: Small result state

- **WHEN** a keyword matches equipment in only one facility
- **THEN** the workspace still shows the aggregate row and provides a prominent detail deep-link

#### Scenario: Empty result state

- **WHEN** no equipment matches the keyword within the user's allowed scope
- **THEN** the workspace displays an empty state instead of an empty chart

### Requirement: Facility Quota Context

The system SHALL include quota context in facility-level aggregate search results without replacing the matching equipment count.

#### Scenario: Facility row shows count and quota

- **WHEN** a facility has matching equipment with quota data
- **THEN** the facility row displays the matching equipment count
- **AND** displays quota context in the form `<current>/<maximum>` or `<current>/<minimum>-<maximum>` when a minimum applies

#### Scenario: Count remains primary

- **WHEN** quota context is displayed for a facility
- **THEN** the matching equipment count remains visible as its own primary column
- **AND** quota context is displayed as supplementary information

#### Scenario: Within quota limit wording

- **WHEN** the matching equipment count is within the configured quota range
- **THEN** the user-facing status is `Trong giới hạn định mức`

#### Scenario: Below minimum wording

- **WHEN** the matching equipment count is lower than the configured minimum
- **THEN** the user-facing status is `Dưới mức tối thiểu`

#### Scenario: Over limit wording

- **WHEN** the matching equipment count is higher than the configured maximum
- **THEN** the user-facing status is `Vượt giới hạn định mức`

#### Scenario: No active quota decision

- **WHEN** a facility has matching equipment but no active quota decision
- **THEN** the quota column displays no ratio
- **AND** the user-facing status is `Chưa có định mức`

#### Scenario: Unassigned equipment category

- **WHEN** matching equipment has no assigned equipment quota category
- **THEN** those devices are included in the matching equipment count
- **AND** the row clearly shows `Chưa gán danh mục định mức`

#### Scenario: Group not in unit quota

- **WHEN** matching equipment is assigned to an equipment group that is not present in the unit's active quota decision
- **THEN** those devices are included in the matching equipment count
- **AND** the row clearly shows `Chưa được gán vào định mức của đơn vị`

#### Scenario: Multiple quota groups matched

- **WHEN** one facility has matching equipment across multiple quota groups
- **THEN** the facility row may aggregate current count and maximum quota across those groups
- **AND** the row clearly shows `Gồm nhiều nhóm định mức`

### Requirement: Read-Only Quota Overlay

The system SHALL present quota information in the Reports equipment search tab as read-only context for management lookup.

#### Scenario: No quota editing actions

- **WHEN** a facility row has missing quota assignment, missing active quota, or over-limit status
- **THEN** the Reports equipment search tab does not show actions to assign equipment categories, edit quota decisions, or otherwise fix unit data

#### Scenario: Existing equipment detail link only

- **WHEN** a user chooses to inspect matching equipment
- **THEN** the Reports equipment search tab links only to the existing equipment page with the relevant keyword and region/facility context

### Requirement: Equipment Detail Deep Links

The system SHALL link aggregate search results to the existing equipment page for device-level detail inspection.

#### Scenario: Region deep-link

- **WHEN** a user chooses to view equipment for a region aggregate result
- **THEN** the system links to the equipment page with the current keyword and region parameter

#### Scenario: Facility deep-link

- **WHEN** a user chooses to view equipment for a facility aggregate result
- **THEN** the system links to the equipment page with the current keyword and facility parameter

#### Scenario: No device rows in Reports equipment search tab

- **WHEN** aggregate search results are shown
- **THEN** the Reports equipment search tab does not render a device-detail list

### Requirement: Aggregate Search Summary

The system SHALL display a concise summary of aggregate equipment search results.

#### Scenario: Summary counts

- **WHEN** aggregate results are loaded
- **THEN** the page displays total matching equipment count, number of matching regions, and number of matching facilities within scope
- **AND** does not replace facility-level equipment counts with quota ratios

#### Scenario: Scope badge

- **WHEN** aggregate search results are displayed
- **THEN** the page displays a scope badge describing whether results are global or region-scoped

### Requirement: Aggregate Search Performance

The system SHALL compute aggregate search results in server-side SQL using deterministic keyword predicates and shall not use vector search in v1.

#### Scenario: Aggregated RPC response

- **WHEN** the client requests aggregate search results
- **THEN** the server returns grouped counts, quota context, and summary metadata
- **AND** does not return individual equipment records

#### Scenario: Query stays server-side

- **WHEN** a keyword matches many equipment records
- **THEN** aggregation happens in SQL/server-side logic before the response is sent to the browser

#### Scenario: Deterministic keyword search

- **WHEN** the aggregate search RPC evaluates a keyword
- **THEN** it uses sanitized SQL keyword predicates over the approved match fields
- **AND** does not depend on vector embeddings, semantic ranking, autocomplete, or client-side search

#### Scenario: Scope applied before aggregation

- **WHEN** the aggregate search RPC computes counts for a global or regional leader user
- **THEN** role scope and soft-delete filters are applied before grouped counts are returned
- **AND** the browser cannot expand scope by filtering returned equipment rows

#### Scenario: Index changes require query-plan evidence

- **WHEN** implementation proposes a new search or join index for aggregate search
- **THEN** the implementation first captures representative `EXPLAIN (FORMAT JSON)` plans for `region` and `facility` grouping
- **AND** documents why existing trigram, FTS, facility, region, and quota indexes are insufficient
