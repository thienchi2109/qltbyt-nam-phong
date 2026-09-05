# Database Quality Gate - Oracle baseline operations

Tai lieu nay chi danh cho Oracle test VM. Live Supabase luon read-only trong
toan bo quy trinh nay. Khong dung Supabase CLI, khong tao cron/timer tren Codex
VPS, va khong chay migration candidate truc tiep tren `qltbyt_test`.

## Local static gate

Lefthook tu dong chay lenh sau o `post-commit` de bao ngay va o `pre-push` de
chan publish khi diff co migration hoac registry cua DB Quality Gate:

```bash
node scripts/npm-run.js run db:quality-gate:local
```

Diff khong lien quan tra ve `SKIP`. Diff lien quan tra ve mot dong tom tat
`PASS`, `FAILED`, hoac `INCOMPLETE` kem digest va so luong finding. This local
command does not run baseline-forward, connect to Oracle, or write live DB.

## Known Supabase-managed Realtime finding

`realtime.messages.messages_payload_exclusive` is intentionally created by
Supabase Realtime as:

```sql
CHECK (payload IS NULL OR binary_payload IS NULL) NOT VALID
```

This is not application-owned migration debt. The upstream Realtime migration
uses `NOT VALID` so the check applies to new rows without requiring a
historical table scan. Do not validate, replace, or otherwise alter this
constraint through an application migration.

The health query excludes the `realtime` schema from
`unvalidatedConstraintCount`. That exclusion is intentional and does not
weaken checks for unvalidated constraints in application-owned schemas.

For read-only verification, inspect only metadata and aggregate counts:

```sql
SELECT convalidated, pg_get_constraintdef(oid, true)
FROM pg_constraint
WHERE conname = 'messages_payload_exclusive';

SELECT count(*) AS violating_rows
FROM realtime.messages
WHERE payload IS NOT NULL AND binary_payload IS NOT NULL;
```

Do not select or expose payload contents. A `0` violation count confirms that
the known upstream finding has no observed historical violations; it does not
authorize a live database write.

## DANGEROUS approval khi land truc tiep khong co PR

Workflow nay dung hai commit bat bien de tranh `approvalCommit` tu tham chieu:

1. Commit candidate migration, sau do chay static voi exact candidate SHA. Exit
   code `1` la expected khi report chi con finding `DANGEROUS`; command van ghi
   report canonical theo candidate SHA:

```bash
CANDIDATE_SHA="$(git rev-parse HEAD)"
node scripts/npm-run.js run db:quality-gate -- \
  --created-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --lane static \
  --persist-candidate-report true \
  --run-id "candidate-${CANDIDATE_SHA:0:12}" \
  --subject-commit "$CANDIDATE_SHA"
```

Report phai nam tai
`supabase/db-quality-gate-static-evidence/<candidate-SHA>.json`, co
`requiredChecksComplete=true`, `evidenceAvailable=true`, khong co finding
`BLOCKING`, va digest tu tinh phai khop.

2. Maintainer review exact report va statement. Them report canonical cung
   approval record vao `supabase/db-quality-gate-waivers.json`. Record phai bind
   exact candidate SHA, report digest, finding fingerprint, migration path,
   migration content SHA-256, review evidence, expiry/revocation state, risk,
   validation, va recovery plan.
3. Tao mot approval commit la direct child cua candidate commit. Khong sua
   migration sau candidate run, khong squash hai commit, va khong them commit
   trung gian sau approval.
4. Sau khi approval commit da land vao `main`, checkout exact clean landed HEAD
   va chay trusted landed path voi ca hai SHA explicit:

```bash
LANDED_SHA="$(git rev-parse HEAD)"
CANDIDATE_SHA="$(git rev-parse "${LANDED_SHA}^1")"
node scripts/npm-run.js run db:quality-gate -- \
  --landed-parent-commit "$CANDIDATE_SHA" \
  --lane static \
  --run-id "landed-${LANDED_SHA:0:12}" \
  --subject-commit "$LANDED_SHA"
```

Khong dung lenh static mac dinh sau khi `origin/main == HEAD` de tao landed
evidence; diff rong phai la `INCOMPLETE`, khong phai `PASS`. Missing/stale
report, content thay doi, approval het han/revoked/superseded, dirty worktree,
hoac subject khong phai approval-bearing direct child deu fail closed.

Approval `DANGEROUS` chi cho phep finding duoc chap nhan khi aggregate static.
No khong cap quyen ghi live DB. Moi live apply van can permission rieng, moi,
explicit cho exact Supabase MCP operation sau khi static va Oracle
baseline-forward cung PASS tren cung exact landed commit.

## Bien moi truong tren Codex VPS

