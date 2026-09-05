# Device Quota Category Workspace — Draft Excel Export

## ADDED Requirements

### Requirement: Session-scoped saved draft Excel export

The draft catalog workspace SHALL expose an `Xuất Excel` action only to the
existing manager roles `global`, `admin`, and `to_qltb`, scoped to the current
session unit. The action MUST export the accepted saved draft snapshot and MUST
not create a new read-only data path, call a mutation, or change any existing
category, mapping, reporting, compliance, or import contract.

#### Scenario: Authorized manager exports a clean saved draft

- **GIVEN** the current session has a supported manager role and a saved draft
  for the current session unit
- **AND** the editor has no dirty staged values or pending draft mutation
- **WHEN** the manager activates `Xuất Excel`
- **THEN** the workspace creates and downloads exactly one `.xlsx` workbook
  with exactly one worksheet
- **AND** the action is rendered immediately before the existing `Lưu` action
  in the draft toolbar
- **AND** no Save, RPC mutation, or click-time refetch is issued

#### Scenario: Unsupported or read-only access cannot export

- **GIVEN** the current user is unauthorized for the draft export or the
  current mode does not grant the manager editing contract
- **WHEN** the draft workspace renders
- **THEN** the export action is hidden
- **AND** no draft snapshot or workbook is downloaded through this action

### Requirement: Export readiness preserves incomplete drafts

The export action MUST be disabled while the draft has unsaved changes, while
save/exclude/restore/recovery is pending, while no coherent saved snapshot or
matching unit name is available, or while export is pending. Missing proposal
values alone MUST NOT block export of an otherwise eligible saved draft.

#### Scenario: Unsaved changes and pending mutations block export

- **GIVEN** the editor has unsaved changes or a draft mutation/recovery is pending
- **WHEN** the manager views or attempts the export action
- **THEN** no workbook generation or download is started
- **AND** the disabled button has an accessible Vietnamese explanation
- **AND** dirty state requires an explicit Save before export; export never saves automatically

#### Scenario: Incomplete saved draft can still be exported

- **GIVEN** the manager has a clean saved snapshot with missing applied values
- **AND** there is no pending mutation and the unit name matches
- **WHEN** the manager exports the draft
- **THEN** the workbook is downloaded with `Bản nháp — Chưa hoàn thiện` status
- **AND** missing applied values remain blank, without invented defaults
- **AND** an otherwise complete snapshot is labelled `Bản nháp — Đã đủ dữ liệu`

### Requirement: Coherent saved snapshot and unit identity

The export builder MUST receive rows, draft metadata, regulatory metadata and
footnotes from one accepted saved server snapshot. It MUST use the server draft
`revision` and `updated_at` paired with the matching regulatory
`catalog_version_id`; it MUST NOT combine local staged rows, a local revision,
or a newer cache result with `lastSavedRows`. The unit name MUST be accepted
only when the branding result has a nonblank name and an id equal to the
snapshot unit id.

#### Scenario: Background query activity does not mix snapshots

- **GIVEN** the editor has a saved snapshot and a background query may receive
  a newer result while export is being prepared
- **WHEN** the manager activates `Xuất Excel`
- **THEN** the workbook rows, revision, saved timestamp, regulatory source
  marker and footnotes come from the same accepted snapshot
- **AND** the export does not combine local `revision` or dirty `rows` with
  server `lastSavedRows`
- **AND** the action does not refetch to obtain a newer snapshot

#### Scenario: Branding belongs to the exported unit

- **GIVEN** branding data is loaded with the draft unit as its form tenant id
- **WHEN** the branding result id differs from the saved snapshot unit id or
  its name is blank
- **THEN** export remains unavailable and the user receives a Vietnamese
  missing/mismatch status with a retry action
- **AND** the name of another unit is never written into the workbook

#### Scenario: Session or unit changes before download

- **GIVEN** workbook generation is asynchronous and the user/session identity
  changes before the browser download call
- **WHEN** the pending generation completes
- **THEN** the workspace aborts that download and does not release a file from
  the previous user or unit

### Requirement: Appendix-aligned seven-column workbook

The workbook MUST contain one worksheet with a seven-column data table in this
exact order: `TT`, `Chủng loại`, `Đơn vị tính`, `Số lượng định mức`, `ĐVT áp
dụng`, `SL đề xuất`, `Ghi chú`. It MUST preserve the original appendix title,
source order, source-declared hierarchy, source text and legal column meaning
from the repository-owned Thông tư 10/2026 artifact.

