const page = document.querySelector("#eventPage");
const invite = document.querySelector("#invite");
const errorCard = document.querySelector("#errorCard");
const $ = selector => document.querySelector(selector);
let eventData = null;
let timer = null;

function eventSlug() {
  const match = location.pathname.match(/^\/x\/event\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return match ? match[1] : "";
}

function parts(date, timeZone) {
  const result = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(date)) if (part.type !== "literal") result[part.type] = Number(part.value);
  return result;
}

function dayNumber(date, timeZone) {
  const p = parts(date, timeZone);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86400000);
}

function dateText(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday:"long", day:"numeric", month:"long", year:"numeric" }).format(date).replace(",", " ·");
}
function timeText(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).format(date);
}
function plural(value, unit) { return `${value} ${unit}${value === 1 ? "" : "s"}`; }
function hAndM(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}
function daysAndHours(ms) {
  const totalHours = Math.max(0, Math.floor(ms / 3600000));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}
function themeStartMessage() { return eventData.theme === "card-room" ? "The table is open." : "It starts now."; }

function stateAt(now = new Date()) {
  const start = new Date(eventData.start_at);
  const end = eventData.end_at ? new Date(eventData.end_at) : null;
  const diff = start - now;
  const dayDiff = dayNumber(start, eventData.timezone) - dayNumber(now, eventData.timezone);
  const startHour = parts(start, eventData.timezone).hour;

  if (diff > 0) {
    if (dayDiff === 1 && diff <= 48 * 3600000) return { status:"Tomorrow", kicker:"", primary:"Tomorrow", secondary:`Starts in ${hAndM(diff)}` };
    if (dayDiff === 0 && diff > 6 * 3600000) return { status:startHour >= 17 ? "Tonight" : "Today", kicker:"", primary:startHour >= 17 ? "Tonight" : "Today", secondary:`Starts in ${hAndM(diff)}` };
    if (diff <= 10 * 60000) {
      const totalSeconds = Math.max(0, Math.floor(diff / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return { status:"Soon", kicker:"Starts in", primary:`${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`, secondary:"" };
    }
    if (diff <= 60 * 60000) return { status:"Soon", kicker:"Starts in", primary:plural(Math.ceil(diff / 60000), "minute"), secondary:"" };
    if (diff <= 6 * 3600000) return { status:"Upcoming", kicker:"Starts in", primary:hAndM(diff), secondary:"" };
    const { days, hours } = daysAndHours(diff);
    if (diff > 30 * 86400000) return { status:"Upcoming", kicker:"Starts in", primary:plural(Math.ceil(diff / 86400000), "day"), secondary:dateText(start, eventData.timezone) };
    return { status:"Upcoming", kicker:"Starts in", primary:plural(days, "day"), secondary:hours ? `${plural(hours, "hour")} to go` : "" };
  }

  const elapsed = now - start;
  if (elapsed <= 5 * 60000) return { status:"Now", kicker:"", primary:"It's time.", secondary:themeStartMessage() };

  if (end && now < end) return { status:"Live", kicker:"", primary:"Happening now.", secondary:`Started at ${timeText(start, eventData.timezone)}` };

  const pastDayDiff = dayNumber(now, eventData.timezone) - dayNumber(start, eventData.timezone);
  if (pastDayDiff === 0) {
    if (elapsed < 3600000) return { status:"Started", kicker:"", primary:`Started ${plural(Math.floor(elapsed / 60000), "minute")} ago`, secondary:"" };
    return { status:"Started", kicker:"", primary:`Started ${plural(Math.floor(elapsed / 3600000), "hour")} ago`, secondary:"" };
  }
  if (pastDayDiff === 1) return { status:"Over", kicker:"", primary:"Was yesterday.", secondary:dateText(start, eventData.timezone) };
  if (pastDayDiff <= 30) return { status:"Over", kicker:"", primary:`Was ${plural(pastDayDiff, "day")} ago.`, secondary:dateText(start, eventData.timezone) };
  return { status:"Over", kicker:"", primary:"Event over.", secondary:dateText(start, eventData.timezone) };
}

function updateCountdown() {
  const state = stateAt();
  $("#statusPill").textContent = state.status;
  $("#countdownKicker").textContent = state.kicker;
  $("#countdownKicker").hidden = !state.kicker;
  $("#countdownPrimary").textContent = state.primary;
  $("#countdownSecondary").textContent = state.secondary;
}

function render(event) {
  eventData = event;
  page.dataset.theme = event.theme || "minimal";
  document.title = event.title;
  $("#title").textContent = event.title;
  $("#eyebrow").textContent = event.eyebrow || "Secret Event";

  if (event.icon) { $("#eventIcon").textContent = event.icon; $("#eventIcon").hidden = false; }
  if (event.subtitle) { $("#subtitle").textContent = event.subtitle; $("#subtitle").hidden = false; }
  if (event.description) { $("#description").textContent = event.description; $("#description").hidden = false; }
  if (event.closing_message) { $("#closing").textContent = event.closing_message; $("#closing").hidden = false; }

  const start = new Date(event.start_at);
  $("#dateLabel").textContent = dateText(start, event.timezone);
  $("#timeLabel").textContent = timeText(start, event.timezone);

  if (event.details?.length) {
    $("#details").innerHTML = event.details.map(item => `<div class="detail-item"><span></span><strong></strong></div>`).join("");
    [...$("#details").children].forEach((node, index) => {
      node.querySelector("span").textContent = event.details[index].label;
      node.querySelector("strong").textContent = event.details[index].value;
    });
    $("#details").hidden = false;
  }

  if (event.location_label) {
    $("#locationLabel").textContent = event.location_label;
    const location = $("#location");
    if (event.location_url) { location.href = event.location_url; location.target = "_blank"; location.rel = "noopener noreferrer"; }
    else { location.removeAttribute("href"); location.querySelector("b").hidden = true; }
    location.hidden = false;
  }

  if (event.primary_cta_label && event.primary_cta_url) {
    const action = $("#primaryAction"); action.textContent = event.primary_cta_label; action.href = event.primary_cta_url;
    if (!event.primary_cta_url.startsWith("/")) { action.target = "_blank"; action.rel = "noopener noreferrer"; }
    action.hidden = false;
  }
  const secondary = $("#secondaryActions");
  for (const link of event.links || []) {
    const anchor = document.createElement("a"); anchor.textContent = link.label; anchor.href = link.url;
    if (!link.url.startsWith("/")) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
    secondary.append(anchor);
  }
  if (!secondary.children.length) secondary.hidden = true;
  $("#calendarAction").href = `/x/event/${encodeURIComponent(event.slug)}/calendar.ics`;

  updateCountdown();
  timer = setInterval(updateCountdown, 1000);
  invite.hidden = false;
  page.setAttribute("aria-busy", "false");
}

async function init() {
  const slug = eventSlug();
  if (!slug) throw new Error("Invalid event path");
  const response = await fetch(`/x/api/event/${encodeURIComponent(slug)}`, { headers:{ Accept:"application/json" } });
  if (!response.ok) throw new Error("Event unavailable");
  render(await response.json());
}

init().catch(() => { invite.hidden = true; errorCard.hidden = false; page.setAttribute("aria-busy", "false"); });
window.addEventListener("pagehide", () => { if (timer) clearInterval(timer); });
