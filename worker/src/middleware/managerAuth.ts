import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../env";
import { hashAccessKey } from "../lib/crypto";
import { getManagerByKeyHash } from "../db/queries";

export const managerAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new HTTPException(401, { message: "Missing access key" });

  const hash = await hashAccessKey(token);
  const manager = await getManagerByKeyHash(c.env.DB, hash);
  if (!manager) throw new HTTPException(401, { message: "Invalid or revoked access key" });

  c.set("managerId", manager.id);
  await next();
});
