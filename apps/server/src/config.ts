/**
 * Server configuration from env + defaults (ARCHITECTURE §8).
 * NovelAI key is optional and never required to boot.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root: apps/server/src -> ../../../ */
export function defaultRepoRoot(): string {
  return path.resolve(__dirname, "../../..");
}

export type ServerConfig = {
  dataDir: string;
  host: string;
  port: number;
  /** If set, used instead of secrets/app-token file */
  appTokenOverride: string | null;
  /** Present only if configured; unused until M4 */
  novelaiApiKey: string | null;
  webOrigin: string;
  isProduction: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === "production";
  const dataDir =
    env.AIGEN_DATA_DIR?.trim() ||
    (isProduction
      ? path.join(
          env.HOME ?? process.cwd(),
          "Library",
          "Application Support",
          "aigen-studio",
        )
      : path.join(defaultRepoRoot(), "data"));

  const port = Number(env.AIGEN_PORT ?? "8787");
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid AIGEN_PORT: ${env.AIGEN_PORT}`);
  }

  return {
    dataDir: path.resolve(dataDir),
    host: env.AIGEN_HOST?.trim() || "127.0.0.1",
    port,
    appTokenOverride: env.AIGEN_APP_TOKEN?.trim() || null,
    novelaiApiKey: env.AIGEN_NOVELAI_API_KEY?.trim() || null,
    webOrigin: env.AIGEN_WEB_ORIGIN?.trim() || "http://127.0.0.1:5173",
    isProduction,
  };
}
