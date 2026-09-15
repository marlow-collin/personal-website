import { DAILY_CATEGORIES, DAILY_GROUPS } from "/x/daily/shared/categories.js";

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

function iconMarkup() {
  const fallback = `<span class="daily-icon__emoji">${category.icon.emoji}</span>`;
  if (!category.icon.svg) return fallback;
  return `<img src="${category.icon.svg}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="daily-icon__emoji" hidden>${category.icon.emoji}</span>`;
}

function configurePage() {
  const group = DAILY_GROUPS[category.group];
  document.title = category.label;
  document.documentElement.dataset.dailyGroup = category.group;
  document.documentElement.dataset.dailyTransition = category.transition;
  label.textContent = category.label;
  groupLabel.textContent = group?.label || "Daily Content";
  icon.innerHTML = iconMarkup();
  transitionMark.textContent = category.icon.emoji;
  emptyTitle.textContent = `Noch nichts für „${category.shortLabel}“ im Pool`;
}

function hideEntryTransition() {
  if (transitionHidden || !entryTransition) return;
  transitionHidden = true;
  entryTransition.classList.add("is-leaving");
  const finish = () => { entryTransition.hidden = true; };
  entryTransition.addEventListener("transitionend", finish, { once: true });
  window.setTimeout(finish, 450);
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

function translationBlock(payload) {
  if (!payload?.translation_de) return "";
  return `<div class="daily-subsection"><p class="daily-kicker">Deutsch</p><p>${escapeHtml(payload.translation_de)}</p></div>`;
}

function sourcesMarkup(sources) {
  const usable = Array.isArray(sources) ? sources.filter((source) => source?.title) : [];
  if (!usable.length) return "";
  const items = usable.map((source) => {
    const text = source.publisher ? `${source.title} — ${source.publisher}` : source.title;
    return source.url
      ? `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a></li>`
      : `<li>${escapeHtml(text)}</li>`;
  }).join("");
  return `<details class="daily-sources"><summary>Quellen &amp; Weiterlesen</summary><ol>${items}</ol></details>`;
}

function renderFactLike(payload, modifier = "") {
  return `
    <div class="daily-knowledge ${modifier}">
      <p class="daily-knowledge__statement">${escapeHtml(payload?.fact?.text)}</p>
      <div class="daily-subsection"><h2>Kurz erklärt</h2><p>${escapeHtml(payload?.explanation?.text)}</p></div>
    </div>`;
}

function renderStatement(payload) {
  if (slug === "quote") {
    const work = payload?.work?.title ? ` · ${escapeHtml(payload.work.title)}` : "";
    return `<div class="daily-statement">
      <blockquote>${escapeHtml(payload?.original?.text)}</blockquote>
      ${translationBlock(payload)}
      <p class="daily-attribution">— ${escapeHtml(payload?.attribution?.name)}${work}</p>
      <div class="daily-subsection"><h2>Was daran hängen bleibt</h2><p>${escapeHtml(payload?.meaning)}</p></div>
      ${payload?.about_attribution ? `<div class="daily-subsection"><h2>Zur Person / Figur</h2><p>${escapeHtml(payload.about_attribution)}</p></div>` : ""}
      ${payload?.context ? `<div class="daily-subsection"><h2>Kontext</h2><p>${escapeHtml(payload.context)}</p></div>` : ""}
    </div>`;
  }

  if (slug === "media-quote") {
    const workBits = [payload?.work?.title, payload?.work?.medium, payload?.work?.year].filter(Boolean).map(escapeHtml);
    return `<div class="daily-statement daily-statement--media">
      <blockquote>${escapeHtml(payload?.original?.text)}</blockquote>
      ${translationBlock(payload)}
      <p class="daily-attribution">— ${escapeHtml(payload?.speaker?.name)}${workBits.length ? ` · ${workBits.join(" · ")}` : ""}</p>
      ${payload?.context ? `<div class="daily-subsection"><h2>Kontext</h2><p>${escapeHtml(payload.context)}</p></div>` : ""}
    </div>`;
  }

  if (slug === "worth-remembering") {
    if (payload?.kind === "quotation") {
      return `<div class="daily-statement"><blockquote>${escapeHtml(payload?.original?.text)}</blockquote>${translationBlock(payload)}<p class="daily-attribution">— ${escapeHtml(payload?.attribution?.name)}</p>${payload?.reflection ? `<div class="daily-subsection"><p>${escapeHtml(payload.reflection)}</p></div>` : ""}</div>`;
    }
    return `<div class="daily-statement daily-statement--remember"><blockquote>${escapeHtml(payload?.text)}</blockquote>${payload?.reflection ? `<div class="daily-subsection"><p>${escapeHtml(payload.reflection)}</p></div>` : ""}</div>`;
  }

  const mainText = payload?.text || payload?.original?.text || "";
  return `<div class="daily-statement">
    <blockquote>${escapeHtml(mainText)}</blockquote>
    ${translationBlock(payload)}
    ${payload?.meaning ? `<div class="daily-subsection"><h2>Bedeutung</h2><p>${escapeHtml(payload.meaning)}</p></div>` : ""}
    ${payload?.origin ? `<div class="daily-subsection"><h2>Herkunft</h2><p>${escapeHtml(payload.origin)}</p></div>` : ""}
    ${payload?.attribution?.name ? `<p class="daily-attribution">— ${escapeHtml(payload.attribution.name)}</p>` : ""}
  </div>`;
}

function renderKnowledge(payload) {
  if (slug === "today-i-learned") {
    return `<div class="daily-til">
      <h2>${escapeHtml(payload?.title)}</h2>
      ${payload?.lead ? `<p class="daily-til__lead">${escapeHtml(payload.lead)}</p>` : ""}
      <div class="daily-subsection"><p>${escapeHtml(payload?.explanation?.text)}</p></div>
      ${payload?.takeaway ? `<div class="daily-takeaway"><strong>Mitnehmen:</strong> ${escapeHtml(payload.takeaway)}</div>` : ""}
    </div>`;
  }
  const modifier = slug === "fun-fact" ? "daily-knowledge--fun" : slug === "feel-good-fact" ? "daily-knowledge--feel-good" : "";
  return renderFactLike(payload, modifier);
}

function renderLanguage(payload) {
  if (slug === "word") {
    const ex = payload?.example || {};
    return `<div class="daily-language">
      <p class="daily-language__word">${escapeHtml(payload?.word)}</p>
      <p class="daily-language__meta">${escapeHtml(payload?.language)}${payload?.pronunciation ? ` · ${escapeHtml(payload.pronunciation)}` : ""}</p>
      <div class="daily-subsection"><h2>Bedeutung</h2><p>${escapeHtml(payload?.meaning_de)}</p></div>
      ${payload?.etymology ? `<div class="daily-subsection"><h2>Etymologie</h2><p>${escapeHtml(payload.etymology)}</p></div>` : ""}
      ${ex.text ? `<div class="daily-example"><p>${escapeHtml(ex.text)}</p>${ex.translation_de ? `<p>${escapeHtml(ex.translation_de)}</p>` : ""}</div>` : ""}
    </div>`;
  }

  return `<div class="daily-language daily-language--idiom">
    <p class="daily-language__word">${escapeHtml(payload?.original?.text)}</p>
    ${payload?.translation_de ? `<div class="daily-subsection"><h2>Wörtlich / Deutsch</h2><p>${escapeHtml(payload.translation_de)}</p></div>` : ""}
    <div class="daily-subsection"><h2>Gemeint ist</h2><p>${escapeHtml(payload?.meaning)}</p></div>
    ${payload?.usage_example?.text ? `<div class="daily-example"><p>${escapeHtml(payload.usage_example.text)}</p>${payload.usage_example.translation_de ? `<p>${escapeHtml(payload.usage_example.translation_de)}</p>` : ""}</div>` : ""}
    ${payload?.origin ? `<div class="daily-subsection"><h2>Herkunft</h2><p>${escapeHtml(payload.origin)}</p></div>` : ""}
  </div>`;
}

function renderComedy(payload) {
  if (slug === "joke") {
    if (payload?.format === "setup_punchline") {
      return `<div class="daily-comedy"><p class="daily-comedy__main">${escapeHtml(payload.setup)}</p><button class="daily-punchline-button" type="button" data-punchline-button>Pointe anzeigen</button><p class="daily-punchline" data-punchline hidden>${escapeHtml(payload.punchline)}</p></div>`;
    }
    return `<div class="daily-comedy"><p class="daily-comedy__main">${escapeHtml(payload?.text)}</p></div>`;
  }
  if (slug === "bad-advice") {
    return `<div class="daily-comedy daily-comedy--warning">${payload?.setup ? `<p class="daily-kicker">${escapeHtml(payload.setup)}</p>` : ""}<p class="daily-comedy__main">${escapeHtml(payload?.advice)}</p><p class="daily-disclaimer">Bitte wirklich nicht machen.</p></div>`;
  }
  return `<div class="daily-comedy">${payload?.scenario ? `<p class="daily-kicker">${escapeHtml(payload.scenario)}</p>` : ""}<p class="daily-comedy__main">${escapeHtml(payload?.excuse)}</p></div>`;
}

function renderSideQuest(payload) {
  const min = Number(payload?.duration?.min_minutes || 0);
  const max = Number(payload?.duration?.max_minutes || min);
  const duration = min === max ? `~${min} Min.` : `~${min}–${max} Min.`;
  return `<div class="daily-quest"><p class="daily-quest__time">${escapeHtml(duration)}</p><h2>${escapeHtml(payload?.title)}</h2><p class="daily-quest__task">${escapeHtml(payload?.task)}</p><button type="button" data-quest-button>Quest annehmen</button><p class="daily-quest__accepted" data-quest-accepted hidden>Quest angenommen. Viel Spaß.</p></div>`;
}

function renderCheer(payload) {
  return `<div class="daily-cheer daily-cheer--${escapeHtml(payload?.kind || "thought")}">${payload?.title ? `<p class="daily-kicker">${escapeHtml(payload.title)}</p>` : ""}<p class="daily-cheer__main">${escapeHtml(payload?.text)}</p></div>`;
}

function renderContent(data) {
  const payload = data.content?.payload || {};
  let body = "";
  if (category.renderer === "statement") body = renderStatement(payload);
  if (category.renderer === "knowledge") body = renderKnowledge(payload);
  if (category.renderer === "language") body = renderLanguage(payload);
  if (category.renderer === "comedy") body = renderComedy(payload);
  if (category.renderer === "side-quest") body = renderSideQuest(payload);
  if (category.renderer === "cheer") body = renderCheer(payload);
  content.innerHTML = `${body}${sourcesMarkup(data.content?.sources)}`;

  const punchlineButton = content.querySelector("[data-punchline-button]");
  const punchline = content.querySelector("[data-punchline]");
  punchlineButton?.addEventListener("click", () => {
    punchline.hidden = false;
    punchlineButton.hidden = true;
  });

  const questButton = content.querySelector("[data-quest-button]");
  const questAccepted = content.querySelector("[data-quest-accepted]");
  questButton?.addEventListener("click", () => {
    questButton.disabled = true;
    questButton.textContent = "Angenommen";
    questAccepted.hidden = false;
  });
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
