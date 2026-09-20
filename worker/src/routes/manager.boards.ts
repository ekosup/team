import { Hono } from "hono";
import type { AppEnv } from "../env";
import {
  createBucketSchema,
  patchBucketSchema,
  reorderBucketsSchema,
  createTaskSchema,
  patchTaskSchema,
  reorderTasksSchema,
  patchBoardSettingsSchema,
  ticketListQuerySchema,
} from "../lib/schemas";
import {
  boardJson,
  patchBoardSettings,
  listTickets,
  getTicketById,
  resolveTicket,
  listBoardsByManagerId,
  getBoardById,
  getBoardWithContent,
  isManagerOnBoard,
  createBucket,
  nextBucketPosition,
  patchBucket,
  deleteBucket,
  countTasksInBucket,
  reorderBuckets,
  getBucketById,
  createTask,
  nextTaskPosition,
  patchTask,
  deleteTask,
  getTaskById,
  reorderTasks,
  setTaskArchived,
  acceptTicket,
} from "../db/queries";

const app = new Hono<AppEnv>();

async function requireBoardAccess(c: { env: AppEnv["Bindings"]; get: (k: "managerId") => string }, boardId: string) {
  const board = await getBoardById(c.env.DB, boardId);
  if (!board) return null;
  const allowed = await isManagerOnBoard(c.env.DB, boardId, c.get("managerId"));
  return allowed ? board : null;
}

app.get("/boards", async (c) => {
  const boards = await listBoardsByManagerId(c.env.DB, c.get("managerId"));
  return c.json({ boards });
});

app.get("/boards/:boardId", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  return c.json({ board: await getBoardWithContent(c.env.DB, board) });
});

app.patch("/boards/:boardId", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = patchBoardSettingsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await patchBoardSettings(c.env.DB, board.id, parsed.data);
  return c.json({ board: boardJson((await getBoardById(c.env.DB, board.id))!) });
});

// ---- tickets ----

app.get("/boards/:boardId/tickets", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = ticketListQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { status, page = 1, limit = 20 } = parsed.data;
  const { tickets, total } = await listTickets(c.env.DB, board.id, {
    status: status === "all" ? undefined : status,
    page,
    limit,
  });
  return c.json({ tickets, total, page, limit });
});

/** Accept: ticket becomes a task in the leftmost bucket; the requester's email is kept in the description. */
app.post("/boards/:boardId/tickets/:id/accept", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const ticket = await getTicketById(c.env.DB, c.req.param("id"));
  if (!ticket || ticket.board_id !== board.id) return c.json({ error: "not found" }, 404);
  if (ticket.status !== "open") return c.json({ error: "ticket already resolved" }, 409);

  const { buckets } = await getBoardWithContent(c.env.DB, board);
  const bucket = buckets[0];
  if (!bucket) return c.json({ error: "board has no columns yet" }, 409);

  const taskId = await acceptTicket(c.env.DB, ticket.id, {
    board_id: board.id,
    bucket_id: bucket.id,
    title: ticket.title,
    description: [`Tiket dari ${ticket.email}`, ticket.description].filter(Boolean).join("\n\n"),
    module: ticket.module ?? undefined,
    priority: ticket.priority,
    position: await nextTaskPosition(c.env.DB, bucket.id),
  });
  return c.json({ task: await getTaskById(c.env.DB, taskId), ticket: await getTicketById(c.env.DB, ticket.id) }, 201);
});

app.post("/boards/:boardId/tickets/:id/reject", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const ticket = await getTicketById(c.env.DB, c.req.param("id"));
  if (!ticket || ticket.board_id !== board.id) return c.json({ error: "not found" }, 404);
  if (ticket.status !== "open") return c.json({ error: "ticket already resolved" }, 409);

  await resolveTicket(c.env.DB, ticket.id, "rejected", null);
  return c.json({ ticket: await getTicketById(c.env.DB, ticket.id) });
});

app.post("/boards/:boardId/buckets", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = createBucketSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const position = parsed.data.position ?? (await nextBucketPosition(c.env.DB, board.id));
  const bucket = await createBucket(c.env.DB, board.id, parsed.data.name, position);
  return c.json({ bucket }, 201);
});

