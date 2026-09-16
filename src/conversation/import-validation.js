import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CONTEXTS,
  CONVERSATION_INTENSITIES,
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_TOPICS
} from "./config.js";

const TOP_LEVEL_KEYS = new Set(["schemaVersion", "questions"]);
const QUESTION_KEYS = new Set([
  "text",
  "categories",
  "intensity",
  "topics",
  "contexts",
  "minParticipants"
]);

const CATEGORY_VALUES = new Set(CONVERSATION_CATEGORIES);
const INTENSITY_VALUES = new Set(CONVERSATION_INTENSITIES);
const TOPIC_VALUES = new Set(CONVERSATION_TOPICS);
const CONTEXT_VALUES = new Set(CONVERSATION_CONTEXTS);

export const MAX_IMPORT_QUESTIONS = 150;
const MAX_TEXT_LENGTH = 600;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(code, path, message) {
  return { code, path, message };
}

function rejectUnknownKeys(value, allowedKeys, path, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(issue("unknown_field", path ? `${path}.${key}` : key, `Unbekanntes Feld: ${key}`));
    }
  }
}

function validateStringArray(value, path, errors, allowedValues, { min = 0, max = Infinity } = {}) {
  if (!Array.isArray(value)) {
    errors.push(issue("array_required", path, "Feld muss ein Array sein."));
    return [];
  }

  if (value.length < min) {
    errors.push(issue("array_too_short", path, `Mindestens ${min} Eintrag${min === 1 ? "" : "e"} erforderlich.`));
  }
  if (value.length > max) {
    errors.push(issue("array_too_long", path, `Maximal ${max} Einträge erlaubt.`));
  }

  const seen = new Set();
  const valid = [];
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (typeof entry !== "string" || !entry.trim()) {
      errors.push(issue("string_required", itemPath, "Eintrag muss ein nicht-leerer String sein."));
      return;
    }
    if (!allowedValues.has(entry)) {
      errors.push(issue("unknown_value", itemPath, `Nicht erlaubter Wert: ${entry}`));
      return;
    }
    if (seen.has(entry)) {
      errors.push(issue("duplicate_value", itemPath, `Wert ist innerhalb des Arrays doppelt vorhanden: ${entry}`));
      return;
    }
    seen.add(entry);
    valid.push(entry);
  });

  return valid;
}

export function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replace(/[“”„«»]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/\s+/g, " ");
}

function normalizeDisplayText(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

function tokenSet(value) {
  return new Set(
    normalizeQuestionText(value)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3)
  );
}

export function textSimilarityScore(a, b) {
  const normalizedA = normalizeQuestionText(a);
  const normalizedB = normalizeQuestionText(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
  const longer = shorter === normalizedA ? normalizedB : normalizedA;
  if (shorter.length >= 28 && longer.includes(shorter)) return 0.92;

  const setA = tokenSet(normalizedA);
  const setB = tokenSet(normalizedB);
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

export function validateImportDocument(document) {
  const errors = [];
  const warnings = [];

  if (!isObject(document)) {
    return {
      ok: false,
      errors: [issue("document_required", "", "Import muss ein JSON-Objekt sein.")],
      warnings,
      questions: []
    };
  }

  rejectUnknownKeys(document, TOP_LEVEL_KEYS, "", errors);

  if (document.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
    errors.push(issue(
      "schema_version",
      "schemaVersion",
      `schemaVersion muss ${CONVERSATION_SCHEMA_VERSION} sein.`
    ));
  }

  if (!Array.isArray(document.questions)) {
    errors.push(issue("questions_required", "questions", "questions muss ein Array sein."));
    return { ok: false, errors, warnings, questions: [] };
  }
  if (document.questions.length === 0) {
    errors.push(issue("questions_empty", "questions", "Import benötigt mindestens eine Frage."));
  }
  if (document.questions.length > MAX_IMPORT_QUESTIONS) {
    errors.push(issue(
      "questions_limit",
      "questions",
      `Maximal ${MAX_IMPORT_QUESTIONS} Fragen pro Importdatei.`
    ));
  }

  const validatedQuestions = [];

  document.questions.forEach((question, index) => {
    const path = `questions[${index}]`;
    if (!isObject(question)) {
      errors.push(issue("question_object", path, "Frage muss ein Objekt sein."));
      return;
    }

    rejectUnknownKeys(question, QUESTION_KEYS, path, errors);

    const textIsString = typeof question.text === "string";
    const text = textIsString ? normalizeDisplayText(question.text) : "";
    if (!textIsString || !text) {
      errors.push(issue("text_required", `${path}.text`, "text muss ein nicht-leerer String sein."));
    } else if (/^<.*>$/.test(text)) {
      errors.push(issue("template_placeholder", `${path}.text`, "Template-Platzhalter muss vor dem Import durch echten Content ersetzt werden."));
    } else if (text.length > MAX_TEXT_LENGTH) {
      errors.push(issue("text_too_long", `${path}.text`, `text darf maximal ${MAX_TEXT_LENGTH} Zeichen lang sein.`));
    }

    const categories = validateStringArray(
      question.categories,
      `${path}.categories`,
      errors,
      CATEGORY_VALUES,
      { min: 1, max: 3 }
    );
    if (categories.length === 3) {
      warnings.push(issue(
        "many_categories",
        `${path}.categories`,
        "Drei Kategorien sind erlaubt, sollten aber eine begründete Ausnahme bleiben."
      ));
    }

    if (!INTENSITY_VALUES.has(question.intensity)) {
      errors.push(issue(
        "intensity",
        `${path}.intensity`,
        `intensity muss einer dieser Werte sein: ${CONVERSATION_INTENSITIES.join(", ")}.`
      ));
    }

    const topics = validateStringArray(
      question.topics,
      `${path}.topics`,
      errors,
      TOPIC_VALUES,
      { min: 1, max: 3 }
    );

    const contexts = validateStringArray(
      question.contexts,
      `${path}.contexts`,
      errors,
      CONTEXT_VALUES,
      { min: 0, max: CONVERSATION_CONTEXTS.length }
    );

    if (question.minParticipants !== null && question.minParticipants !== 3) {
      errors.push(issue(
        "min_participants",
        `${path}.minParticipants`,
        "minParticipants muss null oder 3 sein."
      ));
    }

    if (text && categories.length && topics.length && INTENSITY_VALUES.has(question.intensity)) {
      validatedQuestions.push({
        index,
        question: {
          text,
          categories,
          intensity: question.intensity,
          topics,
          contexts,
          minParticipants: question.minParticipants ?? null
        }
      });
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    questions: validatedQuestions
  };
}
