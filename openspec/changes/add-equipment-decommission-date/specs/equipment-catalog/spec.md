## ADDED Requirements

### Requirement: Equipment decommission date field
The system SHALL store an optional decommission date ("Ngày ngừng sử dụng") for each equipment record in `ngay_ngung_su_dung`. The field uses strict full-date precision and is stored as ISO `YYYY-MM-DD`.

#### Scenario: Create equipment with decommission date
- **WHEN** a user creates equipment and provides `ngay_ngung_su_dung` in `DD/MM/YYYY` format
- **THEN** the value is normalized to ISO `YYYY-MM-DD` and persisted

#### Scenario: Existing records without decommission date
- **WHEN** an equipment record has no `ngay_ngung_su_dung`
- **THEN** the system returns `null` and the UI shows no value

#### Scenario: Manual backfill for an existing decommissioned record
- **WHEN** a user edits an existing record whose `tinh_trang_hien_tai` is `"Ngưng sử dụng"` and `ngay_ngung_su_dung` is empty, then manually enters a valid date
- **THEN** the system persists the user-provided value

#### Scenario: Invalid date format rejected
- **WHEN** a user enters a partial date (`MM/YYYY` or `YYYY`) for `ngay_ngung_su_dung`
- **THEN** the form or import flow rejects the value with the error `Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY`

#### Scenario: Invalid calendar date rejected
- **WHEN** a user enters a malformed full date for `ngay_ngung_su_dung` (for example `32/01/2025`, `29/02/2025` on non-leap year, or month `13`)
- **THEN** the form or import flow rejects the value with the error `Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY`

### Requirement: Decommission date status dependency
The system SHALL only accept `ngay_ngung_su_dung` when `tinh_trang_hien_tai` is `"Ngưng sử dụng"`.

#### Scenario: Non-decommissioned status with decommission date
- **WHEN** a user saves or imports equipment whose `tinh_trang_hien_tai` is not `"Ngưng sử dụng"` and `ngay_ngung_su_dung` has a value
- **THEN** the system rejects the input with a clear validation error

#### Scenario: Decommissioned status with decommission date
- **WHEN** a user saves or imports equipment whose `tinh_trang_hien_tai` is `"Ngưng sử dụng"` and `ngay_ngung_su_dung` has a valid value
- **THEN** the system accepts the value

#### Scenario: Non-decommissioned status with empty decommission date
- **WHEN** a user saves or imports equipment whose `tinh_trang_hien_tai` is not `"Ngưng sử dụng"` and `ngay_ngung_su_dung` is empty
- **THEN** the system accepts the input

### Requirement: Cross-field date validation
The system SHALL validate that `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` when both values are present and `ngay_dua_vao_su_dung` is a full date (`YYYY-MM-DD`).

#### Scenario: Decommission date before commission date
- **WHEN** a user enters `ngay_ngung_su_dung` earlier than `ngay_dua_vao_su_dung`
- **THEN** the system rejects the input with the error `Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng`

#### Scenario: Decommission date equals commission date
- **WHEN** `ngay_ngung_su_dung` equals `ngay_dua_vao_su_dung`
- **THEN** the system accepts the values

#### Scenario: Commission date absent
- **WHEN** `ngay_dua_vao_su_dung` is empty and `ngay_ngung_su_dung` is provided
- **THEN** the system accepts the value without cross-field comparison

#### Scenario: Commission date is partial
- **WHEN** `ngay_dua_vao_su_dung` is partial (`YYYY` or `YYYY-MM`) and `ngay_ngung_su_dung` is provided
- **THEN** the system accepts the value without chronological comparison

### Requirement: Auto-set decommission date on status change
The system SHALL auto-populate `ngay_ngung_su_dung` with today's date (`DD/MM/YYYY`, timezone `Asia/Ho_Chi_Minh`) only when the user changes `tinh_trang_hien_tai` to `"Ngưng sử dụng"` during the current create/edit session and the field is currently empty.

#### Scenario: Status changed to Ngưng sử dụng with empty decommission date
- **WHEN** the user changes `tinh_trang_hien_tai` to `"Ngưng sử dụng"` during the current session and `ngay_ngung_su_dung` is empty
- **THEN** the system auto-fills `ngay_ngung_su_dung` with today's date in `DD/MM/YYYY` format

#### Scenario: Status changed to Ngưng sử dụng with existing decommission date
- **WHEN** the user changes `tinh_trang_hien_tai` to `"Ngưng sử dụng"` during the current session and `ngay_ngung_su_dung` already has a value
- **THEN** the system preserves the existing value

#### Scenario: Existing decommissioned record loads without date
- **WHEN** an edit/detail form loads an existing record whose `tinh_trang_hien_tai` is already `"Ngưng sử dụng"` and `ngay_ngung_su_dung` is empty
- **THEN** the system leaves the field empty and does not auto-fill on initial load

### Requirement: Decommission date hidden by default in table
The system SHALL hide `ngay_ngung_su_dung` by default in the equipment data table. Users can toggle its visibility.

#### Scenario: Default table view
- **WHEN** a user opens the equipment table with default column settings
- **THEN** the `Ngày ngừng sử dụng` column is hidden

#### Scenario: User enables decommission date column
- **WHEN** a user toggles `Ngày ngừng sử dụng` visibility on
- **THEN** the column displays ISO dates formatted as `DD/MM/YYYY`

### Requirement: Forms, detail view, and print include decommission date
The system SHALL allow users to enter and edit `ngay_ngung_su_dung` in equipment create/edit/detail forms and display it in the detail view and print template.

#### Scenario: Add dialog includes decommission date
- **WHEN** a user opens the add equipment dialog
- **THEN** an optional `Ngày ngừng sử dụng` input is available with a `DD/MM/YYYY` placeholder

#### Scenario: Edit dialog includes decommission date
- **WHEN** a user edits an equipment record
- **THEN** `Ngày ngừng sử dụng` displays the current value in `DD/MM/YYYY` format and can be updated

#### Scenario: Detail view displays decommission date
- **WHEN** a user views equipment details
- **THEN** `Ngày ngừng sử dụng` is shown with its value or empty-state

#### Scenario: Print template displays decommission date
- **WHEN** a user prints the equipment profile sheet
- **THEN** the print output includes `Ngày ngừng sử dụng`

### Requirement: Bulk import and template validation for decommission date
The system SHALL support an optional `Ngày ngừng sử dụng` column in the equipment import template and SHALL reject imported rows that violate decommission-date validation rules.

#### Scenario: Import with decommission date column
- **WHEN** a user imports an Excel file containing the `Ngày ngừng sử dụng` header with valid full-date values
- **THEN** the system maps those values to `ngay_ngung_su_dung` and normalizes them to ISO `YYYY-MM-DD`

#### Scenario: Import row with invalid status/date combination
- **WHEN** an imported row contains `ngay_ngung_su_dung` but `tinh_trang_hien_tai` is not `"Ngưng sử dụng"`
- **THEN** the system rejects that row with a clear row-level validation error

#### Scenario: Import mixed valid and invalid rows
- **WHEN** an import file contains both valid rows and rows violating decommission-date rules
- **THEN** the system reports row-indexed validation errors and blocks import until the invalid rows are corrected

#### Scenario: Import template guides status/date dependency
- **WHEN** a user downloads the equipment import template
- **THEN** the template includes the `Ngày ngừng sử dụng` column and validation guidance that only allows the field when `Tình trạng = "Ngưng sử dụng"`
