## ADDED Requirements

### Requirement: Server-side Date Range Filtering (Repair Requests)
The system SHALL support server-side date range filtering for Repair Requests by request date (`ngay_yeu_cau`).

#### Scenario: Both from and to
- **WHEN** `p_date_from=2025-01-01` and `p_date_to=2025-01-31` are provided
- **THEN** only requests with `date(ngay_yeu_cau)` between 2025-01-01 and 2025-01-31 (inclusive) are returned

#### Scenario: From only
- **WHEN** `p_date_from` is provided and `p_date_to` is null
- **THEN** only requests with `date(ngay_yeu_cau) >= p_date_from` are returned

#### Scenario: To only
- **WHEN** `p_date_to` is provided and `p_date_from` is null
- **THEN** only requests with `date(ngay_yeu_cau) <= p_date_to` are returned

#### Scenario: No date params
- **WHEN** both params are null/absent
- **THEN** the date filter is not applied

#### Scenario: Tenant/regional scoping preserved
- **WHEN** a date range is applied
- **THEN** results remain restricted by the user's tenant/region rules (facility scoping) as in existing RPC behavior

## MODIFIED Requirements

### Requirement: Repair Requests Filtering UI
The client SHALL pass date range selections from the Advanced Filters UI to the server via RPC parameters and include them in the query key to trigger refetching.
