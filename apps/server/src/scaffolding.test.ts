/**
 * M3 story scaffolding: seed lore via real M2 API, compose via shipped handlers.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ApiPaths,
  characterSchema,
  scaffoldingComposeResultSchema,
  settingSchema,
} from "@aigen-studio/shared";
import { createApp, type AppContext } from "./app.js";
import type { ServerConfig } from "./config.js";
import { composeFromLore } from "./modules/scaffolding/compose.js";

function tempConfig(dataDir: string, token?: string): ServerConfig {
  return {
    dataDir,
    host: "127.0.0.1",
    port: 0,
    appTokenOverride: token ?? "test-token-m3-scaffold",
    novelaiApiKey: null,
    webOrigin: "http://127.0.0.1:5173",
    isProduction: false,
  };
}

describe("story scaffolding compose", () => {
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

  function boot(token = "test-token-m3-scaffold") {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m3-"));
    ctx = createApp({ config: tempConfig(dataDir, token) });
    return ctx;
  }

  async function api(
    method: string,
    urlPath: string,
    opts?: { token?: string | null; body?: unknown },
  ) {
    if (!ctx) throw new Error("app not booted");
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

  it("pure compose embeds lore prose into memory, lorebook, and systemPrompt", () => {
    const out = composeFromLore({
      characters: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Aria Vale",
          bio: "Maps dream-coasts",
          personality: "Quietly stubborn",
          voiceStyle: "Measured",
          notes: "Arc notes",
          relationships: "Mentor to Kai",
          tags: "silver hair",
          ucNegatives: "",
          refImagePath: "",
        },
      ],
      settings: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Glass Coast",
          description: "Fused sand and tide-runes",
          atmosphere: "Salt wind",
          notes: "Act one",
          tags: "",
          ucNegatives: "",
          refImagePath: "",
        },
      ],
      storyTitle: "Meridian Draft",
      composedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(out.memory).toContain("Aria Vale");
    expect(out.memory).toContain("Maps dream-coasts");
    expect(out.memory).toContain("Glass Coast");
    expect(out.memory).toContain("tide-runes");
    expect(out.systemPrompt).toContain("Meridian Draft");
    expect(out.systemPrompt).toContain("Quietly stubborn");
    expect(out.systemPrompt).toContain("Salt wind");
    expect(out.lorebook).toHaveLength(2);
    expect(out.lorebook[0]!.keys).toBe("Aria Vale");
    expect(out.lorebook[0]!.text).toContain("Maps dream-coasts");
    expect(out.lorebook[1]!.keys).toBe("Glass Coast");
    expect(out.plainText).toContain("## Memory");
    expect(out.plainText).toContain("## Lorebook");
    expect(out.plainText).toContain("## System prompt");
  });

  it("compose API requires auth and at least one id", async () => {
    boot();
    const unauth = await api("POST", ApiPaths.scaffoldingCompose, {
      token: null,
      body: { characterIds: [] },
    });
    expect(unauth.status).toBe(401);

    const empty = await api("POST", ApiPaths.scaffoldingCompose, {
      body: { characterIds: [], settingIds: [] },
    });
    expect(empty.status).toBe(400);
  });

  it("compose API seeds real lore then returns drafts reflecting prose fields", async () => {
    boot();
    expect(ctx!.config.novelaiApiKey).toBeNull();

    const charRes = await api("POST", ApiPaths.characters, {
      body: {
        name: "Kai Drift",
        bio: "Sailor of glass seas",
        personality: "Impulsive but loyal",
        voiceStyle: "Short sentences",
        notes: "Lost a compass at Port Meridian",
      },
    });
    expect(charRes.status).toBe(201);
    const character = characterSchema.parse(await charRes.json());

    const setRes = await api("POST", ApiPaths.settings, {
      body: {
        name: "Port Meridian",
        description: "Harbor of brass clocks and fog",
        atmosphere: "Damp iron and citrus",
        notes: "Opening location",
      },
    });
    expect(setRes.status).toBe(201);
    const setting = settingSchema.parse(await setRes.json());

    const composeRes = await api("POST", ApiPaths.scaffoldingCompose, {
      body: {
        characterIds: [character.id],
        settingIds: [setting.id],
        storyTitle: "Compass Lost",
      },
    });
    expect(composeRes.status).toBe(200);
    const result = scaffoldingComposeResultSchema.parse(await composeRes.json());

    expect(result.storyTitle).toBe("Compass Lost");
    expect(result.memory).toContain("Kai Drift");
    expect(result.memory).toContain("Sailor of glass seas");
    expect(result.memory).toContain("Port Meridian");
    expect(result.memory).toContain("brass clocks");
    expect(result.systemPrompt).toContain("Compass Lost");
    expect(result.systemPrompt).toContain("Impulsive but loyal");
    expect(result.systemPrompt).toContain("Damp iron");
    expect(result.lorebook.some((e) => e.sourceId === character.id)).toBe(true);
    expect(result.lorebook.some((e) => e.text.includes("glass seas"))).toBe(
      true,
    );
    expect(result.lorebook.some((e) => e.keys === "Port Meridian")).toBe(true);
    expect(result.plainText).toMatch(/Memory/i);
    expect(result.plainText).toMatch(/Lorebook/i);
    expect(result.plainText).toMatch(/System prompt/i);
    expect(result.sources.characterIds).toEqual([character.id]);
    expect(result.sources.settingIds).toEqual([setting.id]);
  });

  it("compose returns 404 for unknown lore ids", async () => {
    boot();
    const res = await api("POST", ApiPaths.scaffoldingCompose, {
      body: {
        characterIds: ["99999999-9999-4999-8999-999999999999"],
      },
    });
    expect(res.status).toBe(404);
  });
});
