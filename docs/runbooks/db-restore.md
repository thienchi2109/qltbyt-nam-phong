# Database Restore Runbook

> **Audience.** On-call engineer or agent recovering Supabase Postgres
> data after corruption, accidental deletion, malicious modification,
> or full project loss.
>
> **Out of scope.** First-time backup setup → see
> [`db-backup-setup.md`](./db-backup-setup.md).
>
> **Read this entire document before running any command.** There are
> two restore scenarios with very different procedures. Choosing the
> wrong one can make the situation worse.

---

## 0. Decide which scenario you are in

Answer this one question:

> **Can you still log in to the Supabase Dashboard for the project
> `cdthersvldpnlbvpufrr` and see your database?**

| Answer | Scenario |
|---|---|
| **Yes** — project is reachable; data inside is wrong, missing, or modified. | **Scenario A: in-place restore** |
| **No** — project is deleted, account locked, region-migrated, or Supabase will not respond. | **Scenario B: fresh-project restore** |

Scenario A covers ~95% of real incidents (a developer ran a bad
`DELETE`, an attacker dropped rows, a buggy migration corrupted a
table). Scenario B is rare and slower because it requires re-creating
platform-level configuration that lives outside Postgres.

---

## 1. Common prerequisites (both scenarios)

### Tools

| Tool | Version | How to check |
|---|---|---|
| `pg_restore` | major **17** | `pg_restore --version` |
| `psql` | major **17** | `psql --version` |
| `rclone` | any 1.60+ | `rclone --version` |
| `file`, `awk`, `numfmt` | coreutils | usually preinstalled |

