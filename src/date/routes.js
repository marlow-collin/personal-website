import {
  acceptInvitation,
  claimNotification,
  completeInvitation,
  deleteInvitation,
  finishNotificationClaim,
  getInvitation,
  incrementNoAttempts,
  insertInvitation,
  listInvitations,
  markInvitationOpened,
  releaseNotificationClaim,
  resetInvitation,
  setActivity,
  setDayPreference,
  setRidePreference,
  setTimePreference
} from "./repository.js";
import { sendDateNotification } from "./mail.js";

const THEMES = new Set(["soft-playful", "dark-elegant"]);
const TOKEN_PATTERN = "([A-Za-z0-9_-]{20,80})";

const VALID_VALUES = {
  activity: new Set(["Café", "Billard", "Drinks", "Überrasch mich"]),
  day: new Set(["Unter der Woche", "Freitag", "Wochenende", "Flexibel"]),
  time: new Set(["Nachmittags", "Abends"]),
  ride: new Set(["Hol mich ab", "Ich komme selbst", "Klären wir später"])
};

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

function cleanString(value, max = 120) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function serveThemeAsset(request, env, theme) {
  const safeTheme = THEMES.has(theme) ? theme : "soft-playful";
  const url = new URL(request.url);
  url.pathname = `/x/_date-templates/${safeTheme}/index.html`;
  url.search = "";
  const assetResponse = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return new Response(assetResponse.body, { status: assetResponse.status, headers });
}

async function handlePublicPage(request, env, token) {
  const inv = await getInvitation(env, token, true);
  if (!inv) {
    return new Response("Invitation not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
      }
    });
  }
  return serveThemeAsset(request, env, inv.theme);
}

async function handlePublicGet(request, env, token) {
  let inv = await getInvitation(env, token, true);
  if (!inv) return json({ error: "Einladung nicht gefunden." }, 404);

  const url = new URL(request.url);
  const preview = url.searchParams.get("preview") === "1";
  if (!preview && !inv.completed_at) {
    await markInvitationOpened(env, token);
    inv = await getInvitation(env, token, true);
  }

  return json(inv);
}

