import { DAILY_CATEGORY_LIST, DAILY_GROUPS } from "/x/daily/shared/categories.js";

const groupsRoot = document.querySelector("[data-groups]");
const shortcutsRoot = document.querySelector("[data-shortcuts]");
const transition = document.querySelector("[data-overview-transition]");
const transitionMark = document.querySelector("[data-transition-mark]");

let navigating = false;
let navigationTimer = 0;

const TRANSITION_DURATIONS = Object.freeze({
  quote: 260,
  saying: 240,
  wisdom: 300,
  word: 250,
  idiom: 280,
  fact: 260,
  "fun-fact": 300,
  "today-i-learned": 270,
  "feel-good-fact": 320,
  joke: 300,
  "bad-advice": 260,
  excuse: 240,
  "side-quest": 300,
  "cheer-me-up": 320,
  "worth-remembering": 300,
  "media-quote": 280
});

function iconMarkup(category) {
  const fallback = `<span class="daily-icon__emoji" aria-hidden="true">${category.icon.emoji}</span>`;
  if (!category.icon.svg) return fallback;
  return `<img src="${category.icon.svg}" alt="" aria-hidden="true" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="daily-icon__emoji" aria-hidden="true" hidden>${category.icon.emoji}</span>`;
}

function renderOverview() {
  if (!groupsRoot || !shortcutsRoot) return;

  const groupOrder = ["thoughts", "knowledge", "playful", "mood"];
  shortcutsRoot.innerHTML = groupOrder
    .map((id) => `<a href="#group-${id}">${DAILY_GROUPS[id].label}</a>`)
    .join("");

  groupsRoot.innerHTML = groupOrder.map((groupId) => {
    const group = DAILY_GROUPS[groupId];
    const cards = DAILY_CATEGORY_LIST
      .filter((category) => category.group === groupId)
      .map((category) => `
        <a class="daily-category-card daily-category-card--${group.accent} daily-category-card--${category.slug}"
           href="/x/daily/${category.slug}/"
           data-daily-category-link="${category.slug}"
           data-transition="${category.transition}"
           data-accent="${group.accent}">
          <span class="daily-category-card__icon" aria-hidden="true">${iconMarkup(category)}</span>
          <span class="daily-category-card__copy">
            <strong>${category.label}</strong>
            <span>${category.description}</span>
          </span>
          <span class="daily-category-card__arrow" aria-hidden="true">→</span>
        </a>
      `).join("");

    return `
      <section class="daily-group daily-group--${groupId}" id="group-${groupId}" aria-labelledby="group-${groupId}-title">
        <div class="daily-group__heading">
          <p class="daily-group__number">${String(groupOrder.indexOf(groupId) + 1).padStart(2, "0")}</p>
          <h2 id="group-${groupId}-title">${group.label}</h2>
        </div>
        <div class="daily-card-grid">${cards}</div>
      </section>
    `;
  }).join("");
}

function resetNavigationState() {
  navigating = false;
  if (navigationTimer) {
    window.clearTimeout(navigationTimer);
    navigationTimer = 0;
  }

  document.documentElement.classList.remove("daily-is-navigating");
  transition?.classList.remove("is-active");
  if (transition) {
    delete transition.dataset.transition;
    delete transition.dataset.accent;
  }

  document.querySelectorAll(".daily-category-card.is-entering")
    .forEach((card) => card.classList.remove("is-entering"));
}

function wireTransitions() {
  const links = document.querySelectorAll("[data-daily-category-link]");
  if (!links.length || !transition) return;

  const shouldHandleClick = (event, link) => {
    if (event.defaultPrevented || navigating || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    return true;
  };

  for (const link of links) {
    link.addEventListener("click", (event) => {
      if (!shouldHandleClick(event, link)) return;
      event.preventDefault();
      navigating = true;

      const category = DAILY_CATEGORY_LIST.find((item) => item.slug === link.dataset.dailyCategoryLink);
      const transitionName = link.dataset.transition || "default";
      transition.dataset.transition = transitionName;
      transition.dataset.accent = link.dataset.accent || "knowledge";
      if (transitionMark && category) transitionMark.textContent = category.icon.emoji;

      link.classList.add("is-entering");
      document.documentElement.classList.add("daily-is-navigating");
      transition.classList.add("is-active");

      const destination = link.href;
      const duration = TRANSITION_DURATIONS[transitionName] || 260;
      navigationTimer = window.setTimeout(() => {
        navigationTimer = 0;
        window.location.assign(destination);
      }, duration);
    });
  }
}

// Safari/Chrome can restore this page from the back-forward cache with the
// exact DOM state it had at navigation time. Always remove the outgoing
// transition state when the page becomes visible again.
window.addEventListener("pageshow", resetNavigationState);

renderOverview();
wireTransitions();
resetNavigationState();
