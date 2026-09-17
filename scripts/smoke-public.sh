#!/bin/sh
# Read-only production smoke tests for public/static pages.
# Usage: sh scripts/smoke-public.sh [base-url]
# Example: sh scripts/smoke-public.sh https://marlow-rischmueller.com

set -u

BASE_URL=${1:-https://marlow-rischmueller.com}
BASE_URL=${BASE_URL%/}
PASS=0
FAIL=0
TMP_ROOT=$(mktemp -d 2>/dev/null || mktemp -d -t secret-site-smoke)
trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM

pass() {
  PASS=$((PASS + 1))
  printf '✓ %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf '✗ %s\n' "$1" >&2
}

fetch() {
  path=$1
  name=$(printf '%s' "$path" | tr '/?&=' '_____' | tr -cd '[:alnum:]_.-')
  [ -n "$name" ] || name=root
  headers="$TMP_ROOT/$name.headers"
  body="$TMP_ROOT/$name.body"

  status=$(curl -sS -L \
    --connect-timeout 10 \
    --max-time 30 \
    -D "$headers" \
    -o "$body" \
    -w '%{http_code}' \
    "$BASE_URL$path") || status=000

  printf '%s|%s|%s\n' "$status" "$headers" "$body"
}

check_page() {
  path=$1
  expect_noindex=$2

  result=$(fetch "$path")
  status=${result%%|*}
  rest=${result#*|}
  headers=${rest%%|*}

  if [ "$status" = "200" ]; then
    pass "$path returns HTTP 200"
  else
    fail "$path returned HTTP $status (expected 200)"
    return
  fi

  if [ "$expect_noindex" = "yes" ]; then
    if grep -Eiq '^X-Robots-Tag:[[:space:]].*noindex' "$headers"; then
      pass "$path sends X-Robots-Tag noindex"
    else
      fail "$path is missing X-Robots-Tag noindex"
    fi

    if grep -Eiq '^Referrer-Policy:[[:space:]]*no-referrer' "$headers"; then
      pass "$path sends Referrer-Policy: no-referrer"
    else
      fail "$path is missing Referrer-Policy: no-referrer"
    fi

    if grep -Eiq '^X-Content-Type-Options:[[:space:]]*nosniff' "$headers"; then
      pass "$path sends X-Content-Type-Options: nosniff"
    else
      fail "$path is missing X-Content-Type-Options: nosniff"
    fi
  fi
}

printf 'Read-only public smoke tests\n'
printf 'Target: %s\n\n' "$BASE_URL"

# This script deliberately performs only GET requests that do not mutate production data.
check_page "/" "no"
check_page "/x/daily/" "yes"
check_page "/x/conversation/" "yes"
check_page "/x/decide/" "yes"
check_page "/x/poker/" "yes"
check_page "/x/und-wie-wars/" "yes"

printf '\nResult: %d passed, %d failed.\n' "$PASS" "$FAIL"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
