import { activateDailyCategory } from "./engine.js";
import { commitImport, exportExistingContent, validateImport } from "./imports.js";
import { getDailyCategory } from "./config.js";

const API_PREFIX = "/x/api/daily/";
const IMPORT_VALIDATE = "/x/api/daily/import/validate";
const IMPORT_COMMIT = "/x/api/daily/import/commit";
const IMPORT_EXPORT_RE = /^\/x\/api\/daily\/import\/export\/([^/]+)\/?$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
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
  const suffix = String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");
  return `Daily_Content_Existing_${suffix || "Category"}.json`;
}

function methodNotAllowed(allow = "POST") {
  return new Response(null, { status:405, headers:{ "Allow":allow, "Cache-Control":"no-store", "X-Robots-Tag":"noindex, nofollow, noarchive" } });
}

async function readImportBody(request) {
  const contentType=request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("Content-Type must be application/json");
  const body=await request.json();
  if (body && typeof body === "object" && body.document) return { document:body.document, sourceFilename:String(body.sourceFilename || "admin2-paste.json") };
  return { document:body, sourceFilename:"admin2-paste.json" };
}

export async function handleDailyRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return null;

  if (!env.DAILY_DB) {
    console.error("DAILY_DB binding is missing");
    return json({ error: "Daily Content is unavailable" }, 500);
  }

  const exportMatch = url.pathname.match(IMPORT_EXPORT_RE);
  if (exportMatch) {
    if (request.method !== "GET") return methodNotAllowed("GET");
    if (!request.headers.get("cf-access-authenticated-user-email")) {
      return json({ error: "Cloudflare Access authentication required" }, 403);
    }
    const slug = decodeURIComponent(exportMatch[1]);
    if (!getDailyCategory(slug)) return json({ error: "Unknown Daily category" }, 404);
    try {
      const data = await exportExistingContent(env.DAILY_DB, slug);
      return attachmentJson(data, existingExportFilename(slug));
    } catch (error) {
      console.error("Daily existing-content export failed", error);
      return json({ error: "Existing content could not be exported" }, 500);
    }
  }

  if (url.pathname === IMPORT_VALIDATE || url.pathname === IMPORT_COMMIT) {
    if (request.method !== "POST") return methodNotAllowed();
    if (!request.headers.get("cf-access-authenticated-user-email")) {
      return json({ error: "Cloudflare Access authentication required" }, 403);
    }
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
