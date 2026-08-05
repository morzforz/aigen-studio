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

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
