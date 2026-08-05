/**
 * M4 image path: vault, metadata extract, human-only generate with injectable NovelAI.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ApiPaths,
  healthResponseSchema,
  vaultImageSchema,
} from "@aigen-studio/shared";
import { createApp, type AppContext } from "./app.js";
import type { ServerConfig } from "./config.js";
import type { NovelAIImageClient } from "./modules/nai_image/client.js";
import {
  buildPngWithTextChunks,
  extractPngMetadata,
} from "./modules/vault/png_metadata.js";

function tempConfig(
  dataDir: string,
  token?: string,
  novelaiApiKey: string | null = null,
): ServerConfig {
  return {
    dataDir,
    host: "127.0.0.1",
    port: 0,
    appTokenOverride: token ?? "test-token-m4-image",
    novelaiApiKey,
    webOrigin: "http://127.0.0.1:5173",
    isProduction: false,
  };
}

describe("PNG metadata extract (shipped)", () => {
  it("recovers prompt/negative/seed from tEXt chunks on a real PNG fixture", () => {
    const png = buildPngWithTextChunks({
      prompt: "1girl, silver hair, coat",
      uc: "lowres, bad anatomy",
      seed: "424242",
      Comment: "extra comment",
    });
    expect(png.subarray(0, 4).toString("hex")).toBe("89504e47");
    const meta = extractPngMetadata(png);
    expect(meta.prompt).toContain("silver hair");
    expect(meta.negativePrompt).toContain("lowres");
    expect(meta.seed).toBe("424242");
    expect(meta.textChunks.prompt).toContain("silver hair");
  });

  it("parses A1111-style parameters blob", () => {
    const png = buildPngWithTextChunks({
      parameters:
        "masterpiece landscape\nNegative prompt: blurry, text\nSteps: 28, Sampler: Euler, Seed: 99",
    });
    const meta = extractPngMetadata(png);
    expect(meta.prompt).toContain("masterpiece landscape");
    expect(meta.negativePrompt).toContain("blurry");
    expect(meta.seed).toBe("99");
  });
});

describe("vault + generate path", () => {
  let ctx: AppContext | undefined;
  let dataDir: string | undefined;

  afterEach(() => {
    ctx?.close();
    ctx = undefined;
    if (dataDir && fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    dataDir = undefined;
  });

  function boot(opts?: {
    token?: string;
    novelAIClient?: NovelAIImageClient | null;
    novelaiApiKey?: string | null;
  }) {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m4-"));
    ctx = createApp({
      config: tempConfig(
        dataDir,
        opts?.token ?? "test-token-m4-image",
        opts?.novelaiApiKey ?? null,
      ),
      novelAIClient: opts?.novelAIClient,
    });
    return ctx;
  }

  async function api(
    method: string,
    urlPath: string,
    opts?: { token?: string | null; body?: unknown },
  ) {
    if (!ctx) throw new Error("not booted");
    const headers: Record<string, string> = {};
    if (opts?.token !== null) {
      headers.Authorization = `Bearer ${opts?.token ?? ctx.appToken}`;
    }
    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    return ctx.app.request(urlPath, {
      method,
      headers,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }

  it("boots and health works without NovelAI key", async () => {
    const c = boot();
    expect(c.config.novelaiApiKey).toBeNull();
    const res = await api("GET", ApiPaths.health, { token: null });
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json()).status).toBe("ok");
  });

  it("generate fails closed without key / client (503)", async () => {
    boot({ novelAIClient: null });
    const res = await api("POST", ApiPaths.naiImageGenerate, {
      body: { prompt: "test", n: 1 },
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("novelai_not_configured");
  });

  it("import saves PNG to vault with extracted metadata via real store path", async () => {
    boot();
    const png = buildPngWithTextChunks({
      prompt: "imported cat sitting",
      uc: "dog",
      seed: "7",
    });
    const res = await api("POST", ApiPaths.vaultImageImport, {
      body: {
        pngBase64: png.toString("base64"),
      },
    });
    expect(res.status).toBe(201);
    const img = vaultImageSchema.parse(await res.json());
    expect(img.prompt).toContain("imported cat");
    expect(img.negativePrompt).toContain("dog");
    expect(img.seed).toBe("7");
    expect(img.source).toBe("import");
    expect(img.byteSize).toBeGreaterThan(0);

    const abs = path.join(ctx!.paths.root, img.relativePath);
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs).subarray(0, 4).toString("hex")).toBe("89504e47");

    const list = await api("GET", ApiPaths.vaultImages);
    expect(list.status).toBe(200);
    const images = vaultImageSchema
      .array()
      .parse((await list.json() as { images: unknown[] }).images);
    expect(images.some((i) => i.id === img.id)).toBe(true);

    const fileRes = await api("GET", ApiPaths.vaultImageFile(img.id));
    expect(fileRes.status).toBe(200);
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    expect(fileBuf.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("generate with injectable client auto-saves via real vault path", async () => {
    const fakePng = buildPngWithTextChunks({
      prompt: "from-meta-should-not-override-request",
      seed: "1",
    });
    let calls = 0;
    const fakeClient: NovelAIImageClient = {
      async generateImage(params) {
        calls += 1;
        expect(params.prompt).toBe("studio prompt for generate");
        expect(params.n).toBe(1);
        return { pngBytes: fakePng };
      },
    };
    boot({ novelAIClient: fakeClient });

    const res = await api("POST", ApiPaths.naiImageGenerate, {
      body: {
        prompt: "studio prompt for generate",
        negativePrompt: "bad hands",
        seed: 12345,
        n: 1,
      },
    });
    expect(res.status).toBe(201);
    expect(calls).toBe(1);
    const body = (await res.json()) as { image: unknown };
    const img = vaultImageSchema.parse(body.image);
    expect(img.prompt).toBe("studio prompt for generate");
    expect(img.negativePrompt).toBe("bad hands");
    expect(img.seed).toBe("12345");
    expect(img.source).toBe("generate");
    const abs = path.join(ctx!.paths.root, img.relativePath);
    expect(fs.existsSync(abs)).toBe(true);
  });

  it("rejects batch n !== 1", async () => {
    const fakeClient: NovelAIImageClient = {
      async generateImage() {
        throw new Error("should not be called for batch");
      },
    };
    boot({ novelAIClient: fakeClient });
    const res = await api("POST", ApiPaths.naiImageGenerate, {
      body: { prompt: "x", n: 2 },
    });
    // Zod rejects non-literal 1
    expect(res.status).toBe(400);
  });

  it("vault requires auth", async () => {
    boot();
    const res = await api("GET", ApiPaths.vaultImages, { token: null });
    expect(res.status).toBe(401);
  });

  it("persists vault images across createApp reopen", async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m4-persist-"));
    const token = "persist-m4";
    const png = buildPngWithTextChunks({ prompt: "persist me", seed: "9" });
    const first = createApp({
      config: tempConfig(dataDir, token),
      novelAIClient: null,
    });
    const createRes = await first.app.request(ApiPaths.vaultImageImport, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pngBase64: png.toString("base64") }),
    });
    expect(createRes.status).toBe(201);
    const created = vaultImageSchema.parse(await createRes.json());
    first.close();

    ctx = createApp({ config: tempConfig(dataDir, token), novelAIClient: null });
    const getRes = await ctx.app.request(ApiPaths.vaultImage(created.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const got = vaultImageSchema.parse(await getRes.json());
    expect(got.prompt).toContain("persist me");
    expect(got.id).toBe(created.id);
  });
});

describe("human-only generate surface", () => {
  it("source tree has no setInterval/cron calling generate", () => {
    const root = path.resolve(__dirname);
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === "node_modules" || ent.name.endsWith(".test.ts")) continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith(".ts")) {
          const text = fs.readFileSync(p, "utf8");
          if (
            /setInterval\s*\(/.test(text) &&
            /generate/i.test(text) &&
            /novelai|nai/i.test(text)
          ) {
            offenders.push(p);
          }
          if (/node-cron|cron\.schedule/i.test(text)) {
            offenders.push(p);
          }
        }
      }
    }
    walk(root);
    expect(offenders).toEqual([]);
  });
});
