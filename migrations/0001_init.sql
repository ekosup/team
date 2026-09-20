CREATE TABLE managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  access_key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  manager_id TEXT NOT NULL REFERENCES managers(id),
  public_slug TEXT NOT NULL UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE buckets (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  bucket_id TEXT NOT NULL REFERENCES buckets(id),
  title TEXT NOT NULL,
  description TEXT,
  module TEXT,
  target TEXT,
  timeline_start TEXT,
  timeline_end TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_boards_manager ON boards(manager_id);
CREATE INDEX idx_buckets_board ON buckets(board_id);
CREATE INDEX idx_tasks_board ON tasks(board_id);
CREATE INDEX idx_tasks_bucket ON tasks(bucket_id);
