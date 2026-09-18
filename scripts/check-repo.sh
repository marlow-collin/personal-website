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

require_absent_path() {
  path="$1"
  if [ ! -e "$ROOT/$path" ]; then
    pass "path absent: $path"
  else
    fail "path should be absent: $path"
  fi
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

require_absent_text() {
  file=$1
  text=$2
  label=$3

  if [ ! -f "$ROOT/$file" ]; then
    fail "$label (missing $file)"
    return
  fi

  if grep -Fq -- "$text" "$ROOT/$file"; then
    fail "$label"
  else
    pass "$label"
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

# Existing server modules that later patches build on.
require_file "src/daily/routes.js"
require_file "src/conversation/routes.js"
require_file "src/checkins/routes.js"

# Date backend extracted from the global Worker entry point in Patch 03.
require_file "src/date/routes.js"
require_file "src/date/repository.js"
require_file "src/date/mail.js"

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
require_text "src/admin/overview.js" 'export async function buildAdminOverview' "Admin overview builder is defined"

# Patch 03 Date module wiring. Public behavior and legacy Date Admin URLs remain unchanged.
require_text "src/index.js" 'from "./date/routes.js"' "Date router is imported by the Worker"
require_text "src/index.js" 'handleDateRequest(request, env, ctx)' "Date router is called by the Worker"
require_text "src/date/routes.js" '/x/admin/api/invitations' "Legacy Date admin API path is preserved"
require_text "src/date/routes.js" '/x/api/date/' "Public Date API path is preserved"
require_text "src/date/routes.js" '/x/date/' "Public Date page path is preserved"
require_text "src/date/mail.js" 'from "cloudflare:sockets"' "Date SMTP implementation lives in the Date module"
require_text "src/date/repository.js" 'FROM invitations WHERE token = ?' "Date repository owns invitation lookup"
require_absent_text "src/index.js" 'from "cloudflare:sockets"' "Global Worker no longer owns SMTP transport"
require_absent_text "src/index.js" 'INSERT INTO invitations' "Global Worker no longer owns Date persistence"
require_absent_text "src/index.js" 'VALID_VALUES' "Global Worker no longer owns Date event rules"

# D1 bindings expected by the current implementation.
require_text "wrangler.jsonc" '"binding": "DB"' "Date D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "DAILY_DB"' "Daily D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "CHECKIN_DB"' "Check-in D1 binding is configured"
require_text "wrangler.jsonc" '"binding": "CONVERSATION_DB"' "Conversation D1 binding is configured"

# Current Worker-first routing. These legacy admin paths are expected until later patches migrate them.
require_text "wrangler.jsonc" '"/x/date/*"' "Date routes run Worker first"
require_text "wrangler.jsonc" '"/x/api/*"' "Public API routes run Worker first"
require_text "wrangler.jsonc" '"/x/admin/api/*"' "Date admin API runs Worker first"

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

# Patch 04 Control Center and temporary Date-admin relocation.
require_file "src/admin/modules.js"
require_file "x/admin/app.js"
require_file "x/admin/shared/admin.css"
require_file "x/admin/shared/api.js"
require_file "x/admin/shared/shell.js"
require_file "x/admin/date/index.html"
require_text "x/admin/index.html" 'Secret Layer · Control Center' "Control Center replaces the old root Date admin page"
require_text "x/admin/index.html" '/x/admin/app.js' "Control Center application script is loaded"
require_text "src/admin/routes.js" 'await buildAdminOverview(request, env)' "Admin overview now loads live module data"
require_text "src/admin/overview.js" 'daily_category_empty' "Daily empty-category attention rule is defined"
require_text "src/admin/overview.js" 'conversation_missing_topic' "Conversation metadata attention rule is defined"
require_text "src/admin/overview.js" 'status: "ready"' "Admin overview reports ready state"
require_text "src/admin/modules.js" '/x/admin/date/' "Date admin is reachable from the Control Center"
require_text "src/admin/modules.js" '/x/admin/checkins/' "Check-ins now use the canonical Admin page"
require_text "x/admin/admin.js" 'URLSearchParams' "Date quick action can open the legacy create form"

# Patch 05 Date Admin migration.
require_file "x/admin/date/app.js"
require_text "x/admin/date/index.html" '/x/admin/shared/admin.css' "Date Admin uses the shared Admin design"
require_text "x/admin/date/index.html" '/x/admin/date/app.js' "Date Admin uses its module application"
require_text "x/admin/date/index.html" 'Control Center' "Date Admin links back to the Control Center"
require_text "x/admin/date/app.js" 'adminApi(`/date${path}`' "Date Admin uses the canonical Date API namespace"
require_text "x/admin/date/app.js" 'URLSearchParams' "Date quick action still opens the create flow"
require_text "x/admin/date/app.js" 'LocalQRCode.matrix' "Date QR generation is preserved"
require_text "x/admin/date/app.js" 'reset' "Date reset action is preserved"
require_text "x/admin/date/app.js" 'method:"DELETE"' "Date delete action is preserved"
require_text "src/date/routes.js" '/x/admin/api/date/invitations' "Canonical Date Admin API path is registered"
require_text "src/date/routes.js" 'Temporary legacy aliases' "Legacy Date API aliases remain until cleanup"
require_text "x/admin/shared/admin.css" '.admin-dialog' "Shared Admin design includes module dialogs"
require_text "x/admin/shared/admin.css" '.record-row' "Shared Admin design includes record rows"



# Patch 06 Check-ins Admin migration.
require_file "x/admin/checkins/index.html"
require_file "x/admin/checkins/app.js"
require_text "x/admin/checkins/index.html" '/x/admin/shared/admin.css' "Check-ins Admin uses the shared Admin design"
require_text "x/admin/checkins/index.html" 'Control Center' "Check-ins Admin links back to the Control Center"
require_text "x/admin/checkins/app.js" 'adminApi("/checkins")' "Check-ins Admin loads the canonical list endpoint"
require_text "x/admin/checkins/app.js" 'current.checkin.slug' "Check-ins Admin addresses records dynamically by slug"
require_absent_text "x/admin/checkins/app.js" 'const SLUG = "und-wie-wars"' "Check-ins Admin no longer hard-codes one slug"
require_text "x/admin/checkins/app.js" '/recipient-name' "Check-ins recipient management is preserved"
require_text "x/admin/checkins/app.js" '/mail-next' "Check-ins notification toggle is preserved"
require_text "x/admin/checkins/app.js" '/reset' "Check-ins reset action is preserved"
require_text "src/checkins/routes.js" '/x/admin/api/checkins' "Canonical Check-ins Admin API path is registered"
require_text "src/checkins/routes.js" 'mail_configured' "Check-ins Admin reports mail configuration state"
require_text "x/admin/shared/admin.css" '.admin-switch' "Shared Admin design includes Check-in switches"
require_text "docs/future/checkins.md" 'Check-in definition' "Future generic Check-in model remains documented"


# Patch 07 — Daily Admin
require_file "src/daily/admin-repository.js"
require_file "x/admin/daily/index.html"
require_file "x/admin/daily/app.js"
require_file "x/admin/daily/content/index.html"
require_file "x/admin/daily/content/app.js"
require_file "x/admin/daily/history/index.html"
require_file "x/admin/daily/history/app.js"
require_file "x/admin/daily/import/index.html"
require_file "x/admin/daily/import/app.js"

require_text "src/admin/modules.js" 'manageUrl: "/x/admin/daily/"' "Control Center routes Daily to unified admin"
require_text "src/daily/routes.js" 'const ADMIN_PREFIX = "/x/admin/api/daily"' "Daily unified Admin API namespace is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/overview"' "Daily overview API is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/categories"' "Daily categories API is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/content"' "Daily content API is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/history"' "Daily history API is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/import/validate"' "Daily unified import validation API is registered"
require_text "src/daily/routes.js" 'ADMIN_PREFIX + "/import/commit"' "Daily unified import commit API is registered"
require_text "src/daily/admin-repository.js" 'getDailyAdminOverview' "Daily admin repository owns overview queries"
require_text "src/daily/admin-repository.js" 'listDailyContent' "Daily admin repository owns content listing"
require_text "src/daily/admin-repository.js" 'createDailyContent' "Daily admin repository owns content creation"
require_text "src/daily/admin-repository.js" 'updateDailyContent' "Daily admin repository owns content updates"
require_text "src/daily/admin-repository.js" 'setDailyContentStatus' "Daily admin repository owns archive and restore"
require_text "src/daily/admin-repository.js" 'listDailyHistory' "Daily admin repository owns history queries"
require_text "x/admin/daily/content/app.js" 'Rotation counter:' "Daily editor exposes times_shown as read-only system metadata"
require_text "x/admin/daily/import/app.js" '/x/admin/api/daily/import/export/' "Daily import uses unified admin export API"
require_text "x/admin/daily/history/index.html" 'current state of the referenced content' "Daily history documents current-state preview behavior"
require_text "scripts/smoke-admin-edge.sh" '/x/admin/daily/' "Admin smoke protects Daily overview"
require_text "scripts/smoke-admin-edge.sh" '/x/admin/api/daily/overview' "Admin smoke protects Daily API"
require_text "src/daily/routes.js" 'const API_PREFIX = "/x/api/daily/"' "Public Daily API namespace remains unchanged"
require_text "src/daily/routes.js" 'activateDailyCategory' "Daily rotation engine remains wired"
require_text "src/daily/routes.js" 'IMPORT_VALIDATE = "/x/api/daily/import/validate"' "Legacy Daily import API remains available"


# Patch 07 correction — visual Daily history preview
require_file "x/daily/shared/render-content.js"
require_text "x/daily/assets/js/category.js" 'renderDailyContentMarkup' "Live Daily page uses the shared category renderer"
require_text "x/admin/daily/history/app.js" 'renderDailyContentMarkup' "Daily history uses the same category renderer as the live page"
require_text "x/admin/daily/history/app.js" 'Preview uses the current version' "Daily history explains current-content preview semantics"
require_text "x/admin/daily/history/index.html" 'Technical details' "Raw JSON is secondary technical detail"


# Patch 08 — Conversation Admin
require_file "x/admin/conversation/index.html"
require_file "x/admin/conversation/app.js"
require_file "x/admin/conversation/library/index.html"
require_file "x/admin/conversation/library/app.js"
require_file "x/admin/conversation/categories/index.html"
require_file "x/admin/conversation/categories/app.js"
require_file "x/admin/conversation/import/index.html"
require_file "x/admin/conversation/import/app.js"
require_text "src/admin/modules.js" 'manageUrl: "/x/admin/conversation/"' "Control Center routes Conversation to unified admin"
require_text "src/conversation/routes.js" 'ADMIN_PREFIX = "/x/admin/api/conversation/"' "Canonical Conversation Admin API namespace is registered"
require_text "x/admin/conversation/library/app.js" '/conversation/questions' "Conversation Library uses canonical Admin API"
require_text "x/admin/conversation/library/app.js" 'data-delete' "Conversation Library retains hard delete for mistakes and duplicates"
require_text "x/admin/conversation/import/app.js" '/conversation/import/validate' "Conversation Import uses canonical validation API"
require_text "x/admin/conversation/import/app.js" '/conversation/import/commit' "Conversation Import uses canonical commit API"
require_text "x/admin/conversation/import/index.html" '/conversation/export/llm-review' "Conversation review export uses canonical API"
require_text "x/admin/conversation/categories/app.js" 'light","medium","deep' "Conversation Categories reports intensity distribution"
require_text "scripts/smoke-admin-edge.sh" '/x/admin/conversation/' "Admin smoke protects Conversation overview"
require_text "scripts/smoke-admin-edge.sh" '/x/admin/api/conversation/status' "Admin smoke protects Conversation API"

require_text "x/admin/daily/history/app.js" '/x/daily/assets/css/category.css' "Daily history preview loads the live category visual styles in isolation"

# Patch 09 — final admin cleanup
require_absent_path "x/admin2"
require_absent_path "x/admin3"
require_absent_path "x/admin4"
require_file "x/admin/daily/content-kit/Daily_Content_Generation_Base.md"
require_file "x/admin/conversation/content-kit/Conversation_Generation_Handoff_v1.md"
require_text "x/admin/daily/import/app.js" '/x/admin/daily/content-kit/' "Daily Import uses canonical content-kit path"
require_text "x/admin/conversation/import/index.html" '/x/admin/conversation/content-kit/' "Conversation Import uses canonical content-kit path"
require_absent_text "src/checkins/routes.js" '/x/admin3/' "Check-ins legacy Admin API removed"
require_absent_text "src/conversation/routes.js" '/x/admin4/' "Conversation legacy Admin API removed"
require_absent_text "wrangler.jsonc" '/x/admin3/api/*' "Legacy admin3 worker-first rule removed"
require_absent_text "wrangler.jsonc" '/x/admin4/api/*' "Legacy admin4 worker-first rule removed"
require_text "wrangler.jsonc" '/x/admin/api/*' "Unified Admin API remains worker-first"

printf '\nResult: %d passed, %d failed.\n' "$PASS" "$FAIL"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
