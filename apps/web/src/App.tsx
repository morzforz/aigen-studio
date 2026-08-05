import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type {
  Character,
  CharacterWrite,
  ScaffoldingComposeResult,
  Setting,
  SettingWrite,
  VaultImage,
} from "@aigen-studio/shared";
import {
  composeScaffolding,
  createCharacter,
  createSetting,
  deleteCharacter,
  deleteSetting,
  fetchHealth,
  fetchVaultImageObjectUrl,
  generateNaiImage,
  getStoredToken,
  importVaultPng,
  listCharacters,
  listSettings,
  listVaultImages,
  setStoredToken,
  updateCharacter,
  updateSetting,
} from "./api";

type Tab = "characters" | "settings" | "scaffold" | "gallery";

const emptyCharacter = (): CharacterWrite => ({
  name: "",
  bio: "",
  personality: "",
  voiceStyle: "",
  notes: "",
  relationships: "",
  tags: "",
  ucNegatives: "",
  refImagePath: "",
});

const emptySetting = (): SettingWrite => ({
  name: "",
  description: "",
  atmosphere: "",
  notes: "",
  tags: "",
  ucNegatives: "",
  refImagePath: "",
});

export function App() {
  const [tokenInput, setTokenInput] = useState(getStoredToken);
  const [tokenSaved, setTokenSaved] = useState(Boolean(getStoredToken()));
  const [tab, setTab] = useState<Tab>("characters");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const qc = useQueryClient();

  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  function saveToken(e: FormEvent) {
    e.preventDefault();
    setStoredToken(tokenInput.trim());
    setTokenSaved(Boolean(tokenInput.trim()));
    void qc.invalidateQueries();
  }

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setSearchApplied(search.trim());
  }

  return (
    <div className="page wide">
      <header className="header">
        <h1>Aigen Studio</h1>
        <p className="tagline">
          Lore, scaffolding, and NovelAI image vault (human generate only)
        </p>
      </header>

      <section className="card">
        <h2>Server health</h2>
        {health.isLoading && <p>Checking…</p>}
        {health.isError && (
          <p className="error">
            Cannot reach API. Run <code>./scripts/run-dev.sh</code> or{" "}
            <code>pnpm start</code>.
          </p>
        )}
        {health.data && (
          <p className="ok">
            <strong>{health.data.status}</strong> · {health.data.service} ·{" "}
            {health.data.time}
          </p>
        )}
      </section>

      <section className="card">
        <h2>App token</h2>
        <p className="hint">
          <code>pnpm auth:show</code> or first-start server log
        </p>
        <form onSubmit={saveToken} className="row">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Bearer app token"
            autoComplete="off"
          />
          <button type="submit">Save</button>
        </form>
      </section>

      <nav className="tabs">
        <button
          type="button"
          className={tab === "characters" ? "tab active" : "tab"}
          onClick={() => setTab("characters")}
        >
          Characters
        </button>
        <button
          type="button"
          className={tab === "settings" ? "tab active" : "tab"}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
        <button
          type="button"
          className={tab === "scaffold" ? "tab active" : "tab"}
          onClick={() => setTab("scaffold")}
        >
          Scaffold
        </button>
        <button
          type="button"
          className={tab === "gallery" ? "tab active" : "tab"}
          onClick={() => setTab("gallery")}
        >
          Gallery
        </button>
      </nav>

      {tab !== "scaffold" && tab !== "gallery" && (
        <section className="card">
          <form onSubmit={applySearch} className="row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "characters"
                  ? "Search characters (name, bio, …)"
                  : "Search settings (name, description, …)"
              }
              disabled={!tokenSaved}
            />
            <button type="submit" disabled={!tokenSaved}>
              Search
            </button>
            {searchApplied ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSearch("");
                  setSearchApplied("");
                }}
              >
                Clear
              </button>
            ) : null}
          </form>
        </section>
      )}

      {!tokenSaved && (
        <p className="hint">Save an app token to use lore and scaffolding.</p>
      )}

      {tokenSaved && tab === "characters" && (
        <CharactersPanel search={searchApplied} />
      )}
      {tokenSaved && tab === "settings" && (
        <SettingsPanel search={searchApplied} />
      )}
      {tokenSaved && tab === "scaffold" && <ScaffoldPanel />}
      {tokenSaved && tab === "gallery" && <GalleryPanel />}
    </div>
  );
}

