import {
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_STATUSES
} from "./config.js";
import { questionContentHash } from "./content-hash.js";
import { textSimilarityScore, validateImportDocument } from "./import-validation.js";
import { getAllQuestions, getQuestionById } from "./repository.js";

const STATUS_VALUES = new Set(CONVERSATION_STATUSES);
const EDIT_KEYS = new Set([
  "text",
  "categories",
  "intensity",
  "topics",
  "contexts",
  "minParticipants",
  "status"
]);

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function issue(code, path, message) {
  return { code, path, message };
}

function normalizePayload(payload, { defaultStatus = "active" } = {}) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: [issue("question_required", "question", "Frage muss ein Objekt sein.")], warnings: [] };
  }

  for (const key of Object.keys(payload)) {
    if (!EDIT_KEYS.has(key)) errors.push(issue("unknown_field", key, `Unbekanntes Feld: ${key}`));
  }

  const status = payload.status ?? defaultStatus;
  if (!STATUS_VALUES.has(status)) {
    errors.push(issue("status", "status", `status muss einer dieser Werte sein: ${CONVERSATION_STATUSES.join(", ")}.`));
  }

  const content = {
    text: payload.text,
    categories: payload.categories,
    intensity: payload.intensity,
    topics: payload.topics,
    contexts: payload.contexts,
    minParticipants: payload.minParticipants ?? null
  };

  const validation = validateImportDocument({
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    questions: [content]
  });

  const remap = (item) => ({
    ...item,
    path: String(item.path || "").replace(/^questions\[0\]\.?/, "") || "question"
  });

  const validationErrors = validation.errors.map(remap);
  const validationWarnings = validation.warnings.map(remap);
  const question = validation.questions[0]?.question || null;

  return {
    ok: errors.length === 0 && validationErrors.length === 0 && Boolean(question),
    errors: [...errors, ...validationErrors],
    warnings: validationWarnings,
    question: question ? { ...question, status } : null
  };
}

async function duplicateForHash(db, contentHash, excludeId = "") {
  const result = excludeId
    ? await db.prepare(`
        SELECT id, text, status
        FROM conversation_questions
        WHERE content_hash = ? AND id <> ?
        LIMIT 1
      `).bind(contentHash, excludeId).first()
    : await db.prepare(`
        SELECT id, text, status
        FROM conversation_questions
        WHERE content_hash = ?
        LIMIT 1
      `).bind(contentHash).first();
  return result || null;
}

async function similarityWarnings(db, question, excludeId = "") {
  const all = await getAllQuestions(db);
  return all
    .filter((item) => item.id !== excludeId)
    .map((item) => ({ item, score: textSimilarityScore(question.text, item.text) }))
    .filter(({ score }) => score >= 0.68 && score < 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({
      code: "possible_textual_similarity",
      path: "text",
      message: `Möglicherweise textuell sehr ähnlich zu „${item.text}“ (${Math.round(score * 100)} %, ${item.status}).`,
      relatedId: item.id
    }));
}

function relationInsertStatements(db, questionId, question) {
  const statements = [];
  for (const category of question.categories) {
    statements.push(db.prepare(`
      INSERT INTO conversation_question_categories (question_id, category)
      VALUES (?, ?)
    `).bind(questionId, category));
  }
  for (const topic of question.topics) {
    statements.push(db.prepare(`
      INSERT INTO conversation_question_topics (question_id, topic)
      VALUES (?, ?)
    `).bind(questionId, topic));
  }
  for (const context of question.contexts) {
    statements.push(db.prepare(`
      INSERT INTO conversation_question_contexts (question_id, context)
      VALUES (?, ?)
    `).bind(questionId, context));
  }
  return statements;
}

export async function createConversationQuestion(db, payload) {
  const validation = normalizePayload(payload, { defaultStatus: "active" });
  if (!validation.ok) return { ok: false, ...validation };

  const question = validation.question;
  const contentHash = await questionContentHash(question.text);
  const duplicate = await duplicateForHash(db, contentHash);
  if (duplicate) {
    return {
      ok: false,
      errors: [issue("duplicate_in_database", "text", `Exaktes normalisiertes Duplikat existiert bereits (${duplicate.status}, ${duplicate.id}).`)],
      warnings: validation.warnings
    };
  }

  const warnings = [...validation.warnings, ...(await similarityWarnings(db, question))];
  const id = `crq_${crypto.randomUUID()}`;
  const statements = [
    db.prepare(`
      INSERT INTO conversation_questions (
        id, text, intensity, min_participants, status, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, question.text, question.intensity, question.minParticipants, question.status, contentHash),
    ...relationInsertStatements(db, id, question)
  ];
  await db.batch(statements);

  return { ok: true, question: await getQuestionById(db, id), warnings };
}

export async function updateConversationQuestion(db, id, payload) {
  const existing = await getQuestionById(db, id);
  if (!existing) return { ok: false, notFound: true, errors: [issue("not_found", "id", "Frage wurde nicht gefunden.")], warnings: [] };

  const validation = normalizePayload(payload, { defaultStatus: existing.status });
  if (!validation.ok) return { ok: false, ...validation };

  const question = validation.question;
  const contentHash = await questionContentHash(question.text);
  const duplicate = await duplicateForHash(db, contentHash, id);
  if (duplicate) {
    return {
      ok: false,
      errors: [issue("duplicate_in_database", "text", `Exaktes normalisiertes Duplikat existiert bereits (${duplicate.status}, ${duplicate.id}).`)],
      warnings: validation.warnings
    };
  }

  const warnings = [...validation.warnings, ...(await similarityWarnings(db, question, id))];
  const statements = [
    db.prepare(`
      UPDATE conversation_questions
      SET text = ?, intensity = ?, min_participants = ?, status = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(question.text, question.intensity, question.minParticipants, question.status, contentHash, id),
    db.prepare("DELETE FROM conversation_question_categories WHERE question_id = ?").bind(id),
    db.prepare("DELETE FROM conversation_question_topics WHERE question_id = ?").bind(id),
    db.prepare("DELETE FROM conversation_question_contexts WHERE question_id = ?").bind(id),
    ...relationInsertStatements(db, id, question)
  ];
  await db.batch(statements);

  return { ok: true, question: await getQuestionById(db, id), warnings };
}

export async function deleteConversationQuestion(db, id) {
  const existing = await getQuestionById(db, id);
  if (!existing) return { ok: false, notFound: true };

  const result = await db.prepare(`
    DELETE FROM conversation_questions
    WHERE id = ?
  `).bind(id).run();

  const deleted = Number(result?.meta?.changes || 0) > 0;
  return { ok: deleted, deleted, id };
}