#### Scenario: Source rows remain complete and ordered

- **GIVEN** the frozen source artifact contains 42 structural rows, five
  section rows and 37 item rows
- **WHEN** a saved draft is exported
- **THEN** all 42 rows are present in the worksheet in the artifact's source
  order, including section rows and top-level/child relationships
- **AND** `Chủng loại`, `Đơn vị tính` and `Số lượng định mức` retain their
  regulatory source values
- **AND** every multiline quota condition remains readable as source text
  rather than an inferred numeric formula

#### Scenario: Metadata is separate from the legal data columns

- **GIVEN** the saved snapshot has unit name, draft status, revision and saved
  timestamp
- **WHEN** the worksheet is created
- **THEN** those four values appear in a separate title/metadata area
- **AND** no signature, approval field or extra data column is added
- **AND** the seven data headers and their order remain unchanged

### Requirement: Nullable proposal and excluded-row semantics

The export MUST preserve the difference between absent and zero proposal values.
When `appliedUnit` is null, the `ĐVT áp dụng` cell MUST be blank and MUST NOT
use the regulatory unit as a UI fallback. When `appliedQuantity` is null, the
`SL đề xuất` cell MUST be blank; when it is zero, the cell MUST contain numeric
zero. Excluded rows MUST stay in source order and preserve stored proposal
values and notes.

#### Scenario: Null and zero values are represented faithfully

- **GIVEN** one saved row has null applied unit, one has null quantity, and one
  has applied quantity zero
- **WHEN** the workbook rows are read back with ExcelJS
- **THEN** the null applied-unit cell is blank
- **AND** the null quantity cell is blank
- **AND** the zero quantity cell is numeric `0`
- **AND** no regulatory-unit fallback is persisted into the applied-unit cell

#### Scenario: Excluded row remains auditable

- **GIVEN** a saved item row is excluded and already contains proposal values or
  notes
- **WHEN** the workbook is exported
- **THEN** the row remains in its original position and retains those values
- **AND** the full row uses the excluded gray style
- **AND** only `ĐVT áp dụng`, `SL đề xuất` and `Ghi chú` use strikethrough
- **AND** `Ghi chú` contains `[Đã loại khỏi đề xuất]` without deleting existing
  notes or duplicating the marker
- **AND** source cells remain readable and are not struck through

### Requirement: Printable source-faithful layout and failure behavior

The worksheet MUST use A4 landscape print setup, fit to one page in width with
unlimited height, repeat the table header on every printed page, wrap source
multiline content, and keep all three source footnotes in a separate readable
area. The UI MUST lock duplicate export attempts and MUST expose a retryable
Vietnamese error state when workbook generation or download fails.

#### Scenario: Long appendix fits the print contract

- **GIVEN** the export contains all source rows and multiline rules
- **WHEN** the worksheet is opened or printed
- **THEN** the print setup is A4 landscape with one-page width and unlimited
  height
- **AND** the table header repeats on subsequent pages
- **AND** title, metadata, source rows and all three footnotes remain present
- **AND** source text is wrapped/readable without proposal styling obscuring it

#### Scenario: Pending export prevents duplicate download

- **GIVEN** workbook generation or download is pending
- **WHEN** the user activates `Xuất Excel` again
- **THEN** the second activation is disabled/ignored
- **AND** at most one browser download is initiated
- **AND** Save and draft mutation state are not triggered

#### Scenario: Export error can be retried

- **GIVEN** ExcelJS generation or Blob download fails for the accepted snapshot
- **WHEN** the error is handled
- **THEN** the user sees a Vietnamese error toast/status with a retry action
- **AND** no incomplete or stale file is downloaded
- **AND** retry does not silently refetch or mutate the draft
- **AND** the export lock is released in all outcomes and the same export button
  is usable again whenever current eligibility permits

### Requirement: Existing workspace and Excel contracts remain intact

The export implementation MUST be additive and MUST leave active category CRUD,
category Excel import, quota-decision Excel import, mapping, reporting and
compliance behavior unchanged. It MUST reuse the existing workbook/download
helpers and MUST NOT add domain flags to the generic flat export helper.

#### Scenario: Existing actions coexist with export

- **GIVEN** the draft export action is present in the category workspace
- **WHEN** a user opens existing category management or either Excel import flow
- **THEN** the existing entry points, permission checks, validation, payloads
  and behavior remain available
- **AND** export performs no database or RPC write
- **AND** disabling export leaves those existing actions usable
