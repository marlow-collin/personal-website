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

export async function getActiveQuestions(db) {
  const results = await db.batch([
    db.prepare(`
      SELECT id, text, intensity, min_participants
      FROM conversation_questions
      WHERE status = 'active'
      ORDER BY id
    `),
    db.prepare(`
      SELECT qc.question_id, qc.category
      FROM conversation_question_categories qc
      JOIN conversation_questions q ON q.id = qc.question_id
      WHERE q.status = 'active'
      ORDER BY qc.question_id, qc.category
    `),
    db.prepare(`
      SELECT qt.question_id, qt.topic
      FROM conversation_question_topics qt
      JOIN conversation_questions q ON q.id = qt.question_id
      WHERE q.status = 'active'
      ORDER BY qt.question_id, qt.topic
    `),
    db.prepare(`
      SELECT qx.question_id, qx.context
      FROM conversation_question_contexts qx
      JOIN conversation_questions q ON q.id = qx.question_id
      WHERE q.status = 'active'
      ORDER BY qx.question_id, qx.context
    `)
  ]);

  const questionRows = rows(results[0]);
  const categoriesByQuestion = groupValues(rows(results[1]), "question_id", "category");
  const topicsByQuestion = groupValues(rows(results[2]), "question_id", "topic");
  const contextsByQuestion = groupValues(rows(results[3]), "question_id", "context");

  return questionRows.map((question) => ({
    id: question.id,
    text: question.text,
    categories: categoriesByQuestion.get(question.id) || [],
    intensity: question.intensity,
    topics: topicsByQuestion.get(question.id) || [],
    contexts: contextsByQuestion.get(question.id) || [],
    minParticipants: question.min_participants == null
      ? null
      : Number(question.min_participants)
  }));
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
    `)
  ]);

  const totals = rows(results[0])[0] || {};

  return {
    total: Number(totals.total || 0),
    active: Number(totals.active || 0),
    archived: Number(totals.archived || 0),
    byIntensity: rows(results[1]).map((item) => ({
      intensity: item.intensity,
      count: Number(item.count || 0)
    })),
    byCategory: rows(results[2]).map((item) => ({
      category: item.category,
      count: Number(item.count || 0)
    }))
  };
}
