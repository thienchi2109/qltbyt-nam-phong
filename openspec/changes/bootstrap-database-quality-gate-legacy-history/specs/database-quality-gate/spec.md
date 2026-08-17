## MODIFIED Requirements

### Requirement: Fresh replay isolation and bootstrap

The system SHALL run fresh replay only on a clean disposable Oracle test
database, SHALL never replay or reset live production, and SHALL use an
immutable schema-only bootstrap when protected legacy history is not safely
replayable.

#### Scenario: Legacy history has an approved immutable bootstrap

- **GIVEN** an exact protected-main cutover, ordered path-and-SHA legacy
  inventory, committed schema-only bootstrap SQL, and valid manifest exist
- **WHEN** fresh replay runs
- **THEN** the disposable database restores the bootstrap before applying only
  post-cutover direct-root 14-digit migrations
- **AND** legacy migration files are not replayed line-by-line
- **AND** every bootstrap artifact hash and source binding is recorded in
  immutable evidence

#### Scenario: Bootstrap authority or evidence is unavailable

- **GIVEN** fresh replay requires bootstrap SQL, manifest, source attestation,
  or executor evidence
- **WHEN** any required input is missing, unreadable, stale, unauthorized, or
  fails integrity validation
- **THEN** the result is INCOMPLETE
- **AND** the gate does not claim aggregate PASS

#### Scenario: Bootstrap attestation differs without explanation

- **GIVEN** a bootstrap restore, `qltbyt_test`, and required read-only live
  catalog attestation are available
- **WHEN** their required structural fingerprints differ without an approved
  explicit compatibility rule
- **THEN** the gate emits a BLOCKING finding
- **AND** fresh replay cannot pass

### Requirement: Applied migration immutability

The system SHALL protect every direct-root legacy migration path and canonical
content from an exact Git cutover, SHALL preserve the ordered legacy inventory
and aggregate digest, and SHALL maintain post-cutover applied migrations in an
append-only lock.

#### Scenario: Legacy history has no trustworthy version mapping

- **GIVEN** Oracle migration records cannot be safely mapped to legacy local
  filenames
- **WHEN** baseline-forward or fresh replay evaluates history
- **THEN** the system uses the immutable path-and-SHA inventory instead of
  inventing a version-to-file mapping
- **AND** it selects pending work only from explicit post-cutover entries
