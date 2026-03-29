## ADDED Requirements

### Requirement: Full Filtered Export
The system SHALL export ALL equipment matching the current filter criteria, not limited by pagination.

#### Scenario: Export with filters applied
- **WHEN** user has applied filters (e.g., department = "Khoa Nội", status = "Đang sử dụng")
- **AND** user clicks "Tải về Excel"
- **THEN** the system SHALL fetch all 156 matching equipment (not just 20 on current page)
- **AND** export all 156 records to Excel file

#### Scenario: Export without filters
- **WHEN** user has no filters applied
- **AND** user clicks "Tải về Excel"
- **THEN** the system SHALL export all equipment for the current tenant

### Requirement: Pre-Export Confirmation Toast
The system SHALL display a confirmation toast before starting the export, showing the count and active filters.

#### Scenario: Toast with filters
- **WHEN** user clicks "Tải về Excel"
- **AND** 156 equipment match current filters
- **AND** filters include: department = "Khoa Nội", status = "Đang sử dụng", search = "máy thở"
- **THEN** the system SHALL display toast:
  ```
  📥 Chuẩn bị tải xuống
  Sẽ tải 156 thiết bị với bộ lọc:
  • Khoa phòng: Khoa Nội
  • Tình trạng: Đang sử dụng
  • Tìm kiếm: "máy thở"
  ```

#### Scenario: Toast without filters
- **WHEN** user clicks "Tải về Excel"
- **AND** no filters applied
- **AND** 500 equipment in tenant
- **THEN** the system SHALL display toast:
  ```
  📥 Chuẩn bị tải xuống
  Sẽ tải 500 thiết bị (tất cả)
  ```

### Requirement: Large Export Warning
The system SHALL warn users when exporting more than 5000 items and require confirmation.

#### Scenario: Export exceeds 5000 items
- **WHEN** user clicks "Tải về Excel"
- **AND** 7500 equipment match current filters
- **THEN** the system SHALL display warning dialog:
  ```
  ⚠️ Danh sách lớn
  Bạn đang tải 7,500 thiết bị. Quá trình này có thể mất vài phút.
  Bạn có muốn tiếp tục?
  [Hủy] [Tiếp tục]
  ```
- **AND** only proceed if user confirms

### Requirement: Export Loading State
The system SHALL display loading state during export and disable the export button.

#### Scenario: Loading during export
- **WHEN** export is in progress
- **THEN** the export button SHALL be disabled
- **AND** show loading spinner or "Đang tải..." text
- **AND** prevent multiple concurrent exports

#### Scenario: Loading completes
- **WHEN** export finishes (success or error)
- **THEN** the export button SHALL be re-enabled
- **AND** loading indicator removed
