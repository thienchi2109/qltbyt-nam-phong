## Context

Phase 4 recorded two fail-closed outcomes for commit
`578dda481380822b5e9f5a6ce5a2f4f82db86a46`:

- fresh replay failed because legacy migration ordering references objects not
  created by the replayed source;
- baseline-forward was incomplete because the Oracle migration history cannot
  be safely mapped to the current local source by version.

The old root source is evidence, not a replay recipe. The bootstrap therefore
preserves the source as immutable history and establishes a new deterministic
replay origin without inventing a version-to-file mapping.

## Design

### Immutable cutover and inventory

The cutover is the exact protected `main` SHA
`578dda481380822b5e9f5a6ce5a2f4f82db86a46`. The committed applied lock SHALL
contain:

- `cutover.commit` equal to this SHA;
- `cutover.migrationRoot` equal to `supabase/migrations`;
- every direct-root SQL file at that commit in ordered `legacy` path-and-SHA
  inventory;
- an aggregate digest of the ordered legacy inventory;
- no synthetic migration version, high-water, or version-to-file relationship.

Any changed, removed, renamed, reordered, or substituted inventory entry is
BLOCKING. A file first added after the cutover is canonical only when it is a
direct-root 14-digit migration and is absent from the immutable inventory.

### Bootstrap artifact and manifest

The bootstrap consists of two committed files:

1. Raw `pg_dump --schema-only` SQL from `qltbyt_test`.
2. A manifest that pins the exact cutover, source environment identity, dump
   command/toolchain version, included object scope, excluded data scope,
   canonicalization method, SQL SHA-256, inventory digest, and attestation
   input/output digests.

The raw dump is preserved. Canonicalization is limited to CRLF-to-LF conversion
and exactly one terminal LF. It SHALL NOT sort statements, rewrite ownership,
remove extensions, redact SQL, or otherwise transform the dump. A generated
manifest with absent authority, unavailable source evidence, inconsistent
hashes, or an unapproved scope is invalid and makes the gate INCOMPLETE.

The schema scope includes the Supabase base template plus application-owned
objects explicitly listed in the manifest. It excludes users, roles, secrets,
application rows, storage objects, and all unlisted data. Deterministic,
non-sensitive seeds are exceptional and must be declared individually with
content hash and purpose.

### Dynamic behavior

Fresh replay SHALL:

1. validate the lock, manifest, SQL hash, inventory digest, and source commit;
2. create a clean disposable Oracle database;
3. apply the immutable bootstrap SQL;
4. apply only direct-root post-cutover 14-digit migrations not yet recorded as
   applied;
5. collect required catalogs, default-safe SQL tests, and immutable report
   evidence;
6. drop the disposable database on every terminal path.

Baseline-forward SHALL never compare legacy Oracle migration versions to local
legacy paths. It SHALL validate baseline compatibility through the committed
bootstrap attestation and apply only the explicit post-cutover pending set to a
disposable clone.

### Three-way attestation

Bootstrap acceptance compares three independently collected structural
fingerprints:

- the disposable database after bootstrap restore;
- persistent Oracle `qltbyt_test`;
- a read-only live catalog observation.

The comparison is layered using the existing portable application, access, and
environment fingerprints. An unexplained difference is BLOCKING. Missing,
unreadable, stale, unauthorized, or non-deterministic evidence is INCOMPLETE.
No waiver converts either condition into aggregate PASS.

### Rollout

1. Implement and test the lock, manifest parser, artifact hash validation, and
   bootstrap-aware dynamic contracts on a dedicated branch.
2. Land that implementation separately from Phase 4.
3. With explicit Oracle test-environment authority, generate the schema-only
   artifact from `qltbyt_test`, commit the artifact and manifest, and rerun
   static validation.
4. After the resulting exact SHA is on protected `main`, run the authorized
   Oracle fresh replay and baseline-forward validations.
5. Keep timer activation disabled until the exact-main fresh replay and
   required attestation pass.

No step applies a migration to live Supabase, mutates `qltbyt_test`, or grants
live-write authority.
