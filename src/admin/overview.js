import { DAILY_CATEGORY_LIST } from "../daily/config.js";
import { CONVERSATION_CATEGORIES } from "../conversation/config.js";
import { ADMIN_MODULES, getAdminModule } from "./modules.js";

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moduleBase(id) {
  const definition = getAdminModule(id);
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    manageUrl: definition.manageUrl,
    siteUrl: definition.siteUrl,
    quickActions: definition.quickActions || [],
    status: "healthy",
    metrics: []
  };
}

function errorAttention(module, message) {
  return {
    severity: "error",
    module: module.id,
    code: `${module.id}_unavailable`,
    title: `${module.label} unavailable`,
    message,
    href: module.manageUrl || module.siteUrl || "/x/admin/"
  };
}

async function dateOverview(env) {
  const module = moduleBase("date");
  const row = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status IN ('opened', 'accepted') THEN 1 ELSE 0 END) AS active
    FROM invitations
  `).first();

  module.metrics = [
    { label: "Invitations", value: number(row?.total) },
    { label: "Completed", value: number(row?.completed) }
  ];
  module.summary = `${number(row?.total)} invitations · ${number(row?.completed)} completed`;
  return { module, attention: [] };
}

async function dailyOverview(env) {
  const module = moduleBase("daily");
  const result = await env.DAILY_DB.prepare(`
    SELECT category_slug, status, COUNT(*) AS count
    FROM daily_content
    GROUP BY category_slug, status
  `).all();

  const activeByCategory = new Map(DAILY_CATEGORY_LIST.map((category) => [category.slug, 0]));
  let active = 0;
  let archived = 0;

  for (const row of result.results || []) {
    const count = number(row.count);
    if (row.status === "active") {
      active += count;
      if (activeByCategory.has(row.category_slug)) activeByCategory.set(row.category_slug, count);
    } else if (row.status === "archived") {
      archived += count;
    }
  }

  const attention = [];
  for (const category of DAILY_CATEGORY_LIST) {
    if ((activeByCategory.get(category.slug) || 0) !== 0) continue;
    attention.push({
      severity: "error",
      module: "daily",
      code: "daily_category_empty",
      title: `${category.shortLabel} has no active content`,
      message: "This Daily category cannot activate new content until an active entry exists.",
      href: module.manageUrl
    });
  }

  module.status = attention.length ? "error" : "healthy";
  module.metrics = [
    { label: "Active", value: active },
    { label: "Categories", value: DAILY_CATEGORY_LIST.length }
  ];
  module.summary = `${active} active · ${DAILY_CATEGORY_LIST.length} categories`;
  module.meta = { archived, attentionCount: attention.length };
  return { module, attention };
}

async function conversationOverview(env) {
  const module = moduleBase("conversation");
  const [totals, categories, missingCategory, missingTopic] = await Promise.all([
    env.CONVERSATION_DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
      FROM conversation_questions
    `).first(),
    env.CONVERSATION_DB.prepare(`
      SELECT qc.category, COUNT(*) AS count
      FROM conversation_question_categories qc
      JOIN conversation_questions q ON q.id = qc.question_id
      WHERE q.status = 'active'
      GROUP BY qc.category
    `).all(),
    env.CONVERSATION_DB.prepare(`
      SELECT COUNT(*) AS count
      FROM conversation_questions q
      WHERE q.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM conversation_question_categories qc WHERE qc.question_id = q.id
        )
    `).first(),
    env.CONVERSATION_DB.prepare(`
      SELECT COUNT(*) AS count
      FROM conversation_questions q
      WHERE q.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM conversation_question_topics qt WHERE qt.question_id = q.id
        )
    `).first()
  ]);

  const active = number(totals?.active);
  const archived = number(totals?.archived);
  const categoryCounts = new Map(CONVERSATION_CATEGORIES.map((category) => [category, 0]));
  for (const row of categories.results || []) {
    if (categoryCounts.has(row.category)) categoryCounts.set(row.category, number(row.count));
  }

  const attention = [];
  if (active === 0) {
    attention.push({
      severity: "error",
      module: "conversation",
      code: "conversation_no_active_questions",
      title: "Conversation Roulette has no active questions",
      message: "The active question pool is empty.",
      href: module.manageUrl
    });
  } else {
    for (const category of CONVERSATION_CATEGORIES) {
      if ((categoryCounts.get(category) || 0) !== 0) continue;
      attention.push({
        severity: "error",
        module: "conversation",
        code: "conversation_category_empty",
        title: `${category.replaceAll("_", " ")} has no active questions`,
        message: "This category currently has no active questions.",
        href: module.manageUrl
      });
    }
  }

  const missingCategoryCount = number(missingCategory?.count);
  if (missingCategoryCount > 0) {
    attention.push({
      severity: "warning",
      module: "conversation",
      code: "conversation_missing_category",
      title: `${missingCategoryCount} active question${missingCategoryCount === 1 ? "" : "s"} without a category`,
      message: "Review the Conversation library metadata.",
      href: module.manageUrl
    });
  }

  const missingTopicCount = number(missingTopic?.count);
  if (missingTopicCount > 0) {
    attention.push({
      severity: "warning",
      module: "conversation",
      code: "conversation_missing_topic",
      title: `${missingTopicCount} active question${missingTopicCount === 1 ? "" : "s"} without a topic`,
      message: "Review the Conversation library metadata.",
      href: module.manageUrl
    });
  }

  module.status = attention.some((item) => item.severity === "error")
    ? "error"
    : attention.length
      ? "attention"
      : "healthy";
  module.metrics = [
    { label: "Active", value: active },
    { label: "Archived", value: archived },
    { label: "Categories", value: CONVERSATION_CATEGORIES.length }
  ];
  module.summary = `${active} active · ${archived} archived · ${CONVERSATION_CATEGORIES.length} categories`;
  module.meta = { attentionCount: attention.length };
  return { module, attention };
}

