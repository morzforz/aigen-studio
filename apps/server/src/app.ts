/**
 * Hono app factory — same entry used by production server and Vitest.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { API_V1 } from "@aigen-studio/shared";
import type { ServerConfig } from "./config.js";
import { openDatabase, type DbHandle } from "./db/client.js";
import { charactersRoutes } from "./modules/lore/characters.js";
import { settingsRoutes } from "./modules/lore/settings.js";
import { notesRoutes } from "./modules/notes/routes.js";
import { scaffoldingRoutes } from "./modules/scaffolding/routes.js";
import { systemRoutes } from "./modules/system/routes.js";
import { ensureDataLayout, resolveDataPaths, type DataPaths } from "./platform/files.js";
import { loadOrCreateAppToken } from "./platform/secrets.js";
import type { AppVariables } from "./types.js";

export type { AppVariables };

export type AppContext = {
  app: Hono<{ Variables: AppVariables }>;
  config: ServerConfig;
  paths: DataPaths;
  appToken: string;
  tokenCreated: boolean;
  dbHandle: DbHandle;
  close: () => void;
};

export type CreateAppOptions = {
  config: ServerConfig;
  /** Force a known token (tests); still respects config.appTokenOverride if set via load */
  appToken?: string;
};

/**
 * Build the real application: data layout, SQLite, auth token, routes.
 * Does not listen on a port.
 */
export function createApp(options: CreateAppOptions): AppContext {
  const { config } = options;
  const paths = resolveDataPaths(config.dataDir);
  ensureDataLayout(paths);

  const tokenResult = options.appToken
    ? { token: options.appToken, created: false }
    : loadOrCreateAppToken(paths, config.appTokenOverride);

  const dbHandle = openDatabase(paths);

  const app = new Hono<{ Variables: AppVariables }>();

  app.use(
    "*",
    cors({
      origin: config.webOrigin,
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  // Make token available to auth middleware via context
  app.use("*", async (c, next) => {
    c.set("appToken", tokenResult.token);
    await next();
  });

  const api = new Hono<{ Variables: AppVariables }>();
  api.route("/", systemRoutes({ paths, db: dbHandle.db }));
  api.route("/notes", notesRoutes({ db: dbHandle.db }));
  api.route("/characters", charactersRoutes({ db: dbHandle.db }));
  api.route("/settings", settingsRoutes({ db: dbHandle.db }));
  api.route("/scaffolding", scaffoldingRoutes({ db: dbHandle.db }));

  app.route(API_V1, api);

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "Not found" } }, 404),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json(
      { error: { code: "internal_error", message: "Internal server error" } },
      500,
    );
  });

  return {
    app,
    config,
    paths,
    appToken: tokenResult.token,
    tokenCreated: tokenResult.created,
    dbHandle,
    close: () => dbHandle.close(),
  };
}
