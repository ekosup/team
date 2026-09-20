import type {
  BoardRow,
  BoardWithContent,
  BoardWithManagers,
  BucketRow,
  ManagerRow,
  PublicManager,
  TaskRow,
  TicketRow,
} from "./types";

const newId = () => crypto.randomUUID();

// ---- managers ----

export async function createManager(db: D1Database, name: string, accessKeyHash: string): Promise<ManagerRow> {
  const id = newId();
  await db
    .prepare("INSERT INTO managers (id, name, access_key_hash) VALUES (?, ?, ?)")
    .bind(id, name, accessKeyHash)
    .run();
  return getManagerById(db, id) as Promise<ManagerRow>;
}

export async function getManagerById(db: D1Database, id: string): Promise<ManagerRow | null> {
  return db.prepare("SELECT * FROM managers WHERE id = ?").bind(id).first<ManagerRow>();
}

export async function getManagerByKeyHash(db: D1Database, hash: string): Promise<ManagerRow | null> {
  return db
    .prepare("SELECT * FROM managers WHERE access_key_hash = ? AND revoked_at IS NULL")
    .bind(hash)
    .first<ManagerRow>();
}

export async function listManagers(db: D1Database): Promise<ManagerRow[]> {
  const { results } = await db.prepare("SELECT * FROM managers ORDER BY created_at DESC").all<ManagerRow>();
  return results;
}

export async function revokeManager(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE managers SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
}

/** Only rotates the key of a manager that is not revoked; a revoked manager must be explicitly un-revoked first. */
export async function rotateManagerKey(db: D1Database, id: string, newHash: string): Promise<void> {
  await db
    .prepare("UPDATE managers SET access_key_hash = ? WHERE id = ? AND revoked_at IS NULL")
    .bind(newHash, id)
    .run();
}

// ---- boards ----

export async function createBoard(
  db: D1Database,
  teamName: string,
  managerIds: string[],
  slug: string
): Promise<BoardRow> {
  const id = newId();
  await db
    .prepare("INSERT INTO boards (id, team_name, public_slug) VALUES (?, ?, ?)")
    .bind(id, teamName, slug)
    .run();
  await setBoardManagers(db, id, managerIds);
  return getBoardById(db, id) as Promise<BoardRow>;
}

export async function getBoardById(db: D1Database, id: string): Promise<BoardRow | null> {
  return db.prepare("SELECT * FROM boards WHERE id = ?").bind(id).first<BoardRow>();
}

export async function listBoardsByManagerId(db: D1Database, managerId: string): Promise<BoardRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.* FROM boards b
       JOIN board_managers bm ON bm.board_id = b.id
       WHERE bm.manager_id = ?
       ORDER BY b.created_at DESC`
    )
    .bind(managerId)
    .all<BoardRow>();
  return results;
}

export async function isManagerOnBoard(db: D1Database, boardId: string, managerId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM board_managers WHERE board_id = ? AND manager_id = ?")
    .bind(boardId, managerId)
    .first();
  return row !== null;
}

export async function getBoardBySlug(db: D1Database, slug: string): Promise<BoardRow | null> {
  return db.prepare("SELECT * FROM boards WHERE public_slug = ?").bind(slug).first<BoardRow>();
}

export async function getBoardManagers(db: D1Database, boardId: string): Promise<PublicManager[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.name, m.created_at, m.revoked_at FROM managers m
       JOIN board_managers bm ON bm.manager_id = m.id
       WHERE bm.board_id = ?
       ORDER BY m.name`
    )
    .bind(boardId)
    .all<PublicManager>();
  return results;
}

export async function setBoardManagers(db: D1Database, boardId: string, managerIds: string[]): Promise<void> {
  await db.prepare("DELETE FROM board_managers WHERE board_id = ?").bind(boardId).run();
  if (managerIds.length === 0) return;
  const statements = managerIds.map((managerId) =>
    db.prepare("INSERT INTO board_managers (board_id, manager_id) VALUES (?, ?)").bind(boardId, managerId)
  );
  await db.batch(statements);
}

