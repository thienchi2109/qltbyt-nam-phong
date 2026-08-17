# Change: Bootstrap Database Quality Gate Legacy History

## Why

The first Oracle fresh-replay attempt for Database Quality Gate Phase 4 failed
on the protected legacy migration history. The current direct-root source cannot
be safely replayed from a clean database, and the restored Oracle baseline has
no trustworthy version-to-file mapping to that source. Editing history to make
replay pass would invalidate the only available evidence.

## What Changes

- Establish immutable bootstrap cutover `578dda481380822b5e9f5a6ce5a2f4f82db86a46`,
  the exact protected `main` commit that landed Phase 4.
- Freeze every direct-root migration present at that cutover as a path-and-SHA
  legacy inventory. The gate SHALL not infer a migration version mapping from
  this inventory.
- Define a committed schema-only bootstrap SQL artifact and strict manifest,
  generated from read-only Oracle `qltbyt_test` inspection with only
  line-ending and terminal-LF canonicalization.
- Make fresh replay restore the immutable schema bootstrap into a disposable
  Oracle database, then apply only post-cutover canonical 14-digit migrations.
- Make baseline-forward identify pending post-cutover migrations from the
  append-only lock, not from guessed equivalence with legacy Oracle migration
  versions.
- Require three-way structural attestation between the restored disposable
  database, `qltbyt_test`, and read-only live catalog evidence. Missing
  authority or evidence remains INCOMPLETE; unexplained differences are
  BLOCKING.

## Boundaries

- No legacy migration is edited, renamed, deleted, reordered, repaired, or
  replayed line-by-line.
- The bootstrap is schema-only and excludes users, application data, secrets,
  and non-deterministic data. Minimal seeds are permitted only when explicitly
  manifest-listed, deterministic, and non-sensitive.
- Oracle work is limited to read-only snapshot/attestation and disposable
  gate databases. `qltbyt_test` is never caught up by this change.
- This change authorizes no Supabase live inspection or write. Any later
  read-only live attestation and every live write require their own explicit
  maintainer authorization.
- This change does not add CI, a ruleset, a timer, a self-hosted runner, or a
  live migration apply.

## Impact

- Affected specs: `database-quality-gate`
- Affected repository areas:
  - `supabase/applied-migrations.lock.json`
  - committed bootstrap SQL and manifest artifacts
  - dynamic input, replay, baseline-forward, and report contracts
  - focused Database Quality Gate tests and Oracle runbook
- Follow-up issue: `#942`
