# Database Backup — One-Time Setup

> **Audience.** DevOps engineer or agent setting up the daily Supabase
> Postgres → Google Drive backup on a Linux VPS for the first time.
>
> **Out of scope.** If the backup is already running and you need to
> restore data, see [`db-restore.md`](./db-restore.md). Do not read this
> document during an incident.
>
> **Time required.** ~30 minutes the first time, mostly waiting on
> rclone OAuth and the smoke test.

---

## At a glance

```
Linux VPS (cron)
    │
    │ /etc/cron.d/qltbyt-backup    (schedule)
    ▼
/usr/local/bin/qltbyt-backup      (script)
    │
    ├── reads /etc/qltbyt-backup/.env       (secrets, mode 0600)
    ├── pg_dump -Fc | rclone rcat            (streaming, no temp file)
    ├── rclone delete --min-age 7d           (rotation)
    ├── curl Telegram bot on failure         (alerting)
    └── appends /var/log/qltbyt-backup.log   (log)

Google Drive
    └── gdrive:qltbyt-backup/
            ├── 20260426T190000Z.dump
            ├── 20260427T190000Z.dump
            └── ... (last 7 days)
```

**Files in repo (source of truth):**

| Path | Purpose |
|---|---|
| `scripts/backup-db.sh` | The script. Install to `/usr/local/bin/qltbyt-backup`. |
| `scripts/backup-db.env.example` | Env template. Copy to `/etc/qltbyt-backup/.env` and fill in. |
| `scripts/qltbyt-backup.cron.example` | Cron schedule. Install to `/etc/cron.d/qltbyt-backup`. |

**Files NOT in repo (live on the VPS only):**

| Path | Mode | Owner | Notes |
|---|---|---|---|
| `/etc/qltbyt-backup/.env` | `0600` | `root` | Contains `DATABASE_URL`, Telegram token. |
| `/etc/cron.d/qltbyt-backup` | `0644` | `root` | Cron requires this mode. |
| `/usr/local/bin/qltbyt-backup` | `0750` | `root` | The script. |
| `/var/log/qltbyt-backup.log` | `0640` | `root:adm` | Append-only log. |
| `/var/run/qltbyt-backup.lock` | `0600` | `root` | flock single-instance guard. |
| `~/.config/rclone/rclone.conf` | `0600` | (user running cron) | Rclone OAuth refresh token. |

---

## 1. Prerequisites

- Linux VPS with `cron` and `systemd`.
- `sudo` / root access.
- A personal Google account (to host the backup folder in Drive).
- Outbound network to `db.<ref>.supabase.co:5432` and
  `api.telegram.org:443` and `*.googleusercontent.com`.
- **IPv6 connectivity recommended.** Supabase's direct DB endpoint is
  IPv6 by default. If your VPS is IPv4-only, see §11 troubleshooting.
- A separate machine (laptop) with a graphical browser for the one-time
  rclone OAuth flow.

---

## 2. Install dependencies

The Supabase Postgres major version on this project is **17**. The
client tools must match that major version, otherwise `pg_dump` will
refuse to dump newer catalogs.

### Ubuntu 20.04 / 22.04

The default `apt` repository ships only PG 14/15. Add the official PGDG
repo to get PG 17:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
sudo apt-get install -y postgresql-client-17 rclone curl coreutils util-linux
```

### Debian 12

Same steps as above; PGDG also publishes for `bookworm`.

### Verify

```bash
pg_dump --version    # expect: pg_dump (PostgreSQL) 17.x
rclone --version     # any 1.60+
psql --version       # 17.x
flock --version      # part of util-linux
curl --version
```

If `pg_dump` is older than 17, the script will succeed against an
older project but fail today (PG 17). Re-check after install.

---

## 3. Configure rclone — Google Drive remote

You will run `rclone config` once. The OAuth flow needs a browser; if
the VPS is headless (the common case), do the OAuth on your laptop and
copy the resulting token to the server.

### Option A. VPS has a graphical browser

```bash
rclone config
# n  → New remote
# name> gdrive
# Storage> drive
# client_id     →  (leave blank, use rclone's default)
# client_secret →  (leave blank)
# scope         →  drive.file       ← important, see "Scope" below
# service_account_file → (blank)
# Edit advanced config? → n
# Use auto config? → y
#   (browser opens, sign in to Google, allow rclone)
# Configure as a Shared Drive? → n
# y/e/d → y (yes, this is OK)
# q → quit
```

### Option B. Headless VPS (recommended for production)

On your **laptop** install rclone and run:

```bash
rclone authorize "drive" --scope drive.file
```

It will print a JSON token. Then back on the **VPS**:

```bash
rclone config
# n → New remote
# name> gdrive
# Storage> drive
# client_id, client_secret → blank
# scope → drive.file
# service_account_file → blank
# Edit advanced config? → n
# Use auto config? → n        ← important on headless
# config_token>  <paste the JSON from your laptop>
# Configure as a Shared Drive? → n
# y/e/d → y
# q
```

### Scope

`drive.file` is the **least-privileged** scope. Rclone can only see and
manage files it itself created. It cannot read other files in your
Drive. This is what you want — a backup tool should not be able to
exfiltrate the rest of your Drive if compromised.

### Verify

```bash
rclone listremotes
# expected:  gdrive:

