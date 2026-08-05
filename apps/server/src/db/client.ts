/**
 * Open SQLite + apply schema (ARCHITECTURE §4: WAL, single writer).
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DataPaths } from "../platform/files.js";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export type DbHandle = {
  db: AppDatabase;
  sqlite: Database.Database;
  close: () => void;
};

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  voice_style TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  relationships TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  uc_negatives TEXT NOT NULL DEFAULT '',
  ref_image_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  atmosphere TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  uc_negatives TEXT NOT NULL DEFAULT '',
  ref_image_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_images (
  id TEXT PRIMARY KEY NOT NULL,
  relative_path TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  seed TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  width INTEGER,
  height INTEGER,
  source TEXT NOT NULL,
  extracted_metadata_json TEXT NOT NULL DEFAULT '{}',
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function openDatabase(paths: DataPaths): DbHandle {
  const sqlite = new Database(paths.dbFile);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(MIGRATION_SQL);

  const db = drizzle(sqlite, { schema });
  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
