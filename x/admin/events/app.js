import { adminApi } from "/x/admin/shared/api.js";

const $ = selector => document.querySelector(selector);
const form = $("#eventForm");
const dialog = $("#eventDialog");
const list = $("#eventList");
const toast = $("#toast");
let current = null;
let rows = [];

function esc(value = "") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function showToast(text) { toast.textContent = text; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.hidden = true, 2200); }
function setBusy(busy) { $("#saveButton").disabled = busy; $("#saveButton").setAttribute("aria-busy", String(busy)); }
function eventUrl(event) { return `${location.origin}/x/event/${event.slug}`; }
function when(event) { return new Intl.DateTimeFormat("en-GB", { dateStyle:"medium", timeStyle:"short", timeZone:event.timezone }).format(new Date(event.start_at)); }
function isFuture(event) { return new Date(event.start_at) > new Date(); }

function renderStats(events) {
  const active = events.filter(event => event.is_active).length;
  const upcoming = events.filter(event => event.is_active && isFuture(event)).length;
  $("#stats").innerHTML = [["Total",events.length],["Active",active],["Upcoming",upcoming],["Inactive",events.length-active]].map(([label,value]) => `<div class="admin-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderRows(events) {
  if (!events.length) { list.innerHTML = '<div class="empty-state"><strong>No events yet</strong><span>Create the first invitation or countdown.</span></div>'; return; }
  list.innerHTML = events.map(event => `<button class="record-row" type="button" data-open="${event.id}"><span class="record-main"><strong>${esc(event.title)}</strong><small>/x/event/${esc(event.slug)} · ${esc(when(event))}</small></span><span class="record-meta"><span class="status-pill">${event.is_active ? (isFuture(event) ? "Upcoming" : "Active") : "Inactive"}</span><small>${esc(event.theme === "card-room" ? "Card Room" : "Minimal")}</small></span><span class="record-arrow">›</span></button>`).join("");
}

async function load() {
  list.innerHTML = '<div class="skeleton-line">Loading events…</div>';
  const data = await adminApi("/events"); rows = data.events || []; renderStats(rows); renderRows(rows);
}

function pairInputs(container, count, firstPlaceholder, secondPlaceholder) {
  container.replaceChildren();
  for (let i=0;i<count;i++) {
    const row = document.createElement("div"); row.className = "event-pair";
    row.innerHTML = `<input data-label="${i}" maxlength="${firstPlaceholder.max}" placeholder="${firstPlaceholder.text}"><input data-value="${i}" maxlength="${secondPlaceholder.max}" placeholder="${secondPlaceholder.text}">`;
    container.append(row);
  }
}

function fillPairs(container, values, type) {
  [...container.children].forEach((row,index) => {
    const item = values?.[index] || {};
    row.querySelector("[data-label]").value = item.label || "";
    row.querySelector("[data-value]").value = type === "link" ? (item.url || "") : (item.value || "");
  });
}

function readPairs(container, type) {
  return [...container.children].map(row => {
    const label = row.querySelector("[data-label]").value.trim();
    const value = row.querySelector("[data-value]").value.trim();
    return type === "link" ? { label, url:value } : { label, value };
  }).filter(item => item.label || (type === "link" ? item.url : item.value));
}

function setValue(name, value) { const input = form.elements[name]; if (input) input.value = value || ""; }
function populate(event) {
  current = event;
  $("#dialogTitle").textContent = event ? "Edit event" : "New event";
  form.reset(); form.elements.timezone.value = "Europe/Berlin"; form.elements.is_active.checked = true;
  fillPairs($("#detailRows"), [], "detail"); fillPairs($("#linkRows"), [], "link"); $("#formError").textContent = "";
  if (event) {
    for (const name of ["slug","title","eyebrow","subtitle","description","closing_message","theme","icon","start_local","end_local","timezone","location_label","location_url","primary_cta_label","primary_cta_url"]) setValue(name,event[name]);
    form.elements.is_active.checked = event.is_active;
    fillPairs($("#detailRows"), event.details, "detail"); fillPairs($("#linkRows"), event.links, "link");
  }
  const existing = Boolean(event);
  $("#deleteButton").hidden = !existing; $("#copyButton").hidden = !existing; $("#previewButton").hidden = !existing;
  dialog.showModal();
}

async function openById(id) { populate(await adminApi(`/events/${id}`)); }
function payload() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.is_active = form.elements.is_active.checked;
  data.details = readPairs($("#detailRows"), "detail");
  data.links = readPairs($("#linkRows"), "link");
  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault(); setBusy(true); $("#formError").textContent = "";
  try {
    const saved = await adminApi(current ? `/events/${current.id}` : "/events", { method:current ? "PUT" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload()) });
    current = saved; showToast("Event saved"); dialog.close(); await load();
  } catch (error) { $("#formError").textContent = error.message; }
  finally { setBusy(false); }
});

list.addEventListener("click", event => { const button = event.target.closest("[data-open]"); if (button) openById(button.dataset.open).catch(error => showToast(error.message)); });
$("#newEventButton").addEventListener("click", () => populate(null));
$("#refreshButton").addEventListener("click", () => load().catch(error => showToast(error.message)));
$("#closeDialog").addEventListener("click", () => dialog.close());
$("#cancelButton").addEventListener("click", () => dialog.close());
$("#copyButton").addEventListener("click", async () => { if (!current) return; await navigator.clipboard.writeText(eventUrl(current)); showToast("Link copied"); });
$("#previewButton").addEventListener("click", () => { if (!current) return; if (!current.is_active) return showToast("Activate the event before opening it"); window.open(eventUrl(current), "_blank", "noopener"); });
$("#deleteButton").addEventListener("click", async () => { if (!current || !confirm(`Delete “${current.title}”?\n\nThe public URL will stop working.`)) return; try { await adminApi(`/events/${current.id}`, { method:"DELETE" }); showToast("Event deleted"); dialog.close(); current = null; await load(); } catch (error) { showToast(error.message); } });

pairInputs($("#detailRows"),4,{text:"Label",max:60},{text:"Value",max:180});
pairInputs($("#linkRows"),3,{text:"Label",max:60},{text:"/x/… or https://…",max:500});
if (new URLSearchParams(location.search).get("new") === "1") populate(null);
load().catch(error => { list.innerHTML = `<div class="load-error">${esc(error.message)}</div>`; });