export async function listBoards(db: D1Database): Promise<BoardWithManagers[]> {
  const { results } = await db.prepare("SELECT * FROM boards ORDER BY created_at DESC").all<BoardRow>();
  const withManagers = await Promise.all(
    results.map(async (board) => ({ ...board, managers: await getBoardManagers(db, board.id) }))
  );
  return withManagers;
}

export async function patchBoard(
  db: D1Database,
  id: string,
  patch: { team_name?: string; is_public?: boolean; status?: string }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.team_name !== undefined) {
    fields.push("team_name = ?");
    values.push(patch.team_name);
  }
  if (patch.is_public !== undefined) {
    fields.push("is_public = ?");
    values.push(patch.is_public ? 1 : 0);
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE boards SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function patchBoardSettings(
  db: D1Database,
  id: string,
  patch: { allowed_emails?: string[]; assignees?: string[]; modules?: string[]; status?: string }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.allowed_emails) {
    fields.push("allowed_emails = ?");
    values.push(JSON.stringify(patch.allowed_emails));
  }
  if (patch.assignees) {
    fields.push("assignees = ?");
    values.push(JSON.stringify(patch.assignees));
  }
  if (patch.modules) {
    fields.push("modules = ?");
    values.push(JSON.stringify(patch.modules));
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE boards SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

/** Board row with the JSON columns parsed for API responses. */
export function boardJson(board: BoardRow) {
  const list = (s: string): string[] => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  return { ...board, allowed_emails: list(board.allowed_emails), assignees: list(board.assignees), modules: list(board.modules) };
}

export async function deleteBoard(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM tickets WHERE board_id = ?").bind(id),
    db.prepare("DELETE FROM tasks WHERE board_id = ?").bind(id),
    db.prepare("DELETE FROM buckets WHERE board_id = ?").bind(id),
    db.prepare("DELETE FROM board_managers WHERE board_id = ?").bind(id),
    db.prepare("DELETE FROM boards WHERE id = ?").bind(id),
  ]);
}

export async function getBoardContent(db: D1Database, boardId: string): Promise<{ buckets: BucketRow[]; tasks: TaskRow[] }> {
  const [buckets, tasks] = await Promise.all([
    db.prepare("SELECT * FROM buckets WHERE board_id = ? ORDER BY position").bind(boardId).all<BucketRow>(),
    db.prepare("SELECT * FROM tasks WHERE board_id = ? ORDER BY position").bind(boardId).all<TaskRow>(),
  ]);
  return { buckets: buckets.results, tasks: tasks.results };
}

export async function getBoardWithContent(
  db: D1Database,
  board: BoardRow
): Promise<ReturnType<typeof boardJson> & Pick<BoardWithContent, "buckets" | "tasks"> & { managers: PublicManager[] }> {
  const [content, managers] = await Promise.all([getBoardContent(db, board.id), getBoardManagers(db, board.id)]);
  return { ...boardJson(board), ...content, managers };
}

export async function listBoardModules(db: D1Database, boardId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT module FROM tasks WHERE board_id = ? AND module IS NOT NULL AND module != '' ORDER BY module")
    .bind(boardId)
    .all<{ module: string }>();
  return results.map((r) => r.module);
}

// ---- tickets ----

