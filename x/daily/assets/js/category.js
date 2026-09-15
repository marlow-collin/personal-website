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

function translationBlock(payload, labelText = "Deutsch") {
  if (!payload?.translation_de) return "";
  return `<div class="daily-subsection daily-translation"><p class="daily-kicker">${labelText}</p><p>${escapeHtml(payload.translation_de)}</p></div>`;
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

function renderQuote(payload) {
  const work = payload?.work?.title ? `<span>${escapeHtml(payload.work.title)}</span>` : "";
  return `<div class="daily-scene daily-scene--quote">
    <div class="quote-sheet">
      <span class="quote-sheet__mark" aria-hidden="true">“</span>
      <blockquote>${escapeHtml(payload?.original?.text)}</blockquote>
      ${translationBlock(payload)}
      <footer class="quote-sheet__credit">— ${escapeHtml(payload?.attribution?.name)} ${work}</footer>
    </div>
    <aside class="quote-notes">
      <div><p class="daily-kicker">Was daran hängen bleibt</p><p>${escapeHtml(payload?.meaning)}</p></div>
      ${payload?.about_attribution ? `<div><p class="daily-kicker">Zur Person / Figur</p><p>${escapeHtml(payload.about_attribution)}</p></div>` : ""}
      ${payload?.context ? `<div><p class="daily-kicker">Kontext</p><p>${escapeHtml(payload.context)}</p></div>` : ""}
    </aside>
  </div>`;
}

function renderSaying(payload) {
  return `<div class="daily-scene daily-scene--saying">
    <div class="saying-poster">
      <span class="saying-poster__rule"></span>
      <blockquote>${escapeHtml(payload?.text)}</blockquote>
      ${payload?.tone ? `<span class="saying-poster__tone">${escapeHtml(payload.tone)}</span>` : ""}
      <span class="saying-poster__rule"></span>
    </div>
    ${translationBlock(payload)}
    ${payload?.meaning ? `<div class="saying-meaning"><p class="daily-kicker">Bedeutung</p><p>${escapeHtml(payload.meaning)}</p></div>` : ""}
    ${payload?.attribution?.name ? `<p class="daily-attribution">— ${escapeHtml(payload.attribution.name)}</p>` : ""}
  </div>`;
}

function renderWisdom(payload) {
  return `<div class="daily-scene daily-scene--wisdom">
    <div class="wisdom-seal" aria-hidden="true">🎓</div>
    <div class="wisdom-thesis">
      <p class="wisdom-thesis__label">Gedanke des Tages</p>
      <blockquote>${escapeHtml(payload?.text)}</blockquote>
      ${translationBlock(payload)}
    </div>
    <div class="wisdom-notes">
      <div><span>Einordnung</span><p>${escapeHtml(payload?.meaning)}</p></div>
      ${payload?.origin ? `<div><span>Herkunft</span><p>${escapeHtml(payload.origin)}</p></div>` : ""}
    </div>
  </div>`;
}

function renderWord(payload) {
  const ex = payload?.example || {};
  return `<div class="daily-scene daily-scene--word">
    <div class="word-entry">
      <div class="word-entry__topline"><span>Wort</span><span>${escapeHtml(payload?.language)}</span></div>
      <h2>${escapeHtml(payload?.word)}</h2>
      ${payload?.pronunciation ? `<p class="word-entry__pronunciation">${escapeHtml(payload.pronunciation)}</p>` : ""}
      <div class="word-definition"><span class="word-definition__number">01</span><p>${escapeHtml(payload?.meaning_de)}</p></div>
    </div>
    ${payload?.etymology ? `<div class="word-etymology"><p class="daily-kicker">Etymologie</p><p>${escapeHtml(payload.etymology)}</p></div>` : ""}
    ${ex.text ? `<div class="word-example"><span>Beispiel</span><p>${escapeHtml(ex.text)}</p>${ex.translation_de ? `<small>${escapeHtml(ex.translation_de)}</small>` : ""}</div>` : ""}
  </div>`;
}

function renderIdiom(payload) {
  return `<div class="daily-scene daily-scene--idiom">
    <div class="idiom-bubble idiom-bubble--original"><span>Gesagt</span><p>${escapeHtml(payload?.original?.text)}</p></div>
    ${payload?.translation_de ? `<div class="idiom-connector"><span>↓</span><small>wörtlich</small></div><div class="idiom-bubble idiom-bubble--translation"><p>${escapeHtml(payload.translation_de)}</p></div>` : ""}
    <div class="idiom-meaning"><span>Gemeint ist</span><p>${escapeHtml(payload?.meaning)}</p></div>
    ${payload?.usage_example?.text ? `<div class="idiom-example"><span>Im Satz</span><p>${escapeHtml(payload.usage_example.text)}</p>${payload.usage_example.translation_de ? `<small>${escapeHtml(payload.usage_example.translation_de)}</small>` : ""}</div>` : ""}
    ${payload?.origin ? `<div class="idiom-origin"><span>Herkunft</span><p>${escapeHtml(payload.origin)}</p></div>` : ""}
  </div>`;
}

function renderFact(payload) {
  return `<div class="daily-scene daily-scene--fact">
    <div class="fact-index"><span>FACT</span><strong>01</strong></div>
    <div class="fact-claim"><p>${escapeHtml(payload?.fact?.text)}</p></div>
    <div class="fact-explainer"><span>Kurz erklärt</span><p>${escapeHtml(payload?.explanation?.text)}</p></div>
  </div>`;
}

function renderFunFact(payload) {
  return `<div class="daily-scene daily-scene--fun-fact">
    <div class="fun-burst" aria-hidden="true">💡</div>
    <div class="fun-card"><span>FUN FACT</span><p>${escapeHtml(payload?.fact?.text)}</p></div>
    <div class="fun-explainer"><span>Warum das so ist</span><p>${escapeHtml(payload?.explanation?.text)}</p></div>
  </div>`;
}

function renderTil(payload) {
  return `<div class="daily-scene daily-scene--til">
    <div class="til-sheet">
      <div class="til-sheet__holes" aria-hidden="true"><i></i><i></i><i></i></div>
      <p class="til-sheet__tag">TIL</p>
      <h2>${escapeHtml(payload?.title)}</h2>
      ${payload?.lead ? `<p class="til-sheet__lead">${escapeHtml(payload.lead)}</p>` : ""}
      <div class="til-sheet__body">${escapeHtml(payload?.explanation?.text)}</div>
      ${payload?.takeaway ? `<div class="til-sheet__takeaway"><strong>Mitnehmen</strong><span>${escapeHtml(payload.takeaway)}</span></div>` : ""}
    </div>
  </div>`;
}

function renderFeelGoodFact(payload) {
  return `<div class="daily-scene daily-scene--feel-good">
    <div class="feel-good__mascot" aria-hidden="true">🦦</div>
    <div class="feel-good__claim"><p>${escapeHtml(payload?.fact?.text)}</p></div>
    <div class="feel-good__explain"><span>Und das Schöne daran</span><p>${escapeHtml(payload?.explanation?.text)}</p></div>
  </div>`;
}

function renderJoke(payload) {
  if (payload?.format === "setup_punchline") {
    return `<div class="daily-scene daily-scene--joke">
      <div class="joke-stage">
        <span class="joke-stage__spot" aria-hidden="true"></span>
        <p class="joke-stage__setup">${escapeHtml(payload.setup)}</p>
        <button class="daily-punchline-button" type="button" data-punchline-button>Pointe aufdecken</button>
        <p class="daily-punchline" data-punchline hidden>${escapeHtml(payload.punchline)}</p>
      </div>
    </div>`;
  }
  return `<div class="daily-scene daily-scene--joke"><div class="joke-stage"><span class="joke-stage__spot" aria-hidden="true"></span><p class="joke-stage__one-liner">${escapeHtml(payload?.text)}</p></div></div>`;
}

function renderBadAdvice(payload) {
  return `<div class="daily-scene daily-scene--bad-advice">
    <div class="bad-advice__tape">⚠ NICHT NACHMACHEN ⚠ NICHT NACHMACHEN ⚠</div>
    <div class="bad-advice__card">${payload?.setup ? `<span>${escapeHtml(payload.setup)}</span>` : ""}<p>${escapeHtml(payload?.advice)}</p></div>
    <div class="bad-advice__stamp">Bitte wirklich nicht machen.</div>
  </div>`;
}

function renderExcuse(payload) {
  return `<div class="daily-scene daily-scene--excuse">
    <div class="excuse-note">
      <span class="excuse-note__pin" aria-hidden="true">😅</span>
      ${payload?.scenario ? `<small>${escapeHtml(payload.scenario)}</small>` : ""}
      <p>${escapeHtml(payload?.excuse)}</p>
      <em>sorry.</em>
    </div>
  </div>`;
}

function renderSideQuest(payload) {
  const min = Number(payload?.duration?.min_minutes || 0);
  const max = Number(payload?.duration?.max_minutes || min);
  const duration = min === max ? `~${min} Min.` : `~${min}–${max} Min.`;
  return `<div class="daily-scene daily-scene--quest">
    <div class="quest-map">
      <span class="quest-map__route" aria-hidden="true"></span>
      <span class="quest-map__marker" aria-hidden="true">✦</span>
      <p class="quest-map__time">${escapeHtml(duration)}</p>
      <h2>${escapeHtml(payload?.title)}</h2>
      <p class="quest-map__task">${escapeHtml(payload?.task)}</p>
      <button type="button" data-quest-button>Quest annehmen</button>
      <p class="daily-quest__accepted" data-quest-accepted hidden>Quest angenommen. Viel Spaß.</p>
    </div>
  </div>`;
}

function renderCheer(payload) {
  return `<div class="daily-scene daily-scene--cheer daily-scene--cheer-${escapeHtml(payload?.kind || "thought")}">
    <div class="cheer-sun" aria-hidden="true">☀️</div>
    <div class="cheer-card">${payload?.title ? `<span>${escapeHtml(payload.title)}</span>` : ""}<p>${escapeHtml(payload?.text)}</p></div>
  </div>`;
}

function renderWorthRemembering(payload) {
  const quotation = payload?.kind === "quotation";
  const main = quotation ? payload?.original?.text : payload?.text;
  return `<div class="daily-scene daily-scene--remember">
    <div class="remember-page">
      <span class="remember-page__bookmark" aria-hidden="true">🫶</span>
      <p>${escapeHtml(main)}</p>
      ${quotation ? `${translationBlock(payload)}<small>— ${escapeHtml(payload?.attribution?.name)}</small>` : ""}
      ${payload?.reflection ? `<div class="remember-page__reflection">${escapeHtml(payload.reflection)}</div>` : ""}
    </div>
  </div>`;
}

function renderMediaQuote(payload) {
  const workBits = [payload?.work?.title, payload?.work?.medium, payload?.work?.year].filter(Boolean).map(escapeHtml);
  return `<div class="daily-scene daily-scene--media">
    <div class="media-frame">
      <div class="media-frame__bar"></div>
      <span class="media-frame__badge">${escapeHtml(payload?.work?.medium || "media")}</span>
      <blockquote>${escapeHtml(payload?.original?.text)}</blockquote>
      ${translationBlock(payload)}
      <p class="media-frame__credit">— ${escapeHtml(payload?.speaker?.name)}${workBits.length ? ` · ${workBits.join(" · ")}` : ""}</p>
      ${payload?.context ? `<div class="media-frame__context"><span>Kontext</span><p>${escapeHtml(payload.context)}</p></div>` : ""}
      <div class="media-frame__bar"></div>
    </div>
  </div>`;
}

function renderContent(data) {
  const payload = data.content?.payload || {};
  const renderers = {
    quote: renderQuote,
    saying: renderSaying,
    wisdom: renderWisdom,
    word: renderWord,
    idiom: renderIdiom,
    fact: renderFact,
    "fun-fact": renderFunFact,
    "today-i-learned": renderTil,
    "feel-good-fact": renderFeelGoodFact,
    joke: renderJoke,
    "bad-advice": renderBadAdvice,
    excuse: renderExcuse,
    "side-quest": renderSideQuest,
    "cheer-me-up": renderCheer,
    "worth-remembering": renderWorthRemembering,
    "media-quote": renderMediaQuote
  };

  const renderer = renderers[slug];
  const body = renderer ? renderer(payload) : `<p>${escapeHtml(JSON.stringify(payload))}</p>`;
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
