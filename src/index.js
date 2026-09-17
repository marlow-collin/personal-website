import { handleDailyRequest } from "./daily/routes.js";
import { handleCheckinRequest } from "./checkins/routes.js";
import { handleConversationRequest } from "./conversation/routes.js";
import { handleAdminRequest } from "./admin/routes.js";
import { requireAdminApiAccess } from "./admin/access.js";
import { handleDateRequest } from "./date/routes.js";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      ...extraHeaders
    }
  });
}

async function serveStatic(request, env) {
  const response = await env.ASSETS.fetch(request);
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/x/")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    // All current and future /x/admin/api/* requests pass through one guard.
    // Cloudflare Access remains the outer protection layer; this is a consistent
    // Worker-side second check for the Access-injected identity header.
    const adminAccessResponse = requireAdminApiAccess(request);
    if (adminAccessResponse) return adminAccessResponse;

    const adminResponse = await handleAdminRequest(request, env);
    if (adminResponse) return adminResponse;

    const conversationResponse = await handleConversationRequest(request, env);
    if (conversationResponse) return conversationResponse;

    const dailyResponse = await handleDailyRequest(request, env);
    if (dailyResponse) return dailyResponse;

    try {
      const checkinResponse = await handleCheckinRequest(request, env, ctx);
      if (checkinResponse) return checkinResponse;

      const dateResponse = await handleDateRequest(request, env, ctx);
      if (dateResponse) return dateResponse;

      // Everything else falls through to the existing static site.
      return serveStatic(request, env);
    } catch (err) {
      console.error(err);
      return json({ error: "Interner Fehler." }, 500);
    }
  }
};