async function checkinsOverview(env, mailConfigured) {
  const module = moduleBase("checkins");
  const [totals, latest] = await Promise.all([
    env.CHECKIN_DB.prepare(`
      SELECT
        COUNT(*) AS checkin_count,
        SUM(CASE WHEN mail_on_next_answer = 1 THEN 1 ELSE 0 END) AS armed_count
      FROM checkins
    `).first(),
    env.CHECKIN_DB.prepare(`
      SELECT COUNT(*) AS event_count, MAX(created_at) AS latest_event_at
      FROM checkin_events
    `).first()
  ]);

  const checkinCount = number(totals?.checkin_count);
  const eventCount = number(latest?.event_count);
  const armedCount = number(totals?.armed_count);
  const attention = [];

  if (armedCount > 0 && !mailConfigured) {
    attention.push({
      severity: "warning",
      module: "checkins",
      code: "checkins_mail_not_configured",
      title: "Check-in mail is armed but mail is not configured",
      message: `${armedCount} check-in${armedCount === 1 ? " is" : "s are"} waiting for the next-answer notification.`,
      href: module.manageUrl
    });
  }

  module.status = attention.length ? "attention" : "healthy";
  module.metrics = [
    { label: "Check-ins", value: checkinCount },
    { label: "Events", value: eventCount }
  ];
  module.summary = `${checkinCount} check-in${checkinCount === 1 ? "" : "s"} · ${eventCount} events`;
  module.meta = { latestEventAt: latest?.latest_event_at || null, attentionCount: attention.length };
  return { module, attention };
}

async function pokerOverview(env) {
  const module = moduleBase("poker");
  const id = env.POKER_LIVE_REGISTRY.idFromName("poker-sessions");
  const stub = env.POKER_LIVE_REGISTRY.get(id);
  const response = await stub.fetch(new Request("https://registry/list"));
  if (!response.ok) throw new Error("Poker session registry unavailable.");
  const data = await response.json();
  const sessions = data.sessions || [];
  const live = sessions.filter((session) => ["running", "paused", "level-change"].includes(session.status)).length;
  const finished = sessions.filter((session) => session.status === "finished").length;
  module.status = live ? "healthy" : "neutral";
  module.metrics = [
    { label: "Live", value: live },
    { label: "Tracked", value: sessions.length },
    { label: "Finished", value: finished }
  ];
  module.summary = `${live} live · ${sessions.length} tracked`;
  return { module, attention: [] };
}

function staticModule(id) {
  const module = moduleBase(id);
  module.status = "neutral";
  module.summary = module.description;
  return { module, attention: [] };
}

function mailIsConfigured(env) {
  return Boolean(
    String(env.IONOS_SMTP_USER || "").trim()
    && String(env.IONOS_SMTP_PASSWORD || "").trim()
    && String(env.DATE_EMAIL_DESTINATION || "").trim()
  );
}

function environmentLabel(request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "marlow-rischmueller.com" || hostname === "www.marlow-rischmueller.com"
    ? "Production"
    : "Preview / Local";
}

async function runModule(definition, task) {
  try {
    return await task();
  } catch (error) {
    console.error(`Admin overview ${definition.id} failed`, error);
    const module = moduleBase(definition.id);
    module.status = "error";
    module.summary = "Unavailable";
    return {
      module,
      attention: [errorAttention(module, "The dashboard could not read this module's data.")],
      unavailable: true
    };
  }
}

export async function buildAdminOverview(request, env) {
  const mailConfigured = mailIsConfigured(env);
  const tasks = {
    date: () => dateOverview(env),
    daily: () => dailyOverview(env),
    conversation: () => conversationOverview(env),
    checkins: () => checkinsOverview(env, mailConfigured),
    decide: () => staticModule("decide"),
    poker: () => pokerOverview(env)
  };

  const results = await Promise.all(
    ADMIN_MODULES.map((definition) => runModule(definition, tasks[definition.id]))
  );

  const modules = results.map((result) => result.module);
  const attention = results.flatMap((result) => result.attention);
  const unavailable = new Set(
    results.filter((result) => result.unavailable).map((result) => result.module.id)
  );

  return {
    ok: true,
    version: 1,
    status: "ready",
    generatedAt: new Date().toISOString(),
    attention,
    modules,
    system: {
      environment: environmentLabel(request),
      access: "Authenticated",
      mail: mailConfigured ? "Configured" : "Not configured",
      databases: {
        date: unavailable.has("date") ? "Unavailable" : "Connected",
        daily: unavailable.has("daily") ? "Unavailable" : "Connected",
        checkins: unavailable.has("checkins") ? "Unavailable" : "Connected",
        conversation: unavailable.has("conversation") ? "Unavailable" : "Connected"
      }
    }
  };
}
