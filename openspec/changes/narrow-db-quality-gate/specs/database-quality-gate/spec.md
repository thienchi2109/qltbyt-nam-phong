Delta này chỉ sửa contract chọn SQL test và bổ sung contract cho selector
cutover. Các requirement nền của `add-database-quality-gate`, gồm
baseline-forward validation, layered expected-state validation, applied-history
immutability, stable evidence, security intent, Oracle evidence, local trigger,
reconciliation và exact landed-commit/live-write boundary, vẫn giữ nguyên.

## MODIFIED Requirements

### Requirement: Registry-selected SQL-test execution

The system SHALL keep test safety independent from gate scope and SHALL select
default-lane tests from validated registry metadata. Every `default-safe`
`core-security` test SHALL be selected. A `default-safe`
`migration-specific` test SHALL be selected only when at least one
`requiredForMigrations` entry exactly matches a canonical pending migration path
under the exact `subjectCommit`. The system SHALL exclude `opt-in` and
`live-only` tests from the default lane, SHALL preserve their existing safety
semantics, SHALL preserve the existing `purpose` restrictions that reject
`performance`, `concurrency` and `live-acceptance` for `default-safe`, and SHALL
reject missing or invalid scope metadata as a blocking registry error rather
than silently omitting a test. `gateScope` SHALL NOT promote an entry around
these safety or purpose restrictions.

#### Scenario: Core security remains selected for an unrelated migration

- **GIVEN** a registry entry is `default-safe` and has `gateScope` equal to
  `core-security`
- **AND** the entry has valid source, runner, fixture, transaction, rollback and
  timeout metadata
- **WHEN** a default static or baseline-forward selection runs for any valid
  pending migration set
- **THEN** the core-security test is selected
- **AND** its selected path and source SHA are included in evidence

#### Scenario: Migration-specific test requires an exact pending path

- **GIVEN** a registry entry is `default-safe` and has `gateScope` equal to
  `migration-specific`
- **AND** `requiredForMigrations` contains a canonical path
- **WHEN** that exact path is present in the pending set for the exact
  `subjectCommit`
- **THEN** the test is selected
- **AND** the selection records the exact path match

#### Scenario: Non-matching business test is excluded without deleting coverage

- **GIVEN** a `default-safe` migration-specific test has no exact path match in
  the pending set
- **WHEN** the default lane selects tests
- **THEN** the test is excluded from execution for that migration
- **AND** the registry and its rationale remain visible for a future matching
  migration
- **AND** the selector does not use a glob, substring, timestamp, filename
  category, or SQL inference as a fallback

#### Scenario: Special safety classes keep their meaning

- **GIVEN** a test is classified `opt-in` or `live-only`
- **WHEN** the default lane selects tests
- **THEN** the test is excluded
- **AND** its safety classification is unchanged
- **AND** its filename or `gateScope` cannot opt it into the default lane

#### Scenario: Purpose and safety restrictions remain enforced

- **GIVEN** a registry entry uses one of the existing safety values
  `default-safe`, `opt-in` or `live-only`
- **AND** its `purpose` is `performance`, `concurrency` or `live-acceptance`
- **WHEN** registry validation evaluates the entry
- **THEN** an entry with `default-safe` safety is rejected
- **AND** `gateScope` cannot promote it into the default lane
- **AND** the existing `opt-in` or `live-only` semantics remain unchanged

#### Scenario: Selected default-safe tests have complete execution contracts

- **GIVEN** a `default-safe` core-security or exact-match
  migration-specific test is selected
- **WHEN** its source/runner, transaction, fixture, timeout or cleanup contract
  is missing or invalid
- **THEN** validation emits a blocking failure before the test executes
- **AND** `gateScope` cannot bypass the invalid execution contract

#### Scenario: Mixed test keeps security coverage before business exclusion

- **GIVEN** one SQL test contains both RPC/JWT/tenant/ACL/search_path assertions
  and unrelated business assertions
- **WHEN** the test is prepared for the new scope contract
- **THEN** the security assertions remain covered by core-security selection
- **AND** the business assertions are explicitly extracted or mapped as
  migration-specific before they can be excluded
- **AND** no assertion is silently dropped because of selector narrowing

#### Scenario: Required test failure cannot be hidden by baseline debt

- **GIVEN** a selected required migration-specific or core-security test fails
- **AND** an unrelated historical baseline-debt or waiver record exists
- **WHEN** the lane aggregates the result
- **THEN** the required test failure remains a failure of the required contract
- **AND** the debt or waiver cannot downgrade, suppress, or reclassify it

## ADDED Requirements

### Requirement: Staged selector cutover

The system SHALL stage metadata, mixed-test extraction and selector validation
before changing runtime selection. Chunks 3 through 5 SHALL preserve the
existing all-`default-safe` behavior. At the future Chunk 6 cutover, static and
baseline-forward SHALL receive the same exact `subjectCommit`, applied lock,
registry, canonical pending migration path/SHA set and baseline identity, and
SHALL produce the same selected test paths and selection reasons. Static SHALL
certify that set offline; baseline-forward SHALL execute it only on a
disposable clone after existing baseline preflight, health, high-water,
structural, catalog and full Technical Configuration parity checks. Chunk 7
SHALL verify the cutover on disposable infrastructure.

#### Scenario: Preparation chunks preserve current behavior

- **GIVEN** metadata or a pure selector is introduced before Chunk 6
- **WHEN** either existing lane runs
- **THEN** it keeps the current `default-safe` selection behavior
- **AND** the new selector is not treated as production evidence

#### Scenario: Offline and dynamic lanes use one selected set

- **GIVEN** static and baseline-forward lanes receive the same exact subject
  commit, lock, registry, pending path/SHA set and baseline identity
- **WHEN** each lane computes the default selected set
- **THEN** both lanes produce the same selected test paths and selection reasons
- **AND** static remains offline while baseline-forward executes selected tests
  only on a disposable clone
- **AND** full Technical Configuration parity remains required in baseline
  preflight

#### Scenario: Missing selection or execution evidence is incomplete

- **GIVEN** registry metadata or pending identity is missing, static and dynamic
  selected sets differ, or a selected test lacks source, attempted, executed,
  read-back or cleanup evidence
- **WHEN** the lane or pre-live evidence is evaluated
- **THEN** the result is INCOMPLETE
- **AND** missing evidence is not converted into a warning-only PASS

#### Scenario: Required failure cannot be debt-waived

- **GIVEN** a selected required test fails
- **AND** an unrelated baseline-debt or historical waiver matches another
  finding
- **WHEN** the lane aggregates the result
- **THEN** the required contract remains failed
- **AND** the unrelated debt or waiver cannot suppress it

#### Scenario: Partial lane cutover is rejected

- **GIVEN** static and baseline-forward would use different selector versions or
  pending-path inputs
- **WHEN** the cutover is evaluated
- **THEN** the change is incomplete and cannot claim aggregate PASS
- **AND** both lanes remain bound to the previous behavior until one shared
  cutover is ready

#### Scenario: Disposable acceptance proves the selected contract

- **GIVEN** both lanes use the shared selector at the exact landed commit
- **WHEN** Chunk 7 acceptance runs
- **THEN** core-security tests are selected, exact matching migration-specific
  tests are selected, and unrelated business tests are excluded
- **AND** the dynamic run uses a disposable clone and produces complete evidence
- **AND** no live write or persistent-baseline mutation occurs
