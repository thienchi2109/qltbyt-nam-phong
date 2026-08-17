# Database Quality Gate Bootstrap

This runbook creates and validates the immutable schema-only bootstrap used by
the Oracle-only Database Quality Gate. It is not a live migration procedure.

## Boundaries

- Never apply a migration, grant, policy, function, or schema change to live
  Supabase from this runbook.
- Never modify, catch up, restore into, or otherwise mutate `qltbyt_test`.
- The only Oracle writes allowed here are to disposable databases whose names
  start with `dq_`.
- Do not use the Supabase CLI for live or Oracle gate work.
- Ports on the Oracle VM remain loopback-only. Do not open a listener or add a
  firewall rule.
- A dynamic outcome is not an aggregate PASS when any authority, catalog
  evidence, attestation, executor, or cleanup evidence is unavailable.

## Required Authority

Before step 1, obtain explicit maintainer authority for a read-only
schema-only dump from Oracle `qltbyt_test`.

Before obtaining the live structural fingerprints in step 5, obtain separate
explicit authority for read-only Supabase MCP catalog inspection. That
inspection must use project `cdthersvldpnlbvpufrr`; it never authorizes a live
write.

## 1. Create A Raw Schema-Only Dump

Run from the Codex VPS. Keep the private key and known-hosts path outside the
repository.

```bash
set -euo pipefail
umask 077
dump_path=/tmp/qltbyt-test-bootstrap.sql
ssh -T \
  -i /root/Oracle/ssh-key-2026-05-13.key \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/root/.ssh/known_hosts \
  ubuntu@149.118.148.179 \
  "docker exec -i supabase-db pg_dump -U postgres -d qltbyt_test --schema-only" \
  > "$dump_path"
sha256sum "$dump_path"
```

This command only reads `qltbyt_test`. Do not add data options, do not use
`pg_restore`, and do not redirect output back to the Oracle VM.

## 2. Review Scope And Canonical Hash

The artifact is schema-only. It must contain neither application data nor
credentials. Reject the dump if it contains a data load command:

```bash
rg -n '^(COPY |INSERT INTO )' /tmp/qltbyt-test-bootstrap.sql
```

Review that the intended scope is only `supabase-base-template` and
`application-owned-schema`; it excludes application data, roles, secrets, and
users. PostgreSQL 17's paired `\restrict` and `\unrestrict` envelope is
permitted. Any other psql meta-command is rejected by the executor.

Calculate the canonical hash from the exact raw SQL. Canonicalization changes
only CRLF/LF representation and terminal line feeds:

```bash
node scripts/npm-run.js exec tsx -e \
  "import { readFileSync } from 'node:fs'; import { bootstrapSqlSha256 } from './scripts/db-quality-gate/bootstrap'; console.log(bootstrapSqlSha256(readFileSync('/tmp/qltbyt-test-bootstrap.sql', 'utf8')))"
```

## 3. Bind The Artifact To The Protected Cutover

Use the full immutable SHA, not a branch name. The bootstrap manifest must bind
all of the following:

- exact `cutover.commit`
- ordered direct-root legacy migration `path` and `sha256` entries
- `cutover.legacyInventorySha256`
- canonical bootstrap SQL hash
- `pg_dump --schema-only` and the observed PostgreSQL version
- exact restrictive scope

The committed lock and manifest are the evidence source. Dynamic execution
reads them from `subjectCommit`, never from mutable worktree files.

## 4. Stage The Artifact Without Claiming Attestation

Until both read-only reference sources are available, retain:

```json
{ "attestation": { "status": "pending" } }
```

This is intentionally `INCOMPLETE`; it is not an aggregate PASS and must not
start a dynamic replay. Do not invent a migration-version-to-legacy-file
mapping.

## 5. Complete The Read-Only Reference Attestation

After the bootstrap commit lands on `main`, and only with the two authorities
above:

1. Read Oracle `qltbyt_test` access, application, and environment catalogs.
2. Read the same live catalogs through Supabase MCP only.
3. Normalize each catalog through the repository fingerprint functions:
   `collectAccessFingerprint`, `collectApplicationFingerprint`, and
   `collectEnvironmentFingerprint`.
4. If any Oracle baseline and live fingerprint differs, stop. The difference is
   `BLOCKING` unless a separately reviewed manifest design supplies an explicit
   explanation mechanism.
5. Commit the six matching live and Oracle-baseline hashes with
   `"attestation": { "status": "complete", ... }`. This remains evidence for a
   later dynamic run, not authorization for a live write.

## 6. Exact-Main Dynamic Validation And Cleanup

Run only for the exact landed `main` SHA, using the Oracle executor and a new
immutable run ID:

```bash
node scripts/db-quality-gate/run-cli.cjs \
  --created-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --lane fresh-replay \
  --run-id "bootstrap-<exact-main-sha-prefix>-fresh-replay" \
  --subject-commit "<exact-main-sha>"
```

Fresh replay creates a new `dq_fresh_replay_*` database, restores the
bootstrap, compares it with both immutable references before candidate
migrations run, and removes the disposable database in `finally`.

Run baseline-forward separately with a `dq_baseline_forward_*` name. It clones
`qltbyt_test`; it never catches up or mutates that baseline.

After each run, verify cleanup read-only:

```bash
ssh -T \
  -i /root/Oracle/ssh-key-2026-05-13.key \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/root/.ssh/known_hosts \
  ubuntu@149.118.148.179 \
  "docker exec -i supabase-db psql -X -U postgres -d postgres -tA -c \"SELECT datname FROM pg_database WHERE datname LIKE 'dq_%' ORDER BY datname;\""
```

The command must return no database names. Persisted Oracle reports and this
cleanup evidence are required. A missing report, unavailable executor,
unfinished cleanup, pending attestation, or any fingerprint mismatch remains
`INCOMPLETE` or `BLOCKING`; do not claim aggregate PASS.
