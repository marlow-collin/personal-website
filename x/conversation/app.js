import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CONTEXTS,
  CONVERSATION_INTENSITIES,
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_TOPICS
} from "./shared/schema.js";
import {
  availableQuestions,
  countAvailableByCategory,
  createSessionState,
  drawNextQuestion,
  hasAvailableWeirdQuestion,
  resetSessionState
} from "./engine.js";

const CATEGORY_LABELS = Object.freeze({
  casual: "Casual",
  funny: "Funny",
  deep: "Deep",
  hypothetical: "Hypothetical",
  would_you_rather: "Would You Rather",
  stories: "Stories",
  debate: "Debate",
  chaotic: "Chaotic"
});

const states = {
  loading: document.querySelector("#loadingState"),
  setup: document.querySelector("#setupState"),
  question: document.querySelector("#questionState"),
  exhausted: document.querySelector("#exhaustedState"),
  empty: document.querySelector("#emptyState"),
  error: document.querySelector("#errorState")
};

const setupForm = document.querySelector("#setupForm");
const setupHeading = document.querySelector("#setupHeading");
const setupMeta = document.querySelector("#setupMeta");
const categoryGrid = document.querySelector("#categoryGrid");
const setupSubmit = document.querySelector("#setupSubmit");
const setupCancel = document.querySelector("#setupCancel");
const groupModeInput = document.querySelector("#groupMode");
const contextInputs = [...document.querySelectorAll('input[name="context"]')];
const questionText = document.querySelector("#questionText");
const sessionMeta = document.querySelector("#sessionMeta");
const nextButton = document.querySelector("#nextButton");
const deeperButton = document.querySelector("#deeperButton");
const differentCategoryButton = document.querySelector("#differentCategoryButton");
const weirdButton = document.querySelector("#weirdButton");
const changeSetupButton = document.querySelector("#changeSetupButton");
const exhaustedChangeButton = document.querySelector("#exhaustedChangeButton");
const resetSessionButton = document.querySelector("#resetSessionButton");
const retryButton = document.querySelector("#retryButton");
const errorCopy = document.querySelector("#errorCopy");

let questions = [];
let session = createSessionState();
let settings = {
  context: "general",
  groupMode: false,
  categories: [],
  allCategories: [...CONVERSATION_CATEGORIES]
};
let setupIsEditing = false;
let weirdOfferAtDraw = randomWeirdOfferDraw(4, 7);

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomWeirdOfferDraw(minOffset = 6, maxOffset = 10) {
  return session.draws + randomInteger(minOffset, maxOffset);
}

function scheduleNextWeirdOffer({ initial = false } = {}) {
  weirdOfferAtDraw = initial
    ? randomInteger(4, 7)
    : randomWeirdOfferDraw(6, 10);
}

function hideWeirdOfferAndReschedule() {
  if (!weirdButton.hidden) scheduleNextWeirdOffer();
  weirdButton.hidden = true;
}

function updateModifierVisibility() {
  differentCategoryButton.hidden = settings.categories.length < 2;

  const weirdEligible = session.draws >= weirdOfferAtDraw
    && hasAvailableWeirdQuestion(questions, settings, session);
  weirdButton.hidden = !weirdEligible;
}


function show(name) {
  for (const [key, element] of Object.entries(states)) {
    element.hidden = key !== name;
  }
}

function isUniqueKnownArray(value, allowed, { min = 0, max = Infinity } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) return false;
  const unique = new Set(value);
  return unique.size === value.length && value.every((item) => allowed.includes(item));
}

function isQuestionShape(question) {
  return Boolean(
    question
    && typeof question.id === "string"
    && question.id.trim()
    && typeof question.text === "string"
    && question.text.trim()
    && isUniqueKnownArray(question.categories, CONVERSATION_CATEGORIES, { min: 1, max: 3 })
    && CONVERSATION_INTENSITIES.includes(question.intensity)
    && isUniqueKnownArray(question.topics, CONVERSATION_TOPICS, { min: 1, max: 3 })
    && isUniqueKnownArray(question.contexts, CONVERSATION_CONTEXTS, { max: 2 })
    && (question.minParticipants === null || question.minParticipants === 3)
  );
}

