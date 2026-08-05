/**
 * Thin API client — same-origin / Vite proxy to server.
 */
import {
  ApiPaths,
  healthResponseSchema,
  noteListSchema,
  noteSchema,
  type HealthResponse,
  type Note,
  type NoteCreate,
} from "@aigen-studio/shared";

const TOKEN_KEY = "aigen-studio.app-token";

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

async function request(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.auth !== false) {
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await request(ApiPaths.health, { auth: false });
  if (!res.ok) throw new Error(`Health failed: ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}

export async function listNotes(): Promise<Note[]> {
  const res = await request(ApiPaths.notes);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List notes failed: ${res.status} ${text}`);
  }
  return noteListSchema.parse(await res.json()).notes;
}

export async function createNote(input: NoteCreate): Promise<Note> {
  const res = await request(ApiPaths.notes, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create note failed: ${res.status} ${text}`);
  }
  return noteSchema.parse(await res.json());
}
