/**
 * Human-initiated NovelAI image generate proxy.
 * HARD RULE: only via this explicit request handler — no queues, timers, or batch n>1.
 */
import { Hono } from "hono";
import { naiGenerateRequestSchema } from "@aigen-studio/shared";
import type { AppDatabase } from "../../db/client.js";
import type { DataPaths } from "../../platform/files.js";
import { requireAppToken } from "../../middleware/auth.js";
import type { AppVariables } from "../../types.js";
import { saveVaultImage } from "../vault/store.js";
import {
  NovelAIRequestError,
  type NovelAIImageClient,
} from "./client.js";

export type NaiImageDeps = {
  db: AppDatabase;
  paths: DataPaths;
  /** null when no API key and no injectable client */
  client: NovelAIImageClient | null;
};

export function naiImageRoutes(
  deps: NaiImageDeps,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireAppToken());

  app.post("/generate", async (c) => {
    if (!deps.client) {
      return c.json(
        {
          error: {
            code: "novelai_not_configured",
            message:
              "NovelAI API key not configured (set AIGEN_NOVELAI_API_KEY). Other features still work.",
          },
        },
        503,
      );
    }

    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        400,
      );
    }

    const parsed = naiGenerateRequestSchema.safeParse(json);
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

    const req = parsed.data;
    // Explicit single-image only — refuse batch even if someone bypasses schema
    if (req.n !== undefined && req.n !== 1) {
      return c.json(
        {
          error: {
            code: "batch_forbidden",
            message:
              "Only a single human-initiated image is allowed per request (n must be 1)",
          },
        },
        400,
      );
    }

    try {
      const result = await deps.client.generateImage({
        prompt: req.prompt,
        negativePrompt: req.negativePrompt,
        seed: req.seed,
        width: req.width,
        height: req.height,
        steps: req.steps,
        scale: req.scale,
        model: req.model,
        n: 1,
      });

      const record = saveVaultImage(deps.db, deps.paths, {
        pngBytes: result.pngBytes,
        prompt: req.prompt,
        negativePrompt: req.negativePrompt ?? "",
        seed: req.seed != null ? String(req.seed) : "",
        model: req.model ?? "",
        source: "generate",
      });

      return c.json({ image: record }, 201);
    } catch (err) {
      if (err instanceof NovelAIRequestError) {
        return c.json(
          { error: { code: "novelai_error", message: err.message } },
          err.status >= 400 && err.status < 600 ? err.status : 502,
        );
      }
      throw err;
    }
  });

  return app;
}
