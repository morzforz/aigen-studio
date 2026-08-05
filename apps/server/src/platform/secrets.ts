/**
 * App bearer token lifecycle (ARCHITECTURE §5).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import type { DataPaths } from "./files.js";

export function loadOrCreateAppToken(
  paths: DataPaths,
  override: string | null,
): { token: string; created: boolean } {
  if (override && override.length > 0) {
    return { token: override, created: false };
  }

  if (fs.existsSync(paths.appTokenFile)) {
    const token = fs.readFileSync(paths.appTokenFile, "utf8").trim();
    if (!token) {
      throw new Error(`Empty app token file: ${paths.appTokenFile}`);
    }
    return { token, created: false };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(paths.appTokenFile, `${token}\n`, { mode: 0o600 });
  // Ensure mode on platforms that ignore mode in writeFileSync
  try {
    fs.chmodSync(paths.appTokenFile, 0o600);
  } catch {
    /* ignore */
  }
  return { token, created: true };
}

export function readAppTokenFile(paths: DataPaths): string | null {
  if (!fs.existsSync(paths.appTokenFile)) return null;
  const token = fs.readFileSync(paths.appTokenFile, "utf8").trim();
  return token || null;
}