function CharactersPanel({ search }: { search: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterWrite>(emptyCharacter);

  const list = useQuery({
    queryKey: ["characters", search],
    queryFn: () => listCharacters(search || undefined),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) return updateCharacter(editingId, form);
      return createCharacter(form);
    },
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptyCharacter());
      await qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteCharacter,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  function startEdit(c: Character) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      bio: c.bio,
      personality: c.personality,
      voiceStyle: c.voiceStyle,
      notes: c.notes,
      relationships: c.relationships,
      tags: c.tags,
      ucNegatives: c.ucNegatives,
      refImagePath: c.refImagePath,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    save.mutate();
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editingId ? "Edit character" : "New character"}</h2>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Bio
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
          <label>
            Personality
            <textarea
              rows={2}
              value={form.personality}
              onChange={(e) =>
                setForm({ ...form, personality: e.target.value })
              }
            />
          </label>
          <label>
            Voice / style
            <textarea
              rows={2}
              value={form.voiceStyle}
              onChange={(e) => setForm({ ...form, voiceStyle: e.target.value })}
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label>
            Relationships
            <textarea
              rows={2}
              value={form.relationships}
              onChange={(e) =>
                setForm({ ...form, relationships: e.target.value })
              }
            />
          </label>
          <label>
            Tags (image)
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </label>
          <label>
            UC / negatives
            <input
              value={form.ucNegatives}
              onChange={(e) =>
                setForm({ ...form, ucNegatives: e.target.value })
              }
            />
          </label>
          <label>
            Ref image path
            <input
              value={form.refImagePath}
              onChange={(e) =>
                setForm({ ...form, refImagePath: e.target.value })
              }
            />
          </label>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              {editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyCharacter());
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {save.isError && (
            <p className="error">{(save.error as Error).message}</p>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Characters {search ? `(search: ${search})` : ""}</h2>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && (
          <p className="error">{(list.error as Error).message}</p>
        )}
        <ul className="entity-list">
          {(list.data ?? []).map((c) => (
            <li key={c.id}>
              <div className="entity-head">
                <strong>{c.name}</strong>
                <span className="meta">{c.id.slice(0, 8)}…</span>
              </div>
              {c.bio ? <p className="snippet">{c.bio}</p> : null}
              {c.personality ? (
                <p className="snippet muted">Personality: {c.personality}</p>
              ) : null}
              {c.tags ? <p className="meta">tags: {c.tags}</p> : null}
              <div className="row">
                <button type="button" className="secondary" onClick={() => startEdit(c)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete character “${c.name}”?`)) {
                      remove.mutate(c.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {list.data?.length === 0 && <p className="hint">No characters yet.</p>}
      </section>
    </div>
  );
}

function SettingsPanel({ search }: { search: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SettingWrite>(emptySetting);

  const list = useQuery({
    queryKey: ["settings", search],
    queryFn: () => listSettings(search || undefined),
    retry: false,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) return updateSetting(editingId, form);
      return createSetting(form);
    },
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptySetting());
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteSetting,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  function startEdit(s: Setting) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description,
      atmosphere: s.atmosphere,
      notes: s.notes,
      tags: s.tags,
      ucNegatives: s.ucNegatives,
      refImagePath: s.refImagePath,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    save.mutate();
  }

  return (
    <div className="split">
      <section className="card">
        <h2>{editingId ? "Edit setting" : "New setting"}</h2>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Atmosphere
            <textarea
              rows={2}
              value={form.atmosphere}
              onChange={(e) =>
                setForm({ ...form, atmosphere: e.target.value })
              }
            />
          </label>
          <label>
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label>
            Tags
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </label>
          <label>
            UC / negatives
            <input
              value={form.ucNegatives}
              onChange={(e) =>
                setForm({ ...form, ucNegatives: e.target.value })
              }
            />
          </label>
          <label>
            Ref image path
            <input
              value={form.refImagePath}
              onChange={(e) =>
                setForm({ ...form, refImagePath: e.target.value })
              }
            />
          </label>
          <div className="row">
            <button type="submit" disabled={save.isPending}>
              {editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptySetting());
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {save.isError && (
            <p className="error">{(save.error as Error).message}</p>
          )}
        </form>
      </section>

      <section className="card">
        <h2>Settings {search ? `(search: ${search})` : ""}</h2>
        {list.isLoading && <p>Loading…</p>}
        {list.isError && (
          <p className="error">{(list.error as Error).message}</p>
        )}
        <ul className="entity-list">
          {(list.data ?? []).map((s) => (
            <li key={s.id}>
              <div className="entity-head">
                <strong>{s.name}</strong>
                <span className="meta">{s.id.slice(0, 8)}…</span>
              </div>
              {s.description ? <p className="snippet">{s.description}</p> : null}
              {s.atmosphere ? (
                <p className="snippet muted">Atmosphere: {s.atmosphere}</p>
              ) : null}
              <div className="row">
                <button type="button" className="secondary" onClick={() => startEdit(s)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`Delete setting “${s.name}”?`)) {
                      remove.mutate(s.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {list.data?.length === 0 && <p className="hint">No settings yet.</p>}
      </section>
    </div>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScaffoldPanel() {
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [settingIds, setSettingIds] = useState<string[]>([]);
  const [storyTitle, setStoryTitle] = useState("");
  const [draft, setDraft] = useState<ScaffoldingComposeResult | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  const characters = useQuery({
    queryKey: ["characters", ""],
    queryFn: () => listCharacters(),
    retry: false,
  });
  const settings = useQuery({
    queryKey: ["settings", ""],
    queryFn: () => listSettings(),
    retry: false,
  });

  const compose = useMutation({
    mutationFn: composeScaffolding,
    onSuccess: (result) => {
      setDraft(result);
      setCopyMsg("");
    },
  });

  function onCompose(e: FormEvent) {
    e.preventDefault();
    if (characterIds.length === 0 && settingIds.length === 0) return;
    compose.mutate({
      characterIds,
      settingIds,
      storyTitle: storyTitle.trim() || undefined,
    });
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${label}`);
    } catch {
      setCopyMsg(`Clipboard failed — use Download instead`);
    }
  }

  const canCompose = characterIds.length > 0 || settingIds.length > 0;

  return (
    <div className="stack-gap">
      <section className="card">
        <h2>Story scaffolding</h2>
        <p className="hint">
          Select lore entities, compose NovelAI-oriented memory, lorebook entries, and a
          system prompt. Export via copy or download — no NovelAI text-UI or image generate.
        </p>
        <form onSubmit={onCompose} className="stack">
          <label>
            Story title (optional)
            <input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="e.g. Compass Lost"
            />
          </label>

          <div className="split">
            <div>
              <h3 className="subhead">Characters</h3>
              {(characters.data ?? []).map((c) => (
                <label key={c.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={characterIds.includes(c.id)}
                    onChange={() =>
                      setCharacterIds((ids) => toggleId(ids, c.id))
                    }
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {characters.data?.length === 0 && (
                <p className="hint">No characters — create some first.</p>
              )}
            </div>
            <div>
              <h3 className="subhead">Settings</h3>
              {(settings.data ?? []).map((s) => (
                <label key={s.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={settingIds.includes(s.id)}
                    onChange={() => setSettingIds((ids) => toggleId(ids, s.id))}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
              {settings.data?.length === 0 && (
                <p className="hint">No settings — create some first.</p>
              )}
            </div>
          </div>

          <button type="submit" disabled={!canCompose || compose.isPending}>
            Compose drafts
          </button>
          {compose.isError && (
            <p className="error">{(compose.error as Error).message}</p>
          )}
        </form>
      </section>

      {draft && (
        <section className="card">
          <h2>Drafts — {draft.storyTitle}</h2>
          <div className="row wrap">
            <button
              type="button"
              className="secondary"
              onClick={() => copyText("plain text", draft.plainText)}
            >
              Copy all (plain)
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  `${slug(draft.storyTitle)}-scaffold.txt`,
                  draft.plainText,
                  "text/plain;charset=utf-8",
                )
              }
            >
              Download .txt
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                downloadText(
                  `${slug(draft.storyTitle)}-scaffold.json`,
                  JSON.stringify(draft, null, 2),
                  "application/json",
                )
              }
            >
              Download .json
            </button>
          </div>
          {copyMsg && <p className="ok">{copyMsg}</p>}

          <DraftBlock
            title="Memory"
            text={draft.memory}
            onCopy={() => copyText("memory", draft.memory)}
          />
          <div className="draft-block">
            <div className="entity-head">
              <h3 className="subhead">Lorebook ({draft.lorebook.length})</h3>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  copyText(
                    "lorebook JSON",
                    JSON.stringify(draft.lorebook, null, 2),
                  )
                }
              >
                Copy JSON
              </button>
            </div>
            {draft.lorebook.map((e) => (
              <div key={e.sourceId} className="lorebook-entry">
                <strong>
                  {e.keys}{" "}
                  <span className="meta">
                    ({e.sourceType})
                  </span>
                </strong>
                <pre className="draft-pre">{e.text}</pre>
              </div>
            ))}
          </div>
          <DraftBlock
            title="System prompt"
            text={draft.systemPrompt}
            onCopy={() => copyText("system prompt", draft.systemPrompt)}
          />
        </section>
      )}
    </div>
  );
}

function DraftBlock({
  title,
  text,
  onCopy,
}: {
  title: string;
  text: string;
  onCopy: () => void;
}) {
  return (
    <div className="draft-block">
      <div className="entity-head">
        <h3 className="subhead">{title}</h3>
        <button type="button" className="secondary" onClick={onCopy}>
          Copy
        </button>
      </div>
      <pre className="draft-pre">{text}</pre>
    </div>
  );
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "story"
  );
}

function GalleryPanel() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState("");
  const [status, setStatus] = useState("");

  const characters = useQuery({
    queryKey: ["characters", ""],
    queryFn: () => listCharacters(),
    retry: false,
  });

  const images = useQuery({
    queryKey: ["vault-images"],
    queryFn: listVaultImages,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: generateNaiImage,
    onSuccess: async () => {
      setStatus("Generated and saved to vault.");
      await qc.invalidateQueries({ queryKey: ["vault-images"] });
    },
    onError: (err) => {
      setStatus((err as Error).message);
    },
  });

  const importMut = useMutation({
    mutationFn: importVaultPng,
    onSuccess: async () => {
      setStatus("Imported PNG into vault.");
      await qc.invalidateQueries({ queryKey: ["vault-images"] });
    },
    onError: (err) => {
      setStatus((err as Error).message);
    },
  });

  function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setStatus("Generating (human-initiated)…");
    const seedNum = seed.trim() ? Number(seed) : undefined;
    generate.mutate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
      seed: Number.isFinite(seedNum) ? seedNum : undefined,
      n: 1,
    });
  }

  function prefillFromCharacter(id: string) {
    const c = (characters.data ?? []).find((x) => x.id === id);
    if (!c) return;
    if (c.tags) setPrompt(c.tags);
    if (c.ucNegatives) setNegativePrompt(c.ucNegatives);
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      setStatus("Importing…");
      importMut.mutate({
        pngBase64: b64,
        prompt: prompt.trim() || undefined,
        negativePrompt: negativePrompt.trim() || undefined,
        seed: seed.trim() || undefined,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="stack-gap">
      <section className="card">
        <h2>Human generate (NovelAI)</h2>
        <p className="hint">
          One image per click. Server auto-saves into the vault. Requires{" "}
          <code>AIGEN_NOVELAI_API_KEY</code>. Or import a PNG downloaded from NovelAI.
        </p>
        <form onSubmit={onGenerate} className="stack">
          <label>
            Prefill tags from character
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) prefillFromCharacter(e.target.value);
              }}
            >
              <option value="">—</option>
              {(characters.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>
          <label>
            UC / negative
            <textarea
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
            />
          </label>
          <label>
            Seed (optional)
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="random if empty"
            />
          </label>
          <div className="row wrap">
            <button type="submit" disabled={generate.isPending}>
              Generate (1 image)
            </button>
            <label className="file-btn">
              Import PNG
              <input
                type="file"
                accept="image/png"
                hidden
                onChange={(e) =>
                  onImportFile(e.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
        </form>
        {status && <p className="hint">{status}</p>}
      </section>

      <section className="card">
        <h2>Vault gallery</h2>
        {images.isLoading && <p>Loading…</p>}
        {images.isError && (
          <p className="error">{(images.error as Error).message}</p>
        )}
        <div className="gallery-grid">
          {(images.data ?? []).map((img) => (
            <VaultThumb key={img.id} image={img} />
          ))}
        </div>
        {images.data?.length === 0 && (
          <p className="hint">No vault images yet.</p>
        )}
      </section>
    </div>
  );
}

function VaultThumb({ image }: { image: VaultImage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchVaultImageObjectUrl(image.id)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch((e) => setErr((e as Error).message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <figure className="vault-card">
      {url ? (
        <img src={url} alt={image.prompt || image.id} />
      ) : (
        <div className="vault-placeholder">{err || "…"}</div>
      )}
      <figcaption>
        <span className="meta">{image.source}</span>
        <p className="snippet">{image.prompt || "(no prompt)"}</p>
        {image.seed ? <p className="meta">seed {image.seed}</p> : null}
      </figcaption>
    </figure>
  );
}
