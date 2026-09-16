import {
  normalizeQuestionText,
  textSimilarityScore,
  validateImportDocument
} from "./import-validation.js";
import { questionContentHash } from "./content-hash.js";

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function existingQuestions(db) {
  const result = await db.prepare(`
    SELECT id, text, status, content_hash
    FROM conversation_questions
    ORDER BY created_at, id
  `).all();
  return rows(result);
}

async function prepareQuestions(validation) {
  return Promise.all(validation.questions.map(async (entry) => ({
    ...entry,
    normalizedText: normalizeQuestionText(entry.question.text),
    contentHash: await questionContentHash(entry.question.text)
  })));
}

function duplicateIndexes(prepared) {
  const seen = new Map();
  const duplicates = new Set();
  for (const entry of prepared) {
    if (seen.has(entry.contentHash)) {
      duplicates.add(entry.index);
      duplicates.add(seen.get(entry.contentHash));
    } else {
      seen.set(entry.contentHash, entry.index);
    }
  }
  return duplicates;
}

function similarityWarnings(prepared, existing, exactExistingHashes, duplicateInFile) {
  const warnings = [];
  const allIncoming = prepared.map((entry) => ({
    id: `incoming:${entry.index}`,
    text: entry.question.text,
    index: entry.index
  }));

  for (const entry of prepared) {
    if (duplicateInFile.has(entry.index) || exactExistingHashes.has(entry.contentHash)) continue;

    const candidates = [];
    for (const item of existing) {
      const score = textSimilarityScore(entry.question.text, item.text);
      if (score >= 0.68 && score < 1) {
        candidates.push({ id: item.id, text: item.text, status: item.status, score });
      }
    }
    for (const item of allIncoming) {
      if (item.index === entry.index) continue;
      const score = textSimilarityScore(entry.question.text, item.text);
      if (score >= 0.76 && score < 1) {
        candidates.push({ id: item.id, text: item.text, status: "incoming", score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const candidate of candidates.slice(0, 3)) {
      warnings.push({
        code: "possible_textual_similarity",
        path: `questions[${entry.index}].text`,
        message: `Möglicherweise textuell sehr ähnlich zu „${candidate.text}“ (${Math.round(candidate.score * 100)} %, ${candidate.status}).`,
        relatedId: candidate.id
      });
    }
  }
  return warnings;
}

export async function validateConversationImport(db, document) {
  const validation = validateImportDocument(document);
  if (validation.errors.length) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: {
        total: Array.isArray(document?.questions) ? document.questions.length : 0,
        valid: 0,
        duplicates: 0,
        similarityWarnings: 0
      },
      preview: []
    };
  }

  const prepared = await prepareQuestions(validation);
  const existing = await existingQuestions(db);
  const existingHashes = new Set(existing.map((item) => item.content_hash));
  const duplicateInFile = duplicateIndexes(prepared);
  const duplicateExisting = new Set(
    prepared.filter((entry) => existingHashes.has(entry.contentHash)).map((entry) => entry.index)
  );

  const duplicateErrors = [];
  for (const entry of prepared) {
    if (duplicateInFile.has(entry.index)) {
      duplicateErrors.push({
        code: "duplicate_in_file",
        path: `questions[${entry.index}].text`,
        message: "Exaktes normalisiertes Duplikat innerhalb dieser Importdatei."
      });
    }
    if (duplicateExisting.has(entry.index)) {
      duplicateErrors.push({
        code: "duplicate_in_database",
        path: `questions[${entry.index}].text`,
        message: "Exaktes normalisiertes Duplikat existiert bereits in D1 (aktive oder archivierte Frage)."
      });
    }
  }

  const similarity = similarityWarnings(prepared, existing, existingHashes, duplicateInFile);
  const errors = [...validation.errors, ...duplicateErrors];
  const warnings = [...validation.warnings, ...similarity];
  const duplicateQuestionIndexes = new Set([
    ...duplicateInFile,
    ...duplicateExisting
  ]);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      total: prepared.length,
      valid: prepared.length - duplicateQuestionIndexes.size,
      duplicates: duplicateQuestionIndexes.size,
      similarityWarnings: similarity.length
    },
    preview: prepared.map((entry) => ({
      index: entry.index,
      text: entry.question.text,
      categories: entry.question.categories,
      intensity: entry.question.intensity,
      topics: entry.question.topics,
      contexts: entry.question.contexts,
      minParticipants: entry.question.minParticipants,
      duplicate: duplicateQuestionIndexes.has(entry.index)
    }))
  };
}

function valuesClause(count, width) {
  return Array.from({ length: count }, () => `(${Array.from({ length: width }, () => "?").join(", ")})`).join(", ");
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function pushMainInsertStatements(db, statements, records) {
  // D1 currently allows at most 100 bound parameters per query.
  // Five bindings per question => max 20 questions per statement.
  for (const group of chunks(records, 20)) {
    const bindings = group.flatMap((record) => [
      record.id,
      record.question.text,
      record.question.intensity,
      record.question.minParticipants,
      record.contentHash
    ]);
    statements.push(db.prepare(`
      INSERT INTO conversation_questions (
        id, text, intensity, min_participants, status, content_hash
      ) VALUES ${group.map(() => "(?, ?, ?, ?, 'active', ?)").join(", ")}
    `).bind(...bindings));
  }
}

function pushRelationInsertStatements(db, statements, table, column, rowsToInsert) {
  // Two bindings per relation row => max 50 rows per statement.
  for (const group of chunks(rowsToInsert, 50)) {
    if (!group.length) continue;
    const bindings = group.flatMap((row) => [row.questionId, row.value]);
    statements.push(db.prepare(`
      INSERT INTO ${table} (question_id, ${column})
      VALUES ${valuesClause(group.length, 2)}
    `).bind(...bindings));
  }
}

export async function commitConversationImport(db, document) {
  const preview = await validateConversationImport(db, document);
  if (!preview.ok) return { ...preview, committed: false };

  const validation = validateImportDocument(document);
  const prepared = await prepareQuestions(validation);
  const records = prepared.map((entry) => ({
    id: `crq_${crypto.randomUUID()}`,
    question: entry.question,
    contentHash: entry.contentHash
  }));

  const statements = [];
  pushMainInsertStatements(db, statements, records);

  const categories = [];
  const topics = [];
  const contexts = [];
  for (const record of records) {
    for (const value of record.question.categories) categories.push({ questionId: record.id, value });
    for (const value of record.question.topics) topics.push({ questionId: record.id, value });
    for (const value of record.question.contexts) contexts.push({ questionId: record.id, value });
  }

  pushRelationInsertStatements(db, statements, "conversation_question_categories", "category", categories);
  pushRelationInsertStatements(db, statements, "conversation_question_topics", "topic", topics);
  pushRelationInsertStatements(db, statements, "conversation_question_contexts", "context", contexts);

  await db.batch(statements);

  return {
    ok: true,
    committed: true,
    imported: records.length,
    ids: records.map((record) => record.id),
    warnings: preview.warnings
  };
}
