## ADDED Requirements
### Requirement: Transfer Requests Data Grid
Transfer requests MUST be presented in a paginated data grid with server-driven filtering and counts.

#### Scenario: Filtered list loads from server
- **GIVEN** a user with access to the Transfers workspace
- **WHEN** they adjust facility, status, type, date range, or search filters
- **THEN** the client issues a request to `/api/transfers/list` including those filters
- **AND** the returned rows AND total count reflect only matching transfer requests with correct tenant scoping.

#### Scenario: Status badges reflect server counts
- **GIVEN** filters are applied
- **WHEN** the page renders per-status badges
- **THEN** the client uses `/api/transfers/counts` (with the same non-status filters)
- **AND** each badge displays the server-provided count for its status.

#### Scenario: Role-based visibility enforced
- **GIVEN** a non-global user
- **WHEN** they load the grid
- **THEN** the facility filter is locked to their allowed set
- **AND** rows outside their tenant are never returned by the API.
