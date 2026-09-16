import { CONVERSATION_SCHEMA_VERSION } from "./config.js";
import { getActiveQuestions, getConversationAdminSummary } from "./repository.js";

const PUBLIC_QUESTIONS_PATH = "/x/api/conversation/questions";
const ADMIN_PREFIX = "/x/admin4/api/";
const ADMIN_STATUS_PATH = "/x/admin4/api/status";

function securityHeaders() {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...extraHeaders
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

function hasAccessIdentity(request) {
  return Boolean(request.headers.get("cf-access-authenticated-user-email"));
}

function getDb(env) {
  return env.CONVERSATION_DB || null;
}

export async function handleConversationRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  const isPublicRoute = path === PUBLIC_QUESTIONS_PATH;
  const isAdminRoute = path.startsWith(ADMIN_PREFIX);
  if (!isPublicRoute && !isAdminRoute) return null;

  const db = getDb(env);
  if (!db) {
    console.error("CONVERSATION_DB binding is missing");
    return json({ error: "Conversation Content is unavailable" }, 503);
  }

  if (isPublicRoute) {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const questions = await getActiveQuestions(db);
      return json({
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        questions
      });
    } catch (error) {
      console.error("Conversation question load failed", error);
      return json({ error: "Conversation Content is temporarily unavailable" }, 500);
    }
  }

  if (!hasAccessIdentity(request)) {
    return json({ error: "Cloudflare Access authentication required" }, 403);
  }

  if (path === ADMIN_STATUS_PATH) {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const summary = await getConversationAdminSummary(db);
      return json({
        ok: true,
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        database: "connected",
        summary
      });
    } catch (error) {
      console.error("Conversation admin status failed", error);
      return json({ error: "Conversation database could not be queried" }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}
