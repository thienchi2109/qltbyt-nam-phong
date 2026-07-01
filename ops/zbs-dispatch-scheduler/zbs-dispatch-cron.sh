#!/bin/sh
set -eu

LOCK_FILE="${LOCK_FILE:-/tmp/zbs-dispatch.lock}"
ZBS_DISPATCH_URL="${ZBS_DISPATCH_URL:-https://www.cvmems.vn/api/cron/zbs-dispatch}"

timestamp() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

if [ -z "${CRON_SECRET:-}" ]; then
  echo "$(timestamp) zbs_dispatch skipped: CRON_SECRET is not configured"
  exit 64
fi

(
  flock -n 9 || {
    echo "$(timestamp) zbs_dispatch skipped: previous run still active"
    exit 0
  }

  response="$(
    curl --fail-with-body --silent --show-error \
      --request GET \
      --connect-timeout 10 \
      --max-time 60 \
      --retry 2 \
      --retry-delay 2 \
      --header "Authorization: Bearer ${CRON_SECRET}" \
      "${ZBS_DISPATCH_URL}" 2>&1
  )" || {
    status=$?
    echo "$(timestamp) zbs_dispatch failed: curl_exit=${status} response=${response}"
    exit "${status}"
  }

  echo "$(timestamp) zbs_dispatch ok: ${response}"
) 9>"${LOCK_FILE}"
