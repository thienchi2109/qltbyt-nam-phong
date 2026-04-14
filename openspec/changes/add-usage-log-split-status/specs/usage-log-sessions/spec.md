## ADDED Requirements

### Requirement: Split Equipment Status Tracking

The system SHALL record separate equipment condition values at the start and end of each usage session via `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` columns on `nhat_ky_su_dung`.

#### Scenario: Start session with initial status
- **WHEN** a user calls `usage_session_start` with a valid `p_tinh_trang_ban_dau` value
- **THEN** the system writes the value to `tinh_trang_ban_dau`
- **AND** includes `tinh_trang_ban_dau` in the JSON response

#### Scenario: Start session without initial status
- **WHEN** a user calls `usage_session_start` without `p_tinh_trang_ban_dau` or with an empty string
- **THEN** the system raises an exception with error code `22023`

#### Scenario: End session with final status
- **WHEN** a user calls `usage_session_end` with a valid `p_tinh_trang_ket_thuc` value
- **THEN** the system writes the value to `tinh_trang_ket_thuc`
- **AND** includes `tinh_trang_ket_thuc` in the JSON response

#### Scenario: End session without final status
- **WHEN** a user calls `usage_session_end` without `p_tinh_trang_ket_thuc` or with an empty string
- **THEN** the system raises an exception with error code `22023`

### Requirement: Legacy Column Backward Compatibility

During the transition period, the system SHALL continue writing `tinh_trang_thiet_bi` alongside the new split columns so that consumers not yet updated can still read the legacy field. The strict validation (`RAISE EXCEPTION`) applies only when the updated frontend explicitly sends the new params as empty; old callers omitting the param entirely receive `DEFAULT NULL` and the RPC writes only the legacy column without error.

#### Scenario: Old caller omits new param entirely
- **WHEN** an existing consumer calls `usage_session_start` without providing `p_tinh_trang_ban_dau` at all (param defaults to NULL)
- **AND** the consumer provides `p_tinh_trang_thiet_bi`
- **THEN** the system writes `tinh_trang_thiet_bi` as before
- **AND** `tinh_trang_ban_dau` remains NULL
- **AND** no exception is raised

#### Scenario: New caller sends empty string
- **WHEN** an updated consumer calls `usage_session_start` with `p_tinh_trang_ban_dau = ''`
- **THEN** the system raises an exception with error code `22023`

### Requirement: Split Status Display in Usage History

The system SHALL display `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` separately in the usage history view, with a fallback to the legacy `tinh_trang_thiet_bi` column for records that predate the split.

#### Scenario: Display split status for new records
- **WHEN** a usage log has both `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` populated
- **THEN** the history view displays both values in separate fields

#### Scenario: Fallback to legacy status for old records
- **WHEN** a usage log has `tinh_trang_ban_dau` or `tinh_trang_ket_thuc` as null
- **AND** `tinh_trang_thiet_bi` is populated
- **THEN** the history view displays the legacy value as a combined fallback

### Requirement: Split Status in Print and Export

The system SHALL include `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` as separate columns in print templates and CSV exports.

#### Scenario: Print template includes both status columns
- **WHEN** a user prints usage logs
- **THEN** the print output contains separate "Tình trạng ban đầu" and "Tình trạng kết thúc" columns

#### Scenario: CSV export includes both status columns
- **WHEN** a user exports usage logs to CSV
- **THEN** the CSV contains separate header columns for initial and final status

### Requirement: Usage Log List RPC Projects Split Status

Both `usage_log_list` overloads SHALL include `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` in their JSON response objects.

#### Scenario: 8-param overload returns split status
- **WHEN** a consumer calls the 8-param `usage_log_list`
- **THEN** each returned JSON object includes `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` fields

#### Scenario: 7-param overload returns split status
- **WHEN** a consumer calls the 7-param `usage_log_list`
- **THEN** each returned JSON object includes `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` fields

### Requirement: Historical Data Backfill

The migration SHALL backfill `tinh_trang_ban_dau` from `tinh_trang_thiet_bi` for all existing rows where the new column is NULL, and backfill `tinh_trang_ket_thuc` only for completed sessions (`trang_thai = 'hoan_thanh'`).

#### Scenario: Backfill initial status from legacy
- **GIVEN** an existing row with `tinh_trang_thiet_bi` populated and `tinh_trang_ban_dau` NULL
- **WHEN** the migration runs
- **THEN** `tinh_trang_ban_dau` is set to the legacy `tinh_trang_thiet_bi` value

#### Scenario: Backfill final status for completed sessions
- **GIVEN** an existing row with `trang_thai = 'hoan_thanh'` and `tinh_trang_thiet_bi` populated and `tinh_trang_ket_thuc` NULL
- **WHEN** the migration runs
- **THEN** `tinh_trang_ket_thuc` is set to the legacy `tinh_trang_thiet_bi` value

#### Scenario: Active sessions are not backfilled for final status
- **GIVEN** an existing row with `trang_thai = 'dang_su_dung'`
- **WHEN** the migration runs
- **THEN** `tinh_trang_ket_thuc` remains NULL

### Requirement: Security Hardening for usage_session_end

The `usage_session_end` RPC SHALL have DDL-level `SET search_path = public, pg_temp` and SHALL treat `admin` role equivalently to `global` in tenant bypass guards.

#### Scenario: DDL-level search_path enforced
- **WHEN** `usage_session_end` is introspected via `pg_proc`
- **THEN** `proconfig` contains `search_path=public, pg_temp`

#### Scenario: Admin role bypasses tenant guard
- **WHEN** a user with `app_role = 'admin'` calls `usage_session_end`
- **THEN** the system does NOT enforce the tenant guard (same as `global` role)
