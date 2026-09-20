import { bearerAuth } from "hono/bearer-auth";
import { timingSafeEqual } from "hono/utils/buffer";
import type { Context } from "hono";
import type { AppEnv } from "../env";

export const adminAuth = bearerAuth({
  verifyToken: async (token: string, c: Context<AppEnv>) => timingSafeEqual(token, c.env.ADMIN_API_KEY),
});
