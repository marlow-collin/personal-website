#!/bin/sh
# Read-only edge smoke checks for the Access-protected admin area.
# No credentials are sent. The script verifies that anonymous requests are not public.

set -u

BASE_URL=${1:-https://marlow-rischmueller.com}
BASE_URL=${BASE_URL%/}
PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  printf '✓ %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf '✗ %s\n' "$1" >&2
}

anonymous_status() {
  curl -sS -o /dev/null \
    --max-time 20 \
    -w '%{http_code}' \
    "$1"
}

expect_protected() {
  path=$1
  status=$(anonymous_status "$BASE_URL$path") || {
    fail "$path could not be reached"
    return
  }

  case "$status" in
    301|302|303|307|308|401|403)
      pass "$path is protected for anonymous requests (HTTP $status)"
      ;;
    200)
      fail "$path is publicly reachable (HTTP 200)"
      ;;
    *)
      fail "$path returned unexpected HTTP $status"
      ;;
  esac
}

printf 'Read-only admin edge smoke tests\n'
printf 'Target: %s\n\n' "$BASE_URL"

expect_protected "/x/admin/"
expect_protected "/x/admin/api/overview"

printf '\nResult: %d passed, %d failed.\n' "$PASS" "$FAIL"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
