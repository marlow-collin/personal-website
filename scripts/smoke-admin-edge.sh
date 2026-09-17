#!/bin/sh
set -u

BASE_URL="${1:-https://marlow-rischmueller.com}"
BASE_URL="${BASE_URL%/}"
PASSED=0
FAILED=0

printf '\nRead-only admin edge smoke tests\n\nTarget: %s\n\n' "$BASE_URL"

check_protected() {
  path="$1"
  label="$2"
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path" || printf '000')"
  case "$status" in
    301|302|303|307|308|401|403)
      printf '✓ %s is protected for anonymous requests (HTTP %s)\n\n' "$label" "$status"
      PASSED=$((PASSED + 1))
      ;;
    *)
      printf '✗ %s unexpectedly returned HTTP %s\n\n' "$label" "$status"
      FAILED=$((FAILED + 1))
      ;;
  esac
}

check_protected "/x/admin/" "/x/admin/"
check_protected "/x/admin/date/" "/x/admin/date/"
check_protected "/x/admin/api/overview" "/x/admin/api/overview"

printf 'Result: %s passed, %s failed.\n' "$PASSED" "$FAILED"
[ "$FAILED" -eq 0 ]
