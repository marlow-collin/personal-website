import {
  CONVERSATION_CATEGORIES,
  CONVERSATION_CONTEXTS,
  CONVERSATION_INTENSITIES,
  CONVERSATION_SCHEMA_VERSION,
  CONVERSATION_TOPICS
} from "./config.js";
import { getAllQuestions, getConversationAdminSummary } from "./repository.js";

const INTENSITY_TARGETS = Object.freeze({
  light: 0.45,
  medium: 0.40,
  deep: 0.15
});

function countMap(values, keyName, countName = "count") {
  return Object.fromEntries(values.map((item) => [item[keyName], Number(item[countName] || 0)]));
}

function fillCounts(allowed, values, keyName) {
  const existing = countMap(values, keyName);
  return Object.fromEntries(allowed.map((value) => [value, existing[value] || 0]));
}

function intensityAssessment(summary) {
  const counts = fillCounts(CONVERSATION_INTENSITIES, summary.byIntensity, "intensity");
  const total = Math.max(1, summary.active);
  return CONVERSATION_INTENSITIES.map((intensity) => {
    const actualShare = counts[intensity] / total;
    const targetShare = INTENSITY_TARGETS[intensity];
    return {
      intensity,
      count: counts[intensity],
      actualShare: Number(actualShare.toFixed(4)),
      targetShare,
      deltaPercentagePoints: Number(((actualShare - targetShare) * 100).toFixed(1))
    };
  });
}

function sortedCoverage(allowed, values, keyName) {
  const counts = fillCounts(allowed, values, keyName);
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.count - b.count || a.value.localeCompare(b.value));
}

function categoryTopicCoverage(summary) {
  const counts = new Map(
    summary.byCategoryTopic.map((item) => [`${item.category}\u0000${item.topic}`, Number(item.count || 0)])
  );
  const result = [];
  for (const category of CONVERSATION_CATEGORIES) {
    for (const topic of CONVERSATION_TOPICS) {
      result.push({
        category,
        topic,
        count: counts.get(`${category}\u0000${topic}`) || 0
      });
    }
  }
  return result.sort((a, b) => a.count - b.count || a.category.localeCompare(b.category) || a.topic.localeCompare(b.topic));
}

export async function buildLlmReviewExport(db) {
  const questions = await getAllQuestions(db, { includeAdminFields: false });
  return {
    format: "conversation-llm-review-export",
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    summary: {
      total: questions.length,
      active: questions.filter((question) => question.status === "active").length,
      archived: questions.filter((question) => question.status === "archived").length
    },
    questions
  };
}

export async function buildFullExport(db) {
  const questions = await getAllQuestions(db, { includeAdminFields: true });
  return {
    format: "conversation-full-export",
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    questions
  };
}

export async function buildGenerationBrief(db, requestedCount = 80) {
  const summary = await getConversationAdminSummary(db);
  const count = Math.min(150, Math.max(1, Number.parseInt(requestedCount, 10) || 80));

  return {
    format: "conversation-generation-brief",
    schemaVersion: CONVERSATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    requestedNewQuestions: count,
    objective: "Neue Fragen sollen vorhandene Lücken schließen, Vielfalt erhöhen und bestehende Übergewichte nicht weiter verstärken.",
    current: summary,
    targets: {
      intensityShares: INTENSITY_TARGETS,
      categories: "Keine starre Gleichverteilung. Niedrig belegte Kategorien bevorzugen, ohne schwache Inhalte nur für Symmetrie zu erzeugen.",
      topics: "Breite Abdeckung des kontrollierten Topic-Vokabulars. Unterrepräsentierte Topics und Kategorie×Topic-Kombinationen bevorzugen.",
      contexts: "friends/dating nur vergeben, wenn die Frage spezifisch davon profitiert; universelle Fragen behalten contexts: [].",
      groupQuestions: "minParticipants: 3 nur für echte Gruppenfragen; nicht inflationär verwenden."
    },
    coverage: {
      categoriesLowToHigh: sortedCoverage(CONVERSATION_CATEGORIES, summary.byCategory, "category"),
      topicsLowToHigh: sortedCoverage(CONVERSATION_TOPICS, summary.byTopic, "topic"),
      contextsLowToHigh: sortedCoverage(CONVERSATION_CONTEXTS, summary.byContext, "context"),
      intensityAssessment: intensityAssessment(summary),
      categoryTopicLowToHigh: categoryTopicCoverage(summary)
    },
    generationRules: [
      "Den LLM-Review-Export vollständig gegen exakte und sehr ähnliche vorhandene Fragen prüfen, einschließlich archivierter Inhalte.",
      "Keine bloßen Umformulierungen derselben Gesprächsidee erzeugen.",
      "Die gewünschte Anzahl ist ein Ziel, Qualität und Eigenständigkeit haben Vorrang.",
      "Normalerweise 1–2 Kategorien pro Frage, maximal 3.",
      "1–3 Topics pro Frage; nur Werte aus dem kanonischen Vokabular.",
      "Intensität nach light/medium/deep realistisch einstufen und die Zielverteilung berücksichtigen.",
      "Unterschiedliche Frageformen, Satzanfänge und Themencluster verwenden.",
      "Neue Einträge ausschließlich im kanonischen Importformat und ohne IDs ausgeben."
    ]
  };
}
