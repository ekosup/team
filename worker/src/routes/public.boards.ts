import { Hono } from "hono";
import type { AppEnv } from "../env";
import { getBoardBySlug, getBoardWithContent } from "../db/queries";

const app = new Hono<AppEnv>();

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** A ticket's requester email gets embedded into the accepted task's description; scrub it before it reaches a public, unauthenticated board view. */
function redactEmails<T extends { description: string | null }>(task: T): T {
  return task.description ? { ...task, description: task.description.replace(EMAIL_RE, "[email disembunyikan]") } : task;
}

app.get("/:slug", async (c) => {
  const board = await getBoardBySlug(c.env.DB, c.req.param("slug"));
  if (!board || !board.is_public) return c.json({ error: "board not found" }, 404);
  // the allow-list itself stays private; guests only learn whether the ticket form is open
  const { allowed_emails, tasks, ...rest } = await getBoardWithContent(c.env.DB, board);
  return c.json({
    board: { ...rest, tasks: tasks.map(redactEmails), allowed_emails: [], tickets_enabled: allowed_emails.length > 0 },
  });
});

export default app;
