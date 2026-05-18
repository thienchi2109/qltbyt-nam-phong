#!/usr/bin/env bash
# qltbyt-backup: write pg_dump files to a local VPS directory with Telegram alerts.
#
# Audience : DevOps / cron operator on a Linux VPS.
# Setup    : docs/runbooks/db-backup-setup.md
# Restore  : docs/runbooks/db-restore.md
# Env file : /etc/qltbyt-backup/.env  (template: scripts/backup-db.env.example)
#
# Exit codes:
#   0   success
#   10  config / env unreadable or missing required vars
#   11  missing dependency (pg_dump / curl / psql / flock)
#   12  backup directory unavailable
#   13  database unreachable
#   20  pg_dump failed
#   21  backup file size sanity check failed
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
readonly DETAIL_DIR_DEFAULT="/var/log/qltbyt-backup"
readonly HOSTNAME_SHORT="$(hostname -s 2>/dev/null || echo unknown)"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

BACKUP_FILE_PATH=""
BACKUP_SIZE_HUMAN=""
BACKUP_DETAIL_DIR=""
BACKUP_DIR_VALUE=""
FAIL_FILE_PATH=""
FAIL_PG_DUMP_RC=""
FAIL_STDERR_SUMMARY=""
FAIL_PG_DUMP_STDERR_FILE=""

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

ensure_detail_dir() {
  if [[ -z "$BACKUP_DETAIL_DIR" ]]; then
    BACKUP_DETAIL_DIR="$DETAIL_DIR_DEFAULT"
  fi
  mkdir -p "$BACKUP_DETAIL_DIR" || die 10 "cannot create detail log dir: $BACKUP_DETAIL_DIR"
}

publish_detail_log() {
  local src="$1" latest_name="$2"
  ensure_detail_dir
  if [[ -f "$src" ]]; then
    cat "$src" >"${BACKUP_DETAIL_DIR}/${latest_name}"
  fi
}

stderr_excerpt() {
  local file="$1"
  if [[ ! -s "$file" ]]; then
    echo "no stderr captured"
    return 0
  fi

  tail -n 5 "$file" | tr '\n' ' ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
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
  local file_line="" rc_line="" stderr_line="" detail_line=""
  [[ -n "$FAIL_FILE_PATH" ]] && file_line=$'\n'"File: ${FAIL_FILE_PATH}"
  if [[ -n "$FAIL_PG_DUMP_RC" ]]; then
    rc_line=$'\n'"RC: pg_dump=${FAIL_PG_DUMP_RC:-?}"
  fi
  [[ -n "$FAIL_STDERR_SUMMARY" ]] && stderr_line=$'\n'"stderr: ${FAIL_STDERR_SUMMARY}"
  [[ -n "$FAIL_PG_DUMP_STDERR_FILE" ]] && detail_line=$'\n'"Detail: ${FAIL_PG_DUMP_STDERR_FILE}"

  notify_telegram "$(cat <<EOF
❌ ${SCRIPT_NAME} FAILED
Host: ${HOSTNAME_SHORT}
Stage: ${stage_short}
Exit: ${code} · ${ts}${file_line}${rc_line}${stderr_line}${detail_line}
EOF
)"
}

notify_success() {
  [[ "${TG_HEARTBEAT:-0}" == "1" ]] || return 0
  local size_human="$1"
  notify_telegram "✅ ${SCRIPT_NAME} OK on ${HOSTNAME_SHORT} (${size_human})"$'\n'"File: ${BACKUP_FILE_PATH}"
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
  : "${BACKUP_DIR:=/root/DB-backup/cvmems}"
  : "${RETAIN_DAYS:=7}"
  : "${DUMP_SCHEMAS:=public,auth,storage,supabase_migrations}"
  : "${TG_HEARTBEAT:=0}"
  : "${BACKUP_DETAIL_DIR:=$DETAIL_DIR_DEFAULT}"
  BACKUP_DIR_VALUE="$BACKUP_DIR"
  log "env loaded (db=$(mask_url "$DATABASE_URL") dir=$BACKUP_DIR_VALUE retain=${RETAIN_DAYS}d schemas=$DUMP_SCHEMAS)"
}

