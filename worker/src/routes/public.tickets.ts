import { Hono } from "hono";
import type { AppEnv } from "../env";
import { createTicketSchema, emailAllowed } from "../lib/schemas";
import { boardJson, createTicket, getBoardBySlug, listBoardModules } from "../db/queries";

// Ticket intake is open (no auth) and does not require board.is_public: the slug is the only key.
const app = new Hono<AppEnv>();

app.get("/:slug", async (c) => {
  const board = await getBoardBySlug(c.env.DB, c.req.param("slug"));
  if (!board) return c.json({ error: "board not found" }, 404);
  return c.json({ team_name: board.team_name, modules: await listBoardModules(c.env.DB, board.id) });
});

const TICKET_RATE_LIMIT = 10; // per window, per slug+IP
const TICKET_RATE_WINDOW_SECONDS = 600;

// ponytail: single KV counter, not atomic under concurrent hits — good enough to blunt casual spam/enumeration;
// move to a Durable Object if real abuse shows up.
async function isRateLimited(kv: KVNamespace, slug: string, ip: string): Promise<boolean> {
  const key = `ratelimit:ticket:${slug}:${ip}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= TICKET_RATE_LIMIT) return true;
  await kv.put(key, String(current + 1), { expirationTtl: TICKET_RATE_WINDOW_SECONDS });
  return false;
}

app.post("/:slug", async (c) => {
  const board = await getBoardBySlug(c.env.DB, c.req.param("slug"));
  if (!board) return c.json({ error: "board not found" }, 404);

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  if (await isRateLimited(c.env.KV, c.req.param("slug"), ip)) {
    return c.json({ error: "terlalu banyak permintaan, coba lagi nanti" }, 429);
  }

  const parsed = createTicketSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (!emailAllowed(parsed.data.email, boardJson(board).allowed_emails)) {
    return c.json({ error: "email ini tidak diizinkan mengirim tiket ke board ini" }, 403);
  }
  const ticket = await createTicket(c.env.DB, board.id, parsed.data);
  return c.json({ ticket }, 201);
});

export default app;
