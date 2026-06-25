# Equipment Aggregate Global Search Specification Delta

## ADDED Requirements

### Requirement: Header Aggregate Search Entry

The system SHALL provide a header search entry point for equipment aggregate global search to users with `admin`, `global`, or `regional_leader` roles.

#### Scenario: Elevated user sees header search
- **WHEN** a user with role `admin`, `global`, or `regional_leader` views the authenticated app shell
- **THEN** the header shows a compact equipment global search input

#### Scenario: Unsupported role does not see header search
- **WHEN** a user with role other than `admin`, `global`, or `regional_leader` views the authenticated app shell
- **THEN** the header does not show the equipment global search input

#### Scenario: Header submit opens search workspace
- **WHEN** an allowed user submits a non-empty keyword with Enter or the search button
- **THEN** the system navigates to `/global-search?q=<keyword>`

#### Scenario: Header does not autocomplete
- **WHEN** an allowed user types in the header search input
- **THEN** the system does not show autocomplete, suggestions, or live result previews in v1

### Requirement: Search Workspace

The system SHALL provide a `/global-search` workspace for repeated aggregate equipment searches.

#### Scenario: Initial query from URL
- **WHEN** a user opens `/global-search?q=May%20X-quang`
- **THEN** the page search input is populated with `May X-quang`
- **AND** aggregate results are loaded for that keyword within the user's role scope

#### Scenario: Repeated search in workspace
- **WHEN** a user submits a new keyword from the search workspace
- **THEN** the page updates the URL query
- **AND** refreshes the chart and table in place without returning to the previous page

#### Scenario: Empty workspace query
- **WHEN** the search workspace has no non-empty keyword
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

#### Scenario: Chart drill-down interaction
- **WHEN** a user clicks a region bar at region level
- **THEN** the workspace drills down to facility-level results for that region

#### Scenario: Small result state
- **WHEN** a keyword matches equipment in only one facility
- **THEN** the workspace still shows the aggregate row and provides a prominent detail deep-link

#### Scenario: Empty result state
- **WHEN** no equipment matches the keyword within the user's allowed scope
- **THEN** the workspace displays an empty state instead of an empty chart

### Requirement: Equipment Detail Deep Links

The system SHALL link aggregate search results to the existing equipment page for device-level detail inspection.

#### Scenario: Region deep-link
- **WHEN** a user chooses to view equipment for a region aggregate result
- **THEN** the system links to the equipment page with the current keyword and region parameter

#### Scenario: Facility deep-link
- **WHEN** a user chooses to view equipment for a facility aggregate result
- **THEN** the system links to the equipment page with the current keyword and facility parameter

#### Scenario: No device rows in global search
- **WHEN** aggregate search results are shown
- **THEN** the global search workspace does not render a device-detail list

### Requirement: Aggregate Search Summary

The system SHALL display a concise summary of aggregate equipment search results.

#### Scenario: Summary counts
- **WHEN** aggregate results are loaded
- **THEN** the page displays total matching equipment count, number of matching regions, and number of matching facilities within scope

#### Scenario: Scope badge
- **WHEN** aggregate search results are displayed
- **THEN** the page displays a scope badge describing whether results are global or region-scoped

### Requirement: Aggregate Search Performance

The system SHALL compute aggregate search results without returning equipment rows to the client.

#### Scenario: Aggregated RPC response
- **WHEN** the client requests aggregate search results
- **THEN** the server returns grouped counts and summary metadata
- **AND** does not return individual equipment records

#### Scenario: Query stays server-side
- **WHEN** a keyword matches many equipment records
- **THEN** aggregation happens in SQL/server-side logic before the response is sent to the browser
