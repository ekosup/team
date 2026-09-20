import { Hono } from "hono";
import type { AppEnv } from "../env";
import { createBoardSchema, patchBoardSchema } from "../lib/schemas";
import { slugify } from "../lib/crypto";
import {
  createBoard,
  listBoards,
  getBoardById,
  getBoardManagers,
  patchBoard,
  setBoardManagers,
  deleteBoard,
  getManagerById,
  getStats,
} from "../db/queries";

const app = new Hono<AppEnv>();

async function validateManagerIds(db: D1Database, managerIds: string[]): Promise<string | null> {
  for (const id of managerIds) {
    if (!(await getManagerById(db, id))) return `manager not found: ${id}`;
  }
  return null;
}

app.get("/", async (c) => {
  const boards = await listBoards(c.env.DB);
  return c.json({ boards });
});

app.post("/", async (c) => {
  const parsed = createBoardSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const invalidError = await validateManagerIds(c.env.DB, parsed.data.manager_ids);
  if (invalidError) return c.json({ error: invalidError }, 404);

  const board = await createBoard(c.env.DB, parsed.data.team_name, parsed.data.manager_ids, slugify(parsed.data.team_name));
  return c.json({ board: { ...board, managers: await getBoardManagers(c.env.DB, board.id) } }, 201);
});

app.patch("/:id", async (c) => {
  const board = await getBoardById(c.env.DB, c.req.param("id"));
  if (!board) return c.json({ error: "not found" }, 404);

  const parsed = patchBoardSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (parsed.data.manager_ids) {
    const invalidError = await validateManagerIds(c.env.DB, parsed.data.manager_ids);
    if (invalidError) return c.json({ error: invalidError }, 404);
    await setBoardManagers(c.env.DB, board.id, parsed.data.manager_ids);
  }

  await patchBoard(c.env.DB, board.id, parsed.data);
  const updated = await getBoardById(c.env.DB, board.id);
  return c.json({ board: { ...updated, managers: await getBoardManagers(c.env.DB, board.id) } });
});

app.delete("/:id", async (c) => {
  const board = await getBoardById(c.env.DB, c.req.param("id"));
  if (!board) return c.json({ error: "not found" }, 404);
  await deleteBoard(c.env.DB, board.id);
  return c.json({ ok: true });
});

export const statsApp = new Hono<AppEnv>().get("/", async (c) => c.json(await getStats(c.env.DB)));

export default app;