rclone mkdir gdrive:qltbyt-backup
rclone lsd   gdrive:                  # should list the folder
echo hello | rclone rcat gdrive:qltbyt-backup/_test.txt
rclone cat   gdrive:qltbyt-backup/_test.txt   # should print: hello
rclone delete gdrive:qltbyt-backup/_test.txt
```

If `_test.txt` round-trips, the remote is wired correctly.

---

## 4. Create a Telegram bot

1. Open Telegram, talk to **@BotFather**. Send `/newbot`. Choose a
   name and username (e.g. `qltbyt_backup_bot`). Save the **bot token**
   it returns. Format: `123456:ABCDEF...`.

2. Get the **chat ID** for where alerts should go.

   - **Personal alerts.** From your account, send any message to your
     new bot. Then run:

     ```bash
     curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq .
     ```

     Find `result[*].message.chat.id` — that is your chat ID
     (a positive integer for DMs).

   - **Group alerts.** Add the bot to the group, send any message in
     the group, then run the same `getUpdates` call. The chat ID for a
     group starts with `-100...`.

3. Test:

   ```bash
   curl -fsS \
     --data-urlencode chat_id="<CHAT_ID>" \
     --data-urlencode text="qltbyt-backup setup test" \
     "https://api.telegram.org/bot<TOKEN>/sendMessage"
   ```

   You should see the message in Telegram within a couple of seconds.
   If not, the token or chat ID is wrong.

---

## 5. Get the database connection string

In Supabase Dashboard → your project → **Project Settings → Database**.

- Scroll to **Connection string**, tab **URI**.
- Choose mode **Direct connection**. The URL looks like
  `postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres`.
- Append `?sslmode=require` if not already present.

**Do NOT use** the pooler / Supavisor URLs:

| URL fragment | Why not |
|---|---|
| port `6543` (transaction-mode pooler) | Does not support `pg_dump` at all. |
| `aws-0-...pooler.supabase.com` (session-mode pooler) | Has aggressive idle timeout; can break long dumps. |

Verify the URL works from the VPS:

```bash
psql "$DATABASE_URL" -c 'SELECT version();'
# expected: PostgreSQL 17.x ...
```

If this fails with `connection refused` and the VPS is IPv4-only, see
§11.

---

## 6. Install script and secrets

```bash
# Clone the repo somewhere readable by root (or copy these files in).
cd /opt
sudo git clone https://github.com/<your-org>/qltbyt-nam-phong.git
cd qltbyt-nam-phong

# Install the script.
sudo install -m 0750 -o root -g root \
  scripts/backup-db.sh /usr/local/bin/qltbyt-backup

# Create the env directory and file.
sudo install -d -m 0750 -o root -g root /etc/qltbyt-backup
sudo install -m 0600 -o root -g root \
  scripts/backup-db.env.example /etc/qltbyt-backup/.env
sudo "$EDITOR" /etc/qltbyt-backup/.env       # fill in real values