async function handlePublicEvent(request, env, token, ctx) {
  const inv = await getInvitation(env, token, true);
  if (!inv) return json({ error: "Einladung nicht gefunden." }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const type = body?.type;
  const value = body?.value;

  if (type === "no") {
    await incrementNoAttempts(env, token);
    return json({ ok: true });
  }

  if (type === "accept") {
    await acceptInvitation(env, token);
    return json({ ok: true });
  }

  if (type === "activity" && VALID_VALUES.activity.has(value)) {
    await setActivity(env, token, value);
    return json({ ok: true });
  }

  if (type === "day" && VALID_VALUES.day.has(value)) {
    await setDayPreference(env, token, value);
    return json({ ok: true });
  }

  if (type === "time" && VALID_VALUES.time.has(value)) {
    await setTimePreference(env, token, value);
    return json({ ok: true });
  }

  if (type === "ride" && VALID_VALUES.ride.has(value)) {
    await setRidePreference(env, token, value);
    return json({ ok: true });
  }

  if (type === "complete") {
    await completeInvitation(env, token);

    /*
      Atomarer Versand-Claim:
      Nur der erste parallele complete-Request darf notification_sent_at
      von NULL auf einen Claim-Wert setzen und damit die Mail senden.
    */
    const claimId = `pending:${crypto.randomUUID()}`;
    const claim = await claimNotification(env, token, claimId);

    if ((claim.meta?.changes || 0) === 1) {
      // Mailversand läuft nach der HTTP-Antwort weiter und blockiert die Abschlussseite nicht.
      ctx.waitUntil((async () => {
        try {
          const fullInvitation = await getInvitation(env, token, false);
          await sendDateNotification(env, fullInvitation);
          await finishNotificationClaim(env, token, claimId);
        } catch (error) {
          // Versand fehlgeschlagen: Claim freigeben, damit ein späterer Versuch erneut senden kann.
          await releaseNotificationClaim(env, token, claimId);

          console.error("Date notification email failed", {
            code: error?.code,
            message: error?.message
          });
        }
      })());
    }

    return json({ ok: true });
  }

  return json({ error: "Unbekanntes oder ungültiges Event." }, 400);
}

async function handleAdminList(env) {
  return json({ invitations: await listInvitations(env) });
}

async function handleAdminDetail(env, token) {
  const inv = await getInvitation(env, token, false);
  if (!inv) return json({ error: "Einladung nicht gefunden." }, 404);
  return json(inv);
}

async function handleAdminCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const firstName = cleanString(body.first_name, 60);
  const internalLabel = cleanString(body.internal_label, 120);
  const personalMessage = cleanString(body.personal_message, 240) || "Ich wollte dich etwas fragen.";
  const finalMessage = cleanString(body.final_message, 240) || "Klingt nach einem ziemlich guten Plan ✨";
  const theme = cleanString(body.theme, 30);

  if (!firstName) return json({ error: "Vorname fehlt." }, 400);
  if (!THEMES.has(theme)) return json({ error: "Unbekanntes Design." }, 400);

  let token;
  for (let attempt = 0; attempt < 3; attempt++) {
    token = randomToken(24);
    try {
      await insertInvitation(env, {
        token,
        firstName,
        internalLabel,
        personalMessage,
        finalMessage,
        theme
      });
      return json({ token }, 201);
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }

  return json({ error: "Token konnte nicht erzeugt werden." }, 500);
}

async function handleAdminReset(env, token) {
  const inv = await getInvitation(env, token, false);
  if (!inv) return json({ error: "Einladung nicht gefunden." }, 404);
  await resetInvitation(env, token);
  return json({ ok: true });
}

async function handleAdminDelete(env, token) {
  const inv = await getInvitation(env, token, false);
  if (!inv) return json({ error: "Einladung nicht gefunden." }, 404);
  await deleteInvitation(env, token);
  return json({ ok: true });
}

export async function handleDateRequest(request, env, ctx) {
  const path = new URL(request.url).pathname;
  let match;

  // Dynamic public invitation HTML.
  match = path.match(new RegExp(`^/x/date/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "GET") return handlePublicPage(request, env, match[1]);

  // Public invitation data/events.
  match = path.match(new RegExp(`^/x/api/date/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "GET") return handlePublicGet(request, env, match[1]);

  match = path.match(new RegExp(`^/x/api/date/${TOKEN_PATTERN}/event/?$`));
  if (match && request.method === "POST") return handlePublicEvent(request, env, match[1], ctx);

  // Canonical Date Admin API namespace introduced in Patch 05.
  if (path === "/x/admin/api/date/invitations" && request.method === "GET") return handleAdminList(env);
  if (path === "/x/admin/api/date/invitations" && request.method === "POST") return handleAdminCreate(request, env);

  // Temporary legacy aliases remain until the final cleanup patch.
  if (path === "/x/admin/api/invitations" && request.method === "GET") return handleAdminList(env);
  if (path === "/x/admin/api/invitations" && request.method === "POST") return handleAdminCreate(request, env);

  match = path.match(new RegExp(`^/x/admin/api/date/invitations/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "GET") return handleAdminDetail(env, match[1]);

  match = path.match(new RegExp(`^/x/admin/api/invitations/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "GET") return handleAdminDetail(env, match[1]);

  match = path.match(new RegExp(`^/x/admin/api/date/invitations/${TOKEN_PATTERN}/reset/?$`));
  if (match && request.method === "POST") return handleAdminReset(env, match[1]);

  match = path.match(new RegExp(`^/x/admin/api/invitations/${TOKEN_PATTERN}/reset/?$`));
  if (match && request.method === "POST") return handleAdminReset(env, match[1]);

  match = path.match(new RegExp(`^/x/admin/api/date/invitations/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "DELETE") return handleAdminDelete(env, match[1]);

  match = path.match(new RegExp(`^/x/admin/api/invitations/${TOKEN_PATTERN}/?$`));
  if (match && request.method === "DELETE") return handleAdminDelete(env, match[1]);

  return null;
}
