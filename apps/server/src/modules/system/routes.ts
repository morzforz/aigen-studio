/**
 * System health / ready routes (open, no auth).
 */
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppDatabase } from "../../db/client.js";
import type { DataPaths } from "../../platform/files.js";

export type SystemDeps = {
  paths: DataPaths;
  db: AppDatabase;
};

export function systemRoutes(deps: SystemDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok" as const,
      service: "aigen-studio" as const,
      time: new Date().toISOString(),
    });
  });

  app.get("/ready", (c) => {
    try {
      deps.db.run(sql`SELECT 1`);
      return c.json({ ready: true, dataDir: deps.paths.root });
    } catch {
      return c.json({ ready: false, dataDir: deps.paths.root }, 503);
    }
  });

  return app;
}