Baseline-forward tu dong chay control tren mot clone disposable cua restored
baseline truoc candidate. Report ghi rieng `baselineControlSqlTestExecution` va
`sqlTestExecution`. Theo quyet dinh maintainer ngay 2026-09-05, loi SQL
deterministic cua control khong ngan candidate chay de doi chieu; loi ha tang,
timeout, parser, evidence hoac cleanup van chan. Quy tac nay thay dieu kien
"control phai PASS truoc candidate" cu; AGENTS.md/CLAUDE.md duoc giu nguyen
theo yeu cau maintainer. Static
lane dung cung rollback parser de loai SQL test khong tuong thich truoc khi vao
Oracle. Executor cho phep directive dau file `\set ON_ERROR_STOP on` va
savepoint noi bo hop le, nhung van cam `COMMIT`, nested transaction va cac psql
meta-command khac. Psql diagnostic dung `VERBOSITY=verbose`; report chi giu
category/SQLSTATE/SHA-256 va `failureSignature` cua loi/stack, khong luu raw stderr.

### No SQL cu: canh bao co bang chung, khong bo test

- Moi test van chay tren ca control va candidate. `baselineControlFindings`
  luu loi control tach biet, khong danh dong voi loi candidate.
- `baselineDebt` trong registry chi duoc them sau khi xac minh assertion cu:
  SHA-256 source test, SQLSTATE, failureSignature, protectedObjects, ly do va
  report Oracle goc. Khong tu dong chap nhan moi test dang do.
- Chi downgrade thanh `dynamic.sql-test.baseline-debt` WARNING khi control va
  candidate cung khop day du authority tren, va pending SQL khong tham chieu
  protectedObjects. SQLSTATE trung nhau la chua du.
- Test co `requiredForMigrations` trung pending migration bat buoc PASS;
  khong duoc mien tru loi dang can sua. Cac test #957 duoc rang buoc ro rang.
- Test PASS truoc/FAIL sau, loi khac, source thay doi, no chua duoc xac minh,
  loi apply migration, hoac thieu execution evidence van chan.
- Loi control bien mat sau candidate duoc ghi `baseline-repaired`; no khong
  can mien tru. PASS kem WARNING khong dong nghia baseline da het no.
- Cache control hien chi reuse run khong co loi baseline. Run co no cu se
  chay lai control de tranh dung lai authority khong con hop le.

Mot baseline-control PASS co the duoc reuse tu report baseline-forward truoc
neu baseline state, harness, registries, invariants va noi dung SQL tests khong
doi:

```bash
node scripts/npm-run.js run db:quality-gate -- \
  --baseline-control-run-id '<previous-pass-run-id>' \
  --baseline-control-digest '<previous-pass-digest>' \
  --lane baseline-forward \
  --run-id '<new-unique-run-id>' \
  --subject-commit "$(git rev-parse HEAD)"
```

Evidence sai identity/hash se fail closed; bo hai option control de chay lai
control clone. Ca control va candidate van chi chay tren disposable databases.

```bash
export ORACLE_DATABASE_QUALITY_GATE_HOST=149.118.148.179
export ORACLE_DATABASE_QUALITY_GATE_SSH_USER=ubuntu
export ORACLE_DATABASE_QUALITY_GATE_SSH_KEY_PATH=/root/Oracle/ssh-key-2026-05-13.key
export ORACLE_DATABASE_QUALITY_GATE_SSH_KNOWN_HOSTS_PATH=/root/Oracle/known_hosts
export ORACLE_DATABASE_QUALITY_GATE_SSH_HOST_KEY_FINGERPRINT='<pinned SHA256 fingerprint>'
```

Khong commit key, token, `.env`, `known_hosts`, confirmation tam, hoac output co
credential. Executor chi chap nhan evidence directory co dinh
`/opt/supabase-test/quality-gate/evidence`.

## Checkout read-only tren Oracle

Repository la public, nen checkout dung HTTPS khong credential. Chay script tai
exact commit da land:

```bash
ssh -i /root/Oracle/ssh-key-2026-05-13.key ubuntu@149.118.148.179
bash -s -- '<exact-40-character-commit>' \
  < scripts/db-quality-gate/oracle-checkout.sh
```

Checkout nam tai `/opt/supabase-test/quality-gate/repository`, detached HEAD,
origin co dinh, credential helper rong, va permissions khong mo cho group/other.

## Tao manifest tu live read-only

Chi tao manifest sau khi exact commit da land. Dung Supabase MCP
`list_migrations` va read-only `execute_sql`; khong dung Supabase CLI va khong
ghi live DB.

1. Lay `version`, `name`, va SHA-256 cua `statements[1]`.
2. Doi chieu SHA-256 voi canonical local migration tai exact landed commit:

```bash
node -e "const fs=require('fs'),c=require('crypto');const s=fs.readFileSync(process.argv[1],'utf8').replace(/\n$/,'');console.log(c.createHash('sha256').update(s).digest('hex'))" \
  supabase/migrations/<local-file>.sql
```

