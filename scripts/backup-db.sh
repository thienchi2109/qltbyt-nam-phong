#!/usr/bin/env bash
# qltbyt-backup: stream pg_dump → Google Drive (via rclone) with Telegram alerts.
#
# Audience : DevOps / cron operator on a Linux VPS.
# Setup    : docs/runbooks/db-backup-setup.md
# Restore  : docs/runbooks/db-restore.md
# Env file : /etc/qltbyt-backup/.env  (template: scripts/backup-db.env.example)
#
# Exit codes:
#   0   success
#   10  config / env unreadable or missing required vars
#   11  missing dependency (pg_dump / rclone / curl / psql / flock)
#   12  rclone remote not configured
#   13  database unreachable
#   20  pg_dump | rclone rcat failed
#   21  uploaded object size sanity check failed
#
# Telegram notify failure is non-fatal (logged as WARN); never masks the
# original exit code from the backup pipeline.

set -Eeuo pipefail
IFS=$'\n\t'

# ─── Constants (overridable for testing) ────────────────────────────────
readonly SCRIPT_NAME="qltbyt-backup"
readonly ENV_FILE="${BACKUP_ENV_FILE:-/etc/qltbyt-backup/.env}"
readonly LOG_FILE="${BACKUP_LOG_FILE:-/var/log/qltbyt-backup.log}"
readonly LOCK_FILE="${BACKUP_LOCK_FILE:-/var/run/qltbyt-backup.lock}"
readonly HOSTNAME_SHORT="$(hostname -s 2>/dev/null || echo unknown)"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

BACKUP_REMOTE_PATH=""
BACKUP_SIZE_HUMAN=""

# ─── Logging helpers ────────────────────────────────────────────────────
# Log to file if writable, else stderr. Never fail because of logging.
log() {
  local ts
  printf -v ts '%(%Y-%m-%dT%H:%M:%S%z)T' -1
  if [[ -w "$LOG_FILE" ]] || { : >>"$LOG_FILE"; } 2>/dev/null; then
    printf '%s [%s] %s\n' "$ts" "$RUN_ID" "$*" >>"$LOG_FILE"
  else
    printf '%s [%s] %s\n' "$ts" "$RUN_ID" "$*" >&2
  fi
}

# Strip user:password out of a postgres URL before logging it.
mask_url() {
  sed -E 's#(://[^:/?#]+:)[^@]+(@)#\1***\2#' <<<"${1:-}"
}

# ─── Telegram notify (non-fatal) ────────────────────────────────────────
notify_telegram() {
  local text="$1"
  if [[ -z "${TG_TOKEN:-}" || -z "${TG_CHAT:-}" ]]; then
    log "WARN: telegram skipped (TG_TOKEN/TG_CHAT not set)"
    return 0
  fi
  if ! curl -fsS --max-time 10 \
        --data-urlencode "chat_id=${TG_CHAT}" \
        --data-urlencode "text=${text}" \
        "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" >/dev/null 2>&1; then
    log "WARN: telegram notify failed"
  fi
}

