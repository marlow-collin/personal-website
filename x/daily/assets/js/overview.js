import { DAILY_CATEGORY_LIST, DAILY_GROUPS } from "/x/daily/shared/categories.js";

const groupsRoot = document.querySelector("[data-groups]");
const shortcutsRoot = document.querySelector("[data-shortcuts]");
const transition = document.querySelector("[data-overview-transition]");
const transitionMark = document.querySelector("[data-transition-mark]");

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
        <a class="daily-category-card daily-category-card--${group.accent}"
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
      <section class="daily-group" id="group-${groupId}" aria-labelledby="group-${groupId}-title">
        <div class="daily-group__heading">
          <p class="daily-group__number">${String(groupOrder.indexOf(groupId) + 1).padStart(2, "0")}</p>
          <h2 id="group-${groupId}-title">${group.label}</h2>
        </div>
        <div class="daily-card-grid">${cards}</div>
      </section>
    `;
  }).join("");
}

function wireTransitions() {
  const links = document.querySelectorAll("[data-daily-category-link]");
  if (!links.length || !transition) return;

  let navigating = false;
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
      transition.dataset.transition = link.dataset.transition || "default";
      transition.dataset.accent = link.dataset.accent || "knowledge";
      if (transitionMark && category) transitionMark.textContent = category.icon.emoji;

      link.classList.add("is-entering");
      document.documentElement.classList.add("daily-is-navigating");
      transition.classList.add("is-active");

      const destination = link.href;
      let didNavigate = false;
      const navigate = () => {
        if (didNavigate) return;
        didNavigate = true;
        window.location.assign(destination);
      };

      transition.addEventListener("animationend", navigate, { once: true });
      window.setTimeout(navigate, 420);
    });
  }
}

renderOverview();
wireTransitions();