export async function createTicket(
  db: D1Database,
  boardId: string,
  input: { email: string; title: string; description?: string; module?: string; priority?: "low" | "normal" | "high" }
): Promise<TicketRow> {
  const id = newId();
  await db
    .prepare("INSERT INTO tickets (id, board_id, email, title, description, module, priority) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, boardId, input.email, input.title, input.description ?? null, input.module ?? null, input.priority ?? "normal")
    .run();
  return getTicketById(db, id) as Promise<TicketRow>;
}

export async function getTicketById(db: D1Database, id: string): Promise<TicketRow | null> {
  return db.prepare("SELECT * FROM tickets WHERE id = ?").bind(id).first<TicketRow>();
}

export async function listTickets(
  db: D1Database,
  boardId: string,
  opts: { status?: "open" | "accepted" | "rejected"; page?: number; limit?: number } = {}
): Promise<{ tickets: TicketRow[]; total: number }> {
  const limit = opts.limit ?? 20;
  const page = opts.page ?? 1;
  const statusClause = opts.status ? "AND status = ?" : "";
  const params: unknown[] = opts.status ? [boardId, opts.status] : [boardId];

  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM tickets WHERE board_id = ? ${statusClause}`)
    .bind(...params)
    .first<{ n: number }>();

  const { results } = await db
    .prepare(
      `SELECT * FROM tickets WHERE board_id = ? ${statusClause}
       ORDER BY status = 'open' DESC, created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, (page - 1) * limit)
    .all<TicketRow>();

  return { tickets: results, total: totalRow?.n ?? 0 };
}

export async function resolveTicket(
  db: D1Database,
  id: string,
  status: "accepted" | "rejected",
  taskId: string | null
): Promise<void> {
  await db
    .prepare("UPDATE tickets SET status = ?, task_id = ?, resolved_at = datetime('now') WHERE id = ?")
    .bind(status, taskId, id)
    .run();
}

// ---- buckets ----

export async function createBucket(db: D1Database, boardId: string, name: string, position: number): Promise<BucketRow> {
  const id = newId();
  await db
    .prepare("INSERT INTO buckets (id, board_id, name, position) VALUES (?, ?, ?, ?)")
    .bind(id, boardId, name, position)
    .run();
  return db.prepare("SELECT * FROM buckets WHERE id = ?").bind(id).first<BucketRow>() as Promise<BucketRow>;
}

export async function getBucketById(db: D1Database, id: string): Promise<BucketRow | null> {
  return db.prepare("SELECT * FROM buckets WHERE id = ?").bind(id).first<BucketRow>();
}

export async function nextBucketPosition(db: D1Database, boardId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(position), -1) AS maxpos FROM buckets WHERE board_id = ?")
    .bind(boardId)
    .first<{ maxpos: number }>();
  return (row?.maxpos ?? -1) + 1;
}

