## ADDED Requirements

### Requirement: Marketing authorization number field
The system SHALL store an optional Marketing Authorization Number ("Số lưu hành") for each equipment record in `so_luu_hanh`.

#### Scenario: Create equipment with Số lưu hành
- **WHEN** a user creates equipment and provides `so_luu_hanh`
- **THEN** the value is persisted and returned in equipment data

#### Scenario: Existing records without Số lưu hành
- **WHEN** an equipment record has no `so_luu_hanh`
- **THEN** the system returns `null` and the UI shows an empty-state label

### Requirement: Default column visibility
The system SHALL show "Số lưu hành" by default and hide "Vị trí lắp đặt" and "Model" by default in the equipment table.

#### Scenario: Default table view
- **WHEN** a user opens the equipment table with default column settings
- **THEN** "Số lưu hành" is visible and "Vị trí lắp đặt" + "Model" are hidden

### Requirement: Forms and detail view
The system SHALL allow users to enter and edit "Số lưu hành" in equipment create/edit dialogs and show it in the equipment detail view.

#### Scenario: Create dialog includes Số lưu hành
- **WHEN** a user opens the add equipment dialog
- **THEN** an optional "Số lưu hành" input is available

#### Scenario: Edit dialog includes Số lưu hành
- **WHEN** a user edits an equipment record
- **THEN** "Số lưu hành" can be updated and saved

#### Scenario: Detail view displays Số lưu hành
- **WHEN** a user views equipment details
- **THEN** "Số lưu hành" is shown with its current value or empty-state label

### Requirement: Bulk import mapping
The system SHALL accept an optional "Số lưu hành" column during bulk import and map it to `so_luu_hanh`.

#### Scenario: Import with Số lưu hành column
- **WHEN** a user imports an Excel file containing the "Số lưu hành" header
- **THEN** values are mapped to `so_luu_hanh` and null values are allowed
