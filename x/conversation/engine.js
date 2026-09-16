const INTENSITY_TARGETS = Object.freeze({
  light: 0.45,
  medium: 0.40,
  deep: 0.15
});

const CATEGORY_BALANCE_STRENGTH = 0.35;
const INTENSITY_DEFICIT_STRENGTH = 0.8;
const INTENSITY_OVERSUPPLY_STRENGTH = 0.35;

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function pickWeighted(items, weightFor, rng = Math.random) {
  if (!items.length) return null;

  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0, Number(weightFor(item)) || 0)
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  if (total <= 0) {
    return items[Math.floor(rng() * items.length)] || null;
  }

  let roll = rng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }

  return weighted[weighted.length - 1]?.item || null;
}

function randomItem(items, rng = Math.random) {
  if (!items.length) return null;
  return items[Math.floor(rng() * items.length)] || null;
}

function contextsAllow(question, context) {
  const contexts = Array.isArray(question.contexts) ? question.contexts : [];
  if (contexts.length === 0) return true;
  if (context === "general") return false;
  return contexts.includes(context);
}

function participantsAllow(question, groupMode) {
  return question.minParticipants !== 3 || groupMode;
}

function categoryMatches(question, selectedCategories) {
  return question.categories.some((category) => selectedCategories.includes(category));
}

export function createSessionState() {
  return {
    seenQuestions: new Set(),
    categoryCounts: Object.create(null),
    intensityCounts: { light: 0, medium: 0, deep: 0 },
    draws: 0,
    currentQuestion: null,
    lastTargetCategory: null
  };
}

export function resetSessionState(state) {
  state.seenQuestions.clear();
  state.categoryCounts = Object.create(null);
  state.intensityCounts = { light: 0, medium: 0, deep: 0 };
  state.draws = 0;
  state.currentQuestion = null;
  state.lastTargetCategory = null;
  return state;
}

export function questionAllowedBySituation(question, settings) {
  return contextsAllow(question, settings.context)
    && participantsAllow(question, settings.groupMode);
}

export function availableQuestions(questions, settings, state) {
  return questions.filter((question) => (
    questionAllowedBySituation(question, settings)
    && categoryMatches(question, settings.categories)
    && !state.seenQuestions.has(question.id)
  ));
}

export function countAvailableByCategory(questions, settings, state) {
  const counts = Object.fromEntries(settings.allCategories.map((category) => [category, 0]));

  for (const question of questions) {
    if (!questionAllowedBySituation(question, settings)) continue;
    if (state.seenQuestions.has(question.id)) continue;

    for (const category of question.categories) {
      if (Object.hasOwn(counts, category)) counts[category] += 1;
    }
  }

  return counts;
}

function reconcileCategoryCounts(state, selectedCategories) {
  const existingSelected = selectedCategories
    .filter((category) => Object.hasOwn(state.categoryCounts, category))
    .map((category) => state.categoryCounts[category]);

  const allExisting = Object.values(state.categoryCounts);
  const baseline = existingSelected.length
    ? mean(existingSelected)
    : mean(allExisting);

  for (const category of selectedCategories) {
    if (!Object.hasOwn(state.categoryCounts, category)) {
      state.categoryCounts[category] = baseline;
    }
  }
}

function chooseTargetCategory(candidates, settings, state, rng) {
  const availableCategories = settings.categories.filter((category) => (
    candidates.some((question) => question.categories.includes(category))
  ));

  if (!availableCategories.length) return null;

  reconcileCategoryCounts(state, settings.categories);
  const maxCount = Math.max(...availableCategories.map((category) => state.categoryCounts[category] || 0));

  return pickWeighted(
    availableCategories,
    (category) => 1 + Math.max(0, maxCount - (state.categoryCounts[category] || 0)) * CATEGORY_BALANCE_STRENGTH,
    rng
  );
}

function intensityWeight(intensity, state) {
  const target = INTENSITY_TARGETS[intensity] || 0;
  const current = state.intensityCounts[intensity] || 0;
  const expected = state.draws * target;
  const delta = expected - current;

  if (delta >= 0) {
    return target * (1 + delta * INTENSITY_DEFICIT_STRENGTH);
  }

  return target / (1 + Math.abs(delta) * INTENSITY_OVERSUPPLY_STRENGTH);
}

function chooseIntensity(candidates, state, rng) {
  const available = [...new Set(candidates.map((question) => question.intensity))];
  return pickWeighted(available, (intensity) => intensityWeight(intensity, state), rng);
}

