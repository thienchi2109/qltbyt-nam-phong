# Database Quality Gate - Oracle baseline operations

Tai lieu nay chi danh cho Oracle test VM. Live Supabase luon read-only trong
toan bo quy trinh nay. Khong dung Supabase CLI, khong tao cron/timer tren Codex
VPS, va khong chay migration candidate truc tiep tren `qltbyt_test`.

## Bien moi truong tren Codex VPS

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

## Tao confirmation tu live read-only

1. Dung Supabase MCP `list_migrations` va read-only `execute_sql`.
2. Lay `version`, `name`, va SHA-256 cua `statements[1]`.
3. Doi chieu SHA-256 voi canonical local migration:

```bash
node -e "const fs=require('fs'),c=require('crypto');const s=fs.readFileSync(process.argv[1],'utf8').replace(/\n$/,'');console.log(c.createHash('sha256').update(s).digest('hex'))" \
  supabase/migrations/<local-file>.sql
```

4. Tao file tam ngoai repository, vi du `/tmp/confirmed-live.json`:

```json
[
  {
    "liveName": "migration_name_without_timestamp",
    "liveVersion": "20260819062043",
    "path": "supabase/migrations/20260819031200_migration_name_without_timestamp.sql",
    "sha256": "<canonical-local-and-live-SQL-sha256>"
  }
]
```

Khong dua migration vao confirmation neu live read-back thieu, name khac, hoac
SQL hash khac. Trong truong hop do, dung lai voi trang thai reconciliation
required.

## Baseline health va bootstrap

Lenh `health` dung cho bootstrap metadata lan dau va recovery sau interruption.
No chi publish healthy khi Oracle high-water, live name, SQL hash, invalid index
count va unvalidated constraint count deu khop.

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation health \
  --run-id phase5-health-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --confirmations /tmp/confirmed-live.json
```

Atomic state nam tai
`/opt/supabase-test/quality-gate/baseline/current.json`. Maintenance ghi file
tam mode `0600`, atomic rename, sau do dat mode `0400`. Healthy va high-water
luon nam trong cung mot snapshot.

## Incremental catch-up

Chi chay sau khi tung migration trong confirmation da duoc xac nhan applied
live bang read-only MCP:

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation catch-up \
  --run-id phase5-catch-up-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --confirmations /tmp/confirmed-live.json
```

Thu tu fail-closed:

1. acquire global Oracle lease lock;
2. publish `healthy=false` voi recovery target;
3. apply exact canonical local SQL vao `qltbyt_test`;
4. ghi exact live migration metadata;
5. verify health va high-water;
6. atomic publish healthy snapshot;
7. release lock.

Neu buoc 3-6 loi, baseline giu `healthy=false`. Khong rerun migration mot cach
mu quang; dung `health` neu DB da khop exact target, hoac full refresh.

## Serialized full refresh

Full refresh restore vao `dq_baseline_refresh_<run-id>`, verify day du, roi moi
rename/swap voi `qltbyt_test`. Baseline khong bao gio duoc publish healthy khi
staging dang restore.

```bash
node scripts/npm-run.js run db:quality-gate:baseline -- \
  --operation full-refresh \
  --run-id phase5-refresh-<unique-id> \
  --subject-commit "$(git rev-parse HEAD)" \
  --confirmations /tmp/confirmed-live.json \
  --dump /opt/supabase-test/backups/<verified-dump>.dump
```

Dump phai nam trong `/opt/supabase-test/backups`, da qua `pg_restore --list` va
SHA-256 verification. Confirmation phai bao gom moi migration can catch-up tu
dump den confirmed-live high-water.

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
