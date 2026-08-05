/**
 * Vault HTTP routes — list/get/import. Does not call NovelAI.
 */
import { Hono } from "hono";
import type { AppDatabase } from "../../db/client.js";
import type { DataPaths } from "../../platform/files.js";
import { requireAppToken } from "../../middleware/auth.js";
import type { AppVariables } from "../../types.js";
import {
  getVaultImage,
  listVaultImages,
  readVaultImageBytes,
  saveVaultImage,
} from "./store.js";

export type VaultDeps = {
  db: AppDatabase;
  paths: DataPaths;
};

export function vaultRoutes(deps: VaultDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  app.use("*", requireAppToken());

  app.get("/images", (c) => {
    return c.json({ images: listVaultImages(deps.db) });
  });

  app.get("/images/:id", (c) => {
    const img = getVaultImage(deps.db, c.req.param("id"));
    if (!img) {
      return c.json(
        { error: { code: "not_found", message: "Vault image not found" } },
        404,
      );
    }
    return c.json(img);
  });

  app.get("/images/:id/file", (c) => {
    const img = getVaultImage(deps.db, c.req.param("id"));
    if (!img) {
      return c.json(
        { error: { code: "not_found", message: "Vault image not found" } },
        404,
      );
    }
    const bytes = readVaultImageBytes(deps.paths, img.relativePath);
    if (!bytes) {
      return c.json(
        { error: { code: "not_found", message: "Vault file missing on disk" } },
        404,
      );
    }
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

  /**
   * Human import of an existing PNG (e.g. downloaded from NovelAI UI).
   * Body: JSON { pngBase64, prompt?, negativePrompt?, seed?, model? }
   */
  app.post("/images/import", async (c) => {
    let json: unknown;
    try {
      json = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "bad_request", message: "Invalid JSON body" } },
        400,
      );
    }
    const body = json as {
      pngBase64?: string;
      prompt?: string;
      negativePrompt?: string;
      seed?: string;
      model?: string;
    };
    if (!body.pngBase64 || typeof body.pngBase64 !== "string") {
      return c.json(
        {
          error: {
            code: "validation_error",
            message: "pngBase64 is required",
          },
        },
        400,
      );
    }
    let pngBytes: Buffer;
    try {
      const b64 = body.pngBase64.replace(/^data:image\/png;base64,/, "");
      pngBytes = Buffer.from(b64, "base64");
    } catch {
      return c.json(
        { error: { code: "validation_error", message: "Invalid base64 PNG" } },
        400,
      );
    }
    if (pngBytes.length < 8) {
      return c.json(
        { error: { code: "validation_error", message: "PNG too small" } },
        400,
      );
    }

    const record = saveVaultImage(deps.db, deps.paths, {
      pngBytes,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      seed: body.seed,
      model: body.model,
      source: "import",
    });
    return c.json(record, 201);
  });

  return app;
}