export async function patchBucket(db: D1Database, id: string, patch: { name?: string; position?: number }): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.position !== undefined) {
    fields.push("position = ?");
    values.push(patch.position);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.prepare(`UPDATE buckets SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function countTasksInBucket(db: D1Database, bucketId: string): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE bucket_id = ?").bind(bucketId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function deleteBucket(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM buckets WHERE id = ?").bind(id).run();
}

/** Sets position 0..n for the given bucket ids (scoped to boardId so foreign ids are ignored). */
export async function reorderBuckets(db: D1Database, boardId: string, ids: string[]): Promise<void> {
  await db.batch(
    ids.map((id, i) =>
      db.prepare("UPDATE buckets SET position = ? WHERE id = ? AND board_id = ?").bind(i, id, boardId)
    )
  );
}

/** Moves the given tasks into bucketId in the given order (position 0..n). Scoped to boardId. */
export async function reorderTasks(db: D1Database, boardId: string, bucketId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.batch(
    ids.map((id, i) =>
      db
        .prepare("UPDATE tasks SET bucket_id = ?, position = ?, updated_at = datetime('now') WHERE id = ? AND board_id = ?")
        .bind(bucketId, i, id, boardId)
    )
  );
}

// ---- tasks ----

export async function nextTaskPosition(db: D1Database, bucketId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(position), -1) AS maxpos FROM tasks WHERE bucket_id = ?")
    .bind(bucketId)
    .first<{ maxpos: number }>();
  return (row?.maxpos ?? -1) + 1;
}

export async function createTask(
  db: D1Database,
  boardId: string,
  input: {
    bucket_id: string;
    title: string;
    description?: string;
    module?: string;
    target?: string;
    assignee?: string;
    priority?: "low" | "normal" | "high";
    blocked_reason?: string;
    timeline_start?: string;
    timeline_end?: string;
    position: number;
  }
): Promise<TaskRow> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO tasks (id, board_id, bucket_id, title, description, module, target, assignee, priority, blocked_reason, timeline_start, timeline_end, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      boardId,
      input.bucket_id,
      input.title,
      input.description ?? null,
      input.module ?? null,
      input.target ?? null,
      input.assignee ?? null,
      input.priority ?? "normal",
      input.blocked_reason ?? null,
      input.timeline_start ?? null,
      input.timeline_end ?? null,
      input.position
    )
    .run();
  return db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<TaskRow>() as Promise<TaskRow>;
}

export async function getTaskById(db: D1Database, id: string): Promise<TaskRow | null> {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<TaskRow>();
}

/** Creates the task and resolves the ticket in one batch, so a mid-way failure can't leave the ticket "open" with an orphan task. */
export async function acceptTicket(
  db: D1Database,
  ticketId: string,
  taskInput: {
    board_id: string;
    bucket_id: string;
    title: string;
    description?: string;
    module?: string;
    priority?: "low" | "normal" | "high";
    position: number;
  }
): Promise<string> {
  const taskId = newId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO tasks (id, board_id, bucket_id, title, description, module, priority, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        taskId,
        taskInput.board_id,
        taskInput.bucket_id,
        taskInput.title,
        taskInput.description ?? null,
        taskInput.module ?? null,
        taskInput.priority ?? "normal",
        taskInput.position
      ),
    db
      .prepare("UPDATE tickets SET status = 'accepted', task_id = ?, resolved_at = datetime('now') WHERE id = ?")
      .bind(taskId, ticketId),
  ]);
  return taskId;
}

export async function patchTask(
  db: D1Database,
  id: string,
  patch: Partial<{
    bucket_id: string;
    title: string;
    description: string | null;
    module: string | null;
    target: string | null;
    assignee: string | null;
    priority: "low" | "normal" | "high";
    blocked_reason: string | null;
    timeline_start: string | null;
    timeline_end: string | null;
    position: number;
  }>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  await db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

/** Detaches any ticket pointing at this task first: tickets.task_id has a FK to tasks(id). */
export async function deleteTask(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare("UPDATE tickets SET task_id = NULL WHERE task_id = ?").bind(id),
    db.prepare("DELETE FROM tasks WHERE id = ?").bind(id),
  ]);
}

/** Toggle archive state. Archiving is the only path to delete: see the route's guard. */
export async function setTaskArchived(db: D1Database, id: string, archived: boolean): Promise<void> {
  await db
    .prepare(
      "UPDATE tasks SET archived_at = CASE WHEN ? THEN datetime('now') ELSE NULL END, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(archived ? 1 : 0, id)
    .run();
}

// ---- stats ----

export async function getStats(db: D1Database) {
  const [boards, managers, tasksByBucket, tasksByModule] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM boards").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM managers WHERE revoked_at IS NULL").first<{ n: number }>(),
    // bucket names repeat across boards (e.g. every board has a "Backlog") — carry team_name so the UI can tell them apart
    db
      .prepare(
        `SELECT bo.team_name AS board_name, bk.name AS bucket_name, COUNT(t.id) AS count
         FROM buckets bk
         JOIN boards bo ON bo.id = bk.board_id
         LEFT JOIN tasks t ON t.bucket_id = bk.id AND t.archived_at IS NULL
         GROUP BY bk.id ORDER BY bo.team_name, bk.position`
      )
      .all<{ board_name: string; bucket_name: string; count: number }>(),
    db
      .prepare(
        `SELECT bo.team_name AS board_name, COALESCE(t.module, 'unassigned') AS module, COUNT(*) AS count
         FROM tasks t
         JOIN boards bo ON bo.id = t.board_id
         WHERE t.archived_at IS NULL
         GROUP BY bo.id, t.module ORDER BY bo.team_name, count DESC`
      )
      .all<{ board_name: string; module: string; count: number }>(),
  ]);
  return {
    board_count: boards?.n ?? 0,
    active_manager_count: managers?.n ?? 0,
    tasks_by_bucket: tasksByBucket.results,
    tasks_by_module: tasksByModule.results,
  };
}
