import { buildAdminOverview } from "./overview.js";

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


async function pokerRegistryList(env) {
  const id = env.POKER_LIVE_REGISTRY.idFromName("poker-sessions");
  const stub = env.POKER_LIVE_REGISTRY.get(id);
  const response = await stub.fetch(new Request("https://registry/list"));
  if (!response.ok) throw new Error("Poker session registry unavailable.");
  return response.json();
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
    return json(await buildAdminOverview(request, env));
  }

  if (path === "/x/admin/api/poker/sessions") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return json(await pokerRegistryList(env));
  }

  // Date, Daily, Check-in and Conversation admin endpoints are migrated in
  // later patches. Returning null keeps their current handlers reachable.
  return null;
}
