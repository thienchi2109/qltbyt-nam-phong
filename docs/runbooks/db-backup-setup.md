# Database Backup Setup

Set up daily Supabase Postgres dumps on the VPS. Backups are written locally to
`/root/DB-backup/cvmems/`; operators can copy them to Google Drive or a local PC
with `scp`, `rsync`, or another manual process.

This runbook does not configure Google Drive or rclone. The old rclone upload
path was removed because Drive API quota errors made the cron job unreliable.

## 1. Files

| Concern | Path |
|---|---|
| Script | `scripts/backup-db.sh` |
| Env template | `scripts/backup-db.env.example` |
| Cron template | `scripts/qltbyt-backup.cron.example` |
| Live env | `/etc/qltbyt-backup/.env` |
| Live command | `/usr/local/bin/qltbyt-backup` |
| Backup dir | `/root/DB-backup/cvmems/` |
| Main log | `/var/log/qltbyt-backup.log` |
| Detail logs | `/var/log/qltbyt-backup/` |

## 2. Install Dependencies

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client-17 curl coreutils util-linux

pg_dump --version
psql --version
curl --version
flock --version
```

`pg_dump` should match the Supabase Postgres major version when possible.

## 3. Install Script

From the repo checkout on the VPS:

```bash
sudo install -m 0755 scripts/backup-db.sh /usr/local/bin/qltbyt-backup
sudo install -d -m 0700 /root/DB-backup/cvmems
sudo install -d -m 0755 /etc/qltbyt-backup
sudo install -d -m 0755 /var/log/qltbyt-backup
```

## 4. Create Env File

```bash
sudo install -m 0600 scripts/backup-db.env.example /etc/qltbyt-backup/.env
sudo nano /etc/qltbyt-backup/.env
```

Set at minimum:

```bash
DATABASE_URL="postgresql://postgres:REPLACE_PASSWORD@db.cdthersvldpnlbvpufrr.supabase.co:5432/postgres?sslmode=require"
BACKUP_DIR="/root/DB-backup/cvmems"
RETAIN_DAYS=7
DUMP_SCHEMAS="public,auth,storage,supabase_migrations"
```

Telegram is optional but recommended:

```bash
TG_TOKEN="REPLACE_TOKEN"
TG_CHAT="REPLACE_CHAT_ID"
TG_HEARTBEAT=0
```

Use `TG_HEARTBEAT=1` temporarily when validating the setup.

## 5. Get The Database Connection String

Use the direct Supabase database URI:

1. Supabase Dashboard -> Project Settings -> Database.
2. Connection string -> URI.
3. Prefer direct connection on port `5432`.

Do not commit the filled env file. It contains the production database password.

## 6. Manual Smoke Test

Run one backup manually:

```bash
sudo /usr/local/bin/qltbyt-backup
sudo tail -n 30 /var/log/qltbyt-backup.log
sudo ls -lh /root/DB-backup/cvmems/
```

A successful log ends with:

```text
OK local backup size=...
DONE /root/DB-backup/cvmems/<timestamp>.dump ...
```

Verify the dump header:

```bash
LATEST=$(sudo find /root/DB-backup/cvmems -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
sudo file "$LATEST"
```

Expected output includes `PostgreSQL custom database dump`.

## 7. Install Cron

```bash
sudo install -m 0644 scripts/qltbyt-backup.cron.example /etc/cron.d/qltbyt-backup
sudo service cron reload
```

The template runs at `15:00 UTC`, which is `22:00 ICT`.

## 8. Rotation

`RETAIN_DAYS=7` keeps local `.dump` files for seven days. Rotation runs only
after a successful new dump:

```bash
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -mtime +"$RETAIN_DAYS" -delete
```

Rotation failures are non-fatal. The new dump remains in place and Telegram gets
a warning if Telegram is configured.

## 9. Copy Backups Off The VPS

Example from a laptop:

```bash
scp root@mystartup:/root/DB-backup/cvmems/20260518T*.dump .
```

Or copy the newest dump:

```bash
ssh root@mystartup "ls -1t /root/DB-backup/cvmems/*.dump | head -1"
scp root@mystartup:/root/DB-backup/cvmems/<dump-name>.dump .
```

## 10. Troubleshooting

### `pg_dump failed`

Check:

```bash
sudo tail -n 80 /var/log/qltbyt-backup/latest-pg_dump.stderr.log
sudo tail -n 80 /var/log/qltbyt-backup.log
```

Common causes:

- Wrong database password.
- Network path to Supabase is blocked.
- `pg_dump` is too old for the server version.

### `database unreachable`

Check the direct connection string:

```bash
sudo bash -c 'set -a; . /etc/qltbyt-backup/.env; set +a; psql "$DATABASE_URL" -c "select 1"'
```

### `backup file too small`

The script aborts if the dump is under 1 KiB. Inspect the detail log:

```bash
sudo tail -n 80 /var/log/qltbyt-backup/latest-pg_dump.stderr.log
```

### No Telegram Alert

Check `TG_TOKEN` and `TG_CHAT` in `/etc/qltbyt-backup/.env`. Telegram failure is
logged as a warning and never masks the backup result.

## 11. Decommission

Disable the cron job without deleting existing dumps:

```bash
sudo rm -f /etc/cron.d/qltbyt-backup
sudo service cron reload
```

Delete old local backups only after confirming they were copied elsewhere:

```bash
sudo find /root/DB-backup/cvmems -maxdepth 1 -type f -name '*.dump' -print
```
