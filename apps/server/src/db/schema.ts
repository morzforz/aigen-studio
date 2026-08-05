/**
 * Drizzle schema — notes, lore, vault images.
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  personality: text("personality").notNull().default(""),
  voiceStyle: text("voice_style").notNull().default(""),
  notes: text("notes").notNull().default(""),
  relationships: text("relationships").notNull().default(""),
  tags: text("tags").notNull().default(""),
  ucNegatives: text("uc_negatives").notNull().default(""),
  refImagePath: text("ref_image_path").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  atmosphere: text("atmosphere").notNull().default(""),
  notes: text("notes").notNull().default(""),
  tags: text("tags").notNull().default(""),
  ucNegatives: text("uc_negatives").notNull().default(""),
  refImagePath: text("ref_image_path").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const vaultImages = sqliteTable("vault_images", {
  id: text("id").primaryKey(),
  relativePath: text("relative_path").notNull(),
  prompt: text("prompt").notNull().default(""),
  negativePrompt: text("negative_prompt").notNull().default(""),
  seed: text("seed").notNull().default(""),
  model: text("model").notNull().default(""),
  width: integer("width"),
  height: integer("height"),
  source: text("source").notNull(),
  extractedMetadataJson: text("extracted_metadata_json").notNull().default("{}"),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: text("created_at").notNull(),
});

export type NoteRow = typeof notes.$inferSelect;
export type CharacterRow = typeof characters.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type VaultImageRow = typeof vaultImages.$inferSelect;
