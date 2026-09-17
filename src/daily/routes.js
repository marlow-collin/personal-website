import { activateDailyCategory } from "./engine.js";
import { commitImport, exportExistingContent, validateImport } from "./imports.js";
import { DAILY_CATEGORY_LIST, getDailyCategory } from "./config.js";
import {
  createDailyContent,
  getDailyAdminOverview,
  getDailyContent,
  listDailyContent,
  listDailyHistory,
  setDailyContentStatus,
  updateDailyContent
} from "./admin-repository.js";

const API_PREFIX = "/x/api/daily/";
const ADMIN_PREFIX = "/x/admin/api/daily";
const IMPORT_VALIDATE = "/x/api/daily/import/validate";
const IMPORT_COMMIT = "/x/api/daily/import/commit";
const IMPORT_EXPORT_RE = /^\/x\/api\/daily\/import\/export\/([^/]+)\/?$/;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
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
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

function existingExportFilename(slug) {
  const suffix = String(slug || "").split("-").filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("_");
  return `Daily_Content_Existing_${suffix || "Category"}.json`;
}

function methodNotAllowed(allow = "POST") {
  return json({ error: "Method not allowed" }, 405, { Allow: allow });
}

function requireDailyDb(env) {
  return env.DAILY_DB || null;
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("Content-Type must be application/json");
  return request.json();
}

async function readImportBody(request) {
  const body = await readJson(request);
  if (body && typeof body === "object" && body.document) {
    return { document: body.document, sourceFilename: String(body.sourceFilename || "daily-admin-paste.json") };
  }
  return { document: body, sourceFilename: "daily-admin-paste.json" };
}

function validateCategory(value) {
  return !value || Boolean(getDailyCategory(value));
}

async function handleAdminDaily(request, env, url) {
  const db = requireDailyDb(env);
  if (!db) return json({ error: "Daily Content is unavailable" }, 500);
  const path = url.pathname.replace(/\/+$/, "");

  try {
    if (path === ADMIN_PREFIX + "/overview") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return json(await getDailyAdminOverview(db));
    }

    if (path === ADMIN_PREFIX + "/categories") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return json({ categories: DAILY_CATEGORY_LIST.map(({ slug, label, shortLabel, description }) => ({ slug, label, shortLabel, description })) });
    }

    if (path === ADMIN_PREFIX + "/content") {
      if (request.method === "GET") {
        const category = url.searchParams.get("category") || "";
        const status = url.searchParams.get("status") || "";
        if (!validateCategory(category)) return json({ error: "Unknown Daily category" }, 400);
        if (status && !["active", "archived"].includes(status)) return json({ error: "Unknown status" }, 400);
        return json({ items: await listDailyContent(db, { category, status, search: url.searchParams.get("q") || "" }) });
      }
      if (request.method === "POST") {
        const body = await readJson(request);
        const result = await createDailyContent(db, body || {});
        if (result.error) return json(result, result.status || (result.duplicateId ? 409 : 400));
        return json(result, 201);
      }
      return methodNotAllowed("GET, POST");
    }

    const contentMatch = path.match(/^\/x\/admin\/api\/daily\/content\/([^/]+)$/);
    if (contentMatch) {
      const id = decodeURIComponent(contentMatch[1]);
      if (request.method === "GET") {
        const item = await getDailyContent(db, id);
        return item ? json({ item }) : json({ error: "Daily content not found" }, 404);
      }
      if (request.method === "PUT") {
        const result = await updateDailyContent(db, id, await readJson(request));
        if (result.error) return json(result, result.status || (result.duplicateId ? 409 : 400));
        return json(result);
      }
      return methodNotAllowed("GET, PUT");
    }

    const statusMatch = path.match(/^\/x\/admin\/api\/daily\/content\/([^/]+)\/status$/);
    if (statusMatch) {
      if (request.method !== "POST") return methodNotAllowed("POST");
      const result = await setDailyContentStatus(db, decodeURIComponent(statusMatch[1]), (await readJson(request))?.status);
      if (result.error) return json(result, result.status || 400);
      return json(result);
    }

    if (path === ADMIN_PREFIX + "/history") {
      if (request.method !== "GET") return methodNotAllowed("GET");
      const category = url.searchParams.get("category") || "";
      const date = url.searchParams.get("date") || "";
      if (!validateCategory(category)) return json({ error: "Unknown Daily category" }, 400);
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Date must use YYYY-MM-DD" }, 400);
      return json({ items: await listDailyHistory(db, { category, date }) });
    }

    if (path === ADMIN_PREFIX + "/import/validate" || path === ADMIN_PREFIX + "/import/commit") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      const { document, sourceFilename } = await readImportBody(request);
      if (path.endsWith("/validate")) return json(await validateImport(db, document));
      return json(await commitImport(db, document, sourceFilename));
    }

    const exportMatch = path.match(/^\/x\/admin\/api\/daily\/import\/export\/([^/]+)$/);
    if (exportMatch) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      const slug = decodeURIComponent(exportMatch[1]);
      if (!getDailyCategory(slug)) return json({ error: "Unknown Daily category" }, 404);
      return attachmentJson(await exportExistingContent(db, slug), existingExportFilename(slug));
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Daily admin request failed", error);
    return json({ error: "Daily admin request could not be processed", detail: String(error?.message || error) }, 400);
  }
}

