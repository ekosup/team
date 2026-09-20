-- Archive is a soft-delete: a task must be archived before it can be hard-deleted.
ALTER TABLE tasks ADD COLUMN archived_at TEXT;