notify_failure() {
  local code="$1" stage="$2"
  # Truncate stage so the alert stays readable in chat. Full detail is
  # always available in $LOG_FILE.
  local stage_short
  if (( ${#stage} > 100 )); then
    stage_short="${stage:0:97}..."
  else
    stage_short="$stage"
  fi
  local ts
  ts="$(date -u '+%Y-%m-%d %H:%M UTC')"
  notify_telegram "$(cat <<EOF
❌ ${SCRIPT_NAME} FAILED
Host: ${HOSTNAME_SHORT}
Stage: ${stage_short}
Exit: ${code} · ${ts}
EOF
)"
}

notify_success() {
  [[ "${TG_HEARTBEAT:-0}" == "1" ]] || return 0
  local size_human="$1"
  notify_telegram "✅ ${SCRIPT_NAME} OK on ${HOSTNAME_SHORT} (${size_human})"
}

# ─── die: log + telegram + exit with mapped code ────────────────────────
die() {
  local code="$1"; shift
  local msg="$*"
  DIE_NOTIFIED=1
  log "FATAL($code): $msg"
  notify_failure "$code" "$msg"
  exit "$code"
}

# ─── ERR trap: catches unexpected failures from `set -e` ────────────────
on_err() {
  local rc=$?
  # Avoid double-notify if die() already ran (it exits before trap fires
  # via `exit "$code"`, so trap still triggers — guard with a flag).
  if [[ "${DIE_NOTIFIED:-0}" != "1" ]]; then
    log "ERR(unexpected): rc=$rc line=${BASH_LINENO[0]} cmd=${BASH_COMMAND}"
    notify_failure "$rc" "line ${BASH_LINENO[0]}: ${BASH_COMMAND}"
  fi
  exit "$rc"
}
trap on_err ERR

# ─── Stage: load env ────────────────────────────────────────────────────
load_env() {
  [[ -r "$ENV_FILE" ]] || die 10 "env file unreadable: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  : "${DATABASE_URL:?missing DATABASE_URL}" || die 10 "DATABASE_URL not set"
  : "${RCLONE_REMOTE:?missing RCLONE_REMOTE}" || die 10 "RCLONE_REMOTE not set"
  : "${RETAIN_DAYS:=7}"
  : "${DUMP_SCHEMAS:=public,auth,storage,supabase_migrations}"
  : "${TG_HEARTBEAT:=0}"
  log "env loaded (db=$(mask_url "$DATABASE_URL") remote=$RCLONE_REMOTE retain=${RETAIN_DAYS}d schemas=$DUMP_SCHEMAS)"
}

# ─── Stage: preflight checks ────────────────────────────────────────────
preflight() {
  local cmd
  for cmd in pg_dump rclone curl psql flock; do
    command -v "$cmd" >/dev/null 2>&1 || die 11 "missing dependency: $cmd"
  done

  local remote_name="${RCLONE_REMOTE%%:*}"
  if ! rclone listremotes 2>/dev/null | grep -qx "${remote_name}:"; then
    die 12 "rclone remote '${remote_name}:' not configured (run: rclone config)"
  fi

  if ! timeout 5 psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    log "preflight: db connect failed for $(mask_url "$DATABASE_URL")"
    die 13 "database unreachable"
  fi

  log "preflight OK"
}

# ─── Stage: dump + upload (streaming) ───────────────────────────────────
# Echoes "<remote_path>|<human_size>" to stdout on success.
run_backup() {
  local ts="${RUN_ID%-*}"
  local remote_path="${RCLONE_REMOTE%/}/${ts}.dump"

  local schema_args=()
  IFS=',' read -ra schemas <<<"$DUMP_SCHEMAS"
  local s
  for s in "${schemas[@]}"; do
    s="${s#"${s%%[![:space:]]*}"}"
    s="${s%"${s##*[![:space:]]}"}"
    [[ -n "$s" ]] && schema_args+=("--schema=$s")
  done

  log "START dump → ${remote_path}"

  # Streaming pipeline. pipefail (set above) makes either-side failure visible.
  local pipe_status=()
  if ! pg_dump -Fc --no-owner --no-privileges "${schema_args[@]}" "$DATABASE_URL" \
       | rclone rcat --retries 3 --retries-sleep 30s "$remote_path"; then
    pipe_status=("${PIPESTATUS[@]}")
    local pg_dump_rc="${pipe_status[0]:-1}"
    local rclone_rc="${pipe_status[1]:-1}"
    log "dump|upload failed for ${remote_path}"
    log "pipeline rc: pg_dump=${pg_dump_rc} rclone=${rclone_rc}"
    if (( rclone_rc != 0 && ( pg_dump_rc == 0 || pg_dump_rc == 141 ) )); then
      die 20 "upload failed (rclone=${rclone_rc}, pg_dump=${pg_dump_rc})"
    elif (( pg_dump_rc != 0 && rclone_rc != 0 )); then
      die 20 "pg_dump and upload failed (pg_dump=${pg_dump_rc}, rclone=${rclone_rc})"
    elif (( pg_dump_rc != 0 )); then
      die 20 "pg_dump failed (rc=${pg_dump_rc})"
    else
      die 20 "upload failed (rclone=${rclone_rc})"
    fi
  fi

  local size_bytes
  size_bytes="$(rclone size --json "$remote_path" 2>/dev/null \
                | grep -oE '"bytes":[[:space:]]*[0-9]+' \
                | grep -oE '[0-9]+' || echo 0)"
  if (( size_bytes < 1024 )); then
    log "size sanity failed at ${remote_path}"
    die 21 "uploaded size too small: ${size_bytes}B"
  fi

  local size_human
  size_human="$(numfmt --to=iec --suffix=B "$size_bytes" 2>/dev/null || echo "${size_bytes}B")"
  log "OK upload size=${size_bytes} (${size_human})"
  BACKUP_REMOTE_PATH="$remote_path"
  BACKUP_SIZE_HUMAN="$size_human"
}

# ─── Stage: rotate (non-fatal on failure) ───────────────────────────────
rotate() {
  log "rotate: deleting objects older than ${RETAIN_DAYS}d in ${RCLONE_REMOTE}/"
  if ! rclone delete --min-age "${RETAIN_DAYS}d" "${RCLONE_REMOTE%/}/" 2>>"$LOG_FILE"; then
    log "WARN: rotation failed (non-fatal)"
    notify_telegram "⚠️ ${SCRIPT_NAME}: rotation failed on ${HOSTNAME_SHORT} (backup itself succeeded)"
  fi
}

# ─── Main ───────────────────────────────────────────────────────────────
main() {
  # Acquire single-instance lock. If another run holds it, exit cleanly
  # so a backed-up cron queue does not pile up.
  exec 9>"$LOCK_FILE" 2>/dev/null || die 10 "cannot open lock file: $LOCK_FILE"
  if ! flock -n 9; then
    log "another instance holds lock; skipping this run"
    exit 0
  fi

  load_env
  preflight

  run_backup

  rotate

  notify_success "$BACKUP_SIZE_HUMAN"
  log "DONE ${BACKUP_REMOTE_PATH} ${BACKUP_SIZE_HUMAN}"
}

main "$@"
