import { activateDailyCategory } from "./engine.js";

const API_PREFIX = "/x/api/daily/";

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

export async function handleDailyRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return null;

  const match = url.pathname.match(/^\/x\/api\/daily\/([^/]+)\/activate\/?$/);
  if (!match) return json({ error: "Not found" }, 404);

  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: {
        "Allow": "POST",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  if (!env.DAILY_DB) {
    console.error("DAILY_DB binding is missing");
    return json({ error: "Daily Content is unavailable" }, 500);
  }

  try {
    const result = await activateDailyCategory(env.DAILY_DB, decodeURIComponent(match[1]));
    if (result.state === "not_found") return json({ error: "Unknown Daily category" }, 404);
    return json(result, 200);
  } catch (error) {
    console.error("Daily activation failed", error);
    return json({ error: "Daily Content is temporarily unavailable" }, 500);
  }
}