function deeperIntensities(currentIntensity) {
  if (currentIntensity === "light") return ["medium", "deep"];
  return ["deep"];
}

function selectQuestionFromCandidates(candidates, settings, state, rng, { excludedCategories = [] } = {}) {
  const excluded = new Set(excludedCategories);
  const categoryCandidatesPool = excluded.size
    ? candidates.filter((question) => question.categories.some((category) => settings.categories.includes(category) && !excluded.has(category)))
    : candidates;

  if (!categoryCandidatesPool.length) return null;

  const targetSettings = excluded.size
    ? { ...settings, categories: settings.categories.filter((category) => !excluded.has(category)) }
    : settings;

  const targetCategory = chooseTargetCategory(categoryCandidatesPool, targetSettings, state, rng);
  if (!targetCategory) return null;

  const categoryCandidates = categoryCandidatesPool.filter((question) => question.categories.includes(targetCategory));
  const targetIntensity = chooseIntensity(categoryCandidates, state, rng);
  const finalCandidates = targetIntensity
    ? categoryCandidates.filter((question) => question.intensity === targetIntensity)
    : categoryCandidates;
  const question = randomItem(finalCandidates.length ? finalCandidates : categoryCandidates, rng);

  if (!question) return null;
  return { question, targetCategory };
}

function registerDraw(selection, state) {
  const { question, targetCategory } = selection;
  state.seenQuestions.add(question.id);
  state.categoryCounts[targetCategory] = (state.categoryCounts[targetCategory] || 0) + 1;
  state.intensityCounts[question.intensity] = (state.intensityCounts[question.intensity] || 0) + 1;
  state.draws += 1;
  state.currentQuestion = question;
  state.lastTargetCategory = targetCategory;
  return question;
}

export function hasAvailableWeirdQuestion(questions, settings, state) {
  return questions.some((question) => (
    questionAllowedBySituation(question, settings)
    && question.categories.includes("chaotic")
    && !state.seenQuestions.has(question.id)
  ));
}

export function drawNextQuestion(questions, settings, state, { deeper = false, differentCategory = false, weird = false, rng = Math.random } = {}) {
  const normalCandidates = availableQuestions(questions, settings, state);
  const weirdCandidates = weird
    ? questions.filter((question) => (
        questionAllowedBySituation(question, settings)
        && question.categories.includes("chaotic")
        && !state.seenQuestions.has(question.id)
      ))
    : [];
  const candidates = weird && weirdCandidates.length ? weirdCandidates : normalCandidates;

  if (!candidates.length) {
    return { question: null, exhausted: true, usedDeeperFallback: false, usedDifferentCategoryFallback: false, usedWeirdFallback: false };
  }

  let selection = null;
  let usedDeeperFallback = false;
  let usedDifferentCategoryFallback = false;
  const usedWeirdFallback = Boolean(weird && !weirdCandidates.length);

  if (weird && weirdCandidates.length) {
    const weirdSettings = settings.categories.includes("chaotic")
      ? settings
      : { ...settings, categories: ["chaotic"] };
    selection = selectQuestionFromCandidates(weirdCandidates, weirdSettings, state, rng);
  }

  if (!selection && differentCategory && state.lastTargetCategory && settings.categories.length > 1) {
    selection = selectQuestionFromCandidates(
      normalCandidates,
      settings,
      state,
      rng,
      { excludedCategories: [state.lastTargetCategory] }
    );

    if (!selection) usedDifferentCategoryFallback = true;
  }

  if (!selection && deeper && state.currentQuestion) {
    const preferred = deeperIntensities(state.currentQuestion.intensity);
    const deeperCandidates = candidates.filter((question) => preferred.includes(question.intensity));

    if (deeperCandidates.length) {
      selection = selectQuestionFromCandidates(deeperCandidates, settings, state, rng);
    } else {
      usedDeeperFallback = true;
    }
  }

  if (!selection) {
    selection = selectQuestionFromCandidates(normalCandidates.length ? normalCandidates : candidates, settings, state, rng);
  }

  if (!selection) {
    return { question: null, exhausted: true, usedDeeperFallback, usedDifferentCategoryFallback, usedWeirdFallback };
  }

  return {
    question: registerDraw(selection, state),
    exhausted: false,
    usedDeeperFallback,
    usedDifferentCategoryFallback,
    usedWeirdFallback
  };
}
