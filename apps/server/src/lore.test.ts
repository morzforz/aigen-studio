/**
 * M2 lore repository: characters + settings CRUD, search, restart persistence.
 * Drives real createApp handlers (not reimplemented).
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ApiPaths,
  characterSchema,
  healthResponseSchema,
  settingSchema,
} from "@aigen-studio/shared";
import { createApp, type AppContext } from "./app.js";
import type { ServerConfig } from "./config.js";

function tempConfig(dataDir: string, token?: string): ServerConfig {
  return {
    dataDir,
    host: "127.0.0.1",
    port: 0,
    appTokenOverride: token ?? "test-token-m2-lore",
    novelaiApiKey: null,
    webOrigin: "http://127.0.0.1:5173",
    isProduction: false,
  };
}

describe("lore repository (characters + settings)", () => {
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

  function boot(token = "test-token-m2-lore") {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m2-"));
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

  it("boots without NovelAI and health still works", async () => {
    const c = boot();
    expect(c.config.novelaiApiKey).toBeNull();
    const res = await api("GET", ApiPaths.health, { token: null });
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(await res.json()).status).toBe("ok");
  });

  it("characters require auth", async () => {
    boot();
    const res = await api("GET", ApiPaths.characters, { token: null });
    expect(res.status).toBe(401);
  });

  it("character full CRUD with rich prose fields", async () => {
    boot();
    const payload = {
      name: "Aria Vale",
      bio: "A cartographer who maps dream-coasts.",
      personality: "Quietly stubborn; dry humor.",
      voiceStyle: "Measured, occasional metaphor.",
      notes: "Story arc: finds the last meridian.",
      relationships: "Mentor to Kai; rivals with the Guild.",
      tags: "1girl, silver hair, coat",
      ucNegatives: "lowres, bad anatomy",
      refImagePath: "uploads/refs/aria.png",
    };

    const createRes = await api("POST", ApiPaths.characters, { body: payload });
    expect(createRes.status).toBe(201);
    const created = characterSchema.parse(await createRes.json());
    expect(created.name).toBe(payload.name);
    expect(created.bio).toBe(payload.bio);
    expect(created.personality).toBe(payload.personality);
    expect(created.voiceStyle).toBe(payload.voiceStyle);
    expect(created.notes).toBe(payload.notes);
    expect(created.relationships).toBe(payload.relationships);
    expect(created.tags).toBe(payload.tags);
    expect(created.ucNegatives).toBe(payload.ucNegatives);
    expect(created.refImagePath).toBe(payload.refImagePath);

    const getRes = await api("GET", ApiPaths.character(created.id));
    expect(getRes.status).toBe(200);
    expect(characterSchema.parse(await getRes.json())).toEqual(created);

    const updatedPayload = {
      ...payload,
      bio: "Updated bio: maps real and imagined shores.",
      notes: "Revised notes for M2.",
    };
    const putRes = await api("PUT", ApiPaths.character(created.id), {
      body: updatedPayload,
    });
    expect(putRes.status).toBe(200);
    const updated = characterSchema.parse(await putRes.json());
    expect(updated.bio).toBe(updatedPayload.bio);
    expect(updated.notes).toBe(updatedPayload.notes);
    expect(updated.id).toBe(created.id);

    const listRes = await api("GET", ApiPaths.characters);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { characters: unknown[] };
    expect(
      list.characters.some((c) => characterSchema.parse(c).id === created.id),
    ).toBe(true);

    const delRes = await api("DELETE", ApiPaths.character(created.id));
    expect(delRes.status).toBe(204);
    const missing = await api("GET", ApiPaths.character(created.id));
    expect(missing.status).toBe(404);
  });

  it("character search matches name and prose", async () => {
    boot();
    await api("POST", ApiPaths.characters, {
      body: {
        name: "Kai Drift",
        bio: "Sailor of glass seas",
        personality: "Impulsive",
      },
    });
    await api("POST", ApiPaths.characters, {
      body: {
        name: "Mira Stone",
        bio: "Archivist",
        personality: "Patient; loves meridian charts",
      },
    });

    const byName = await api("GET", `${ApiPaths.characters}?q=Kai`);
    expect(byName.status).toBe(200);
    const nameHits = characterSchema
      .array()
      .parse((await byName.json() as { characters: unknown[] }).characters);
    expect(nameHits).toHaveLength(1);
    expect(nameHits[0]!.name).toBe("Kai Drift");

    const byProse = await api(
      "GET",
      `${ApiPaths.characters}?q=${encodeURIComponent("meridian")}`,
    );
    expect(byProse.status).toBe(200);
    const proseHits = characterSchema
      .array()
      .parse((await byProse.json() as { characters: unknown[] }).characters);
    expect(proseHits.some((c) => c.name === "Mira Stone")).toBe(true);
  });

  it("setting full CRUD with rich prose fields", async () => {
    boot();
    const payload = {
      name: "Glass Coast",
      description: "A shoreline of fused sand and tide-runes.",
      atmosphere: "Salt wind, low amber light.",
      notes: "Primary act-one location.",
      tags: "coast, fantasy",
      ucNegatives: "modern city",
      refImagePath: "uploads/refs/coast.png",
    };

    const createRes = await api("POST", ApiPaths.settings, { body: payload });
    expect(createRes.status).toBe(201);
    const created = settingSchema.parse(await createRes.json());
    expect(created.name).toBe(payload.name);
    expect(created.description).toBe(payload.description);
    expect(created.atmosphere).toBe(payload.atmosphere);
    expect(created.notes).toBe(payload.notes);

    const getRes = await api("GET", ApiPaths.setting(created.id));
    expect(getRes.status).toBe(200);
    expect(settingSchema.parse(await getRes.json()).description).toBe(
      payload.description,
    );

    const putRes = await api("PUT", ApiPaths.setting(created.id), {
      body: { ...payload, atmosphere: "Storm-brushed, violet dusk." },
    });
    expect(putRes.status).toBe(200);
    expect(settingSchema.parse(await putRes.json()).atmosphere).toBe(
      "Storm-brushed, violet dusk.",
    );

    const search = await api(
      "GET",
      `${ApiPaths.settings}?q=${encodeURIComponent("tide-runes")}`,
    );
    expect(search.status).toBe(200);
    const hits = settingSchema
      .array()
      .parse((await search.json() as { settings: unknown[] }).settings);
    expect(hits.some((s) => s.id === created.id)).toBe(true);

    const delRes = await api("DELETE", ApiPaths.setting(created.id));
    expect(delRes.status).toBe(204);
  });

  it("persists characters and settings across createApp reopen", async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m2-persist-"));
    const token = "persist-token-m2";
    const first = createApp({ config: tempConfig(dataDir, token) });

    const charRes = await first.app.request(ApiPaths.characters, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Persist Char",
        bio: "Lives in SQLite across restart",
        personality: "Durable",
      }),
    });
    expect(charRes.status).toBe(201);
    const char = characterSchema.parse(await charRes.json());

    const setRes = await first.app.request(ApiPaths.settings, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Persist Setting",
        description: "World still here after close",
        atmosphere: "Steady",
      }),
    });
    expect(setRes.status).toBe(201);
    const setting = settingSchema.parse(await setRes.json());
    first.close();

    ctx = createApp({ config: tempConfig(dataDir, token) });
    const charGet = await ctx.app.request(ApiPaths.character(char.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(charGet.status).toBe(200);
    const char2 = characterSchema.parse(await charGet.json());
    expect(char2.name).toBe("Persist Char");
    expect(char2.bio).toBe("Lives in SQLite across restart");

    const setGet = await ctx.app.request(ApiPaths.setting(setting.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(setGet.status).toBe(200);
    const set2 = settingSchema.parse(await setGet.json());
    expect(set2.name).toBe("Persist Setting");
    expect(set2.description).toBe("World still here after close");
    expect(fs.existsSync(ctx.paths.dbFile)).toBe(true);
  });
});
