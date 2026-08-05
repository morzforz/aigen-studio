/**
 * Vault I/O + SQLite index — durable image store under AIGEN_DATA_DIR.
 */
import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AppDatabase } from "../../db/client.js";
import { vaultImages } from "../../db/schema.js";
import type { DataPaths } from "../../platform/files.js";
import { extractPngMetadata } from "./png_metadata.js";

export type VaultImageRecord = {
  id: string;
  relativePath: string;
  prompt: string;
  negativePrompt: string;
  seed: string;
  model: string;
  width: number | null;
  height: number | null;
  source: string;
  extractedMetadataJson: string;
  sha256: string;
  byteSize: number;
  createdAt: string;
};

export type SaveVaultImageInput = {
  pngBytes: Buffer;
  prompt?: string;
  negativePrompt?: string;
  seed?: string;
  model?: string;
  source: "generate" | "import";
  now?: string;
};

export function saveVaultImage(
  db: AppDatabase,
  paths: DataPaths,
  input: SaveVaultImageInput,
): VaultImageRecord {
  const id = randomUUID();
  const now = input.now ?? new Date().toISOString();
  const d = new Date(now);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dir = path.join(paths.vaultImages, yyyy, mm);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${id}.png`;
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, input.pngBytes);

  const extracted = extractPngMetadata(input.pngBytes);
  const relativePath = path
    .join("vault", "images", yyyy, mm, filename)
    .replace(/\\/g, "/");
  const sha256 = createHash("sha256").update(input.pngBytes).digest("hex");

  const prompt = (input.prompt ?? extracted.prompt ?? "").trim();
  const negativePrompt = (
    input.negativePrompt ??
    extracted.negativePrompt ??
    ""
  ).trim();
  const seed = (input.seed ?? extracted.seed ?? "").trim();

  const row = {
    id,
    relativePath,
    prompt,
    negativePrompt,
    seed,
    model: (input.model ?? "").trim(),
    width: null as number | null,
    height: null as number | null,
    source: input.source,
    extractedMetadataJson: extracted.rawJson,
    sha256,
    byteSize: input.pngBytes.length,
    createdAt: now,
  };

  // Parse IHDR dimensions if possible
  if (input.pngBytes.length >= 24) {
    try {
      row.width = input.pngBytes.readUInt32BE(16);
      row.height = input.pngBytes.readUInt32BE(20);
    } catch {
      /* ignore */
    }
  }

  db.insert(vaultImages).values(row).run();
  return rowToApi(row);
}

export function listVaultImages(db: AppDatabase): VaultImageRecord[] {
  const rows = db.select().from(vaultImages).all();
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows.map(rowToApi);
}

export function getVaultImage(
  db: AppDatabase,
  id: string,
): VaultImageRecord | null {
  const row = db.select().from(vaultImages).where(eq(vaultImages.id, id)).get();
  return row ? rowToApi(row) : null;
}

export function readVaultImageBytes(
  paths: DataPaths,
  relativePath: string,
): Buffer | null {
  // Prevent path escape
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..")) return null;
  const abs = path.join(paths.root, normalized);
  if (!abs.startsWith(paths.root)) return null;
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

function rowToApi(row: {
  id: string;
  relativePath: string;
  prompt: string;
  negativePrompt: string;
  seed: string;
  model: string;
  width: number | null;
  height: number | null;
  source: string;
  extractedMetadataJson: string;
  sha256: string;
  byteSize: number;
  createdAt: string;
}): VaultImageRecord {
  return {
    id: row.id,
    relativePath: row.relativePath,
    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    seed: row.seed,
    model: row.model,
    width: row.width,
    height: row.height,
    source: row.source,
    extractedMetadataJson: row.extractedMetadataJson,
    sha256: row.sha256,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
  };
}