// must be registered before /buckets/:id so "order" is not treated as an id
app.patch("/boards/:boardId/buckets/order", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = reorderBucketsSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await reorderBuckets(c.env.DB, board.id, parsed.data.ids);
  return c.json({ ok: true });
});

app.patch("/boards/:boardId/buckets/:id", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const bucket = await getBucketById(c.env.DB, c.req.param("id"));
  if (!bucket || bucket.board_id !== board.id) return c.json({ error: "not found" }, 404);

  const parsed = patchBucketSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await patchBucket(c.env.DB, bucket.id, parsed.data);
  return c.json({ bucket: await getBucketById(c.env.DB, bucket.id) });
});

app.delete("/boards/:boardId/buckets/:id", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const bucket = await getBucketById(c.env.DB, c.req.param("id"));
  if (!bucket || bucket.board_id !== board.id) return c.json({ error: "not found" }, 404);

  const taskCount = await countTasksInBucket(c.env.DB, bucket.id);
  if (taskCount > 0) return c.json({ error: "bucket has tasks; move or delete them first" }, 409);

  await deleteBucket(c.env.DB, bucket.id);
  return c.json({ ok: true });
});

// must be registered before /tasks/:id so "order" is not treated as an id
app.patch("/boards/:boardId/tasks/order", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = reorderTasksSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const bucket = await getBucketById(c.env.DB, parsed.data.bucket_id);
  if (!bucket || bucket.board_id !== board.id) return c.json({ error: "bucket not found" }, 404);

  await reorderTasks(c.env.DB, board.id, bucket.id, parsed.data.ids);
  return c.json({ ok: true });
});

app.post("/boards/:boardId/tasks", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const parsed = createTaskSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const bucket = await getBucketById(c.env.DB, parsed.data.bucket_id);
  if (!bucket || bucket.board_id !== board.id) return c.json({ error: "bucket not found" }, 404);

  const position = parsed.data.position ?? (await nextTaskPosition(c.env.DB, bucket.id));
  const task = await createTask(c.env.DB, board.id, { ...parsed.data, position });
  return c.json({ task }, 201);
});

app.patch("/boards/:boardId/tasks/:id", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const task = await getTaskById(c.env.DB, c.req.param("id"));
  if (!task || task.board_id !== board.id) return c.json({ error: "not found" }, 404);

  const parsed = patchTaskSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (parsed.data.bucket_id) {
    const bucket = await getBucketById(c.env.DB, parsed.data.bucket_id);
    if (!bucket || bucket.board_id !== board.id) return c.json({ error: "bucket not found" }, 404);
  }

  await patchTask(c.env.DB, task.id, parsed.data);
  return c.json({ task: await getTaskById(c.env.DB, task.id) });
});

/** Archive is reversible; delete is not. A task must be archived first so deleting it is never an accident. */
app.post("/boards/:boardId/tasks/:id/archive", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const task = await getTaskById(c.env.DB, c.req.param("id"));
  if (!task || task.board_id !== board.id) return c.json({ error: "not found" }, 404);
  if (task.archived_at) return c.json({ error: "task already archived" }, 409);

  await setTaskArchived(c.env.DB, task.id, true);
  return c.json({ task: await getTaskById(c.env.DB, task.id) });
});

app.post("/boards/:boardId/tasks/:id/unarchive", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const task = await getTaskById(c.env.DB, c.req.param("id"));
  if (!task || task.board_id !== board.id) return c.json({ error: "not found" }, 404);
  if (!task.archived_at) return c.json({ error: "task is not archived" }, 409);

  await setTaskArchived(c.env.DB, task.id, false);
  return c.json({ task: await getTaskById(c.env.DB, task.id) });
});

app.delete("/boards/:boardId/tasks/:id", async (c) => {
  const board = await requireBoardAccess(c, c.req.param("boardId"));
  if (!board) return c.json({ error: "not found" }, 404);
  const task = await getTaskById(c.env.DB, c.req.param("id"));
  if (!task || task.board_id !== board.id) return c.json({ error: "not found" }, 404);
  if (!task.archived_at) return c.json({ error: "arsipkan task ini dulu sebelum menghapus" }, 409);

  await deleteTask(c.env.DB, task.id);
  return c.json({ ok: true });
});

export default app;
