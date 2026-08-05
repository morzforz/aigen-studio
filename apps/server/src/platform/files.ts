/**
 * Safe paths under AIGEN_DATA_DIR (ARCHITECTURE §4).
 */
import fs from "node:fs";
import path from "node:path";

export type DataPaths = {
  root: string;
  dbFile: string;
  secretsDir: string;
  appTokenFile: string;
  vaultImages: string;
  uploads: string;
  exports: string;
  logs: string;
};

export function resolveDataPaths(dataDir: string): DataPaths {
  const root = path.resolve(dataDir);
  return {
    root,
    dbFile: path.join(root, "aigen.sqlite"),
    secretsDir: path.join(root, "secrets"),
    appTokenFile: path.join(root, "secrets", "app-token"),
    vaultImages: path.join(root, "vault", "images"),
    uploads: path.join(root, "uploads"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
}

/** Create data-dir tree (vault, secrets, etc.). Idempotent. */
export function ensureDataLayout(paths: DataPaths): void {
  for (const dir of [
    paths.root,
    paths.secretsDir,
    paths.vaultImages,
    paths.uploads,
    paths.exports,
    paths.logs,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
