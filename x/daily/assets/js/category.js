import { DAILY_CATEGORIES, DAILY_GROUPS } from "/x/daily/shared/categories.js";
import { renderDailyContentMarkup, wireDailyContentInteractions } from "/x/daily/shared/render-content.js";

const root = document.querySelector("[data-daily-root]");
const slug = document.body.dataset.dailyCategory;
const category = DAILY_CATEGORIES[slug];

if (!root || !category) {
  document.body.textContent = "Unbekannte Daily-Kategorie.";
  throw new Error("Unknown Daily category");
}

const reveal = root.querySelector(".daily-reveal");
const entryTransition = root.querySelector("[data-entry-transition]");
const content = root.querySelector("[data-content]");
const empty = root.querySelector("[data-empty]");
const error = root.querySelector("[data-error]");
const retry = root.querySelector("[data-retry]");
const date = root.querySelector("[data-date]");
const label = root.querySelector("[data-category-label]");
const groupLabel = root.querySelector("[data-group-label]");
const icon = root.querySelector("[data-category-icon]");
const transitionMark = root.querySelector("[data-transition-mark]");
const emptyTitle = root.querySelector("[data-empty-title]");
let transitionHidden = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function emojiMarkup() {
  return `<span class="daily-icon__emoji" aria-hidden="true">${category.icon.emoji}</span>`;
}

function configurePage() {
  const group = DAILY_GROUPS[category.group];
  document.title = category.label;
  document.documentElement.dataset.dailyGroup = category.group;
  document.documentElement.dataset.dailyTransition = category.transition;
  label.textContent = category.label;
  groupLabel.textContent = group?.label || "Daily Content";
  icon.innerHTML = emojiMarkup();
  transitionMark.textContent = category.icon.emoji;
  emptyTitle.textContent = `Noch nichts für „${category.shortLabel}“ im Pool`;
}

function hideEntryTransition() {
  if (transitionHidden || !entryTransition) return;
  transitionHidden = true;
  entryTransition.classList.add("is-leaving");
  const finish = () => { entryTransition.hidden = true; };
  entryTransition.addEventListener("transitionend", finish, { once: true });
  window.setTimeout(finish, 500);
}

function setState(state) {
  content.hidden = state !== "ready";
  empty.hidden = state !== "empty";
  error.hidden = state !== "error";
  reveal.dataset.state = state;
  if (state !== "transition") hideEntryTransition();
}

function resetTransition() {
  transitionHidden = false;
  content.hidden = true;
  empty.hidden = true;
  error.hidden = true;
  entryTransition.hidden = false;
  entryTransition.classList.remove("is-leaving");
  reveal.dataset.state = "transition";
}

function formatDate(isoDate) {
  const parsed = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin"
  }).format(parsed);
}

function renderContent(data) {
  content.innerHTML = renderDailyContentMarkup(slug, data.content?.payload || {}, data.content?.sources || []);
  wireDailyContentInteractions(content);
}

async function loadDaily({ retrying = false } = {}) {
  if (retrying) resetTransition();
  try {
    const response = await fetch(`/x/api/daily/${encodeURIComponent(slug)}/activate`, {
      method: "POST",
      headers: { "Accept": "application/json" },
      credentials: "same-origin",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    date.textContent = formatDate(data.date);
    if (data.state === "empty") { setState("empty"); return; }
    if (data.state !== "ready") throw new Error("Unexpected response state");
    renderContent(data);
    setState("ready");
  } catch (loadError) {
    console.error(loadError);
    setState("error");
  }
}

configurePage();
retry.addEventListener("click", () => loadDaily({ retrying: true }));
loadDaily();
