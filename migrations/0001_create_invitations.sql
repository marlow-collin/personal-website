CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,

  first_name TEXT NOT NULL,
  internal_label TEXT NOT NULL DEFAULT '',
  personal_message TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL CHECK(theme IN ('soft-playful','dark-elegant')),

  status TEXT NOT NULL DEFAULT 'created'
    CHECK(status IN ('created','opened','accepted','completed')),
  no_attempts INTEGER NOT NULL DEFAULT 0 CHECK(no_attempts >= 0),

  activity TEXT,
  day_preference TEXT,
  time_preference TEXT,
  ride_preference TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_at TEXT,
  accepted_at TEXT,
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_created_at ON invitations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
