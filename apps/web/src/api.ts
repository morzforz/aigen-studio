/**
 * Thin API client — same-origin / Vite proxy to server.
 */
import {
  ApiPaths,
  characterListSchema,
  characterSchema,
  healthResponseSchema,
  naiGenerateResponseSchema,
  noteListSchema,
  noteSchema,
  scaffoldingComposeResultSchema,
  settingListSchema,
  settingSchema,
  vaultImageListSchema,
  vaultImageSchema,
  type Character,
  type CharacterWrite,
  type HealthResponse,
  type NaiGenerateRequest,
  type Note,
  type NoteCreate,
  type ScaffoldingComposeRequest,
  type ScaffoldingComposeResult,
  type Setting,
  type SettingWrite,
  type VaultImage,
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

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  return `${res.status} ${text}`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await request(ApiPaths.health, { auth: false });
  if (!res.ok) throw new Error(`Health failed: ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}

export async function listNotes(): Promise<Note[]> {
  const res = await request(ApiPaths.notes);
  if (!res.ok) throw new Error(`List notes failed: ${await readError(res)}`);
  return noteListSchema.parse(await res.json()).notes;
}

export async function createNote(input: NoteCreate): Promise<Note> {
  const res = await request(ApiPaths.notes, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create note failed: ${await readError(res)}`);
  return noteSchema.parse(await res.json());
}

export async function listCharacters(q?: string): Promise<Character[]> {
  const url =
    q && q.trim()
      ? `${ApiPaths.characters}?q=${encodeURIComponent(q.trim())}`
      : ApiPaths.characters;
  const res = await request(url);
  if (!res.ok) throw new Error(`List characters failed: ${await readError(res)}`);
  return characterListSchema.parse(await res.json()).characters;
}

export async function createCharacter(input: CharacterWrite): Promise<Character> {
  const res = await request(ApiPaths.characters, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(`Create character failed: ${await readError(res)}`);
  return characterSchema.parse(await res.json());
}

export async function updateCharacter(
  id: string,
  input: CharacterWrite,
): Promise<Character> {
  const res = await request(ApiPaths.character(id), {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(`Update character failed: ${await readError(res)}`);
  return characterSchema.parse(await res.json());
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await request(ApiPaths.character(id), { method: "DELETE" });
  if (!res.ok)
    throw new Error(`Delete character failed: ${await readError(res)}`);
}

export async function listSettings(q?: string): Promise<Setting[]> {
  const url =
    q && q.trim()
      ? `${ApiPaths.settings}?q=${encodeURIComponent(q.trim())}`
      : ApiPaths.settings;
  const res = await request(url);
  if (!res.ok) throw new Error(`List settings failed: ${await readError(res)}`);
  return settingListSchema.parse(await res.json()).settings;
}

export async function createSetting(input: SettingWrite): Promise<Setting> {
  const res = await request(ApiPaths.settings, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Create setting failed: ${await readError(res)}`);
  return settingSchema.parse(await res.json());
}

export async function updateSetting(
  id: string,
  input: SettingWrite,
): Promise<Setting> {
  const res = await request(ApiPaths.setting(id), {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Update setting failed: ${await readError(res)}`);
  return settingSchema.parse(await res.json());
}

export async function deleteSetting(id: string): Promise<void> {
  const res = await request(ApiPaths.setting(id), { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete setting failed: ${await readError(res)}`);
}

export async function composeScaffolding(
  input: ScaffoldingComposeRequest,
): Promise<ScaffoldingComposeResult> {
  const res = await request(ApiPaths.scaffoldingCompose, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(`Scaffolding compose failed: ${await readError(res)}`);
  return scaffoldingComposeResultSchema.parse(await res.json());
}

export async function listVaultImages(): Promise<VaultImage[]> {
  const res = await request(ApiPaths.vaultImages);
  if (!res.ok) throw new Error(`List vault failed: ${await readError(res)}`);
  return vaultImageListSchema.parse(await res.json()).images;
}

export async function generateNaiImage(
  input: NaiGenerateRequest,
): Promise<VaultImage> {
  const res = await request(ApiPaths.naiImageGenerate, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Generate failed: ${await readError(res)}`);
  return naiGenerateResponseSchema.parse(await res.json()).image;
}

export async function importVaultPng(input: {
  pngBase64: string;
  prompt?: string;
  negativePrompt?: string;
  seed?: string;
}): Promise<VaultImage> {
  const res = await request(ApiPaths.vaultImageImport, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Import failed: ${await readError(res)}`);
  return vaultImageSchema.parse(await res.json());
}

/** Authenticated image URL for gallery (uses fetch blob when needed). */
export async function fetchVaultImageObjectUrl(id: string): Promise<string> {
  const res = await request(ApiPaths.vaultImageFile(id));
  if (!res.ok) throw new Error(`Image file failed: ${await readError(res)}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
