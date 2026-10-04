import {
  createEvent,
  deleteEvent,
  getEventById,
  getEventBySlug,
  listEvents,
  slugExists,
  updateEvent
} from "./repository.js";
import { isoToLocalInput, isValidTimeZone, zonedLocalToIso } from "./time.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const THEMES = new Set(["minimal", "card-room"]);

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
    headers: { "Content-Type": "application/json; charset=utf-8", ...securityHeaders() }
  });
}

function methodNotAllowed(allow) {
  return new Response(null, { status: 405, headers: { Allow: allow, ...securityHeaders() } });
}

function cleanString(value, max = 160) {
  return value == null ? "" : String(value).trim().slice(0, max);
}

function safeUrl(value) {
  const url = cleanString(value, 500);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeEvent(row, admin = false) {
  if (!row) return null;
  const event = {
    slug: row.slug,
    title: row.title,
    eyebrow: row.eyebrow,
    subtitle: row.subtitle,
    description: row.description,
    closing_message: row.closing_message,
    theme: row.theme,
    icon: row.icon,
    start_at: row.start_at,
    end_at: row.end_at,
    timezone: row.timezone,
    location_label: row.location_label,
    location_url: row.location_url,
    primary_cta_label: row.primary_cta_label,
    primary_cta_url: row.primary_cta_url,
    details: parseJsonArray(row.details_json),
    links: parseJsonArray(row.links_json),
    is_active: Boolean(row.is_active)
  };
  if (admin) {
    event.id = row.id;
    event.start_local = isoToLocalInput(row.start_at, row.timezone);
    event.end_local = isoToLocalInput(row.end_at, row.timezone);
    event.created_at = row.created_at;
    event.updated_at = row.updated_at;
  }
  return event;
}

function cleanRows(rows, type) {
  if (!Array.isArray(rows)) return [];
  const maxRows = type === "detail" ? 4 : 3;
  return rows.slice(0, maxRows).map(row => {
    const label = cleanString(row?.label, 60);
    if (type === "detail") {
      const value = cleanString(row?.value, 180);
      return label && value ? { label, value } : null;
    }
    const url = safeUrl(row?.url);
    return label && url ? { label, url } : null;
  }).filter(Boolean);
}

function normalizeEventInput(body) {
  const slug = cleanString(body?.slug, 60).toLowerCase();
  const title = cleanString(body?.title, 100);
  const timezone = cleanString(body?.timezone, 80) || "Europe/Berlin";
  const startLocal = cleanString(body?.start_local, 20);
  const endLocal = cleanString(body?.end_local, 20);
  const theme = cleanString(body?.theme, 30) || "minimal";

  if (!slug || !SLUG_PATTERN.test(slug)) return { error: "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten." };
  if (!title) return { error: "Titel fehlt." };
  if (!isValidTimeZone(timezone)) return { error: "Unbekannte Zeitzone." };
  if (!THEMES.has(theme)) return { error: "Unbekanntes Theme." };

  const startAt = zonedLocalToIso(startLocal, timezone);
  if (!startAt) return { error: "Startdatum oder Uhrzeit ist ungültig." };
  const endAt = endLocal ? zonedLocalToIso(endLocal, timezone) : null;
  if (endLocal && !endAt) return { error: "Enddatum oder Uhrzeit ist ungültig." };
  if (endAt && new Date(endAt) <= new Date(startAt)) return { error: "Die Endzeit muss nach der Startzeit liegen." };

  const locationUrlRaw = cleanString(body?.location_url, 500);
  const primaryUrlRaw = cleanString(body?.primary_cta_url, 500);
  const locationUrl = safeUrl(locationUrlRaw);
  const primaryCtaUrl = safeUrl(primaryUrlRaw);
  if (locationUrlRaw && !locationUrl) return { error: "Der Orts-Link ist ungültig." };
  if (primaryUrlRaw && !primaryCtaUrl) return { error: "Der Hauptlink ist ungültig." };

  const primaryCtaLabel = cleanString(body?.primary_cta_label, 70);
  if ((primaryCtaLabel && !primaryCtaUrl) || (!primaryCtaLabel && primaryCtaUrl)) {
    return { error: "Hauptlink benötigt Bezeichnung und URL." };
  }

  return {
    event: {
      slug,
      title,
      eyebrow: cleanString(body?.eyebrow, 100),
      subtitle: cleanString(body?.subtitle, 180),
      description: cleanString(body?.description, 1200),
      closingMessage: cleanString(body?.closing_message, 180),
      theme,
      icon: cleanString(body?.icon, 8),
      startAt,
      endAt,
      timezone,
      locationLabel: cleanString(body?.location_label, 160),
      locationUrl,
      primaryCtaLabel,
      primaryCtaUrl,
      details: cleanRows(body?.details, "detail"),
      links: cleanRows(body?.links, "link"),
      isActive: body?.is_active !== false
    }
  };
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

async function serveTemplate(request, env) {
  const url = new URL(request.url);
  url.pathname = "/x/_event-template/index.html";
  url.search = "";
  const response = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  const headers = new Headers(response.headers);
  Object.entries(securityHeaders()).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function notFound() {
  return new Response("Event not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() }
  });
}

function icsEscape(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsUtc(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildIcs(event, origin) {
  const pageUrl = `${origin}/x/event/${event.slug}`;
  const description = [event.description, pageUrl].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//marlow-rischmueller.com//Secret Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@marlow-rischmueller.com`,
    `DTSTAMP:${icsUtc(new Date().toISOString())}`,
    `DTSTART:${icsUtc(event.start_at)}`
  ];
  if (event.end_at) lines.push(`DTEND:${icsUtc(event.end_at)}`);
  lines.push(`SUMMARY:${icsEscape(event.title)}`);
  if (event.location_label) lines.push(`LOCATION:${icsEscape(event.location_label)}`);
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  lines.push(`URL:${pageUrl}`, "END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

async function handleAdminList(env) {
  return json({ events: (await listEvents(env)).map(row => serializeEvent(row, true)) });
}

async function handleAdminCreate(request, env) {
  const body = await readBody(request);
  if (!body) return json({ error: "Ungültige Anfrage." }, 400);
  const normalized = normalizeEventInput(body);
  if (normalized.error) return json({ error: normalized.error }, 400);
  if (await slugExists(env, normalized.event.slug)) return json({ error: "Dieser Slug ist bereits vergeben." }, 409);
  const row = await createEvent(env, normalized.event);
  return json(serializeEvent(row, true), 201);
}

async function handleAdminUpdate(request, env, id) {
  const current = await getEventById(env, id);
  if (!current) return json({ error: "Event nicht gefunden." }, 404);
  const body = await readBody(request);
  if (!body) return json({ error: "Ungültige Anfrage." }, 400);
  const normalized = normalizeEventInput(body);
  if (normalized.error) return json({ error: normalized.error }, 400);
  if (await slugExists(env, normalized.event.slug, id)) return json({ error: "Dieser Slug ist bereits vergeben." }, 409);
  return json(serializeEvent(await updateEvent(env, id, normalized.event), true));
}

async function handleAdminDelete(env, id) {
  if (!await getEventById(env, id)) return json({ error: "Event nicht gefunden." }, 404);
  await deleteEvent(env, id);
  return new Response(null, { status: 204, headers: securityHeaders() });
}

export async function handleEventRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  let match;

  if (path === "/x/admin/api/events") {
    if (request.method === "GET") return handleAdminList(env);
    if (request.method === "POST") return handleAdminCreate(request, env);
    return methodNotAllowed("GET, POST");
  }

  match = path.match(/^\/x\/admin\/api\/events\/(\d+)\/?$/);
  if (match) {
    const id = Number(match[1]);
    if (request.method === "GET") {
      const row = await getEventById(env, id);
      return row ? json(serializeEvent(row, true)) : json({ error: "Event nicht gefunden." }, 404);
    }
    if (request.method === "PUT") return handleAdminUpdate(request, env, id);
    if (request.method === "DELETE") return handleAdminDelete(env, id);
    return methodNotAllowed("GET, PUT, DELETE");
  }

  match = path.match(/^\/x\/event\/([a-z0-9]+(?:-[a-z0-9]+)*)\/calendar\.ics$/);
  if (match && request.method === "GET") {
    const event = await getEventBySlug(env, match[1], true);
    if (!event) return notFound();
    return new Response(buildIcs(event, url.origin), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
        ...securityHeaders()
      }
    });
  }

  match = path.match(/^\/x\/api\/event\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (match && request.method === "GET") {
    const event = await getEventBySlug(env, match[1], true);
    return event ? json(serializeEvent(event, false)) : json({ error: "Event nicht gefunden." }, 404);
  }

  match = path.match(/^\/x\/event\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (match && request.method === "GET") {
    const event = await getEventBySlug(env, match[1], true);
    return event ? serveTemplate(request, env) : notFound();
  }

  return null;
}
