## ADDED Requirements

### Requirement: Completion-time repair cost capture
The system SHALL allow users to optionally enter `Tổng chi phí sửa chữa` when marking an approved repair request as `Hoàn thành`.

#### Scenario: User completes a repair request with a recorded cost
- **GIVEN** an approved repair request the user is authorized to complete
- **WHEN** the user enters `1.234.567` in the completion dialog and confirms completion
- **THEN** the system stores `chi_phi_sua_chua` as the numeric value `1234567`
- **AND** the request reaches the `Hoàn thành` terminal state.

#### Scenario: User leaves repair cost blank
- **GIVEN** an approved repair request the user is authorized to complete
- **WHEN** the user leaves `Tổng chi phí sửa chữa` blank and confirms completion
- **THEN** the system stores `chi_phi_sua_chua` as `NULL`
- **AND** the request reaches the `Hoàn thành` terminal state.

#### Scenario: User enters zero repair cost
- **GIVEN** an approved repair request the user is authorized to complete
- **WHEN** the user enters `0` and confirms completion
- **THEN** the system stores `chi_phi_sua_chua` as the numeric value `0`.

### Requirement: Repair cost storage contract
The system SHALL store repair cost on `public.yeu_cau_sua_chua.chi_phi_sua_chua` as a nullable numeric value with a default of `0` for future omitted inserts, while leaving existing repair requests without synthetic backfilled costs.

#### Scenario: Existing repair requests remain unbackfilled
- **GIVEN** repair request rows exist before the cost migration is applied
- **WHEN** the migration adds `chi_phi_sua_chua`
- **THEN** existing rows keep `chi_phi_sua_chua` as `NULL`
- **AND** new rows that omit the column receive the DB default `0`.

#### Scenario: Negative repair cost is rejected
- **GIVEN** a user completes a repair request
- **WHEN** the submitted repair cost is negative
- **THEN** the system rejects the write
- **AND** the request cost is not changed.

### Requirement: Repair cost reporting
The system SHALL include repair cost totals, averages, and data-completeness counts in maintenance report and export flows.

#### Scenario: Reports summarize recorded and missing costs
- **GIVEN** completed repair requests where some rows have `chi_phi_sua_chua` and some rows are `NULL`
- **WHEN** a user opens maintenance reports or exports maintenance data
- **THEN** totals use `COALESCE(SUM(chi_phi_sua_chua), 0)`
- **AND** averages exclude `NULL` values
- **AND** the payload includes counts for recorded and missing cost rows.

#### Scenario: Report scoping remains tenant-safe
- **GIVEN** a non-global user requests repair cost report data
- **WHEN** report RPCs calculate cost aggregates
- **THEN** the aggregates include only repair requests allowed by the user's existing tenant or facility scope.
