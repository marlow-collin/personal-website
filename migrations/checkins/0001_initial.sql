PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  mail_on_next_answer INTEGER NOT NULL DEFAULT 0 CHECK (mail_on_next_answer IN (0, 1)),
  mail_claim TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkin_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('answer', 'analysis_off')),
  value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkin_events_checkin_id_id
  ON checkin_events(checkin_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_checkin_events_checkin_type_id
  ON checkin_events(checkin_id, type, id DESC);

INSERT OR IGNORE INTO checkins (slug, title, mail_on_next_answer)
VALUES ('und-wie-wars', 'Wie lief das Gespräch?', 0);