# Create the log file with sensible permissions.
sudo touch /var/log/qltbyt-backup.log
sudo chown root:adm /var/log/qltbyt-backup.log
sudo chmod 0640 /var/log/qltbyt-backup.log
```

After editing, double-check the env file is **only** readable by root:

```bash
sudo stat -c '%a %U:%G %n' /etc/qltbyt-backup/.env
# expected:  600 root:root /etc/qltbyt-backup/.env
```

---

## 7. Smoke test (manual run)

```bash
sudo /usr/local/bin/qltbyt-backup
```

**Expected.** Exit code `0`. New object in
`gdrive:qltbyt-backup/<timestamp>.dump`. Log ends with a `DONE` line.

```bash
echo "exit: $?"
sudo tail -20 /var/log/qltbyt-backup.log
rclone lsl gdrive:qltbyt-backup/
```

### Force-fail the alerting path

Before trusting the schedule, prove that failures DO produce a Telegram
message. Edit `/etc/qltbyt-backup/.env` and change the password in
`DATABASE_URL` to something wrong, then run the script:

```bash
sudo /usr/local/bin/qltbyt-backup
```

Expect: exit code `13`, a ❌ Telegram message arrives, log contains
`FATAL(13): database unreachable`. **Restore the correct password
afterwards.**

### (Optional) Heartbeat on success

For the first week it is useful to also receive a ✅ on every
successful run. Set `TG_HEARTBEAT=1` in the env file. Switch back to
`0` once you trust the job.

---

## 8. Install the cron schedule

```bash
sudo install -m 0644 -o root -g root \
  scripts/qltbyt-backup.cron.example /etc/cron.d/qltbyt-backup

# Reload cron so it picks up the new file.
sudo systemctl reload cron        # Debian / Ubuntu
# or:
sudo service cron reload
```

Verify cron registered the job:

```bash
sudo grep CRON /var/log/syslog | tail -5
# Look for a line about qltbyt-backup being parsed.
```

The default schedule is **02:00 ICT (19:00 UTC) daily**. If the VPS
itself is set to `Asia/Ho_Chi_Minh` instead of UTC, edit
`/etc/cron.d/qltbyt-backup` and change `0 19` to `0 2`.

To check the VPS timezone:

```bash
timedatectl | grep "Time zone"
```

---

## 9. Verify after the first scheduled run

The first scheduled run will happen the next 02:00 ICT after install.
The morning after, check:

```bash
# 1. New dump exists with today's date.
rclone lsl gdrive:qltbyt-backup/

# 2. Log shows a fresh DONE line.
sudo tail -50 /var/log/qltbyt-backup.log

# 3. No silent failures.
sudo grep -E '(FATAL|WARN|ERR)' /var/log/qltbyt-backup.log | tail -20
```

If anything is wrong, see §11 troubleshooting.

---

## 10. Retention behaviour

- Default: keep dumps for **7 days**. Older objects are deleted at the
  end of each successful run.
- Change: edit `RETAIN_DAYS` in `/etc/qltbyt-backup/.env`. Takes effect
  on the next run.
- Rotation is **idempotent**: it deletes by `--min-age`, not by
  counting files. Safe even if a few runs were missed.
- Rotation failure is **non-fatal**: the new dump is still uploaded; a
  ⚠️ Telegram message is sent so you can inspect Drive manually.

### Log rotation

The script appends to `/var/log/qltbyt-backup.log` forever. For a
long-running VPS, add a `logrotate` snippet:

```bash
sudo tee /etc/logrotate.d/qltbyt-backup >/dev/null <<'EOF'
/var/log/qltbyt-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  create 0640 root adm
}
EOF
```

---

## 11. Troubleshooting

### `pg_dump: server version 17.x; pg_dump version 15.x`
Client too old. Reinstall: `sudo apt install postgresql-client-17`
from the PGDG repo (§2).

### `rclone: oauth2: token expired and refresh token is not set`
Refresh the OAuth credentials:

```bash
rclone config reconnect gdrive:
```

If that does not work, delete and recreate the remote (§3).

### `psql: error: connection to server ... timeout`
- IPv4-only VPS hitting an IPv6-only Supabase endpoint. Either:
  - Buy Supabase's IPv4 add-on (paid), **or**
  - Use Supavisor **session-mode** endpoint (port 5432 host
    `aws-0-<region>.pooler.supabase.com`). Do **not** use transaction
    mode (port 6543) — `pg_dump` will fail.
- Firewall blocks outbound 5432. Check with `nc -vz <host> 5432`.

### `Telegram silent` (no message arrives)
- Wrong token: the bot rejects the request. Run a manual test (§4).
- Wrong chat ID: the bot is not a member of the chat, or the chat ID
  has the wrong sign (groups need `-100...`).
- Network blocks `api.telegram.org`. Check
  `curl -fsS https://api.telegram.org/`.