3. Dung read-only `execute_sql` voi catalog query cung contract
   `BASELINE_OBSERVATION_QUERY` de lay moi RPC `technical_configuration_*` theo:
   `identity`, `definitionSha256`, `owner`, `executionMode`, `searchPath`, va
   `executeGrantees`.
4. Sap xep migrations theo `liveVersion`, catalog theo `identity`, va grantees
   theo ten. Tinh `catalogSha256` tren canonical JSON cua catalog da normalize.
5. Tao file tam ngoai repository, vi du `/tmp/oracle-baseline-manifest.json`:

```json
{
  "catalogSha256": "<normalized-technical-configuration-catalog-sha256>",
  "migrations": [
    {
      "liveName": "migration_name_without_timestamp",
      "liveVersion": "20260819062043",
      "path": "supabase/migrations/20260819031200_migration_name_without_timestamp.sql",
      "sha256": "<canonical-local-and-live-SQL-sha256>"
    }
  ],
  "schemaVersion": 1,
  "sourceCommit": "<exact-40-character-landed-commit>",
  "targetMigrationHighWater": "20260819062043",
  "technicalConfigurationCatalog": [
    {
      "definitionSha256": "<function-definition-sha256>",
      "executeGrantees": ["authenticated"],
      "executionMode": "definer",
      "identity": "public.technical_configuration_example(uuid)",
      "owner": "postgres",
      "searchPath": "public, pg_temp"
    }
  ]
}
```

Command maintenance parse va hash lai manifest; malformed, duplicate,
contradictory high-water, stale source commit, hoac catalog hash sai deu
`INCOMPLETE`. Khong dua migration vao manifest neu live read-back thieu, name
khac, hoac SQL hash khac.

## Role matrix

| Role             | Quyen truoc/sau maintenance                                                      | Quyen tam thoi                             |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| `supabase_admin` | quan ly schema `public`, `SET ROLE postgres`, `SELECT/INSERT` migration metadata | khong                                      |
| `postgres`       | `USAGE` tren `public`, khong co `CREATE`                                         | `CREATE` chi trong luc apply migration SQL |

Preflight role va metadata conflict phai PASS truoc khi publish unhealthy state,
`GRANT`, hoac chay migration SQL. Moi migration attempt deu `REVOKE CREATE`
trong `finally` va query lai de xac nhan privilege da sach.

## Baseline health va recovery

Lenh `health` chi recovery mot catch-up da publish state v2. No khong bootstrap
state v1 va khong replay migration SQL.

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation health \
  --run-id phase5-health-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --manifest /tmp/oracle-baseline-manifest.json
```

Atomic state nam tai
`/opt/supabase-test/quality-gate/baseline/current.json`. Maintenance ghi file
tam mode `0600`, atomic rename, sau do dat mode `0400`. Healthy va high-water
luon nam trong cung mot snapshot. Dynamic preflight chi chap nhan healthy state
v2, re-query database, va doi chieu exact migration identities, structural
health, temporary privilege, va Technical Configurations catalog.

| State/DB observation                                                          | `health` action                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| metadata exact va observation/catalog exact                                   | publish healthy v2                                                      |
| phase `sql-applied`, metadata missing, migration identity/hash exact manifest | ghi metadata bang `supabase_admin`, read-back exact, roi verify/publish |
| temporary `CREATE` con leak                                                   | revoke va verify truoc khi tiep tuc                                     |
| phase `prepared`                                                              | `INCOMPLETE`; bat buoc full refresh                                     |
| metadata conflict, hash/source mismatch, hoac catalog mismatch                | `INCOMPLETE`; bat buoc full refresh                                     |

## Incremental catch-up

Chi chay sau khi tung migration trong manifest da duoc xac nhan applied live
bang read-only MCP. Catch-up sua truc tiep persistent `qltbyt_test`; no khong
dung staging database va khong duoc xem la disposable:

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation catch-up \
  --run-id phase5-catch-up-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --manifest /tmp/oracle-baseline-manifest.json
```

Thu tu fail-closed:

1. acquire global Oracle lease lock;
2. preflight role capabilities va metadata status cho toan bo manifest;
3. publish phase `prepared`;
4. grant tam `CREATE`, apply exact canonical SQL as `postgres`, revoke va verify;
5. publish phase `sql-applied`;
6. ghi metadata as `supabase_admin`, read-back exact name/hash, publish
   `metadata-recorded`;
7. verify migration records, structural health, privilege va catalog exact;
8. atomic publish healthy v2;
9. release lock.

Neu buoc 4-8 loi, baseline giu `healthy=false`. Chi dung `health` cho
`sql-applied`/`metadata-recorded` exact; phase `prepared` hoac ambiguity bat
buoc full refresh.

## Serialized full refresh