If `pg_restore` is older than 17 it will not understand the dump
format produced by Postgres 17. Install per
[`db-backup-setup.md` §2](./db-backup-setup.md#2-install-dependencies).

### Credentials

- **Direct connection string** for the target DB (see
  [`db-backup-setup.md` §5](./db-backup-setup.md#5-get-the-database-connection-string)).
  Pooler URLs do not work for `pg_restore`.
- `rclone` configured with a remote that can read the backup folder.
  Either reuse the cron VPS, or configure rclone on your laptop with
  the same Google account (`rclone config` → §3 of the setup runbook).

### Locate and download the dump

```bash
# 1. List available dumps, sorted by date.
rclone lsl gdrive:qltbyt-backup/ | sort -k2

# 2. Pick a dump. Default to the most recent one that pre-dates the
#    incident. NEVER restore a dump created AFTER the corruption.
DUMP=20260426T190000Z.dump

# 3. Download.
rclone copy "gdrive:qltbyt-backup/${DUMP}" ./

# 4. Sanity check — pg_dump custom-format files start with "PGDMP".
file "$DUMP"
# expected: "<DUMP>: PostgreSQL custom database dump"

ls -lh "$DUMP"
```

If `file` says anything other than "PostgreSQL custom database dump",
the file is corrupt or partial. Try the dump from the previous day.

### Inspect the dump without restoring

You can list the contents to confirm it has what you expect:

```bash
pg_restore -l "$DUMP" | head -60          # TOC overview
pg_restore -l "$DUMP" | grep -c "^[0-9]"  # rough object count
pg_restore -l "$DUMP" | grep -E "TABLE|FUNCTION" | wc -l
```

For this project, a healthy dump should list **public**, **auth**,
**storage**, and **supabase_migrations** schemas, ~21 tables in
`public`, and ~175 SECURITY DEFINER functions.

---

## 2. Scenario A — In-place restore

The project is alive; you only want to fix specific rows, tables, or
schemas.

### A.1 Decide the smallest scope that fixes the incident

Restore is a **destructive** operation. Pick the smallest scope that
covers the damage:

| Scope | Use when |
|---|---|
| Single rows | A few records in one table were deleted/changed; you can identify them. |
| Single table (data-only) | A whole table was wiped (`DELETE FROM x`) or its rows were corrupted. |
| Whole `public` schema | Multiple app tables affected; functions/triggers also suspect. |
| Whole DB | Catastrophic logical damage; you would otherwise be re-creating the project. |

**Default to the smallest.** Going bigger is always available later.
Going smaller is not — once you have overwritten a table, the live
state of that table is gone.

### A.2 Snapshot the current (damaged) state FIRST

Before any restore, dump the current state to Drive in a quarantine
folder. If your restore makes things worse, you can roll back.

```bash
NOW=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump -Fc --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --schema=supabase_migrations \
  "$DATABASE_URL" \
  > "pre-restore-${NOW}.dump"

rclone copy "pre-restore-${NOW}.dump" gdrive:qltbyt-pre-restore/
```

Do not skip this step. It has saved more incidents than any other
single practice in this runbook.

### A.3 Reduce blast radius on the live app

Choose one (in order of preference):

1. **Maintenance flag** — if the app has one (check
   `internal_settings` table), enable it.
2. **Rotate the `service_role` JWT** in Supabase Dashboard → Settings
   → API. This will hard-fail every server-side call until the app is
   redeployed with the new key. Use only if you can also redeploy.
3. **Accept brief inconsistency** — if the restore is small (single
   table, few rows), users may see brief weird values; usually
   acceptable for a 30-second restore.

### A.4 Restore — single rows

If you can write a `WHERE` clause that identifies the affected rows,
this is the safest path. Extract and re-insert just those rows:

```bash
# 1. Extract the table from the dump into a working DB (e.g. local).
docker run --rm -d --name pgwork -p 15432:5432 \
  -e POSTGRES_PASSWORD=work postgres:17
sleep 4
WORK_URL="postgresql://postgres:work@localhost:15432/postgres"

pg_restore -d "$WORK_URL" --schema=public \
  --table=<table> --data-only --no-owner --no-privileges "$DUMP"

# 2. Export the rows you want.
psql "$WORK_URL" -c "\copy (SELECT * FROM <table> WHERE <cond>) \
  TO 'rows.csv' CSV HEADER"

# 3. Import into production (after a manual review of rows.csv).
psql "$DATABASE_URL" -c "\copy <table> FROM 'rows.csv' CSV HEADER"

docker stop pgwork
```

This pattern keeps you from touching anything you did not intend to
restore.

### A.5 Restore — single table (data-only)

```bash
# Optional: empty the corrupted table first, otherwise pg_restore will
# leave existing rows in place and only insert dump rows that do not
# conflict on PK.  TRUNCATE only if you want full overwrite.
psql "$DATABASE_URL" -c 'TRUNCATE TABLE public.<table> CASCADE;'

pg_restore \
  --dbname="$DATABASE_URL" \
  --schema=public --table=<table> \
  --data-only \
  --no-owner --no-privileges \
  --single-transaction \
  "$DUMP"
```

`--single-transaction` rolls everything back if any row insert fails,
so the live table is never left half-restored.

### A.6 Restore — whole `public` schema

This rebuilds tables, functions, triggers, indexes from the dump. Any
object in `public` that is not in the dump **will be dropped**.

```bash
# Sanity: how many functions and tables does the dump have for public?
pg_restore -l "$DUMP" | grep -E "SCHEMA - public|TABLE public\.|FUNCTION public\." | wc -l
```

If the count looks reasonable, run:

```bash
pg_restore \
  --dbname="$DATABASE_URL" \
  --schema=public \
  --clean --if-exists \
  --no-owner --no-privileges \
  --single-transaction \
  --jobs=2 \
  "$DUMP"
```

> **Pitfall.** If migrations have run since the backup (i.e. tables
> were added today that are not in `$DUMP`), `--clean` will drop them.
> If you are unsure, do A.4 / A.5 instead, or restore into a staging
> DB first and diff `psql -c "\dt public.*"` between staging and prod.

### A.7 Restore — `auth` schema

This project has **0 rows in `auth.users`** (custom auth via
`public.nhan_vien` instead). For most incidents you will not touch
the auth schema. If you do need to:

```bash
pg_restore \
  --dbname="$DATABASE_URL" \
  --schema=auth \
  --data-only \
  --no-owner --no-privileges \
  --single-transaction \
  "$DUMP"
```

**Pitfall.** If user IDs in `auth.users` have changed since the dump,
foreign keys from app tables will break or orphan. Cross-check before
restoring auth.

### A.8 Verify

```bash
psql "$DATABASE_URL" <<'SQL'
\timing
-- Row counts on the largest tables.
SELECT 'thiet_bi'             AS tbl, count(*) FROM public.thiet_bi
UNION ALL SELECT 'audit_logs',           count(*) FROM public.audit_logs
UNION ALL SELECT 'nhom_thiet_bi',        count(*) FROM public.nhom_thiet_bi
UNION ALL SELECT 'nhan_vien',            count(*) FROM public.nhan_vien
UNION ALL SELECT 'don_vi',               count(*) FROM public.don_vi
UNION ALL SELECT 'dia_ban',              count(*) FROM public.dia_ban
UNION ALL SELECT 'yeu_cau_sua_chua',     count(*) FROM public.yeu_cau_sua_chua
UNION ALL SELECT 'yeu_cau_luan_chuyen',  count(*) FROM public.yeu_cau_luan_chuyen;

-- Newest rows by created_at, sanity check that recent activity is present.
SELECT max(created_at) FROM public.thiet_bi;
SELECT max(created_at) FROM public.audit_logs;

-- Function count.
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef;
SQL
```

Compare to the pre-incident expectation. For this project:

| Metric | Reference (as of 2026-04-26) |
|---|---|
| `public` schema function count (SECURITY DEFINER) | ~175 |
| `public` table count | ~21 |
| Total DB size | ~29 MB |

If any value is dramatically smaller after restore, do **not** declare
success. Roll back from the pre-restore dump in §A.2.

### A.9 Run security advisors

```text
Use Supabase MCP:
  - get_advisors(project_id, type="security")
  - get_advisors(project_id, type="performance")
```

Confirm there are no new policy / role / extension regressions
introduced by the restore.

### A.10 Post-incident

- Re-enable the app (turn off maintenance / re-deploy with rotated
  keys).
- Write an incident report at
  `docs/incidents/YYYY-MM-DD-<short-topic>.md`. Include: timeline,
  scope of damage, exact restore commands run, verification results,
  and follow-up items (fix the root cause; do not just rely on the
  next backup).
- Bump retention to 30 days for a week, in case a related issue
  surfaces and you need a still-older dump:
  edit `RETAIN_DAYS=30` on the VPS, restore to `7` after a week.

---

## 3. Scenario B — Fresh-project restore

The original project is gone (deleted, account locked, region
migration). You are restoring into a brand new Supabase project.

### B.1 Create a new Supabase project

Use Supabase MCP `create_project`. Important parameters:

| Field | Value |
|---|---|
| `region` | `ap-southeast-1` (same as original; matches app latency) |
| Postgres version | 17 (current default; matches dump) |
| `name` | `ql-tbyt-restored-<date>` |
| `organization_id` | look up via MCP `list_organizations` |

After creation, save:
- new `ref` (project ID)
- new `anon` key
- new `service_role` key
- new JWT secret
- new database password (Settings → Database → Reset password if not
  shown on creation)

### B.2 Restore schema + data

```bash
NEW_URL="postgresql://postgres:<new-pwd>@db.<new-ref>.supabase.co:5432/postgres?sslmode=require"

# Confirm the new DB is empty before --clean would do anything bad.
psql "$NEW_URL" -c "\dt public.*"
# expected: "Did not find any relations."

# Restore (no --clean needed; DB is empty).
pg_restore \
  --dbname="$NEW_URL" \
  --no-owner --no-privileges \
  --single-transaction \
  "$DUMP"
```

If `--single-transaction` fails on a benign error (e.g. an extension
already exists in the new project), retry without it:

```bash
pg_restore \
  --dbname="$NEW_URL" \
  --no-owner --no-privileges \
  --exit-on-error=false \
  "$DUMP"
```

…and review the failures it logs.

### B.3 Re-apply migrations not in the dump

If the dump is older than the latest migration in git, the new project
is behind. Compare:

```bash
psql "$NEW_URL" -c "SELECT version FROM supabase_migrations.schema_migrations
                    ORDER BY version DESC LIMIT 5;"
ls supabase/migrations/ | sort | tail -5
```

For each migration in the repo that is NOT in `schema_migrations`,
apply via Supabase MCP **`apply_migration`** (one at a time, in
chronological order). **Do not** use `supabase db push` — see
[`AGENTS.md` §"Supabase CLI vs MCP"](../../AGENTS.md).

### B.4 Re-create platform-layer config (manual, NOT in dump)

The dump does not contain anything that lives outside Postgres. Walk
through this checklist in the new project's Dashboard:

| Area | Where | Notes |
|---|---|---|
| Auth providers (Email / OAuth) | Authentication → Providers | This project does not currently use Supabase Auth; if that changes in the future, configure here. |
| SMTP | Authentication → SMTP | Re-enter credentials. |
| Email templates | Authentication → Email Templates | Copy from a previous backup of the template text if you have one; otherwise re-write. |
| Site URL & redirect URLs | Authentication → URL Configuration | Update with current app URL. |
| Database extensions | Database → Extensions | The dump should `CREATE EXTENSION` for everything used (`vector`, `pg_net`, `pg_trgm`, `pgcrypto`, `uuid-ossp`, `btree_gist`, `pg_graphql`, `supabase_vault`, `pg_stat_statements`, `hypopg`, `index_advisor`). Verify each is enabled. |
| Vault secrets | Vault | This project has 0 vault secrets at time of writing; if added later, they must be re-entered (encrypted blobs from old project use a key that does not transfer). |
| Edge Functions | `supabase/functions/` (in repo) | Deploy via Supabase MCP `deploy_edge_function` for each function. Source is in git. |
| Realtime publications | SQL | The previous project published tables to `supabase_realtime`. Re-create with `ALTER PUBLICATION supabase_realtime ADD TABLE ...` for any tables the app subscribes to. Find the list with `SELECT relname FROM pg_publication_tables WHERE pubname='supabase_realtime'` against the OLD project (if reachable) or by reading client subscription code. |
| API rate limits, network restrictions | Settings | Re-apply if previously customised. |

### B.5 Update the app to point at the new project

```bash
# .env.local on the app
NEXT_PUBLIC_SUPABASE_URL=https://<new-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key>

# Any server that verifies JWTs locally needs the new JWT secret.
SUPABASE_JWT_SECRET=<new-jwt-secret>
```

Redeploy the app (Vercel / wherever it runs).

### B.6 Update the backup cron on the VPS

The VPS still points at the old `db.cdthersvldpnlbvpufrr...` host,
which no longer works. Edit the env file:

```bash
sudo "$EDITOR" /etc/qltbyt-backup/.env
# change DATABASE_URL to the new direct URL
```

Force a one-shot backup to verify:

```bash
sudo /usr/local/bin/qltbyt-backup
rclone lsl gdrive:qltbyt-backup/ | tail -5
```

### B.7 Update repo references

Edit and commit:

- `AGENTS.md`: update **Project ID** under "SQL Code Generation
  Checklist" and "Supabase CLI vs MCP".
- `CLAUDE.md`: same.
- This file (§3.1) lists the old `cdthersvldpnlbvpufrr` ref —
  update to the new one.

### B.8 Verify (extends §A.8)

In addition to the row-count and function-count checks:

- [ ] `psql "$NEW_URL" -c '\dx'` shows all extensions enabled.
- [ ] `psql "$NEW_URL" -c '\dt public.*'` shows all 21+ tables.
- [ ] App login from a real browser succeeds end-to-end.
- [ ] Real-time subscription works (open the app, modify a row,
      confirm UI updates).
- [ ] Supabase MCP `get_advisors(security)` returns 0 high-severity
      issues.
- [ ] An immediate manual `pg_dump` against the new project produces
      a file roughly the same size as the dump that was restored
      (small differences are normal).

---

## 4. Common pitfalls

### `pg_dump: server version 17.x; pg_dump version 15.x`
Wrong client version. Install `postgresql-client-17` from PGDG.

### `must be owner of table xxx`
Forgot `--no-owner`. Re-run with `--no-owner --no-privileges`.

### `role "anon" does not exist`
Restoring into plain Postgres instead of a Supabase project. The
Supabase platform pre-creates `anon`, `authenticated`, `service_role`.
Either restore into a real Supabase project, or pre-create those
roles in your local Postgres.

### `extension "..." already exists`
Benign in fresh Supabase projects (the platform pre-installs some
extensions). Switch from `--single-transaction` to
`--exit-on-error=false` and review the log.

### `connection terminated` mid-restore
Supavisor (pooler) timing out. Use the **direct** connection string,
not pooler.

### Storage bucket files missing
Not applicable to this project: `storage.buckets` and
`storage.objects` are empty as of 2026-04-26. If a future version of
the app starts using Supabase Storage, the binary objects would need a
separate backup (the `storage.objects` row is in the dump but the
actual file bytes live in S3-compatible storage and are NOT captured).

### Dump opens but `pg_restore` produces no rows
The dump may have been schema-only. Inspect:
`pg_restore -l "$DUMP" | grep "TABLE DATA" | wc -l`
should be > 0.

---

## 5. Recovery time estimates (this project, ~29 MB DB)

| Step | Estimated time |
|---|---|
| Decide scenario, locate dump | 2 min |
| Download dump from Drive | <1 min |
| Pre-restore quarantine dump (Scenario A) | <1 min |
| Restore single table (Scenario A.5) | <1 min |
| Restore whole `public` schema (Scenario A.6) | 1–2 min |
| Restore into fresh project (Scenario B.2) | 2–5 min |
| Re-apply missing migrations (Scenario B.3) | 5–15 min |
| Re-create platform config (Scenario B.4) | 15–30 min |
| Update app env + redeploy (Scenario B.5) | 5–10 min |
| Verification (§A.8 / §B.8) | 5–10 min |

**Practical totals**: Scenario A ≤ 15 min; Scenario B ≤ 60 min.

---

## 6. Test the runbook quarterly

A backup that has never been restored is a backup you do not have.
At least once per quarter, dry-run Scenario A against an ephemeral
local Postgres and verify row counts.

```bash
# Pull the latest dump.
LATEST=$(rclone lsl gdrive:qltbyt-backup/ | sort -k2 | tail -1 | awk '{print $NF}')
rclone copy "gdrive:qltbyt-backup/${LATEST}" /tmp/

# Run a throwaway PG 17 with the right roles pre-created.
docker run --rm -d --name pg-test -p 15432:5432 \
  -e POSTGRES_PASSWORD=test postgres:17
sleep 4
TEST_URL="postgresql://postgres:test@localhost:15432/postgres"
psql "$TEST_URL" -c "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;"

# Restore.
pg_restore -d "$TEST_URL" \
  --no-owner --no-privileges \
  --exit-on-error=false \
  "/tmp/${LATEST}"

# Spot-check row counts. Expected magnitudes (as of 2026-04-26):
psql "$TEST_URL" <<'SQL'
SELECT 'thiet_bi'      AS tbl, count(*) FROM public.thiet_bi
UNION ALL SELECT 'nhan_vien',  count(*) FROM public.nhan_vien
UNION ALL SELECT 'don_vi',     count(*) FROM public.don_vi
UNION ALL SELECT 'audit_logs', count(*) FROM public.audit_logs;
SQL

docker stop pg-test
rm -f "/tmp/${LATEST}"
```

If any step fails, treat it as an incident: the backup is not what you
thought. Investigate before the next real outage.

---

## Appendix: data the dump does NOT cover

For full transparency:

| Outside the dump | Where it lives | Recovery |
|---|---|---|
| Anon / service_role JWT keys | Supabase platform | Re-issued on new project; update `.env.local` and redeploy. |
| JWT secret | Supabase platform | Re-issued on new project. Old session tokens become invalid (often desirable post-incident). |
| Email templates, SMTP creds | Supabase platform | Re-enter manually. |
| Edge Function source code | Git (`supabase/functions/`) | Re-deploy from repo. |
| Storage bucket binary files | S3-compatible object store | App does not currently use Storage. |
| Vault secret plaintexts | Encrypted in `vault.secrets`, key at platform | Re-enter manually. |
| Realtime channel state, presence | In-memory / Redis | Stateless after restart. |

This list is **complete** for this project as of 2026-04-26. Re-audit
when the schema changes (especially if Storage usage is introduced).