# ─── Stage: preflight checks ────────────────────────────────────────────
preflight() {
  local cmd
  for cmd in pg_dump curl psql flock; do
    command -v "$cmd" >/dev/null 2>&1 || die 11 "missing dependency: $cmd"
  done

  mkdir -p "$BACKUP_DIR_VALUE" || die 12 "cannot create backup directory: $BACKUP_DIR_VALUE"
  chmod 700 "$BACKUP_DIR_VALUE" || die 12 "cannot chmod backup directory: $BACKUP_DIR_VALUE"
  [[ -d "$BACKUP_DIR_VALUE" && -w "$BACKUP_DIR_VALUE" ]] || die 12 "backup directory not writable: $BACKUP_DIR_VALUE"

  if ! timeout 5 psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    log "preflight: db connect failed for $(mask_url "$DATABASE_URL")"
    die 13 "database unreachable"
  fi

  log "preflight OK"
}

# ─── Stage: dump to local filesystem ────────────────────────────────────
run_backup() {
  local ts="${RUN_ID%-*}"
  local backup_path="${BACKUP_DIR_VALUE%/}/${ts}.dump"
  local tmp_path="${backup_path}.tmp"

  local schema_args=()
  IFS=',' read -ra schemas <<<"$DUMP_SCHEMAS"
  local s
  for s in "${schemas[@]}"; do
    s="${s#"${s%%[![:space:]]*}"}"
    s="${s%"${s##*[![:space:]]}"}"
    [[ -n "$s" ]] && schema_args+=("--schema=$s")
  done

  ensure_detail_dir
  local pg_dump_stderr_file="${BACKUP_DETAIL_DIR}/${RUN_ID}-pg_dump.stderr.log"
  : >"$pg_dump_stderr_file"

  log "START dump → ${backup_path}"

  rm -f "$tmp_path"
  local pg_dump_rc=0
  (umask 077 && pg_dump -Fc --no-owner --no-privileges "${schema_args[@]}" "$DATABASE_URL" >"$tmp_path" 2>"$pg_dump_stderr_file") || pg_dump_rc=$?
  if (( pg_dump_rc != 0 )); then
    local pg_dump_stderr_tail
    pg_dump_stderr_tail="$(stderr_excerpt "$pg_dump_stderr_file")"

    publish_detail_log "$pg_dump_stderr_file" "latest-pg_dump.stderr.log"
    rm -f "$tmp_path"

    FAIL_FILE_PATH="$backup_path"
    FAIL_PG_DUMP_RC="$pg_dump_rc"
    FAIL_STDERR_SUMMARY="$pg_dump_stderr_tail"
    FAIL_PG_DUMP_STDERR_FILE="$pg_dump_stderr_file"

    log "pg_dump failed for ${backup_path}"
    log "pg_dump rc: ${pg_dump_rc}"
    log "pg_dump stderr tail: ${pg_dump_stderr_tail}"
    die 20 "pg_dump failed (rc=${pg_dump_rc})"
  fi

  publish_detail_log "$pg_dump_stderr_file" "latest-pg_dump.stderr.log"

  local size_bytes
  size_bytes="$(wc -c <"$tmp_path" | tr -d '[:space:]')"
  if (( size_bytes < 1024 )); then
    FAIL_FILE_PATH="$tmp_path"
    rm -f "$tmp_path"
    log "size sanity failed at ${backup_path}"
    die 21 "backup file too small: ${size_bytes}B"
  fi

  mv -f "$tmp_path" "$backup_path"

  local size_human
  size_human="$(numfmt --to=iec --suffix=B "$size_bytes" 2>/dev/null || echo "${size_bytes}B")"
  log "OK local backup size=${size_bytes} (${size_human})"
  BACKUP_FILE_PATH="$backup_path"
  BACKUP_SIZE_HUMAN="$size_human"
}

# ─── Stage: rotate local dumps (non-fatal on failure) ───────────────────
rotate() {
  log "rotate: deleting local dumps older than ${RETAIN_DAYS}d in ${BACKUP_DIR_VALUE}/"
  if ! find "$BACKUP_DIR_VALUE" -maxdepth 1 -type f -name '*.dump' -mtime +"${RETAIN_DAYS}" -delete 2>>"$LOG_FILE"; then
    log "WARN: rotation failed (non-fatal)"
    notify_telegram "⚠️ ${SCRIPT_NAME}: local rotation failed on ${HOSTNAME_SHORT} (backup itself succeeded)"
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
  log "DONE ${BACKUP_FILE_PATH} ${BACKUP_SIZE_HUMAN}"
}

main "$@"
