/**
 * Integration tests: boot real createApp with temp data dir; exercise health + notes CRUD.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ApiPaths, healthResponseSchema, noteSchema } from "@aigen-studio/shared";
import { createApp, type AppContext } from "./app.js";
import type { ServerConfig } from "./config.js";

function tempConfig(dataDir: string, token?: string): ServerConfig {
  return {
    dataDir,
    host: "127.0.0.1",
    port: 0,
    appTokenOverride: token ?? "test-token-m1-scaffold-fixed",
    novelaiApiKey: null,
    webOrigin: "http://127.0.0.1:5173",
    isProduction: false,
  };
}

describe("createApp health + notes CRUD", () => {
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

  function boot(token = "test-token-m1-scaffold-fixed") {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m1-"));
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

  it("GET /api/v1/health is unauthenticated and returns ok body", async () => {
    boot();
    const res = await api("GET", ApiPaths.health, { token: null });
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe("ok");
    expect(body.service).toBe("aigen-studio");
    expect(body.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("notes CRUD requires bearer token", async () => {
    boot();
    const res = await api("GET", ApiPaths.notes, { token: null });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("creates and reads a note with durable fields (real handlers + SQLite)", async () => {
    boot();
    const title = "M1 smoke note";
    const noteBody = "Persisted under AIGEN_DATA_DIR";

    const createRes = await api("POST", ApiPaths.notes, {
      body: { title, body: noteBody },
    });
    expect(createRes.status).toBe(201);
    const created = noteSchema.parse(await createRes.json());
    expect(created.title).toBe(title);
    expect(created.body).toBe(noteBody);
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const getRes = await api("GET", ApiPaths.note(created.id));
    expect(getRes.status).toBe(200);
    const fetched = noteSchema.parse(await getRes.json());
    expect(fetched).toEqual(created);

    const listRes = await api("GET", ApiPaths.notes);
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { notes: unknown[] };
    expect(list.notes.some((n) => noteSchema.parse(n).id === created.id)).toBe(
      true,
    );

    // Prove SQLite file exists under data dir
    expect(fs.existsSync(ctx!.paths.dbFile)).toBe(true);
  });

  it("survives reopen: second createApp reads prior note from same data dir", async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigen-m1-"));
    const token = "persist-token-m1";
    const first = createApp({ config: tempConfig(dataDir, token) });
    const createRes = await first.app.request(ApiPaths.notes, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "across restart", body: "still here" }),
    });
    expect(createRes.status).toBe(201);
    const created = noteSchema.parse(await createRes.json());
    first.close();

    ctx = createApp({ config: tempConfig(dataDir, token) });
    const getRes = await ctx.app.request(ApiPaths.note(created.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = noteSchema.parse(await getRes.json());
    expect(fetched.title).toBe("across restart");
    expect(fetched.body).toBe("still here");
  });

  it("boots without NovelAI API key", async () => {
    const c = boot();
    expect(c.config.novelaiApiKey).toBeNull();
    const res = await api("GET", ApiPaths.health, { token: null });
    expect(res.status).toBe(200);
  });
});
