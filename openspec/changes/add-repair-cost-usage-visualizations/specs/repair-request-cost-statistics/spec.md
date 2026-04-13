## ADDED Requirements

### Requirement: Top repair cost equipment visualization
The system SHALL show the top equipment by completed repair cost in the maintenance repair report.

#### Scenario: User views top repair cost equipment
- **GIVEN** completed repair requests with recorded `chi_phi_sua_chua` values exist within the selected report date range
- **WHEN** the user opens `/reports` and selects the `Bảo trì / Sửa chữa` tab
- **THEN** the system shows the top 10 equipment sorted by total completed repair cost descending
- **AND** each item exposes the equipment name, total repair cost, completed repair count, and cost-recorded count.

#### Scenario: No recorded repair costs exist
- **GIVEN** no completed repair request in the selected report date range has a non-null `chi_phi_sua_chua`
- **WHEN** the user opens the maintenance repair report
- **THEN** the system shows an empty state explaining that no repair cost data is available for the selected period.

### Requirement: Usage duration and repair cost correlation
The system SHALL visualize the relationship between completed usage duration and completed repair cost per equipment.

#### Scenario: User views sufficient correlation data
- **GIVEN** at least three equipment have both positive completed usage duration and recorded completed repair cost in scope
- **WHEN** the user opens the maintenance repair report
- **THEN** the system shows a correlation chart where usage duration is calculated from `nhat_ky_su_dung.thoi_gian_ket_thuc - nhat_ky_su_dung.thoi_gian_bat_dau`
- **AND** the chart excludes open usage logs and usage logs whose end time is not greater than start time.

#### Scenario: Correlation data is insufficient
- **GIVEN** fewer than three equipment have both positive completed usage duration and recorded completed repair cost in scope
- **WHEN** the user opens the maintenance repair report
- **THEN** the system shows a data-quality empty state instead of a correlation chart
- **AND** the empty state includes counts for equipment with usage duration, equipment with recorded repair cost, and equipment with both.

#### Scenario: User switches the correlation scope
- **GIVEN** the maintenance repair report has a selected date range
- **WHEN** the user switches from period mode to cumulative mode
- **THEN** the correlation chart uses completed usage duration and completed repair costs through the selected end date
- **AND** the top repair cost equipment chart remains scoped to the selected report date range.

#### Scenario: Report payload supports scope switching
- **GIVEN** the maintenance repair report requests `get_maintenance_report_data(date,date,bigint)`
- **WHEN** the RPC returns repair usage-cost correlation data
- **THEN** the payload includes separate period and cumulative correlation datasets
- **AND** the RPC signature remains compatible with existing callers.

### Requirement: Repair cost usage visualization scoping
The system SHALL preserve existing tenant and facility scoping for repair cost usage visualizations.

#### Scenario: Non-global user views repair cost usage charts
- **GIVEN** a non-global user opens the maintenance repair report
- **WHEN** the report calculates top repair cost equipment and usage-cost correlation data
- **THEN** the calculations include only equipment and repair requests allowed by the user's tenant or facility scope.
