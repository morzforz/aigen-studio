/**
 * Story scaffolding HTTP routes (M3) — compose only; no NovelAI image jobs.
 */
import { inArray } from "drizzle-orm";
import { Hono } from "hono";
import { scaffoldingComposeRequestSchema } from "@aigen-studio/shared";
import type { AppDatabase } from "../../db/client.js";
import { characters, settings } from "../../db/schema.js";
import { requireAppToken } from "../../middleware/auth.js";
import type { AppVariables } from "../../types.js";
import { composeFromLore } from "./compose.js";

export type ScaffoldingDeps = {
  db: AppDatabase;
};

export function scaffoldingRoutes(
  deps: ScaffoldingDeps,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireAppToken());

  app.post("/compose", async (c) => {
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        400,
      );
    }

    const parsed = scaffoldingComposeRequestSchema.safeParse(json);
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

    const { characterIds, settingIds, storyTitle } = parsed.data;

    const charRows =
      characterIds.length > 0
        ? deps.db
            .select()
            .from(characters)
            .where(inArray(characters.id, characterIds))
            .all()
        : [];

    const settingRows =
      settingIds.length > 0
        ? deps.db
            .select()
            .from(settings)
            .where(inArray(settings.id, settingIds))
            .all()
        : [];

    const foundCharIds = new Set(charRows.map((r) => r.id));
    const missingChars = characterIds.filter((id) => !foundCharIds.has(id));
    const foundSettingIds = new Set(settingRows.map((r) => r.id));
    const missingSettings = settingIds.filter((id) => !foundSettingIds.has(id));

    if (missingChars.length || missingSettings.length) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: [
              missingChars.length
                ? `Unknown character ids: ${missingChars.join(", ")}`
                : "",
              missingSettings.length
                ? `Unknown setting ids: ${missingSettings.join(", ")}`
                : "",
            ]
              .filter(Boolean)
              .join("; "),
          },
        },
        404,
      );
    }

    // Preserve request order
    const orderedChars = characterIds.map(
      (id) => charRows.find((r) => r.id === id)!,
    );
    const orderedSettings = settingIds.map(
      (id) => settingRows.find((r) => r.id === id)!,
    );

    const result = composeFromLore({
      characters: orderedChars,
      settings: orderedSettings,
      storyTitle,
    });

    return c.json(result);
  });

  return app;
}
