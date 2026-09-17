import { connect } from "cloudflare:sockets";

function notificationSubject(inv) {
  return `Date-Zusage von ${inv.first_name} 🎉`;
}

function notificationText(inv) {
  const ride = inv.activity === "Drinks"
    ? "entfällt"
    : (inv.ride_preference || "–");

  return [
    `Interne Notiz: ${inv.internal_label || "–"}`,
    `Aktivität: ${inv.activity || "–"}`,
    `Wann: ${inv.day_preference || "–"}`,
    `Zeit: ${inv.time_preference || "–"}`,
    `Fahrt: ${ride}`,
    `Nein-Versuche: ${Number(inv.no_attempts || 0)}`
  ].join("\n");
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
      if (done) throw new Error("SMTP-Verbindung wurde unerwartet beendet.");
      buffer += decoder.decode(value, { stream: true });
    }
  }

  return {
    async read(expectedCodes) {
      const accepted = new Set(Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes]);
      let responseCode = null;
      const lines = [];

      while (true) {
        const line = await readLine();
        lines.push(line);

        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if (!match) continue;

        if (responseCode === null) responseCode = Number(match[1]);

        if (match[2] === " ") {
          if (!accepted.has(Number(match[1]))) {
            throw new Error(`SMTP ${match[1]}: ${lines.join(" | ")}`);
          }
          return { code: Number(match[1]), lines };
        }
      }
    },
    release() {
      reader.releaseLock();
    }
  };
}

export async function sendDateNotification(env, inv) {
  if (!env.IONOS_SMTP_USER) throw new Error("IONOS_SMTP_USER Secret fehlt.");
  if (!env.IONOS_SMTP_PASSWORD) throw new Error("IONOS_SMTP_PASSWORD Secret fehlt.");
  if (!env.DATE_EMAIL_DESTINATION) throw new Error("DATE_EMAIL_DESTINATION Secret fehlt.");

  const sender = smtpAddress(env.IONOS_SMTP_USER, "IONOS_SMTP_USER");
  const recipient = smtpAddress(env.DATE_EMAIL_DESTINATION, "DATE_EMAIL_DESTINATION");

  const socket = connect(
    { hostname: "smtp.ionos.de", port: 465 },
    { secureTransport: "on" }
  );

  await socket.opened;

  const responses = createSmtpResponseReader(socket.readable);
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();

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

    const subject = notificationSubject(inv);
    const body = notificationText(inv)
      .replace(/\r?\n/g, "\r\n")
      .replace(/(^|\r\n)\./g, "$1..");

    const message = [
      `From: Date Invitation <${sender}>`,
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
      // Die Mail wurde bereits mit SMTP 250 angenommen; QUIT ist danach nicht kritisch.
    }
  } finally {
    try { writer.releaseLock(); } catch {}
    try { responses.release(); } catch {}
    try { socket.close(); } catch {}
  }
}
