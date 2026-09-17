import { buildAdminOverviewFoundation } from "./overview.js";

const ADMIN_API_PREFIX = "/x/admin/api/";
const OVERVIEW_PATH = "/x/admin/api/overview";

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders()
    }
  });
}

function methodNotAllowed(allow) {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: allow,
      ...securityHeaders()
    }
  });
}

export async function handleAdminRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith(ADMIN_API_PREFIX)) return null;

  if (path === OVERVIEW_PATH) {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return json(buildAdminOverviewFoundation(env));
  }

  // Existing Date admin routes still live in src/index.js during Patch 02.
  // Returning null deliberately lets the legacy handler process them.
  return null;
}
