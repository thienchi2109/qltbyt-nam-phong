## ADDED Requirements

### Requirement: Equipment decommission date field
The system SHALL store an optional decommission date ("Ngày ngừng sử dụng") for each equipment record in `ngay_ngung_su_dung`. The field uses strict DD/MM/YYYY format (stored as ISO YYYY-MM-DD).

#### Scenario: Create equipment with decommission date
- **WHEN** a user creates equipment and provides `ngay_ngung_su_dung` in DD/MM/YYYY format
- **THEN** the value is normalized to ISO YYYY-MM-DD and persisted

#### Scenario: Existing records without decommission date
- **WHEN** an equipment record has no `ngay_ngung_su_dung`
- **THEN** the system returns `null` and the UI shows no value

#### Scenario: Invalid date format rejected
- **WHEN** a user enters a partial date (MM/YYYY or YYYY) for `ngay_ngung_su_dung`
- **THEN** the form displays error "Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY"

### Requirement: Cross-field date validation
The system SHALL validate that `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` when both values are present.

#### Scenario: Decommission date before commission date
- **WHEN** a user enters `ngay_ngung_su_dung` earlier than `ngay_dua_vao_su_dung`
- **THEN** the form displays error "Ngày ngừng sử dụng phải sau ngày đưa vào sử dụng"

#### Scenario: Decommission date equals commission date
- **WHEN** `ngay_ngung_su_dung` equals `ngay_dua_vao_su_dung`
- **THEN** the form accepts the values (same-day decommission is valid)

#### Scenario: Commission date absent
- **WHEN** `ngay_dua_vao_su_dung` is empty and `ngay_ngung_su_dung` is provided
- **THEN** the form accepts the value (no cross-field comparison needed)

### Requirement: Auto-set decommission date on status change
The system SHALL auto-populate `ngay_ngung_su_dung` with today's date (UTC+7, DD/MM/YYYY) when `tinh_trang_hien_tai` is changed to "Ngưng sử dụng", only if the field is currently empty.

#### Scenario: Status changed to Ngưng sử dụng with empty decommission date
- **WHEN** user changes `tinh_trang_hien_tai` to "Ngưng sử dụng" and `ngay_ngung_su_dung` is empty
- **THEN** the system auto-fills `ngay_ngung_su_dung` with today's date in DD/MM/YYYY format

#### Scenario: Status changed to Ngưng sử dụng with existing decommission date
- **WHEN** user changes `tinh_trang_hien_tai` to "Ngưng sử dụng" and `ngay_ngung_su_dung` already has a value
- **THEN** the system preserves the existing value (no override)

#### Scenario: User edits auto-populated date
- **WHEN** the system auto-populates `ngay_ngung_su_dung` and the user modifies it
- **THEN** the user-provided value is used instead

### Requirement: Decommission date hidden by default in table
The system SHALL hide `ngay_ngung_su_dung` by default in the equipment data table. Users can toggle its visibility.

#### Scenario: Default table view
- **WHEN** a user opens the equipment table with default column settings
- **THEN** "Ngày ngừng sử dụng" column is hidden

#### Scenario: User enables decommission date column
- **WHEN** a user toggles "Ngày ngừng sử dụng" visibility on
- **THEN** the column displays ISO dates formatted as DD/MM/YYYY

### Requirement: Forms and detail view include decommission date
The system SHALL allow users to enter and edit `ngay_ngung_su_dung` in all equipment forms (add, edit, detail) and display it in equipment detail view and print template.

#### Scenario: Add dialog includes decommission date
- **WHEN** a user opens the add equipment dialog
- **THEN** an optional "Ngày ngừng sử dụng" input is available with DD/MM/YYYY placeholder

#### Scenario: Edit dialog includes decommission date
- **WHEN** a user edits an equipment record
- **THEN** "Ngày ngừng sử dụng" displays the current value (formatted as DD/MM/YYYY) and can be updated

#### Scenario: Detail view displays decommission date
- **WHEN** a user views equipment details
- **THEN** "Ngày ngừng sử dụng" is shown with its value or empty-state

### Requirement: Bulk import mapping for decommission date
The system SHALL accept an optional "Ngày ngừng sử dụng" column during bulk import and map it to `ngay_ngung_su_dung`.

#### Scenario: Import with decommission date column
- **WHEN** a user imports an Excel file containing the "Ngày ngừng sử dụng" header
- **THEN** values are normalized from DD/MM/YYYY or Excel serial dates to ISO YYYY-MM-DD

#### Scenario: Import template includes decommission date
- **WHEN** a user downloads the equipment import template
- **THEN** the template includes a "Ngày ngừng sử dụng" column header
