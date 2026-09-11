import { connect } from "cloudflare:sockets";

const THEMES = new Set(["soft-playful", "dark-elegant"]);
const PUBLIC_FIELDS = `
  token, first_name, personal_message, final_message, theme, status, no_attempts,
  activity, day_preference, time_preference, ride_preference,
  accepted_at, completed_at
`;

function json(data, status=200, extraHeaders={}){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Robots-Tag":"noindex, nofollow, noarchive, nosnippet",
      ...extraHeaders
    }
  });
}

function cleanString(value, max=120){
  if(value == null) return "";
  return String(value).trim().slice(0,max);
}

function randomToken(bytes=24){
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let binary="";
  for(const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function getInvitation(env, token, publicOnly=false){
  const fields = publicOnly ? PUBLIC_FIELDS : "*";
  return env.DB.prepare(`SELECT ${fields} FROM invitations WHERE token = ?`).bind(token).first();
}

async function serveThemeAsset(request, env, theme){
  const safeTheme = THEMES.has(theme) ? theme : "soft-playful";
  const url = new URL(request.url);
  url.pathname = `/x/_date-templates/${safeTheme}/index.html`;
  url.search = "";
  const assetResponse = await env.ASSETS.fetch(new Request(url.toString(), {method:"GET"}));
  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control","no-store");
  headers.set("X-Robots-Tag","noindex, nofollow, noarchive, nosnippet");
  return new Response(assetResponse.body, {status:assetResponse.status, headers});
}

async function handlePublicPage(request, env, token){
  const inv = await getInvitation(env, token, true);
  if(!inv) return new Response("Invitation not found", {
    status:404,
    headers:{"Content-Type":"text/plain; charset=utf-8","X-Robots-Tag":"noindex, nofollow, noarchive, nosnippet"}
  });
  return serveThemeAsset(request, env, inv.theme);
}

async function handlePublicGet(request, env, token){
  let inv = await getInvitation(env, token, true);
  if(!inv) return json({error:"Einladung nicht gefunden."},404);

  const url = new URL(request.url);
  const preview = url.searchParams.get("preview") === "1";
  if(!preview && !inv.completed_at){
    await env.DB.prepare(`
      UPDATE invitations
      SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
          status = CASE WHEN status = 'created' THEN 'opened' ELSE status END
      WHERE token = ?
    `).bind(token).run();
    inv = await getInvitation(env, token, true);
  }

  return json(inv);
}

const VALID_VALUES = {
  activity: new Set(["Café","Billard","Drinks","Überrasch mich"]),
  day: new Set(["Unter der Woche","Freitag","Wochenende","Flexibel"]),
  time: new Set(["Nachmittags","Abends"]),
  ride: new Set(["Hol mich ab","Ich komme selbst","Klären wir später"]),
};


function notificationSubject(inv){
  return `Date-Zusage von ${inv.first_name} 🎉`;
}

function notificationText(inv){
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

function utf8Base64(value){
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for(const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function mimeWord(value){
  return `=?UTF-8?B?${utf8Base64(value)}?=`;
}

function smtpAddress(value, label){
  const address = String(value || "").trim();
  if(!address || /[\r\n<>]/.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){
    throw new Error(`${label} ist keine gültige E-Mail-Adresse.`);
  }
  return address;
}

function createSmtpResponseReader(readable){
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function readLine(){
    while(true){
      const newline = buffer.indexOf("\r\n");
      if(newline >= 0){
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        return line;
      }

      const {value, done} = await reader.read();
      if(done) throw new Error("SMTP-Verbindung wurde unerwartet beendet.");
      buffer += decoder.decode(value, {stream:true});
    }
  }

  return {
    async read(expectedCodes){
      const accepted = new Set(Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes]);
      let responseCode = null;
      const lines = [];

      while(true){
        const line = await readLine();
        lines.push(line);

        const match = line.match(/^(\d{3})([ -])(.*)$/);
        if(!match) continue;

        if(responseCode === null) responseCode = Number(match[1]);

        if(match[2] === " "){
          if(!accepted.has(Number(match[1]))){
            throw new Error(`SMTP ${match[1]}: ${lines.join(" | ")}`);
          }
          return {code:Number(match[1]), lines};
        }
      }
    },
    release(){
      reader.releaseLock();
    }
  };
}

async function sendDateNotification(env, inv){
  if(!env.IONOS_SMTP_USER) throw new Error("IONOS_SMTP_USER Secret fehlt.");
  if(!env.IONOS_SMTP_PASSWORD) throw new Error("IONOS_SMTP_PASSWORD Secret fehlt.");
  if(!env.DATE_EMAIL_DESTINATION) throw new Error("DATE_EMAIL_DESTINATION Secret fehlt.");

  const sender = smtpAddress(env.IONOS_SMTP_USER, "IONOS_SMTP_USER");
  const recipient = smtpAddress(env.DATE_EMAIL_DESTINATION, "DATE_EMAIL_DESTINATION");

  const socket = connect(
    {hostname:"smtp.ionos.de", port:465},
    {secureTransport:"on"}
  );

  await socket.opened;

  const responses = createSmtpResponseReader(socket.readable);
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();

  async function writeRaw(value){
    await writer.write(encoder.encode(value));
  }

  async function command(value, expectedCodes){
    await writeRaw(`${value}\r\n`);
    return responses.read(expectedCodes);
  }

  try{
    await responses.read(220);
    await command("EHLO marlow-rischmueller.com", 250);

    await command("AUTH LOGIN", 334);
    await command(utf8Base64(sender), 334);
    await command(utf8Base64(env.IONOS_SMTP_PASSWORD), 235);

    await command(`MAIL FROM:<${sender}>`, 250);
    await command(`RCPT TO:<${recipient}>`, [250,251]);
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

    try{
      await command("QUIT", 221);
    }catch{
      // Die Mail wurde bereits mit SMTP 250 angenommen; QUIT ist danach nicht kritisch.
    }
  }finally{
    try{ writer.releaseLock(); }catch{}
    try{ responses.release(); }catch{}
    try{ socket.close(); }catch{}
  }
}

async function handlePublicEvent(request, env, token, ctx){
  const inv = await getInvitation(env, token, true);
  if(!inv) return json({error:"Einladung nicht gefunden."},404);

  let body;
  try{ body = await request.json(); }
  catch{ return json({error:"Ungültige Anfrage."},400); }

  const type = body?.type;
  const value = body?.value;

  if(type === "no"){
    await env.DB.prepare("UPDATE invitations SET no_attempts = no_attempts + 1 WHERE token = ?")
      .bind(token).run();
    return json({ok:true});
  }

  if(type === "accept"){
    await env.DB.prepare(`
      UPDATE invitations
      SET accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP),
          status = CASE WHEN status IN ('created','opened') THEN 'accepted' ELSE status END
      WHERE token = ?
    `).bind(token).run();
    return json({ok:true});
  }

  if(type === "activity" && VALID_VALUES.activity.has(value)){
    await env.DB.prepare("UPDATE invitations SET activity = ? WHERE token = ?").bind(value,token).run();
    return json({ok:true});
  }

  if(type === "day" && VALID_VALUES.day.has(value)){
    await env.DB.prepare("UPDATE invitations SET day_preference = ? WHERE token = ?").bind(value,token).run();
    return json({ok:true});
  }

  if(type === "time" && VALID_VALUES.time.has(value)){
    await env.DB.prepare("UPDATE invitations SET time_preference = ? WHERE token = ?").bind(value,token).run();
    return json({ok:true});
  }

  if(type === "ride" && VALID_VALUES.ride.has(value)){
    await env.DB.prepare("UPDATE invitations SET ride_preference = ? WHERE token = ?").bind(value,token).run();
    return json({ok:true});
  }

  if(type === "complete"){
    await env.DB.prepare(`
      UPDATE invitations
      SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
          status = 'completed'
      WHERE token = ?
    `).bind(token).run();

    /*
      Atomarer Versand-Claim:
      Nur der erste parallele complete-Request darf notification_sent_at
      von NULL auf einen Claim-Wert setzen und damit die Mail senden.
    */
    const claimId = `pending:${crypto.randomUUID()}`;
    const claim = await env.DB.prepare(`
      UPDATE invitations
      SET notification_sent_at = ?
      WHERE token = ? AND notification_sent_at IS NULL
    `).bind(claimId, token).run();

    if((claim.meta?.changes || 0) === 1){
      // Mailversand läuft nach der HTTP-Antwort weiter und blockiert die Abschlussseite nicht.
      ctx.waitUntil((async()=>{
        try{
          const fullInvitation = await getInvitation(env, token, false);
          await sendDateNotification(env, fullInvitation);

          await env.DB.prepare(`
            UPDATE invitations
            SET notification_sent_at = CURRENT_TIMESTAMP
            WHERE token = ? AND notification_sent_at = ?
          `).bind(token, claimId).run();
        }catch(error){
          // Versand fehlgeschlagen: Claim freigeben, damit ein späterer Versuch erneut senden kann.
          await env.DB.prepare(`
            UPDATE invitations
            SET notification_sent_at = NULL
            WHERE token = ? AND notification_sent_at = ?
          `).bind(token, claimId).run();

          console.error("Date notification email failed", {
            code: error?.code,
            message: error?.message
          });
        }
      })());
    }

    return json({ok:true});
  }

  return json({error:"Unbekanntes oder ungültiges Event."},400);
}

async function handleAdminList(env){
  const result = await env.DB.prepare(`
    SELECT token, first_name, internal_label, personal_message, final_message, theme, status,
           no_attempts, activity, day_preference, time_preference, ride_preference,
           created_at, opened_at, accepted_at, completed_at, notification_sent_at
    FROM invitations
    ORDER BY created_at DESC
  `).all();
  return json({invitations: result.results || []});
}

async function handleAdminDetail(env, token){
  const inv = await getInvitation(env, token, false);
  if(!inv) return json({error:"Einladung nicht gefunden."},404);
  return json(inv);
}

async function handleAdminCreate(request, env){
  let body;
  try{ body = await request.json(); }
  catch{ return json({error:"Ungültige Anfrage."},400); }

  const firstName = cleanString(body.first_name,60);
  const internalLabel = cleanString(body.internal_label,120);
  const personalMessage = cleanString(body.personal_message,240) || "Ich wollte dich etwas fragen.";
  const finalMessage = cleanString(body.final_message,240) || "Klingt nach einem ziemlich guten Plan ✨";
  const theme = cleanString(body.theme,30);

  if(!firstName) return json({error:"Vorname fehlt."},400);
  if(!THEMES.has(theme)) return json({error:"Unbekanntes Design."},400);

  let token;
  for(let attempt=0; attempt<3; attempt++){
    token = randomToken(24);
    try{
      await env.DB.prepare(`
        INSERT INTO invitations
          (token, first_name, internal_label, personal_message, final_message, theme, status)
        VALUES (?, ?, ?, ?, ?, ?, 'created')
      `).bind(token,firstName,internalLabel,personalMessage,finalMessage,theme).run();
      return json({token},201);
    }catch(err){
      if(attempt===2) throw err;
    }
  }
  return json({error:"Token konnte nicht erzeugt werden."},500);
}

async function handleAdminReset(env, token){
  const inv = await getInvitation(env, token, false);
  if(!inv) return json({error:"Einladung nicht gefunden."},404);
  await env.DB.prepare(`
    UPDATE invitations SET status='created', no_attempts=0, activity=NULL,
      day_preference=NULL, time_preference=NULL, ride_preference=NULL,
      opened_at=NULL, accepted_at=NULL, completed_at=NULL,
      notification_sent_at=NULL WHERE token=?
  `).bind(token).run();
  return json({ok:true});
}

async function handleAdminDelete(env, token){
  const inv = await getInvitation(env, token, false);
  if(!inv) return json({error:"Einladung nicht gefunden."},404);
  await env.DB.prepare("DELETE FROM invitations WHERE token=?").bind(token).run();
  return json({ok:true});
}

async function serveStatic(request, env){
  const response = await env.ASSETS.fetch(request);
  const url = new URL(request.url);
  if(!url.pathname.startsWith("/x/")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag","noindex, nofollow, noarchive, nosnippet");
  headers.set("Referrer-Policy","no-referrer");
  headers.set("X-Content-Type-Options","nosniff");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    const path = url.pathname;

    try{
      // Dynamic public invitation HTML
      let m = path.match(/^\/x\/date\/([A-Za-z0-9_-]{20,80})\/?$/);
      if(m && request.method==="GET") return handlePublicPage(request,env,m[1]);

      // Public invitation data/events
      m = path.match(/^\/x\/api\/date\/([A-Za-z0-9_-]{20,80})\/?$/);
      if(m && request.method==="GET") return handlePublicGet(request,env,m[1]);

      m = path.match(/^\/x\/api\/date\/([A-Za-z0-9_-]{20,80})\/event\/?$/);
      if(m && request.method==="POST") return handlePublicEvent(request,env,m[1],ctx);

      // Admin API. Protect /x/admin/* with Cloudflare Access in production.
      if(path==="/x/admin/api/invitations" && request.method==="GET") return handleAdminList(env);
      if(path==="/x/admin/api/invitations" && request.method==="POST") return handleAdminCreate(request,env);

      m = path.match(/^\/x\/admin\/api\/invitations\/([A-Za-z0-9_-]{20,80})\/?$/);
      if(m && request.method==="GET") return handleAdminDetail(env,m[1]);

      m = path.match(/^\/x\/admin\/api\/invitations\/([A-Za-z0-9_-]{20,80})\/reset\/?$/);
      if(m && request.method==="POST") return handleAdminReset(env,m[1]);

      m = path.match(/^\/x\/admin\/api\/invitations\/([A-Za-z0-9_-]{20,80})\/?$/);
      if(m && request.method==="DELETE") return handleAdminDelete(env,m[1]);

      // Everything else falls through to the existing static site.
      return serveStatic(request, env);
    }catch(err){
      console.error(err);
      return json({error:"Interner Fehler."},500);
    }
  }
};