CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  closing_message TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'minimal' CHECK(theme IN ('minimal','card-room')),
  icon TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL,
  end_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
  location_label TEXT NOT NULL DEFAULT '',
  location_url TEXT NOT NULL DEFAULT '',
  primary_cta_label TEXT NOT NULL DEFAULT '',
  primary_cta_url TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '[]',
  links_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active, start_at);

INSERT OR IGNORE INTO events (
  slug, title, eyebrow, subtitle, description, closing_message, theme, icon,
  start_at, end_at, timezone, location_label, location_url,
  primary_cta_label, primary_cta_url, details_json, links_json, is_active
) VALUES (
  'poker',
  'Poker Night',
  'Private table · Saturday night',
  'Cards, drinks and a little friendly competition.',
  'A relaxed poker night with friends. Come ready for good hands, questionable bluffs and a fun evening.',
  'See you at the table.',
  'card-room',
  '♠',
  '2026-10-24T17:30:00.000Z',
  NULL,
  'Europe/Berlin',
  '',
  '',
  'Open Poker Companion',
  '/x/poker/',
  '[]',
  '[]',
  1
);
