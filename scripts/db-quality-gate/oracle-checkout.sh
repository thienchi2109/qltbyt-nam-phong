#!/usr/bin/env bash
set -euo pipefail

readonly REPOSITORY_URL="https://github.com/thienchi2109/qltbyt-nam-phong"
readonly CHECKOUT_ROOT="/opt/supabase-test/quality-gate/repository"

commit="${1:-}"
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Usage: %s <exact-40-character-commit>\n' "$0" >&2
  exit 2
fi

umask 077
mkdir -p "$(dirname "$CHECKOUT_ROOT")"

if [[ ! -d "$CHECKOUT_ROOT/.git" ]]; then
  git -c credential.helper= clone --filter=blob:none --no-checkout \
    "$REPOSITORY_URL" "$CHECKOUT_ROOT"
fi

current_origin="$(git -C "$CHECKOUT_ROOT" remote get-url origin)"
if [[ "$current_origin" != "$REPOSITORY_URL" ]]; then
  printf 'Unexpected Oracle checkout origin: %s\n' "$current_origin" >&2
  exit 2
fi

git -C "$CHECKOUT_ROOT" config --local credential.helper ""
git -C "$CHECKOUT_ROOT" -c credential.helper= fetch --depth=1 origin "$commit"
git -C "$CHECKOUT_ROOT" checkout --detach --force FETCH_HEAD

checked_out_commit="$(git -C "$CHECKOUT_ROOT" rev-parse HEAD)"
if [[ "$checked_out_commit" != "$commit" ]]; then
  printf 'Oracle checkout mismatch: expected %s, got %s\n' "$commit" "$checked_out_commit" >&2
  exit 2
fi

chmod -R go-rwx "$CHECKOUT_ROOT"
printf '%s\n' "$checked_out_commit"