Full refresh restore vao `dq_baseline_refresh_<run-id>`, verify day du, roi moi
rename/swap voi `qltbyt_test`. Baseline khong bao gio duoc publish healthy khi
staging dang restore.

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation full-refresh \
  --run-id phase5-refresh-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --manifest /tmp/oracle-baseline-manifest.json \
  --dump /opt/supabase-test/backups/<verified-dump>.dump
```

Dump phai nam trong `/opt/supabase-test/backups`, da qua `pg_restore --list` va
SHA-256 verification. Manifest phai bao gom moi migration can catch-up tu dump
den confirmed-live high-water. State v1 chi duoc doc de chay explicit
full-refresh upgrade; dynamic preflight va `health` khong duoc tin state v1.
Full refresh chi publish healthy sau khi staging va swapped baseline deu exact,
retired database da xoa, `dq_*` count bang 0, va temporary privilege da sach.

## Evidence va invalidation

```bash
ssh -i /root/Oracle/ssh-key-2026-05-13.key ubuntu@149.118.148.179 \
  "find /opt/supabase-test/quality-gate/evidence -mindepth 2 -maxdepth 2 -name report.json -printf '%m %p\n' | sort"
```

Baseline-forward report chi reusable khi `outcome=PASS`, report high-water khop,
va `inputHashes.baselineState` khop atomic state hash hien tai. Catch-up, refresh
hoac health generation moi se invalidate evidence cu.

## Handoff xin phep live apply qua Supabase MCP

Checklist nay la ranh gioi bat buoc giua pre-live PASS va live write. PASS khong
phai la permission va khong duoc tu dong kich hoat bat ky live write nao.

1. Refresh public `origin/main`, resolve exact landed SHA, va xac nhan
   `subjectCommit == HEAD == origin/main`. PR-head, feature-branch HEAD, SHA
   chua land, hoac `origin/main` stale deu khong du dieu kien.
2. Chay fresh static tren immutable `landed-parent..landed-SHA` va
   baseline-forward tren cung exact landed SHA. Khong reuse evidence cua PR
   head. Ca hai report phai co `outcome=PASS`,
   `requiredChecksComplete=true`, `evidenceAvailable=true`, va
   `subjectCommit=<exact-landed-SHA>`.
3. Hoan tat read-only live va baseline comparisons. Chi tiep tuc khi project,
   migration order/high-water, baseline state, va moi immutable input hash deu
   healthy va khop.
4. Load moi report tu immutable Oracle run ID, recompute va verify `digest`, sau
   do trinh bay day du payload evidence:

```yaml
landedSha: <exact-40-character-landed-SHA>
static:
  evidenceId: oracle:<static-run-id>/report.json
  digest: <verified-static-report-digest>
baselineForward:
  evidenceId: oracle:<baseline-forward-run-id>/report.json
  digest: <verified-baseline-forward-report-digest>
```

5. Gui mot permission request moi, gan voi dung `landedSha`, project
   `cdthersvldpnlbvpufrr`, exact migration path/name, va hai cap
   `evidenceId`/`digest` tren. Permission phai la cau tra loi affirmative ro
   rang cho exact live apply hien tai; permission cu, blanket, im lang, mo ho,
   hoac permission cho target/operation khac deu khong hop le.
6. Chi sau khi nhan permission hop le, operator moi apply dung migration da
   duoc review qua Supabase MCP. Khong dung Supabase CLI, khong nhung apply
   command vao gate/tooling, va khong batch them migration hay live write ngoai
   permission.
7. Ngay sau apply, operator dung read-only Supabase MCP de capture observation
   cho Task 6.5 voi `schemaVersion=1`, `source=supabase-mcp`,
   `projectRef=cdthersvldpnlbvpufrr`, `capturedAt`, canonical
   `migrationPath`, `liveVersion`, `liveName`, va non-empty `statements[]`.
   Persist raw observation va normalized digest-bearing read-back record duoi
   mot immutable Oracle run ID. Chua co read-back match thi chua duoc bat dau
   reconciliation hoac claim live apply da verified.

## Recovery va cleanup

Kiem tra state, lock va database tam:

```bash
ssh -i /root/Oracle/ssh-key-2026-05-13.key ubuntu@149.118.148.179 '
  set -eu
  cat /opt/supabase-test/quality-gate/baseline/current.json
  find /opt/supabase-test/quality-gate/locks -mindepth 1 -maxdepth 2 -print
  docker exec supabase-db psql -X -U postgres -d postgres -tA \
    -c "select datname from pg_database where datname like '\''dq_%'\'' order by datname"
'
```

Chi claim aggregate PASS khi static va baseline-forward PASS tren cung exact
commit, report day du doc duoc, `dq_*` count bang 0, va lock directory sach.
Bootstrap/fresh replay van la deferred non-blocking maintenance, khong duoc dua
tro lai blocking pre-live gate.