### `another instance holds lock; skipping this run`
The previous run is still going (slow network, large DB) or crashed
without releasing the lock. If no `qltbyt-backup` process exists, the
lock is stale:

```bash
ps aux | grep qltbyt-backup            # confirm nothing is running
sudo rm -f /var/run/qltbyt-backup.lock
```

### Dump is suspiciously small (`exit code 21`)
The script aborts when the upload is below 1 KiB. The likely cause is
a misconfigured `DUMP_SCHEMAS` (e.g. typo) producing an empty dump.
Run `pg_dump` manually with the same args and inspect.

### Manual reset (for testing)

```bash
sudo rm -f /var/run/qltbyt-backup.lock
sudo truncate -s 0 /var/log/qltbyt-backup.log
rclone delete --rmdirs gdrive:qltbyt-backup/
```

---

## 12. Security checklist

Before declaring setup complete, verify each box:

- [ ] `/etc/qltbyt-backup/.env` is mode `0600`, owner `root`.
- [ ] `~/.config/rclone/rclone.conf` is mode `0600` (rclone sets this
      by default; verify).
- [ ] No secret value (DB password, Telegram token) appears in
      `/etc/cron.d/qltbyt-backup` or in any cron command line — they
      would be visible to all users via `ps`. The script reads them
      from the env file only.
- [ ] `.env` is **not** committed to git. `git status` from the repo
      should never show it.
- [ ] The Telegram **bot itself** is private (not added to public
      groups; failure messages may include hostnames and recent log
      lines).
- [ ] The Google account used for `rclone` has 2FA enabled.
- [ ] Backups stored in Drive are **NOT encrypted at rest by this
      script**. The data is hospital-equipment / employee records;
      treat the Drive account as a sensitive credential. To add
      encryption later, see §13.

---

## 13. (Future) Adding encryption

Not configured in this version (intentional, for simplicity). When you
want encryption at rest in Drive, the simplest path is:

1. Add an `rclone crypt` remote on top of `gdrive:qltbyt-backup`:

   ```bash
   rclone config
   # n → new remote
   # name> gdrive_crypt
   # Storage> crypt
   # remote> gdrive:qltbyt-backup-encrypted
   # filename_encryption> standard
   # directory_name_encryption> true
   # password> <strong password>
   # password2> <salt>
   ```

2. Change `RCLONE_REMOTE` in `.env` from `gdrive:qltbyt-backup` to
   `gdrive_crypt:`.

3. **Important.** Store the `password` and `password2` somewhere
   **off the server**. Without them the encrypted dumps are useless.
   A password manager entry plus a printed copy in a safe is standard.

4. Update [`db-restore.md`](./db-restore.md) recovery prerequisites to
   include "rclone crypt password".

---

## 14. Uninstall

```bash
sudo systemctl stop cron 2>/dev/null || true
sudo rm -f /etc/cron.d/qltbyt-backup
sudo rm -f /usr/local/bin/qltbyt-backup
sudo rm -rf /etc/qltbyt-backup
# Keep /var/log/qltbyt-backup.log for postmortem; delete only if you
# are sure you no longer need the history.
sudo systemctl start cron 2>/dev/null || true

# Optional — remove rclone remote.
rclone config delete gdrive

# Optional — delete dumps from Drive (irreversible).
rclone delete --rmdirs gdrive:qltbyt-backup/
```

---

## Appendix: where the script lives

The canonical source for the script is **this repo**:
`scripts/backup-db.sh`. The copy at `/usr/local/bin/qltbyt-backup` is
the deployed copy.

When you change the script, redeploy with:

```bash
cd /path/to/qltbyt-nam-phong
git pull
sudo install -m 0750 -o root -g root \
  scripts/backup-db.sh /usr/local/bin/qltbyt-backup
```

Do **not** edit `/usr/local/bin/qltbyt-backup` directly on the VPS —
that copy is overwritten on the next deploy.
