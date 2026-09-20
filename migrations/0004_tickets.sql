ALTER TABLE boards ADD COLUMN allowed_emails TEXT NOT NULL DEFAULT '[]';
ALTER TABLE boards ADD COLUMN assignees TEXT NOT NULL DEFAULT '[]';

-- keep existing free-text PICs available in the new dropdown
UPDATE boards SET assignees = COALESCE(
  (SELECT json_group_array(assignee) FROM (
     SELECT DISTINCT assignee FROM tasks WHERE board_id = boards.id AND assignee IS NOT NULL AND assignee != '' ORDER BY assignee
  )),
  '[]'
);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  module TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  task_id TEXT REFERENCES tasks(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_tickets_board ON tickets(board_id, status);
