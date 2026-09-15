-- Daily Content core schema
-- The production tables were initially created manually in the Cloudflare D1 Console.
-- IF NOT EXISTS keeps this migration safe if it is later registered/applied via Wrangler.

CREATE TABLE IF NOT EXISTS daily_imports (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_file_hash TEXT NOT NULL,
  format_version INTEGER NOT NULL CHECK (format_version >= 1),
  payload_schema_version INTEGER NOT NULL CHECK (payload_schema_version >= 1),
  times_shown_mode TEXT NOT NULL CHECK (times_shown_mode IN ('match_current_pool', 'manual')),
  requested_times_shown INTEGER NULL CHECK (requested_times_shown IS NULL OR requested_times_shown >= 0),
  resolved_times_shown INTEGER NOT NULL CHECK (resolved_times_shown >= 0),
  total_items INTEGER NOT NULL CHECK (total_items >= 0),
  imported_items INTEGER NOT NULL CHECK (imported_items >= 0),
  duplicate_items INTEGER NOT NULL CHECK (duplicate_items >= 0),
  rejected_items INTEGER NOT NULL CHECK (rejected_items >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (times_shown_mode = 'match_current_pool' AND requested_times_shown IS NULL)
    OR
    (times_shown_mode = 'manual' AND requested_times_shown IS NOT NULL)
  ),
  CHECK (total_items = imported_items + duplicate_items + rejected_items)
);

CREATE TABLE IF NOT EXISTS daily_content (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  times_shown INTEGER NOT NULL DEFAULT 0 CHECK (times_shown >= 0),
  display_label TEXT NOT NULL CHECK (length(trim(display_label)) > 0),
  payload_schema_version INTEGER NOT NULL DEFAULT 1 CHECK (payload_schema_version >= 1),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  provenance_json TEXT NULL CHECK (provenance_json IS NULL OR json_valid(provenance_json)),
  dedupe_key TEXT NOT NULL CHECK (length(trim(dedupe_key)) > 0),
  import_batch_id TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_batch_id) REFERENCES daily_imports(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS daily_activations (
  id TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL,
  local_date TEXT NOT NULL CHECK (length(local_date) = 10),
  content_id TEXT NOT NULL,
  selection_level INTEGER NOT NULL CHECK (selection_level >= 0),
  activation_token TEXT NOT NULL UNIQUE,
  time_zone TEXT NOT NULL CHECK (length(trim(time_zone)) > 0),
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES daily_content(id) ON DELETE RESTRICT,
  UNIQUE (category_slug, local_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_content_category_dedupe_uq
  ON daily_content(category_slug, dedupe_key);

CREATE INDEX IF NOT EXISTS daily_content_rotation_idx
  ON daily_content(category_slug, status, times_shown, id);

CREATE INDEX IF NOT EXISTS daily_activations_history_idx
  ON daily_activations(category_slug, local_date DESC);

CREATE INDEX IF NOT EXISTS daily_activations_content_idx
  ON daily_activations(content_id);

CREATE INDEX IF NOT EXISTS daily_imports_category_committed_idx
  ON daily_imports(category_slug, committed_at DESC);
