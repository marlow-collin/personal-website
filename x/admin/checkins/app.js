import { adminApi } from "/x/admin/shared/api.js";

const labels = {
  good: "Ziemlich gut ✨",
  unsure: "Ehrlich? Keine Ahnung.",
  bad: "Eher nicht so."
};

const list = document.querySelector("#checkinList");
const stats = document.querySelector("#stats");
const refreshButton = document.querySelector("#refreshButton");
const detailDialog = document.querySelector("#detailDialog");
const closeDetail = document.querySelector("#closeDetail");
const detailTitle = document.querySelector("#detailTitle");
const detailGrid = document.querySelector("#detailGrid");
const publicPath = document.querySelector("#publicPath");
const openSite = document.querySelector("#openSite");
const nameForm = document.querySelector("#nameForm");
const recipientName = document.querySelector("#recipientName");
const saveName = document.querySelector("#saveName");
const mailSwitch = document.querySelector("#mailSwitch");
const mailHelp = document.querySelector("#mailHelp");
const eventSummary = document.querySelector("#eventSummary");
const eventList = document.querySelector("#eventList");
const resetButton = document.querySelector("#resetButton");
const resetDialog = document.querySelector("#resetDialog");
const toast = document.querySelector("#toast");

let checkins = [];
let current = null;
let toastTimer = null;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function formatTime(value) {
  if (!value) return "—";
  const normalized = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin"
  }).format(date);
}

function stateLabel(checkin) {
  return checkin.answer ? labels[checkin.answer] || checkin.answer : "Waiting for answer";
}

function renderStats() {
  const events = checkins.reduce((sum, item) => sum + Number(item.event_count || 0), 0);
  const armed = checkins.filter((item) => item.mail_on_next_answer).length;
  const answered = checkins.filter((item) => item.answer).length;
  stats.innerHTML = [
    ["Check-ins", checkins.length], ["Answered", answered], ["Events", events], ["Mail armed", armed]
  ].map(([label, value]) => `<div class="admin-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderList() {
  renderStats();
  if (!checkins.length) {
    list.innerHTML = '<div class="empty-state"><strong>No check-ins configured</strong><span>The builder is intentionally deferred until the generic content model is defined.</span></div>';
    return;
  }
  list.innerHTML = checkins.map((checkin) => `
    <button class="record-row" type="button" data-slug="${escapeHtml(checkin.slug)}">
      <span class="record-main"><strong>${escapeHtml(checkin.title)}</strong><small>/${escapeHtml(checkin.slug)} · ${escapeHtml(checkin.recipient_name || "No recipient name")}</small></span>
      <span class="record-meta"><small>${escapeHtml(stateLabel(checkin))}</small><small>${Number(checkin.event_count || 0)} events${checkin.mail_on_next_answer ? " · mail armed" : ""}</small></span>
      <span class="record-arrow">›</span>
    </button>`).join("");
}

function eventCopy(event) {
  if (event.type === "answer") return { title: labels[event.value] || event.value || "Answer", meta: "Answer selected" };
  if (event.type === "analysis_off") return { title: "Analysis mode switched off", meta: event.value && labels[event.value] ? `after “${labels[event.value]}”` : "" };
  return { title: event.type || "Event", meta: event.value || "" };
}

function renderDetail(data) {
  current = data;
  const checkin = data.checkin;
  detailTitle.textContent = checkin.title;
  const status = checkin.answer ? stateLabel(checkin) : "Waiting for answer";
  detailGrid.innerHTML = `
    <div><span>Slug</span><strong>${escapeHtml(checkin.slug)}</strong></div>
    <div><span>Current state</span><strong>${escapeHtml(status)}</strong></div>
    <div><span>Analysis</span><strong>${checkin.answer ? (checkin.analysis_off ? "Off" : "On") : "—"}</strong></div>
    <div><span>Events</span><strong>${Number(checkin.event_count || 0)}</strong></div>`;
  const path = `/x/${checkin.slug}/`;
  publicPath.textContent = path;
  openSite.href = path;
  recipientName.value = checkin.recipient_name || "";

  const enabled = Boolean(checkin.mail_on_next_answer);
  mailSwitch.setAttribute("aria-checked", enabled ? "true" : "false");
  mailSwitch.querySelector("b").textContent = enabled ? "On" : "Off";
  mailSwitch.disabled = Boolean(checkin.mail_pending) || !checkin.mail_configured;
  mailHelp.textContent = checkin.mail_pending
    ? "A notification is currently being sent."
    : !checkin.mail_configured
      ? "Mail is not fully configured in the Worker environment."
      : enabled ? "Armed for the next answer, then switches off automatically." : "Email on the next answer only.";

  eventSummary.textContent = `${data.events.length} stored ${data.events.length === 1 ? "event" : "events"}`;
  if (!data.events.length) {
    eventList.innerHTML = '<div class="event-empty">No response history yet.</div>';
  } else {
    eventList.innerHTML = data.events.map((event) => {
      const copy = eventCopy(event);
      return `<div class="event-row"><span class="event-dot"></span><span class="event-copy"><strong>${escapeHtml(copy.title)}</strong><small>${escapeHtml(copy.meta)}</small></span><time>${escapeHtml(formatTime(event.created_at))}</time></div>`;
    }).join("");
  }
}

async function loadList({ quiet = false } = {}) {
  if (!quiet) list.innerHTML = '<div class="skeleton-line">Loading check-ins…</div>';
  try {
    const data = await adminApi("/checkins");
    checkins = data.checkins || [];
    renderList();
  } catch (error) {
    list.innerHTML = `<div class="empty-state"><strong>Could not load check-ins</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

async function openCheckin(slug) {
  try {
    const data = await adminApi(`/checkins/${encodeURIComponent(slug)}`);
    renderDetail(data);
    if (!detailDialog.open) detailDialog.showModal();
  } catch (error) {
    showToast(error.message);
  }
}

list.addEventListener("click", (event) => {
  const row = event.target.closest("[data-slug]");
  if (row) openCheckin(row.dataset.slug);
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  await loadList({ quiet: true });
  refreshButton.disabled = false;
});

closeDetail.addEventListener("click", () => detailDialog.close());

detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) detailDialog.close();
});

nameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!current) return;
  saveName.disabled = true;
  try {
    const name = recipientName.value.trim();
    await adminApi(`/checkins/${encodeURIComponent(current.checkin.slug)}/recipient-name`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name })
    });
    showToast(name ? "Recipient name saved." : "Recipient name removed.");
    await openCheckin(current.checkin.slug);
    await loadList({ quiet: true });
  } catch (error) {
    showToast(error.message);
  } finally {
    saveName.disabled = false;
  }
});

mailSwitch.addEventListener("click", async () => {
  if (!current || mailSwitch.disabled) return;
  const enabled = mailSwitch.getAttribute("aria-checked") !== "true";
  mailSwitch.disabled = true;
  try {
    await adminApi(`/checkins/${encodeURIComponent(current.checkin.slug)}/mail-next`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled })
    });
    showToast(enabled ? "Notification armed for the next answer." : "Notification disabled.");
    await openCheckin(current.checkin.slug);
    await loadList({ quiet: true });
  } catch (error) {
    showToast(error.message);
    await openCheckin(current.checkin.slug);
  }
});

resetButton.addEventListener("click", () => resetDialog.showModal());
resetDialog.addEventListener("close", async () => {
  if (resetDialog.returnValue !== "confirm" || !current) return;
  resetButton.disabled = true;
  try {
    await adminApi(`/checkins/${encodeURIComponent(current.checkin.slug)}/reset`, { method: "POST" });
    showToast("Response history reset.");
    await openCheckin(current.checkin.slug);
    await loadList({ quiet: true });
  } catch (error) {
    showToast(error.message);
  } finally {
    resetButton.disabled = false;
  }
});

loadList();