export async function handleDailyRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === ADMIN_PREFIX || url.pathname.startsWith(ADMIN_PREFIX + "/")) {
    return handleAdminDaily(request, env, url);
  }
  if (!url.pathname.startsWith(API_PREFIX)) return null;

  if (!env.DAILY_DB) {
    console.error("DAILY_DB binding is missing");
    return json({ error: "Daily Content is unavailable" }, 500);
  }

  const exportMatch = url.pathname.match(IMPORT_EXPORT_RE);
  if (exportMatch) {
    if (request.method !== "GET") return methodNotAllowed("GET");
    if (!request.headers.get("cf-access-authenticated-user-email")) return json({ error: "Cloudflare Access authentication required" }, 403);
    const slug = decodeURIComponent(exportMatch[1]);
    if (!getDailyCategory(slug)) return json({ error: "Unknown Daily category" }, 404);
    try {
      return attachmentJson(await exportExistingContent(env.DAILY_DB, slug), existingExportFilename(slug));
    } catch (error) {
      console.error("Daily existing-content export failed", error);
      return json({ error: "Existing content could not be exported" }, 500);
    }
  }

  if (url.pathname === IMPORT_VALIDATE || url.pathname === IMPORT_COMMIT) {
    if (request.method !== "POST") return methodNotAllowed();
    if (!request.headers.get("cf-access-authenticated-user-email")) return json({ error: "Cloudflare Access authentication required" }, 403);
    try {
      const { document, sourceFilename } = await readImportBody(request);
      if (url.pathname === IMPORT_VALIDATE) return json(await validateImport(env.DAILY_DB, document));
      return json(await commitImport(env.DAILY_DB, document, sourceFilename));
    } catch (error) {
      console.error("Daily import request failed", error);
      return json({ error: "Import request could not be processed", detail: String(error?.message || error) }, 400);
    }
  }

  const match = url.pathname.match(/^\/x\/api\/daily\/([^/]+)\/activate\/?$/);
  if (!match) return json({ error: "Not found" }, 404);
  if (request.method !== "POST") return methodNotAllowed();

  try {
    const result = await activateDailyCategory(env.DAILY_DB, decodeURIComponent(match[1]));
    if (result.state === "not_found") return json({ error: "Unknown Daily category" }, 404);
    return json(result, 200);
  } catch (error) {
    console.error("Daily activation failed", error);
    return json({ error: "Daily Content is temporarily unavailable" }, 500);
  }
}
