/**
 * Server process entry — binds HTTP; no NovelAI key required.
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const ctx = createApp({ config });

if (ctx.tokenCreated) {
  console.log(`[aigen-studio] Generated new app token at ${ctx.paths.appTokenFile}`);
  console.log(`[aigen-studio] App token: ${ctx.appToken}`);
  console.log(`[aigen-studio] (also: pnpm auth:show)`);
} else {
  console.log(`[aigen-studio] Using app token from ${ctx.config.appTokenOverride ? "AIGEN_APP_TOKEN" : ctx.paths.appTokenFile}`);
}

console.log(`[aigen-studio] dataDir=${ctx.paths.root}`);
console.log(
  `[aigen-studio] NovelAI key: ${config.novelaiApiKey ? "configured" : "not set (generate disabled; other features OK)"}`,
);

const server = serve(
  {
    fetch: ctx.app.fetch,
    hostname: config.host,
    port: config.port,
  },
  (info) => {
    console.log(
      `[aigen-studio] API listening on http://${config.host}:${info.port}`,
    );
    console.log(`[aigen-studio] Health: http://${config.host}:${info.port}/api/v1/health`);
  },
);

function shutdown() {
  console.log("[aigen-studio] Shutting down…");
  ctx.close();
  // @hono/node-server Server has close
  const s = server as { close?: (cb?: () => void) => void };
  if (typeof s.close === "function") {
    s.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
