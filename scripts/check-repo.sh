#!/bin/sh
# Static repository baseline checks for the personal website.
# No Node/npm or other third-party tooling is required.

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

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

require_file() {
  if [ -f "$ROOT/$1" ]; then
    pass "file exists: $1"
  else
    fail "missing file: $1"
  fi
}

require_dir() {
  if [ -d "$ROOT/$1" ]; then
    pass "directory exists: $1"
  else
    fail "missing directory: $1"
  fi
}

require_text() {
  file=$1
  text=$2
  label=$3

  if [ ! -f "$ROOT/$file" ]; then
    fail "$label (missing $file)"
    return
  fi

  if grep -Fq -- "$text" "$ROOT/$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

printf 'Repository baseline checks\n'
printf 'Root: %s\n\n' "$ROOT"

# Core deployment/configuration files.
require_file ".assetsignore"
require_file "_headers"
require_file "robots.txt"
require_file "wrangler.jsonc"
require_file "src/index.js"

# Current public Secret Sites. Their visible designs are outside the Admin refactor scope.
require_file "x/daily/index.html"
require_file "x/conversation/index.html"
require_file "x/decide/index.html"
require_file "x/poker/index.html"
require_file "x/und-wie-wars/index.html"

# Current admin implementations are intentionally still part of the Patch 01 baseline.
require_file "x/admin/index.html"
require_file "x/admin2/index.html"
require_file "x/admin3/index.html"
require_file "x/admin4/index.html"

# Existing server modules that later patches build on.
require_file "src/daily/routes.js"
require_file "src/conversation/routes.js"
require_file "src/checkins/routes.js"

# Unified Admin backend foundation introduced by Patch 02.
require_file "src/admin/access.js"
require_file "src/admin/routes.js"
require_file "src/admin/overview.js"
require_file "scripts/smoke-admin-edge.sh"

# Patch 02 Admin foundation wiring.
require_text "src/index.js" 'from "./admin/routes.js"' "Admin router is imported by the Worker"
require_text "src/index.js" 'from "./admin/access.js"' "Admin access guard is imported by the Worker"
require_text "src/index.js" 'requireAdminApiAccess(request)' "Unified Admin API guard runs before admin routing"
require_text "src/index.js" 'handleAdminRequest(request, env)' "Unified Admin router is called by the Worker"
require_text "src/admin/access.js" 'cf-access-authenticated-user-email' "Admin guard checks the Cloudflare Access identity header"
require_text "src/admin/routes.js" '/x/admin/api/overview' "Admin overview foundation route is registered"
require_text "src/admin/overview.js" 'foundation-ready' "Admin overview foundation response is defined"

# D1 bindings expected by the current implementation.
require_text "wrangler.jsonc" '"binding": "DB"' "Date D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "DAILY_DB"' "Daily D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "CHECKIN_DB"' "Check-in D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "CONVERSATION_DB"' "Conversation D1 binding is configured"

# Current Worker-first routing. These legacy admin paths are expected until later patches migrate them.
require_text "wrangler.jsonc" '"/x/date/*"' "Date routes run Worker first"
require_text "wrangler.jsonc" '"/x/api/*"' "Public API routes run Worker first"
require_text "wrangler.jsonc" '"/x/admin/api/*"' "Date admin API runs Worker first"
require_text "wrangler.jsonc" '"/x/admin3/api/*"' "Legacy Check-in admin API is still registered"
require_text "wrangler.jsonc" '"/x/admin4/api/*"' "Legacy Conversation admin API is still registered"

# Secret-layer indexing/privacy baseline.
require_text "_headers" '/x/*' "Secret-layer header rule exists"
require_text "_headers" 'X-Robots-Tag: noindex, nofollow, noarchive, nosnippet' "Secret-layer noindex header is configured"
require_text "_headers" 'Referrer-Policy: no-referrer' "Secret-layer referrer policy is configured"
require_text "_headers" 'X-Content-Type-Options: nosniff' "Secret-layer nosniff header is configured"

# Internal files must never be uploaded as public static assets.
require_text ".assetsignore" 'src/' "src/ is excluded from static assets"
require_text ".assetsignore" 'migrations/' "migrations/ is excluded from static assets"
require_text ".assetsignore" 'docs/' "docs/ is excluded from static assets"
require_text ".assetsignore" 'wrangler.jsonc' "wrangler.jsonc is excluded from static assets"

# Internal roadmap documents introduced by Patch 01.
require_file "docs/future/date-invitations.md"
require_file "docs/future/checkins.md"

printf '\nResult: %d passed, %d failed.\n' "$PASS" "$FAIL"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
