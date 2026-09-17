import { connect } from "cloudflare:sockets";

const ANSWERS = new Map([
  ["good", "Ziemlich gut ✨"],
  ["unsure", "Ehrlich? Keine Ahnung."],
  ["bad", "Eher nicht so."]
]);

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function checkinDb(env) {
  if (!env.CHECKIN_DB) throw new Error("CHECKIN_DB binding fehlt.");
  return env.CHECKIN_DB;
}

async function getCheckin(env, slug) {
  return checkinDb(env)
    .prepare(`
      SELECT id, slug, title, recipient_name, mail_on_next_answer, mail_claim, created_at
      FROM checkins
      WHERE slug = ?
    `)
    .bind(slug)
    .first();
}

async function getCurrentState(env, checkin) {
  const db = checkinDb(env);
  const latestAnswer = await db
    .prepare(`
      SELECT id, value, created_at
      FROM checkin_events
      WHERE checkin_id = ? AND type = 'answer'
      ORDER BY id DESC
      LIMIT 1
    `)
    .bind(checkin.id)
    .first();

  let analysisOff = false;
  if (latestAnswer) {
    const latestAnalysis = await db
      .prepare(`
        SELECT id
        FROM checkin_events
        WHERE checkin_id = ? AND type = 'analysis_off' AND id > ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(checkin.id, latestAnswer.id)
      .first();
    analysisOff = Boolean(latestAnalysis);
  }

  return {
    slug: checkin.slug,
    title: checkin.title,
    recipient_name: checkin.recipient_name || null,
    answer: latestAnswer?.value || null,
    analysis_off: analysisOff
  };
}

function answerLabel(value) {
  return ANSWERS.get(value) || value;
}

function utf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function mimeWord(value) {
  return `=?UTF-8?B?${utf8Base64(value)}?=`;
}

function smtpAddress(value, label) {
  const address = String(value || "").trim();
  if (!address || /[\r\n<>]/.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new Error(`${label} ist keine gültige E-Mail-Adresse.`);
  }
  return address;
}

function createSmtpResponseReader(readable) {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function readLine() {
    while (true) {
      const newline = buffer.indexOf("\r\n");
      if (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        return line;
      }
      const { value, done } = await reader.read();
      if (done) {
        if (buffer) {
          const line = buffer;
          buffer = "";
          return line;
        }
        throw new Error("SMTP-Verbindung wurde unerwartet beendet.");
      }
      buffer += decoder.decode(value, { stream: true });
    }
  }

  return {
    async read(expectedCodes) {
      const allowed = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
      let firstCode = null;
      let lastLine = "";

      while (true) {
        const line = await readLine();
        lastLine = line;
        const match = line.match(/^(\d{3})([ -])/);
        if (!match) continue;
        const code = Number(match[1]);
        if (firstCode === null) firstCode = code;
        if (match[2] === "-") continue;
        if (!allowed.includes(code)) {
          throw new Error(`SMTP ${code}: ${lastLine}`);
        }
        return { code, line: lastLine };
      }
    },
    release() {
      try { reader.releaseLock(); } catch {}
    }
  };
}

function formatBerlinTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date);
}

async function sendCheckinNotification(env, { slug, answer }) {
  const sender = smtpAddress(env.IONOS_SMTP_USER, "IONOS_SMTP_USER");
  const recipient = smtpAddress(
    env.CHECKIN_EMAIL_DESTINATION || env.DATE_EMAIL_DESTINATION,
    "CHECKIN_EMAIL_DESTINATION/DATE_EMAIL_DESTINATION"
  );
  if (!env.IONOS_SMTP_PASSWORD) throw new Error("IONOS_SMTP_PASSWORD fehlt.");

  const socket = connect(
    { hostname: "smtp.ionos.de", port: 465 },
    { secureTransport: "on", allowHalfOpen: false }
  );

  await socket.opened;
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  const responses = createSmtpResponseReader(socket.readable);

  async function writeRaw(value) {
    await writer.write(encoder.encode(value));
  }

  async function command(value, expectedCodes) {
    await writeRaw(`${value}\r\n`);
    return responses.read(expectedCodes);
  }

  try {
    await responses.read(220);
    await command("EHLO marlow-rischmueller.com", 250);
    await command("AUTH LOGIN", 334);
    await command(utf8Base64(sender), 334);
    await command(utf8Base64(env.IONOS_SMTP_PASSWORD), 235);
    await command(`MAIL FROM:<${sender}>`, 250);
    await command(`RCPT TO:<${recipient}>`, [250, 251]);
    await command("DATA", 354);

    const subject = `Check-in beantwortet · ${answerLabel(answer)}`;
    const body = [
      "Persönlicher Check-in",
      "",
      `Seite: ${slug}`,
      `Auswahl: ${answerLabel(answer)}`,
      `Zeit: ${formatBerlinTimestamp()}`
    ]
      .join("\n")
      .replace(/\r?\n/g, "\r\n")
      .replace(/(^|\r\n)\./g, "$1..");

    const message = [
      `From: Personal Check-in <${sender}>`,
      `To: <${recipient}>`,
      `Subject: ${mimeWord(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@marlow-rischmueller.com>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      body
    ].join("\r\n");

    await writeRaw(`${message}\r\n.\r\n`);
    await responses.read(250);

    try {
      await command("QUIT", 221);
    } catch {
      // Die Nachricht wurde bereits mit SMTP 250 angenommen.
    }
  } finally {
    try { writer.releaseLock(); } catch {}
    try { responses.release(); } catch {}
    try { socket.close(); } catch {}
  }
}

async function queueAnswerMailIfArmed(env, ctx, checkin, answer) {
  const db = checkinDb(env);
  const claimId = `pending:${crypto.randomUUID()}`;
  const claim = await db
    .prepare(`
      UPDATE checkins
      SET mail_on_next_answer = 0, mail_claim = ?
      WHERE id = ? AND mail_on_next_answer = 1 AND mail_claim IS NULL
    `)
    .bind(claimId, checkin.id)
    .run();

  if ((claim.meta?.changes || 0) !== 1) return;

  ctx.waitUntil((async () => {
    try {
      await sendCheckinNotification(env, { slug: checkin.slug, answer });
      await db
        .prepare(`
          UPDATE checkins
          SET mail_claim = NULL
          WHERE id = ? AND mail_claim = ?
        `)
        .bind(checkin.id, claimId)
        .run();
    } catch (error) {
      await db
        .prepare(`
          UPDATE checkins
          SET mail_on_next_answer = 1, mail_claim = NULL
          WHERE id = ? AND mail_claim = ?
        `)
        .bind(checkin.id, claimId)
        .run();
      console.error("Check-in notification email failed", {
        code: error?.code,
        message: error?.message
      });
    }
  })());
}

async function handlePublicState(env, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);
  return json(await getCurrentState(env, checkin));
}

async function handlePublicEvent(request, env, ctx, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  const db = checkinDb(env);

  if (body?.type === "answer") {
    const value = String(body?.value || "");
    if (!ANSWERS.has(value)) return json({ error: "Ungültige Antwort." }, 400);

    await db
      .prepare(`
        INSERT INTO checkin_events (checkin_id, type, value)
        VALUES (?, 'answer', ?)
      `)
      .bind(checkin.id, value)
      .run();

    // Der HTTP-Request wartet nur auf die Speicherung und den atomaren Mail-Claim.
    // Der eigentliche SMTP-Versand läuft danach via waitUntil im Hintergrund.
    await queueAnswerMailIfArmed(env, ctx, checkin, value);

    return json({
      ok: true,
      state: {
        slug: checkin.slug,
        title: checkin.title,
        recipient_name: checkin.recipient_name || null,
        answer: value,
        analysis_off: false
      }
    });
  }

  if (body?.type === "analysis_off") {
    const latestAnswer = await db
      .prepare(`
        SELECT id, value
        FROM checkin_events
        WHERE checkin_id = ? AND type = 'answer'
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(checkin.id)
      .first();

    if (!latestAnswer) {
      return json({ error: "Noch keine Antwort vorhanden." }, 409);
    }

    const alreadyOff = await db
      .prepare(`
        SELECT id
        FROM checkin_events
        WHERE checkin_id = ? AND type = 'analysis_off' AND id > ?
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(checkin.id, latestAnswer.id)
      .first();

    if (!alreadyOff) {
      await db
        .prepare(`
          INSERT INTO checkin_events (checkin_id, type, value)
          VALUES (?, 'analysis_off', ?)
        `)
        .bind(checkin.id, latestAnswer.value)
        .run();
    }

    return json({
      ok: true,
      state: {
        slug: checkin.slug,
        title: checkin.title,
        recipient_name: checkin.recipient_name || null,
        answer: latestAnswer.value,
        analysis_off: true
      }
    });
  }

  return json({ error: "Unbekanntes oder ungültiges Event." }, 400);
}

async function adminSnapshot(env, checkin) {
  const db = checkinDb(env);
  const state = await getCurrentState(env, checkin);
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM checkin_events WHERE checkin_id = ?")
    .bind(checkin.id)
    .first();

  return {
    ...state,
    mail_on_next_answer: Boolean(checkin.mail_on_next_answer),
    mail_pending: Boolean(checkin.mail_claim),
    mail_configured: Boolean(
      env.IONOS_SMTP_USER &&
      env.IONOS_SMTP_PASSWORD &&
      (env.CHECKIN_EMAIL_DESTINATION || env.DATE_EMAIL_DESTINATION)
    ),
    event_count: Number(count?.count || 0),
    created_at: checkin.created_at
  };
}

async function handleAdminList(env) {
  const result = await checkinDb(env)
    .prepare(`
      SELECT id, slug, title, recipient_name, mail_on_next_answer, mail_claim, created_at
      FROM checkins
      ORDER BY created_at ASC, id ASC
    `)
    .all();

  const checkins = await Promise.all((result.results || []).map((row) => adminSnapshot(env, row)));
  return json({ checkins });
}

async function handleAdminDetail(env, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);

  const events = await checkinDb(env)
    .prepare(`
      SELECT id, type, value, created_at
      FROM checkin_events
      WHERE checkin_id = ?
      ORDER BY id DESC
    `)
    .bind(checkin.id)
    .all();

  return json({
    checkin: await adminSnapshot(env, checkin),
    events: events.results || []
  });
}

async function handleAdminRecipientName(request, env, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  if (typeof body?.name !== "string") {
    return json({ error: "name muss ein String sein." }, 400);
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  if (name.length > 60) {
    return json({ error: "Der Name darf höchstens 60 Zeichen lang sein." }, 400);
  }

  await checkinDb(env)
    .prepare(`
      UPDATE checkins
      SET recipient_name = ?
      WHERE id = ?
    `)
    .bind(name || null, checkin.id)
    .run();

  return json({ ok: true, recipient_name: name || null });
}

async function handleAdminMailToggle(request, env, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  if (typeof body?.enabled !== "boolean") {
    return json({ error: "enabled muss true oder false sein." }, 400);
  }

  if (body.enabled && checkin.mail_claim) {
    return json({ error: "Ein Mailversand läuft gerade noch." }, 409);
  }

  await checkinDb(env)
    .prepare(`
      UPDATE checkins
      SET mail_on_next_answer = ?
      WHERE id = ?
    `)
    .bind(body.enabled ? 1 : 0, checkin.id)
    .run();

  return json({ ok: true, enabled: body.enabled });
}

async function handleAdminReset(env, slug) {
  const checkin = await getCheckin(env, slug);
  if (!checkin) return json({ error: "Check-in nicht gefunden." }, 404);
  if (checkin.mail_claim) {
    return json({ error: "Ein Mailversand läuft gerade noch. Bitte danach erneut zurücksetzen." }, 409);
  }

  await checkinDb(env)
    .prepare("DELETE FROM checkin_events WHERE checkin_id = ?")
    .bind(checkin.id)
    .run();

  return json({ ok: true });
}

export async function handleCheckinRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  let match;

  match = path.match(/^\/x\/api\/checkin\/([a-z0-9-]{1,80})\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "GET") {
    return handlePublicState(env, match[1]);
  }

  match = path.match(/^\/x\/api\/checkin\/([a-z0-9-]{1,80})\/event\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "POST") {
    return handlePublicEvent(request, env, ctx, match[1]);
  }

  // Canonical Check-ins Admin API. The legacy /x/admin3/api namespace stays
  // available until the final cleanup patch so rollback remains straightforward.
  if ((path === "/x/admin/api/checkins" || path === "/x/admin3/api/checkins") && request.method === "GET") {
    return handleAdminList(env);
  }

  match = path.match(/^\/x\/(?:admin\/api|admin3\/api)\/checkins\/([a-z0-9-]{1,80})\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "GET") {
    return handleAdminDetail(env, match[1]);
  }

  match = path.match(/^\/x\/(?:admin\/api|admin3\/api)\/checkins\/([a-z0-9-]{1,80})\/recipient-name\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "POST") {
    return handleAdminRecipientName(request, env, match[1]);
  }

  match = path.match(/^\/x\/(?:admin\/api|admin3\/api)\/checkins\/([a-z0-9-]{1,80})\/mail-next\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "POST") {
    return handleAdminMailToggle(request, env, match[1]);
  }

  match = path.match(/^\/x\/(?:admin\/api|admin3\/api)\/checkins\/([a-z0-9-]{1,80})\/reset\/?$/);
  if (match && SLUG_RE.test(match[1]) && request.method === "POST") {
    return handleAdminReset(env, match[1]);
  }

  return null;
}
