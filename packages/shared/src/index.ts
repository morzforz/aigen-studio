/**
 * @aigen-studio/shared — API path constants and Zod schemas shared by server and web.
 */
import { z } from "zod";

export const API_V1 = "/api/v1" as const;

export const ApiPaths = {
  health: `${API_V1}/health`,
  ready: `${API_V1}/ready`,
  notes: `${API_V1}/notes`,
  note: (id: string) => `${API_V1}/notes/${id}`,
  characters: `${API_V1}/characters`,
  character: (id: string) => `${API_V1}/characters/${id}`,
  settings: `${API_V1}/settings`,
  setting: (id: string) => `${API_V1}/settings/${id}`,
  scaffoldingCompose: `${API_V1}/scaffolding/compose`,
  vaultImages: `${API_V1}/vault/images`,
  vaultImage: (id: string) => `${API_V1}/vault/images/${id}`,
  vaultImageFile: (id: string) => `${API_V1}/vault/images/${id}/file`,
  vaultImageImport: `${API_V1}/vault/images/import`,
  naiImageGenerate: `${API_V1}/nai/image/generate`,
} as const;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("aigen-studio"),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readyResponseSchema = z.object({
  ready: z.boolean(),
  dataDir: z.string(),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;

export const noteCreateSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().max(50_000).default(""),
});
export type NoteCreate = z.infer<typeof noteCreateSchema>;

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof noteSchema>;

export const noteListSchema = z.object({
  notes: z.array(noteSchema),
});
export type NoteList = z.infer<typeof noteListSchema>;

/** Shared optional image-oriented fields (no vault/generate required). */
const imageOrientedFields = {
  tags: z.string().max(10_000).default(""),
  ucNegatives: z.string().max(10_000).default(""),
  refImagePath: z.string().max(2000).default(""),
};

export const characterWriteSchema = z.object({
  name: z.string().min(1).max(500),
  bio: z.string().max(100_000).default(""),
  personality: z.string().max(100_000).default(""),
  voiceStyle: z.string().max(50_000).default(""),
  notes: z.string().max(100_000).default(""),
  relationships: z.string().max(50_000).default(""),
  ...imageOrientedFields,
});
export type CharacterWrite = z.infer<typeof characterWriteSchema>;

export const characterSchema = characterWriteSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Character = z.infer<typeof characterSchema>;

export const characterListSchema = z.object({
  characters: z.array(characterSchema),
});
export type CharacterList = z.infer<typeof characterListSchema>;

export const settingWriteSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(100_000).default(""),
  atmosphere: z.string().max(50_000).default(""),
  notes: z.string().max(100_000).default(""),
  ...imageOrientedFields,
});
export type SettingWrite = z.infer<typeof settingWriteSchema>;

export const settingSchema = settingWriteSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Setting = z.infer<typeof settingSchema>;

export const settingListSchema = z.object({
  settings: z.array(settingSchema),
});
export type SettingList = z.infer<typeof settingListSchema>;

/** M3 story scaffolding — compose memory / lorebook / system prompt from lore ids. */
export const scaffoldingComposeRequestSchema = z
  .object({
    characterIds: z.array(z.string().uuid()).default([]),
    settingIds: z.array(z.string().uuid()).default([]),
    storyTitle: z.string().max(500).optional(),
  })
  .refine(
    (v) => v.characterIds.length > 0 || v.settingIds.length > 0,
    { message: "Select at least one character or setting" },
  );
export type ScaffoldingComposeRequest = z.infer<
  typeof scaffoldingComposeRequestSchema
>;

export const lorebookEntrySchema = z.object({
  /** Entry key / name for NovelAI-style lorebook */
  keys: z.string(),
  text: z.string(),
  sourceType: z.enum(["character", "setting"]),
  sourceId: z.string().uuid(),
  sourceName: z.string(),
});
export type LorebookEntry = z.infer<typeof lorebookEntrySchema>;

export const scaffoldingComposeResultSchema = z.object({
  storyTitle: z.string(),
  memory: z.string(),
  lorebook: z.array(lorebookEntrySchema),
  systemPrompt: z.string(),
  /** Combined plain-text export (all three sections) */
  plainText: z.string(),
  /** Character / setting ids that were resolved */
  sources: z.object({
    characterIds: z.array(z.string().uuid()),
    settingIds: z.array(z.string().uuid()),
  }),
  composedAt: z.string(),
});
export type ScaffoldingComposeResult = z.infer<
  typeof scaffoldingComposeResultSchema
>;

/** M4 — human-initiated single-image generate (n must be 1). */
export const naiGenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(20_000),
  negativePrompt: z.string().max(20_000).optional().default(""),
  seed: z.number().int().optional(),
  width: z.number().int().min(64).max(2048).optional(),
  height: z.number().int().min(64).max(2048).optional(),
  steps: z.number().int().min(1).max(50).optional(),
  scale: z.number().min(1).max(30).optional(),
  model: z.string().max(200).optional(),
  /** Only 1 allowed — batch generation is forbidden */
  n: z.literal(1).optional().default(1),
});
export type NaiGenerateRequest = z.infer<typeof naiGenerateRequestSchema>;

export const vaultImageSchema = z.object({
  id: z.string().uuid(),
  relativePath: z.string(),
  prompt: z.string(),
  negativePrompt: z.string(),
  seed: z.string(),
  model: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  source: z.string(),
  extractedMetadataJson: z.string(),
  sha256: z.string(),
  byteSize: z.number(),
  createdAt: z.string(),
});
export type VaultImage = z.infer<typeof vaultImageSchema>;

export const vaultImageListSchema = z.object({
  images: z.array(vaultImageSchema),
});
export type VaultImageList = z.infer<typeof vaultImageListSchema>;

export const naiGenerateResponseSchema = z.object({
  image: vaultImageSchema,
});
export type NaiGenerateResponse = z.infer<typeof naiGenerateResponseSchema>;

export const vaultImportRequestSchema = z.object({
  pngBase64: z.string().min(1),
  prompt: z.string().max(20_000).optional(),
  negativePrompt: z.string().max(20_000).optional(),
  seed: z.string().max(100).optional(),
  model: z.string().max(200).optional(),
});
export type VaultImportRequest = z.infer<typeof vaultImportRequestSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
