/**
 * Drizzle schema — M1 notes + M2 lore (characters, settings).
 */
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type NoteRow = typeof notes.$inferSelect;
export type CharacterRow = typeof characters.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
