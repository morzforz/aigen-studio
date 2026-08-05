/**
 * Dummy notes CRUD — M1 persistence smoke path (not product lore).
 */
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { noteCreateSchema } from "@aigen-studio/shared";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../../db/client.js";
import { notes } from "../../db/schema.js";
import { requireAppToken } from "../../middleware/auth.js";
import type { AppVariables } from "../../types.js";

export type NotesDeps = {
  db: AppDatabase;
};

export function notesRoutes(deps: NotesDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireAppToken());

  app.get("/", (c) => {
    const rows = deps.db.select().from(notes).all();
    return c.json({
      notes: rows.map(rowToApi),
    });
  });

  app.post("/", async (c) => {
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        400,
      );
    }

    const parsed = noteCreateSchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "validation_error",
            message: parsed.error.issues.map((i) => i.message).join("; "),
          },
        },
        400,
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const row = {
      id,
      title: parsed.data.title,
      body: parsed.data.body ?? "",
      createdAt: now,
      updatedAt: now,
    };
    deps.db.insert(notes).values(row).run();

    return c.json(rowToApi(row), 201);
  });

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    const row = deps.db.select().from(notes).where(eq(notes.id, id)).get();
    if (!row) {
      return c.json(
        { error: { code: "not_found", message: `Note ${id} not found` } },
        404,
      );
    }
    return c.json(rowToApi(row));
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    const existing = deps.db.select().from(notes).where(eq(notes.id, id)).get();
    if (!existing) {
      return c.json(
        { error: { code: "not_found", message: `Note ${id} not found` } },
        404,
      );
    }
    deps.db.delete(notes).where(eq(notes.id, id)).run();
    return c.body(null, 204);
  });

  return app;
}

function rowToApi(row: {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
