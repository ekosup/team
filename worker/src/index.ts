import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./env";
import { adminAuth } from "./middleware/adminAuth";
import { managerAuth } from "./middleware/managerAuth";
import adminManagers from "./routes/admin.managers";
import adminBoards, { statsApp } from "./routes/admin.boards";
import managerBoards from "./routes/manager.boards";
import publicBoards from "./routes/public.boards";
import publicTickets from "./routes/public.tickets";

const app = new Hono<AppEnv>();

app.use("/api/*", secureHeaders());

const SCHEMA = {
  admin: {
    auth: "Authorization: Bearer <ADMIN_API_KEY>",
    endpoints: [
      { method: "GET", path: "/api/admin/managers" },
      { method: "POST", path: "/api/admin/managers", body: { name: "string" }, returns: "manager + one-time access_key" },
      { method: "PATCH", path: "/api/admin/managers/:id/revoke" },
      { method: "POST", path: "/api/admin/managers/:id/rotate", returns: "new one-time access_key" },
      { method: "GET", path: "/api/admin/boards", returns: "boards with nested managers[]" },
      { method: "POST", path: "/api/admin/boards", body: { team_name: "string", manager_ids: "string[] (min 1)" } },
      {
        method: "PATCH",
        path: "/api/admin/boards/:id",
        body: {
          team_name: "string?",
          is_public: "boolean?",
          status: "'development'|'staging'|'production'|'maintenance'|'retired'?",
          manager_ids: "string[] (min 1)? — full replace",
        },
      },
      { method: "DELETE", path: "/api/admin/boards/:id" },
      {
        method: "GET",
        path: "/api/admin/stats",
        returns: "board/manager counts + tasks_by_bucket and tasks_by_module, each row tagged with board_name (archived tasks excluded)",
      },
    ],
  },
  manager: {
    auth: "Authorization: Bearer <manager access_key>",
    note: "a manager may be assigned to multiple boards; a board may have multiple managers",
    endpoints: [
      { method: "GET", path: "/api/manager/boards", returns: "board summaries this manager is assigned to" },
      {
        method: "GET",
        path: "/api/manager/boards/:boardId",
        returns: "board with buckets + tasks + allowed_emails[] + assignees[] + modules[] + status",
      },
      {
        method: "PATCH",
        path: "/api/manager/boards/:boardId",
        body: {
          allowed_emails: "string[]? — exact emails or '*@domain'; full replace; empty = nobody can send tickets",
          assignees: "string[]? — PIC names offered in the task dropdown; full replace",
          modules: "{name, description}[]? — curated modules for the App > Module project view; full replace",
          status: "'development'|'staging'|'production'|'maintenance'|'retired'? — project listing status",
        },
      },
      {
        method: "GET",
        path: "/api/manager/boards/:boardId/tickets",
        query: { status: "'open'|'accepted'|'rejected'|'all'? (default all)", page: "number? (default 1)", limit: "number? (default 20, max 100)" },
        returns: "{ tickets, total, page, limit } — open first, then newest",
      },
      {
        method: "POST",
        path: "/api/manager/boards/:boardId/tickets/:id/accept",
        note: "creates a task in the leftmost bucket; 409 if already resolved or board has no buckets",
      },
      { method: "POST", path: "/api/manager/boards/:boardId/tickets/:id/reject" },
      { method: "POST", path: "/api/manager/boards/:boardId/buckets", body: { name: "string", position: "number?" } },
      {
        method: "PATCH",
        path: "/api/manager/boards/:boardId/buckets/:id",
        body: { name: "string?", position: "number?" },
      },
      {
        method: "PATCH",
        path: "/api/manager/boards/:boardId/buckets/order",
        body: { ids: "string[] — full bucket order, left to right" },
      },
      { method: "DELETE", path: "/api/manager/boards/:boardId/buckets/:id", note: "409 if bucket still has tasks" },
      {
        method: "POST",
        path: "/api/manager/boards/:boardId/tasks",
        body: {
          bucket_id: "string",
          title: "string",
          description: "string?",
          module: "string?",
          target: "string?",
          assignee: "string? (PIC)",
          priority: "'low' | 'normal' | 'high' (default normal)",
          blocked_reason: "string? — set when the task is stuck; null to clear",
          timeline_start: "YYYY-MM-DD?",
          timeline_end: "YYYY-MM-DD?",
          position: "number?",
        },
      },
      { method: "PATCH", path: "/api/manager/boards/:boardId/tasks/:id", body: "same fields as create, all optional" },
      {
        method: "PATCH",
        path: "/api/manager/boards/:boardId/tasks/order",
        body: { bucket_id: "string", ids: "string[] — tasks are moved into bucket_id in this order" },
      },
      { method: "POST", path: "/api/manager/boards/:boardId/tasks/:id/archive", note: "409 if already archived" },
      { method: "POST", path: "/api/manager/boards/:boardId/tasks/:id/unarchive", note: "409 if not archived" },
      {
        method: "DELETE",
        path: "/api/manager/boards/:boardId/tasks/:id",
        note: "409 unless the task is archived first — archive is the only path to delete",
      },
      {
        method: "GET",
        path: "/api/manager/boards/:boardId/docs",
        returns: "team knowledge repo entries (runbooks, notes, secrets); secret entries omit content — fetch by id to reveal",
      },
      { method: "GET", path: "/api/manager/boards/:boardId/docs/:id", returns: "doc with content decrypted if is_secret" },
      {
        method: "POST",
        path: "/api/manager/boards/:boardId/docs",
        body: { title: "string", content: "string", is_secret: "boolean? (default false)", position: "number?" },
        note: "is_secret content is AES-GCM encrypted at rest with the worker's DOCS_ENC_KEY",
      },
      { method: "PATCH", path: "/api/manager/boards/:boardId/docs/:id", body: "same fields as create, all optional" },
      { method: "PATCH", path: "/api/manager/boards/:boardId/docs/order", body: { ids: "string[] — full doc order" } },
      { method: "DELETE", path: "/api/manager/boards/:boardId/docs/:id" },
    ],
  },
  public: {
    auth: "none",
    endpoints: [
      { method: "GET", path: "/api/public/boards/:slug", note: "404 unless board.is_public" },
      { method: "GET", path: "/api/public/tickets/:slug", returns: "team_name + modules[] (works for private boards too)" },
      {
        method: "POST",
        path: "/api/public/tickets/:slug",
        body: {
          email: "string — must match board.allowed_emails",
          title: "string",
          description: "string?",
          module: "string?",
          priority: "'low' | 'normal' | 'high'?",
        },
        note: "403 when email is not allowed",
      },
    ],
  },
};

app.get("/api/admin/schema", (c) => c.json(SCHEMA));

app.use("/api/admin/*", adminAuth);
app.route("/api/admin/managers", adminManagers);
app.route("/api/admin/boards", adminBoards);
app.route("/api/admin/stats", statsApp);

app.use("/api/manager/*", managerAuth);
app.route("/api/manager", managerBoards);

app.route("/api/public/boards", publicBoards);
app.route("/api/public/tickets", publicTickets);

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

export default app;
