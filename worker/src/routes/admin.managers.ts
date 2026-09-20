import { Hono } from "hono";
import type { AppEnv } from "../env";
import { createManagerSchema } from "../lib/schemas";
import { generateAccessKey, hashAccessKey } from "../lib/crypto";
import { createManager, listManagers, revokeManager, rotateManagerKey, getManagerById } from "../db/queries";
import type { PublicManager } from "../db/types";

const app = new Hono<AppEnv>();

const toPublic = ({ access_key_hash, ...rest }: { access_key_hash: string } & PublicManager): PublicManager => rest;

app.get("/", async (c) => {
  const managers = await listManagers(c.env.DB);
  return c.json({ managers: managers.map(toPublic) });
});

app.post("/", async (c) => {
  const parsed = createManagerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const accessKey = generateAccessKey();
  const hash = await hashAccessKey(accessKey);
  const manager = await createManager(c.env.DB, parsed.data.name, hash);
  return c.json({ manager: toPublic(manager), access_key: accessKey }, 201);
});

app.patch("/:id/revoke", async (c) => {
  const manager = await getManagerById(c.env.DB, c.req.param("id"));
  if (!manager) return c.json({ error: "not found" }, 404);
  await revokeManager(c.env.DB, manager.id);
  return c.json({ ok: true });
});

app.post("/:id/rotate", async (c) => {
  const manager = await getManagerById(c.env.DB, c.req.param("id"));
  if (!manager) return c.json({ error: "not found" }, 404);
  if (manager.revoked_at) return c.json({ error: "manager is revoked; un-revoke before rotating" }, 409);
  const accessKey = generateAccessKey();
  const hash = await hashAccessKey(accessKey);
  await rotateManagerKey(c.env.DB, manager.id, hash);
  return c.json({ access_key: accessKey });
});

export default app;
