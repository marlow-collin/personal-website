import { CONVERSATION_SCHEMA_VERSION } from "./config.js";
import {
  buildFullExport,
  buildGenerationBrief,
  buildLlmReviewExport
} from "./exports.js";
import {
  commitConversationImport,
  validateConversationImport
} from "./imports.js";
import { getActiveQuestions, getConversationAdminSummary } from "./repository.js";

const PUBLIC_QUESTIONS_PATH = "/x/api/conversation/questions";
const ADMIN_PREFIX = "/x/admin4/api/";
const ADMIN_STATUS_PATH = "/x/admin4/api/status";
const ADMIN_IMPORT_VALIDATE_PATH = "/x/admin4/api/import/validate";
const ADMIN_IMPORT_COMMIT_PATH = "/x/admin4/api/import/commit";
const ADMIN_EXPORT_FULL_PATH = "/x/admin4/api/export/full";
const ADMIN_EXPORT_REVIEW_PATH = "/x/admin4/api/export/llm-review";
const ADMIN_EXPORT_BRIEF_PATH = "/x/admin4/api/export/generation-brief";

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

function attachmentJson(data, filename) {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
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

function hasAccessIdentity(request) {
  return Boolean(request.headers.get("cf-access-authenticated-user-email"));
}

function getDb(env) {
  return env.CONVERSATION_DB || null;
}

async function readImportDocument(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }
  const body = await request.json();
  if (body && typeof body === "object" && body.document) return body.document;
  return body;
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

  try {
    if (path === ADMIN_STATUS_PATH) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      const summary = await getConversationAdminSummary(db);
      return json({
        ok: true,
        schemaVersion: CONVERSATION_SCHEMA_VERSION,
        database: "connected",
        summary
      });
    }

    if (path === ADMIN_IMPORT_VALIDATE_PATH || path === ADMIN_IMPORT_COMMIT_PATH) {
      if (request.method !== "POST") return methodNotAllowed("POST");
      const document = await readImportDocument(request);
      if (path === ADMIN_IMPORT_VALIDATE_PATH) {
        return json(await validateConversationImport(db, document));
      }
      return json(await commitConversationImport(db, document));
    }

    if (path === ADMIN_EXPORT_FULL_PATH) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return attachmentJson(await buildFullExport(db), "Conversation_Content_Full_Export.json");
    }

    if (path === ADMIN_EXPORT_REVIEW_PATH) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return attachmentJson(await buildLlmReviewExport(db), "Conversation_Content_LLM_Review.json");
    }

    if (path === ADMIN_EXPORT_BRIEF_PATH) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return attachmentJson(
        await buildGenerationBrief(db, url.searchParams.get("count")),
        "Conversation_Generation_Brief.json"
      );
    }
  } catch (error) {
    console.error("Conversation admin request failed", error);
    return json({
      error: "Conversation admin request could not be processed",
      detail: String(error?.message || error)
    }, 400);
  }

  return json({ error: "Not found" }, 404);
}
