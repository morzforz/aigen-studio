/**
 * Auth-lite: Bearer app token on non-health routes (ARCHITECTURE §5).
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { timingSafeEqual } from "node:crypto";

export type AuthVariables = {
  appToken: string;
};

function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function requireAppToken(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const expected = c.get("appToken") as string | undefined;
    if (!expected) {
      return c.json(
        { error: { code: "server_misconfigured", message: "App token not loaded" } },
        500,
      );
    }

    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Missing or invalid Authorization Bearer token",
          },
        },
        401,
      );
    }

    const provided = header.slice("Bearer ".length).trim();
    if (!provided || !tokensEqual(provided, expected)) {
      return c.json(
        { error: { code: "unauthorized", message: "Invalid app token" } },
        401,
      );
    }

    await next();
  };
}
