-- Conversation Roulette core schema
-- Apply this SQL to the dedicated Conversation D1 database.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversation_questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  intensity TEXT NOT NULL CHECK (intensity IN ('light', 'medium', 'deep')),
  min_participants INTEGER NULL CHECK (min_participants IS NULL OR min_participants = 3),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  content_hash TEXT NOT NULL UNIQUE CHECK (length(trim(content_hash)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_question_categories (
  question_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'casual',
    'funny',
    'deep',
    'hypothetical',
    'would_you_rather',
    'stories',
    'debate',
    'chaotic'
  )),
  PRIMARY KEY (question_id, category),
  FOREIGN KEY (question_id) REFERENCES conversation_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_question_topics (
  question_id TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (topic IN (
    'everyday',
    'childhood',
    'family',
    'friendship',
    'relationships',
    'work',
    'education',
    'money',
    'travel',
    'food',
    'culture',
    'technology',
    'future',
    'values',
    'identity',
    'habits',
    'goals',
    'fears',
    'memories',
    'society',
    'creativity'
  )),
  PRIMARY KEY (question_id, topic),
  FOREIGN KEY (question_id) REFERENCES conversation_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_question_contexts (
  question_id TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('friends', 'dating')),
  PRIMARY KEY (question_id, context),
  FOREIGN KEY (question_id) REFERENCES conversation_questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conversation_questions_status_idx
  ON conversation_questions(status);

CREATE INDEX IF NOT EXISTS conversation_questions_intensity_idx
  ON conversation_questions(intensity);

CREATE INDEX IF NOT EXISTS conversation_categories_category_idx
  ON conversation_question_categories(category, question_id);

CREATE INDEX IF NOT EXISTS conversation_topics_topic_idx
  ON conversation_question_topics(topic, question_id);

CREATE INDEX IF NOT EXISTS conversation_contexts_context_idx
  ON conversation_question_contexts(context, question_id);