function categorySelection() {
  return [...categoryGrid.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function draftSettingsFromForm() {
  return {
    context: contextInputs.find((input) => input.checked)?.value || "general",
    groupMode: groupModeInput.checked,
    categories: categorySelection(),
    allCategories: [...CONVERSATION_CATEGORIES]
  };
}

function renderCategories() {
  categoryGrid.innerHTML = CONVERSATION_CATEGORIES.map((category) => `
    <label class="category-option" data-category="${category}">
      <input type="checkbox" value="${category}">
      <span class="category-name">${CATEGORY_LABELS[category] || category}</span>
      <span class="category-count" aria-hidden="true">0</span>
    </label>
  `).join("");
}

function syncFormToSettings() {
  for (const input of contextInputs) input.checked = input.value === settings.context;
  groupModeInput.checked = settings.groupMode;

  for (const input of categoryGrid.querySelectorAll('input[type="checkbox"]')) {
    input.checked = settings.categories.includes(input.value);
  }
}

function updateSetupAvailability() {
  const draft = draftSettingsFromForm();
  const counts = countAvailableByCategory(questions, draft, session);
  let selectedRemaining = 0;

  for (const option of categoryGrid.querySelectorAll(".category-option")) {
    const input = option.querySelector("input");
    const count = counts[input.value] || 0;
    option.querySelector(".category-count").textContent = String(count);
    option.classList.toggle("is-empty", count === 0);
    if (input.checked) selectedRemaining += count;
  }

  const selected = categorySelection();
  setupSubmit.disabled = selected.length === 0 || selectedRemaining === 0;

  if (selected.length === 0) {
    setupMeta.textContent = "Wähle mindestens eine Kategorie.";
  } else if (selectedRemaining === 0) {
    setupMeta.textContent = "Für diese Auswahl sind keine ungesehenen Fragen verfügbar.";
  } else {
    const available = availableQuestions(questions, draft, session).length;
    setupMeta.textContent = `${available} ungesehene Fragen passen aktuell zu deiner Auswahl.`;
  }
}

function openSetup({ editing }) {
  setupIsEditing = editing;
  syncFormToSettings();
  setupHeading.textContent = editing ? "Auswahl anpassen" : "Was passt gerade?";
  setupSubmit.textContent = editing ? "Auswahl übernehmen" : "Start";
  setupCancel.hidden = !editing;
  updateSetupAvailability();
  show("setup");
}

function updateSessionMeta() {
  const remaining = availableQuestions(questions, settings, session).length;
  sessionMeta.textContent = `${session.seenQuestions.size} gesehen · ${remaining} ungesehen`;
}

function showQuestion(question) {
  questionText.textContent = question.text;
  updateSessionMeta();
  updateModifierVisibility();
  show("question");
}

function draw({ deeper = false, differentCategory = false, weird = false } = {}) {
  if (!weird) hideWeirdOfferAndReschedule();

  const result = drawNextQuestion(questions, settings, session, {
    deeper,
    differentCategory,
    weird
  });

  if (result.exhausted || !result.question) {
    show("exhausted");
    return;
  }

  if (weird) scheduleNextWeirdOffer();
  showQuestion(result.question);
}

function applySetup(event) {
  event.preventDefault();
  const draft = draftSettingsFromForm();

  if (!draft.categories.length) return;
  if (!availableQuestions(questions, draft, session).length) {
    updateSetupAvailability();
    return;
  }

  settings = draft;
  draw();
}

function resetCurrentSession() {
  resetSessionState(session);
  weirdButton.hidden = true;
  scheduleNextWeirdOffer({ initial: true });
  draw();
}

async function loadQuestions() {
  show("loading");

  try {
    const response = await fetch("/x/api/conversation/questions", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    if (data.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
      throw new Error("Die Content-Version wird von dieser Seite nicht unterstützt.");
    }
    if (!Array.isArray(data.questions)) {
      throw new Error("Ungültige Serverantwort.");
    }

    const validQuestions = data.questions.filter(isQuestionShape);
    const rejectedCount = data.questions.length - validQuestions.length;
    if (rejectedCount > 0) {
      console.warn(`${rejectedCount} ungültige Conversation-Einträge wurden verworfen.`);
    }

    if (validQuestions.length === 0) {
      show("empty");
      return;
    }

    questions = validQuestions;
    session = createSessionState();
    scheduleNextWeirdOffer({ initial: true });
    settings = {
      context: "general",
      groupMode: false,
      categories: [],
      allCategories: [...CONVERSATION_CATEGORIES]
    };
    openSetup({ editing: false });
  } catch (error) {
    errorCopy.textContent = error?.message || "Bitte versuche es erneut.";
    show("error");
  }
}

renderCategories();

setupForm.addEventListener("submit", applySetup);
setupForm.addEventListener("change", updateSetupAvailability);
setupCancel.addEventListener("click", () => {
  if (session.currentQuestion) showQuestion(session.currentQuestion);
});
nextButton.addEventListener("click", () => draw());
deeperButton.addEventListener("click", () => draw({ deeper: true }));
differentCategoryButton.addEventListener("click", () => draw({ differentCategory: true }));
weirdButton.addEventListener("click", () => draw({ weird: true }));
changeSetupButton.addEventListener("click", () => openSetup({ editing: true }));
exhaustedChangeButton.addEventListener("click", () => openSetup({ editing: true }));
resetSessionButton.addEventListener("click", resetCurrentSession);
retryButton.addEventListener("click", loadQuestions);

loadQuestions();
