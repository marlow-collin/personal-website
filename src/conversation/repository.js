function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function groupValues(items, keyName, valueName) {
  const grouped = new Map();
  for (const item of items) {
    const key = item[keyName];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item[valueName]);
  }
  return grouped;
}

async function loadQuestionRelations(db, statusFilter = "") {
  const where = statusFilter ? `WHERE q.status = '${statusFilter}'` : "";
  return db.batch([
    db.prepare(`
      SELECT qc.question_id, qc.category
      FROM conversation_question_categories qc
      JOIN conversation_questions q ON q.id = qc.question_id
      ${where}
      ORDER BY qc.question_id, qc.category
    `),
    db.prepare(`
      SELECT qt.question_id, qt.topic
      FROM conversation_question_topics qt
      JOIN conversation_questions q ON q.id = qt.question_id
      ${where}
      ORDER BY qt.question_id, qt.topic
    `),
    db.prepare(`
      SELECT qx.question_id, qx.context
      FROM conversation_question_contexts qx
      JOIN conversation_questions q ON q.id = qx.question_id
      ${where}
      ORDER BY qx.question_id, qx.context
    `)
  ]);
}

function attachRelations(questionRows, relationResults, { includeAdminFields = false } = {}) {
  const categoriesByQuestion = groupValues(rows(relationResults[0]), "question_id", "category");
  const topicsByQuestion = groupValues(rows(relationResults[1]), "question_id", "topic");
  const contextsByQuestion = groupValues(rows(relationResults[2]), "question_id", "context");

  return questionRows.map((question) => {
    const base = {
      id: question.id,
      text: question.text,
      categories: categoriesByQuestion.get(question.id) || [],
      intensity: question.intensity,
      topics: topicsByQuestion.get(question.id) || [],
      contexts: contextsByQuestion.get(question.id) || [],
      minParticipants: question.min_participants == null ? null : Number(question.min_participants)
    };

    if (question.status != null) base.status = question.status;
    if (includeAdminFields) {
      base.createdAt = question.created_at;
      base.updatedAt = question.updated_at;
    }
    return base;
  });
}

export async function getActiveQuestions(db) {
  const questionResult = await db.prepare(`
    SELECT id, text, intensity, min_participants
    FROM conversation_questions
    WHERE status = 'active'
    ORDER BY id
  `).all();
  const relations = await loadQuestionRelations(db, "active");
  return attachRelations(rows(questionResult), relations);
}

export async function getAllQuestions(db, { includeAdminFields = false } = {}) {
  const fields = includeAdminFields
    ? "id, text, intensity, min_participants, status, created_at, updated_at"
    : "id, text, intensity, min_participants, status";
  const questionResult = await db.prepare(`
    SELECT ${fields}
    FROM conversation_questions
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at, id
  `).all();
  const relations = await loadQuestionRelations(db);
  return attachRelations(rows(questionResult), relations, { includeAdminFields });
}

export async function getConversationAdminSummary(db) {
  const results = await db.batch([
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
      FROM conversation_questions
    `),
    db.prepare(`
      SELECT intensity, COUNT(*) AS count
      FROM conversation_questions
      WHERE status = 'active'
      GROUP BY intensity
      ORDER BY intensity
    `),
    db.prepare(`
      SELECT qc.category, COUNT(*) AS count
      FROM conversation_question_categories qc
      JOIN conversation_questions q ON q.id = qc.question_id
      WHERE q.status = 'active'
      GROUP BY qc.category
      ORDER BY qc.category
    `),
    db.prepare(`
      SELECT qt.topic, COUNT(*) AS count
      FROM conversation_question_topics qt
      JOIN conversation_questions q ON q.id = qt.question_id
      WHERE q.status = 'active'
      GROUP BY qt.topic
      ORDER BY qt.topic
    `),
    db.prepare(`
      SELECT qx.context, COUNT(*) AS count
      FROM conversation_question_contexts qx
      JOIN conversation_questions q ON q.id = qx.question_id
      WHERE q.status = 'active'
      GROUP BY qx.context
      ORDER BY qx.context
    `),
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM conversation_questions
      WHERE status = 'active' AND min_participants = 3
    `),
    db.prepare(`
      SELECT qc.category, qt.topic, COUNT(DISTINCT q.id) AS count
      FROM conversation_questions q
      JOIN conversation_question_categories qc ON qc.question_id = q.id
      JOIN conversation_question_topics qt ON qt.question_id = q.id
      WHERE q.status = 'active'
      GROUP BY qc.category, qt.topic
      ORDER BY qc.category, qt.topic
    `)
  ]);

  const totals = rows(results[0])[0] || {};
  const groupCount = rows(results[5])[0] || {};

  return {
    total: Number(totals.total || 0),
    active: Number(totals.active || 0),
    archived: Number(totals.archived || 0),
    groupOnly: Number(groupCount.count || 0),
    byIntensity: rows(results[1]).map((item) => ({ intensity: item.intensity, count: Number(item.count || 0) })),
    byCategory: rows(results[2]).map((item) => ({ category: item.category, count: Number(item.count || 0) })),
    byTopic: rows(results[3]).map((item) => ({ topic: item.topic, count: Number(item.count || 0) })),
    byContext: rows(results[4]).map((item) => ({ context: item.context, count: Number(item.count || 0) })),
    byCategoryTopic: rows(results[6]).map((item) => ({
      category: item.category,
      topic: item.topic,
      count: Number(item.count || 0)
    }))
  };
}

export async function getQuestionById(db, id) {
  const question = await db.prepare(`
    SELECT id, text, intensity, min_participants, status, created_at, updated_at
    FROM conversation_questions
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
  if (!question) return null;

  const relations = await db.batch([
    db.prepare(`
      SELECT question_id, category
      FROM conversation_question_categories
      WHERE question_id = ?
      ORDER BY category
    `).bind(id),
    db.prepare(`
      SELECT question_id, topic
      FROM conversation_question_topics
      WHERE question_id = ?
      ORDER BY topic
    `).bind(id),
    db.prepare(`
      SELECT question_id, context
      FROM conversation_question_contexts
      WHERE question_id = ?
      ORDER BY context
    `).bind(id)
  ]);

  return attachRelations([question], relations, { includeAdminFields: true })[0] || null;
}
