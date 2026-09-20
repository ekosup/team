CREATE TABLE board_managers (
  board_id TEXT NOT NULL REFERENCES boards(id),
  manager_id TEXT NOT NULL REFERENCES managers(id),
  PRIMARY KEY (board_id, manager_id)
);

INSERT INTO board_managers (board_id, manager_id)
SELECT id, manager_id FROM boards WHERE manager_id IS NOT NULL;

CREATE INDEX idx_board_managers_manager ON board_managers(manager_id);
CREATE INDEX idx_board_managers_board ON board_managers(board_id);

DROP INDEX idx_boards_manager;
ALTER TABLE boards DROP COLUMN manager_id;
