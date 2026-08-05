/**
 * Character lore CRUD + basic search (M2).
 */
import { eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { characterWriteSchema } from "@aigen-studio/shared";
import { randomUUID } from "node:crypto";
import type { AppDatabase } from "../../db/client.js";
import { characters } from "../../db/schema.js";
import { requireAppToken } from "../../middleware/auth.js";
import type { AppVariables } from "../../types.js";

export type CharactersDeps = {
  db: AppDatabase;
};

export function charactersRoutes(
  deps: CharactersDeps,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireAppToken());

  app.get("/", (c) => {
    const q = (c.req.query("q") ?? "").trim();
    let rows;
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      rows = deps.db
        .select()
        .from(characters)
        .where(
          or(
            like(characters.name, pattern),
            like(characters.bio, pattern),
            like(characters.personality, pattern),
            like(characters.voiceStyle, pattern),
            like(characters.notes, pattern),
            like(characters.relationships, pattern),
            like(characters.tags, pattern),
          ),
        )
        .all();
    } else {
      rows = deps.db.select().from(characters).all();
    }
    // Stable name order for list UX
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return c.json({ characters: rows.map(rowToApi) });
  });

  app.post("/", async (c) => {
    const parsed = await parseWriteBody(c);
    if ("error" in parsed) return parsed.error;

    const now = new Date().toISOString();
    const id = randomUUID();
    const row = {
      id,
      ...defaultsFromWrite(parsed.data),
      createdAt: now,
      updatedAt: now,
    };
    deps.db.insert(characters).values(row).run();
    return c.json(rowToApi(row), 201);
  });

  app.get("/:id", (c) => {
    const id = c.req.param("id");
    const row = deps.db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!row) {
      return c.json(
        { error: { code: "not_found", message: `Character ${id} not found` } },
        404,
      );
    }
    return c.json(rowToApi(row));
  });

  app.put("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = deps.db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!existing) {
      return c.json(
        { error: { code: "not_found", message: `Character ${id} not found` } },
        404,
      );
    }

    const parsed = await parseWriteBody(c);
    if ("error" in parsed) return parsed.error;

    const now = new Date().toISOString();
    const updated = {
      ...defaultsFromWrite(parsed.data),
      updatedAt: now,
    };
    deps.db
      .update(characters)
      .set(updated)
      .where(eq(characters.id, id))
      .run();

    return c.json(
      rowToApi({
        id,
        ...updated,
        createdAt: existing.createdAt,
      }),
    );
  });

  app.delete("/:id", (c) => {
    const id = c.req.param("id");
    const existing = deps.db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .get();
    if (!existing) {
      return c.json(
        { error: { code: "not_found", message: `Character ${id} not found` } },
        404,
      );
    }
    deps.db.delete(characters).where(eq(characters.id, id)).run();
    return c.body(null, 204);
  });

  return app;
}

function escapeLike(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

async function parseWriteBody(c: {
  req: { json: () => Promise<unknown> };
}): Promise<
  | { data: ReturnType<typeof characterWriteSchema.parse> }
  | { error: Response }
> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return {
      error: Response.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        { status: 400 },
      ),
    };
  }
  const parsed = characterWriteSchema.safeParse(json);
  if (!parsed.success) {
    return {
      error: Response.json(
        {
          error: {
            code: "validation_error",
            message: parsed.error.issues.map((i) => i.message).join("; "),
          },
        },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data };
}

function defaultsFromWrite(
  data: ReturnType<typeof characterWriteSchema.parse>,
) {
  return {
    name: data.name,
    bio: data.bio ?? "",
    personality: data.personality ?? "",
    voiceStyle: data.voiceStyle ?? "",
    notes: data.notes ?? "",
    relationships: data.relationships ?? "",
    tags: data.tags ?? "",
    ucNegatives: data.ucNegatives ?? "",
    refImagePath: data.refImagePath ?? "",
  };
}

function rowToApi(row: {
  id: string;
  name: string;
  bio: string;
  personality: string;
  voiceStyle: string;
  notes: string;
  relationships: string;
  tags: string;
  ucNegatives: string;
  refImagePath: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    personality: row.personality,
    voiceStyle: row.voiceStyle,
    notes: row.notes,
    relationships: row.relationships,
    tags: row.tags,
    ucNegatives: row.ucNegatives,
    refImagePath: row.refImagePath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

