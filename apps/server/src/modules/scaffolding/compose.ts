/**
 * Pure story scaffolding: assemble memory / lorebook / system-prompt drafts from lore rows.
 * No NovelAI network calls — deterministic templates for M3 export-first workflow.
 */
export type CharacterLore = {
  id: string;
  name: string;
  bio: string;
  personality: string;
  voiceStyle: string;
  notes: string;
  relationships: string;
  tags: string;
  ucNegatives: string;
  refImagePath: string;
};

export type SettingLore = {
  id: string;
  name: string;
  description: string;
  atmosphere: string;
  notes: string;
  tags: string;
  ucNegatives: string;
  refImagePath: string;
};

export type LorebookEntryDraft = {
  keys: string;
  text: string;
  sourceType: "character" | "setting";
  sourceId: string;
  sourceName: string;
};

export type ComposeInput = {
  characters: CharacterLore[];
  settings: SettingLore[];
  storyTitle?: string;
  composedAt?: string;
};

export type ComposeOutput = {
  storyTitle: string;
  memory: string;
  lorebook: LorebookEntryDraft[];
  systemPrompt: string;
  plainText: string;
  sources: {
    characterIds: string[];
    settingIds: string[];
  };
  composedAt: string;
};

function nonEmpty(...parts: string[]): string[] {
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function composeFromLore(input: ComposeInput): ComposeOutput {
  const characters = input.characters;
  const settings = input.settings;
  if (characters.length === 0 && settings.length === 0) {
    throw new Error("composeFromLore requires at least one character or setting");
  }

  const storyTitle =
    input.storyTitle?.trim() ||
    defaultStoryTitle(characters, settings);
  const composedAt = input.composedAt ?? new Date().toISOString();

  const memory = buildMemory(storyTitle, characters, settings);
  const lorebook = buildLorebook(characters, settings);
  const systemPrompt = buildSystemPrompt(storyTitle, characters, settings);
  const plainText = buildPlainText(storyTitle, memory, lorebook, systemPrompt);

  return {
    storyTitle,
    memory,
    lorebook,
    systemPrompt,
    plainText,
    sources: {
      characterIds: characters.map((c) => c.id),
      settingIds: settings.map((s) => s.id),
    },
    composedAt,
  };
}

function defaultStoryTitle(
  characters: CharacterLore[],
  settings: SettingLore[],
): string {
  const names = [
    ...characters.map((c) => c.name),
    ...settings.map((s) => s.name),
  ];
  if (names.length === 0) return "Untitled story scaffold";
  if (names.length === 1) return `Story: ${names[0]}`;
  if (names.length === 2) return `Story: ${names[0]} & ${names[1]}`;
  return `Story: ${names[0]} + ${names.length - 1} more`;
}

function buildMemory(
  storyTitle: string,
  characters: CharacterLore[],
  settings: SettingLore[],
): string {
  const blocks: string[] = [
    `[Memory draft — ${storyTitle}]`,
    "This memory block is assembled from your Aigen Studio lore repository for paste into NovelAI Memory (or similar).",
    "",
  ];

  if (characters.length) {
    blocks.push("=== Characters ===");
    for (const c of characters) {
      const lines = nonEmpty(
        c.name,
        c.bio && `Bio: ${c.bio}`,
        c.personality && `Personality: ${c.personality}`,
        c.voiceStyle && `Voice: ${c.voiceStyle}`,
        c.relationships && `Relationships: ${c.relationships}`,
        c.notes && `Notes: ${c.notes}`,
      );
      blocks.push(lines.join("\n"), "");
    }
  }

  if (settings.length) {
    blocks.push("=== Settings ===");
    for (const s of settings) {
      const lines = nonEmpty(
        s.name,
        s.description && `Description: ${s.description}`,
        s.atmosphere && `Atmosphere: ${s.atmosphere}`,
        s.notes && `Notes: ${s.notes}`,
      );
      blocks.push(lines.join("\n"), "");
    }
  }

  return blocks.join("\n").trim() + "\n";
}

function buildLorebook(
  characters: CharacterLore[],
  settings: SettingLore[],
): LorebookEntryDraft[] {
  const entries: LorebookEntryDraft[] = [];

  for (const c of characters) {
    const textParts = nonEmpty(
      c.bio,
      c.personality && `Personality: ${c.personality}`,
      c.voiceStyle && `Voice / style: ${c.voiceStyle}`,
      c.relationships && `Relationships: ${c.relationships}`,
      c.notes && `Notes: ${c.notes}`,
      c.tags && `Image tags: ${c.tags}`,
      c.ucNegatives && `UC / negatives: ${c.ucNegatives}`,
    );
    entries.push({
      keys: c.name,
      text: textParts.join("\n\n") || `${c.name} (no prose lore filled in yet).`,
      sourceType: "character",
      sourceId: c.id,
      sourceName: c.name,
    });
  }

  for (const s of settings) {
    const textParts = nonEmpty(
      s.description,
      s.atmosphere && `Atmosphere: ${s.atmosphere}`,
      s.notes && `Notes: ${s.notes}`,
      s.tags && `Tags: ${s.tags}`,
      s.ucNegatives && `UC / negatives: ${s.ucNegatives}`,
    );
    entries.push({
      keys: s.name,
      text: textParts.join("\n\n") || `${s.name} (no prose lore filled in yet).`,
      sourceType: "setting",
      sourceId: s.id,
      sourceName: s.name,
    });
  }

  return entries;
}

function buildSystemPrompt(
  storyTitle: string,
  characters: CharacterLore[],
  settings: SettingLore[],
): string {
  const lines: string[] = [
    `You are assisting with the story "${storyTitle}".`,
    "Stay consistent with the following lore from the author's repository.",
    "Do not invent contradictory background unless the user explicitly asks.",
    "",
  ];

  if (characters.length) {
    lines.push("Characters to honor:");
    for (const c of characters) {
      lines.push(
        `- ${c.name}` +
          (c.personality ? `: ${c.personality}` : "") +
          (c.voiceStyle ? ` (voice: ${c.voiceStyle})` : ""),
      );
      if (c.bio) lines.push(`  Bio: ${c.bio}`);
    }
    lines.push("");
  }

  if (settings.length) {
    lines.push("Settings / places to honor:");
    for (const s of settings) {
      lines.push(
        `- ${s.name}` + (s.atmosphere ? ` — ${s.atmosphere}` : ""),
      );
      if (s.description) lines.push(`  ${s.description}`);
    }
    lines.push("");
  }

  lines.push(
    "When writing dialogue or narration, keep character voice and place atmosphere consistent with the notes above.",
  );

  return lines.join("\n").trim() + "\n";
}

function buildPlainText(
  storyTitle: string,
  memory: string,
  lorebook: LorebookEntryDraft[],
  systemPrompt: string,
): string {
  const lorebookBlock = lorebook
    .map(
      (e, i) =>
        `--- Entry ${i + 1}: ${e.keys} (${e.sourceType}) ---\nKeys: ${e.keys}\n\n${e.text}\n`,
    )
    .join("\n");

  return [
    `# Story scaffold: ${storyTitle}`,
    "",
    "## Memory",
    memory.trim(),
    "",
    "## Lorebook",
    lorebookBlock.trim(),
    "",
    "## System prompt",
    systemPrompt.trim(),
    "",
  ].join("\n");
}

